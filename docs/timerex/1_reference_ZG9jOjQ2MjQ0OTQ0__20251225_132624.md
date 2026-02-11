# 1 Reference Zg9Jojq2Mjq0Otq0 

URL: https://developers.timerex.net/ja/api/reference/ZG9jOjQ2MjQ0OTQ0-
取得日時: 2025-12-25 13:27:47
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
ページネーション
すべてのリクエスト結果を返すことができない場合、
nextPageToken
トークンパラメータがレスポンスで返されます。 これは、結果をページングするために使用できます。
次のページの結果を取得するには、クエリパラメータとして
nextPageToken
を追加します。
例:
GET https://timerex.net/api/beta/users/me/teams?nextPageToken=<token>
