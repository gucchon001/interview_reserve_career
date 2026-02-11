/**
 * スクリプトプロパティ管理サービス
 * APIキーや設定値をPropertiesServiceで安全に管理
 */

const PropertyService = {
  /**
   * スクリプトプロパティを取得
   * @param {string} key - プロパティキー（Config.PROPERTY_KEYSから取得）
   * @param {string} defaultValue - デフォルト値（オプション）
   * @return {string|null} プロパティ値
   */
  get(key, defaultValue = null) {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    return value !== null ? value : defaultValue;
  },

  /**
   * スクリプトプロパティを設定
   * @param {string} key - プロパティキー
   * @param {string} value - プロパティ値
   */
  set(key, value) {
    PropertiesService.getScriptProperties().setProperty(key, value);
  },

  /**
   * 複数のスクリプトプロパティを一括設定
   * @param {Object} properties - { key: value } 形式のオブジェクト
   */
  setBatch(properties) {
    PropertiesService.getScriptProperties().setProperties(properties);
  },

  /**
   * スクリプトプロパティを削除
   * @param {string} key - プロパティキー
   */
  delete(key) {
    PropertiesService.getScriptProperties().deleteProperty(key);
  },

  /**
   * すべてのスクリプトプロパティを取得
   * @return {Object} すべてのプロパティのオブジェクト
   */
  getAll() {
    return PropertiesService.getScriptProperties().getProperties();
  },

  /**
   * 必須プロパティが設定されているか確認
   * @param {string[]} requiredKeys - 必須キーの配列
   * @return {Object} { valid: boolean, missing: string[] }
   */
  validateRequired(requiredKeys) {
    const props = PropertyService.getAll();
    const missing = requiredKeys.filter(key => !props[key]);
    return {
      valid: missing.length === 0,
      missing: missing
    };
  }
};

/**
 * 初期設定用関数（手動実行）
 * スクリプトエディタで実行して、必要なプロパティを設定
 * 
 * 使用例:
 * setScriptProperties({
 *   TIMEREX_TEAM_URL_PATH: 'y-haraguchi_6612',           // TimeRexチームURLパス
 *   TIMEREX_TEAM_CALENDAR_URL_PATH: '23a9cb5e',          // 統合カレンダーのURLパス（必須）
 *   // TIMEREX_WEBHOOK_TOKEN: 'your-webhook-token',      // オプション: TimeRex設定画面で確認できる場合のみ設定
 *   TIMEREX_API_KEY: 'your-api-key',                     // TimeRex APIキー（管理画面用）
 *   SPREADSHEET_ID: 'your-spreadsheet-id',               // オプション: スクリプトがスプレッドシートに紐づいている場合は不要
 *   LINE_ACCESS_TOKEN: 'your-line-token'                 // オプション（LINE連携が必要な場合）
 * });
 */
function setScriptProperties(properties) {
  try {
    PropertyService.setBatch(properties);
    Logger.log('Script properties set successfully');
    Logger.log('Set keys: ' + Object.keys(properties).join(', '));
    return {
      success: true,
      message: 'Script properties set successfully',
      keys: Object.keys(properties)
    };
  } catch (error) {
    Utils.logError('setScriptProperties', error, { properties });
    throw error;
  }
}

/**
 * 現在のスクリプトプロパティを確認（デバッグ用）
 * 注意: 機密情報が含まれるため、本番環境では使用しないこと
 */
function getScriptProperties() {
  const props = PropertyService.getAll();
  const keys = Object.keys(props);
  Logger.log('Current script properties:');
  keys.forEach(key => {
    // セキュリティのため、値の一部のみ表示
    const value = props[key];
    const maskedValue = value ? value.substring(0, 4) + '...' : '(empty)';
    Logger.log(`  ${key}: ${maskedValue}`);
  });
  return {
    keys: keys,
    count: keys.length
  };
}

/**
 * 必須プロパティの設定状況を確認
 * 注意: TIMEREX_WEBHOOK_TOKENはオプション（TimeRexのWebhook設定画面で確認できない可能性があるため）
 */
function validateScriptProperties() {
  const requiredKeys = [
    Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH,
    Config.PROPERTY_KEYS.TIMEREX_TEAM_CALENDAR_URL_PATH // 統合カレンダーURL（必須）
    // TIMEREX_CALENDAR_URL_PATH: 非推奨（個別カレンダーはinterviewersシートで管理）
    // TIMEREX_WEBHOOK_TOKEN: オプション（TimeRex設定画面で確認できる場合のみ設定）
    // SPREADSHEET_ID: オプション（スクリプトがスプレッドシートに紐づいている場合は不要）
  ];

  const validation = PropertyService.validateRequired(requiredKeys);
  
  // オプション項目の確認
  const optionalKeys = {
    [Config.PROPERTY_KEYS.TIMEREX_WEBHOOK_TOKEN]: 'Webhookセキュリティトークン（推奨）',
    [Config.PROPERTY_KEYS.SPREADSHEET_ID]: 'スプレッドシートID（必要に応じて）'
  };
  const optionalStatus = {};
  Object.keys(optionalKeys).forEach(key => {
    optionalStatus[key] = PropertyService.get(key) ? '設定済み' : '未設定';
  });
  
  if (validation.valid) {
    Logger.log('✓ All required script properties are set');
    Logger.log('Optional properties:');
    Object.keys(optionalStatus).forEach(key => {
      Logger.log(`  ${key}: ${optionalStatus[key]} ${optionalKeys[key]}`);
    });
    return { 
      valid: true, 
      message: 'All required properties are set',
      optional: optionalStatus
    };
  } else {
    Logger.log('✗ Missing required script properties: ' + validation.missing.join(', '));
    return {
      valid: false,
      message: 'Missing required properties',
      missing: validation.missing,
      optional: optionalStatus
    };
  }
}

