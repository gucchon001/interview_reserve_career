/**
 * LステップAPIサービス
 * LステップAPIとの通信を行う（友だち情報更新、タグ設置等）
 * 
 * 認証: Bearer トークン（APIキー）
 * ベースURL: https://api.lineml.jp/v1（Config.LSTEP_API_BASE_URL）
 */

const LStepApiService = {
  /**
   * APIキーを取得
   * @return {string|null} APIキー
   */
  _getApiKey() {
    return PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.LSTEP_API_KEY);
  },

  /**
   * APIリクエストの共通ヘッダーを取得
   * @return {Object} ヘッダーオブジェクト
   */
  _getHeaders() {
    const apiKey = this._getApiKey();
    if (!apiKey) {
      throw new Error('LステップAPIトークンが設定されていません。LSTEP_API_TOKENをスクリプトプロパティに設定してください。');
    }

    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  },

  /**
   * APIリクエストを実行（リトライ機能付き、指数バックオフ）
   * @param {string} method - HTTPメソッド（GET, POST, PUT, DELETE）
   * @param {string} endpoint - エンドポイント（例: '/friend/update'）
   * @param {Object} options - オプション（body等）
   * @return {Object} レスポンスデータ
   */
  _request(method, endpoint, options = {}) {
    const maxRetries = Config.SETTINGS.MAX_RETRY_COUNT || 3;
    const baseRetryDelay = 1000; // 1秒
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = Config.LSTEP_API_BASE_URL + endpoint;
        const headers = this._getHeaders();

        const requestOptions = {
          method: method,
          headers: headers,
          muteHttpExceptions: true
        };

        // リクエストボディの追加（POST, PUT, PATCHの場合）
        if (options.body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
          requestOptions.payload = JSON.stringify(options.body);
        }

        const response = UrlFetchApp.fetch(url, requestOptions);
        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        // ステータスコードチェック
        if (statusCode >= 200 && statusCode < 300) {
          // 成功
          let result;
          if (responseText) {
            result = Utils.safeJsonParse(responseText);
          } else {
            result = { success: true };
          }

          Logger.log(`[LStepApiService] API呼び出し成功: ${method} ${endpoint} (ステータス: ${statusCode})`);
          return result;
        } else {
          // エラーレスポンス（空ボディの場合はパースしない）
          const errorData = (responseText && responseText.trim())
            ? (Utils.safeJsonParse(responseText) || { message: responseText })
            : { message: responseText || '' };
          const error = new Error(`LステップAPIエラー: ${statusCode} - ${JSON.stringify(errorData)}`);
          
          // 429 (Rate Limit) または 5xx エラーの場合のみリトライ
          if ((statusCode === 429 || statusCode >= 500) && attempt < maxRetries) {
            // 指数バックオフ: 1秒, 2秒, 4秒...
            const retryDelay = baseRetryDelay * Math.pow(2, attempt - 1);
            Logger.log(`[LStepApiService] リトライ ${attempt}/${maxRetries} (${retryDelay}ms待機): ${error.message}`);
            Utilities.sleep(retryDelay);
            lastError = error;
            continue;
          } else {
            // リトライしないエラーまたは最大リトライ回数に達した場合
            Logger.log(`[LStepApiService] API呼び出し失敗: ${method} ${endpoint} (ステータス: ${statusCode})`);
            throw error;
          }
        }
      } catch (error) {
        // ネットワークエラー等の場合
        if (attempt < maxRetries) {
          const retryDelay = baseRetryDelay * Math.pow(2, attempt - 1);
          Logger.log(`[LStepApiService] リトライ ${attempt}/${maxRetries} (${retryDelay}ms待機): ${error.message}`);
          Utilities.sleep(retryDelay);
          lastError = error;
          continue;
        } else {
          Logger.log(`[LStepApiService] API呼び出し失敗（最大リトライ回数に達しました）: ${method} ${endpoint}`);
          throw error;
        }
      }
    }

    // ここに到達することは通常ないが、念のため
    throw lastError || new Error('LステップAPI呼び出しに失敗しました');
  },

  /**
   * 友だち情報を更新
   * @param {string} identifier - LINEユーザーID（uid）またはLステップID（lstepid）
   * @param {Object} data - 更新する友だち情報
   * @param {string|null} data.meeting_date - 面談日時（Lステップ形式: "YYYY-MM-DD HH:mm:ss"）
   * @param {string|null} data.meeting_url - ミーティングURL
   * @param {boolean} useLstepId - trueの場合、identifierをlstepidとして扱う（デフォルト: false、uidとして扱う）
   * @return {Object} APIレスポンス
   */
  updateFriendInfo(identifier, data, useLstepId = false) {
    if (!identifier) {
      throw new Error('識別子（uidまたはlstepid）が指定されていません');
    }

    try {
      const idType = useLstepId ? 'lstepid' : 'uid';
      Logger.log(`[LStepApiService] 友だち情報更新: ${idType}=${identifier}, data=${JSON.stringify(data)}`);

      const payload = {
        [idType]: identifier,
        ...data
      };

      const result = this._request('POST', '/friend/update', {
        body: payload
      });

      Logger.log(`[LStepApiService] 友だち情報更新成功: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      Logger.log(`[LStepApiService] 友だち情報更新エラー: ${error.message}`);
      Utils.logError('LStepApiService.updateFriendInfo', error, { identifier, data, useLstepId });
      throw error;
    }
  },

  /**
   * タグを追加
   * @param {string} identifier - LINEユーザーID（uid）またはLステップID（lstepid）
   * @param {string} tagName - タグ名
   * @param {boolean} useLstepId - trueの場合、identifierをlstepidとして扱う（デフォルト: false、uidとして扱う）
   * @return {Object} APIレスポンス
   */
  addTag(identifier, tagName, useLstepId = false) {
    if (!identifier) {
      throw new Error('識別子（uidまたはlstepid）が指定されていません');
    }
    if (!tagName) {
      throw new Error('タグ名が指定されていません');
    }

    try {
      const idType = useLstepId ? 'lstepid' : 'uid';
      Logger.log(`[LStepApiService] タグ追加: ${idType}=${identifier}, tagName=${tagName}`);

      // LステップAPIのタグ追加エンドポイント（仕様要確認）
      // 一般的なパターン: /friend/{uid}/tag または /tag/add
      const payload = {
        [idType]: identifier,
        tag: tagName
      };

      // エンドポイントは実際のLステップAPI仕様に合わせて調整が必要
      // 仮の実装: /friend/tag/add を想定
      const result = this._request('POST', '/friend/tag/add', {
        body: payload
      });

      Logger.log(`[LStepApiService] タグ追加成功: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      Logger.log(`[LStepApiService] タグ追加エラー: ${error.message}`);
      Utils.logError('LStepApiService.addTag', error, { identifier, tagName, useLstepId });
      // タグ追加失敗は予約処理を止めない（警告のみ）
      // throw error; // コメントアウト: エラーを再スローしない
      return null;
    }
  },

  /**
   * タグを削除
   * @param {string} identifier - LINEユーザーID（uid）またはLステップID（lstepid）
   * @param {string} tagName - タグ名
   * @param {boolean} useLstepId - trueの場合、identifierをlstepidとして扱う（デフォルト: false、uidとして扱う）
   * @return {Object} APIレスポンス
   */
  removeTag(identifier, tagName, useLstepId = false) {
    if (!identifier) {
      throw new Error('識別子（uidまたはlstepid）が指定されていません');
    }
    if (!tagName) {
      throw new Error('タグ名が指定されていません');
    }

    try {
      const idType = useLstepId ? 'lstepid' : 'uid';
      Logger.log(`[LStepApiService] タグ削除: ${idType}=${identifier}, tagName=${tagName}`);

      const payload = {
        [idType]: identifier,
        tag: tagName
      };

      // エンドポイントは実際のLステップAPI仕様に合わせて調整が必要
      // 仮の実装: /friend/tag/remove を想定
      const result = this._request('POST', '/friend/tag/remove', {
        body: payload
      });

      Logger.log(`[LStepApiService] タグ削除成功: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      Logger.log(`[LStepApiService] タグ削除エラー: ${error.message}`);
      Utils.logError('LStepApiService.removeTag', error, { identifier, tagName, useLstepId });
      // タグ削除失敗は予約処理を止めない（警告のみ）
      // throw error; // コメントアウト: エラーを再スローしない
      return null;
    }
  },

  /**
   * 日時をLステップ形式にフォーマット
   * TIMEREX形式（ISO8601） → Lステップ形式（"YYYY-MM-DD HH:mm:ss"）
   * @param {Date|string} datetime - 日時（DateオブジェクトまたはISO8601文字列）
   * @return {string} フォーマットされた日時文字列
   */
  formatDateTimeForLStep(datetime) {
    let date;
    
    if (datetime instanceof Date) {
      date = datetime;
    } else if (typeof datetime === 'string') {
      date = Utils.parseISO8601(datetime);
      if (!date) {
        throw new Error(`無効な日時形式: ${datetime}`);
      }
    } else {
      throw new Error(`無効な日時型: ${typeof datetime}`);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  /**
   * トリガーURLへPOSTして友だち情報更新・タグを反映する（/friend/update が利用できない契約向け）
   * L-step エンドポイントの「パラメータ管理」で登録したJSONキー（meeting_date, meeting_url, meeting_cancel_url, tag 等）をそのまま送る
   * @param {string} uid - LINEユーザーID
   * @param {Object} data - 送信するデータ（meeting_date, meeting_url, meeting_cancel_url, tag 等。null でクリア）
   * @return {Object} レスポンス data
   */
  triggerFriendUpdate(uid, data) {
    if (!uid) {
      throw new Error('uidが指定されていません');
    }
    const apiKey = this._getApiKey();
    const triggerUrl = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.LSTEP_TRIGGER_URL)
      || (Config.LSTEP_TRIGGER_URL_DEFAULT && Config.LSTEP_TRIGGER_URL_DEFAULT.trim()) || '';
    if (!triggerUrl) {
      throw new Error('LステップトリガーURLが設定されていません。LSTEP_TRIGGER_URL または Config.LSTEP_TRIGGER_URL_DEFAULT を設定してください。');
    }
    const payload = { uid: uid };
    if (data && typeof data === 'object') {
      if (Object.prototype.hasOwnProperty.call(data, 'meeting_date')) payload.meeting_date = data.meeting_date;
      if (Object.prototype.hasOwnProperty.call(data, 'meeting_url')) payload.meeting_url = data.meeting_url;
      if (Object.prototype.hasOwnProperty.call(data, 'meeting_cancel_url')) payload.meeting_cancel_url = data.meeting_cancel_url;
      if (Object.prototype.hasOwnProperty.call(data, 'tag')) payload.tag = data.tag;
    }
    const maxRetries = Config.SETTINGS.MAX_RETRY_COUNT || 3;
    const baseRetryDelay = 1000;
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const options = {
          method: 'post',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };
        const response = UrlFetchApp.fetch(triggerUrl, options);
        const code = response.getResponseCode();
        const text = response.getContentText();
        if (code >= 200 && code < 300) {
          Logger.log(`[LStepApiService] トリガーURL呼び出し成功: uid=${uid} (HTTP ${code})`);
          return text ? (Utils.safeJsonParse(text) || {}) : {};
        }
        const errData = (text && text.trim()) ? (Utils.safeJsonParse(text) || { message: text }) : { message: '' };
        const error = new Error(`LステップトリガーAPIエラー: ${code} - ${JSON.stringify(errData)}`);
        if ((code === 429 || code >= 500) && attempt < maxRetries) {
          const delay = baseRetryDelay * Math.pow(2, attempt - 1);
          Logger.log(`[LStepApiService] リトライ ${attempt}/${maxRetries} (${delay}ms): ${error.message}`);
          Utilities.sleep(delay);
          lastError = error;
          continue;
        }
        Logger.log(`[LStepApiService] トリガーURL呼び出し失敗: ${error.message}`);
        throw error;
      } catch (e) {
        if (attempt < maxRetries) {
          const delay = baseRetryDelay * Math.pow(2, attempt - 1);
          Logger.log(`[LStepApiService] リトライ ${attempt}/${maxRetries} (${delay}ms): ${e.message}`);
          Utilities.sleep(delay);
          lastError = e;
          continue;
        }
        Utils.logError('LStepApiService.triggerFriendUpdate', e, { uid, data });
        throw e;
      }
    }
    throw lastError || new Error('LステップトリガーURL呼び出しに失敗しました');
  }
};
