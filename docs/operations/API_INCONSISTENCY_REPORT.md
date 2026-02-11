# TimeRex API実装とドキュメントの不整合レポート

## 作成日
2025-12-25

## 概要
TimeRex APIドキュメントを取得し、現在の実装と比較した結果、以下の不整合を発見しました。

---

## 重大な不整合（修正必須）

### 1. Get Calendar Events APIのクエリパラメータ名が間違っている

**問題:**
- **実装**: `start_date`, `end_date` を使用
- **ドキュメント**: `startTime`, `endTime` を使用

**影響:**
- APIリクエストが正しく動作しない可能性が高い
- 日時フィルタリングが機能しない

**該当ファイル:**
- `src/TimeRexApiService.gs` (197-210行目)

**修正方法:**
```javascript
// 修正前
queryParams.start_date = ...
queryParams.end_date = ...

// 修正後
queryParams.startTime = ...
queryParams.endTime = ...
```

**注意:** ドキュメントによると、日時は UTC形式で指定する必要があります（例: "2023-12-19 15:00:00"）

---

## 重要な不整合（機能制限）

### 2. ページネーション未対応

**問題:**
- Get Calendar Events APIは1ページあたり**10件**しか返さない
- 実装では `nextPageToken` の処理が実装されていない

**影響:**
- 10件を超えるイベントがある場合、一部のイベントが取得できない
- 特に長期間のイベント取得時に問題が発生する可能性が高い

**ドキュメント:**
- レスポンス形式: `{ nextPageToken: string, items: array }`
- 次のページを取得するには、クエリパラメータに `nextPageToken` を追加

**修正方法:**
1. レスポンスから `nextPageToken` を確認
2. `nextPageToken` が存在する場合、再度リクエストを実行して全件取得
3. 全てのページの `items` を結合して返す

**該当ファイル:**
- `src/TimeRexApiService.gs` (192-220行目)

---

## 軽微な不整合（確認推奨）

### 3. statusクエリパラメータがドキュメントに記載されていない

**問題:**
- 実装では `status` クエリパラメータを使用している（209行目）
- ドキュメントには `status` パラメータの記載がない

**影響:**
- APIが `status` パラメータをサポートしていない場合、無視される可能性がある
- サポートしている場合は問題なし

**確認方法:**
- 実際のAPIリクエストで `status` パラメータが機能するか確認
- 機能しない場合は、クライアント側でフィルタリングする必要がある

**該当ファイル:**
- `src/TimeRexApiService.gs` (208-210行目)

---

### 4. Cancel Event APIのreasonパラメータがドキュメントに記載されていない

**問題:**
- 実装では `reason` をリクエストボディに含めている（234-236行目）
- ドキュメントには `reason` パラメータの記載がない

**影響:**
- APIが `reason` パラメータをサポートしていない場合、無視される可能性がある
- サポートしている場合は問題なし

**確認方法:**
- 実際のAPIリクエストで `reason` パラメータが機能するか確認

**該当ファイル:**
- `src/TimeRexApiService.gs` (228-246行目)

---

## 仕様書と実装の不整合

### 5. spec.mdの記述

**spec.md 5.2.2の記述:**
```
Get Calendar Events | GET | `/api/beta/calendars/{calendar_id}/events` | カレンダーの予定一覧を取得
```

**実装:**
- エンドポイントは正しい
- クエリパラメータ名が間違っている（`start_date`/`end_date` ではなく `startTime`/`endTime`）

**修正が必要:**
- `docs/spec.md` の記述を更新する必要はない（エンドポイントのみ記載されているため）
- 実装コードの修正が優先

---

## 確認済み・問題なし

### 6. 認証方法

**仕様:**
- APIキー認証: `x-api-key` ヘッダーを使用

**実装:**
- ✅ 正しく実装されている（`_getHeaders()` メソッド）

**該当ファイル:**
- `src/TimeRexApiService.gs` (22-33行目)

---

### 7. ベースURL

**仕様:**
- `https://timerex.net/api/beta`

**実装:**
- ✅ 正しく設定されている（`Config.TIMEREX_API_BASE_URL`）

**該当ファイル:**
- `src/Config.gs` (65行目)

---

### 8. レスポンス形式（Get Calendar Events）

**ドキュメント:**
```json
{
  "nextPageToken": "string",
  "items": [
    {
      "id": "string",
      "status": "confirmed",
      "start_datetime": "2023-12-19T15:00:00+00:00",
      "end_datetime": "2023-12-19T16:00:00+00:00"
    }
  ]
}
```

**注意点:**
- `items` 配列には `status` フィールドが含まれている
- 日時は `start_datetime`, `end_datetime` というフィールド名

**実装:**
- レスポンスのパース処理は実装されているが、ページネーション処理が未実装

---

## 推奨される修正優先順位

1. **最優先（即座に修正）**
   - Get Calendar Events APIのクエリパラメータ名修正（`start_date`/`end_date` → `startTime`/`endTime`）

2. **高優先度（機能改善）**
   - ページネーション対応（`nextPageToken` の処理を実装）

3. **中優先度（動作確認）**
   - `status` クエリパラメータが実際に機能するか確認
   - `reason` パラメータが実際に機能するか確認

---

## 補足: 日程候補設定（Available Slots）について

TimeRex APIドキュメントを確認した結果、**日程候補設定（available slots）を取得する専用のAPIエンドポイントは存在しない**ことが確認されました。

現在実装されている `calculateAvailableSlots` メソッド（Google Calendarとinterviewsシートベース）は、現時点では正しいアプローチです。

**今後の対応:**
- TimeRex APIが日程候補設定を取得するエンドポイントを提供するまで、現在の実装を維持
- または、TimeRexサポートに日程候補設定取得APIの提供を要望

---

## 参考資料

- TimeRex APIドキュメント: `docs/timerex/1_reference_q3ig7kz84i66i_get_calendar_events_20251225_132624.md`
- TimeRex APIドキュメント: `docs/timerex/1_reference_94v77i4rkcu2h_cancel_event_20251225_132624.md`
- TimeRex APIドキュメント: `docs/timerex/1_reference_05ccf93502e54_pagination_20251225_132624.md`
- プロジェクト仕様書: `docs/spec.md`

