# 1 Reference Wggd2Aqhlotdc Create One Time Url

URL: https://developers.timerex.net/ja/api/reference/wggd2aqhlotdc-create-one-time-url
取得日時: 2025-12-25 13:29:01
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
Create One Time URL
post
https://timerex.net/api/beta
/calendars/{calendar_id}/one-time-url
このカレンダーの新しいワンタイムURLを作成します。
Create One-time URL for this calendar.
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
calendar_id
string
required
The id of the calendar used to create a new One Time URL
Headers
Authorization
string
required
Bearer token
Example:
Bearer {access_token}
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
id
string
required
The unique identifier for the One Time URL
url
string
required
The One Time URL
status
string
required
The status of the One Time URL. Possible values
Show all...
event
any
null
Parameters
calendar_id*
:
Authorization*
:
Send API Request
Request Sample: Shell / cURL
curl
--request POST
\
--url https://timerex.net/api/beta/calendars/
{
calendar_id
}
/one-time-url
\
--header
'Accept: application/json'
\
--header
'Authorization: '
\
--header
'Content-Type: application/json'
Response Example
1
{
2
"id"
:
"3430d457288bc8f8f819"
,
3
"url"
:
"https://timerex.net/s/testurl"
,
4
"status"
:
"pending"
,
5
"event"
:
null
6
}
