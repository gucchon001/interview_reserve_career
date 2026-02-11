# 1 Reference 085D9722Edb57 Push Notifications

URL: https://developers.timerex.net/ja/api/reference/085d9722edb57-push-notifications
取得日時: 2025-12-25 13:27:22
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
Push-Notifications
この記事は日本語でもご覧いただけます。
You can subscribe to push notifications using
/watch
endpoints for supported resource types.
Handling push notification
On receiving a push notification you must return a
20x
response as soon as possible. If a 20x response is not received the push notification will be retried two more times.
Troubleshooting
If you are unable to receive push notifications, ensure the following
The url is accessible from the internet
You have a valid SSL certificate
localhost and ngrok url's are not supported
