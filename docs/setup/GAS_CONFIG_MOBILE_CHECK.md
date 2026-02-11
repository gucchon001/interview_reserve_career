# GAS 構成のモバイル表示まわり ステップバイステップ確認

他の GAS ではモバイル表示されるが本プロジェクトではされないため、**本プロジェクトの GAS 構成が特殊になっていないか** をステップごとに確認するためのチェックリストです。

---

## 原因（確定）

**Webhook 外部連携 URL を設定したものは PC 表示になった。**

LSTEP で **Webhook 外部連携 URL（Webhook 転送先 URL）** を設定している場合、その経路で開かれたリンク（ユーザーがクリックする予約 URL 等）が LINE 内で **PC 表示（iframe でデスクトップ幅）** になる。Webhook 外部連携 URL を設定していない GAS／リンクでは、同じ端末・LINE でも **モバイル表示** になる。

→ 本プロジェクトは LSTEP の Webhook 転送を使って UID 取得しているため、その「Webhook 外部連携を設定した」状態で開かれるリンクが PC 表示になる。原因は **LSTEP 側の Webhook 外部連携 URL を設定していること** にあり、GAS の ALLOWALL や HTML の内容ではない。

**補足:** **「ブラウザで開く」で開いても PC 表示になる** ことを確認済み。LINE 内に限らず、外部ブラウザ（Chrome / Safari 等）で同じ URL を開いてもデスクトップ表示になるため、原因は「LINE の iframe」だけではなく、**Webhook 外部連携 URL を設定したことによる何らかの扱い（URL 単位・ドメイン単位の差など）** が、開き方に関係なく効いている可能性がある。

**対策の方向性:** Webhook 転送は UID 取得に必要であるため廃止は難しい。「ブラウザで開く」では解消しないため、LSTEP 側への問い合わせや、別 URL 経由のリダイレクトの検討が必要。

---

## どうすればいいか（取れる選択肢）

**注意:** 「ブラウザで開く」で開いても **PC 表示のまま** であることを確認済み。そのため「ブラウザで開く」案内だけではモバイル表示は得られない。

| 選択肢 | 内容 | 備考 |
|--------|------|------|
| **1. LSTEP に問い合わせる（推奨）** | 「Webhook 外部連携 URL を設定していると、配信したリンクが LINE 内・ブラウザで開いても PC 表示になる。モバイル表示にする設定や回避方法はあるか」と問い合わせる。 | 原因が LSTEP 側の仕様なので、設定の有無や今後の対応を確認するのが最も筋が良い。 |
| **2. 別 URL 経由で開かせる（要検証）** | ユーザーがクリックするリンクを **当 GAS の URL ではなく、別ドメイン／別サービスの短縮 URL やリダイレクト用 URL** にし、その先で当 GAS の予約ページへリダイレクトする。Webhook 転送先 URL とは別の「入口」にすることで、PC 表示になる条件を避けられる可能性がある。 | 要検証。リダイレクト元のサービス（別 GAS、短縮 URL サービス等）の用意が必要。 |
| **3. 現状のまま運用する** | スマホでも PC 表示のまま受け入れ、必要に応じてズームや横スクロールで利用してもらう。 | 運用でカバーする場合。 |
| **4. 本番の予約ページを復元する** | 切り分けで簡素化した Booking.html を、**Booking.backup.html** の内容で上書きして元の予約ページ（TimeRex 付き）に戻す。 | 表示の原因は LSTEP の Webhook 設定のため、復元しても PC 表示になる事実は変わらない。 |

**おすすめの進め方:**  
**1** で LSTEP に問い合わせつつ、可能なら **2** の「別 URL 経由」を小規模に試す。本番運用に戻すなら **4** で Booking.backup.html を復元する。

---

---

## ステップ1: appsscript.json（デプロイ・ランタイム）

| 項目 | 本プロジェクトの値 | 一般的な GAS との比較 |
|------|-------------------|------------------------|
| `webapp.executeAs` | `USER_DEPLOYING` | よくある設定。「自分」で実行。 |
| `webapp.access` | `ANYONE` | 誰でもアクセス可。一般的。 |
| `runtimeVersion` | `V8` | 現行の標準。 |
| `timeZone` | `America/New_York` | タイムゾーンは viewport に無関係。 |

**結論:** 特段おかしな設定はない。**ここは原因の可能性は低い。**

---

## ステップ2: エントリの流れ（doGet の分岐）

