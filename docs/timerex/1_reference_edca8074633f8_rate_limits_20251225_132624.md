# 1 Reference Edca8074633F8 Rate Limits

URL: https://developers.timerex.net/ja/api/reference/edca8074633f8-rate-limits
取得日時: 2025-12-25 13:27:32
深さ: 1

---

APIキーによる認証
Authorization with OAuth
Authorization with API Key
OAuthによる承認
Pagination
Postman Collection
Push-Notifications
Rate Limits
プッシュ通知
ページネーション
レート制限
APIS
TimeRex
Get User Information
get
Get User Primary Team
get
Get User Teams
get
Get Team
get
Get Event
get
Get Team Calendars
get
Get Calendar Events
get
Get Calendar
get
Get One time URL
get
Cancel Event
post
Create One Time URL
post
Watch One Time URL
post
Schemas
powered by
Stoplight
Rate Limits
この記事は日本語でもご覧いただけます。
When your app exceeds the rate limits for API usage your requests may be throttled. In this case a
429
HTTP status code will be returned. On receiving a 429 response you should retry your request after waiting a period of time (for example 10 seconds, 30 seconds etc).
