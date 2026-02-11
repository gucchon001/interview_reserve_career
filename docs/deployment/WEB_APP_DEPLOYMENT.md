# Webアプリ公開手順

## 問題: 「リクエストされたファイルは存在しません」エラー

このエラーは、GASプロジェクトがWebアプリとして公開されていない場合に発生します。

## 解決手順

### 1. 最新のコードをアップロード

```bash
clasp push
```

### 2. GASエディタでWebアプリとして公開

1. GASエディタを開く
   ```bash
   clasp open
   ```
   または、ブラウザで直接開く:
   https://script.google.com/home/projects/1LFzDp_ueGQSwZKVH2MzwjQG1jbrcPuVA1S_JDVMGIQru4-DnX0zFHG8z/edit

2. **公開 > ウェブアプリとして導入** をクリック

3. 設定を以下のように変更:
   - **実行ユーザー**: 「自分」を選択
   - **アクセスできるユーザー**: 「全員」または「組織内の全員」を選択
   - **最新のコードを使用**: チェックを入れる

4. **導入** ボタンをクリック

5. **承認が必要です** ダイアログが表示されたら:
   - **権限を確認** をクリック
   - Googleアカウントを選択
   - **許可** をクリック

6. **WebアプリのURL** が表示されます
   - このURLをコピーして使用してください

### 3. アクセスURL

公開後、デプロイ管理画面に表示されるWebアプリURLを使用してください。

#### Google Workspace組織の場合

- **予約画面**: `https://script.google.com/a/macros/{domain}/s/{DEPLOYMENT_ID}/exec?uid=U1234567890abcdef`
- **管理画面**: `https://script.google.com/a/macros/{domain}/s/{DEPLOYMENT_ID}/exec?page=admin`

**例（tomonokai-corp.comの場合）:**
- 予約画面: `https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycbyBpo5szArOB5Zd2bviSQDzKz-rpOzIB0D19PiMbF8tI_Kmq_zr5RWpcFP3DOLF791SDQ/exec?uid=U1234567890abcdef`
- 管理画面: `https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycbyBpo5szArOB5Zd2bviSQDzKz-rpOzIB0D19PiMbF8tI_Kmq_zr5RWpcFP3DOLF791SDQ/exec?page=admin`

#### 通常のGoogleアカウントの場合

- **予約画面**: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?uid=U1234567890abcdef`
- **管理画面**: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?page=admin`

## 注意事項

- コードを変更した場合は、再度 **公開 > ウェブアプリとして導入** を実行する必要があります
- 「最新のコードを使用」にチェックを入れると、コード変更が自動的に反映されます（再公開不要）
- 初回公開時のみ承認が必要です

## トラブルシューティング

### エラー: 「リクエストされたファイルは存在しません」

1. `clasp push` が正常に完了したか確認
2. GASエディタで `Booking.html` ファイルが存在するか確認
3. Webアプリとして公開されているか確認

### エラー: 「このアプリは確認されていません」

- 初回公開時は「詳細」→「（プロジェクト名）に移動」をクリックして承認してください

