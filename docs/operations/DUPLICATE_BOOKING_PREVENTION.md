# 多重予約ブロック機能 シーケンス図

## 概要

同じメールアドレスからの重複予約を防ぐための機能です。有効な予約（ステータスが「確定」）が既に存在する場合、新しい予約を拒否します。キャンセル済みの予約は対象外とし、キャンセル後は再度予約可能です。

## ケース1: TimeRex Webhook経由での予約（正常系・重複なし）

```mermaid
sequenceDiagram
    participant TimeRex as TimeRex<br/>（予約確定）
    participant Code as Code.gs<br/>(doPost)
    participant WH as WebhookHandler<br/>(handleEventConfirmed)
    participant SS as SpreadsheetService<br/>(findActiveInterviewByGuestEmail)
    participant Sheet as Google<br/>Spreadsheet<br/>(interviews)

    TimeRex->>Code: POST /exec<br/>(event_confirmed)
    Code->>WH: handleEventConfirmed(payload)
    
    Note over WH: guest_emailを抽出
    
    WH->>SS: findActiveInterviewByGuestEmail(guestEmail)
    SS->>Sheet: interviewsシートを取得
    Sheet-->>SS: データ配列
    
    Note over SS: メールアドレスで検索<br/>ステータス=確定(1)の予約をチェック
    
    SS-->>WH: null（既存予約なし）
    
    Note over WH: 予約を許可<br/>スプレッドシートに登録
    
    WH->>Sheet: appendInterview(interviewData)
    Sheet-->>WH: rowIndex
    
    WH-->>Code: { success: true, rowIndex }
    Code-->>TimeRex: 200 OK
```

## ケース2: TimeRex Webhook経由での予約（重複あり）

```mermaid
sequenceDiagram
    participant TimeRex as TimeRex<br/>（予約確定）
    participant Code as Code.gs<br/>(doPost)
    participant WH as WebhookHandler<br/>(handleEventConfirmed)
    participant SS as SpreadsheetService<br/>(findActiveInterviewByGuestEmail)
    participant Sheet as Google<br/>Spreadsheet<br/>(interviews)

    TimeRex->>Code: POST /exec<br/>(event_confirmed)
    Code->>WH: handleEventConfirmed(payload)
    
    Note over WH: guest_emailを抽出<br/>例: user@example.com
    
    WH->>SS: findActiveInterviewByGuestEmail(guestEmail)
    SS->>Sheet: interviewsシートを取得
    Sheet-->>SS: データ配列
    
    Note over SS: メールアドレスで検索<br/>ステータス=確定(1)の予約をチェック
    
    SS-->>WH: { rowIndex: 5, data: {...} }<br/>（既存予約あり）
    
    Note over WH: 重複予約を検出<br/>エラーをスロー
    
    WH-->>Code: Error: DUPLICATE_BOOKING<br/>メッセージ: このメールアドレスでは<br/>既に予約が存在します...
    
    Code-->>TimeRex: 200 OK<br/>（エラーでも200を返す）
```

## ケース3: 管理画面からの手動予約登録（正常系・重複なし）

```mermaid
sequenceDiagram
    participant Admin as 管理者<br/>(Admin.html)
    participant Code as Code.gs<br/>(registerManualBooking)
    participant SS as SpreadsheetService<br/>(findActiveInterviewByGuestEmail)
    participant Sheet as Google<br/>Spreadsheet<br/>(interviews)
    participant Calendar as Google<br/>Calendar

    Admin->>Code: registerManualBooking(bookingData)<br/>guestEmail: user@example.com
    
    Note over Code: 入力検証
    
    Code->>SS: findActiveInterviewByGuestEmail(guestEmail)
    SS->>Sheet: interviewsシートを取得
    Sheet-->>SS: データ配列
    
    Note over SS: メールアドレスで検索<br/>ステータス=確定(1)の予約をチェック
    
    SS-->>Code: null（既存予約なし）
    
    Note over Code: 予約を許可<br/>Google Calendarにイベント作成
    
    Code->>Calendar: createInterviewEvent(...)
    Calendar-->>Code: calendarEvent
    
    Code->>Sheet: appendInterview(interviewData)
    Sheet-->>Code: rowIndex
    
    Code-->>Admin: { success: true, eventId, rowIndex }
    Admin->>Admin: 成功メッセージ表示
```

