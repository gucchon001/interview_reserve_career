# 1 Reference Q3Ig7Kz84I66I Get Calendar Events

URL: https://developers.timerex.net/ja/api/reference/q3ig7kz84i66i-get-calendar-events
取得日時: 2025-12-25 13:28:38
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
Get Calendar Events
get
https://timerex.net/api/beta
/calendars/{calendar_id}/events
カレンダーのイベントを取得します。
Get the events in a calendar.
Scopes
Name
Required
User.Teams.Calendars.Read
Yes
Rate Limit
ユーザー1分あたり60リクエスト
60 requests per minute per user
Pagination
1ページあたり10件の結果
10 results per page
Request
Path Parameters
calendar_id
string
required
Query Parameters
endTime
string
end datetime in UTC (ex: 2023-12-19 16:00:00)
startTime
string
start datetime in UTC (ex: 2023-12-19 15:00:00)
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
Calendar event list
Body
application/json
application/json
responses
/
200
nextPageToken
string
items
array[object]
required
id
string
required
status
string
required
start_datetime
string
required
end_datetime
string
required
Parameters
calendar_id*
:
endTime
:
startTime
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
/events
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
"eyJpdiI6IllTdFJHUnBxxEtKQm5OQkl1eWFZanc9PSIsInZhbHVlIjoiRDg2Z0RNb2s0aGVkUWFmSTI3MzF3Zz09IiwibWFjIjoiMWYwNGUzZmQ2OWIzNGUxZmNhZDAzOTgyYmNmN2I3NzI5NWE0MGFiZTg5ZWNiMTQwMzgwY2U0NDQ1ZjFiMmEwMCIsInRhZyI6IiJ9"
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
"b7af5ex04e4b8451e0a9"
,
6
"status"
:
"confirmed"
,
7
"start_datetime"
:
"2023-12-19T15:00:00+00:00"
,
8
"end_datetime"
:
"2023-12-19T16:00:00+00:00"
9
}
,
10
{
11
"id"
:
"f9a9fx013278d7ed0668"
,
12
"status"
:
"confirmed"
,
13
"start_datetime"
:
"2023-12-20T15:00:00+00:00"
,
14
"end_datetime"
:
"2023-12-20T16:00:00+00:00"
15
}
,
16
{
17
"id"
:
"5fa73bf23bf17414f3cc"
,
18
"status"
:
"confirmed"
,
19
"start_datetime"
:
"2023-12-20T16:00:00+00:00"
,
20
"end_datetime"
:
"2023-12-20T17:00:00+00:00"
21
}
,
22
{
23
"id"
:
"c28dd75b54da3dd8b946"
,
24
"status"
:
"confirmed"
,
25
"start_datetime"
:
"2023-12-20T17:00:00+00:00"
,
26
"end_datetime"
:
"2023-12-20T18:00:00+00:00"
27
}
,
28
{
29
"id"
:
"c62caba14ff3a6b46a5d"
,
30
"status"
:
"confirmed"
,
31
"start_datetime"
:
"2023-12-20T18:00:00+00:00"
,
32
"end_datetime"
:
"2023-12-20T19:00:00+00:00"
33
}
,
34
{
35
"id"
:
"da22cc64edbf0a191c5a"
,
36
"status"
:
"confirmed"
,
37
"start_datetime"
:
"2023-12-21T15:00:00+00:00"
,
38
"end_datetime"
:
"2023-12-21T16:00:00+00:00"
39
}
,
40
{
41
"id"
:
"d82ccbc0f078863bec7f"
,
42
"status"
:
"confirmed"
,
43
"start_datetime"
:
"2023-12-21T16:00:00+00:00"
,
44
"end_datetime"
:
"2023-12-21T17:00:00+00:00"
45
}
,
46
{
47
"id"
:
"f452f6zb80a1ee73dfa8"
,
48
"status"
:
"confirmed"
,
49
"start_datetime"
:
"2023-12-21T17:00:00+00:00"
,
50
"end_datetime"
:
"2023-12-21T18:00:00+00:00"
51
}
,
52
{
53
"id"
:
"65512b84d1e9f338e7a3"
,
54
"status"
:
"confirmed"
,
55
"start_datetime"
:
"2023-12-21T18:00:00+00:00"
,
56
"end_datetime"
:
"2023-12-21T19:00:00+00:00"
57
}
,
58
{
59
"id"
:
"709b179bp2b2fffd4b1e"
,
60
"status"
:
"confirmed"
,
61
"start_datetime"
:
"2023-12-22T15:00:00+00:00"
,
62
"end_datetime"
:
"2023-12-22T16:00:00+00:00"
63
}
64
]
65
}