1. **LSTEP 経由で開く場合**
   - ユーザーがクリックする URL: `.../exec?action=lstep_webhook&interviewer_id=xxx`
   - `doGet(e)` → `e.parameter.action === 'lstep_webhook'`
   - 直近セッションがあれば **リダイレクト用の最小 HTML を返す**（ステップ3）
   - その後ブラウザが `.../exec?session_id=xxx&interviewer_id=xxx` に遷移
   - 再度 `doGet(e)` → `page === 'booking'` → `handleBookingPage(e)` で予約ページを返す

2. **予約ページを直接開く場合**
   - URL: `.../exec?session_id=xxx` または `.../exec`
   - `doGet(e)` → `handleBookingPage(e)` のみ

**気になる点:** LSTEP 経由のときは **2 回 doGet が呼ばれる**。1 回目は「リダイレクト用の最小 HTML」、2 回目が予約ページ。**1 回目のレスポンス（viewport の有無・順序）が、続く 2 回目の表示に影響する可能性は理論上ある**（キャッシュやレンダリングモードの引き継ぎなど）。

---

## ステップ3: LSTEP 用リダイレクトページの HTML 構成（要確認）

**現在の並び（Code.gs 33–39 行付近）:**

```html
<head>
  <meta charset="UTF-8">
  <script>window.location.replace("...");</script>   <!-- 先に実行 -->
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=...">
</head>
<body></body>
```

- **viewport が script より後** にある。
- スクリプトが先に実行され即リダイレクトするため、**このページでは viewport がほぼ効かない**可能性がある。
- 一部の WebView では「最初に読んだページのレンダリングモード」が次の遷移に影響することがある（仕様ではなく実装依存）。

**推奨:** viewport を **script より前** に置く。リダイレクトページでも「モバイル用」として解釈されるようにする。

---

## ステップ4: setXFrameOptionsMode(ALLOWALL)（重要）

本プロジェクトでは **すべての HTML レスポンス** に次の設定を付けている:

```javascript
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
```

- **ALLOWALL** = X-Frame-Options を付けない → **任意のサイトから iframe で埋め込むことを許可**。
- コメントでは「LINEアプリ内ブラウザ対応」を目的としている。

**他 GAS と違う点になり得る理由:**

- 他の GAS で **ALLOWALL を付けていない**（デフォルトのまま）場合、**同一オリジン以外からの iframe 埋め込みはブロック**される。
- LINE がリンクを開くとき、
  - **iframe で開く**場合: 親（LINE）が iframe の幅を決める。例えば 980px 幅の iframe で開かれると、**その中では viewport が device-width でも「幅 980px」として描画**され、結果として PC レイアウトになり得る。
  - **別タブ／フル画面で開く**場合: 私たちのページがトップレベルなので、viewport がそのまま効きやすい。
- **ALLOWALL にしていると、LINE が「iframe で開く」ことを選びやすく、その場合に親が広い幅を渡すとモバイル表示にならない、という経路が考えられる。**

**確認方法（切り分け）:**  
予約ページ（`handleBookingPage`）の戻り値 **だけ** 一時的に `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)` に変更してデプロイし、LSTEP から同じ手順で開く。  
→ モバイル表示になるなら、**iframe 埋め込み＋親の幅** が原因の可能性が高い。  
（LINE が iframe を諦めて別画面で開くようになる可能性がある。）

---

## ステップ5: Sandbox モード（未指定）

- `setSandboxMode()` は **指定していない** → GAS の **デフォルト** が使われる。
- HtmlService のデフォルトは **IFRAME**（Google のラッパー内で iframe として表示）のことが多い。
- 過去に「IFRAME モードでは viewport が効きにくい」という報告があったが、現在は `addMetaTag('viewport', ...)` で対応されたとされている。本プロジェクトでも `addMetaTag('viewport', ...)` は使用している。

**結論:** 未指定であること自体は「他 GAS と比べて特別」とは言いにくい。**Sandbox よりステップ4（ALLOWALL）の影響の方が大きい可能性。**

---

## ステップ6: 予約ページの HTML の出し方

- `HtmlService.createTemplateFromFile('Booking')` → `template.evaluate()`
- その後に `.setTitle(...).addMetaTag('viewport', ...).setXFrameOptionsMode(ALLOWALL)`
- Booking.html 側にも `<meta name="viewport" ...>` が書かれているため、**viewport は二重** だが、多くのブラウザでは後勝ちで問題にならない。

**結論:** 予約ページの出し方や viewport の重複は、他 GAS と比べて特段「おかしい」構成ではない。

---

## ステップ7: まとめ（本プロジェクトが「特殊」になり得る点）

