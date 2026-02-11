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

## 6. 関連ドキュメント

- [API疎通テスト手順](API_CONNECTIVITY_TEST.md)
- [L-step Webhook転送仕様](LSTEP_WEBHOOK_SPEC.md)
- [L-step UID取得実装照合](LSTEP_UID_ACQUISITION_VERIFICATION.md)
- [L-step API連携マニュアル](lstep_api_manual.md)
