# 開発計画

## 現状サマリー（2026年2月時点）

- **TimeRex:** Webhook 受信・予約画面・管理画面・API 連携は実装済み。
- **L-step:** UID 取得（Webhook 転送）と、予約確定・キャンセル時の友だち情報更新（トリガーURL 経由）を実装済み。REST `/friend/update` は契約上 404 のため使用せず、トリガーURL のみ利用。
- **疎通:** **Webhook 転送・API（トリガーURL）の疎通テストは完了。** GAS・Python 双方でトリガーURL 疎通確認済み（UID / friend_id ともに HTTP 200）。

---

## Phase 別 実装状況

### Phase 0〜4: 基盤・Webhook・予約・管理・拡張 ✅

README の「実装状況」に記載のとおり。TimeRex API、Webhook、予約画面、管理画面、CacheService 等は実装済み。

### Phase 5: テスト・検証 🔄

- [x] 基本設定・スクリプトプロパティ確認
- [x] 予約画面・管理画面の表示確認
- [x] L-step 疎通確認（トリガーURL・GAS/Python）
- [ ] TimeRex Webhook 動作確認（予約作成 → スプレッドシート記録）
- [x] 予約フロー全体（L-step ボタン → UID 取得 → 予約画面 → 確定 → L-step 友だち情報更新）の E2E 確認（2026年2月に実機で確認。メッセージURL は `?from=line`、予約画面は直接表示。uid の HTML 埋め込み・TimeRex line_uid 渡しを確認済み）
- [ ] 管理画面のデータ取得・手動登録・統計の動作確認
- [ ] エラーハンドリング・異常系の確認

### L-step 連携 ✅（トリガーURL 利用）

- [x] Webhook 転送で UID 取得（handleLStepWebhook）
- [x] uidlog / CacheService によるセッション管理
- [x] 予約画面の表示（`?from=line` で直近セッション取得 → リダイレクトせず予約画面HTMLを直接返す。PC表示回避のため中間リダイレクトは廃止）
- [x] 予約確定時の友だち情報更新（トリガーURL 経由・triggerFriendUpdate）
- [x] キャンセル時の友だち情報クリア（トリガーURL 経由）
- [x] **疎通テスト完了**（Webhook 転送・API ともに GAS / Python で確認済み。runLStepApiTriggerTestForSpecifiedUid/FriendId、scripts/connectivity_test.py）
- [x] L-step エンドポイントのパラメータ（meeting_date, meeting_url, meeting_cancel_url, tag）と連携アクションの設定・動作確認（「タグを追加」で固定タグ「面談予約済み」を付与する設定で本番確認済み。TimeRex Premium で url_params を Webhook に含める必要あり）

**補足（2026年2月対応）:** GET/POST で URL を分ける場合は方法1（共有スプレッドシート）を採用。メッセージ内URL は `?from=line` 推奨。Booking.html では userData が JSON 文字列で渡るため `JSON.parse` でオブジェクト化して uid を利用。仕様は [LSTEP_WEBHOOK_SPEC.md](../lstep/LSTEP_WEBHOOK_SPEC.md) に集約し、spec.md の uidlog・フロー記述を実装に合わせて更新済み。

---

## 今後の開発計画

### 短期（優先）

1. **E2E 確認** ✅ 実施済み（2026年2月）
   - L-step ボタンタップ → UID 取得 → 予約画面（`?from=line`）→ 予約確定 → L-step 友だち情報・タグ反映の流れを実機で確認済み。GAS テスト: `runLStepSessionIdToUidTest`、`runLStepSessionIdRedirectWithoutInterviewerIdTest`。
2. **L-step 連携アクション** ✅ 実施済み（2026年2月）
   - パラメータ管理・連携アクションを設定。タグ付与は「タグを追加」で固定タグ「面談予約済み」を選択する設定で動作確認済み。詳細は [LSTEP_API_SETUP_GUIDE.md](../lstep/LSTEP_API_SETUP_GUIDE.md)。
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
| [L-step 疎通まとめ](../lstep/LSTEP_CONNECTIVITY_SUMMARY.md) | REST とトリガーURL の違い、疎通結果、方法1（共有SS）、テスト方法 |
| [API 疎通テスト手順](../operations/API_CONNECTIVITY_TEST.md) | GAS での疎通テスト一覧と手順 |
| [L-step Webhook 仕様](../lstep/LSTEP_WEBHOOK_SPEC.md) | UID 取得フロー、`?from=line` 推奨、session_id の引き継ぎ、postback 推奨 |
| [L-step API 設定ガイド](../lstep/LSTEP_API_SETUP_GUIDE.md) | TimeRex 予約時のタグ付与のための L-step 管理画面設定（エンドポイント・パラメータ・連携アクション） |
| [設計書](../spec.md) | 全体仕様・データ構造・API 設計（uidlog・L-step フローは上記と同期済み） |
| [TESTING.md](../../TESTING.md) | テスト手順・L-step session_id/uid テスト（3.5, 3.6） |
| [README](../../README.md) | セットアップ・Phase 別実装状況・クイックテスト |
