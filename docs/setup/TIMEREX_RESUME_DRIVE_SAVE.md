# TimeRexフォームの履歴書・職務経歴書をGoogle Driveに保存する

## 現状の整理（会議メモ・仕様より）

- **TimeRexの予約フォーム**では、設問項目カスタマイズ（プレミアムプラン）で**ファイルアップロード**を追加でき、履歴書・職務経歴書などを収集できる。
- **現状の届き方:** 予約時にアップロードされた履歴書は**PDFとしてGmailに届く**（TimeRexからの通知メールに添付）。
- **制約:** 「タイムレックスのURLから履歴書を直接取得することはできない」「メールからダウンロードは可能」という運用確認がある。
- **スプレッドシート（interviews）:** 現在は `guest_name` / `guest_email` / `meet_url` などを保持しており、**履歴書・職務経歴書のURLやファイルIDは保存していない**。

---

## 実現の可否と方針

**「TimeRexフォームで取得した履歴書・職務経歴書を、スプレッドシートを介してGoogle Driveに保存する」ことは、次のいずれかの方法で実現可能です。**

---

## 方法1: Webhookの form にファイルURLが含まれる場合（要確認）

TimeRexのWebhookで、フォーム項目の種別が「ファイルアップロード」のとき、`event.form[]` の `value` に**ファイルのダウンロードURL**が入る仕様であれば、GAS側で以下が可能です。

1. **Webhook受信時（`WebhookHandler.handleEventConfirmed` 内など）**
   - `event.form` を走査し、`field_type` がファイル系（例: `file` やカスタム項目ID）かつ `value` がURLの項目を取得。
   - `UrlFetchApp.fetch(value)` でファイルを取得。
   - `DriveApp.getFolderById(フォルダID).createFile(blob)` でGoogle Driveに保存（ファイル名は `event_id` や `guest_name` などを含めるとよい）。
   - （任意）interviews シートに列を追加し、**DriveのファイルIDやURL**を保存。例: `resume_drive_file_id` / `resume_drive_url`。

2. **スプレッドシートの役割**
   - 予約レコード（interviews）に「この予約に紐づく履歴書のDrive ID」を書いておくことで、「スプレッドシートの行からDriveのファイルを参照する」形にできる。
   - 既存の `event_id` があれば、その行に対応するDriveファイルを一意に紐づけられる。

**事前に確認すること:**  
TimeRexのWebhook/API仕様で、ファイルアップロード項目の `value` にURL（またはダウンロード用リンク）が含まれるか、開発者向けドキュメントまたは実際のWebhookペイロードで確認する。

---

## 方法2: Gmail経由で添付ファイルを取得しDriveに保存する

「TimeRexのURLからは直接取得できない」という前提であれば、**Gmailに届く通知メールの添付ファイル**をGASで取りにいく方法です。

1. **GASでGmailを検索**
   - 差出人: TimeRex 通知メールのアドレス（要確認）
   - または件名・ラベルで「TimeRex」「予約確定」などを指定。
   - 本文に `guest_email` や予約日時が含まれていれば、その内容で interviews の行と照合可能。

2. **添付ファイルの取得とDrive保存**
   - `GmailApp` でメールを取得し、`getAttachments()` でPDFを取得。
   - `DriveApp.getFolderById(フォルダID).createFile(attachment)` でDriveに保存。
   - メール本文や件名から `guest_email` / 日時を抽出し、interviews の該当行を特定して、その行に **DriveのファイルIDを書き込む列**（例: `resume_drive_file_id`）を追加しておく。

3. **スプレッドシートの役割**
   - 予約一覧（interviews）の「どの行にどのDriveファイルが紐づいているか」を `resume_drive_file_id` 等で管理できる。
   - 「スプレッドシートで取得してDriveに保存」は、「interviews の行（または event_id）をキーに、Gmailから取得→Drive保存→その行にIDを記録」という流れで実現できる。

**注意点**
   - TimeRexの通知メールの形式（件名・本文・添付の有無）に依存する。
   - 1予約1通と限らない場合や、複数添付の場合は、ルール（例: 最初のPDFを履歴書とする）を決める必要がある。
   - Gmail APIの利用制限・検索の安定性に注意。

---

## 方法3: TimeRex Get Event API でイベント詳細を取得する場合

Webhookの `event.form` にファイルURLが含まれない場合でも、**Get Event API**（`GET /api/beta/events/{event_id}`）のレスポンスの `form` に、ファイル項目のURLが含まれる仕様であれば、次のような流れが考えられます。

1. **定期実行またはWebhook受信後**
   - interviews に保存済みの `event_id` を使って、TimeRexの Get Event API を呼ぶ。
   - レスポンスの `event.form` のうち、ファイルアップロード項目の `value`（URL）を取得。
   - そのURLを `UrlFetchApp` で取得し、Driveに保存。
   - 取得したDriveファイルIDを、interviews の該当行（`event_id` で特定）に書き込む。

この場合も、「スプレッドシートの event_id を元にAPIで取得→Drive保存→同じ行にDrive IDを保存」という意味で「スプレッドシートで取得してDriveに保存」を実現できます。

---

## 推奨する進め方

1. **TimeRexの仕様確認**
   - ファイルアップロード項目を1つ用意し、テスト予約でWebhookペイロードと Get Event API のレスポンスを確認する。
   - `form` 内の当該項目の `field_type` と `value`（URLの有無・形式）をメモする。

2. **value にURLがある場合**
   - **方法1**（Webhook受信時にURL取得→Drive保存→シートにID保存）を実装するのがシンプル。
   - interviews に列を追加（例: `resume_drive_file_id`, `resume_drive_url`）し、同一予約で複数ファイルがある場合は別シートや「カンマ区切り」など運用で調整。

3. **value にURLがない場合**
   - **方法2**（Gmailから添付を取得→Drive保存→interviews にID保存）を検討する。
   - TimeRexの通知メールの形式を確認し、差出人・件名・本文で検索し、添付PDFを1:1で interviews の行に紐づけるルールを決める。

4. **Driveの保存先**
   - スクリプトプロパティまたは Config で「履歴書保存用フォルダID」を保持し、`DriveApp.getFolderById(...).createFile(...)` で保存する。
   - ファイル名は `{event_id}_{guest_name}_履歴書.pdf` のようにすると、後から見つけやすい。

---

## まとめ

| 質問 | 回答 |
|------|------|
| TimeRexフォームの履歴書・職務経歴書をスプレッドシートで取得してDriveに保存できるか | **できる。** Webhookの form にファイルURLが出るならWebhook処理で保存、出ない場合はGmailの添付をGASで取得してDriveに保存し、いずれもinterviewsにDriveファイルIDを保存する形で「スプレッドシートで参照」可能。 |
| スプレッドシートだけで完結するか | いいえ。**ファイル実体はWebhook経由かGmail経由で取得**する必要がある。スプレッドシートは「予約行とDriveファイルの対応」を保持する役割。 |
| まず何を確認すべきか | TimeRexのWebhook/Get Eventの `event.form` で、ファイルアップロード項目の `value` にURLが含まれるかどうか。 |

---

## 関連ドキュメント

- [docs/spec.md](../spec.md) — interviews シート構成、Webhook処理
- [docs/timerex/2_reference_c2NoOjIxMDY4NTQy_form_field_20251225_132624.md](../timerex/2_reference_c2NoOjIxMDY4NTQy_form_field_20251225_132624.md) — TimeRex FormField スキーマ（value は string または array）
- 会議メモ（2026-02-24）: 履歴書はGmailに届く、TimeRexのURLからは直接取得できない、ポーターズへの自動反映が理想
