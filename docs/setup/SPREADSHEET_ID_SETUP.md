# スプレッドシートID設定ガイド

## 概要

Webアプリとしてデプロイした場合、`getActiveSpreadsheet()`は使用できません。そのため、`SPREADSHEET_ID`をスクリプトプロパティに設定する必要があります。

## スプレッドシートIDの取得方法

### 方法1: URLから取得（推奨）

1. スプレッドシートを開く
2. ブラウザのアドレスバーからURLを確認
3. URLの形式：
   ```
   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
   ```
4. `{SPREADSHEET_ID}`の部分をコピー

**例:**
```
URL: https://docs.google.com/spreadsheets/d/1B3veDjAYnEP42XR2nxRa-TLDR8XaQ1xtx4BKxV6AZoA/edit
ID: 1B3veDjAYnEP42XR2nxRa-TLDR8XaQ1xtx4BKxV6AZoA
```

### 方法2: スプレッドシートの設定から取得

1. スプレッドシートを開く
2. **ファイル** > **共有** > **リンクを取得** をクリック
3. リンクに含まれるIDを確認

## 設定方法

### 方法1: GASエディタのUIから設定（推奨）

1. GASエディタを開く
2. **プロジェクトの設定**（歯車アイコン）をクリック
3. **スクリプトプロパティ** セクションで以下を追加：

| プロパティキー | 値 | 説明 |
|--------------|-----|------|
| `SPREADSHEET_ID` | `スプレッドシートID` | スプレッドシートのID |

### 方法2: スクリプト関数から設定

GASエディタで以下の関数を実行：

```javascript
function setSpreadsheetId() {
  const spreadsheetId = '1B3veDjAYnEP42XR2nxRa-TLDR8XaQ1xtx4BKxV6AZoA'; // ここに実際のIDを貼り付け
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);
  Logger.log('Spreadsheet ID set successfully: ' + spreadsheetId);
}
```

### 方法3: setScriptProperties関数を使用

```javascript
setScriptProperties({
  SPREADSHEET_ID: '1B3veDjAYnEP42XR2nxRa-TLDR8XaQ1xtx4BKxV6AZoA'
});
```

## 設定確認

以下の関数を実行して、設定が正しいか確認できます：

```javascript
function checkSpreadsheetId() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (spreadsheetId) {
    Logger.log('✓ SPREADSHEET_ID is set: ' + spreadsheetId);
    try {
      const ss = SpreadsheetApp.openById(spreadsheetId);
      Logger.log('✓ Spreadsheet access successful: ' + ss.getName());
      return { success: true, spreadsheetId: spreadsheetId, name: ss.getName() };
    } catch (e) {
      Logger.log('✗ Spreadsheet access failed: ' + e.toString());
      Logger.log('  → Check if you have access to the spreadsheet');
      Logger.log('  → Check if the spreadsheet ID is correct');
      return { success: false, error: e.toString() };
    }
  } else {
    Logger.log('✗ SPREADSHEET_ID is not set');
    Logger.log('  → Set it using one of the methods above');
    return { success: false, error: 'SPREADSHEET_ID not set' };
  }
}
```

## トラブルシューティング

### エラー: "SpreadsheetApp.openById を呼び出す権限がありません"

**原因:**
- スプレッドシートへのアクセス権限がない
- スプレッドシートIDが間違っている

**解決方法:**
1. スプレッドシートを開いて、アクセス権限があるか確認
2. スプレッドシートIDが正しいか確認（URLから再取得）
3. スプレッドシートの共有設定を確認（少なくとも「閲覧者」以上の権限が必要）

### エラー: "SpreadsheetApp.getActiveSpreadsheet を呼び出す権限がありません"

**原因:**
- Webアプリとしてデプロイした場合、`getActiveSpreadsheet()`は使用できない
- `SPREADSHEET_ID`が設定されていない

**解決方法:**
- `SPREADSHEET_ID`をスクリプトプロパティに設定する（上記の手順を参照）

## 注意事項

- `SPREADSHEET_ID`は、スプレッドシートのURLに含まれるIDです
- スプレッドシートへのアクセス権限が必要です
- Webアプリとしてデプロイする場合は、必ず`SPREADSHEET_ID`を設定してください

