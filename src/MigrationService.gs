/**
 * データマイグレーションサービス
 * 既存データの更新や移行処理を提供
 */

const MigrationService = {
  /**
   * 既存のinterviewsデータにinterviewer_idを設定
   * google_calendar_idからinterviewer_idを逆引きして設定
   * @return {Object} { success: boolean, updated: number, errors: Array }
   */
  updateInterviewerIdsForExistingInterviews() {
    try {
      Logger.log('[MigrationService] Starting interviewer_id migration...');
      
      // 全ての面談官情報を取得
      const allInterviewers = AdminApiService.getAllInterviewers();
      Logger.log(`[MigrationService] Found ${allInterviewers.length} interviewers`);
      
      // google_calendar_id -> interviewer_id のマッピングを作成
      const emailToIdMap = {};
      allInterviewers.forEach(interviewer => {
        if (interviewer.googleCalendarId) {
          emailToIdMap[interviewer.googleCalendarId.toLowerCase()] = interviewer.id;
        }
      });
      
      Logger.log(`[MigrationService] Email to ID mapping: ${JSON.stringify(emailToIdMap)}`);
      
      // SpreadsheetServiceの共通メソッドを使用してinterviewsデータを取得
      const interviewRows = SpreadsheetService._getAllInterviewsRaw();
      
      let updatedCount = 0;
      const errors = [];
      
      // 各行を処理
      for (const rowData of interviewRows) {
        const rowIndex = rowData.rowIndex;
        const row = rowData.values;
        
        // 現在のinterviewer_idを取得
        const currentInterviewerId = row[Config.INTERVIEWS_COLUMNS.INTERVIEWER_ID - 1];
        
        // 既に設定されている場合はスキップ
        if (currentInterviewerId) {
          continue;
        }
        
        // event_idからTimeRexイベント情報を取得して、hostsからemailを取得
        // または、既存のデータから推測する方法を試す
        // 今回は、TimeRexのWebhookでhosts情報が含まれていることを前提とする
        
        // まず、event_idがある場合は、TimeRex APIからイベント情報を取得
        const eventId = row[Config.INTERVIEWS_COLUMNS.EVENT_ID - 1];
        let interviewerId = '';
        
        if (eventId) {
          try {
            // TimeRex APIからイベント情報を取得
            const event = TimeRexApiService.getEvent(eventId);
            if (event && event.hosts && event.hosts.length > 0) {
              const hostEmail = event.hosts[0].email;
              interviewerId = emailToIdMap[hostEmail.toLowerCase()] || '';
              
              if (interviewerId) {
                Logger.log(`[MigrationService] Found interviewer_id for event ${eventId}: ${interviewerId} (from host: ${hostEmail})`);
              }
            }
          } catch (e) {
            Logger.log(`[MigrationService] Error fetching event ${eventId}: ${e.toString()}`);
            errors.push({ row: rowIndex, eventId: eventId, error: e.toString() });
          }
        }
        
        // interviewer_idが見つかった場合、更新
        if (interviewerId) {
          try {
            if (SpreadsheetService.updateInterviewInterviewerId(rowIndex, interviewerId)) {
              updatedCount++;
              Logger.log(`[MigrationService] Updated row ${rowIndex} with interviewer_id: ${interviewerId}`);
            } else {
              errors.push({ row: rowIndex, error: 'Failed to update interviewer_id' });
            }
          } catch (e) {
            Logger.log(`[MigrationService] Error updating row ${rowIndex}: ${e.toString()}`);
            errors.push({ row: rowIndex, error: e.toString() });
          }
        } else {
          Logger.log(`[MigrationService] Could not determine interviewer_id for row ${rowIndex} (eventId: ${eventId || 'none'})`);
        }
      }
      
      Logger.log(`[MigrationService] Migration completed. Updated: ${updatedCount}, Errors: ${errors.length}`);
      
      return {
        success: true,
        updated: updatedCount,
        errors: errors
      };
    } catch (e) {
      Utils.logError('MigrationService.updateInterviewerIdsForExistingInterviews', e);
      return {
        success: false,
        updated: 0,
        errors: [{ error: e.toString() }]
      };
    }
  },
  
  /**
   * 既存のinterviewsデータにinterviewer_idを設定（簡易版）
   * デフォルトの面談官IDを設定（既存データの後方互換性のため）
   * @param {string} defaultInterviewerId - デフォルトの面談官ID
   * @return {Object} { success: boolean, updated: number }
   */
  setDefaultInterviewerIdForEmptyRows(defaultInterviewerId) {
    try {
      Logger.log(`[MigrationService] Setting default interviewer_id: ${defaultInterviewerId}`);
      
      if (!defaultInterviewerId) {
        throw new Error('defaultInterviewerId is required');
      }
      
      // SpreadsheetServiceの共通メソッドを使用してinterviewsデータを取得
      const interviewRows = SpreadsheetService._getAllInterviewsRaw();
      
      let updatedCount = 0;
      
      // 各行を処理
      for (const rowData of interviewRows) {
        const rowIndex = rowData.rowIndex;
        const row = rowData.values;
        
        // 現在のinterviewer_idを取得
        const currentInterviewerId = row[Config.INTERVIEWS_COLUMNS.INTERVIEWER_ID - 1];
        
        // 空の場合はデフォルト値を設定
        if (!currentInterviewerId || currentInterviewerId === '') {
          if (SpreadsheetService.updateInterviewInterviewerId(rowIndex, defaultInterviewerId)) {
            updatedCount++;
          }
        }
      }
      
      Logger.log(`[MigrationService] Updated ${updatedCount} rows with default interviewer_id`);
      
      return {
        success: true,
        updated: updatedCount
      };
    } catch (e) {
      Utils.logError('MigrationService.setDefaultInterviewerIdForEmptyRows', e);
      return {
        success: false,
        updated: 0,
        error: e.toString()
      };
    }
  }
};


