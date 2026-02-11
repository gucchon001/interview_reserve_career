# LステップでLINE UID（uid）を取得する方法

**仕様の前提（[LSTEP_WEBHOOK_SPEC.md](./LSTEP_WEBHOOK_SPEC.md) に基づく）：**

- **URLにUIDは埋め込めない** — L-stepのURLパラメータに直接UIDを含めることはできません。**Webhook転送でUIDを転送することしかできません**。
- **UIDの把握はボタンタップによって行う** — メッセージ内のボタンをタップした際に、L-stepの**Webhook転送（POST）**でイベントが転送され、その**POSTのbody**にUIDが含まれます。

つまり「uidがわからないから取得しようとしている」場合は、**uidをURLに付けるのではなく、L-stepのWebhook転送（POST）を受信して、そのbodyからuidを取り出す**流れが正しいです。

---

## 正しい流れ：uidは「Webhook転送のPOST」で受け取る

1. **L-stepの「LINE Webhook転送設定」に、GASのURLを設定する**  
   → ここが「L-stepが**POST**を送る先」です。  
   （[lstep_api_manual.md](./lstep_api_manual.md) の「外部連携設定」で設定するURL）

2. **友だちが「予約する」などのボタン（URI）をタップする**

3. **このとき次の2つが起きる**
   - **ブラウザがボタンのURLを開く** → GASには **GET** が届く（body なし → **uid は取れない**）
   - **LINEがL-stepにイベントを送る** → L-stepが「転送設定」のURLに **POST** する → GASの **doPost()** が呼ばれ、**POSTのbodyにuidが入っている**

4. **uidはPOSTのbodyから取り出す**  
   GETでは取れません。**doPost が呼ばれ、その body をパースして uid を取得する**実装になっています。

---

## 「UID取得に失敗しました」になる理由（マニュアルに沿った整理）

- リンクをLINEでクリックすると、**ブラウザからGETだけ**がGASに届きます。
- **uidはWebhook転送のPOSTのbodyにしか含まれない**ため、**GETだけではuidを取得できません**。
- したがって、
  - **POSTが届いていない**（L-stepが転送していない／転送先URLが違う）、または
  - **POSTは届いているが、bodyの形式が想定と違う**  
のどちらかが原因です。**「uidをまだ知らないから取得したい」のに「URLにuidを付けて」は仕様上できません。** 取得方法は「POSTを受け取ってbodyから取り出す」だけです。

---

## やるべき確認（uid取得を成功させるために）

### 1. 「LINE Webhook転送設定」のURL

- 設定しているURLが **このGASのデプロイURL** になっているか確認する。  
  （`getLStepWebhookEndpointUrl()` のログに出すURLと同じにする。）
- ここが **L-stepがPOSTを送る先** です。違うURLだとPOSTがGASに届きません。

### 2. ボタンタップ時に doPost が呼ばれているか

- ボタンタップ直後に、GASの「実行」タブで **doPost の実行** が発生しているか確認する。
- **doPost が呼ばれていれば**、POSTのbodyからuidを抽出してuidlogなどに保存する処理が動くので、**uidは取得できている**可能性が高いです。
- **doPost が一度も呼ばれていない**場合は、L-stepが「LINE Webhook転送」でこのGASのURLにPOSTを送っていない（転送先の設定ミスや、転送対象イベントの違い）を疑う。

### 3. POSTは届いているがuidが取れない場合

- GASの実行ログで `[handleLStepWebhook]` や `[doPost]` の直後の **「Payload top-level keys」** などを確認する。
- L-stepから送られているbodyの形が、コードが想定している形（例: `events[0].source.userId` など）と違う可能性がある。  
  ログのキー名や構造を共有してもらえれば、取り方の修正案を出しやすい。

### 4. uidを確認する方法（POSTで保存できている場合）

- **showLastSessionUids()** を実行して、uidlogの直近の行のuidをログで確認する。
- 紐づいているスプレッドシートの **uidlogシート** の、直近行の **uid** 列を確認する。

---

## まとめ（マニュアルに沿った整理）

| やりたいこと | 正しい方法（マニュアル通り） |
|--------------|------------------------------|
| uidがわからないのでuidを取得する | **Webhook転送のPOST**を受け取り、**bodyからuidを取り出す**。URLにuidは埋め込めない。 |
| 転送が動いているか確認する | 「LINE Webhook転送設定」のURL＝GASのURLになっているか確認。ボタンタップ時に **doPost** が実行されているか確認。 |
| uidが取れないとき | POSTが届いているか（doPostの有無）、届いているならbodyの形式（Payload top-level keys等）を確認する。 |

- 参照ドキュメント: [LSTEP_WEBHOOK_SPEC.md](./LSTEP_WEBHOOK_SPEC.md)（URLにUIDは埋め込めない／Webhook転送でUIDを取得する）、[lstep_api_manual.md](./lstep_api_manual.md)（API連携・外部連携の設定）。
