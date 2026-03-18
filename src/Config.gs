/**
 * 設定定数管理
 * PropertiesServiceで管理する設定キー、シート名、エラーメッセージなどを定義
 */

const Config = {
  // PropertiesService キー
  PROPERTY_KEYS: {
    TIMEREX_API_KEY: 'TIMEREX_API_KEY',
    TIMEREX_WEBHOOK_TOKEN: 'TIMEREX_WEBHOOK_TOKEN',
    TIMEREX_TEAM_URL_PATH: 'TIMEREX_TEAM_URL_PATH',
    TIMEREX_CALENDAR_URL_PATH: 'TIMEREX_CALENDAR_URL_PATH',
    TIMEREX_TEAM_CALENDAR_URL_PATH: 'TIMEREX_TEAM_CALENDAR_URL_PATH', // 統合カレンダーURL
    LINE_ACCESS_TOKEN: 'LINE_ACCESS_TOKEN', // 必要に応じて
    SPREADSHEET_ID: 'SPREADSHEET_ID',
    SLACK_BOT_TOKEN: 'SLACK_BOT_TOKEN',     // Slack通知用Bot Token（xoxb-...）
    SLACK_CHANNEL_ID: 'SLACK_CHANNEL_ID',   // Slack通知先チャネルID
    LSTEP_API_KEY: 'LSTEP_API_TOKEN', // LステップAPIトークン（スクリプトプロパティ名）
    LSTEP_TRIGGER_URL: 'LSTEP_TRIGGER_URL', // ⑤のcURLサンプルで取得したトリガーURL（予約確定時の友だち情報・タグ用）
    LSTEP_CANCEL_TRIGGER_URL: 'LSTEP_CANCEL_TRIGGER_URL', // キャンセル時の友だち情報クリア用トリガーURL。未設定時は LSTEP_TRIGGER_URL を使用（後方互換）
    LSTEP_BOOKING_LINK_TRIGGER_URL: 'LSTEP_BOOKING_LINK_TRIGGER_URL', // 予約URL送信用トリガー（postback 受信後にメッセージで session_id 付きURLを送る用。未設定なら従来どおりレスポンスHTMLのみ）
    LSTEP_BOOKING_LINK_POSTBACK_PATTERN: 'LSTEP_BOOKING_LINK_POSTBACK_PATTERN', // 予約URLを送る postback の条件。未設定または空＝すべての postback で送信。設定時は postback.data にこの文字列が含まれるときのみ送信（例: booking）
    MEET_SA_CLIENT_EMAIL: 'MEET_SA_CLIENT_EMAIL',   // Google Meet API 用サービスアカウントの client_email（ドメイン全体の委任で主催者になりすます）
    MEET_SA_PRIVATE_KEY: 'MEET_SA_PRIVATE_KEY'      // 上記サービスアカウントの private_key（PEM。改行は \n のまままたは実際の改行で保存可）
  },

  // シート名
  SHEET_NAMES: {
    INTERVIEWERS: 'interviewers',
    INTERVIEWS: 'interviews',
    UIDLOG: 'uidlog', // UID取得ログ（日時, uid, sessionid, イベント種別）。UID取得用GASと面談表示URLを分離した構成で使用
    TEMPLATE: 'template' // L-step テンプレート対応（tag=flex_code等の接頭辞, name, outer_id=面談官ID）。予約URL送信対象と redirectUrl の interviewer_id に利用
  },

  // template シートのカラムインデックス（A列=1, B列=2, ...）
  TEMPLATE_COLUMNS: {
    TAG: 1,       // A: L-step の flex_code / carousel_code の接頭辞（postback.data に含まれる）
    NAME: 2,      // B: 表示名（共通・尾座本など）
    OUTER_ID: 3   // C: 面談官ID（interviewers の id と対応）。空なら統合カレンダー
  },

  // interviewersシートのカラムインデックス（A列=1, B列=2, ...）
  INTERVIEWERS_COLUMNS: {
    ID: 1,                    // A
    NAME: 2,                  // B
    TIMEREX_CONFIG_ID: 3,     // C
    GOOGLE_CALENDAR_ID: 4,    // D
    PRIORITY: 5,             // E（優先順位：低い数値ほど優先度が高い）
    SLACK_MEMBER_ID: 6       // F（Slackメンション用メンバーID）
  },

  // interviewsシートのカラムインデックス（A列=1, B列=2, ...）
  INTERVIEWS_COLUMNS: {
    CREATED_AT: 1,           // A
    START_AT: 2,             // B
    END_AT: 3,               // C
    GUEST_NAME: 4,           // D
    GUEST_EMAIL: 5,          // E
    MEET_URL: 6,             // F
    LINE_UID: 7,             // G
    SOURCE: 8,               // H
    EVENT_ID: 9,             // I（推奨追加）
    TEAM_URL_PATH: 10,       // J（推奨追加）
    CALENDAR_URL_PATH: 11,   // K（推奨追加）
    STATUS: 12,              // L（推奨追加）
    INTERVIEWER_ID: 13       // M（面談官ID）
  },

  // 予約ステータス
  EVENT_STATUS: {
    CONFIRMED: 1,
    CANCELLED: 3
  },

  // 予約元
  SOURCE: {
    TIMEREX: 'TimeRex',
    MANUAL: 'Manual'
  },

  // TimeRex API ベースURL
  TIMEREX_API_BASE_URL: 'https://timerex.net/api/beta',

  // LステップAPI ベースURL（実ドメインは api.lineml.jp。エンドポイントのcURLサンプルは /api-codes/{code}/triggers/{id} 形式）
  LSTEP_API_BASE_URL: 'https://api.lineml.jp/v1',

  // Lステップタグ名
  LSTEP_TAG_NAMES: {
    BOOKING_CONFIRMED: '面談予約済み' // 予約確定時に設置するタグ名
  },

  // LステップAPI トリガーURL（runLStepApiTriggerTest のデフォルト。プロパティ・引数未設定時のみ使用）
  LSTEP_TRIGGER_URL_DEFAULT: 'https://api.lineml.jp/v1/api-codes/690/triggers/c4faddc7-b837-4637-b481-eaab5777af2a',

  // Lステップ: true のとき「UID取得だけ」にする（予約確定・キャンセル時の友だち情報更新・タグは行わない）。false でトリガーURL経由の友だち情報更新を有効化
  LSTEP_UID_ONLY: false,

  // Lステップ: true のとき友だち情報更新をトリガーURL経由で行う（/friend/update が404の契約向け）。LSTEP_UID_ONLY が true のときは無視される
  LSTEP_USE_TRIGGER_URL: true,

  /**
   * 予約画面のベースURL（Webhookリダイレクト先）
   * ドメイン付きデプロイを使う場合はここに本番URLを設定する。
   * 未設定の場合は ScriptApp.getScriptId() で組み立てたURLにリダイレクトする。
   */
  BOOKING_BASE_URL: 'https://script.google.com/a/macros/tomonokai-corp.com/s/AKfycbzwxXeBDR8LeHoYd5i4CRb2IElFR1AQcPzPg49ra4rYQc_njNox8LWIxlSMnAPHE25L_w/exec',

  // エラーメッセージ
  ERROR_MESSAGES: {
    UNAUTHORIZED: 'Unauthorized: Invalid security token',
    INVALID_PAYLOAD: 'Invalid payload format',
    SHEET_NOT_FOUND: 'Sheet not found',
    CALENDAR_NOT_FOUND: 'Calendar not found',
    USER_NOT_FOUND: 'User not found'
  },

  // その他設定
  SETTINGS: {
    WEBHOOK_TIMEOUT: 15000, // 15秒
    MAX_RETRY_COUNT: 3,
    RETRY_DELAY: 10000 // 10秒
  }
};

