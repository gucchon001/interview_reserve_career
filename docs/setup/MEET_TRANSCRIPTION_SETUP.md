# Google Meet 文字起こしを予約ごとに自動オンにする設定

TimeRex で Google Meet を利用している場合、予約確定時に **Meet API** でその会議の「文字起こし（トランスクリプト）を自動でオン」にできます。  
組織でドメイン全体の委任が設定済みであることが前提です。

## 前提

- Google Workspace 管理者が **ドメイン全体の委任** をサービスアカウントに設定済みであること  
  （クライアント ID とスコープ `https://www.googleapis.com/auth/meetings.space.settings` の追加）
- 対象の Meet が **Google Meet**（Zoom/Teams ではない）であること

## GAS のスクリプトプロパティ

次の2つを **スクリプトのプロパティ** に設定します。

| キー | 値 | 説明 |
|------|-----|------|
| `MEET_SA_CLIENT_EMAIL` | サービスアカウントのメール（例: `xxx@yyy.iam.gserviceaccount.com`） | Meet API 用サービスアカウントの **client_email** |
| `MEET_SA_PRIVATE_KEY` | PEM 形式の秘密鍵 | 同じサービスアカウントの **private_key**（JSON 鍵の `private_key` フィールド） |

### private_key の設定のしかた

1. GCP コンソールで該当サービスアカウントの **鍵** を追加し、JSON をダウンロードする。
2. JSON 内の `private_key` の値（`-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`）をコピーする。
3. スクリプトのプロパティ `MEET_SA_PRIVATE_KEY` にそのまま貼り付ける。  
   - 改行は **実際の改行** のままでも、**`\n`** という2文字のままでもどちらでもよい（コード側で `\n` を改行に置換している）。

### 設定手順（GAS エディタ）

1. プロジェクトを開く → **プロジェクトの設定**（歯車アイコン）
2. **スクリプトのプロパティ** で「プロパティを追加」をクリック
3. 上記のキーと値を追加して保存

## 動作

- **event_confirmed**（予約確定）の Webhook 受信時、`event.google_meet_meeting.join_url` がある場合にだけ処理する。
- `event.hosts[0].email` を主催者として、そのユーザーになりすまして Meet API を呼ぶ。
- Meet の space を GET で取得し、`config.artifactConfig.transcriptionConfig.autoTranscriptionGeneration: "ON"` で PATCH する。
- `MEET_SA_CLIENT_EMAIL` または `MEET_SA_PRIVATE_KEY` が未設定の場合は **何も呼ばずにスキップ** する（エラーにはならない）。

## 組織で一括にしたい場合

予定ごとに API でオンにせず、**すべての Meet で文字起こしをデフォルトにしたい** 場合は、Google 管理コンソールで設定する方法の方が簡単です。

1. [Google 管理コンソール](https://admin.google.com/) → **アプリ** → **Google Workspace** → **Google Meet**
2. **Meet の動画設定** を開く
3. **自動文字起こし（Automatic transcription）** を「オン」にする

この場合、GAS の `MEET_SA_*` は不要です。
