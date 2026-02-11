# 1 Reference 5C516612E8E29 Watch One Time Url

URL: https://developers.timerex.net/ja/api/reference/5c516612e8e29-watch-one-time-url
取得日時: 2025-12-25 13:29:04
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
Watch One Time URL
post
https://timerex.net/api/beta
/calendars/one-time-url/{one_time_url_id}/watch
更新については、ワンタイムURLをご覧ください。
Watch for updates for One-time URL.
Scopes
Name
Required
User.Teams.Calendars.ReadWrite
Yes
Rate Limit
ユーザー1分あたり60リクエスト
ユーザー24時間あたり1000リクエスト
60 requests per minute per user
1000 requests per 24 hours per user
Push Notification
HTTP Method
POST
Format
application/json
Sample (Event confirmed)
{
"token"
:
"xhjisop335"
,
"status"
:
"confirmed"
"one_time_url"
:
{
"id"
:
"d1160c9b34414614b998"
,
"url"
:
"https://timerex.net/s/test_url"
}
}
Sample (Event cancelled)
{
"token"
:
"xhjisop335"
,
"status"
:
"cancelled"
"one_time_url"
:
{
"id"
:
"d1160c9b34414614b998"
,
"url"
:
"https://timerex.net/s/test_url"
}
}
Request
Path Parameters
one_time_url_id
string
required
The One Time URL id to create a watch notification
Headers
Authorization
string
required
Bearer token
Example:
Bearer {access_token}
Body
application/json
application/json
Param
Description
token
A token to identify this notification
notification_url
The endpoint where push notifications are send to (SSL only)
Example:
{
"token"
:
"xhjisop335"
,
"notification_url"
:
"https://third-party-app.com/timerex/watch"
}
Responses
201
400
401
403
404
429
Created
Body
application/json
application/json
responses
/
201
Parameters
one_time_url_id*
:
Authorization*
:
Body
{}
1
{
}
Send API Request
Request Sample: Shell / cURL
curl
--request POST
\
--url https://timerex.net/api/beta/calendars/one-time-url/
{
one_time_url_id
}
/watch
\
--header
'Accept: application/json'
\
--header
'Authorization: '
\
--header
'Content-Type: application/json'
\
--data
'{}'
Response Example
1
[
]