| 番号 | 項目 | 本プロジェクトの状態 | モバイル表示への影響の可能性 |
|------|------|----------------------|------------------------------|
| 1 | appsscript.json | 一般的 | 低 |
| 2 | doGet の 2 段階（LSTEP リダイレクト→予約） | 1 回目が最小 HTML | 中（1 回目の viewport 不足など） |
| 3 | リダイレクト HTML の viewport の位置 | **script の後** | 中（修正推奨） |
| 4 | **setXFrameOptionsMode(ALLOWALL)** | **全レスポンスで使用** | **高（iframe で開かれた場合に親の幅の影響）** |
| 5 | Sandbox 未指定 | デフォルト | 低 |
| 6 | 予約ページのテンプレート・viewport | 通常＋addMetaTag | 低 |

**特に疑うべきは「ステップ4: ALLOWALL」と「ステップ3: リダイレクトページの viewport の順序」。**

---

## 問題のなかった HTML（他 GAS）との比較

モバイル表示が問題なかった他プロジェクト（補助教育ポータル）の HTML と、本プロジェクトの `Booking.html` の差分です。

### head まわり

| 項目 | 問題のなかった HTML | 本プロジェクト Booking.html |
|------|---------------------|-----------------------------|
| viewport | `width=device-width, initial-scale=1.0` のみ | `width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover` |
| 追加 meta | なし | `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` |
| head 内 script | **なし**（JS はすべて body 末尾） | **あり**（viewport 再適用用のインライン script が viewport の直後） |
| head の構成 | charset → viewport → title → fonts → CSS include | charset → viewport → 各種 meta → **viewport 再適用 script** → fonts → Tailwind → Vue → Phosphor → style |
| CSS | 1 本の include（GAS の `include()`） | Tailwind CDN + インライン style |
| JS の位置 | **body 末尾のみ**（Chart.js + main-js include） | **head 内**（Tailwind, Vue, Phosphor）＋ body 内に Vue アプリ |

### 想定される違いの影響

1. **viewport がシンプル**  
   問題のなかった側は `width=device-width, initial-scale=1.0` のみ。余計な指定がない方が、一部 WebView で解釈されやすい可能性がある。

2. **head に script がない**  
   問題のなかった側は head に一切 script がなく、**viewport の直後に script が実行されない**。本プロジェクトの「viewport 再適用」のインライン script が、ごく一部の環境でレンダリング順や viewport 解釈に影響している可能性は否定できない。

3. **JS を body 末尾にまとめている**  
   問題のなかった側は JS をすべて body 末尾に配置。本プロジェクトは Vue 等の都合で head に複数 script がある。描画前に実行される script の量・順序の差が、ごく一部の WebView で影響する可能性はある。

4. **Code.gs の setXFrameOptionsMode**  
   HTML ファイル自体には現れないが、**問題のなかったプロジェクトでは ALLOWALL を付けていない可能性が高い**。その場合、iframe で開かれずフルウィンドウで開かれるため、モバイル viewport が効きやすい。本プロジェクトは ALLOWALL により iframe で開かれる経路があり得る（ステップ4参照）。

### 合わせて行った修正（Booking.html）※実施済み

- viewport を問題のなかった HTML に合わせて **`width=device-width, initial-scale=1.0` に簡略化** した。
- **viewport 再適用用のインライン script を削除** した（問題のなかった側に存在しないため）。
- **mobile-web-app-capable / apple-mobile-web-app-*** の meta を削除した（問題のなかった側にはないため）。

---

## 推奨アクション

1. **リダイレクトページ（action=lstep_webhook のときの HTML）**
   - `<meta name="viewport" ...>` を **`<script>` より前** に移動する（**実施済み**）。

2. **切り分けテスト（iframe 仮説）※実施済み**
   - **実施内容:** `handleBookingPage` の返り値だけ `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)` に変更した（他レスポンスは従来どおり ALLOWALL のまま）。
   - **結果:** **LINE 内で真っ白・何も出ない** → LINE が iframe で開こうとして X-Frame-Options でブロックされた。iframe で開かれていることが確定。
   - **対応:** 予約ページは `ALLOWALL` に戻し、シンプルページでさらに切り分け（下記3）。

