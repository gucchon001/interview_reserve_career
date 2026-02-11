# 1 Reference 8B2Ee0B99B4B0 Get Team Calendars

URL: https://developers.timerex.net/ja/api/reference/8b2ee0b99b4b0-get-team-calendars
取得日時: 2025-12-25 13:28:34
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
Get Team Calendars
get
https://timerex.net/api/beta
/teams/{team_id}/calendars
チームのカレンダーを取得します。
Get the calendars in a team.
Scopes
Name
Required
User.Teams.Read
Yes
Rate Limit
ユーザー1分あたり60リクエスト
60 requests per minute per user
Pagination
1ページあたり20件の結果
20 results per page
Request
Path Parameters
team_id
string
required
team_id or primary (for myspace)
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
Team calendar list
Body
application/json
application/json
responses
/
200
items
array[object]
required
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
array[object]
>= 1 items
Parameters
team_id*
:
Authorization*
:
Send API Request
Request Sample: Shell / cURL
curl
--request GET
\
--url https://timerex.net/api/beta/teams/
{
team_id
}
/calendars
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
"nextPageToken"
:
"99059fc6dd8b"
,
3
"items"
:
[
4
{
5
"id"
:
"b0c2a75fb3c82d050b9a"
,
6
"team_id"
:
"58a3586d7a3f6345698b"
,
7
"name"
:
"60 minute calendar"
,
8
"url"
:
"https://timerex.net/s/mixtend/demo"
,
9
"duration"
:
60
,
10
"pre_travel_time"
:
30
,
11
"post_travel_time"
:
30
,
12
"online_meeting_provider"
:
"zoom"
,
13
"type"
:
"and"
,
14
"members"
:
[
15
{
16
"id"
:
"ac75a81610af3315da2a"
,
17
"name"
:
"User A"
,
18
"is_self"
:
true
19
}
,
20
{
21
"id"
:
"fc97ebb1804139d7c84b"
,
22
"name"
:
"User B"
,
23
"is_self"
:
false
24
}
25
]
26
}
27
]
28
}
