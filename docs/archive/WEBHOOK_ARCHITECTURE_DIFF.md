# Webhook アーキテクチャ比較：動作するプロジェクト vs 現在の L-step 連携

## 1. 結論：決定的な差分

| 観点 | 動作するプロジェクト (WEBHOOK_ARCHITECTURE.md) | 現在の L-step 連携（うまくいっていない） |
|------|-----------------------------------------------|----------------------------------------|
| **Webhook の入口** | `doPost` のみ | `doGet` と `doPost` の両方 |
| **ボタン種別** | **postback**（ポストバック） | **URI**（URIアクション） |
| **リクエスト元** | LINE Platform → 直接 POST | ① L-step → POST（Webhook転送）<br>② ユーザー browser → GET（URI を開く） |
| **ユーザーが見るレスポンス** | なし（サーバー間のみ） | GET のレスポンス（＝エラーページ） |

---

## 2. 動作するプロジェクトの流れ

```
【LINE → GAS の 1 本の流れ】

LINE Platform（postback ボタンタップ）
    │
    │ POST（event.type === 'postback'、events[0].source.userId 含む）
    ▼
GAS doPost(e)
    │
    ├─ event をパース
    ├─ userId を events[0].source.userId から取得
    └─ EventHandlers.handlePostback()
           └─ 必要に応じて replyToLine() / pushToLine() で LINE API を呼ぶ
```

- **postback**：ボタンタップ時に LINE が Webhook URL に POST を送る
- ユーザーのブラウザは関与しない
- 全てサーバー間通信（LINE → GAS）

---

## 3. 現在の L-step 連携の流れ（問題がある状態）

```
【2 本の独立したリクエスト】

① L-step（Webhook転送）
   LINE イベント受信 → 設定 URL に POST
       │
       ▼
   GAS doPost(e)  ← UID あり、リダイレクト HTML を返す
       │
       └─ レスポンスは L-step サーバーに返る（ユーザーには届かない）

② ユーザーのブラウザ（URI ボタンタップ）
   LINE が URI を開く → その URL へ GET
       │
       ▼
   GAS doGet(e)  ← POST ボディなし、UID 取得不可
       │
       └─ レスポンスがユーザー画面に表示される（＝「UID取得に失敗しました」）
```

- **URI ボタン**：タップで「その URL をブラウザで開く」
- ① POST：L-step から GAS へ（UID あり）→ リダイレクト HTML は L-step が受け取る
- ② GET：ユーザーブラウザから GAS へ（UID なし）→ ユーザーはこのレスポンスを見る

結果として、ユーザーには常に GET のレスポンス（エラーページ）が表示される。

---

## 4. アーキテクチャ上の差分

### 4.1 ボタン種別

| 種別 | 動作 | 送信元 | データ |
|------|------|--------|--------|
| **postback** | タップ時に Webhook へ POST | LINE → Webhook URL | `events[0].source.userId` 等を含む |
| **URI** | タップ時に指定 URL をブラウザで開く | ユーザー browser → URL | GET のみ、ボディなし |

動作するプロジェクトは **postback** を使い、LINE からの POST だけで完結している。

### 4.2 リクエスト・レスポンスの対応

| プロジェクト | リクエスト | レスポンスの行き先 |
|--------------|------------|--------------------|
| 動作する | LINE → doPost（1 回） | LINE（通常は 200 のみ） |
| 現在の L-step | L-step → doPost（1 回）<br>ブラウザ → doGet（1 回） | POST のレスポンス → L-step<br>GET のレスポンス → ユーザー画面 |

ユーザーが実際に見るのは **doGet のレスポンス** のため、UID が取れずエラーになる。

---

## 5. 解決の方向性

### 案 A: postback に切り替える（推奨）

1. ボタンを **postback** に変更
2. L-step の Webhook転送で、postback イベントも GAS の URL に POST されるようにする
3. GAS で POST を受信 → UID 取得 → セッション作成
4. ユーザーへ予約ページへのリンクを LINE で送る（LINE API 使用）
   - `pushToLine(userId, 予約URL)` のような形
5. ユーザーがそのリンクをタップ → ブラウザで開く（GET、`session_id` 付き）→ 予約画面表示

**前提**：L-step が postback イベントを Webhook転送していること、および GAS から LINE API を呼べること（チャネルアクセストークンや L-step の API など）。

### 案 B: L-step の仕様確認

- Webhook転送の POST レスポンスを、ユーザーのブラウザにそのまま返す仕様かどうか
- URI ボタンで「リンクを開く」と「Webhook転送」が同じ操作として扱われ、そのレスポンスをユーザーに見せる仕様かどうか

L-step のドキュメントやサポートで確認が必要。

### 案 C: GET と POST の受け取り方を変える（応急策）

- POST で UID 取得 → セッション作成
- GET のとき、POST と同時刻付近のリクエストとみなし、`interviewer_id` 等で最近のセッションを探して紐付ける  
  → タイミング依存が強く、推奨はしにくい

---

## 6. まとめ

| 差分 | 内容 |
|------|------|
| **ボタン** | 動作プロジェクトは **postback**、L-step 連携は **URI** |
| **入口** | 動作プロジェクトは **doPost のみ**、L-step 連携は **doGet + doPost** |
| **表示** | 動作プロジェクトはユーザーにレスポンスを直接返さない、L-step 連携は **GET のレスポンス**がユーザー画面に出る |

**本質**：URI ボタンだと「ブラウザで開く GET」と「Webhook転送の POST」が分かれており、ユーザーには常に GET のレスポンスが表示される。その GET には UID が含まれないため、エラーになる。  
動作するプロジェクトと同じパターンにするには、**postback ボタンと LINE API によるリンク送信**が自然な解決策となる。
