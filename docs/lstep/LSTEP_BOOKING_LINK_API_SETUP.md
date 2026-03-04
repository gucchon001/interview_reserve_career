# 予約URL送信（API連携）の設定手順

postback 受信後、GAS が L-step の API 連携（トリガー）を呼び出し、**session_id 付きの予約URLをメッセージに埋め込んでユーザーに送る**ことで、UID 混入を防ぐための設定手順です。

## 前提

- L-step の **API 連携** が利用可能なプランであること（プロプラン以上等。要確認）。
- 同じ L-step アカウントで **Webhook 転送** も設定済みであること（postback が GAS に届くこと）。

## 1. L-step 側の設定

### 1.1 エンドポイントの作成

1. L-step 管理画面 > **API連携** > **エンドポイント設定** タブ
2. **+新しいエンドポイント** をクリック
3. エンドポイント名を入力（例: `予約URL送信`）して作成

### 1.2 パラメータの作成

1. 作成したエンドポイントを開く > **パラメータ管理** タブ
2. **+新しいパラメータ** をクリック
3. 次のように設定:
   - **JSONキー**: `booking_url`
   - **データ型**: 文字列
   - **ラベル**: 予約URL（または任意）
4. 保存

### 1.3 連携アクションの設定

1. **連携アクション** タブ > **+連携アクションを追加**
2. **連携アクション名**: 例: `予約リンク送信`
3. **ステータス**: **稼働中**
4. **友だちの絞り込み**: 「外部API連携」で、該当エンドポイントの **booking_url** などで絞り込む必要はない（uid で対象が決まる）。対象は「トリガーで受け取った uid の友だち」になる。
5. **アクション設定**:
   - **テキスト送信** を選択（画面上に「メッセージ送信」という名前はなく、「テキスト送信」または「テンプレート送信」が表示されます。予約URLを埋め込む場合は **テキスト送信** を選びます）
   - 送るテキストを入力（例: `予約はこちらから:`）
   - **テキストの埋め込み情報**（取得した情報を埋め込む）で **予約URL**（booking_url）を選択して埋め込む。  
     例: 「予約はこちらから: 」のあとに埋め込みで「予約URL」を指定し、結果として `予約はこちらから: https://.../exec?session_id=xxx&from=line` のように送られるようにする。
6. 「この条件で決定する」で保存

### 1.4 トリガーURLの取得

