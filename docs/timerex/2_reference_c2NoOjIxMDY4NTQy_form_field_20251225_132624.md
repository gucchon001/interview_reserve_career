# 2 Reference C2Noojixmdy4Ntqy Form Field

URL: https://developers.timerex.net/ja/webhook/reference/c2NoOjIxMDY4NTQy-form-field
取得日時: 2025-12-25 13:30:17
深さ: 2

---

English
日本語
APIS
Webhook
Schemas
ConfirmedEvent
CancelledEvent
Host
FormField
ZoomMeeting
GoogleMeetMeeting
MicrosoftTeamsMeeting
powered by
Stoplight
FormField
Export
field_type
string
required
The field type of the form field. Available types are:
Show all...
required
boolean
required
Whether input for the field is required
label
string
required
description
string
required
options
array[string]
required
A string array of options for this form field. This parameter is only used for the following field types.
Show all...
value
string
or
array
required
The value entered by the guest for this form field.
Show all...
Example
1
{
2
"field_type"
:
"company_name"
,
3
"required"
:
false
,
4
"label"
:
"会社名"
,
5
"description"
:
"Test description"
,
6
"value"
:
"Mixtend"
7
}
