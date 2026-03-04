# L-step API 疎通 まとめ

## 1. 結論

- **GAS でも Python でも L-step API は利用可能**です。
- お使いの契約では **REST の `POST /friend/update` は 404**（未提供）のため、**トリガーURL 経由**のみで友だち情報更新・タグを行います。
- **Webhook 転送・API（トリガーURL）の疎通テストは完了。** トリガーURL への POST（UID または friend_id）は GAS・Python ともに HTTP 200 で成功しています。

---

## 2. 利用可能な方式

| 方式 | エンドポイント | 本契約での結果 | 利用可否 |
|------|----------------|----------------|----------|
| **REST** | `POST https://api.lineml.jp/v1/friend/update` | 404 | ❌ 利用不可 |
| **トリガーURL** | `POST https://api.lineml.jp/v1/api-codes/690/triggers/{id}` | 200 | ✅ 利用可（本番で使用） |

---

## 3. 疎通確認結果（実施済み）

| 実行元 | テスト内容 | 結果 |
|--------|------------|------|
| **Python** (scripts/connectivity_test.py) | L-step GET（認証） | [OK] |
| **Python** | トリガーURL + UID | [OK] HTTP 200 |
| **Python** | トリガーURL + friend_id 204179348 | [OK] HTTP 200 |
| **GAS** runLStepApiTriggerTestForSpecifiedUid | トリガーURL + UID | [OK] HTTP 200 |
| **GAS** runLStepApiTriggerTestForSpecifiedFriendId | トリガーURL + friend_id | [OK] HTTP 200 |
| **GAS** runLStepApiConnectivityTestWithUid | REST /friend/update | [NG] HTTP 404（想定どおり） |

---

## 4. 本番での実装

### 4.1 Config（Config.gs）

| キー | 値 | 説明 |
|------|-----|------|
| `LSTEP_UID_ONLY` | `false` | false で予約確定・キャンセル時にトリガーURL経由の友だち情報更新を実行 |
| `LSTEP_USE_TRIGGER_URL` | `true` | 友だち情報更新をトリガーURL経由で行う（REST は使わない） |
| `LSTEP_TRIGGER_URL_DEFAULT` | トリガーURL | スクリプトプロパティ未設定時に使用 |

### 4.2 処理フロー

- **予約確定時:** `WebhookHandler` → `LStepApiService.triggerFriendUpdate(lineUid, { meeting_date, meeting_url, meeting_cancel_url, tag })` → トリガーURL に POST
- **キャンセル時:** `LStepApiService.triggerFriendUpdate(lineUid, { meeting_date: null, meeting_url: null, meeting_cancel_url: null })` → 友だち情報クリア

### 4.3 L-step 側の設定

エンドポイントの「パラメータ管理」で以下の JSON キーを登録し、連携アクションで友だち情報・タグに紐づける。

- `meeting_date`（日時）
- `meeting_url`（文字列）
- `meeting_cancel_url`（文字列）
- `tag`（文字列）

---

## 5. テスト方法

### 5.1 GAS

| 目的 | 実行する関数 |
|------|----------------------|
| 最低限の疎通（L-step・TimeRexキー・スプレッドシート） | `runMinimumConnectivityTest` |
| トリガーURL + UID | `runLStepApiTriggerTestForSpecifiedUid` |
| トリガーURL + friend_id | `runLStepApiTriggerTestForSpecifiedFriendId` |
| 404 原因の切り分け | `runLStep404Diagnostic` |

### 5.2 Python（切り分け用）

```powershell
cd scripts
.\.venv\Scripts\Activate.ps1
# .env に LSTEP_API_TOKEN を設定済みであること
python connectivity_test.py
```

- Python で成功・GAS で失敗 → GAS 環境側を疑う
- 両方成功 → 本番フローはトリガーURL経由で問題なし

---

## 6. GET/POST で URL を分ける場合（方法1：共有スプレッドシート）

Webhook 転送（POST）とユーザーがクリックするリンク（GET）で **別々のデプロイURL** を使う場合、両方の GAS が **同じ uidlog** を参照する必要がある。同一のスプレッドシートを参照すれば、POST で保存したセッションを GET 側で取得できる。

### 6.1 共有するスプレッドシート ID

| 用途 | 値 |
|------|-----|
| **SPREADSHEET_ID**（両方の GAS で共通） | `1B3veDjAYnEP42XR2nxRa-TLDR8XaQ1xtx4BKxV6AZoA` |

### 6.2 設定手順（GET 側の GAS）

ユーザーがクリックするリンクを返す方の GAS プロジェクトで、以下を実施する。

1. GAS エディタでそのプロジェクトを開く。
2. **プロジェクトの設定**（歯車アイコン）→ **スクリプトプロパティ** を開く。
3. プロパティ **`SPREADSHEET_ID`** を追加または編集し、値を **`1B3veDjAYnEP42XR2nxRa-TLDR8XaQ1xtx4BKxV6AZoA`** に設定する。
4. 保存する。

POST 側（Webhook 転送を受ける方）の GAS も、同じ `SPREADSHEET_ID` を参照していることを確認する。これで uidlog が共有され、ボタンタップ後にユーザーが GET 用 URL をクリックすると「セッションが見つかりません」にならずに予約画面へリダイレクトされる。

**メッセージ内のURL:** ユーザーがクリックするリンクは `?action=lstep_webhook` ではなく **`?from=line`** を推奨。`?from=line` にするとモバイル表示になりやすい（例: `https://.../exec?from=line`。必要なら `&interviewer_id=xxx` を付与）。

---

## 7. 関連ドキュメント

- [L-step API 設定ガイド](LSTEP_API_SETUP_GUIDE.md) — TimeRex 予約時のタグ付与のための L-step 管理画面設定手順
- [API疎通テスト手順](../operations/API_CONNECTIVITY_TEST.md)
- [L-step Webhook転送仕様](LSTEP_WEBHOOK_SPEC.md)
- [L-step UID取得実装照合](LSTEP_UID_ACQUISITION_VERIFICATION.md)
- [L-step API連携マニュアル](lstep_api_manual.md)
