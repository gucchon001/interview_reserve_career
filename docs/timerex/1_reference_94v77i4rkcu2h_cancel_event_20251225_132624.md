# 1 Reference 94V77I4Rkcu2H Cancel Event

URL: https://developers.timerex.net/ja/api/reference/94v77i4rkcu2h-cancel-event
取得日時: 2025-12-25 13:28:51
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
Cancel Event
post
https://timerex.net/api/beta
/events/{event_id}/cancel
このイベントをキャンセルします。
Cancel an event.
Scopes
Name
Required
User.Teams.Calendars.ReadWrite
Yes
Rate Limit
ユーザー1時間あたり100リクエスト
100 requests per hour per user
Request
Path Parameters
event_id
string
required
Headers
Authorization
string
required
Bearer token
Example:
Bearer {access_token}
Responses
200
400
401
403
404
429
Canceled
Parameters
event_id*
:
Authorization*
:
Send API Request
Request Sample: Shell / cURL
curl
--request POST
\
--url https://timerex.net/api/beta/events/
{
event_id
}
/cancel
\
--header
'Accept: application/json'
\
--header
'Authorization: '
\
--header
'Content-Type: application/json'
