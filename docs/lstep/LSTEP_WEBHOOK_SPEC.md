# L-step Webhook転送機能 実装仕様書

## 1. 概要

L-stepのWebhook転送機能を使用して、LINE公式アカウントで発生したイベント（ボタンタップ等）をGAS側で受信し、UIDを取得して面談予約画面へつなぐ仕組みです。ユーザーがメッセージ内のリンク（`?from=line`）を開いたときは、リダイレクトせず予約画面のHTMLを直接返します（PC表示を避けるため）。

### 参考資料
- [L-step Webhook転送機能の公式記事](https://linestep.jp/2025/06/13/lstep-webhook/)
- [LINE Developers - メッセージ（Webhook）を受信する](https://developers.line.biz/ja/docs/messaging-api/receiving-messages/)

## 2. 重要な前提条件

### 2.1 URLにUIDは埋め込めない
- L-stepのURLパラメータに直接UIDを含めることはできません
- **Webhook転送でUIDを転送することしかできません**

### 2.2 UIDの把握はボタンタップによって行う
- メッセージ内のボタンをタップした際に、L-stepのWebhook転送でUIDを取得します
- LINE公式アカウントの標準イベントとして確実に動作します

### 2.3 Webhook転送データは外部への一方向のみ
- L-stepから外部への一方向（LINE公式アカウント→Lステップ→外部）
- タグ情報などのLステップのデータは送信されない
- **受信先のシステムでWebhook URLの発行が必要**

### 2.4 【重要】postback と URI の違い（doPost のみにすること）

| ボタン種別 | 発生するリクエスト | ユーザーが見るレスポンス |
|-----------|-------------------|-------------------------|
| **URI** | doGet（ブラウザ）＋ doPost（Webhook転送） | doGet のレスポンス＝UID取得失敗 |
| **postback** | doPost のみ | なし（LINE内に留まる） |

**動作するプロジェクトは doPost のみ。** URI ボタンだと doGet も呼ばれ、GET には POST ボディがないため UID を取得できずエラーになる。**ボタンは postback にすること。**

## 3. URLの種類と用途

**重要:** GASのURLは**スクリプトID**（`/macros/s/{SCRIPT_ID}/exec`）ではなく、**デプロイURL**（ウェブアプリとしてデプロイしたURL）を使用します。ドメイン付きの例: `https://script.google.com/a/macros/{ドメイン}/s/{デプロイID}/exec`。`getLStepWebhookEndpointUrl()` の実行ログに表示されるURL（`Config.BOOKING_BASE_URL` ベース）をそのまま使ってください。

### 3.1 Webhook転送エンドポイントURL（L-step管理画面で設定）
```
https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycb.../exec
```
- **用途**: L-step管理画面の「LINE Webhook転送設定」に設定（L-stepが**POST**でイベントを送る先）
- **送信方法**: POSTリクエスト（LINE公式アカウントのWebhookデータを転送）
- **設定場所**: L-step管理画面 > 「アカウント設定」 > 「外部連携設定」タブ > 「LINE Webhook転送設定」
- 上記は**デプロイURL**。実際の値は `getLStepWebhookEndpointUrl()` で確認。

**⚠️ 重要: Webhook転送URLには `?action=lstep_webhook` を付けないこと。**
- クエリパラメータを付けると L-step が POST 本文を転送せず、UID 取得に失敗する
- **ベースURLのみ**を指定する（末尾に `?` や `&` を付けない）

### 3.2 ボタンの設定（postback 推奨）

**推奨: postback ボタン ＋ シナリオでメッセージ送信**
- **ボタン**: アクション postback、data `{"action":"booking","interviewer_id":"tanaka"}`（JSON文字列）
- **シナリオ**: postback 受信 → テキスト＋URL のメッセージを送る。
- **メッセージ内のURL（ユーザーがクリックするリンク）**  
  - **推奨（安全）**: `https://.../exec?from=line&session_id={SESSION_ID}`（SESSION_ID は Webhook レスポンス等で取得した値）。session_id を含めると、同時刻に他ユーザーが操作しても紐づきがずれない。  
  - 従来: `https://.../exec?from=line`（必要なら `&interviewer_id=tanaka` を付与）。`?from=line` にするとモバイル表示になりやすい。  
  - 代替: `https://.../exec?action=lstep_webhook&interviewer_id=tanaka`（一部環境でPC表示になる場合あり）
- **流れ**: ①postback タップ → POST で UID・セッション作成 ②メッセージでURL受信 ③URLクリック → GET で **URLに session_id があればそれを使用**、なければ**直近2分以内の「postback」行1件**を取得（message 等の他イベント行は無視）→ 予約画面を直接表示（リダイレクトなし）。  
  **⚠️ 同時利用時のリスク:** session_id をURLに含めない場合、セッション検索は「直近1件」のため、**同時刻に複数ユーザーが postback すると、別ユーザーのセッションが割り当てられ、誤ったユーザーにリマインダが送信される**事象が発生し得る。詳細は [INCIDENT_UID_MIXING_2026-02.md](../operations/INCIDENT_UID_MIXING_2026-02.md)。**可能であればメッセージ内URLに session_id を含めること。**
  **【運用】session_id 無しの `?from=line` 単体利用時は同時利用禁止:** L-step で session_id 付きURLをメッセージに載せられない場合、**複数ユーザーが同時にボタンを押し・リンクを開く運用は行わないこと。** 同時利用が発生し得る環境では、API連携を停止するか、session_id 付きURLを送る方式への切り替えが必須。
  **補足:** uidlog に interviewer_id は保存していないため、セッション検索は常に「直近1件」。interviewer_id は予約画面で表示するカレンダー（面談官）の指定用にのみ使用。

### 3.3 予約画面のパラメータ（session_id 付きURL）
```
https://script.google.com/.../exec?session_id={SESSION_ID}&interviewer_id={INTERVIEWER_ID}
```
- **用途**: 予約画面（`handleBookingPage`）が受け取るパラメータ。`session_id` で uid を復元し、`interviewer_id` で表示するカレンダー（面談官）を指定する。
- **現在のフロー**: ユーザーがメッセージ内のリンクをクリックしたとき、**リダイレクトは行わない**。**URLに session_id があればそれを優先**し、なければ `getMostRecentSession(120)` で直近セッションを取得。**同一GETリクエスト内で** `handleBookingPage({ parameter: { session_id } })` を呼び、**予約画面のHTMLを直接返す**。session_id がURLに含まれる場合はブラウザのURLにも載る。中間でリダイレクトHTMLを返すと一部環境でPC表示になるため、直接表示にしている。
- **補足**: `handleLStepWebhook` は、L-step がメッセージ用URLを取得できるよう、**レスポンスHTMLに session_id 付きURLを機械可読で埋め込んでいる**。L-step 側で「Webhook レスポンスからURLを取得してメッセージに埋め込む」機能があれば、そのURLを利用することで UID 混入を防げる。
  - 埋め込み箇所: `<meta name="booking_url" content="...">`、`window.LSTEP_BOOKING_URL = "..."`（script）、`<!-- LSTEP_BOOKING_URL: ... -->`（コメント）。リダイレクト先URLは `?session_id=...&from=line`（および必要なら `&interviewer_id=...`）付き。

## 4. データフロー

### 4.1 全体フロー

```
【ステップ1】ユーザーがボタンをタップ
  ↓
【ステップ2】L-stepがWebhook転送を実行（POST）
  → Webhook転送エンドポイントURLにPOSTリクエスト
  → LINE公式アカウントのイベントデータ（UID含む）を転送
  ↓
【ステップ3】GAS側でWebhook転送を受信
  → doPost()関数が呼び出される
  → POST本文がLINE形式（またはURLに action=lstep_webhook）なら handleLStepWebhook()を実行
  ↓
【ステップ4】UIDの抽出とセッションID生成
  → POSTデータからUIDを抽出
  → セッションIDを生成（Utilities.getUuid()）
  → CacheServiceとuidlogに保存
  ↓
【ステップ5】L-step がメッセージでURL送信 → ユーザーがURLをクリック（推奨: ?from=line&session_id=xxx）
  → GET で URL の session_id を優先。無ければ直近2分以内のセッション1件を取得（同時利用時は混入リスクあり）
  → リダイレクトは行わず、handleBookingPage(session_id) のHTMLを直接返す（PC表示回避）
  ↓
【ステップ6】予約画面でUIDを取得
  → handleBookingPage() がセッションIDからUIDを取得（CacheService優先、uidlogフォールバック）
  → TimeRexウィジェットに line_uid を渡す
```

### 4.2 詳細フロー

#### ステップ1: ボタンタップ
- ユーザーがL-stepのメッセージ内のボタンをタップ
- **postback の場合**: ブラウザは開かず、L-step へ Webhook イベントが送られる
- **URI の場合**: ブラウザで URL が開く（doGet）＋ Webhook 転送（doPost）の両方が発生

#### ステップ2: Webhook転送
- L-stepが「LINE Webhook転送設定」で設定されたURLにPOSTリクエストを送信
- LINE公式アカウントのイベントデータが転送される
- ペイロードにUIDが含まれる

#### ステップ3: GAS側で受信
- `doPost()`関数が呼び出される
- `e.parameter.action === 'lstep_webhook'`の場合、`handleLStepWebhook()`を実行
- POSTデータからUIDを抽出

#### ステップ4: UIDの保存
- セッションIDを生成（`Utilities.getUuid()`）
- CacheServiceに保存（高速取得用、10分有効期限）
- uidlogシートに保存（日時, uid, sessionid, イベント種別, friendid）

#### ステップ5: リンク送信 → 予約画面を直接表示
- **postback → メッセージでURL送信 → ユーザーがURLクリック**（推奨フロー）:
  1. ユーザーが postback タップ → POST で UID 取得、セッション作成（interviewer_id は postback.data から取得可能）
  2. L-step シナリオで「テキスト＋URL」のメッセージを送る（URL 推奨: `...?from=line&session_id={SESSION_ID}`。SESSION_ID は Webhook レスポンス等から取得。含めない場合は従来どおり `...?from=line` も可だが同時利用で混入リスクあり）
  3. ユーザーがその URL をクリック → GET。URL に session_id があればそれを使用、なければ直近2分以内のセッション1件を取得し、**リダイレクトせずに予約画面のHTMLを直接返す**（中間リダイレクトだとPC表示になるため）

#### ステップ6: 予約画面でUID取得
- `handleBookingPage()` が doGet 内で `session_id` を引数に受け、呼び出される
- セッションIDからUIDを取得（CacheService優先、uidlogフォールバック）
- 取得した uid を userData.uid でテンプレートに渡し、TimeRexウィジェットの `url_params.line_uid` に設定

## 5. 実装仕様

### 5.1 GAS側の実装

#### doPost()関数
```javascript
function doPost(e) {
  // L-step Webhook転送の処理（POSTリクエストの場合）
  const action = e.parameter.action;
  if (action === 'lstep_webhook') {
    Logger.log('[doPost] L-step Webhook転送を検出（POSTリクエスト）');
    return handleLStepWebhook(e);
  }
  // ... TimeRex Webhookの処理
}
```

#### doGet()関数
```javascript
function doGet(e) {
  const action = e.parameter.action;
  
  // L-step Webhook転送の処理（GETリクエストの場合）
  if (action === 'lstep_webhook') {
    return handleLStepWebhook(e);
  }
  // ... その他の処理
}
```

#### handleLStepWebhook()関数
```javascript
function handleLStepWebhook(e) {
  // 1. POSTデータからUIDを抽出
  // 2. セッションIDを生成
  // 3. CacheServiceとuidlogに保存
  // 4. レスポンスとしてリダイレクトHTMLを返す（このレスポンスはL-stepサーバーが受け取る。ユーザーはメッセージ内の ?from=line を開き、そのときは予約画面を直接表示）
}
```

### 5.2 UIDの抽出方法

POSTデータからUIDを抽出する際は、以下のパターンを試行：

```javascript
uid = parsedPayload.uid || 
      parsedPayload.user_id || 
      parsedPayload.line_user_id || 
      parsedPayload.source?.userId || 
      parsedPayload.events?.[0]?.source?.userId || 
      '';
```

### 5.3 セッション管理

#### CacheService（高速取得用）
- キー: `uid_{sessionId}`
- 有効期限: 600秒（10分）
- 用途: 高速なUID取得

#### スプレッドシート（履歴用）
- シート名: `uidlog`
- カラム: `日時`, `uid`, `sessionid`, `イベント種別`, `friendid`（friendid は L-step の Webhook 転送で届く場合のみ入り、多くの環境では空）
- **friendid の取得**: ペイロード先頭の `friend_id` が無い場合、postback.data の JSON 内 `friend_id` キー、または `flex_code` に含まれる `_9桁数値_`（例: `flex_bubble..._239639916_pdvety` の 239639916）を友だちIDとして記録する。
- 用途: 履歴保存、フォールバック、デバッグ

### 5.4 handleLStepWebhook のレスポンス（参考）

POST 受信時、`handleLStepWebhook` は「リダイレクト用HTML」を返す。**このレスポンスを受け取るのは L-step のサーバーであり、ユーザーのブラウザではない。** ユーザーが実際に開くのは、L-step シナリオで送られたメッセージ内のリンク（`?from=line`）であり、その GET では**リダイレクトせず予約画面のHTMLを直接返している**（PC表示を避けるため）。

上記のため、ユーザーが「リダイレクト中」画面を見ることはない。GAS 側では session_id 付きURLをレスポンスHTML内に `meta name="booking_url"`・`window.LSTEP_BOOKING_URL`・HTMLコメントで埋め込んでいる。

### 5.5 L-step で生成した乱数（または session_id）をメッセージのURLにセットできるか

**結論:**  
- **Webhook 転送の「レスポンス」をシナリオで参照する方法**は、公式仕様に記載がなく**要確認**（Webhook 転送は「L-step → 外部」の一方向と明記されているため、外部が返したレスポンスを L-step がシナリオで使えるかは未記載）。  
- **API 連携（外部 → L-step）を使う方法**であれば、**生成した乱数や URL をメッセージに埋め込むことは公式に可能**である。

#### 方法A: Webhook 転送のレスポンスをシナリオで使う（要確認）

- L-step が「Webhook 転送で飛ばした先のレスポンス body」をシナリオで参照し、その中の値（例: 埋め込んだ booking_url）をメッセージの URL に使えるかは、**公式ドキュメントには記載がない**。  
- 確認先: L-step マニュアル（シナリオ・アクション設定）、またはサポートへの問い合わせ。  
- 可能な場合: GAS が返す HTML 内の `meta name="booking_url"` や `window.LSTEP_BOOKING_URL` を L-step が取得し、メッセージ内のリンクにその URL（乱数/session_id 付き）を設定する、という形が想定される。

#### 方法B: API 連携で「メッセージ送信＋値の埋め込み」を行う（公式に可能）

- L-step 公式ブログ（[API連携とは](https://linestep.jp/2025/12/08/lstep_api/)）では、**「取得した情報を、そのままメッセージに埋め込んで配信することもできます」** とされている。  
- 流れのイメージ:  
  1. ユーザーが postback → L-step が Webhook 転送で GAS に POST  
  2. GAS が UID を取得し、**乱数（または session_id）を生成**し、CacheService・uidlog に保存  
  3. GAS が **L-step の API 連携（トリガーURL）を呼び出し**、`uid` と「予約URL」（例: `booking_url` や `token` パラメータに `https://.../exec?from=line&token=12345678` を渡す）を送る  
  4. L-step の連携アクションで「メッセージ送信」を設定し、**テキストの埋め込み情報**に上記パラメータを指定  
  5. その結果、**生成した乱数入り URL がメッセージにセット**され、ユーザーに届く  

- この場合、**L-step に「生成する乱数を URL にセット」させるのではなく、GAS が乱数を生成し、API 連携で L-step にその値を渡し、L-step がメッセージに埋め込む**形になる。  
- 要件: API 連携の利用可能プラン、エンドポイント／パラメータ（例: `booking_url` または `token`）の作成、連携アクションで「メッセージ送信」＋「取得した情報の埋め込み」を設定。  
- 注意: postback 受信時に「シナリオで固定メッセージを送る」のと「API 連携でメッセージを送る」の二重送信にならないよう、シナリオ側の送信条件を調整する必要がある（例: postback ではメッセージを送らず、GAS から API 連携でだけ送る）。

#### 運用上の整理

| 方式 | 乱数/URLをメッセージに載せられるか | 確認・対応 |
|------|-----------------------------------|------------|
| Webhook のレスポンスをシナリオで参照 | 仕様未記載のため**要確認** | L-step マニュアル・サポートで「Webhook 転送先のレスポンスをシナリオで使えるか」を確認 |
| API 連携でトリガーにパラメータを渡す | **可能**（メッセージへの値埋め込み） | 実装済み。エンドポイント・パラメータ `booking_url` を用意し、GAS の `LSTEP_BOOKING_LINK_TRIGGER_URL` を設定すると postback 受信後にトリガーが呼ばれ、L-step がその URL をメッセージに埋めて送信する。設定手順は [LSTEP_BOOKING_LINK_API_SETUP.md](LSTEP_BOOKING_LINK_API_SETUP.md) を参照。 |

## 6. 設定手順

### 6.1 L-step管理画面での設定

#### ステップ1: Webhook転送の設定
1. L-step管理画面にログイン
2. 「アカウント設定」 > 「外部連携設定」タブを開く
3. 「LINE Webhook転送設定」に**GASのデプロイURL（ベースURLのみ）**を入力。
   - GASで `getLStepWebhookEndpointUrl()` を実行し、ログに表示されるURLをコピー
   - **`?action=lstep_webhook` などクエリパラメータは付けない**（付けるとUID取得に失敗）
4. 保存

#### ステップ2: ボタンの設定（テンプレート機能）
※ 詳細は下記「[ボタンの設置方法（詳細）](#ボタンの設置方法詳細)」を参照。

1. L-step管理画面 > 「テンプレート」 > 新規作成
2. フレックスメッセージまたはカルーセルメッセージで「予約する」ボタンを配置
3. ボタンのアクション: **postback** を推奨（URI だと doGet も飛び PC 表示になりやすい）
4. シナリオで送るメッセージ内のURL: **デプロイURL** + `?from=line`（必要なら `&interviewer_id=tanaka`）。`?action=lstep_webhook` だと一部環境で PC 表示になるため `?from=line` を推奨
   - 注意: スクリプトIDではなく**デプロイURL**を使用する
   - `interviewer_id` は予約画面で表示するカレンダー（面談官）の指定用
   - 担当者ごとに異なるテンプレートを作成することを推奨
5. 保存

##### ボタンの設置方法（詳細）

1. **L-step管理画面にログイン**し、左メニューから **「テンプレート」** を開く。
2. **「新規作成」**（または既存テンプレートの編集）をクリック。
3. **フレックスメッセージ** または **カルーセルメッセージ** を選択し、メッセージを組み立てる。
4. **ボタン（アクション）を1つ追加**する。
   - ボタンラベル例: 「予約する」「面談予約はこちら」など。
5. そのボタンの **アクション種類** で **「URI」**（URIアクション）を選ぶ。
6. **URI（URL）** に次の形式で入力する（すべて1行で、改行なし）:
   ```
   https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycbzwxXeBDR8LeHoYd5i4CRb2IElFR1AQcPzPg49ra4rYQc_njNox8LWIxlSMnAPHE25L_w/exec?action=lstep_webhook&interviewer_id=担当者ID
   ```
   - **必ずデプロイURLを使用**する（`/a/macros/ドメイン/s/デプロイID/exec` の形式）。スクリプトID（`/macros/s/1LFzDp_.../exec`）は使わない。
   - `担当者ID` の部分は、面談官ごとのID（例: `tanaka`）に置き換える。担当者ごとに別テンプレートにする場合は、それぞれの `interviewer_id` を設定する。
   - 実際のデプロイURLは GAS で **`getLStepWebhookEndpointUrl()`** を実行したときにログに表示される。そのURLの末尾に `&interviewer_id=xxx` を付けたものをそのままコピーして使ってよい。
7. **保存**してテンプレートを登録する。
8. **シナリオ配信** または **一斉配信** で、このテンプレートを送信すると、友だちのトークにボタン付きメッセージが届く。友だちがそのボタンをタップすると、ブラウザで上記URLが開き、あわせて L-step から Webhook転送（POST）が GAS に送られる。

### 6.2 GAS側の設定

#### ステップ1: Webアプリとしてデプロイ
1. GASエディタ > 「公開」 > 「デプロイを管理」
2. 「新しいデプロイ」 > 「種類の選択」で「ウェブアプリ」を選択
3. 「次のユーザーとして実行」を「自分」に設定
4. 「アクセスできるユーザー」を「全員」に設定
5. 「デプロイ」をクリック

#### ステップ2: Webhook URLの確認
GASエディタで以下の関数を実行：
```javascript
getLStepWebhookEndpointUrl()
```
実行ログに表示される**デプロイURL**（`Config.BOOKING_BASE_URL` ベース）を確認し、L-stepの「LINE Webhook転送設定」およびボタンのURIにそのURLを使用する。

## 7. テスト方法

### 7.1 モックテスト
GASエディタで以下の関数を実行：
```javascript
runAllLStepSessionTests()
```

### 7.2 実際のWebhook転送テスト
1. L-step管理画面でWebhook転送を設定
2. テンプレートを配信（ステップ配信または一斉配信）
3. ユーザーが「予約する」ボタンをタップ
4. GASの実行ログで以下を確認：
   - `[doPost]`または`[handleLStepWebhook]`で始まるログ
   - 受信したペイロードの形式
   - UIDが正しく抽出されたか
   - セッションIDが生成されたか
   - リダイレクトURLが正しく生成されたか

## 8. ログ出力

### 8.1 デバッグ用ログ
以下の情報をログ出力：
- 受信時刻
- POSTデータの詳細（Type, Length, Contents）
- パース後のペイロード
- 抽出されたUID
- 生成されたセッションID
- リダイレクトURL

### 8.2 エラーハンドリング
- UIDが取得できない場合: エラーページを返す
- セッション保存に失敗した場合: 警告ログを出力し、処理を続行（CacheServiceに保存されているため）

## 9. 注意事項

### 9.1 Webhook転送の制限
- Webhook転送データは外部への一方向のみ
- タグ情報などのLステップのデータは送信されない
- LINE公式アカウントで発生したイベントのみが対象

### 9.2 セキュリティ
- ブラウザのセキュリティ: 同じドメイン（`script.google.com`）内へのリダイレクトのため、セキュリティアラートは表示されません
- セッションIDはUUIDを使用（推測困難）

### 9.3 パフォーマンス
- CacheServiceを優先的に使用（高速取得）
- スプレッドシートはフォールバック用（履歴保存も兼ねる）

## 10. トラブルシューティング

### 10.1 UIDが取得できない場合（「POST Data is not available」が出る場合）
- **Webhook転送URLに `?action=lstep_webhook` を付けていないか確認**（ベースURLのみにすること）
- ログに `paramKeys=[action]` かつ `POST Data is not available` の場合は、Webhook転送URLのクエリを削除して再設定
- POSTデータの形式を確認（`uidlog` シートの `WEBHOOK_RECEIVED` 行）
- L-step管理画面でWebhook転送が正しく設定されているか確認

### 10.2 ?from=line で予約画面が出ない・「セッションが見つかりません」の場合
- ボタンタップから2分以内にリンクをクリックしているか確認
- uidlog に直近で postback の行が追加されているか確認（POST と GET で同じ SPREADSHEET_ID か確認。方法1のときは GET 側 GAS も同じスプレッドシートを参照すること）
- メッセージ内のURLは `?from=line` を使用しているか（推奨）

### 10.3 セッションが保存されない場合
- スプレッドシートの権限を確認
- CacheServiceの有効期限を確認
- GASの実行ログでエラーを確認

## 11. 関連ファイル

- `src/Code.gs`: `doGet()`, `doPost()`, `handleLStepWebhook()`, `handleBookingPage()`
- `src/SpreadsheetService.gs`: `getOrCreateUidlogSheet()`, `saveToUidlog()`, `getUidFromSessionSpreadsheet()`
- `src/Config.gs`: `SHEET_NAMES.UIDLOG`
- `src/TestApi.gs`: `runAllLStepSessionTests()`, `getLStepWebhookEndpointUrl()`, `prepareLStepWebhookTest()`

## 12. 更新履歴

- 2025-01-XX: 初版作成
  - L-step Webhook転送機能の実装仕様を整理
  - URLの種類と用途を明確化
  - データフローと実装仕様を詳細化
