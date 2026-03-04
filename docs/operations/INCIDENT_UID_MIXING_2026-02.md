# インシデント: UID混入による他ユーザーへのリマインダ送信（2026年2月）

## 概要

同時刻に複数ユーザーが操作した際、**別のユーザーのUIDに予約が紐づき、誤ってそのユーザーにリマインダが送信された**事象が発生した。謝罪済み。API連携エンドポイントは一時「停止中」に変更済み。

## 事象

- **正しいUID**: `U3832834cd3de9df40f79664d1fe31030`（テスト操作者）
- **混入したUID**: `Ufa6949be3b542e84fca35137ebcceeca`（別ユーザー）
- uidlog: 1915行目で正しいUIDで postback・予約開始。1919行目で別UIDが混入し、以降その予約が別UIDのものと判別された。
- 結果: 別ユーザーにリマインダメッセージが送信された。（リマインダの仕様は [LSTEP_REMINDER_SPEC.md](../lstep/LSTEP_REMINDER_SPEC.md) 参照）

## 根本原因

**「メッセージ内のURLに `session_id` が含まれておらず、クリック時に『直近2分以内の uidlog の最新1件』でセッションを決めている」ため、同時刻に他ユーザーが postback すると、別ユーザーのセッションが割り当てられる。**

### フローの整理

1. **ユーザーA**がボタンをタップ → `handleLStepWebhook` が POST 受信 → UID_A と session_id_A を生成し、uidlog に追記（例: 1915行目）。
2. **ユーザーB**がボタンをタップ（または別イベントで uidlog に B の行が追加される）→ uidlog に UID_B, session_id_B が追記（例: 1919行目）。
3. L-step がユーザーに送るメッセージ内のURLは **固定の `?from=line`**（または `?action=lstep_webhook`）であり、**session_id は含まれない**。
4. **誰か**（ここではユーザーA）がそのURLをクリック → `doGet({ from: 'line' })` が呼ばれるが、URLに session_id がない。
5. `getMostRecentSession(120)` が **uidlog の「直近2分以内の最新1行」** を返す → 1919行目（ユーザーBのセッション）が選ばれる。
6. 予約画面が **session_id_B** で表示され、予約確定時に **UID_B** に紐づく → リマインダが **ユーザーB** に送信される。

つまり「直近1件」は **リクエスト処理順（uidlog の行の追加順）** で決まるため、**同時刻に複数ユーザーがいると、クリックした人とセッションの所有者が一致しない**。

### 仕様上の前提との齟齬

- 仕様（LSTEP_WEBHOOK_SPEC.md 等）では「**同一ユーザーがタップ後2分以内に1回だけクリックする想定**」としている。
- 実際には **複数ユーザーが同時に利用する** ため、この前提は成り立たず、UID混入が発生する。

## 影響範囲

- `doGet`: `action=lstep_webhook` または `from=line` のとき、`session_id` が無い場合に `getMostRecentSession(120)` を使用している（`Code.gs`）。
- `SpreadsheetService.getMostRecentSession(withinSeconds)`: uidlog を「最新行から遡り、指定秒数以内の**イベント種別が postback の行**の先頭1件」で返している（`SpreadsheetService.gs`）。message 等の他イベント行は対象外のため、他ユーザーの「message」が直後に記録されても postback 行が選ばれる。
- 予約確定・リマインダ送信は、そのセッションに紐づく UID に対して行われるため、**誤った UID にリマインダが送られる**。

## 再発防止（推奨対応）

### 本質的な対策: URL に session_id を含める

- **メッセージ内のリンクに `session_id` を含める**ことで、「誰がクリックしたか」ではなく「どのセッション用のリンクか」で一意に紐づける。
- 実現方法の候補:
  1. **L-step 側**: Webhook 転送のレスポンス（HTML）からリダイレクトURL（`session_id` 付き）を取得し、シナリオでそのURLをメッセージに埋め込む。L-step の機能次第。
  2. **GAS 側**: Webhook 受信後、GAS から LINE Messaging API を直接叩き、**session_id 付きURL** をユーザーに送る。L-step の「テキスト＋URL送信」と役割が重複するため、シナリオ調整が必要。
  3. **短いトークン**: `session_id` の代わりに短いトークンを発行し、URL を `?from=line&token=xxx` にする。token → session_id の対応を CacheService/uidlog に保持。L-step が動的URLを送れない場合は、トークンも送れないため要検討。

### 暫定対策（運用）

- 複数ユーザーが同時にボタンを押さないよう注意喚起する、または API 連携を停止したまま運用する（今回の対応）。
- **【運用上の禁止】session_id 無しの `?from=line` 単体の利用は、同時利用が発生し得る環境では使用禁止とする。** 複数ユーザーが同時にリンクを開く可能性がある場合は、L-step で session_id 付きURLをメッセージに載せる方式に切り替えるか、API連携を停止すること。根本対策が入るまで、「直近1件」に依存する運用は危険であることを必ず認識する。

## コード・ドキュメントの変更

- 本ドキュメントの追加。
- `Code.gs` の `doGet` において、**URL に `session_id` が既にある場合は `getMostRecentSession` を使わず、その session_id を優先する**ようにする（L-step が将来 session_id 付きURLを送った場合に備える）。
- LSTEP_WEBHOOK_SPEC.md に「同時利用時のリスク」と「session_id 付きURL推奨」を追記する。

## 参照

- uidlog: 日時, uid, sessionid, イベント種別
- `getMostRecentSession(120)`: SpreadsheetService.gs
- `doGet` の `from=line` 分岐: Code.gs
- LSTEP_WEBHOOK_SPEC.md 3.2 / 4.1
