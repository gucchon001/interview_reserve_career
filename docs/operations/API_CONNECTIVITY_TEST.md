# API疎通テスト手順

## 概要

LステップAPIおよびTimeRex APIの疎通を、GASエディタから確認する手順です。

## 最低限の疎通テスト（まずはここから）

次の1本で、**L-step トークン・TimeRex APIキー・スプレッドシート**の3つをまとめて確認できます。

1. GAS エディタで **`TestApi.gs`** を開く  
2. 関数選択で **`runMinimumConnectivityTest`** を選び **実行**  
3. ログの「結果サマリー」で ✓/✗ を確認  

| 項目 | 内容 |
|------|------|
| L-step（認証・GET） | スクリプトプロパティ `LSTEP_API_TOKEN` で api.lineml.jp に到達できるか |
| TimeRex APIキー | `TIMEREX_API_KEY` が設定されているか |
| スプレッドシート | 紐づきスプレッドシートと必要シート（uidlog 等）が使えるか |

すべて ✓ なら、UID取得〜予約画面表示に必要な最低限の疎通は取れています。スプレッドシートが ✗ の場合は `setupSpreadsheetSheets()` の実行を検討してください。

## 指定UIDでのLステップAPI疎通テスト

**テスト対象UID:** `U6e967fdb7f0aaf99375946cad8744fad`

### 手順（推奨）

