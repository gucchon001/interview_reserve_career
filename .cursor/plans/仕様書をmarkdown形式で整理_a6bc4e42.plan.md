---
name: 仕様書をMarkdown形式で整理
overview: spec.mdの重複を削除し、Markdown標準テーブル形式に変換して構造を整理します。詳細な章立ても追加します。
todos:
  - id: remove_duplicate
    content: 172行目以降の重複内容を削除
    status: completed
  - id: format_structure
    content: 見出し階層と構造を整理
    status: completed
    dependencies:
      - remove_duplicate
  - id: convert_tables
    content: テーブルをMarkdown標準形式に変換
    status: completed
    dependencies:
      - format_structure
  - id: format_content
    content: コードブロック、リスト、URL等を適切にフォーマット
    status: completed
    dependencies:
      - convert_tables
  - id: add_sections
    content: Webhook仕様、エラーハンドリング、セキュリティの章を追加
    status: completed
    dependencies:
      - format_content
---

# spec.md の整理計画

## 実行内容

### 1. 重複削除

- 172行目以降の重複内容を削除

### 2. 構造の整理

- 見出し階層を明確化（`#`, `##`, `###`を使用）
- セクション間に適切な空行を設定

### 3. テーブルの変換

- `interviewers`シートのテーブルをMarkdown標準形式に変換
- `interviews`シートのテーブルもMarkdown標準形式に変換
- 列番号（A, B, C等）は説明として含める

### 4. 内容の改善

- 業務フローを箇条書きで明確化
- コードブロック（`CalendarApp.getCalendarById`等）を適切にフォーマット
- URLをコードブロックで表示

### 5. 詳細セクションの追加

以下の章を追加して拡張可能な構造にする：

- Webhook仕様（概要）
- エラーハンドリング方針（概要）
- セキュリティ考慮事項（概要）

## 変更ファイル

- `spec.md` - 完全に再構成

## 最終的な構造

```markdown
# ZLOSS代替（日程調整システム）GAS版 設計書 v3.0

## 1. プロジェクト概要

## 2. 業務フロー (To-Be)
### 2.1 予約URLの送付 (自動予約)
### 2.2 手動登録 (代理登録)

## 3. データベース設計 (Google Spreadsheet)
### 3.1 interviewers (設定マスタ)
### 3.2 interviews (予約台帳)

## 4. Google Calendar連携仕様
### 4.1 自動予約 (TimeRex → Google Calendar)
### 4.2 手動予約 (GAS → Google Calendar)

## 5. Webhook仕様
### 5.1 TimeRexからのWebhook受信
### 5.2 データ処理フロー

## 6. エラーハンドリング
### 6.1 カレンダー連携エラー
### 6.2 スプレッドシートエラー

## 7. セキュリティ考慮事項

## 8. 拡張性



```