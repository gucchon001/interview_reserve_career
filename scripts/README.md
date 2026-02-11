# 疎通確認スクリプト（Python）

L-step / TimeRex の API に Python からアクセスし、疎通を確認します。  
**GAS と同じトークンで試すことで、不具合が GAS 環境かネットワーク・認証か切り分けできます。**

## 前提

- Python 3.8 以上
- プロジェクトの GAS で使用している **LSTEP_API_TOKEN**（L-step 管理画面「API連携」→「認証」で取得）

## 手順

### 1. 仮想環境を作成して有効化

```powershell
cd scripts
python -m venv .venv
.venv\Scripts\activate
```

（macOS/Linux の場合は `.venv/bin/activate`）

### 2. 依存をインストール

```powershell
pip install -r requirements.txt
```

### 3. 環境変数を設定

`.env.example` をコピーして `.env` を作成し、**LSTEP_API_TOKEN** を設定します。

```powershell
copy .env.example .env
# .env を開き、LSTEP_API_TOKEN= に GAS と同じトークンを貼り付け
```

または環境変数で直接指定:

```powershell
$env:LSTEP_API_TOKEN = "ここにトークン"
```

### 4. 疎通確認を実行

```powershell
python connectivity_test.py
```

## 実行内容

| テスト | 内容 |
|--------|------|
| L-step GET | `GET https://api.lineml.jp/v1/`（Bearer トークン）。2xx または 404 で成功扱い |
| L-step トリガー(UID) | 指定 UID でトリガーURL に POST |
| L-step トリガー(friend_id) | friend_id 204179348 でトリガーURL に POST |
| TimeRex（任意） | TIMEREX_API_KEY を設定している場合のみ GET /user/me/teams |

## 切り分けの目安

- **Python で全部成功・GAS で失敗** → GAS の実行環境やリクエストの違いを疑う
- **Python でも L-step GET 失敗** → トークン・URL・ネットワークを確認
- **トリガーが UID だけ失敗** → その UID がトリガーURL の LINE 公式アカウントの友だちか確認
- **トリガーが friend_id だけ失敗** → friend_id が正しいか、同じアカウントか確認

## 注意

- `.env` は git にコミットしないでください（.gitignore で `**/.env` を除外済み）
- トークンは GAS の「スクリプトプロパティ」と同一の値を使うと比較しやすいです
