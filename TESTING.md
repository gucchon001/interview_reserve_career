# テスト・検証ガイド

## テスト項目一覧

### 1. 基本動作確認 ✅

#### 1.1 スクリプトプロパティ設定確認
- [x] `validateScriptProperties()` 実行で必須プロパティが全て設定されていることを確認

#### 1.2 画面表示確認
- [x] 予約画面が表示されることを確認
- [x] 管理画面が表示されることを確認

### 2. Webhook動作確認 🔄

#### 2.1 モックデータでのテスト（推奨）

**テスト手順:**
1. GASエディタで`runAllWebhookTests()`を実行
2. 実行ログを確認
3. スプレッドシートの`interviews`シートを確認

**確認項目:**
- [ ] `event_confirmed`テストが成功しているか
- [ ] `interviews`シートに新しい行が追加されているか
- [ ] 以下のカラムが正しく記録されているか：
  - `created_at`: 作成日時
  - `start_at`: 開始日時
  - `end_at`: 終了日時
  - `guest_name`: ゲスト名
  - `guest_email`: ゲストメールアドレス
  - `event_id`: TimeRexイベントID
  - `team_url_path`: チームURLパス
  - `calendar_url_path`: カレンダーURLパス
  - `status`: ステータス（1: 確定）
- [ ] `event_cancelled`テストが成功しているか
- [ ] 該当レコードの`status`が3（キャンセル）に更新されているか

**個別テスト:**
```javascript
// 予約確定Webhookテスト
runWebhookConfirmedTest();

// 予約キャンセルWebhookテスト（最新のevent_idを使用）
runWebhookCancelledTest();

// 特定のevent_idでテスト
runWebhookCancelledTest('event-id-here');
```

#### 2.2 実際のTimeRex Webhookでのテスト

**テスト手順:**
1. TimeRexで予約を作成（テスト用のカレンダーで予約）
2. GASの実行ログを確認（`clasp logs`）
3. スプレッドシートの`interviews`シートを確認

**確認項目:**
- [ ] Webhookが正常に受信されているか
- [ ] `interviews`シートに新しい行が追加されているか
- [ ] すべてのカラムが正しく記録されているか

**ログ確認方法:**
```bash
clasp logs --watch
```

#### 2.3 予約キャンセルWebhook（実際のTimeRex）

**テスト手順:**
1. TimeRexで予約をキャンセル
2. GASの実行ログを確認
3. スプレッドシートの`interviews`シートで該当レコードの`status`カラムを確認

**確認項目:**
- [ ] Webhookが正常に受信されているか
- [ ] 該当レコードの`status`が3（キャンセル）に更新されているか

**TimeRex・L-step 連携（予約キャンセル〜リマインド解除）の詳細なテスト手順:**  
[docs/operations/TIMEREX_LSTEP_TEST_PROCEDURE.md](docs/operations/TIMEREX_LSTEP_TEST_PROCEDURE.md) を参照（モック・E2E・キャンセル時の L-step 友だち情報クリア確認を含む）。

#### 2.3 セキュリティトークン検証

**テスト手順:**
1. `TIMEREX_WEBHOOK_TOKEN`を一時的に変更
2. TimeRexで予約を作成
3. GASの実行ログでエラーが記録されているか確認

**確認項目:**
- [ ] 無効なトークンの場合はリクエストが拒否されるか
- [ ] エラーログが正しく記録されているか

### 3. Googleカレンダー同期と管理画面テスト 🔄

#### 3.1 ステップバイステップテスト（推奨）

**一括実行:**
```javascript
// すべてのステップを順番に実行
runAdminPageFullTest();
```

**個別実行:**
```javascript
// ステップ1: Googleカレンダー同期テスト
runCalendarSyncTest();

// ステップ2: 管理画面データ取得テスト
runAdminDataTest();

// ステップ3: FullCalendarデータ変換テスト
runFullCalendarDataTest();

// ステップ4: 管理画面統合テスト
runAdminPageIntegrationTest();
```

**注意:** 各ステップは前のステップが成功した後に実行してください。

### 4. 予約画面（Booking.html）動作確認 🔄

#### 3.1 サーバーサイドテスト

**テスト手順:**
1. GASエディタで`runBookingPageTest()`を実行
2. 実行ログを確認
3. ログに表示されるURLをコピー

**確認項目:**
- [ ] TimeRexベースURLが正しく生成されているか
- [ ] スクリプトプロパティが正しく設定されているか
- [ ] 予約画面URLが正しく生成されているか

#### 3.2 画面表示確認

**テスト手順:**
1. `runBookingPageTest()`のログに表示されるURLにアクセス
2. ブラウザで予約画面を確認

