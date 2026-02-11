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
    SLACK_WEBHOOK_URL: 'SLACK_WEBHOOK_URL', // Slack通知用Webhook URL
    LSTEP_API_KEY: 'LSTEP_API_TOKEN', // LステップAPIトークン（スクリプトプロパティ名）
    LSTEP_TRIGGER_URL: 'LSTEP_TRIGGER_URL' // ⑤のcURLサンプルで取得したトリガーURL（任意・runLStepApiTriggerTest用）
  },

  // シート名
  SHEET_NAMES: {
    INTERVIEWERS: 'interviewers',
    INTERVIEWS: 'interviews',
    UIDLOG: 'uidlog' // UID取得ログ（日時, uid, sessionid, イベント種別）。UID取得用GASと面談表示URLを分離した構成で使用
  },

  // interviewersシートのカラムインデックス（A列=1, B列=2, ...）
  INTERVIEWERS_COLUMNS: {
    ID: 1,                    // A
    NAME: 2,                  // B
    TIMEREX_CONFIG_ID: 3,     // C
    GOOGLE_CALENDAR_ID: 4,    // D
    PRIORITY: 5               // E（優先順位：低い数値ほど優先度が高い）
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

