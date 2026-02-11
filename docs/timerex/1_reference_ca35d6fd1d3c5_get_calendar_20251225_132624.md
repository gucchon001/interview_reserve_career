# 1 Reference Ca35D6Fd1D3C5 Get Calendar

URL: https://developers.timerex.net/ja/api/reference/ca35d6fd1d3c5-get-calendar
取得日時: 2025-12-25 13:28:42
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
Get Calendar
get
https://timerex.net/api/beta
/calendars/{calendar_id}
カレンダーを取得します。
Get a calendar.
Scopes
Name
Required
User.Teams.Calendars.Read
Yes
Rate Limit
ユーザー1分あたり60リクエスト
60 requests per minute per user
Request
Path Parameters
calendar_id
string
required
Unique id of the calendar
Headers
Authorization
string
required
bearer token
Example:
Bearer {access_token}
Responses
200
400
401
403
404
429
Calendar Found
Body
application/json
application/json
responses
/
200
id
string
required
team_id
string
required
name
string
required
url
string
required
duration
number
required
pre_travel_time
number
required
post_travel_time
number
required
online_meeting_provider
string
required
type
string
required
members
object
required
id
string
required
name
string
required
is_self
boolean
required
group_number
number
Parameters
calendar_id*
:
Authorization*
:
Send API Request
Request Sample: Shell / cURL
curl
--request GET
\
--url https://timerex.net/api/beta/calendars/
{
calendar_id
}
\
--header
'Accept: application/json'
\
--header
'Authorization: '
Response Example
1
{
2
"id"
:
"b0c2a75fb3c82d050b9a"
,
3
"team_id"
:
"58a3586d7a3f6345696b"
,
4
"name"
:
"60 minute calendar"
,
5
"url"
:
"https://timerex.net/s/mixtend/demo"
,
6
"duration"
:
60
,
7
"pre_travel_time"
:
30
,
8
"post_travel_time"
:
30
,
9
"online_meeting_provider"
:
"zoom"
,
10
"type"
:
"and"
,
11
"members"
:
{
12
"id"
:
"fc97ebb1804139d7c842"
,
13
"name"
:
"User A"
,
14
"is_self"
:
true
,
15
"group_number"
:
null
16
}
17
}
