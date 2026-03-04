/**
 * スプレッドシート操作サービス
 * シートの取得、データの読み書きを担当
 */

const SpreadsheetService = {
  /**
   * スプレッドシートを取得
   * @return {Spreadsheet} スプレッドシートオブジェクト
   */
  getSpreadsheet() {
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.SPREADSHEET_ID);
    if (spreadsheetId) {
      try {
        return SpreadsheetApp.openById(spreadsheetId);
      } catch (e) {
        Utils.logError('SpreadsheetService.getSpreadsheet', e, { spreadsheetId });
        throw new Error(Config.ERROR_MESSAGES.SHEET_NOT_FOUND);
      }
    }
    // IDが設定されていない場合は、スクリプトが紐づいているスプレッドシートを使用
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  /**
   * シートを取得
   * @param {string} sheetName - シート名
   * @return {Sheet} シートオブジェクト
   */
  getSheet(sheetName) {
    const ss = SpreadsheetService.getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`${Config.ERROR_MESSAGES.SHEET_NOT_FOUND}: ${sheetName}`);
    }
    return sheet;
  },

  /**
   * interviewsシートに予約データを追加
   * @param {Object} interviewData - 予約データ
   * @param {Date} interviewData.createdAt - 作成日時
   * @param {Date} interviewData.startAt - 開始日時
   * @param {Date} interviewData.endAt - 終了日時
   * @param {string} interviewData.guestName - ゲスト名
   * @param {string} interviewData.guestEmail - ゲストメールアドレス
   * @param {string} interviewData.meetUrl - ミーティングURL
   * @param {string} interviewData.lineUid - LINEユーザーID
   * @param {string} interviewData.source - 予約元（TimeRex/Manual）
   * @param {string} interviewData.eventId - TimeRexイベントID（オプション）
   * @param {string} interviewData.teamUrlPath - チームURLパス（オプション）
   * @param {string} interviewData.calendarUrlPath - カレンダーURLパス（オプション）
   * @param {number} interviewData.status - ステータス（1:確定、3:キャンセル）
   * @return {number} 追加された行番号
   */
  appendInterview(interviewData) {
    try {
      Logger.log('========================================');
      Logger.log('[SpreadsheetService] ===== appendInterview CALLED =====');
      Logger.log(`[SpreadsheetService] Timestamp: ${new Date().toISOString()}`);
      Logger.log(`[SpreadsheetService] Event ID: ${interviewData.eventId || '(not provided)'}`);
      Logger.log(`[SpreadsheetService] Guest: ${interviewData.guestName || '(no name)'} (${interviewData.guestEmail || 'no email'})`);
      Logger.log(`[SpreadsheetService] Start: ${interviewData.startAt ? interviewData.startAt.toISOString() : 'null'}`);
      Logger.log(`[SpreadsheetService] Interviewer ID: ${interviewData.interviewerId || '(not found)'}`);
      
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
      Logger.log(`[SpreadsheetService] Sheet found: ${sheet.getName()}`);
      
      const row = [
        interviewData.createdAt || new Date(),
        interviewData.startAt || null,
        interviewData.endAt || null,
        interviewData.guestName || '',
        interviewData.guestEmail || '',
        interviewData.meetUrl || '',
        interviewData.lineUid || '',
        interviewData.source || Config.SOURCE.TIMEREX,
        interviewData.eventId || '',
        interviewData.teamUrlPath || '',
        interviewData.calendarUrlPath || '',
        interviewData.status !== undefined ? interviewData.status : Config.EVENT_STATUS.CONFIRMED,
        interviewData.interviewerId || '' // M列: interviewer_id
      ];

      Logger.log(`[SpreadsheetService] Row data prepared: ${row.length} columns`);
      Logger.log(`[SpreadsheetService] Row preview: [${row.slice(0, 3).map(v => v instanceof Date ? v.toISOString() : v).join(', ')}, ...]`);
      
      const beforeRowCount = sheet.getLastRow();
      Logger.log(`[SpreadsheetService] Rows before append: ${beforeRowCount}`);
      
      sheet.appendRow(row);
      
      const afterRowCount = sheet.getLastRow();
      Logger.log(`[SpreadsheetService] Rows after append: ${afterRowCount}`);
      Logger.log(`[SpreadsheetService] Successfully appended row: ${afterRowCount}`);
      
      return afterRowCount;
    } catch (e) {
      Logger.log(`[SpreadsheetService] ERROR in appendInterview: ${e.toString()}`);
      Logger.log(`[SpreadsheetService] Error stack: ${e.stack || 'No stack trace'}`);
      Utils.logError('SpreadsheetService.appendInterview', e, { interviewData });
      throw e;
    }
  },

  /**
   * event_idで予約を検索
   * @param {string} eventId - TimeRexイベントID
   * @return {Object|null} { rowIndex: number, data: Object } または null
   */
  findInterviewByEventId(eventId) {
    if (!eventId) {
      return null;
    }

    try {
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      // ヘッダー行をスキップ（2行目から検索）
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const colIndex = Config.INTERVIEWS_COLUMNS.EVENT_ID - 1;
        if (row[colIndex] === eventId) {
          return {
            rowIndex: i + 1, // 行番号は1ベース
            data: {
              createdAt: row[Config.INTERVIEWS_COLUMNS.CREATED_AT - 1],
              startAt: row[Config.INTERVIEWS_COLUMNS.START_AT - 1],
              endAt: row[Config.INTERVIEWS_COLUMNS.END_AT - 1],
              guestName: row[Config.INTERVIEWS_COLUMNS.GUEST_NAME - 1],
              guestEmail: row[Config.INTERVIEWS_COLUMNS.GUEST_EMAIL - 1],
              meetUrl: row[Config.INTERVIEWS_COLUMNS.MEET_URL - 1],
              lineUid: row[Config.INTERVIEWS_COLUMNS.LINE_UID - 1],
              source: row[Config.INTERVIEWS_COLUMNS.SOURCE - 1],
              eventId: row[Config.INTERVIEWS_COLUMNS.EVENT_ID - 1],
              teamUrlPath: row[Config.INTERVIEWS_COLUMNS.TEAM_URL_PATH - 1],
              calendarUrlPath: row[Config.INTERVIEWS_COLUMNS.CALENDAR_URL_PATH - 1],
              status: row[Config.INTERVIEWS_COLUMNS.STATUS - 1],
              interviewerId: row[Config.INTERVIEWS_COLUMNS.INTERVIEWER_ID - 1]
            }
          };
        }
      }

      return null;
    } catch (e) {
      Utils.logError('SpreadsheetService.findInterviewByEventId', e, { eventId });
      return null;
    }
  },

  /**
   * guest_emailとstartAtで予約を検索（重複チェック用）
   * @param {string} guestEmail - ゲストメールアドレス
   * @param {Date} startAt - 開始日時
   * @return {Object|null} { rowIndex: number, data: Object } または null
   */
  findInterviewByGuestEmailAndTime(guestEmail, startAt) {
    if (!guestEmail || !startAt) {
      return null;
    }

    try {
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      // 開始時刻を比較するための許容誤差（1分以内）
      const tolerance = 60 * 1000; // 1分（ミリ秒）
      const startTime = startAt.getTime();

      // ヘッダー行をスキップ
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowGuestEmail = row[Config.INTERVIEWS_COLUMNS.GUEST_EMAIL - 1];
        const rowStartAt = row[Config.INTERVIEWS_COLUMNS.START_AT - 1];
        
        // メールアドレスが一致し、開始時刻が1分以内の差であれば重複とみなす
        if (rowGuestEmail && rowGuestEmail.toLowerCase() === guestEmail.toLowerCase()) {
          if (rowStartAt instanceof Date) {
            const rowStartTime = rowStartAt.getTime();
            if (Math.abs(rowStartTime - startTime) <= tolerance) {
              return {
                rowIndex: i + 1,
                data: {
                  createdAt: row[Config.INTERVIEWS_COLUMNS.CREATED_AT - 1],
                  startAt: row[Config.INTERVIEWS_COLUMNS.START_AT - 1],
                  endAt: row[Config.INTERVIEWS_COLUMNS.END_AT - 1],
                  guestName: row[Config.INTERVIEWS_COLUMNS.GUEST_NAME - 1],
                  guestEmail: row[Config.INTERVIEWS_COLUMNS.GUEST_EMAIL - 1],
                  meetUrl: row[Config.INTERVIEWS_COLUMNS.MEET_URL - 1],
                  lineUid: row[Config.INTERVIEWS_COLUMNS.LINE_UID - 1],
                  source: row[Config.INTERVIEWS_COLUMNS.SOURCE - 1],
                  eventId: row[Config.INTERVIEWS_COLUMNS.EVENT_ID - 1],
                  teamUrlPath: row[Config.INTERVIEWS_COLUMNS.TEAM_URL_PATH - 1],
                  calendarUrlPath: row[Config.INTERVIEWS_COLUMNS.CALENDAR_URL_PATH - 1],
                  status: row[Config.INTERVIEWS_COLUMNS.STATUS - 1],
                  interviewerId: row[Config.INTERVIEWS_COLUMNS.INTERVIEWER_ID - 1]
                }
              };
            }
          }
        }
      }

      return null;
    } catch (e) {
      Utils.logError('SpreadsheetService.findInterviewByGuestEmailAndTime', e, { guestEmail, startAt });
      return null;
    }
  },

  /**
   * メールアドレスで有効な予約（キャンセルされていない）を検索（多重予約ブロック用）
   * @param {string} guestEmail - ゲストメールアドレス
   * @return {Object|null} { rowIndex: number, data: Object } または null
   */
  findActiveInterviewByGuestEmail(guestEmail) {
    if (!guestEmail) {
      return null;
    }

    try {
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      // ヘッダー行をスキップ
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const rowGuestEmail = row[Config.INTERVIEWS_COLUMNS.GUEST_EMAIL - 1];
        const rowStatus = row[Config.INTERVIEWS_COLUMNS.STATUS - 1];
        
        // メールアドレスが一致し、ステータスが確定（1）のもののみ
        if (rowGuestEmail && rowGuestEmail.toLowerCase() === guestEmail.toLowerCase()) {
          if (rowStatus === Config.EVENT_STATUS.CONFIRMED) {
            return {
              rowIndex: i + 1,
              data: {
                createdAt: row[Config.INTERVIEWS_COLUMNS.CREATED_AT - 1],
                startAt: row[Config.INTERVIEWS_COLUMNS.START_AT - 1],
                endAt: row[Config.INTERVIEWS_COLUMNS.END_AT - 1],
                guestName: row[Config.INTERVIEWS_COLUMNS.GUEST_NAME - 1],
                guestEmail: row[Config.INTERVIEWS_COLUMNS.GUEST_EMAIL - 1],
                meetUrl: row[Config.INTERVIEWS_COLUMNS.MEET_URL - 1],
                lineUid: row[Config.INTERVIEWS_COLUMNS.LINE_UID - 1],
                source: row[Config.INTERVIEWS_COLUMNS.SOURCE - 1],
                eventId: row[Config.INTERVIEWS_COLUMNS.EVENT_ID - 1],
                teamUrlPath: row[Config.INTERVIEWS_COLUMNS.TEAM_URL_PATH - 1],
                calendarUrlPath: row[Config.INTERVIEWS_COLUMNS.CALENDAR_URL_PATH - 1],
                status: row[Config.INTERVIEWS_COLUMNS.STATUS - 1],
                interviewerId: row[Config.INTERVIEWS_COLUMNS.INTERVIEWER_ID - 1]
              }
            };
          }
        }
      }

      return null;
    } catch (e) {
      Utils.logError('SpreadsheetService.findActiveInterviewByGuestEmail', e, { guestEmail });
      return null;
    }
  },

  /**
   * 予約のステータスを更新
   * @param {number|string} rowIndexOrEventId - 更新する行番号またはeventId
   * @param {number} status - 新しいステータス
   * @return {boolean} 更新に成功した場合true
   */
  updateInterviewStatus(rowIndexOrEventId, status) {
    try {
      let rowIndex;

      // eventIdが渡された場合は検索
      if (typeof rowIndexOrEventId === 'string') {
        const interview = SpreadsheetService.findInterviewByEventId(rowIndexOrEventId);
        if (!interview) {
          Utils.log('SpreadsheetService.updateInterviewStatus', `Interview not found for eventId: ${rowIndexOrEventId}`);
          return false;
        }
        rowIndex = interview.rowIndex;
      } else {
        rowIndex = rowIndexOrEventId;
      }

      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
      const colIndex = Config.INTERVIEWS_COLUMNS.STATUS;
      sheet.getRange(rowIndex, colIndex).setValue(status);
      
      // キャッシュをクリア（存在する場合）
      try {
        if (typeof globalCacheService !== 'undefined') {
          globalCacheService.clearByPrefix('interviews');
        }
      } catch (e) {
        // キャッシュクリアの失敗は無視
      }

      return true;
    } catch (e) {
      Utils.logError('SpreadsheetService.updateInterviewStatus', e, { rowIndexOrEventId, status });
      throw e;
    }
  },


  /**
   * 実行ユーザーを自動的にinterviewersシートに登録（重複チェック付き）
   * @param {string} email - メールアドレス
   * @return {Object} { isNew: boolean, interviewer: Object|null }
   */
  registerInterviewerByEmail(email) {
    try {
      if (!email || !Utils.isValidEmail(email)) {
        Utils.logError('SpreadsheetService.registerInterviewerByEmail', new Error('Invalid email'), { email });
        return { isNew: false, interviewer: null };
      }
      
      // interviewersシートを取得
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWERS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      // 重複チェック（google_calendar_id列で検索）
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const calendarId = row[Config.INTERVIEWERS_COLUMNS.GOOGLE_CALENDAR_ID - 1];
        if (calendarId && calendarId.toLowerCase() === email.toLowerCase()) {
          // 既に登録済み
          const priority = row[Config.INTERVIEWERS_COLUMNS.PRIORITY - 1];
          return {
            isNew: false,
            interviewer: {
              id: row[Config.INTERVIEWERS_COLUMNS.ID - 1],
              name: row[Config.INTERVIEWERS_COLUMNS.NAME - 1],
              timerexConfigId: row[Config.INTERVIEWERS_COLUMNS.TIMEREX_CONFIG_ID - 1],
              googleCalendarId: row[Config.INTERVIEWERS_COLUMNS.GOOGLE_CALENDAR_ID - 1],
              slackMemberId: (row[Config.INTERVIEWERS_COLUMNS.SLACK_MEMBER_ID - 1] || '').toString().trim(),
              priority: priority !== '' && priority !== null && priority !== undefined
                        ? Number(priority)
                        : Number.MAX_SAFE_INTEGER
            }
          };
        }
      }
      
      // 新規登録
      // IDを生成（メールアドレスの@より前の部分を使用）
      const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
      const interviewerId = emailPrefix || `user_${Date.now()}`;
      
      // 名前を生成（Googleアカウントから取得を試みる）
      let interviewerName = '';
      try {
        const activeUser = Session.getActiveUser();
        const userName = activeUser.getName();
        if (userName && userName.trim() !== '') {
          interviewerName = userName;
          Logger.log(`[SpreadsheetService] Got name from Session.getActiveUser().getName(): ${interviewerName}`);
        }
      } catch (error) {
        Logger.log(`[SpreadsheetService] Failed to get name from Session.getActiveUser().getName(): ${error.toString()}`);
      }
      
      // 名前が取得できなかった場合、メールアドレスから推測
      if (!interviewerName || interviewerName.trim() === '') {
        const nameFromEmail = email.split('@')[0].replace(/[._]/g, ' ');
        interviewerName = nameFromEmail || '担当者';
        Logger.log(`[SpreadsheetService] Using email prefix as name: ${interviewerName}`);
      }
      
      // 優先順位を決定（既存の面談官数+1、最初の担当者は優先順位1）
      const existingCount = values.length - 1; // ヘッダー行を除く
      const priority = existingCount === 0 ? 1 : existingCount + 1;
      
      // 新しい行を追加
      const newRow = [
        interviewerId,           // A列: id
        interviewerName,         // B列: name
        '',                      // C列: timerex_config_id（空欄、後で設定可能）
        email,                   // D列: google_calendar_id
        priority                 // E列: priority
      ];
      
      sheet.appendRow(newRow);
      
      Logger.log(`[SpreadsheetService] 面談官を自動登録: id=${interviewerId}, name=${interviewerName}, email=${email}, priority=${priority}`);
      
      return {
        isNew: true,
        interviewer: {
          id: interviewerId,
          name: interviewerName,
          timerexConfigId: '',
          googleCalendarId: email,
          slackMemberId: '',
          priority: priority
        }
      };
    } catch (error) {
      Utils.logError('SpreadsheetService.registerInterviewerByEmail', error, { email });
      return { isNew: false, interviewer: null };
    }
  },

  /**
   * 面談官IDで面談官情報を取得
   * @param {string} interviewerId - 面談官ID
   * @return {Object|null} { id, name, timerexConfigId, googleCalendarId } または null
   */
  getInterviewerById(interviewerId) {
    if (!interviewerId) {
      return null;
    }

    try {
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWERS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      // ヘッダー行をスキップ
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[Config.INTERVIEWERS_COLUMNS.ID - 1] === interviewerId) {
          return {
            id: row[Config.INTERVIEWERS_COLUMNS.ID - 1],
            name: row[Config.INTERVIEWERS_COLUMNS.NAME - 1],
            timerexConfigId: row[Config.INTERVIEWERS_COLUMNS.TIMEREX_CONFIG_ID - 1],
            googleCalendarId: row[Config.INTERVIEWERS_COLUMNS.GOOGLE_CALENDAR_ID - 1],
            slackMemberId: (row[Config.INTERVIEWERS_COLUMNS.SLACK_MEMBER_ID - 1] || '').toString().trim()
          };
        }
      }

      return null;
    } catch (e) {
      Utils.logError('SpreadsheetService.getInterviewerById', e, { interviewerId });
      return null;
    }
  },

  /**
   * template シートから予約URL送信対象のテンプレート一覧を取得
   * @return {Array<{tag:string, name:string, outer_id:string}>} tag は postback.data に含まれる文字列（flex_code 等の接頭辞）
   */
  getBookingLinkTemplates() {
    try {
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.TEMPLATE);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      const rows = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const tag = (row[Config.TEMPLATE_COLUMNS.TAG - 1] || '').toString().trim();
        if (!tag) continue;
        rows.push({
          tag: tag,
          name: (row[Config.TEMPLATE_COLUMNS.NAME - 1] || '').toString().trim(),
          outer_id: (row[Config.TEMPLATE_COLUMNS.OUTER_ID - 1] || '').toString().trim()
        });
      }
      return rows;
    } catch (e) {
      Utils.logError('SpreadsheetService.getBookingLinkTemplates', e, {});
      return [];
    }
  },

  /**
   * postback.data 文字列に一致する template 行を検索し、outer_id（面談官ID）を返す
   * 複数一致する場合は最も長い tag に一致した行の outer_id を返す
   * @param {string} dataStr - postback.data の文字列
   * @return {string} 一致した行の outer_id。未一致または空の場合は ''
   */
  getInterviewerIdForPostbackData(dataStr) {
    if (!dataStr || typeof dataStr !== 'string') return '';
    const templates = SpreadsheetService.getBookingLinkTemplates();
    let matched = null;
    let maxLen = 0;
    for (const t of templates) {
      if (t.tag && dataStr.indexOf(t.tag) !== -1 && t.tag.length > maxLen) {
        maxLen = t.tag.length;
        matched = t;
      }
    }
    return matched ? (matched.outer_id || '') : '';
  },

  /**
   * postback.data が template シートのいずれかの tag に一致するか
   * @param {string} dataStr - postback.data の文字列
   * @return {boolean}
   */
  isPostbackDataMatchingTemplate(dataStr) {
    if (!dataStr || typeof dataStr !== 'string') return false;
    const templates = SpreadsheetService.getBookingLinkTemplates();
    return templates.some(t => t.tag && dataStr.indexOf(t.tag) !== -1);
  },

  /**
   * 面談官別の予約一覧を取得
   * @param {string} interviewerId - 面談官ID（オプション、指定しない場合は全件）
   * @param {Date} startDate - 開始日（オプション）
   * @param {Date} endDate - 終了日（オプション）
   * @return {Array} 予約データの配列
   */
  getInterviewsByInterviewer(interviewerId = null, startDate = null, endDate = null) {
    try {
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      const interviews = [];
      const start = startDate ? startDate.getTime() : 0;
      const end = endDate ? endDate.getTime() : Number.MAX_SAFE_INTEGER;

      // ヘッダー行をスキップ
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const startAt = row[Config.INTERVIEWS_COLUMNS.START_AT - 1];
        const status = row[Config.INTERVIEWS_COLUMNS.STATUS - 1];

        // ステータスが確定（1）のもののみ
        if (status !== Config.EVENT_STATUS.CONFIRMED) {
          continue;
        }

        // 日付フィルタ
        if (startAt instanceof Date) {
          const time = startAt.getTime();
          if (time < start || time > end) {
            continue;
          }
        }

        // 面談官フィルタ
        // interviewerIdが指定されている場合、厳密に一致するもののみを含める
        if (interviewerId) {
          const rowInterviewerId = row[Config.INTERVIEWS_COLUMNS.INTERVIEWER_ID - 1];
          // rowInterviewerIdが空、または一致しない場合は除外
          if (!rowInterviewerId || rowInterviewerId !== interviewerId) {
            continue;
          }
        }

        interviews.push({
          rowIndex: i + 1,
          createdAt: row[Config.INTERVIEWS_COLUMNS.CREATED_AT - 1],
          startAt: row[Config.INTERVIEWS_COLUMNS.START_AT - 1],
          endAt: row[Config.INTERVIEWS_COLUMNS.END_AT - 1],
          guestName: row[Config.INTERVIEWS_COLUMNS.GUEST_NAME - 1],
          guestEmail: row[Config.INTERVIEWS_COLUMNS.GUEST_EMAIL - 1],
          meetUrl: row[Config.INTERVIEWS_COLUMNS.MEET_URL - 1],
          lineUid: row[Config.INTERVIEWS_COLUMNS.LINE_UID - 1],
          source: row[Config.INTERVIEWS_COLUMNS.SOURCE - 1],
          eventId: row[Config.INTERVIEWS_COLUMNS.EVENT_ID - 1],
          teamUrlPath: row[Config.INTERVIEWS_COLUMNS.TEAM_URL_PATH - 1],
          calendarUrlPath: row[Config.INTERVIEWS_COLUMNS.CALENDAR_URL_PATH - 1],
          status: row[Config.INTERVIEWS_COLUMNS.STATUS - 1],
          interviewerId: row[Config.INTERVIEWS_COLUMNS.INTERVIEWER_ID - 1]
        });
      }

      return interviews;
    } catch (e) {
      Utils.logError('SpreadsheetService.getInterviewsByInterviewer', e, { interviewerId, startDate, endDate });
      return [];
    }
  },

  /**
   * 統計情報を取得
   * @param {string} interviewerId - 面談官ID（オプション）
   * @return {Object} { todayCount: number, weekCount: number }
   */
  getStatistics(interviewerId = null) {
    try {
      Logger.log(`[SpreadsheetService] getStatistics called with interviewerId: ${interviewerId || 'null'}`);
      
      const today = new Date();
      const todayStart = Utils.getStartOfDay(today);
      const todayEnd = Utils.getEndOfDay(today);
      const weekStart = Utils.getWeekStart();
      const weekEnd = Utils.getWeekEnd();

      Logger.log(`[SpreadsheetService] Date range - Today: ${todayStart.toISOString()} to ${todayEnd.toISOString()}`);
      Logger.log(`[SpreadsheetService] Date range - Week: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

      const todayInterviews = SpreadsheetService.getInterviewsByInterviewer(interviewerId, todayStart, todayEnd);
      const weekInterviews = SpreadsheetService.getInterviewsByInterviewer(interviewerId, weekStart, weekEnd);

      Logger.log(`[SpreadsheetService] Statistics - Today: ${todayInterviews.length}, Week: ${weekInterviews.length}`);

      return {
        todayCount: todayInterviews.length,
        weekCount: weekInterviews.length
      };
    } catch (e) {
      Logger.log(`[SpreadsheetService] ERROR in getStatistics: ${e.toString()}`);
      Utils.logError('SpreadsheetService.getStatistics', e, { interviewerId });
      return {
        todayCount: 0,
        weekCount: 0
      };
    }
  },

  /**
   * 全ての面談官情報を取得（内部実装）
   * @param {boolean} includePriority - 優先順位を含めるか
   * @return {Array} 面談官情報の配列
   */
  _getAllInterviewersRaw(includePriority = false) {
    try {
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWERS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      const interviewers = [];
      // ヘッダー行をスキップ
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[Config.INTERVIEWERS_COLUMNS.ID - 1]) { // idが空でない場合のみ追加
          const interviewer = {
            id: row[Config.INTERVIEWERS_COLUMNS.ID - 1],
            name: row[Config.INTERVIEWERS_COLUMNS.NAME - 1],
            timerexConfigId: row[Config.INTERVIEWERS_COLUMNS.TIMEREX_CONFIG_ID - 1],
            googleCalendarId: row[Config.INTERVIEWERS_COLUMNS.GOOGLE_CALENDAR_ID - 1],
            slackMemberId: (row[Config.INTERVIEWERS_COLUMNS.SLACK_MEMBER_ID - 1] || '').toString().trim(),
            rowIndex: i + 1 // 行番号（優先順位が同じ場合のソート用）
          };
          
          if (includePriority) {
            const priority = row[Config.INTERVIEWERS_COLUMNS.PRIORITY - 1];
            interviewer.priority = priority !== '' && priority !== null && priority !== undefined 
              ? Number(priority) 
              : Number.MAX_SAFE_INTEGER; // 未設定の場合は最大値
          }
          
          interviewers.push(interviewer);
        }
      }

      return interviewers;
    } catch (e) {
      Utils.logError('SpreadsheetService._getAllInterviewersRaw', e);
      return [];
    }
  },

  /**
   * 面談官の優先順位を更新
   * @param {string} interviewerId - 面談官ID
   * @param {number|null} priority - 優先順位（低い数値ほど優先度が高い、nullの場合は空欄）
   * @return {boolean} 更新に成功した場合true
   */
  updateInterviewerPriority(interviewerId, priority) {
    try {
      if (!interviewerId) {
        throw new Error('interviewerId is required');
      }

      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWERS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      // 該当する面談官を検索
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[Config.INTERVIEWERS_COLUMNS.ID - 1] === interviewerId) {
          // 優先順位を更新
          const colIndex = Config.INTERVIEWERS_COLUMNS.PRIORITY;
          sheet.getRange(i + 1, colIndex).setValue(priority !== null && priority !== undefined ? priority : '');
          
          Logger.log(`[SpreadsheetService] Priority updated for interviewer ${interviewerId}: ${priority}`);
          return true;
        }
      }

      throw new Error(`Interviewer not found: ${interviewerId}`);
    } catch (e) {
      Utils.logError('SpreadsheetService.updateInterviewerPriority', e, { interviewerId, priority });
      throw e;
    }
  },

  /**
   * 複数の面談官の優先順位を一括更新
   * @param {Array} updates - 更新データの配列 [{ interviewerId: string, priority: number|null }, ...]
   * @return {Object} { success: boolean, updated: number, errors: Array }
   */
  updateInterviewerPriorities(updates) {
    try {
      if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error('updates must be a non-empty array');
      }

      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWERS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      const colIndex = Config.INTERVIEWERS_COLUMNS.PRIORITY;

      let updated = 0;
      const errors = [];

      // 各更新を処理
      for (const update of updates) {
        try {
          if (!update.interviewerId) {
            errors.push({ interviewerId: update.interviewerId, error: 'interviewerId is required' });
            continue;
          }

          // 該当する面談官を検索
          let found = false;
          for (let i = 1; i < values.length; i++) {
            const row = values[i];
            if (row[Config.INTERVIEWERS_COLUMNS.ID - 1] === update.interviewerId) {
              // 優先順位を更新
              const priority = update.priority !== null && update.priority !== undefined 
                ? update.priority 
                : '';
              sheet.getRange(i + 1, colIndex).setValue(priority);
              updated++;
              found = true;
              break;
            }
          }

          if (!found) {
            errors.push({ interviewerId: update.interviewerId, error: 'Interviewer not found' });
          }
        } catch (e) {
          errors.push({ interviewerId: update.interviewerId, error: e.toString() });
        }
      }

      Logger.log(`[SpreadsheetService] Updated priorities for ${updated} interviewers`);
      return {
        success: true,
        updated: updated,
        errors: errors
      };
    } catch (e) {
      Utils.logError('SpreadsheetService.updateInterviewerPriorities', e, { updates });
      return {
        success: false,
        error: e.toString(),
        updated: 0,
        errors: []
      };
    }
  },

  /**
   * interviewsシートの特定行のinterviewer_idを更新
   * @param {number} rowIndex - 行番号（1ベース）
   * @param {string} interviewerId - 面談官ID
   * @return {boolean} 更新に成功した場合true
   */
  updateInterviewInterviewerId(rowIndex, interviewerId) {
    try {
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
      const colIndex = Config.INTERVIEWS_COLUMNS.INTERVIEWER_ID;
      sheet.getRange(rowIndex, colIndex).setValue(interviewerId);
      return true;
    } catch (e) {
      Utils.logError('SpreadsheetService.updateInterviewInterviewerId', e, { rowIndex, interviewerId });
      return false;
    }
  },

  /**
   * interviewsシートの全データを取得（内部実装）
   * @return {Array} 行データの配列（ヘッダー行を除く）
   */
  _getAllInterviewsRaw() {
    try {
      const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();

      const rows = [];
      // ヘッダー行をスキップ
      for (let i = 1; i < values.length; i++) {
        rows.push({
          rowIndex: i + 1,
          values: values[i]
        });
      }

      return rows;
    } catch (e) {
      Utils.logError('SpreadsheetService._getAllInterviewsRaw', e);
      return [];
    }
  },

  /**
   * uidlogシートを取得または作成
   * フォーマット: 日時, uid, sessionid, イベント種別, friendid
   * @return {Sheet} uidlogシート
   */
  getOrCreateUidlogSheet() {
    const ss = this.getSpreadsheet();
    let uidlogSheet = ss.getSheetByName(Config.SHEET_NAMES.UIDLOG);
    if (!uidlogSheet) {
      uidlogSheet = ss.insertSheet(Config.SHEET_NAMES.UIDLOG);
      uidlogSheet.appendRow(['日時', 'uid', 'sessionid', 'イベント種別', 'friendid']);
      uidlogSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    return uidlogSheet;
  },

  /**
   * uidlogシートに記録を追加（UID取得用GAS・Webhook受信時）
   * @param {string} uid - LINEユーザーID
   * @param {string} sessionId - セッションID
   * @param {string} eventType - イベント種別（postback, message 等）
   * @param {string} [friendId] - L-stepのfriend_id（省略時は空。Webhook転送で届く場合のみ入る）
   * @return {boolean} 保存成功フラグ
   */
  saveToUidlog(uid, sessionId, eventType = '', friendId = '') {
    try {
      const sheet = this.getOrCreateUidlogSheet();
      const now = new Date();
      const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
      sheet.appendRow([dateStr, uid || '', sessionId || '', eventType || '', friendId || '']);
      Logger.log(`[SpreadsheetService] uidlog saved: uid=${uid}, sessionid=${sessionId}, event=${eventType}, friendid=${friendId || '(empty)'}`);
      return true;
    } catch (error) {
      Utils.logError('SpreadsheetService.saveToUidlog', error, { uid, sessionId, eventType });
      return false;
    }
  },

  /**
   * セッションIDからUIDを取得（uidlogシートから）
   * @param {string} sessionId - セッションID
   * @return {string|null} UID（見つからない場合はnull）
   */
  getUidFromSessionSpreadsheet(sessionId) {
    try {
      const sheet = this.getSheet(Config.SHEET_NAMES.UIDLOG);
      const data = sheet.getDataRange().getValues();

      if (data.length < 2) {
        return null;
      }

      const header = data[0];
      const colSessionId = header.indexOf('sessionid') >= 0 ? header.indexOf('sessionid') : 2;
      const colUid = header.indexOf('uid') >= 0 ? header.indexOf('uid') : 1;

      for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        if ((row[colSessionId] || '').toString().trim() === (sessionId || '').toString().trim()) {
          const uid = (row[colUid] || '').toString().trim();
          if (uid) {
            Logger.log(`[SpreadsheetService] UID retrieved from uidlog: ${uid}`);
            return uid;
          }
        }
      }

      Logger.log(`[SpreadsheetService] Session not found in uidlog: session_id=${sessionId}`);
      return null;
    } catch (error) {
      Utils.logError('SpreadsheetService.getUidFromSessionSpreadsheet', error, { sessionId });
      return null;
    }
  },

  /**
   * interviewer_id で直近のセッションを取得（uidlogにはinterviewer_idがないため常にnull）
   * @deprecated uidlogはinterviewer_idを持たない。getMostRecentSessionを使用のこと
   */
  getRecentSessionByInterviewerId(interviewerId, withinSeconds = 120) {
    return this.getMostRecentSession(withinSeconds);
  },

  /**
   * 直近のセッションを1件返す（uidlogの最新行から、postback に限定）
   * イベント種別が 'postback' の行のみ対象とする。message 等の他イベントが直後に記録されると
   * 「直近1件」が他ユーザーのセッションになり混入するため、予約フローで発行するのは postback のみとする。
   * @param {number} withinSeconds - 何秒以内の記録を対象にするか（デフォルト120秒=2分）
   * @return {{sessionId: string, uid: string}|null}
   */
  getMostRecentSession(withinSeconds = 120) {
    try {
      const sheet = this.getSheet(Config.SHEET_NAMES.UIDLOG);
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return null;

      const header = data[0];
      const colSessionId = header.indexOf('sessionid') >= 0 ? header.indexOf('sessionid') : 2;
      const colUid = header.indexOf('uid') >= 0 ? header.indexOf('uid') : 1;
      const colDate = header.indexOf('日時') >= 0 ? header.indexOf('日時') : 0;
      const colEventType = header.indexOf('イベント種別') >= 0 ? header.indexOf('イベント種別') : 3;

      const now = new Date();
      const cutoff = new Date(now.getTime() - withinSeconds * 1000);

      for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        const eventType = (row[colEventType] || '').toString().trim();
        if (eventType !== 'postback') continue;

        const uid = (row[colUid] || '').toString().trim();
        const sessionId = (row[colSessionId] || '').toString().trim();
        if (!uid || !sessionId) continue;

        let rowDate;
        const val = row[colDate];
        if (val instanceof Date) {
          rowDate = val;
        } else if (typeof val === 'string' && val) {
          rowDate = new Date(val);
        } else {
          continue;
        }
        if (isNaN(rowDate.getTime()) || rowDate < cutoff) continue;

        return { sessionId: sessionId, uid: uid };
      }
      return null;
    } catch (error) {
      Utils.logError('SpreadsheetService.getMostRecentSession', error, {});
      return null;
    }
  }
};

