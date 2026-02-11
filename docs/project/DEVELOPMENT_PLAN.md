# 開発計画

## 現状サマリー（2026年2月時点）

- **TimeRex:** Webhook 受信・予約画面・管理画面・API 連携は実装済み。
- **L-step:** UID 取得（Webhook 転送）と、予約確定・キャンセル時の友だち情報更新（トリガーURL 経由）を実装済み。REST `/friend/update` は契約上 404 のため使用せず、トリガーURL のみ利用。
- **疎通:** **Webhook 転送・API（トリガーURL）の疎通テストは完了。** GAS・Python 双方でトリガーURL 疎通確認済み（UID / friend_id ともに HTTP 200）。

---

## Phase 別 実装状況実行ログ
15:18:45	お知らせ	実行開始
15:18:44	情報	=== LステップAPI 簡単なテスト（マニュアル⑤・トリガーURLへPOST） ===
15:18:44	情報	
15:18:44	情報	トリガーURL: https://api.lineml.jp/v1/api-codes/690/triggers/c4faddc7-b837-4637-b481-eaab5777af2a
15:18:44	情報	UID: U6e967fdb7f0aaf99375946cad8744fad
15:18:44	情報	→ POST 送信...
15:18:44	情報	
15:18:45	情報	レスポンス: HTTP 200
15:18:45	情報	ボディ: {"data":{}}
15:18:45	情報	
15:18:45	情報	✓ 成功: トリガーが実行されました。L-Step側のアクション（タグ・友だち情報など）を確認してください。
15:18:46	お知らせ	実行完了

### Phase 0〜4: 基盤・Webhook・予約・管理・拡張 ✅

README の「実装状況」に記載のとおり。TimeRex API、Webhook、予約画面、管理画面、CacheService 等は実装済み。

### Phase 5: テスト・検証 🔄

- [x] 基本設定・スクリプトプロパティ確認
- [x] 予約画面・管理画面の表示確認
- [x] L-step 疎通確認（トリガーURL・GAS/Python）
- [ ] TimeRex Webhook 動作確認（予約作成 → スプレッドシート記録）
- [ ] 予約フロー全体（L-step ボタン → UID 取得 → 予約画面 → 確定 → L-step 友だち情報更新）の E2E 確認
- [ ] 管理画面のデータ取得・手動登録・統計の動作確認
- [ ] エラーハンドリング・異常系の確認

### L-step 連携 ✅（トリガーURL 利用）

- [x] Webhook 転送で UID 取得（handleLStepWebhook）
- [x] uidlog / CacheService によるセッション管理
- [x] 予約画面へのリダイレクト（session_id 付き）
- [x] 予約確定時の友だち情報更新（トリガーURL 経由・triggerFriendUpdate）
- [x] キャンセル時の友だち情報クリア（トリガーURL 経由）
- [x] **疎通テスト完了**（Webhook 転送・API ともに GAS / Python で確認済み。runLStepApiTriggerTestForSpecifiedUid/FriendId、scripts/connectivity_test.py）
- [ ] L-step エンドポイントのパラメータ（meeting_date, meeting_url, meeting_cancel_url, tag）と連携アクションの設定・動作確認

---

## 今後の開発計画

### 短期（優先）

1. **E2E 確認**
   - L-step でボタンタップ → UID 取得 → 予約画面 → 予約確定 → L-step 友だち情報・タグが反映される流れを実機またはテストで確認する。
2. **L-step 連携アクション**
   - トリガーURL で送っているパラメータ（meeting_date, meeting_url, meeting_cancel_url, tag）を、L-step 管理画面の「パラメータ管理」と「連携アクション」に正しく登録し、リマインド・タグが意図どおり動くか確認する。
3. **TimeRex Webhook 本番確認**
   - 実際に予約を作成し、Webhook 受信 → スプレッドシート記録・L-step 連携が行われるか確認する。

### 中期

- 管理画面の統計・手動予約・ブロック機能の運用確認と軽微な改善。
- エラーログ・uidlog の運用方法の整理（障害時の切り分け手順のドキュメント化）。
- 必要に応じて Python 疎通スクリプトの拡張（TimeRex 等の項目追加）。

### 長期

- パフォーマンス・セキュリティの見直し。
- 新機能要件に応じた仕様・設計の更新（spec.md 等との同期）。

---

## 参照ドキュメント

| ドキュメント | 内容 |
|--------------|------|
| [L-step 疎通まとめ](LSTEP_CONNECTIVITY_SUMMARY.md) | REST とトリガーURL の違い、疎通結果、Config、テスト方法 |
| [API 疎通テスト手順](API_CONNECTIVITY_TEST.md) | GAS での疎通テスト一覧と手順 |
| [L-step Webhook 仕様](LSTEP_WEBHOOK_SPEC.md) | UID 取得フロー、URL 設定、postback 推奨 |
| [設計書](spec.md) | 全体仕様・データ構造・API 設計 |
| [README](../README.md) | セットアップ・Phase 別実装状況・クイックテスト |
