# TimeRex・GAS・L-step 連携 テスト手順

[TimeRex・GAS・L-step 責任分界とリマインド連携設計](../design/TIMEREX_GAS_LSTEP_DESIGN.md) に基づくテスト手順です。  
**予約キャンセルは TimeRex の機能**で実行され、キャンセル時に GAS が L-step に `meeting_date: null` 等を送り、リマインドが停止する流れを検証します。

---

## 前提条件の確認

テスト前に以下を確認してください。

| 項目 | 確認方法 | 備考 |
|------|----------|------|
| **LSTEP_UID_ONLY** | `Config.gs` またはスクリプトプロパティ | キャンセル時の L-step 連携を行う場合は **`false`** であること |
| **TimeRex Webhook URL** | TimeRex 管理画面 | 本システムの `doPost` が応答する URL が設定されていること |
| **L-step リマインド条件** | L-step 管理画面 | リマインドのゴール日に **`meeting_date`** を設定し、条件を「meeting_date に値があること」にすること |
| **L-step トリガーURL・トークン** | スクリプトプロパティ | `LSTEP_TRIGGER_URL`・`LSTEP_API_TOKEN` が設定されていること（トリガーURL 利用時） |

---

## 1. 疎通・単体テスト（GAS エディタで実行）

ネットワークや実際の予約なしに、ロジックと疎通だけを確認する手順です。

### 1.1 最低限の疎通

**手順:**

1. GAS エディタで **`TestApi.gs`** を開く。
2. 関数 **`runMinimumConnectivityTest`** を選択して実行。
3. 実行ログの「結果サマリー」で L-step・TimeRex API・スプレッドシートが ✓ であることを確認。

**確認項目:**

- [ ] L-step（認証・GET）が ✓
- [ ] TimeRex APIキーが ✓
- [ ] スプレッドシートが ✓

### 1.2 Webhook モックテスト（予約確定・キャンセル）

**手順:**

1. GAS エディタで **`runAllWebhookTests`** を実行。
2. 実行ログで `event_confirmed` と `event_cancelled` の両方が成功していることを確認。
3. スプレッドシートの **`interviews`** シートを確認。

**確認項目:**

- [ ] `event_confirmed` テストが成功しているか
- [ ] `interviews` に新規行が追加され、`event_id`・`status=1` 等が正しく記録されているか
- [ ] `event_cancelled` テストが成功しているか
- [ ] 該当レコードの `status` が **3（キャンセル）** に更新されているか

**個別実行（キャンセルだけ試す場合）:**

```javascript
// 最新の event_id でキャンセルテスト（先に runWebhookConfirmedTest でレコードがあること）
runWebhookCancelledTest();

// 特定の event_id を指定する場合
runWebhookCancelledTest('event-id-here');
```

### 1.3 L-step 連携の単体テスト（ペイロード・データ抽出）

**手順:**

1. GAS エディタで **`runLStepUnitTests`** を実行。
2. 実行ログで 4 種類のテストがすべて成功していることを確認。

**確認項目:**

- [ ] `runGetUrlParamValueTest`: `url_params` から line_uid が取得できる
- [ ] `runFormatDateTimeForLStepTest`: 日時が L-step 用形式でフォーマットされる
- [ ] `runLStepTriggerPayloadBuildTest`: ペイロードに `meeting_date`・`meeting_url`・`meeting_cancel_url`・`tag` 等が含まれる
- [ ] `runWebhookEventToLStepDataExtractionTest`: Webhook の event から L-step 用データが正しく抽出される

### 1.4 L-step トリガーURL 送信テスト（タグ・友だち情報）

**手順:**

1. GAS エディタで **`runLStepApiTriggerTestWithTag`** を実行（引数なしでサンプル UID、または `runLStepApiTriggerTestWithTag('テスト用UID')`）。
2. 実行ログで HTTP 2xx が返っていることを確認。
3. L-step の「友だちリスト」で該当 UID の友だち情報・タグが更新されているか確認。