**確認項目:**
- [ ] 予約画面が正しく表示されるか
- [ ] ヘッダーが表示されるか
- [ ] ウェルカムメッセージカードが表示されるか
- [ ] ユーザー名が表示されるか（uidパラメータから）
- [ ] TimeRexウィジェットエリアが表示されるか
- [ ] ローディングスケルトンが表示されるか（初期表示時）

#### 3.3 TimeRexウィジェット動作確認

**テスト手順:**
1. 予約画面でTimeRexウィジェットが読み込まれるまで待つ
2. カレンダーが表示されるか確認
3. 実際に予約を作成してみる

**確認項目:**
- [ ] TimeRexウィジェットが読み込まれるか
- [ ] カレンダーが表示されるか
- [ ] 日時選択ができるか
- [ ] 予約フォームが表示されるか
- [ ] 予約を確定できるか

#### 3.4 予約フロー全体確認

**テスト手順:**
1. TimeRexウィジェットで予約を作成
2. 予約確定後、Webhookが送信されるまで待つ（数秒）
3. GASの実行ログを確認（`clasp logs`）
4. スプレッドシートの`interviews`シートを確認

**確認項目:**
- [ ] 予約が正常に作成されるか
- [ ] Webhookが正常に受信されるか
- [ ] `interviews`シートに新しいレコードが追加されるか
- [ ] すべてのカラムが正しく記録されているか

#### 3.5 L-step session_id リダイレクト（interviewer_id なし）

**目的:** L-step の Webhook 受信で uidlog に保存した `session_id` が、`?action=lstep_webhook` のみの GET で正しくリダイレクトに含まれるかを検証する。

**テスト手順:**
1. GAS エディタで **`runLStepSessionIdRedirectWithoutInterviewerIdTest`** を選択して実行
2. 実行ログで「テスト結果: 成功」を確認

**確認項目:**
- [ ] `handleLStepWebhook` で uidlog に session_id が保存される
- [ ] `doGet({ from: 'line' })`（interviewer_id なし）のレスポンスが予約画面で、直近セッションの uid が含まれる

#### 3.5a 個別面談者（interviewer_id）予約画面テスト

**目的:** 特定の面談官（例: y_haraguchi）を指定したときに、予約画面でその面談官の個別カレンダーが表示されることを検証する。

**テスト手順:**
1. `interviewers` シートに対象面談官が登録されていることを確認（id, name, timerex_config_id, google_calendar_id など）
2. GAS エディタで **`runBookingPageWithInterviewerIdTest()`** を選択して実行（省略時は `y_haraguchi` を対象）
3. 別の面談官IDで試す場合: **`runBookingPageWithInterviewerIdTest('g_kawasaki')`** のように引数で指定して実行
4. 実行ログで「テスト結果: 成功」を確認

**確認項目:**
- [ ] 指定した面談官が interviewers シートに存在する
- [ ] その面談官の `timerex_config_id` が設定されている
- [ ] `handleBookingPage({ interviewer_id: 'y_haraguchi' })` のレスポンスHTMLに、個別カレンダー用の TimeRex URL が含まれる
- [ ] HTML に「面談官IDが見つかりません」「TimeRex設定が完了していません」のエラーが含まれない

**ブラウザで確認する場合:** 予約画面のURLに `&interviewer_id=y_haraguchi` を付けてアクセスし、該当面談官のカレンダーのみ表示されることを確認する。

#### 3.6 session_id から uid 取得（予約画面への受け渡し）

**目的:** session_id を元に uid を取得し、予約画面の HTML に渡せているかを検証する。

**テスト手順:**
1. GAS エディタで **`runLStepSessionIdToUidTest`** を選択して実行
2. 実行ログで「テスト結果: 成功」を確認

**確認項目:**
- [ ] uidlog と Cache に保存した session_id で handleBookingPage を呼ぶと、返却 HTML にその uid が含まれる（TimeRex の line_uid に渡る前提）

#### 3.7 L-step 連携 単体テスト（データ取得・ペイロード・型の検証）

**目的:** API から正しくデータを取得できているか、想定どころにデータが格納されているか、型が正しいかをステップごとに検証する。ネットワークを張らずに実行可能。

**一括実行:**
```javascript
// 4 種類の単体テストを順に実行
runLStepUnitTests();
```

**個別実行:**
```javascript
// 1. url_params から line_uid 取得（配列・オブジェクト・null）
runGetUrlParamValueTest();

// 2. 日時フォーマット（Date / ISO8601 → "YYYY-MM-DD HH:mm:ss"）
runFormatDateTimeForLStepTest();

// 3. トリガーペイロード組み立て（meeting_date, 面談日時, meeting_url, ミーティングURL, ...）
runLStepTriggerPayloadBuildTest();

// 4. Webhook event から L-step 用データ抽出（line_uid, 面談日時, URL 等）
runWebhookEventToLStepDataExtractionTest();
```

