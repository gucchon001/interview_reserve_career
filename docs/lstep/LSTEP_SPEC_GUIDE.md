# L-step 連携 詳細仕様ガイド

本システム（GAS）と L-step の API 連携について、エンドポイント種別・パラメータ・設定手順・注意事項をまとめた仕様ガイドです。

---

## 1. エンドポイントの種類（2本構成）

L-step 連携では **2種類のエンドポイント** を使い分けます。リスケ用の3本目は不要です（キャンセル用＋予約用で対応）。

| 種別 | 用途 | GAS プロパティ | 呼び出しタイミング | L-step で紐づけるアクション |
|------|------|----------------|---------------------|-----------------------------|
| **予約用** | 予約確定時の友だち情報・タグ・メッセージ・リマインダ | `LSTEP_TRIGGER_URL` | `event_confirmed` 受信時 | 友だち情報更新 ＋ **予約時メッセージ** ＋ **タグ** ＋ **リマインダ操作** |
| **キャンセル用** | キャンセル時の友だち情報クリア（リマインド停止） | `LSTEP_CANCEL_TRIGGER_URL` | `event_cancelled` 受信時 | **友だち情報の更新のみ**（メッセージ・タグ・リマインダは **一切紐づけない**） |

### なぜキャンセル用を分けるか

予約確定時とキャンセル時で **同じ URL** を呼ぶと、L-step は「トリガーが来た」と解釈し、そのエンドポイントに紐づいた **すべての連携アクション**（予約時メッセージ送信を含む）を実行します。キャンセル時は `meeting_date: null` 等を送るため、**空の日時・空の URL が入った予約時メッセージ** がユーザーに送られてしまいます。  
そのため、**キャンセル用は別エンドポイントを1本用意**し、そこには「友だち情報の更新のみ」を設定し、メッセージ送信・タグ・リマインダは紐づけません。

### リスケについて

リスケは「旧予約のキャンセル → 新予約の確定」の2回の Webhook で扱います。キャンセル用1本 ＋ 予約用1本の計2種類で対応するため、**リスケ専用エンドポイントは不要**です。

---

## 2. GAS から送るパラメータ

### 2.1 予約確定時（予約用エンドポイント）

| キー | 型 | 説明 |
|------|-----|------|
| `uid` | 文字列 | LINE ユーザーID（必須） |
| `meeting_date` | 文字列（日時形式） | 面談日時（例: `2026-02-20 14:00:00`） |
| `meeting_url` | 文字列 | ミーティングURL |
| `meeting_cancel_url` | 文字列 | キャンセル用URL |
| `tag` | 文字列 | 付与するタグ名（例: `面談予約済み`） |

GAS は上記に加え、L-step のラベル名に合わせて `面談日時`・`ミーティングURL`・`キャンセル用URL`・`付与するタグ名` および camelCase 版も `params` 内に含めて送信します。

### 2.2 キャンセル時（キャンセル用エンドポイント）

| キー | 値 | 説明 |
|------|-----|------|
| `uid` | 文字列 | LINE ユーザーID（必須） |
| `meeting_date` | `null` | 友だち情報をクリア |
| `meeting_url` | `null` | 友だち情報をクリア |
| `meeting_cancel_url` | `null` | 友だち情報をクリア |

キャンセル用エンドポイントでは、受け取った `params` をそのまま友だち情報に反映するだけで、メッセージ送信・タグ・リマインダは実行されないようにします。

---

## 2.5 パラメータの設定詳細（L-step 管理画面での登録）

### 予約用エンドポイントで登録するパラメータ

L-step の **API連携 → エンドポイント → パラメータ管理** で、以下の **JSONキー** を登録します。キー名は GAS の送信と一致させる必要があります。

