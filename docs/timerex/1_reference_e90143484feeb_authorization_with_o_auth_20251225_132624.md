# 1 Reference E90143484Feeb Authorization With O Auth

URL: https://developers.timerex.net/ja/api/reference/e90143484feeb-authorization-with-o-auth
取得日時: 2025-12-25 13:27:03
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
Authorization with OAuth
この記事は日本語でもご覧いただけます。
Background
TimeRex OAuth Server allows TimeRex users to authorize third party services to access TimeRex services on the user’s behalf.
TimeRex OAuth Server provides the following features:
Authorization
De-authorization
Access token management
Implementation details
Type
Description
Specification
OAuth2
Supported grant types
Authorization code
OAuth client registration
Parameter
Description
Application owner
TimeRex user_id or email
Application name
Application description
Application logo
Recommended size 500px * 500px
Application domain
Example:
https://third-party-app.com
Terms link
Example:
https://third-party-app.com/terms
Privacy policy link
Example:
https://third-party-app.com/privacy
Redirect Uri
Example:
https://third-party-app.com/callback
(SSL required)
Scopes
The scopes required by the app (See scopes section for details)
On successful client registration, the client will be provided with a
CLIENT_ID
and
CLIENT_SECRET
.
Example:
CLIENT_ID=93d983d6-1031-404a-ba3e-0f07a95bf73a
CLIENT_SECRET=BVvyQMpAkwuiidy9KuQCx1070ghTo3cEuG1LMDeM
Please keep the
CLIENT_ID
and
CLIENT_SECRET
confidential and do not upload them to github or public code repositories.
Scopes
Scope
Description
profile
Get the profile of the current user (Excluding email)
email
Get the email address of the current user
User.Teams.Read
Get the teams that the current user is a part of
User.Teams.Calendars.Read
Get the calendars that belong to a team
User.Teams.Calendars.ReadWrite
Write access for the calendars that belong to a team
OAuth Authorization Flow
Step 1
The third party app redirects the user to TimeRex’s authorize endpoint by making a
GET
request.
GET https://timerex.net/oauth/authorize
The authorize endpoint requires the following query parameters
Parameter
Required
Description
client_id
Yes
Client id provided by TimeRex.
response_type
Yes
code
redirect_uri
Yes
Must be the same as the redirect_uri used while registering.
scope
Yes
The scopes required (space seperated). If set to empty string all scopes are included.
state
No
A random value used to check for CSRF attacks.
Example:
https://timerex.net/oauth/authorize?client_id=93d983d6-1031-404a-ba3e-0f07a95bf73a&redirect_uri=http%3A%2F%2F127.0.0.1%3A8000%2Fcallback&response_type=code&scope=&state=J-WnviV01ccIEbi0rsEcrHVbjNoQ4W8F7sRM2onWX
After the redirect the user will be presented with an authorization screen.
If the user approves the request a callback is send to the redirect_uri.
Step 2
The callback will contain the following query parameters.
Parameter
Description
code
Authorization code
state
The state that was set when initiating the redirect. If the state doesn’t match the request should be ignored to prevent CSRF attacks.
Example:
https://third-party-app.com/callback?code=cdb99a63305d3b7ac953237fd3a4e1c8ad25987ca10aa2ae18d05&state=nCCOKdTMuWC0Vink7nXhIbUzlBTrzjpWZZ1F3Eqe
Step 3
The authorization code can now be converted to access tokens.
To convert the authorization code to access tokens a
POST
request must be made to the TimeRex token endpoint.
POST https://timerex.net/oauth/token
The following form parameters are required
Parameter
Required
Description
grant_type
Yes
authorization_code
client_id
Yes
Your client_id
client_secret
Yes
Your client_secret
redirect_uri
Yes
Your registered redirect_uri
code
Yes
The authorization returned during step 2
If successful the access_token and refresh_token will be returned in the response.
{
"token_type"
:
"Bearer"
,
"expires_in"
:
3600
,
"access_token"
:
"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5M2Q5ODNkNi0xMDMxLTQwNGEtYmEzZS0wZjA3YTk1YmY3M2EiLCJqdGkiOiJhOGY0MDc0MWM1YmE4NWQxOTVkMTgwMWY1NTI0Yzc4NDRkOTc5Yjk5MGIzMjlmNGNlZTJjNWJhNjFjZWQyYzZkNzcwYTJmMTUyZmMwNDUwYSIsImlhdCI6MTYyOTcwMjk2OSwibmJmIjoxNjI5NzAyOTY5LCJle"
,
"refresh_token"
:
"def50200aed9ae495daf389f4d8eb9c949ff7b7c2d82212fcebfc0636056ac07e14d383d7ffdfaa00900e8a8156aeccd5e7a281bd53856a51be108a1741ad94da4a7c2cee5e83e118c10e24f7b258088419a4b93bd6eef151fdcbf78dfda19f9965f96633959ab83be3b7e2fda31c3bd665e016af6282df6c9df3d502457abc8e9988b9ae1f9f118331f8b3624723bdc97112b9f7a31646b0343806bd7e545790e6d490ae063e2c0ebac31a03045df8d8a233121a2d059eab9fe4c2c07eecd7a5d6198d0a1c240e2bb325fa7421c7067ca3"
}
Expires in denotes the time in seconds until the expiry of the access token (1 hour)
Refresh tokens are valid for one year
Step 4
You can use the access token to call TimeRex APIs.
To get the information for the current user, make a
GET
request to the user info endpoint.
GET https://timerex.net/api/beta/user/me
Pass the access token in the authorization header.
“Authorization” : "Bearer {access_token}"
Step 5
Access tokens expire after one hour, new access tokens can be generated using the refresh token.
To generate a new access token a
POST
request must be made to the TimeRex token endpoint.
POST https://timerex.net/oauth/token
The following form parameters are required
Parameter
Required
Description
grant_type
Yes
refresh_token
client_id
Yes
Your client_id
client_secret
Yes
Your client_secret
refresh_token
Yes
The refresh_token
scope
No
If successful a new access_token and refresh_token will be returned in the response.
{
"token_type"
:
"Bearer"
,
"expires_in"
:
3600
,
"access_token"
:
"eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5M2Q5ODNkNi0xMDMxLTQwNGEtYmEzZS0wZjA3YTk1YmY3M2EiLCJqdGkiOiJhOGY0MDc0MWM1YmE4NWQxOTVkMTgwMWY1NTI0Yzc4NDRkOTc5Yjk5MGIzMjlmNGNlZTJjNWJhNjFjZWQyYzZkNzcwYTJmMTUyZmMwNDUwYSIsImlhdCI6MTYyOTcwMjk2OSwibmJmIjoxNjI5NzAyOTY5LCJle"
,
"refresh_token"
:
"def50200aed9ae495daf389f4d8eb9c949ff7b7c2d82212fcebfc0636056ac07e14d383d7ffdfaa00900e8a8156aeccd5e7a281bd53856a51be108a1741ad94da4a7c2cee5e83e118c10e24f7b258088419a4b93bd6eef151fdcbf78dfda19f9965f96633959ab83be3b7e2fda31c3bd665e016af6282df6c9df3d502457abc8e9988b9ae1f9f118331f8b3624723bdc97112b9f7a31646b0343806bd7e545790e6d490ae063e2c0ebac31a03045df8d8a233121a2d059eab9fe4c2c07eecd7a5d6198d0a1c240e2bb325fa7421c7067ca3"
}
Refresh tokens can only be used once
The newly generated refresh token must be used for subsequent refresh requests
Step 6
To revoke an access token a
POST
request must be made to the TimeRex token revoke endpoint.
POST https://timerex.net/api/beta/token/revoke
Pass the access token in the authorization header.
“Authorization” : "Bearer {access_token}"
