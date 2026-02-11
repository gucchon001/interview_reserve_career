# 2 Widget Nreference

URL: https://developers.timerex.net/ja/widget/nreference
取得日時: 2025-12-25 13:29:49
深さ: 2

---

Calendar Widget (Embed)
日程調整カレンダーウィジェット（サイトへの埋め込み機能）
powered by
Stoplight
Calendar Widget (Embed)
この記事は日本語でもご覧いただけます。
The schedule adjustment calendar widget allows you to embed a schedule adjustment calendar into your website to add a scheduling feature to your website.
Availability
Schedule adjustment calendar Widget is available for all users.
How to use
Add the code that appears in the "Embed Calendar" section of the confirmation page for the scheduling adjustment calendar settings inside the body tag on your webpage.
Example of using TimeRex widget (embedded)
Please see below for a sample of embedding in a web page.
https://timerex.net/blog/update/201109-embed
Data Integration to a schedule adjustment calendar
It is possible to link membership information managed on your website to a schedule adjustment calendar widget. There are two ways to link data: "Automatic input of question items" and "Integration by parameters", each of which can be easily achieved by changing a part of the embed code.
Automatic input of question items (Data Integration)
It is possible to automatically input the customer's name, e-mail address, etc. into the question field when adjusting the schedule.
※If a non-existent parameter is passed, it will count toward the limit of up to 25 url_params.
Example
<
!
--
Begin
TimeRex
Widget
--
>
<
div id
=
"timerex_calendar"
data
-
url
=
"https://timerex.net/s/xxxxxxxxxx/xxxxxxxx"
>
<
/
div
>
<
script id
=
"timerex_embed"
src
=
"https://asset.timerex.net/js/embed.js"
>
<
/
script
>
<
script type
=
"text/javascript"
>
TimerexCalendar
(
{
'guest_company'
:
'Mixtend Inc.'
,
'guest_name'
:
'Tomohiro Kitano'
,
'guest_email'
:
'xxxxxxxx@test.com'
,
'guest_comment'
:
'Hello'
,
'locale'
:
'en'
,
'1234567890abc_1'
:
'01-01-1990'
// Date of birth
}
)
;
<
/
script
>
<
!
--
End
TimeRex
Widget
--
>
Parameters
Name
Datatype
Required
Remarks
guest_company
string
false
The value that goes into the "Company name" section of the standard question items.
guest_name
string
false
The value that goes into the "Name" section of the standard question items.
guest_email
string
false
The value that goes into the "Email" section of the standard question items.
guest_comment
string
false
The value that goes into the "Comment" section of the standard question items.
locale
string
false
Specify the language to be displayed.
ja: Japanese
en: English
<custom_form_field_id>
string
false
You can specify a value to be entered into any question item (Premium plan only).
The parameter name <custom_form_field_id> can be found on the question item edit screen. For more information, please click
here
.
primary_color
string
false
You can specify the key color of the widget by color code. (Premium plan only.)
Example
#00000000（8 digits）
#000000（6 digits）
#000（3 digits）
00000000（without #）
000000（without #）
000（without #
disable_logo
string
false
Hides the TimeRex logo from the widget. (Premium plan only.)
true: Hide the logo.
false: Display the logo
disable_title_hyperlink
string
false
You can disable the hyperlink of the schedule adjustment calendar name in the widget (available on premium plans only)
true: Disable hyperlinks
false: Enable hyperlinks
Integration by parameters (Data Integration)
You can link values that are not displayed on the page to the calendar widget.
This can be used to understand the IDs that identify members, the source of inflow, etc.
Example
<
!
--
Begin
TimeRex
Widget
--
>
<
div id
=
"timerex_calendar"
data
-
url
=
"https://timerex.net/s/xxxxxxxxxx/xxxxxxxx"
>
<
/
div
>
<
script id
=
"timerex_embed"
src
=
"https://asset.timerex.net/js/embed.js"
>
<
/
script
>
<
script type
=
"text/javascript"
>
TimerexCalendar
(
{
"url_params"
:
{
"user_hash"
:
"abcdefg1234567"
,
"campaign_id"
:
"Osaka_SMB"
}
}
)
;
<
/
script
>
<
!
--
End
TimeRex
Widget
--
>
Parameters
Name
Datatype
Required
Remarks
url_params
Array
false
A maximum of 25 parameters can be passed (an error message will be displayed if the number exceeds 25). Parameters must be URL-encoded.
You cannot set nested objects/arrays as parameters.
※When using Webhook
Requests received are converted into an array of objects on a per-parameter basis.
How to control the widget loading timing
If you want to control the loading timing of the widget due to problems with the web page you are embedding it in, you can control the loading timing by changing the code as follows.
Step 1: Add the widget code in the Body
Add the following code to the part of the Body where you want the widget to appear.
<
!
--
Begin
TimeRex
Widget
--
>
<
div id
=
"timerex_calendar"
data
-
url
=
"https://timerex.net/s/demo.team/xxxxxxxx"
>
<
/
div
>
<
script id
=
"timerex_embed"
src
=
"https://asset.timerex.net/js/embed.js"
>
<
/
script
>
<
!
--
End
TimeRex
Widget
--
>
Step 2: Add the code to call the function
Call the TimerexCalendar() function when you want to load the widget.
<
button onclick
=
"TimerexCalendar();"
>
Load
<
/
button
>
Callback feature
When certain events occur in the widget's life cycle, the host page can receive a message.
Callback types
Name
Description
onLoad()
Widget has finished loading.
onFormOpen()
Reservation form is displayed.
onBookingComplete()
Reservation has been completed.
https://developers.timerex.net/ja/widget/nreference/#/0ba0ada1e64a6-
Example
<
!
--
Begin
TimeRex
Widget
--
>
<
div id
=
"timerex_calendar"
data
-
url
=
"https://timerex.net/s/xxxxxxxxxx/xxxxxxxx"
>
<
/
div
>
<
script id
=
"timerex_embed"
src
=
"https://asset.timerex.net/js/embed.js"
>
<
/
script
>
<
script type
=
"text/javascript"
>
TimerexCalendar
(
{
'onLoad'
:
function
(
)
{
console
.
log
(
'Widget Loaded'
)
;
}
,
'onFormOpen'
:
function
(
)
{
console
.
log
(
'Booking form opened'
)
;
}
,
'onBookingComplete'
:
function
(
)
{
console
.
log
(
'Booking completed'
)
;
}
,
}
)
;
<
/
script
>
<
!
--
End
TimeRex
Widget
--
>
Sample code for measuring conversions in Google Ads using Callback
<
!
--
Begin
TimeRex
Widget
--
>
<
div id
=
"timerex_calendar"
data
-
url
=
"https://timerex.net/s/xxxxxxxxxx/xxxxxxxx"
>
<
/
div
>
<
script
async
src
=
"https://www.googletagmanager.com/gtag/js?id=xxxxxxxx"
>
<
/
script
>
<
script
>
window
.
dataLayer
=
window
.
dataLayer
||
[
]
;
function
gtag
(
)
{
dataLayer
.
push
(
arguments
)
;
}
gtag
(
'js'
,
new
Date
(
)
)
;
<
/
script
>
<
script id
=
"timerex_embed"
src
=
"https://asset.timerex.net/js/embed.js"
>
<
/
script
>
<
script type
=
"text/javascript"
>
TimerexCalendar
(
{
'onLoad'
:
function
(
)
{
console
.
log
(
'Widget Loaded'
)
;
}
,
'onFormOpen'
:
function
(
)
{
console
.
log
(
'Booking form opened'
)
;
}
,
'onBookingComplete'
:
function
(
)
{
console
.
log
(
'Booking completed'
)
;
gtag
(
'event'
,
'conversion'
,
{
'send_to'
:
'xxxxxxxx'
,
'value'
:
1.0
,
'currency'
:
'USD'
}
)
;
}
,
}
)
;
<
/
script
>
<
!
--
End
TimeRex
Widget
--
>
※When measuring conversions with Google Ads, the
send_to
parameter in
gtag()
will be
'AW-CONVERSION_ID/CONVERSION_LABEL'
.
※When measuring conversions with Google Analytics, you need
gtag('js', new Date());
one line below
gtag('config', 'tracking ID');
. Also, the
send_to
parameter in
gtag()
is optional (if entered, it will contain
'tracking ID'
).
For more information,
please click here
.
Sample code for measuring conversions in Yahoo Ads using Callback
<
!
--
Begin
TimeRex
Widget
--
>
<
div id
=
"timerex_calendar"
data
-
url
=
"https://timerex.net/s/xxxxxxxxxx/xxxxxxxx"
>
<
/
div
>
<
script
async
src
=
"https://s.yimg.jp/images/listing/tool/cv/ytag.js"
>
<
/
script
>
<
script
>
window
.
yjDataLayer
=
window
.
yjDataLayer
||
[
]
;
function
ytag
(
)
{
yjDataLayer
.
push
(
arguments
)
;
}
<
/
script
>
<
script id
=
"timerex_embed"
src
=
"https://asset.timerex.net/js/embed.js"
>
<
/
script
>
<
script type
=
"text/javascript"
>
TimerexCalendar
(
{
'onLoad'
:
function
(
)
{
console
.
log
(
'Widget Loaded'
)
;
}
,
'onFormOpen'
:
function
(
)
{
console
.
log
(
'Booking form opened'
)
;
}
,
'onBookingComplete'
:
function
(
)
{
console
.
log
(
'Booking completed'
)
;
ytag
(
{
"type"
:
"yss_conversion"
,
"config"
:
{
"yahoo_conversion_id"
:
"xxxxxxxxxx"
,
"yahoo_conversion_label"
:
"fw_xxxxxxxxxxxxxxxxx"
,
"yahoo_conversion_value"
:
"xxx"
}
}
)
;
}
,
}
)
;
<
/
script
>
<
!
--
End
TimeRex
Widget
--
>
For more information,
please click here
.
For search ads (shopping), For more information,
please click here
.
ExampleSample code to redirect to another page (e.g., Thanks page) after booking is complete
<
!
--
Begin
TimeRex
Widget
--
>
<
div id
=
"timerex_calendar"
data
-
url
=
"https://timerex.net/s/xxxxxxxxxx/xxxxxxxx"
>
<
/
div
>
<
script id
=
"timerex_embed"
src
=
"https://asset.timerex.net/js/embed.js"
>
<
/
script
>
<
script type
=
"text/javascript"
>
TimerexCalendar
(
{
'onLoad'
:
function
(
)
{
console
.
log
(
'Widget Loaded'
)
;
}
,
'onFormOpen'
:
function
(
)
{
console
.
log
(
'Booking form opened'
)
;
}
,
'onBookingComplete'
:
function
(
)
{
window
.
location
.
href
=
'Redirect url'
;
}
,
}
)
;
<
/
script
>
<
!
--
End
TimeRex
Widget
--
>
Sample code to send UTM parameters after booking is complete
<
!
--
Begin
TimeRex
Widget
--
>
<
div id
=
"timerex_calendar"
data
-
url
=
"https://timerex.net/s/xxxxxxxxxx/xxxxxxxx"
>
<
/
div
>
<
script id
=
"timerex_embed"
src
=
"https://asset.timerex.net/js/embed.js"
>
<
/
script
>
<
script
async
src
=
"https://www.googletagmanager.com/gtag/js?id=xxxxxxxx"
>
<
/
script
>
<
script
>
window
.
dataLayer
=
window
.
dataLayer
||
[
]
;
function
gtag
(
)
{
dataLayer
.
push
(
arguments
)
;
}
gtag
(
'js'
,
new
Date
(
)
)
;
// Example of obtaining utm_parameters from a customer's web page URL
const
queryParams
=
new
URLSearchParams
(
window
.
location
.
search
)
;
const
utm_source
=
queryParams
.
get
(
'utm_source'
)
;
const
utm_medium
=
queryParams
.
get
(
'utm_medium'
)
;
const
utm_campaign
=
queryParams
.
get
(
'utm_campaign'
)
;
<
/
script
>
<
script type
=
"text/javascript"
>
TimerexCalendar
(
{
'onBookingComplete'
:
function
(
)
{
console
.
log
(
'Booking completed'
)
;
gtag
(
'event'
,
'utm_paramter'
,
{
'send_to'
:
'xxxxxxxxxxxx'
,
"utm_medium"
:
utm_medium
,
"utm_source"
:
utm_source
,
"utm_campaign"
:
utm_campaign
}
)
;
}
,
}
)
;
<
/
script
>
<
!
--
End
TimeRex
Widget
--
>
Embed schedule adjustment calendar widget in SPA
The schedule adjustment calendar widget can also be embedded in pages using front-end frameworks such as Vue.js and React.
For more details, please refer to the sample code below.
Sample code in Vue.js
Sample code in Vue2
Sample code in Vue3
Sample code in React
Sample code in React