**確認項目:**

- [ ] トリガーURL への POST が 2xx で成功しているか
- [ ] L-step 側で友だち情報（面談日時・ミーティングURL・キャンセル用URL）が設定されているか（テストで送った値）
- [ ] タグ「面談予約済み」が付与されているか（L-step で「連携データからタグを追加」等を設定している場合）

---

## 2. 予約確定フロー（実機・E2E）

TimeRex で実際に予約を確定し、Webhook → スプレッドシート・L-step まで一連の流れを確認します。

### 2.1 予約確定〜L-step 連携まで

**手順:**

1. LINE または予約画面から TimeRex の予約枠を開き、**テスト用の日時で予約を確定**する。  
   （予約時に `line_uid` が TimeRex に渡るよう、L-step 経由の URL で予約する想定）
2. 数秒待ち、GAS の実行ログを確認（`clasp logs --watch` または GAS エディタの「実行ログ」）。
3. スプレッドシートの **`interviews`** シートで、該当の **`event_id`** の行を確認。
4. L-step の「友だちリスト」で、該当 **LINE UID** の友だち情報・タグを確認。

**確認項目:**

- [ ] ログに `[doPost] Processing event_confirmed` および `Lステップ友だち情報更新成功` が出ているか
- [ ] `interviews` に新規行が追加され、`event_id`・`line_uid`・`status=1` が入っているか
- [ ] L-step の友だち情報に「面談日時」「ミーティングURL」「キャンセル用URL」が設定されているか
- [ ] タグ「面談予約済み」が付いているか（設定している場合）

**この時点で `event_id` と `line_uid` をメモしておく**と、次のキャンセルテストで参照しやすいです。

---

## 3. 予約キャンセル〜リマインド解除（実機・E2E）

**重要:** キャンセル操作は **TimeRex の機能**で行います。GAS は「キャンセルが発生した」という Webhook を受け取り、スプレッドシート更新と L-step への null 送信（リマインド解除相当）を行います。

### 3.1 TimeRex でキャンセルを実行

**手順（ゲストとしてキャンセルする場合）:**

1. 予約確定メールまたは LINE に記載の **キャンセル用URL**（`guest_cancel_url` / `{{meeting_cancel_url}}`）を開く。
2. TimeRex のキャンセル画面でキャンセルを実行する。

**手順（ホストとしてキャンセルする場合）:**

1. **TimeRex 管理画面**にログインする。
2. 該当予定を選択し、**キャンセル**を実行する。

### 3.2 Webhook 受信と GAS の処理確認

**手順:**

1. キャンセル実行後、数秒以内に GAS の実行ログを確認する。
2. スプレッドシートの **`interviews`** シートで、該当 **`event_id`** の行の **`status`** を確認する。
3. （任意）**`uidlog`** シートで `LSTEP_API_CANCEL_SUCCESS` または `LSTEP_API_CANCEL_SKIP` 等の記録を確認する。

**確認項目:**

- [ ] ログに `[doPost] Processing event_cancelled` が出力されているか
- [ ] ログに `Lステップ友だち情報クリア成功（リマインド配信停止）` が出力されているか（`line_uid` があり、`LSTEP_UID_ONLY` が false の場合）
- [ ] 該当レコードの **`status`** が **3（キャンセル）** に更新されているか
- [ ] `uidlog` に `LSTEP_API_CANCEL_SUCCESS` が記録されているか（L-step 連携が実行された場合）

### 3.3 L-step 側の確認（リマインド解除の確認）

**手順:**

1. L-step の「友だちリスト」で、キャンセルした予約の **LINE UID** の友だちを開く。
2. 友だち情報の「面談日時」「ミーティングURL」「キャンセル用URL」が **空になっているか** を確認する。
3. リマインド配信条件が「`meeting_date` に値が入っていること」であれば、**この友だちにはリマインドが送信されない**状態になっている。

