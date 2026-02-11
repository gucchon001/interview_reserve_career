# 1 Reference 5Eeff576252D2 Get User Information

URL: https://developers.timerex.net/ja/api/reference/5eeff576252d2-get-user-information
取得日時: 2025-12-25 13:28:06
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
Get User Information
get
https://timerex.net/api/beta
/user/me
現在のユーザーの情報を取得します。
Get the current user information.
APIキーによる認証の場合、本リクエストはご利用いただけません。
This request is not available for authentication by API key.
Scopes
Name
Required
profile
Yes
email
No
Rate Limit
ユーザー1分あたり60リクエスト
60 requests per minute per user
Request
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
429
User Found
Body
application/json
application/json
responses
/
200
id
string
required
email
string
Returned only when email scope is included
name
string
required
display_name
string
required
The public name of the user.
Parameters
Authorization*
:
Send API Request
Request Sample: Shell / cURL
curl
--request GET
\
--url https://timerex.net/api/beta/user/me
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
"email"
:
"example@gmail.com"
,
4
"name"
:
"Mr. TimeRex"
,
5
"display_name"
:
"TimeRex"
6
}