1. **GASエディタ**でプロジェクトを開く（[script.google.com](https://script.google.com)）
2. ファイル一覧で **`TestApi.gs`** を開く
3. 関数選択プルダウンから **`runApiConnectivityTestForSpecifiedUid`** を選択
4. **実行**（▶）をクリック
5. **実行ログ**（表示 > ログ、または Ctrl+Enter）で結果を確認

### 期待される結果

- **成功時**
  - ログに `✓ 疎通成功: 指定UIDでAPIに接続できました。` と表示
  - 戻り値: `true`

- **失敗時**
  - トークン未設定: スクリプトプロパティ `LSTEP_API_TOKEN` を設定
  - 401: トークンが無効または期限切れ
  - 404: [下記「404 になる場合」を参照](#404-になる場合uidは存在すると確認しているとき)

### 404 になる場合（UIDは存在すると確認しているとき）

`POST /friend/update` で 404 が返る場合、次の2点を切り分けてください。

1. **LINE公式アカウントの一致**
   - 使用している **LSTEP_API_TOKEN** が紐づく **LINE公式アカウント** と、該当UIDの友だちが **同じアカウント** か確認する。
   - 別アカウント（例: 本番チャネルとテストチャネル）だと、UIDが「存在」していてもこのトークンでは友だちとして見つからず 404 になります。
   - **確認方法**: L-step 管理画面の「API連携」→「認証」でトークンを発行したアカウントと、そのUIDが友だちになっている「友だちリスト」のアカウントが同一か。

2. **REST /friend/update が使えない契約の可能性**
   - L-step の提供形態によっては、友だち情報更新が **トリガーURL（エンドポイント）経由のみ** の場合があります。その場合 `https://api.lineml.jp/v1/friend/update` は存在せず 404 になります。
   - **切り分け**: トリガーURLテストを実行する。
     - 使用するトリガーURL: **`https://api.lineml.jp/v1/api-codes/690/triggers/c4faddc7-b837-4637-b481-eaab5777af2a`**（`Config.LSTEP_TRIGGER_URL_DEFAULT` に設定済み）。別URLを使う場合はスクリプトプロパティ **`LSTEP_TRIGGER_URL`** に設定。
     - GAS で **`runLStepApiTriggerTestForSpecifiedUid`** を実行する（指定UIDでトリガーURLへPOST）。
     - ここで **2xx が返れば**、友だちの特定はできているので「友だち情報更新はトリガーURL経由で行う」運用にする必要があります（本番の友だち情報更新処理をトリガー呼び出しに変更する検討）。

### 原因を自動で切り分けてデバッグする（推奨）

**UIDは存在するのに 404 になる**場合、1本の診断関数で原因を切り分けできます。

1. GAS エディタで **`TestApi.gs`** を開く
2. 関数選択で **`runLStep404Diagnostic`** を選び **実行**
3. **実行ログ**の「【診断結果】」を読む

| ログに出す結論 | 意味 | 次のアクション |
|----------------|------|----------------|
| **RESTは404だがトリガーは2xx** | `/friend/update` はこの契約では使えない。友だちは見つかっている。 | 友だち情報更新を **トリガーURLへPOST** する実装に変更する。 |
| **トリガーも404** | トリガーURLが紐づくLINE公式アカウントと、このUIDの友だちが **別アカウント** の可能性が高い。 | L-step「友だちリスト」で、api-codes/690 のアカウントを開き、該当UIDがその友だち一覧にいるか確認する。 |
| **認証エラー(401)** | トークンが無効または期限切れ。 | L-step「API連携」→「認証」でトークンを再取得し、スクリプトプロパティ `LSTEP_API_TOKEN` を更新する。 |
| **REST /friend/update は利用可能** | 問題なし。 | 追加の切り分けは不要。 |

別のUIDで診断する場合は、実行時にパラメータでUIDを渡すか、`runLStep404Diagnostic('ここにUID')` を呼ぶ関数を一時的に作り実行してください。

### UID取得だけにする（LSTEP_UID_ONLY）

**まずはUID取得だけ**行いたい場合は **`Config.LSTEP_UID_ONLY: true`** にします。このときは次のみ動きます。

- ボタンタップ → L-step が Webhook 転送で GAS に POST → **UID を抽出して uidlog に保存** → 予約画面へリダイレクト（`session_id` 付き）
- 予約確定・キャンセル時の**友だち情報更新・タグ設置は行いません**（L-step API は呼ばない）

友だち情報更新・タグまで使う場合は `LSTEP_UID_ONLY: false` にし、トリガーURL やパラメータを設定してください。

### トリガーURL経由の実装（LSTEP_UID_ONLY が false のとき）

診断で「RESTは404だがトリガーは2xx」と出た場合、本プロジェクトでは **`Config.LSTEP_USE_TRIGGER_URL: true`** により、予約確定・キャンセル時のLステップ連携が **トリガーURL経由**（`LStepApiService.triggerFriendUpdate`）に切り替わります。

**L-step 側の設定:** 該当エンドポイントの「パラメータ管理」で、以下の JSON キーを登録し、連携アクションで友だち情報・タグに紐づけてください。

| JSONキー | 説明 | データ型例 |
|----------|------|------------|
| `meeting_date` | 面談日時（"YYYY-MM-DD HH:mm:ss"） | 日時 |
| `meeting_url` | ミーティングURL | 文字列 |
| `meeting_cancel_url` | キャンセル用URL | 文字列 |
| `tag` | 設置するタグ名（例: 面談予約済み） | 文字列 |

キャンセル時は `meeting_date` / `meeting_url` / `meeting_cancel_url` に `null` を送り、リマインド停止に利用できます。

### 別UIDでテストする場合

関数選択で **`runLStepApiConnectivityTestWithUid`** を選び、実行時にパラメータとしてUIDを入力するか、  
`TestApi.gs` 内で `runApiConnectivityTestForSpecifiedUid` の引数（`'U6e967fdb7f0aaf99375946cad8744fad'`）を変更して実行してください。

---

## その他の疎通テスト

| テスト内容 | 実行する関数 |
|------------|----------------------|
| **最低限の疎通（L-step・TimeRexキー・スプレッドシート）** | **`runMinimumConnectivityTest`** |
| 全API疎通（TimeRex / Webhook / Calendar / Spreadsheet / APIキー） | `runAllApiTests` |
| LステップAPI（認証のみ・GET） | `runLStepApiConnectivityTest` |
| LステップAPI（UID指定・POST /friend/update） | `runLStepApiConnectivityTestWithUid(uid)` |
| **LステップAPI（トリガーURLへPOST・UID指定）** | `runLStepApiTriggerTestForSpecifiedUid`（未設定時は `Config.LSTEP_TRIGGER_URL_DEFAULT` を使用） |
| **LステップAPI（トリガーURLへPOST・friend_id 指定）** | `runLStepApiTriggerTestForSpecifiedFriendId`（friend_id: 204179348） |
| **404原因の自動切り分け（UIDは存在するのに404のとき）** | **`runLStep404Diagnostic`** |
| LステップWebhook転送モック | `runLStepWebhookMockTest` |
| Lステップ連携 全テスト | `runAllLStepSessionTests` |

詳細は `src/TestApi.gs` の各関数コメントを参照してください。
