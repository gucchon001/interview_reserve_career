/**
 * TimeRex APIサービス
 * TimeRex APIとの通信を行う（イベント取得、キャンセル等）
 * 
 * 認証: x-api-key ヘッダーでAPIキーを送信
 * ベースURL: https://timerex.net/api/beta
 */

const TimeRexApiService = {
  /**
   * APIキーを取得
   * @return {string|null} APIキー
   */
  _getApiKey() {
    return PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_API_KEY);
  },

  /**
   * APIリクエストの共通ヘッダーを取得
   * @return {Object} ヘッダーオブジェクト
   */
  _getHeaders() {
    const apiKey = this._getApiKey();
    if (!apiKey) {
      throw new Error('TimeRex API key is not configured. Please set TIMEREX_API_KEY in script properties.');
    }

    return {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  },

  /**
   * APIリクエストを実行（リトライ機能付き）
   * @param {string} method - HTTPメソッド（GET, POST, PUT, DELETE）
   * @param {string} endpoint - エンドポイント（例: '/events/{event_id}'）
   * @param {Object} options - オプション（body, queryParams等）
   * @return {Object} レスポンスデータ
   */
  _request(method, endpoint, options = {}) {
    // GETリクエストでキャッシュが有効な場合はキャッシュから取得を試みる
    const useCache = options.useCache !== false && method.toUpperCase() === 'GET';
    if (useCache && typeof globalCacheService !== 'undefined') {
      const cacheKey = `${method}:${endpoint}${options.queryParams ? ':' + JSON.stringify(options.queryParams) : ''}`;
      const cached = globalCacheService.get('timerex_api', cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const maxRetries = Config.SETTINGS.MAX_RETRY_COUNT || 3;
    const retryDelay = Config.SETTINGS.RETRY_DELAY || 10000;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = Config.TIMEREX_API_BASE_URL + endpoint;
        const headers = this._getHeaders();

        // クエリパラメータの処理
        let fullUrl = url;
        if (options.queryParams && Object.keys(options.queryParams).length > 0) {
          const params = new URLSearchParams();
          Object.keys(options.queryParams).forEach(key => {
            if (options.queryParams[key] !== null && options.queryParams[key] !== undefined) {
              params.append(key, String(options.queryParams[key]));
            }
          });
          fullUrl = url + '?' + params.toString();
        }

        const requestOptions = {
          method: method,
          headers: headers,
          muteHttpExceptions: true
        };

        // リクエストボディの追加（POST, PUT, PATCHの場合）
        if (options.body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
          requestOptions.payload = JSON.stringify(options.body);
        }

        const response = UrlFetchApp.fetch(fullUrl, requestOptions);
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

          // GETリクエストの結果をキャッシュに保存（デフォルト5分）
          if (useCache && typeof globalCacheService !== 'undefined') {
            const cacheKey = `${method}:${endpoint}${options.queryParams ? ':' + JSON.stringify(options.queryParams) : ''}`;
            const cacheTtl = options.cacheTtl || 300; // デフォルト5分
            globalCacheService.set('timerex_api', cacheKey, result, cacheTtl);
          }

          return result;
        } else if (statusCode === 401 || statusCode === 403) {
          // 認証エラー: リトライしない
          const error = new Error(`TimeRex API authentication failed (${statusCode})`);
          error.statusCode = statusCode;
          Utils.logError('TimeRexApiService._request', error, {
            endpoint,
            method,
            responseText: responseText.substring(0, 200)
          });
          throw error;
        } else if (statusCode >= 500 && attempt < maxRetries) {
          // サーバーエラー: リトライ
          lastError = new Error(`TimeRex API server error (${statusCode}): ${responseText.substring(0, 200)}`);
          lastError.statusCode = statusCode;
          Utils.logError('TimeRexApiService._request', `Attempt ${attempt}/${maxRetries} failed`, {
            endpoint,
            method,
            statusCode,
            willRetry: attempt < maxRetries
          });
          
          if (attempt < maxRetries) {
            // 指数バックオフ
            const delay = retryDelay * Math.pow(2, attempt - 1);
            Utilities.sleep(delay);
            continue;
          }
        } else {
          // その他のエラー（4xx等）: リトライしない
          const error = new Error(`TimeRex API error (${statusCode}): ${responseText.substring(0, 200)}`);
          error.statusCode = statusCode;
          error.response = Utils.safeJsonParse(responseText);
          Utils.logError('TimeRexApiService._request', error, {
            endpoint,
            method,
            responseText: responseText.substring(0, 200)
          });
          throw error;
        }
      } catch (error) {
        if (error.statusCode && error.statusCode !== 500) {
          // 4xxエラーなど、リトライ不要なエラー
          throw error;
        }
        lastError = error;
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1);
          Utilities.sleep(delay);
        }
      }
    }

    // 全てのリトライが失敗
    Utils.logError('TimeRexApiService._request', 'All retry attempts failed', {
      endpoint,
      method,
      maxRetries
    });
    throw lastError || new Error('TimeRex API request failed after retries');
  },

  /**
   * 日付をTimeRex API用のフォーマット（UTC形式: "YYYY-MM-DD HH:mm:ss"）に変換
   * @param {Date} date - 変換する日付
   * @return {string} フォーマット済み日時文字列
   * @private
   */
  _formatDateForTimeRex(date) {
    if (!(date instanceof Date)) {
      throw new Error('date must be a Date object');
    }
    // UTCに変換してフォーマット（"YYYY-MM-DD HH:mm:ss"形式）
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  /**
   * イベントを取得
   * @param {string} eventId - イベントID
   * @return {Object} イベントデータ
   */
  getEvent(eventId) {
    if (!eventId || typeof eventId !== 'string') {
      throw new Error('eventId is required and must be a string');
    }

    try {
      return this._request('GET', `/events/${eventId}`);
    } catch (error) {
      Utils.logError('TimeRexApiService.getEvent', error, { eventId });
      throw error;
    }
  },

  /**
   * カレンダーのイベント一覧を取得（ページネーション対応）
   * @param {string} calendarId - カレンダーID（calendar_url_path）
   * @param {Object} options - オプション（startDate, endDate, getAllPages等）
   *   - getAllPages: trueの場合、全ページを取得して結合する（デフォルト: true）
   * @return {Object} イベント一覧データ { items: array } または { nextPageToken: string, items: array }
   */
  getCalendarEvents(calendarId, options = {}) {
    if (!calendarId || typeof calendarId !== 'string') {
      throw new Error('calendarId is required and must be a string');
    }

    const getAllPages = options.getAllPages !== false; // デフォルト: true（全ページ取得）

    const queryParams = {};
    if (options.startDate) {
      // TimeRex APIは startTime パラメータを使用（UTC形式: "YYYY-MM-DD HH:mm:ss"）
      queryParams.startTime = options.startDate instanceof Date 
        ? this._formatDateForTimeRex(options.startDate) 
        : options.startDate;
    }
    if (options.endDate) {
      // TimeRex APIは endTime パラメータを使用（UTC形式: "YYYY-MM-DD HH:mm:ss"）
      queryParams.endTime = options.endDate instanceof Date 
        ? this._formatDateForTimeRex(options.endDate) 
        : options.endDate;
    }
    // 注意: statusパラメータはTimeRex APIドキュメントに記載がないため、削除
    // フィルタリングが必要な場合は、レスポンスのitems配列をクライアント側でフィルタリングすること

    try {
      if (getAllPages) {
        // 全ページを取得
        return this._getAllCalendarEventsPages(calendarId, queryParams);
      } else {
        // 最初の1ページのみ取得
        return this._request('GET', `/calendars/${calendarId}/events`, {
          queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined
        });
      }
    } catch (error) {
      Utils.logError('TimeRexApiService.getCalendarEvents', error, { calendarId, options });
      throw error;
    }
  },

  /**
   * カレンダーイベントの全ページを取得して結合
   * @param {string} calendarId - カレンダーID
   * @param {Object} queryParams - クエリパラメータ
   * @return {Object} 全イベントを含むデータ { items: array }
   * @private
   */
  _getAllCalendarEventsPages(calendarId, queryParams) {
    const allItems = [];
    let nextPageToken = null;
    let pageCount = 0;
    const maxPages = 100; // 無限ループ防止（最大100ページ）

    do {
      pageCount++;
      if (pageCount > maxPages) {
        Utils.logError('TimeRexApiService._getAllCalendarEventsPages', new Error('Maximum page count exceeded'), {
          calendarId,
          pageCount
        });
        break;
      }

      const currentQueryParams = { ...queryParams };
      if (nextPageToken) {
        currentQueryParams.nextPageToken = nextPageToken;
      }

      const response = this._request('GET', `/calendars/${calendarId}/events`, {
        queryParams: Object.keys(currentQueryParams).length > 0 ? currentQueryParams : undefined
      });

      // レスポンス形式: { nextPageToken?: string, items: array }
      if (response && response.items && Array.isArray(response.items)) {
        allItems.push(...response.items);
      }

      nextPageToken = response && response.nextPageToken ? response.nextPageToken : null;
    } while (nextPageToken);

    // 全ページを結合した結果を返す
    return {
      items: allItems
    };
  },

  /**
   * イベントをキャンセル
   * @param {string} eventId - イベントID
   * @param {Object} options - オプション
   *   - reason: キャンセル理由（注意: TimeRex APIドキュメントに記載がないため、APIがサポートしているか未確認）
   * @return {Object} キャンセル結果
   */
  cancelEvent(eventId, options = {}) {
    if (!eventId || typeof eventId !== 'string') {
      throw new Error('eventId is required and must be a string');
    }

    // 注意: TimeRex APIドキュメント（2025-12-25時点）にはリクエストボディの記載がない
    // reasonパラメータは実際のAPIがサポートしているか未確認のため、オプションとして残す
    // もしAPIがサポートしていない場合は、このパラメータは無視される
    const body = {};
    if (options.reason) {
      body.reason = String(options.reason);
    }

    try {
      return this._request('POST', `/events/${eventId}/cancel`, {
        body: Object.keys(body).length > 0 ? body : undefined
      });
    } catch (error) {
      Utils.logError('TimeRexApiService.cancelEvent', error, { eventId, options });
      throw error;
    }
  },

  /**
   * 複数のイベントを一括キャンセル
   * @param {string[]} eventIds - イベントIDの配列
   * @param {Object} options - オプション（reason等）
   * @return {Object} 一括キャンセル結果 { success: number, failed: number, errors: Array }
   */
  cancelEventsBatch(eventIds, options = {}) {
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      throw new Error('eventIds is required and must be a non-empty array');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const eventId of eventIds) {
      try {
        this.cancelEvent(eventId, options);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          eventId: eventId,
          error: error.message || error.toString()
        });
        Utils.logError('TimeRexApiService.cancelEventsBatch', error, { eventId });
      }
    }

    return results;
  },

  /**
   * カレンダー情報を取得
   * @param {string} calendarId - カレンダーID（calendar_url_path）
   * @return {Object} カレンダーデータ
   */
  getCalendar(calendarId) {
    if (!calendarId || typeof calendarId !== 'string') {
      throw new Error('calendarId is required and must be a string');
    }

    try {
      return this._request('GET', `/calendars/${calendarId}`);
    } catch (error) {
      Utils.logError('TimeRexApiService.getCalendar', error, { calendarId });
      throw error;
    }
  },

  /**
   * ユーザーのプライマリーチームを取得
   * @return {Object} プライマリーチームデータ
   */
  getUserPrimaryTeam() {
    try {
      const response = this._request('GET', '/user/me/teams/primary');
      Logger.log(`[TimeRexApiService] Primary team response type: ${typeof response}`);
      Logger.log(`[TimeRexApiService] Primary team response keys: ${response ? Object.keys(response).join(', ') : 'null'}`);
      if (response) {
        Logger.log(`[TimeRexApiService] Primary team response (first 500 chars): ${JSON.stringify(response).substring(0, 500)}`);
      }
      return response;
    } catch (error) {
      Utils.logError('TimeRexApiService.getUserPrimaryTeam', error);
      throw error;
    }
  },

  /**
   * ユーザーのチーム一覧を取得
   * @return {Array} チーム一覧データ
   */
  getUserTeams() {
    try {
      const response = this._request('GET', '/user/me/teams');
      Logger.log(`[TimeRexApiService] User teams response type: ${typeof response}`);
      Logger.log(`[TimeRexApiService] User teams response keys: ${response ? Object.keys(response).join(', ') : 'null'}`);
      return response;
    } catch (error) {
      Utils.logError('TimeRexApiService.getUserTeams', error);
      throw error;
    }
  },

  /**
   * チーム情報を取得
   * @param {string} teamId - チームID（MongoDB ObjectId形式）
   * @return {Object} チームデータ
   */
  getTeam(teamId) {
    if (!teamId || typeof teamId !== 'string') {
      throw new Error('teamId is required and must be a string');
    }

    try {
      Logger.log(`[TimeRexApiService] Getting team info for teamId: ${teamId}`);
      return this._request('GET', `/teams/${teamId}`);
    } catch (error) {
      Utils.logError('TimeRexApiService.getTeam', error, { teamId });
      throw error;
    }
  },

  /**
   * チームのカレンダー一覧を取得
   * @param {string} teamId - チームID（MongoDB ObjectId形式の数値ID）
   * @return {Object} カレンダー一覧データ
   */
  getTeamCalendars(teamId) {
    if (!teamId) {
      throw new Error('teamId is required');
    }

    try {
      Logger.log(`[TimeRexApiService] Getting calendars for teamId: ${teamId} (type: ${typeof teamId})`);
      // team_idはMongoDB ObjectId形式（24文字の16進数文字列）である必要がある
      return this._request('GET', `/teams/${teamId}/calendars`);
    } catch (error) {
      Utils.logError('TimeRexApiService.getTeamCalendars', error, { teamId });
      throw error;
    }
  },

  /**
   * プライマリーチームのカレンダー一覧を取得（推奨）
   * @return {Object} カレンダー一覧データ
   */
  getPrimaryTeamCalendars() {
    try {
      // ログから、getUserTeams()で取得したチームのidが正しいteam_id（日程調整API用team_id）であることが分かっている
      // まずgetUserTeams()でチーム一覧を取得
      Logger.log(`[TimeRexApiService] Fetching user teams to get correct team_id...`);
      const userTeams = this.getUserTeams();
      
      // レスポンスからチーム一覧を取得
      let teamsList = [];
      if (Array.isArray(userTeams)) {
        teamsList = userTeams;
      } else if (userTeams && userTeams.items && Array.isArray(userTeams.items)) {
        teamsList = userTeams.items;
      } else if (userTeams && userTeams.data && Array.isArray(userTeams.data)) {
        teamsList = userTeams.data;
      } else if (userTeams && userTeams.teams && Array.isArray(userTeams.teams)) {
        teamsList = userTeams.teams;
      }
      
      Logger.log(`[TimeRexApiService] Found ${teamsList.length} teams from getUserTeams()`);
      
      if (teamsList.length === 0) {
        throw new Error('No teams found in user teams response');
      }
      
      // 最初のチーム（またはプライマリーチーム）を使用
      let selectedTeam = teamsList[0];
      
      // プライマリーチームを探す
      for (const team of teamsList) {
        if (team.is_primary === true) {
          selectedTeam = team;
          Logger.log(`[TimeRexApiService] Found primary team: ${team.name || team.id}`);
          break;
        }
      }
      
      // チームのidを取得（これが正しいteam_id = 日程調整API用team_id）
      // ログから、selectedTeam.idが"26a251ae9cf9cd67fc85"（日程調整API用team_id）であることが確認されている
      const teamId = selectedTeam.id;
      
      if (!teamId) {
        Logger.log(`[TimeRexApiService] Could not extract team_id. Team object: ${JSON.stringify(selectedTeam).substring(0, 500)}`);
        throw new Error('Could not extract team_id from user teams response. Please check the API response structure.');
      }

      Logger.log(`[TimeRexApiService] Using team_id from getUserTeams(): ${teamId} (type: ${typeof teamId}, length: ${teamId ? teamId.length : 'N/A'})`);
      Logger.log(`[TimeRexApiService] Team name: ${selectedTeam.name || 'N/A'}, url_path: ${selectedTeam.url_path || 'N/A'}`);
      Logger.log(`[TimeRexApiService] This should match the "日程調整API用team_id" from TimeRex settings: ${teamId}`);
      
      // team_id（日程調整API用team_id）を使ってカレンダー一覧を取得
      // エンドポイント: GET /api/beta/teams/{team_id}/calendars
      return this._request('GET', `/teams/${teamId}/calendars`);
    } catch (error) {
      Utils.logError('TimeRexApiService.getPrimaryTeamCalendars', error);
      throw error;
    }
  }
};

