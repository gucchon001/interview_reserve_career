# リマインダ仕様（L-step リマインダ機能の利用）

## 概要

**リマインダは当システムが直接送信するのではなく、L-step のリマインダ機能を利用している。**  
予約確定時に GAS から L-step の API 連携（トリガーURL）へ「予約者に紐づく LINE UID」と「面談日時（meeting_date）」等を送り、L-step 側でリマインダのゴール日を設定する。実際のリマインダメッセージの配信は L-step が行う。

---

## 用語

| 用語 | 説明 |
|------|------|
| **L-step リマインダ** | L-step 管理画面で設定する「リマインダ配信」機能。ゴール日（日付）を友だち情報などに設定すると、その日付の前などにメッセージを送信する。 |
| **リマインダ操作** | L-step の「API連携」の連携アクションの一種。API リクエストで受け取った日付情報を「リマインダのゴール日」に代入できる。 |
| **トリガーURL** | L-step の API 連携エンドポイントに紐づく URL。GAS が POST で `uid` とパラメータ（meeting_date 等）を送ると、L-step が該当友だちに対してアクション（友だち情報更新・タグ・**リマインダ操作**など）を実行する。 |

---

## 全体フロー

```
【予約確定】
  TimeRex Webhook → GAS WebhookHandler
  → event.url_params.line_uid（または custom_data）から LINE UID を取得
  → 面談日時を L-step 用フォーマットで生成（meeting_date）

【L-step 連携】
  GAS → L-step トリガーURL へ POST
  - uid: 上記 LINE UID
  - params: meeting_date, meeting_url, meeting_cancel_url, tag 等

【L-step 側】
  - 受け取った uid で友だちを特定
  - 連携アクションを実行:
    - 友だち情報操作（meeting_date 等を保存）
    - タグ操作（例: 「面談予約済」）
    - **リマインダ操作**: ゴール日に meeting_date を代入
  - リマインダ配信: 設定に従い、ゴール日（面談日）の前などにメッセージを送信
```

**リマインダメッセージの内容・送信タイミングは L-step の管理画面（リマインダ配信・連携アクションの設定）で決まる。** GAS は「誰に（uid）」「いつがゴール日か（meeting_date）」を渡すだけである。

---

## 本システム側の実装

### 予約確定時（リマインダを「有効化」）

| 項目 | 内容 |
|------|------|
| 処理 | `WebhookHandler.handleEventConfirmed` 内で L-step API 連携を実行 |
| 条件 | `lineUid` が取得でき、かつ `Config.LSTEP_UID_ONLY` が false、かつ トリガーURL 設定あり（`Config.LSTEP_USE_TRIGGER_URL` が true のとき） |
| 送信 | `LStepApiService.triggerFriendUpdate(lineUid, { meeting_date, meeting_url, meeting_cancel_url, tag })` |
| UID の出所 | TimeRex Webhook の `event.url_params.line_uid`（予約画面で TimeRex に渡した `line_uid`）。予約画面の `userData.uid` は session_id から復元した LINE UID。 |

### 予約キャンセル時（リマインダを「無効化」）

| 項目 | 内容 |
|------|------|
| 処理 | `WebhookHandler.handleEventCancelled` 内で L-step API 連携を実行 |
| 送信 | `LStepApiService.triggerFriendUpdate(lineUid, { meeting_date: null, meeting_url: null, meeting_cancel_url: null }, { useCancelUrl: true })` |
| 効果 | L-step 側で友だち情報をクリアし、リマインダのゴール日も外すことでリマインダ配信を止める。 |
| 使用URL | **LSTEP_CANCEL_TRIGGER_URL** が設定されていればその URL、未設定時は **LSTEP_TRIGGER_URL** にフォールバック（後方互換）。 |

**重要**: キャンセル時に予約時メッセージが送られないようにするには、L-step に**キャンセル用エンドポイント**を1本用意し、連携アクションは「友だち情報の更新のみ」とすること。予約時メッセージ・タグ・リマインダ操作は紐づけない。詳細は [LSTEP_SPEC_GUIDE.md](LSTEP_SPEC_GUIDE.md) を参照。