**確認項目:**

- [ ] 友だち情報の「面談日時」「ミーティングURL」「キャンセル用URL」がクリアされているか
- [ ] リマインド設定の条件（`meeting_date` に値があること）を満たさないため、キャンセル後はリマインドが配信されない状態であること
- [ ] **キャンセルを理由とした予約時メッセージが送られていないこと**（キャンセル用エンドポイントを分けている場合。LSTEP_SPEC_GUIDE 参照）

**リマインド送信タイミングのテスト（任意）:**

- リマインドを「前日」「当日」に送る設定にしている場合、**キャンセル後にその日時を迎えてもリマインドが届かないこと**を別日に確認してもよい。

---

## 4. キャンセル時のエッジケース

### 4.1 line_uid が無いレコードをキャンセルした場合

**手順:**

1. 手動登録などで **`line_uid` が空**の予約を 1 件用意する（または既存の手動登録レコードの `event_id` を TimeRex でキャンセル）。
2. TimeRex でその予約をキャンセルする。
3. GAS の実行ログを確認する。

**確認項目:**

- [ ] `event_cancelled` は処理され、該当レコードの `status` は 3 に更新されているか
- [ ] ログに「LINE UIDが取得できなかったため、LステップAPI連携をスキップ（キャンセル）」と出ており、**エラーにならずに完了**しているか

### 4.2 LSTEP_UID_ONLY が true の場合

**手順:**

1. `Config.LSTEP_UID_ONLY` を **true** に変更（またはスクリプトプロパティで UID のみモードに）する。
2. 上記と同様に TimeRex でキャンセルを実行する。
3. ログを確認する。

**確認項目:**

- [ ] ログに「LSTEP_UID_ONLY のため、キャンセル時の友だち情報クリアはスキップ」と出ているか
- [ ] L-step には **何も送られず**、友だち情報はクリアされない（リマインドは止まらない）ことを理解した上で運用する

---

## 5. チェックリストまとめ

| 分類 | テスト内容 | 実行方法 | 確認ポイント |
|------|------------|----------|----------------|
| 疎通 | 最低限の疎通 | `runMinimumConnectivityTest` | L-step・TimeRex・スプレッドシート ✓ |
| モック | 予約確定 Webhook | `runWebhookConfirmedTest` | interviews にレコード追加・status=1 |
| モック | 予約キャンセル Webhook | `runWebhookCancelledTest` | 該当レコードの status=3 |
| 単体 | L-step ペイロード・データ抽出 | `runLStepUnitTests` | 4 種類すべて成功 |
| 疎通 | L-step トリガーURL 送信 | `runLStepApiTriggerTestWithTag` | 2xx・L-step 友だち情報・タグ更新 |
| E2E | 予約確定 | TimeRex で予約 | event_confirmed 受信・interviews 記録・L-step 更新 |
| E2E | 予約キャンセル〜リマインド解除 | TimeRex でキャンセル | event_cancelled 受信・status=3・L-step 友だち情報クリア・予約時メッセージ未送信（キャンセル用URL使用時） |

---

## 6. 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [TIMEREX_GAS_LSTEP_DESIGN.md](../design/TIMEREX_GAS_LSTEP_DESIGN.md) | 責任分界・キャンセル時のリマインド解除の設計 |
| [LSTEP_SPEC_GUIDE.md](../lstep/LSTEP_SPEC_GUIDE.md) | L-step 連携の詳細仕様（エンドポイント種別・キャンセル用） |
| [TESTING.md](../../TESTING.md) | プロジェクト全体のテスト・検証ガイド |
| [API_CONNECTIVITY_TEST.md](API_CONNECTIVITY_TEST.md) | L-step・TimeRex API 疎通テスト手順 |
| [LSTEP_API_SETUP_GUIDE.md](../lstep/LSTEP_API_SETUP_GUIDE.md) | L-step 管理画面でのリマインド・パラメータ設定 |