## ケース4: 管理画面からの手動予約登録（重複あり）

```mermaid
sequenceDiagram
    participant Admin as 管理者<br/>(Admin.html)
    participant Code as Code.gs<br/>(registerManualBooking)
    participant SS as SpreadsheetService<br/>(findActiveInterviewByGuestEmail)
    participant Sheet as Google<br/>Spreadsheet<br/>(interviews)

    Admin->>Code: registerManualBooking(bookingData)<br/>guestEmail: user@example.com
    
    Note over Code: 入力検証
    
    Code->>SS: findActiveInterviewByGuestEmail(guestEmail)
    SS->>Sheet: interviewsシートを取得
    Sheet-->>SS: データ配列
    
    Note over SS: メールアドレスで検索<br/>ステータス=確定(1)の予約をチェック
    
    SS-->>Code: { rowIndex: 3, data: {...} }<br/>（既存予約あり）
    
    Note over Code: 重複予約を検出<br/>エラーを返す
    
    Code-->>Admin: {<br/>  success: false,<br/>  error: 'DUPLICATE_BOOKING',<br/>  message: 'このメールアドレスでは<br/>既に予約が存在します...'<br/>}
    
    Admin->>Admin: エラーメッセージ表示
```

## ケース5: キャンセル後の再予約（正常系）

```mermaid
sequenceDiagram
    participant TimeRex as TimeRex<br/>（予約確定）
    participant Code as Code.gs<br/>(doPost)
    participant WH as WebhookHandler<br/>(handleEventConfirmed)
    participant SS as SpreadsheetService<br/>(findActiveInterviewByGuestEmail)
    participant Sheet as Google<br/>Spreadsheet<br/>(interviews)

    Note over Sheet: 既存予約: status=3（キャンセル済み）

    TimeRex->>Code: POST /exec<br/>(event_confirmed)
    Code->>WH: handleEventConfirmed(payload)
    
    Note over WH: guest_emailを抽出<br/>例: user@example.com
    
    WH->>SS: findActiveInterviewByGuestEmail(guestEmail)
    SS->>Sheet: interviewsシートを取得
    Sheet-->>SS: データ配列
    
    Note over SS: メールアドレスで検索<br/>ステータス=確定(1)の予約のみチェック<br/>※キャンセル済み(3)は除外
    
    SS-->>WH: null（有効な予約なし）
    
    Note over WH: 予約を許可<br/>スプレッドシートに登録
    
    WH->>Sheet: appendInterview(interviewData)
    Sheet-->>WH: rowIndex
    
    WH-->>Code: { success: true, rowIndex }
    Code-->>TimeRex: 200 OK
```

## 処理フロー詳細

### SpreadsheetService.findActiveInterviewByGuestEmail の処理

```
1. guestEmailパラメータを検証
2. interviewsシートの全データを取得
3. 各行をループ処理:
   a. GUEST_EMAIL列の値とguestEmailを比較（大文字小文字無視）
   b. STATUS列がCONFIRMED(1)かチェック
   c. 両方一致する場合、その予約情報を返す
4. 一致する予約がない場合、nullを返す
```

### チェック対象外

以下の場合は多重予約とみなされません：

- **ステータスが「キャンセル済み」(3)の予約**: キャンセル後は再度予約可能
- **ステータスが空または未設定の予約**: エラー状態の予約は除外

### エラーメッセージ

重複予約が検出された場合、以下のメッセージを返します：

```
このメールアドレス（{guestEmail}）では既に予約が存在します。
新しい予約をするには、まず既存の予約をキャンセルしてください。
```

## 実装ファイル

- **Webhook処理**: `src/WebhookHandler.gs` (103-111行目)
- **手動予約登録**: `src/Code.gs` (896-904行目)
- **重複チェック関数**: `src/SpreadsheetService.gs` (219-265行目)

## 注意事項

1. **メールアドレスの比較**: 大文字小文字を区別しない比較（`.toLowerCase()`）を使用
2. **ステータスの確認**: ステータスが「確定」(1)の予約のみをチェック対象とする
3. **キャンセル後の再予約**: キャンセル済みの予約はチェック対象外のため、キャンセル後は再度予約可能

