# L-step 連携: セッションエラー（予約に進めない）の対処

「届いたURLをタップした際にセッションエラーが毎回出て、予約に進めない」場合の原因と確認手順です。

---

## 1. 表示されるエラー

- **「セッションが見つかりません」**  
  ボタンをタップしてから、表示されたURLを2分以内にクリックしてください。  
  時間が経過した場合は、もう一度ボタンをタップし直してください。

この画面は、**予約画面を表示するために必要な「セッション」が取得できなかったとき**に GAS（`doGet`）から返されています。

---

## 2. なぜセッションが見つからないか

予約用のセッションは、**ユーザーがLINEでボタンをタップしたとき**にだけ作られます。

1. ボタンタップ → L-step が GAS に **POST**（Webhook転送）
2. GAS の `handleLStepWebhook` が **session_id** を発行し、Cache と uidlog に保存
3. ユーザーが**メッセージ内のURL**をタップ → ブラウザで **GET** が GAS に飛ぶ
4. GAS は **URL の `session_id`** または **直近2分以内の postback 1件** でセッションを特定

そのため、次のどちらか（または両方）で「セッションが見つかりません」になります。

| 原因 | 説明 |
|------|------|
| **A. URL に session_id が含まれていない** | メッセージのリンクが `https://.../exec?from=line` のような**固定URL**のとき。この場合、GAS は「直近2分以内の postback 1件」でセッションを探す。 |
| **B. 直近2分以内の postback が uidlog にない** | ボタンタップから2分以上経過している、またはボタンタップ時の POST が GAS に届いていない／`handleLStepWebhook` が動いていない（postback が uidlog に1件も記録されない）。 |

**予約用・キャンセル用の L-step エンドポイントをオンにしていても、Webhook転送（LINE → GAS への POST）の動きは変わりません。**  
問題になりやすいのは「**どのURLがユーザーに送られているか**」と「**ボタンタップ時に POST が届き、postback が uidlog に保存されているか**」です。

---

## 3. 対処の優先順位

### 推奨: メッセージに「session_id 付きURL」を送る（根本対策）

**session_id を URL に含めると、2分制限や「直近1件」のずれの影響を避けられます。**

1. **GAS**
   - スクリプトプロパティに **`LSTEP_BOOKING_LINK_TRIGGER_URL`** を設定する（L-step の「予約URL送信」用エンドポイントの cURL サンプル URL）。
2. **L-step**
   - API連携で「予約URL送信」用エンドポイントを作成し、パラメータ `booking_url` を登録。
   - 連携アクションで「テキスト送信」を選び、**取得した情報（予約URL / booking_url）を埋め込んだメッセージ**を送る。
   - シナリオで「固定の `?from=line` だけのURL」を送らないようにする（session_id なしの固定URLと、API連携の session_id 付きURLが二重にならないようにする）。

手順の詳細は [LSTEP_BOOKING_LINK_API_SETUP.md](LSTEP_BOOKING_LINK_API_SETUP.md) を参照してください。

これができていれば、ユーザーがタップするURLに必ず `session_id=...` が含まれ、**「直近2分」に依存せず**同じユーザーのセッションで予約画面が開きます。

---

### 確認1: ボタンタップ時に POST が届いているか

「セッションが見つかりません」になる場合、**ボタンタップの POST が GAS に届いていない／handleLStepWebhook まで到達していない**可能性があります。

**手順:**

1. GAS エディタで **実行ログ**（「表示」→「実行ログ」）を開く。
2. LINE で**予約用ボタンを1回だけ**タップする。
3. 数秒以内に、次のログが出ているか確認する。
   - `[doPost] LINE形式のWebhookを検出` または `[doPost] LINE Webhook形式を検出` など
   - `[handleLStepWebhook] UID saved to uidlog with session_id: ...`

**出ていない場合:**

- L-step の **「LINE Webhook転送設定」** の URL が、GAS の**デプロイした Web アプリの URL**（`https://script.google.com/.../exec`）になっているか確認する。
- Webhook転送の URL に `?action=lstep_webhook` などを**付けていない**か確認する（付けると POST 本文が送られず、UID 取得に失敗します）。

---

### 確認2: uidlog に「postback」が記録されているか

セッションの復元は、**uidlog シートの「イベント種別」が `postback` の行**を「直近2分以内」で探して行います。

**手順:**

1. スプレッドシートの **uidlog** シートを開く。
2. 列は **日時 / uid / sessionid / イベント種別** の想定。
3. **直近で**「イベント種別」が **postback** の行が 1 行以上あるか確認する。
4. その行の「日時」が、**ボタンをタップした時刻から 2 分以内**か確認する。

**postback が無い／2分より古いだけの場合:**

- ボタンタップ時に `handleLStepWebhook` が実行されていない（確認1の通り POST が届いていない、または別の doPost 分岐に入っている）。
- または、ボタンタップから URL タップまでが 2 分を超えている（この場合は「session_id 付きURL」にすれば解消）。

---

### 確認3: ユーザーがタップしている URL の中身

- ブラウザで実際に開いている URL に **`session_id=...`** が含まれているか確認する。
- **含まれていない**（例: `.../exec?from=line` のみ）→ 上記「原因 A」に該当。  
  → 対処は「メッセージに session_id 付きURLを送る」設定（`LSTEP_BOOKING_LINK_TRIGGER_URL` + L-step の予約URL送信）にすること。

---

## 4. チェックリスト（セッションエラー時）

- [ ] メッセージに **session_id 付きのURL** を送る設定になっているか（`LSTEP_BOOKING_LINK_TRIGGER_URL` + L-step 予約URL送信）
- [ ] ボタンタップ時に GAS の実行ログに `handleLStepWebhook` や `UID saved to uidlog` が出ているか
- [ ] uidlog に、**直近2分以内**の **postback** の行があるか
- [ ] ユーザーがタップしている URL に `session_id=` が含まれているか（含まれていれば「直近2分」は使われない）
- [ ] L-step の **Webhook転送 URL** が GAS のデプロイ URL のままか（クエリ付きでないか）

---

## 5. 関連ドキュメント

- [LSTEP_BOOKING_LINK_API_SETUP.md](LSTEP_BOOKING_LINK_API_SETUP.md) — session_id 付きURLをメッセージで送る設定
- [LSTEP_WEBHOOK_SPEC.md](LSTEP_WEBHOOK_SPEC.md) — Webhook転送と URL の種類
- [INCIDENT_UID_MIXING_2026-02.md](../operations/INCIDENT_UID_MIXING_2026-02.md) — session_id なし運用時のリスク