**確認項目:**
- [ ] `runGetUrlParamValueTest`: 配列・オブジェクト・null の各形式で line_uid が取得できる
- [ ] `runFormatDateTimeForLStepTest`: 日時が "YYYY-MM-DD HH:mm:ss" 形式で、予約日時がそのまま格納される
- [ ] `runLStepTriggerPayloadBuildTest`: ペイロードに uid, meeting_date, 面談日時, meeting_url, ミーティングURL, meeting_cancel_url, キャンセル用URL, tag, 付与するタグ名 が含まれる
- [ ] `runWebhookEventToLStepDataExtractionTest`: モック event から line_uid・面談日時・ミーティングURL・キャンセルURL が正しく抽出され、ペイロードに反映される

#### 3.8 予約URL送信（API連携）のテスト

**目的:** postback 受信後に GAS が L-step の「予約URL送信」トリガーを呼び出し、session_id 付きURLがユーザーにメッセージで届く流れを検証する。UID 混入防止のため、メッセージ内のリンクに session_id が含まれることを確認する。

**前提:**
- [LSTEP_BOOKING_LINK_API_SETUP.md](docs/lstep/LSTEP_BOOKING_LINK_API_SETUP.md) に従い、L-step でエンドポイント・パラメータ `booking_url`・連携アクション（メッセージ送信＋埋め込み）を設定済みであること
- GAS のスクリプトプロパティに `LSTEP_BOOKING_LINK_TRIGGER_URL` を設定済みであること

**テスト手順（実機）:**
1. LINE で予約ボタン（postback）をタップ
2. 数秒以内に **「予約はこちらから」等、booking_url が埋め込まれたメッセージ** が届くことを確認
3. そのメッセージ内のリンクをタップし、開いた予約画面の URL に **`session_id=`** が含まれることを確認
4. uidlog シートで、直近の postback 行の直後に **イベント種別が `BOOKING_LINK_SENT`** の行が記録されていることを確認（トリガー成功時）

**テスト手順（GAS のみ・トリガー呼び出しの確認）:**
1. GAS エディタで **`runLStepBookingLinkTriggerTest`** を選択して実行（引数なしでサンプル UID、または `runLStepBookingLinkTriggerTest('Uxxxxxxxx')` で指定 UID）
2. 実行ログで「✓ 成功」を確認
3. 指定した UID の LINE で、session_id 付きURLが埋め込まれたメッセージが届くことを確認

**確認項目:**
- [ ] postback 後に LINE に「予約URL付きメッセージ」が1通届く
- [ ] そのメッセージのリンクに `session_id=` が含まれる
- [ ] リンクを開くと、当該 session の uid で予約画面が表示される（他ユーザーのセッションになっていない）
- [ ] uidlog に `BOOKING_LINK_SENT` または（エラー時）`BOOKING_LINK_ERROR` が記録される

**注意:** `LSTEP_BOOKING_LINK_TRIGGER_URL` を未設定の場合は、従来どおり「予約URL送信トリガーは呼ばれない」動作になる。その場合も postback と uidlog への保存は成功する。

#### 3.8.1 doPost 実行確認（実行一覧に doPost が出ない場合）

GAS の「実行数」一覧に doPost が表示されないことがある。以下で「doPost が呼ばれたか」を確認できる。

1. **uidlog で WEBHOOK_RAW を確認**  
   postback した時刻付近に、`WEBHOOK_RAW: v... params=[...] len=...` の行があれば、そのリクエストで doPost は実行されている。
2. **ScriptProperties の LAST_DOPOST_AT を確認**  
   doPost の先頭で `LAST_DOPOST_AT` に実行時刻（ISO 文字列）を書き込んでいる。  
   postback を1回実行したあと、GAS の「プロジェクトの設定」→「スクリプト プロパティ」で `LAST_DOPOST_AT` の値を確認する。postback した時刻に更新されていれば、doPost は呼ばれている（＝実行一覧の表示問題）。

### 5. 管理画面（Admin.html）画面表示確認 🔄

#### 4.1 データ取得確認

**テスト手順:**
1. 管理画面にアクセス
2. ブラウザの開発者ツール（F12）のコンソールを確認

**確認項目:**
- [ ] `getAdminData()`が正常に実行されているか
- [ ] エラーが発生していないか
- [ ] カレンダーにイベントが表示されているか

#### 4.2 統計情報表示確認

**確認項目:**
- [ ] 「今日の面談数」が正しく表示されているか
- [ ] 「今週の合計面談数」が正しく表示されているか

#### 4.3 フィルタリング機能確認