### 設定

- **LSTEP_TRIGGER_URL**: スクリプトプロパティまたは `Config.LSTEP_TRIGGER_URL_DEFAULT`。L-step の「API連携」→ エンドポイント（予約用）→ 【cURL実行サンプル】の URL。
- **LSTEP_CANCEL_TRIGGER_URL**: キャンセル時の友だち情報クリア用トリガーURL。未設定時は LSTEP_TRIGGER_URL を使用。キャンセル用エンドポイントではメッセージ・タグ・リマインダを紐づけないこと。
- **LSTEP_UID_ONLY**: true にすると「UID 取得だけ」で、友だち情報更新・タグ・リマインダ操作は行わない（リマインダは発動しない）。
- **LSTEP_USE_TRIGGER_URL**: true のときトリガーURL 経由で連携。false のときは REST API（/friend/update 等）を使用（契約による）。

---

## L-step 側の設定（想定）

**予約用エンドポイント**（LSTEP_TRIGGER_URL）:

1. **API連携** でエンドポイントを作成し、パラメータに `meeting_date`（日時型など）を登録する。
2. **連携アクション** で、該当エンドポイントのトリガーが来たときに実行するアクションを設定する。
   - **友だち情報操作**: meeting_date 等を友だち情報に保存。
   - **タグ操作**: 例として「面談予約済」タグを付与。
   - **リマインダ操作**: 取得した日付情報（meeting_date）をリマインダのゴール日に代入。
3. **リマインダ配信** で、ゴール日を友だち情報の該当項目に紐づけ、送信日時・メッセージ内容を設定する。

**キャンセル用エンドポイント**（LSTEP_CANCEL_TRIGGER_URL、任意）:

- 別エンドポイントを1本作成し、**連携アクションは「友だち情報の更新のみ」**とする。予約時メッセージ送信・タグ・リマインダ操作は紐づけない。これによりキャンセル時に意図しないメッセージが送られない。

詳細は [LSTEP_SPEC_GUIDE.md](LSTEP_SPEC_GUIDE.md) および L-step の「テンプレート / 回答フォーム / イベント予約 / カレンダー予約 / **リマインダ配信**」「**リマインダ操作**」のマニュアルを参照。

---

## UID の重要性（誤送信の防止）

リマインダは **L-step が「受け取った uid」の友だち** に送る。  
したがって **GAS が渡す uid が「実際に予約した人」の LINE UID と一致していないと、別のユーザーにリマインダが届く。**

- uid は、予約画面表示時に **session_id から復元した LINE UID** が TimeRex の `url_params.line_uid` に渡り、確定時 Webhook で戻ってくる。
- **session_id の紐づけが誤っていると**（例: 同時刻に他ユーザーが操作したときに「直近1件」で別ユーザーのセッションが選ばれた場合）、**誤った uid が L-step に渡り、別ユーザーにリマインダが送信される。**

この事象の詳細と再発防止策は [INCIDENT_UID_MIXING_2026-02.md](../operations/INCIDENT_UID_MIXING_2026-02.md) を参照。**メッセージ内の予約URLには session_id を含め、紐づけを一意にすることが推奨される。**

---

## 参照

- 実装: `WebhookHandler.gs`（予約確定・キャンセル時の L-step 連携）、`LStepApiService.gs`（triggerFriendUpdate, buildTriggerPayload）
- L-step 詳細仕様（エンドポイント種別・キャンセル用）: [LSTEP_SPEC_GUIDE.md](LSTEP_SPEC_GUIDE.md)
- L-step API 連携: [lstep_api_manual.md](lstep_api_manual.md)（トリガーURL、パラメータ、リマインダ操作）
- UID 混入インシデント: [INCIDENT_UID_MIXING_2026-02.md](../operations/INCIDENT_UID_MIXING_2026-02.md)
- Webhook 仕様: [LSTEP_WEBHOOK_SPEC.md](LSTEP_WEBHOOK_SPEC.md)