| JSONキー | 推奨データ型（L-step） | ラベル（管理用） | 説明 | 予約時の値の例 |
|----------|------------------------|-------------------|------|----------------|
| `uid` | 文字列 | LINEユーザーID | 必須。L-step が友だちを特定するために使用。cURL サンプルに既にある場合は重複登録不要。 | `U0123456789abcdef...` |
| `meeting_date` | 日時 または 文字列 | 面談日時 | 面談日時。リマインダのゴール日やメッセージ埋め込みに利用。 | `2026-02-20 14:00:00` |
| `meeting_url` | 文字列 | ミーティングURL | Meet 等のURL。メッセージ埋め込みに利用。 | `https://meet.google.com/xxx` |
| `meeting_cancel_url` | 文字列 | キャンセル用URL | TimeRex のキャンセル用URL。メッセージ埋め込みに利用。 | `https://timerex.net/schedule/cancel/xxx` |
| `tag` | 文字列 | 付与するタグ名 | 付与するタグ名。「連携データからタグを追加」で参照。固定タグの場合は未使用でも可。 | `面談予約済み` |

### キャンセル用エンドポイントで登録するパラメータ

キャンセル用では **メッセージ・タグ・リマインダに使わない** ため、`tag` は不要です。友だち情報のクリアだけ行う場合は次の4つで十分です。

| JSONキー | 推奨データ型（L-step） | ラベル | キャンセル時の値 |
|----------|------------------------|--------|-------------------|
| `uid` | 文字列 | LINEユーザーID | 対象の LINE UID |
| `meeting_date` | 日時 または 文字列 | 面談日時 | `null`（クリア） |
| `meeting_url` | 文字列 | ミーティングURL | `null`（クリア） |
| `meeting_cancel_url` | 文字列 | キャンセル用URL | `null`（クリア） |

### GAS が送るリクエストボディの構造

GAS は **ルート直下** と **`params` オブジェクト内** の両方に値を入れます。L-step の連携アクションで「取得した情報」を選ぶときは、多くの場合 **`params` 内のキー** または **ラベル名** で参照します。

**ルート直下に含まれるキー（予約時）:**

- `uid`（必須）
- `meeting_date`, `meetingDate`, `面談日時`
- `meeting_url`, `meetingUrl`, `ミーティングURL`
- `meeting_cancel_url`, `meetingCancelUrl`, `キャンセル用URL`
- `tag`, `付与するタグ名`

**`params` オブジェクト内:**

- 上記と同じキー・値が **オブジェクト** として格納される（配列 `[]` ではない）。
- 例: `params.meeting_date`, `params["面談日時"]`, `params.meeting_url` など。

**送信例（予約確定時）:**

```json
{
  "uid": "U0123456789abcdef",
  "meeting_date": "2026-02-20 14:00:00",
  "meetingDate": "2026-02-20 14:00:00",
  "面談日時": "2026-02-20 14:00:00",
  "meeting_url": "https://meet.google.com/xxx",
  "meetingUrl": "https://meet.google.com/xxx",
  "ミーティングURL": "https://meet.google.com/xxx",
  "meeting_cancel_url": "https://timerex.net/schedule/cancel/xxx",
  "meetingCancelUrl": "https://timerex.net/schedule/cancel/xxx",
  "キャンセル用URL": "https://timerex.net/schedule/cancel/xxx",
  "tag": "面談予約済み",
  "付与するタグ名": "面談予約済み",
  "params": {
    "meeting_date": "2026-02-20 14:00:00",
    "meetingDate": "2026-02-20 14:00:00",
    "面談日時": "2026-02-20 14:00:00",
    "meeting_url": "https://meet.google.com/xxx",
    "meetingUrl": "https://meet.google.com/xxx",
    "ミーティングURL": "https://meet.google.com/xxx",
    "meeting_cancel_url": "https://timerex.net/schedule/cancel/xxx",
    "meetingCancelUrl": "https://timerex.net/schedule/cancel/xxx",
    "キャンセル用URL": "https://timerex.net/schedule/cancel/xxx",
    "tag": "面談予約済み",
    "付与するタグ名": "面談予約済み"
  }
}
```

**送信例（キャンセル時）:**

