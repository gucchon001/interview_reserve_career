# 1 Reference 86Cyex2Iwt9Fj Authorization With Api Key

URL: https://developers.timerex.net/ja/api/reference/86cyex2iwt9fj-authorization-with-api-key
取得日時: 2025-12-25 13:27:07
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
Authorization with API Key
When using the TimeRex API, in addition to OAuth authentication, there is also an authentication method using an API key.
Create API key
Log in to TimeRex.
Create an API key from Dashboard > Team Settings > Developer Tools > TimeRex API
3. Please copy and use the created API key
※ API key specifications: 64 digits half-width alphanumeric characters
How to use API key
When using the TimeRex API, set "x-api-key" in the request header and send request.
Header Name
Value
x-api-key
API key
Example
curl -i -X GET \
-H "x-api-key:2Hy3qF4HFmYxqPlkkGfILhQ2Ps3mcQqvHnwxxxxxxxxxxxxxxxxxxxxxx" \
'https://timerex.net/api/beta/user/me/teams'
APIs available for authentication using API key
API Name
PATH
Available
Response
Get User Information
GET /api/beta/user/me
×
400
Get User Primary Team
GET /api/beta/user/me/teams/primary
○
Get the team that issued the API key
Get User Teams
GET /api/beta/user/me/teams
○
Only the team that issued the API key
Get Team
GET /api/beta/teams/{team_id}
○
Only the team that issued the API key
Get Event
GET /api/beta/events/{event_id}
○
Only event of the team that issued the API key.
Get Team Calendars
GET /api/beta/teams/{team_id}/calendars
○
Only calendars of the team that issued the API key
Get Calendar Events
GET /api/beta/calendars/{calendar_id}/events
○
Only calendar of the team that issued the API key
Get Calendar
GET /api/beta/calendars/{calendar_id}
○
Only calendar of the team that issued the API key
Cancel Event
POST /api/beta/events/{event_id}/cancel
○
Only event of the team that issued the API key
Get One time URL
GET /api/beta/calendars/one-time-url/{one_time_url_id}
○
Only calendar of the team that issued the API key
Create One Time URL
POST /api/beta/calendars/{calendar_id}/one-time-url
○
Only calendar of the team that issued the API key
Watch One Time URL
POST /api/beta/calendars/one-time-url/{one_time_url_id}/watch
○
Only calendar of the team that issued
