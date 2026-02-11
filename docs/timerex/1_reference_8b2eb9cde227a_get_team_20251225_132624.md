# 1 Reference 8B2Eb9Cde227A Get Team

URL: https://developers.timerex.net/ja/api/reference/8b2eb9cde227a-get-team
取得日時: 2025-12-25 13:28:21
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
Get Team
get
https://timerex.net/api/beta
/teams/{team_id}
チームを取得します。
Get a team.
Scopes
Name
Required
User.Teams.Read
Yes
Rate Limit
ユーザー1分あたり60リクエスト
60 requests per minute per user
Request
Path Parameters
team_id
string
required
Unique id of team
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
Team Found
Body
application/json
application/json
responses
/
200
id
string
required
name
string
required
url_path
string
required
url_path is an unique identifier for the TimeRex calendar page.
Show all...
is_primary
boolean
required
role
string
required
Possible values
Show all...
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
"ac75a81610af3315da22"
,
3
"name"
:
"My space"
,
4
"url_path"
:
"my_space"
,
5
"is_primary"
:
true
,
6
"role"
:
"owner"
7
}