```json
{
  "uid": "U0123456789abcdef",
  "meeting_date": null,
  "meetingDate": null,
  "面談日時": null,
  "meeting_url": null,
  "meetingUrl": null,
  "ミーティングURL": null,
  "meeting_cancel_url": null,
  "meetingCancelUrl": null,
  "キャンセル用URL": null,
  "params": {
    "meeting_date": null,
    "meetingDate": null,
    "面談日時": null,
    "meeting_url": null,
    "meetingUrl": null,
    "ミーティングURL": null,
    "meeting_cancel_url": null,
    "meetingCancelUrl": null,
    "キャンセル用URL": null
  }
}
```

### 友だち情報項目との対応

L-step の **友だち情報欄管理** で作成した項目に、連携アクションの「友だち情報操作」でパラメータを代入するときの対応です。

| 友だち情報の項目名（L-step で作成） | 代入するパラメータ（連携アクションで選択） |
|-------------------------------------|--------------------------------------------|
| 面談日時 | `meeting_date` または 面談日時 |
| ミーティングURL | `meeting_url` または ミーティングURL |
| キャンセル用URL | `meeting_cancel_url` または キャンセル用URL |

項目名は任意ですが、メッセージで `{{面談日時}}` のように埋め込む場合は、L-step が認識する **パラメータのラベル名またはキー名** と一致させる必要があります。GAS は `meeting_date`・`面談日時`・`meetingDate` のいずれでも同じ値を送っているため、L-step 側でどれを参照しても値は取得できます。

### 注意事項

- **`params` はオブジェクトであること**: 配列 `[]` ではなく、キーと値のオブジェクトです。GAS は常にオブジェクトで送信します。
- **params が空になるケース**: GAS では、`meeting_date` 等を渡しているのに `params` が空になる場合は送信前にエラーにしています。L-step 画面で `params: []` と見える場合は、GAS の実行ログ「送信 params キー数」「送信 params 内容」で実送信値を確認してください。
- **データ型**: L-step で「日時」型を選べる場合は `meeting_date` に日時型を指定すると、リマインダのゴール日として扱いやすくなります。文字列のままでも動作する場合があります。

---

## 3. GAS 側の設定（スクリプトプロパティ）

| プロパティ名 | 必須 | 説明 |
|--------------|------|------|
| `LSTEP_API_TOKEN` | ○ | L-step API 認証トークン（予約用・キャンセル用で共通） |
| `LSTEP_TRIGGER_URL` | ○ | 予約用エンドポイントのトリガーURL（cURL実行サンプルの URL） |
| `LSTEP_CANCEL_TRIGGER_URL` | △ | キャンセル用エンドポイントのトリガーURL。**未設定時は `LSTEP_TRIGGER_URL` にフォールバック**（後方互換）。キャンセル時に予約時メッセージを送りたくない場合は設定を推奨。 |

その他: `LSTEP_UID_ONLY`（true のとき L-step 連携を行わない）、`LSTEP_USE_TRIGGER_URL`（true のときトリガーURL 経由で連携）は `Config.gs` またはスクリプトプロパティで設定します。

---

## 4. L-step 側の設定手順

### 4.1 予約用エンドポイント

1. **API連携** → **エンドポイント設定** で新規エンドポイントを作成（例: 面談予約連携）。
2. **パラメータ管理** で `uid`・`meeting_date`・`meeting_url`・`meeting_cancel_url`・`tag` を登録（JSONキー・データ型・ラベルは **2.5 パラメータの設定詳細** および [LSTEP_API_SETUP_GUIDE.md](LSTEP_API_SETUP_GUIDE.md) 参照）。
3. **連携アクション** で以下を設定:
   - **友だち情報操作**: `meeting_date` → 面談日時、`meeting_url` → ミーティングURL、`meeting_cancel_url` → キャンセル用URL
   - **タグ操作**: 「タグを追加」で「面談予約済み」など
   - **予約時メッセージ送信**: 任意（`{{面談日時}}`・`{{ミーティングURL}}`・`{{キャンセル用URL}}` を埋め込み）
   - **リマインダ操作**: ゴール日に `meeting_date` を代入