1. エンドポイント詳細画面で **【cURL実行サンプル】** をクリック
2. 表示された **URL** をコピー（例: `https://api.lineml.jp/v1/api-codes/690/triggers/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）
3. この URL を GAS のスクリプトプロパティに登録する（次のセクション）

### 1.5 シナリオでの二重送信を防ぐ

**予約URL送信を API 連携で行う場合**、postback 受信時に **シナリオで「固定の ?from=line のメッセージ」を送らない**ようにする必要があります。  
そうしないと「固定URLのメッセージ」と「session_id 付きURLのメッセージ」の2通が届きます。

- シナリオで postback を受けたときのアクションを「メッセージを送らない」にする、または  
- 「処理中です。しばらくお待ちください」など短いメッセージのみにし、**予約リンクは GAS から API 連携で送る**形に統一する。

## 2. GAS 側の設定

1. GAS エディタ > **プロジェクトの設定** > **スクリプト プロパティ**
2. **+ プロパティを追加**
3. **プロパティ**: `LSTEP_BOOKING_LINK_TRIGGER_URL`
4. **値**: 上記 1.4 でコピーしたトリガーURL（そのまま貼り付け）
5. 保存

**LSTEP_BOOKING_LINK_TRIGGER_URL を設定しない場合**は、従来どおり「レスポンス HTML に URL を埋め込むだけ」の動作になり、メッセージはシナリオの固定URLのみ（設定次第）です。

### 2.1（任意）予約URLを送る postback を絞り込む

複数の postback ボタン（例: 「予約する」「キャンセル」「問い合わせ」）がある場合、**予約用の postback のときだけ**予約URLを送りたいときは、スクリプトプロパティを追加します。

| プロパティ | 値 | 説明 |
|------------|-----|------|
| `LSTEP_BOOKING_LINK_POSTBACK_PATTERN` | 例: `booking` | **未設定または空**: すべての postback で予約URLを送信（従来どおり）。**設定時**: `postback.data` にこの文字列が**含まれる**ときのみ送信。 |

- 予約ボタンの postback の data が `{"action":"booking","interviewer_id":"tanaka"}` のような文字列なら、パターンに `booking` を指定すると「予約する」タップ時のみ送信される。
- **イベント種別**: 予約URL送信は **postback のときだけ**行う。message や follow などでは送信しない。

#### 2.1.1 L-step で postback.data を設定できない場合の手順（Webhook payload を確認してパターンを決める）

L-step の画面に「postback の data」入力欄がない場合、**実際に届いている Webhook の payload を確認**し、その中から「予約する」ボタンだけを識別できる文字列を探してパターンに設定します。

**ステップ1: 「予約する」ボタンを1回押す**

- LINE で、予約用のテンプレートを表示し、**「予約する」ボタンだけ**をタップする。
- 押した日時をメモする（例: 2026-02-18 12:34:56）。

**ステップ2: GAS の実行ログで postback.data を確認する**

1. GAS エディタで **「実行数」**（または「Executions」）を開く。
2. **関数**: 絞り込みを外すか **「doPost」** を選ぶ。**日付**: ボタンを押した日を選ぶ。
3. ボタンを押した時刻の **doPost** の実行をクリックして開く。
4. **「ログ」**（または「Logs」）を開く。
5. ログ内で次のいずれかを探す：
   - **`[handleLStepWebhook] postback.data (パターン判定用):`**  
     → この行のうしろに、L-step が送ってきた **postback の data** がそのまま出る。  
     - 例: `(空)` なら data は送られていない。  
     - 例: `シナリオを移動` や `step_123` のような文字列なら、それをパターンに使える。
   - または **`[handleLStepWebhook] Parsed Payload`** の行  
     → 続く JSON の `events[0].postback.data` の値を確認する。

**ステップ3: 識別できる文字列を決める**

- **postback.data が空の場合**: L-step が data を送っていないため、**パターンでは絞り込めません**。予約ボタンが1種類だけなら、`LSTEP_BOOKING_LINK_POSTBACK_PATTERN` は**設定しない**（すべての postback で送信）で運用する。
- **postback.data に文字列がある場合**:  
  - 「予約する」を押したとき**だけ**に含まれる文字列を1つ選ぶ（他ボタンには含まれないこと）。  
  - 例: `予約` や `面談予約`、または L-step が入れる ID やラベル（`step_xxx` など）の一部。

**ステップ4: スクリプトプロパティにパターンを設定する**

1. GAS の **「プロジェクトの設定」** → **「スクリプト プロパティ」** を開く。
2. **+ プロパティを追加** で、**プロパティ** に `LSTEP_BOOKING_LINK_POSTBACK_PATTERN`、**値** にステップ3で決めた文字列（例: `予約`）を入力。
3. 保存し、**新しいバージョンでデプロイ**する。

**ステップ5: 動作確認**

- 「予約する」を押す → 予約URLが送られること。
- 他の postback ボタン（キャンセル・問い合わせなど）を押す → 予約URLが送られ**ない**こと。

**補足**: 実行一覧に doPost が表示されない場合は、[TESTING.md の 3.8.1](../../TESTING.md) の「LAST_DOPOST_AT」で doPost が動いているか確認し、Cloud ログ（「表示」→「ログ」）で `postback.data (パターン判定用)` を検索してください。

### 2.2 template シートで送信対象と面談官を管理する（推奨）

同一スプレッドシートに **template** シートを用意すると、**予約URLを送る postback** の対象と、**redirectUrl に付与する interviewer_id** をシートで一元管理できます。

**シート名**: `template`

**列（1行目はヘッダー）:**

| 列 | ヘッダー | 説明 |
|----|----------|------|
| A | tag | L-step の postback.data に含まれる文字列（flex_code / carousel_code の接頭辞）。例: `flex_bubble1193475e9f6df414d` |
| B | name | 表示用名前（共通・尾座本など） |
| C | outer_id | 面談官ID（interviewers シートの id と一致）。空欄の場合は統合カレンダー |

**挙動:**

- **LSTEP_BOOKING_LINK_POSTBACK_PATTERN が未設定**のとき: postback.data が **template のいずれかの tag に一致**した場合のみ予約URLを送信。シートに行が無い、または一致しない場合は送信しない（行が0件のときは従来どおりすべての postback で送信）。
- **interviewer_id**: postback.data から JSON で interviewer_id が取れない場合、**一致した template 行の outer_id** を interviewer_id として redirectUrl に付与する（`?session_id=...&interviewer_id=y_ozamoto&from=line` など）。

**LSTEP_BOOKING_LINK_POSTBACK_PATTERN を設定している場合**は、従来どおり「パターンが postback.data に含まれるときのみ送信」となり、template シートは **送信判定には使われません**（outer_id による interviewer_id の補完には引き続き使用されます）。

## 3. 動作フロー

1. ユーザーが LINE で postback ボタンをタップ
2. L-step が Webhook 転送で GAS に POST
3. GAS が UID を取得し、session_id を生成、CacheService と uidlog に保存
4. **送信条件**: イベントが **postback** であること。さらに `LSTEP_BOOKING_LINK_POSTBACK_PATTERN` が設定されていれば、`postback.data` にその文字列が含まれるときのみ次へ進む
5. GAS が **LSTEP_BOOKING_LINK_TRIGGER_URL** に POST（uid + booking_url）
6. L-step が該当 uid の友だちに「booking_url を埋め込んだメッセージ」を送信
7. ユーザーがそのメッセージ内のリンク（session_id 付き）をクリック → 予約画面が正しいセッションで開く

## 4. 送信ペイロード形式

GAS からトリガーへ送る JSON の例:

```json
{
  "uid": "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "booking_url": "https://script.google.com/.../exec?session_id=xxx&from=line",
  "params": {
    "booking_url": "https://script.google.com/.../exec?session_id=xxx&from=line"
  }
}
```

L-step のパラメータで `booking_url` を登録しているため、ルート直下と `params` の両方に含めています。

## 参照

- [LSTEP_WEBHOOK_SPEC.md](LSTEP_WEBHOOK_SPEC.md) 5.5（方法B: API連携）
- [TESTING.md](../../TESTING.md) の「予約URL送信（API連携）のテスト」