**テスト手順:**
1. フィルタドロップダウンで「me」を選択
2. カレンダーが更新されるか確認

**確認項目:**
- [ ] フィルタが正しく機能しているか
- [ ] カレンダーが正しく再描画されるか

#### 4.4 手動予約登録機能確認

**テスト方法1: 単体テスト（推奨）**

GASエディタで以下の関数を実行：

```javascript
// 手動予約登録機能の単体テスト
runManualBookingTest();
```

**テスト内容:**
1. 実行ユーザーを担当者として登録（未登録の場合）
2. 手動予約を登録（Google Calendar + Spreadsheet）
3. 登録結果を確認（Google Calendar、Spreadsheet）

**確認項目:**
- [ ] テストが成功しているか
- [ ] Googleカレンダーにイベントが作成されているか
- [ ] スプレッドシートの`interviews`シートにレコードが追加されているか
- [ ] すべてのカラムが正しく記録されているか

**テスト方法2: 管理画面から手動登録**

**テスト手順:**
1. 管理画面を開く
2. 「電話予約登録」ボタンをクリック
3. モーダルで予約情報を入力
4. 登録を実行

**確認項目:**
- [ ] Googleカレンダーにイベントが作成されているか
- [ ] スプレッドシートの`interviews`シートにレコードが追加されているか
- [ ] カレンダー表示が更新されるか
- [ ] モーダルが閉じるか
- [ ] フォームがリセットされるか

#### 4.5 時間ブロック機能確認

**テスト手順:**
1. カレンダーで時間を選択
2. 「時間ブロック作成」を実行

**確認項目:**
- [ ] Googleカレンダーにブロックイベントが作成されているか
- [ ] カレンダー表示が更新されるか

### 5. TimeRex API動作確認 🔄

#### 5.1 イベント取得（getTimeRexEvent）

**テスト手順:**
1. GASエディタで以下を実行：
```javascript
getTimeRexEvent('test-event-id');
```

**確認項目:**
- [ ] イベント情報が正しく取得できるか
- [ ] エラーハンドリングが正しく機能するか（存在しないeventIdの場合）

#### 5.2 カレンダーイベント一覧取得（getTimeRexCalendarEvents）

**テスト手順:**
1. GASエディタで以下を実行：
```javascript
getTimeRexCalendarEvents('calendar-url-path');
```

**確認項目:**
- [ ] カレンダーのイベント一覧が正しく取得できるか

#### 5.3 イベントキャンセル（cancelTimeRexEvent）

**テスト手順:**
1. テスト用の予約を作成
2. GASエディタで以下を実行：
```javascript
cancelTimeRexEvent('event-id', 'テストキャンセル');
```

**確認項目:**
- [ ] イベントが正しくキャンセルされるか
- [ ] スプレッドシートのステータスが更新されるか

### 6. エラーハンドリング確認 🔄

#### 6.1 不正なWebhookペイロード

**テスト手順:**
1. Postman等で不正なペイロードを送信
2. エラーログを確認

**確認項目:**
- [ ] 適切なエラーメッセージが返されるか
- [ ] エラーログが記録されているか

#### 6.2 スプレッドシートアクセスエラー

**テスト手順:**
1. スプレッドシートのアクセス権限を一時的に削除
2. 予約を作成してエラーを確認

**確認項目:**
- [ ] 適切なエラーメッセージが返されるか
- [ ] エラーログが記録されているか

### 7. パフォーマンス確認 🔄

#### 7.1 キャッシュ動作確認

**テスト手順:**
1. 同じAPIリクエストを複数回実行
2. 2回目以降のレスポンス時間を確認

**確認項目:**
- [ ] キャッシュが正しく機能しているか
- [ ] レスポンス時間が改善されているか

## トラブルシューティング

### Webhookが受信されない

1. TimeRexのWebhook設定を確認
   - URLが正しいか
   - セキュリティトークンが正しく設定されているか
2. GASの実行ログを確認（`clasp logs`）
3. Webhook通信履歴をTimeRex管理画面で確認

### スプレッドシートにデータが記録されない

1. スプレッドシートのアクセス権限を確認
2. `SPREADSHEET_ID`が正しく設定されているか確認
3. `interviews`シートが存在するか確認
4. 実行ログでエラーがないか確認

### 管理画面でデータが表示されない

1. ブラウザの開発者ツール（F12）のコンソールを確認
2. ネットワークタブでAPIリクエストのエラーを確認
3. `getAdminData()`関数の実行ログを確認

### TimeRex APIが動作しない

1. `TIMEREX_API_KEY`が正しく設定されているか確認
2. APIキーの権限を確認（TimeRex管理画面 > チーム設定 > デベロッパーツール）
3. 実行ログでエラーメッセージを確認

