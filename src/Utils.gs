/**
 * ユーティリティ関数
 * 日時フォーマット、エラーログ記録、データ検証など
 */

const Utils = {
  /**
   * 日時をフォーマット（yyyy/MM/dd HH:mm形式）
   * @param {Date} date - フォーマットする日時
   * @return {string} フォーマットされた日時文字列
   */
  formatDateTime(date) {
    if (!date || !(date instanceof Date)) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  },

  /**
   * ISO8601形式の文字列をDateオブジェクトに変換
   * @param {string} isoString - ISO8601形式の文字列
   * @return {Date} Dateオブジェクト
   */
  parseISO8601(isoString) {
    if (!isoString) {
      return null;
    }
    try {
      return new Date(isoString);
    } catch (e) {
      Logger.log(`Failed to parse ISO8601: ${isoString}, error: ${e}`);
      return null;
    }
  },

  /**
   * エラーログを記録
   * @param {string} functionName - エラーが発生した関数名
   * @param {Error|string} error - エラーオブジェクトまたはエラーメッセージ
   * @param {Object} context - 追加のコンテキスト情報（オプション）
   */
  logError(functionName, error, context = {}) {
    const errorMessage = error instanceof Error ? error.toString() : String(error);
    const timestamp = new Date();
    const logMessage = `[${Utils.formatDateTime(timestamp)}] ${functionName}: ${errorMessage}`;
    
    Logger.log(logMessage);
    if (Object.keys(context).length > 0) {
      Logger.log(`Context: ${JSON.stringify(context)}`);
    }

    // uidlogにエラーを記録（日時, uid, sessionid, イベント種別）
    try {
      if (typeof SpreadsheetService !== 'undefined') {
        const ctx = typeof context === 'object' ? JSON.stringify(context).substring(0, 300) : String(context);
        SpreadsheetService.saveToUidlog('', '', `ERROR: ${functionName} - ${errorMessage} | ${ctx}`);
      }
    } catch (e) {
      // ログ記録の失敗は無視（無限ループを防ぐ）
      Logger.log(`Failed to log to uidlog: ${e}`);
    }
  },

  /**
   * 必須フィールドの検証
   * @param {Object} obj - 検証するオブジェクト
   * @param {string[]} requiredFields - 必須フィールド名の配列
   * @return {Object} { valid: boolean, missing: string[] }
   */
  validateRequiredFields(obj, requiredFields) {
    const missing = [];
    for (const field of requiredFields) {
      if (!obj || obj[field] === undefined || obj[field] === null || obj[field] === '') {
        missing.push(field);
      }
    }
    return {
      valid: missing.length === 0,
      missing: missing
    };
  },

  /**
   * メールアドレスの簡易検証
   * @param {string} email - 検証するメールアドレス
   * @return {boolean} 有効な場合true
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * 安全にJSONをパース（エラーハンドリング付き）
   * @param {string} jsonString - JSON文字列
   * @return {Object|null} パースされたオブジェクト、失敗時はnull
   */
  safeJsonParse(jsonString) {
    if (jsonString == null || (typeof jsonString === 'string' && jsonString.trim() === '')) {
      return null;
    }
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      Logger.log(`Failed to parse JSON: ${e}`);
      return null;
    }
  },

  /**
   * 配列から指定されたfield_typeの値を取得
   * @param {Array} formArray - form配列
   * @param {string} fieldType - 取得するfield_type
   * @return {string} 値（見つからない場合は空文字列）
   */
  getFormValue(formArray, fieldType) {
    if (!Array.isArray(formArray)) {
      return '';
    }
    const field = formArray.find(f => f.field_type === fieldType);
    return field && field.value ? String(field.value) : '';
  },

  /**
   * url_params配列から指定されたキーの値を取得
   * @param {Array} urlParamsArray - url_params配列
   * @param {string} key - 取得するキー
   * @return {string} 値（見つからない場合は空文字列）
   */
  getUrlParamValue(urlParamsArray, key) {
    if (!Array.isArray(urlParamsArray)) {
      return '';
    }
    const param = urlParamsArray.find(p => p[key] !== undefined);
    return param ? String(param[key]) : '';
  },

  /**
   * 日付の開始時刻（00:00:00）を取得
   * @param {Date} date - 日付
   * @return {Date} 開始時刻のDateオブジェクト
   */
  getStartOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  /**
   * 日付の終了時刻（23:59:59）を取得
   * @param {Date} date - 日付
   * @return {Date} 終了時刻のDateオブジェクト
   */
  getEndOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  /**
   * 今週の開始日（月曜日）を取得
   * @return {Date} 月曜日のDateオブジェクト
   */
  getWeekStart() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // 月曜日に調整
    const monday = new Date(today.setDate(diff));
    return Utils.getStartOfDay(monday);
  },

  /**
   * 今週の終了日（日曜日）を取得
   * @return {Date} 日曜日のDateオブジェクト
   */
  getWeekEnd() {
    const monday = Utils.getWeekStart();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return Utils.getEndOfDay(sunday);
  },

  /**
   * 文字列の長さを検証
   * @param {string} str - 検証する文字列
   * @param {number} minLength - 最小長さ
   * @param {number} maxLength - 最大長さ
   * @return {boolean} 有効な場合true
   */
  validateStringLength(str, minLength = 0, maxLength = Infinity) {
    if (typeof str !== 'string') {
      return false;
    }
    return str.length >= minLength && str.length <= maxLength;
  },

  /**
   * イベントIDの形式を検証（TimeRexのevent_idは英数字とハイフンのみ）
   * @param {string} eventId - イベントID
   * @return {boolean} 有効な場合true
   */
  isValidEventId(eventId) {
    if (!eventId || typeof eventId !== 'string') {
      return false;
    }
    // TimeRexのevent_idは通常、英数字とハイフンで構成される
    const eventIdRegex = /^[a-zA-Z0-9_-]+$/;
    return eventIdRegex.test(eventId) && eventId.length >= 10 && eventId.length <= 64;
  },

  /**
   * ログ出力（エラーではない通常のログ）
   * @param {string} functionName - 関数名
   * @param {string} message - ログメッセージ
   * @param {Object} context - 追加のコンテキスト情報（オプション）
   */
  log(functionName, message, context = {}) {
    const timestamp = new Date();
    const logMessage = `[${Utils.formatDateTime(timestamp)}] ${functionName}: ${message}`;
    Logger.log(logMessage);
    if (Object.keys(context).length > 0) {
      Logger.log(`Context: ${JSON.stringify(context)}`);
    }
  },

  /**
   * メールアドレスから面談官情報を検索
   * @param {string} email - メールアドレス
   * @param {Array} interviewers - 面談官情報の配列
   * @return {Object|null} 面談官情報またはnull
   */
  findInterviewerByEmail(email, interviewers) {
    if (!email || !interviewers || !Array.isArray(interviewers)) {
      return null;
    }

    return interviewers.find(i => 
      i.googleCalendarId && i.googleCalendarId.toLowerCase() === email.toLowerCase()
    ) || null;
  }
};

