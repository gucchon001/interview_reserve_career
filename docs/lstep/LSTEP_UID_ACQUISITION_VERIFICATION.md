# L-step API 仕様とUID取得実装の照合結果

## 結論

**UID取得方法に間違いはありません。** 実装は L-step / LINE Webhook の仕様に沿っており、仕様書に記載のパターンと転送URLのルールを満たしています。

---

## 1. 仕様の要点（再確認）

| 項目 | 仕様 | 参照 |
|------|------|------|
| UIDの取得方法 | **Webhook転送のPOST**を受け、**body から**取り出す。URLにUIDは埋め込めない | LSTEP_LINEID_SOLUTION.md, LSTEP_WEBHOOK_SPEC.md |
| Webhook転送URL | L-step の「LINE Webhook転送設定」には **ベースURLのみ**。`?action=lstep_webhook` 等のクエリは付けない（付けるとPOST本文が転送されず失敗する） | LSTEP_WEBHOOK_SPEC.md 3.1, 10.1 |
| ボタン種別 | **postback 推奨**。URIだと doGet も呼ばれ GET には body がないため UID を取得できない | LSTEP_WEBHOOK_SPEC.md 2.4 |
| UID の所在 | POST の JSON body に含まれる（LINE 形式: `events[0].source.userId` 等） | LSTEP_WEBHOOK_SPEC.md 5.2 |

---

## 2. 実装との対応

### 2.1 doPost のルーティング

- **仕様:** L-step はクエリなしのベースURLに POST するため、`e.parameter.action` は存在しないことがある。
- **実装:**  
  - `action === 'lstep_webhook'` かつ POST 本文あり → `handleLStepWebhook(e)`（ユーザーが付与したURLでPOSTされた場合のフォールバック）。  
  - 上記でなければ、POST body をパースし、**TimeRex 形式でない**かつ **LINE 形式**（`events[].source.userId` や `destination` + `events`）なら L-step 転送とみなして `handleLStepWebhook(e)` を呼ぶ。  
- **判定:** クエリなしの POST でも body 内容で L-step 転送と識別できており、仕様と一致している。

### 2.2 UID の抽出（handleLStepWebhook）

仕様 5.2 のパターン:

```text
uid = parsedPayload.uid ||
      parsedPayload.user_id ||
      parsedPayload.line_user_id ||
      parsedPayload.source?.userId ||
      parsedPayload.events?.[0]?.source?.userId || '';
```

実装での対応:

1. **POST body を JSON パース**し、`events` を取得（`events` / `body.events` / `data.events` / `payload.events` のラップに対応）。
2. **LINE 標準形式を最優先:** `firstEvent?.source?.userId` または `firstEvent?.source?.user_id` を最初に参照。
3. **仕様 5.2 のトップレベルをフォールバック:**  
   `parsedPayload.uid` / `user_id` / `line_user_id` / `userId` / `source?.userId` / `events?.[0]?.source?.userId` 等を参照。
4. **まだ無い場合:** `extractUidFromPayload(parsedPayload)` で再帰的に `userId` / `uid` を探索。

仕様で想定されているキーはすべて参照され、LINE の標準形式と L-step 経由のラップの両方に対応している。

### 2.3 URL パラメータからの UID

- **仕様:** 「URLにUIDは埋め込めない」ため、本来の取得元は **POST body のみ**。
- **実装:** デバッグ・特殊ケース用に `e.parameter.uid` 等も参照しているが、**POST に body がある場合は body を優先**しており、仕様に反していない。

### 2.4 Webhook転送URLの注意

- **仕様:** Webhook転送URLにクエリを付けると POST 本文が転送されず UID 取得に失敗する。
- **実装:** `action=lstep_webhook` かつ POST 本文がない場合に「Webhook転送URLにクエリを付けないでください」旨のエラーHTMLを返し、仕様を案内している。

### 2.5 セッション保存・リダイレクト

- **CacheService:** キー `uid_{sessionId}`、有効期限 600 秒 → 仕様 5.3 と一致。
- **uidlog:** シート名 `uidlog`、カラム「日時, uid, sessionid, イベント種別」→ 仕様 5.3 と一致。
- **リダイレクト:** `Config.BOOKING_BASE_URL` と `session_id`（と必要なら `interviewer_id`）で予約画面へリダイレクト → 仕様 5.4 と一致。

---

## 3. まとめ

| 確認項目 | 結果 |
|----------|------|
| UID は POST body から取得しているか | ✅ body をパースし、仕様 5.2 のパターン＋LINE 形式を実装している |
| Webhook転送URLはベースURLのみか | ✅ 実装はクエリ付きを前提にしておらず、クエリ付きでPOSTされた場合はエラー案内を返す |
| postback と URI の違いを考慮しているか | ✅ GET 時は body がないため UID を取れずエラーになる旨をドキュメント・エラー表示で説明している |
| セッション保存・リダイレクト | ✅ 仕様 5.3 / 5.4 どおり |

**L-step API の仕様と現状の UID 取得方法に齟齬はありません。**  
問題が出る場合は「LINE Webhook転送設定」のURL（ベースURLのみか）、ボタン種別（postback 推奨）、および L-step から実際に送られている POST body の形式を確認するとよいです。