4. **cURL実行サンプル** の URL を GAS の `LSTEP_TRIGGER_URL` に設定。

### 4.2 キャンセル用エンドポイント（推奨）

1. **API連携** → **エンドポイント設定** で **別の** エンドポイントを1つ作成（例: 面談キャンセル連携）。
2. **パラメータ管理** で `uid`・`meeting_date`・`meeting_url`・`meeting_cancel_url` を登録（**2.5 パラメータの設定詳細**の「キャンセル用」参照。`tag` は不要。null が送られてくる想定）。
3. **連携アクション** では **友だち情報操作のみ** 設定する:
   - 友だち情報「面談日時」に `meeting_date` を代入
   - 友だち情報「ミーティングURL」に `meeting_url` を代入
   - 友だち情報「キャンセル用URL」に `meeting_cancel_url` を代入  
   → null が送られると友だち情報がクリアされる。
4. **メッセージ送信・タグ操作・リマインダ操作は追加しない。**
5. **cURL実行サンプル** の URL を GAS の `LSTEP_CANCEL_TRIGGER_URL` に設定。

**重要**: キャンセル用エンドポイントに「予約時メッセージ送信」や「タグを追加」「リマインダ操作」を紐づけると、キャンセル時にもそれらが実行され、意図しないメッセージが送信されます。**友だち情報の更新のみ**にしてください。

---

## 5. 実装上のポイント（GAS）

- **予約確定時**: `WebhookHandler.handleEventConfirmed` 内で `LStepApiService.triggerFriendUpdate(lineUid, lstepData)` を呼ぶ（第3引数なし → 予約用 URL を使用）。
- **キャンセル時**: `WebhookHandler.handleEventCancelled` 内で `LStepApiService.triggerFriendUpdate(lineUid, { meeting_date: null, meeting_url: null, meeting_cancel_url: null }, { useCancelUrl: true })` を呼ぶ。`LSTEP_CANCEL_TRIGGER_URL` が未設定の場合は `LSTEP_TRIGGER_URL` にフォールバック（従来どおり1本で運用している場合の後方互換）。

---

## 6. 動作確認の観点

- **予約確定後**: 該当友だちにタグ・友だち情報・予約時メッセージが設定され、リマインドのゴール日が入っていること。
- **キャンセル後**: 該当友だちの「面談日時」「ミーティングURL」「キャンセル用URL」がクリアされていること。**キャンセルを理由とした予約時メッセージが送られていないこと**（キャンセル用エンドポイントを分けている場合）。
- **リスケ**: 旧予約キャンセルで友だち情報がクリアされ、新規予約確定で再度タグ・メッセージ・リマインダが設定されること。

詳細なテスト手順は [TIMEREX_LSTEP_TEST_PROCEDURE.md](../operations/TIMEREX_LSTEP_TEST_PROCEDURE.md) を参照してください。

---

## 7. 関連ドキュメント

| ドキュメント | 内容 |
|--------------|------|
| [LSTEP_API_SETUP_GUIDE.md](LSTEP_API_SETUP_GUIDE.md) | 予約用エンドポイントの L-step 管理画面での設定手順 |
| [LSTEP_REMINDER_SPEC.md](LSTEP_REMINDER_SPEC.md) | リマインダ仕様・キャンセル時のトリガーURL の扱い |
| [LSTEP_SESSION_ERROR_TROUBLESHOOTING.md](LSTEP_SESSION_ERROR_TROUBLESHOOTING.md) | URLタップで「セッションが見つかりません」になる場合の原因と対処 |
| [TIMEREX_GAS_LSTEP_DESIGN.md](../design/TIMEREX_GAS_LSTEP_DESIGN.md) | TimeRex・GAS・L-step の責任分界とキャンセル時のフロー |
| [TIMEREX_LSTEP_TEST_PROCEDURE.md](../operations/TIMEREX_LSTEP_TEST_PROCEDURE.md) | モック・E2E テスト手順とキャンセル時の確認項目 |