3. **シンプルページでの切り分け（実施済み）**
   - **バックアップ:** `Booking.html` を `Booking.backup.html` にコピー済み。
   - **シンプルページ:** `SimpleBooking.html` を追加（viewport のみ・Vue/Tailwind なし・短文のみ）。`handleSimplePage(e)` で `?page=simple` のときこのページを返す（ALLOWALL）。
   - **確認手順:** デプロイ後、LINE から **`.../exec?page=simple`** を開く（LSTEP 経由でなくても、このURLをLINEで開いてよい）。
   - **判定:**
     - **シンプルページがモバイル表示** → 原因は本番の Booking ページの**コンテンツ・構成**（Vue/Tailwind/TimeRex 等）。Booking の簡素化や段階的削除で対策を検討。
     - **シンプルページもデスクトップ表示** → 原因は **LINE の iframe の幅**。ALLOWALL のままでは同じ挙動のため、「ブラウザで開く」案内の徹底や、LINE 側の開き方の検討が必要。

**結果:** 最もシンプルなページ（Vue/Tailwind/TimeRex なし・viewport のみ）にしても **PC 用の小さい表示** のままだった。コンテンツ要因は否定された。

---

## 考えられる要因（シンプルページでも PC 表示になった場合）

コンテンツを極限まで削ってもモバイル表示にならないため、**表示環境（誰が・どのようにページを表示しているか）に原因がある**と考えるのが自然です。

| 要因 | 説明 |
|------|------|
| **1. LINE の iframe 幅** | LINE のアプリ内ブラウザがリンクを **iframe で開いている**。親（LINE）が iframe に **デスクトップ幅（例: 980px）** を指定しているため、その中で描画される私たちのページは「幅 980px」としてレンダリングされ、スマホ画面上では縮小された「PC 用の小さいページ」のように見える。viewport の `width=device-width` は **iframe の幅** として解釈される場合があり、親が 980px を渡すとそのまま 980px になる。 |
| **2. script.google.com のラッパー** | GAS の Web アプリは **script.google.com のドメイン** で配信される。Google 側が私たちの HTML を **さらに iframe でラップ** している場合、そのラッパーが固定幅やデスクトップ向けレイアウトを持っていると、内側の viewport が効きにくい。 |
| **3. LINE の User-Agent** | LINE の WebView が **デスクトップ用 User-Agent** を送っている場合、script.google.com や中間レイヤーが「PC 向け」としてラッパーを出している可能性がある。GAS 側では UA を参照できないため、私たちの HTML は常に同じだが、**配信経路（Google のラッパー）** が UA で出し分けしている可能性。 |
| **4. 同一 URL でも「開き方」で変わる** | 問題のなかった他 GAS は、**ブックマークや直接入力** で開かれている可能性が高い。本プロジェクトは **LSTEP（LINE）経由のリンククリック** で開かれる。LINE 経由だと「アプリ内ブラウザ＋iframe」、直接だと「通常ブラウザのタブ」になり、後者はモバイル viewport が効きやすい。 |

**重要な確認:** **他の GAS プロジェクトでは同じ条件（LINE から開く等）で正しくモバイル表示された。** よって原因は「GAS 全体」や「LINE 全体」ではなく **本プロジェクト固有の設定** にある。

**想定される違い:** 本プロジェクトは **すべての HTML レスポンスに `setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)` を付けている**（LINE アプリ内ブラウザ対応のため）。他 GAS では **ALLOWALL を付けていない（デフォルト）** 可能性が高い。  
- **他 GAS（デフォルト）:** LINE が iframe で開こうとすると X-Frame-Options でブロックされる → LINE がフルウィンドウや外部ブラウザで開く → モバイル viewport が効く。  
- **本プロジェクト（ALLOWALL）:** LINE が iframe で開くことが許可される → 実際に iframe で開かれる → 親が渡す幅（例: 980px）で描画され、PC 用の小さい表示になる。

**まとめ:** 現時点で最もありそうなのは **「1. LINE の iframe 幅」**。本プロジェクトだけ **ALLOWALL** にしているため、LINE が iframe で開く対象になっており、親が渡す幅で描画される。私たちの HTML をどう変えても、**表示している「枠」が 980px 等であれば、中身はその幅でレンダリングされる**。

**取りうる対策の方向性:**
- **「ブラウザで開く」を強く案内する**（LINE 内ではなく外部ブラウザで開けば、多くの場合モバイル表示になる）。
- LINE / LSTEP 側で「リンクを外部ブラウザで開く」オプションや設定がないか確認する。
- 自前ドメイン＋Node/React 等で配信し、同一 URL でも UA や Referer でリダイレクトするなどの制御は GAS では難しいため、根本対策は「開き方」の変更か別ホスティングの検討になる。

---

4. **デバッグの継続**
   - 予約ページで `?debug=1` を付けて `window.innerWidth` などを確認し、実際の描画幅が「スマホ幅」か「980px 等」かを記録すると、原因の裏付けになる。
