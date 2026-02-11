# 1 Reference 0Caf2E44Ede64 Get One Time Url

URL: https://developers.timerex.net/ja/api/reference/0caf2e44ede64-get-one-time-url
取得日時: 2025-12-25 13:28:48
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
Get One time URL
get
https://timerex.net/api/beta
/calendars/one-time-url/{one_time_url_id}
ワンタイムURLを取得します。
Get One-time URL.
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
one_time_url_id
string
required
Id for the one time URL
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
One time URL Found
Body
application/json
application/xml
application/json
responses
/
200
id
string
required
url
string
required
status
string
required
Possible values
Show all...
event
object
or
null
required
Possible values
null when status is pending
Instance of
ConfirmedEvent
when status is confirmed
Instance of
CancelledEvent
when status is cancelled
Parameters
one_time_url_id*
:
Authorization*
:
Send API Request
Request Sample: Shell / cURL
curl
--request GET
\
--url https://timerex.net/api/beta/calendars/one-time-url/
{
one_time_url_id
}
\
--header
'Accept: application/json, application/xml'
\
--header
'Authorization: '
Get One Time URL (Event confirmed)
Get One Time URL (Event cancelled)
Get One Time Url (Event Pending)
Response Example: Get One Time URL (Event confirmed)
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
"confirmed"
,
5
"event"
:
{
6
"id"
:
"b0c2a75fb3c82d050b9c"
,
7
"start_datetime"
:
"2020-08-26T09:00:00+00:00"
,
8
"end_datetime"
:
"2020-08-26T10:00:00+00:00"
,
9
"local_start_datetime"
:
"2020-08-26T18:00:00+09:00"
,
10
"local_end_datetime"
:
"2020-08-26T19:00:00+09:00"
,
11
"timezone"
:
"Asia/Tokyo"
,
12
"guest_locale"
:
"ja"
,
13
"created_at"
:
"2020-08-20T02:22:40+00:00"
,
14
"host_cancel_url"
:
"https://timerex.net/schedule/host_cancel/1981d18a994f60e7bcc2"
,
15
"guest_cancel_url"
:
"https://timerex.net/schedule/cancel/1981d18a994f60e7bcc2"
,
16
"online_meeting_provider"
:
"zoom"
,
17
"zoom_meeting"
:
{
18
"meeting_id"
:
83736482957
,
19
"join_url"
:
"https://us02web.zoom.us/j/83736482957?pwd=TXQ0Kzh4NUQvQ2RGZHFDOEwxVW9Vdz09"
,
20
"password"
:
"035211"
,
21
"host"
:
{
22
"name"
:
"Mixtend Demo"
,
23
"email"
:
"demo@mixtend.com"
24
}
25
}
,
26
"hosts"
:
[
27
{
28
"name"
:
"Mixtend Demo"
,
29
"email"
:
"demo@mixtend.com"
30
}
31
]
,
32
"form"
:
[
33
{
34
"field_type"
:
"company_name"
,
35
"required"
:
false
,
36
"label"
:
"会社名"
,
37
"description"
:
"Test description"
,
38
"value"
:
"Mixtend"
39
}
,
40
{
41
"field_type"
:
"guest_name"
,
42
"required"
:
true
,
43
"label"
:
"名前"
,
44
"description"
:
""
,
45
"value"
:
"Tomohiro Kitano"
46
}
,
47
{
48
"field_type"
:
"guest_email"
,
49
"required"
:
true
,
50
"label"
:
"メールアドレス"
,
51
"description"
:
""
,
52
"value"
:
"guest@mixtend.com"
53
}
,
54
{
55
"field_type"
:
"guest_comment"
,
56
"required"
:
false
,
57
"label"
:
"コメント"
,
58
"description"
:
""
,
59
"value"
:
"test"
60
}
,
61
{
62
"field_type"
:
"radio"
,
63
"required"
:
true
,
64
"label"
:
"性別"
,
65
"description"
:
""
,
66
"options"
:
[
67
"男性"
,
68
"女性"
69
]
,
70
"value"
:
"男性"
71
}
,
72
{
73
"field_type"
:
"checkboxes"
,
74
"required"
:
true
,
75
"label"
:
"趣味"
,
76
"description"
:
""
,
77
"options"
:
[
78
"漫画"
,
79
"カラオケ"
80
]
,
81
"value"
:
[
82
"漫画"
,
83
"カラオケ"
84
]
85
}
,
86
{
87
"field_type"
:
"dropdown"
,
88
"required"
:
true
,
89
"label"
:
"県名"
,
90
"description"
:
""
,
91
"options"
:
[
92
"東京"
,
93
"埼玉"
94
]
,
95
"value"
:
"東京"
96
}
,
97
{
98
"field_type"
:
"paragraph"
,
99
"required"
:
true
,
100
"label"
:
"履歴"
,
101
"description"
:
""
,
102
"value"
:
""
103
}
104
]
105
}
106
}
