/**
 * Webhook処理ハンドラー
 * TimeRexからのWebhookを受信して処理
 */

const WebhookHandler = {
  /**
   * 予約確定イベントを処理
   * @param {Object} payload - Webhookペイロード
   * @param {string} payload.webhook_type - 'event_confirmed'
   * @param {Object} payload.event - イベントデータ
   * @return {Object} { success: boolean, rowIndex?: number }
   */
  handleEventConfirmed(payload) {
    try {
      Logger.log('========================================');
      Logger.log('[WebhookHandler] ===== handleEventConfirmed CALLED =====');
      Logger.log(`[WebhookHandler] Timestamp: ${new Date().toISOString()}`);
      Logger.log(`[WebhookHandler] Payload keys: ${JSON.stringify(Object.keys(payload))}`);
      Logger.log(`[WebhookHandler] Full payload: ${JSON.stringify(payload).substring(0, 1000)}...`);
      
      const event = payload.event;
      if (!event) {
        Logger.log('[WebhookHandler] ERROR: Event data is missing in payload');
        throw new Error('Event data is missing in payload');
      }
      
      Logger.log(`[WebhookHandler] Event ID: ${event.id || '(no id)'}`);
      Logger.log(`[WebhookHandler] Event keys: ${JSON.stringify(Object.keys(event))}`);
      
      // 必須フィールドの検証
      const validation = Utils.validateRequiredFields(event, ['id', 'start_datetime', 'end_datetime']);
      if (!validation.valid) {
        Logger.log(`[WebhookHandler] Validation failed: ${validation.missing.join(', ')}`);
        throw new Error(`Missing required fields: ${validation.missing.join(', ')}`);
      }
      Logger.log('[WebhookHandler] Validation passed');

      // form配列から必要な情報を抽出
      const guestName = Utils.getFormValue(event.form, 'guest_name');
      const guestEmail = Utils.getFormValue(event.form, 'guest_email');
      Logger.log(`[WebhookHandler] Guest name: ${guestName}, email: ${guestEmail}`);
      
      // url_params の実体をログに出し、TimeRex の仕様確認に使う
      Logger.log(`[WebhookHandler] event.url_params: type=${typeof event.url_params}, value=${JSON.stringify(event.url_params != null ? event.url_params : 'null')}`);
      if (event.custom_data != null) {
        Logger.log(`[WebhookHandler] event.custom_data: ${JSON.stringify(event.custom_data).substring(0, 200)}`);
      }
      // url_paramsからLINEユーザーIDを取得（配列・オブジェクト両対応）
      let lineUid = Utils.getUrlParamValue(event.url_params, 'line_uid');
      if (!lineUid && event.custom_data && typeof event.custom_data === 'object') {
        lineUid = (event.custom_data.line_uid || event.custom_data.uid || '').toString();
        if (lineUid) Logger.log(`[WebhookHandler] LINE UID from custom_data: ${lineUid}`);
      }
      Logger.log(`[WebhookHandler] LINE UID: ${lineUid || '(not provided)'}`);

      // session_id と line_uid の対応検証（uidlog と照合。混同・改ざんの検知用。不一致でも予約処理は続行）
      const eventSessionId = (Utils.getUrlParamValue(event.url_params, 'session_id') || '').toString().trim()
        || (event.custom_data && typeof event.custom_data === 'object' && (event.custom_data.session_id || event.custom_data.sessionId || '').toString().trim()) || '';
      if (eventSessionId && lineUid) {
        try {
          const uidForSession = SpreadsheetService.getUidFromSessionSpreadsheet(eventSessionId);
          if (uidForSession !== null && uidForSession !== lineUid) {
            Logger.log(`[WebhookHandler] ⚠️ UID_MISMATCH: session_id=${eventSessionId} → uidlog says ${uidForSession}, but event has line_uid=${lineUid}. Possible mix-up or tampering.`);
            try {
              SpreadsheetService.saveToUidlog(lineUid || '', eventSessionId, `WEBHOOK_UID_MISMATCH: expected=${uidForSession} got=${lineUid}`);
            } catch (_) { /* ログ失敗は無視 */ }
          } else if (uidForSession === lineUid) {
            Logger.log(`[WebhookHandler] ✅ session_id and line_uid match uidlog`);
          }
        } catch (verifyErr) {
          Logger.log(`[WebhookHandler] session_id/uid verification error (ignored): ${verifyErr.toString()}`);
        }
      }
      
      // ミーティングURL（zoom_meetingまたはonline_meeting_providerから取得）
      let meetUrl = '';
      if (event.zoom_meeting && event.zoom_meeting.join_url) {
        meetUrl = event.zoom_meeting.join_url;
        Logger.log(`[WebhookHandler] Zoom meeting URL found`);
      } else if (event.google_meet_meeting && event.google_meet_meeting.join_url) {
        meetUrl = event.google_meet_meeting.join_url;
        Logger.log(`[WebhookHandler] Google Meet URL found`);
        // Google Meet の文字起こしをデフォルトオン（MEET_SA_* が設定されていれば実行）
        if (event.hosts && event.hosts.length > 0) {
          MeetApiService.enableTranscriptionIfConfigured(meetUrl, event.hosts[0].email);
        }
      } else if (event.microsoft_teams_meeting && event.microsoft_teams_meeting.join_url) {
        meetUrl = event.microsoft_teams_meeting.join_url;
        Logger.log(`[WebhookHandler] Microsoft Teams URL found`);
      } else if (event.online_meeting_provider) {
        Logger.log(`[WebhookHandler] Online meeting provider: ${event.online_meeting_provider}`);
        // 他のミーティングプロバイダーの場合は必要に応じて対応
        meetUrl = '';
      } else {
        Logger.log('[WebhookHandler] No meeting URL found');
      }
      
      // キャンセルURL（ゲスト用）
      const guestCancelUrl = event.guest_cancel_url || '';
      Logger.log(`[WebhookHandler] Guest cancel URL: ${guestCancelUrl || '(not provided)'}`);

      // 日時をDateオブジェクトに変換
      const startAt = Utils.parseISO8601(event.local_start_datetime || event.start_datetime);
      const endAt = Utils.parseISO8601(event.local_end_datetime || event.end_datetime);
      
      Logger.log(`[WebhookHandler] Start: ${startAt ? startAt.toISOString() : 'null'}, End: ${endAt ? endAt.toISOString() : 'null'}`);
      
      if (!startAt || !endAt) {
        throw new Error('Invalid datetime format');
      }

      // 重複チェック: 既に同じevent_idで登録されている場合はスキップ
      // 注意: event_idが空の場合でも、guest_email + startAtで重複チェックを行う
      if (event.id) {
        const existingInterview = SpreadsheetService.findInterviewByEventId(event.id);
        if (existingInterview) {
          Logger.log(`[WebhookHandler] Interview already exists for event_id: ${event.id}, row: ${existingInterview.rowIndex}`);
          Logger.log(`[WebhookHandler] Skipping duplicate registration`);
          return {
            success: true,
            rowIndex: existingInterview.rowIndex,
            skipped: true,
            reason: 'duplicate'
          };
        }
      }
      
      // event_idが空の場合、guest_email + startAtで重複チェック
      // ただし、event_idがある場合は上記のチェックで十分
      if (!event.id && guestEmail && startAt) {
        const existingInterview = SpreadsheetService.findInterviewByGuestEmailAndTime(guestEmail, startAt);
        if (existingInterview) {
          Logger.log(`[WebhookHandler] Interview already exists for guest_email: ${guestEmail}, startAt: ${startAt.toISOString()}, row: ${existingInterview.rowIndex}`);
          Logger.log(`[WebhookHandler] Skipping duplicate registration`);
          return {
            success: true,
            rowIndex: existingInterview.rowIndex,
            skipped: true,
            reason: 'duplicate'
          };
        }
      }

      // 同一メールで既に有効な予約がある場合: event_confirmed は TimeRex 側で確定済みの事実なので、
      // 既存が「別の event_id」なら取り消し扱いにして新規を登録する（エラーにしない）
      if (guestEmail && event.id) {
        const existingActiveInterview = SpreadsheetService.findActiveInterviewByGuestEmail(guestEmail);
        if (existingActiveInterview) {
          const existingEventId = (existingActiveInterview.data && existingActiveInterview.data.eventId) || '';
          if (existingEventId === event.id) {
            // 同一 event_id は上段の findInterviewByEventId でスキップ済みのためここには来ない想定
            Logger.log(`[WebhookHandler] Interview already exists for event_id: ${event.id}, row: ${existingActiveInterview.rowIndex}`);
            return {
              success: true,
              rowIndex: existingActiveInterview.rowIndex,
              skipped: true,
              reason: 'duplicate'
            };
          }
          // 別の event_id: TimeRex で新規予約が確定したため、古い予約をキャンセルして新規を登録
          Logger.log(`[WebhookHandler] Superseding previous booking: guest_email=${guestEmail}, old event_id=${existingEventId}, new event_id=${event.id}, row=${existingActiveInterview.rowIndex}`);
          try {
            SpreadsheetService.updateInterviewStatus(existingActiveInterview.rowIndex, Config.EVENT_STATUS.CANCELLED);
            Logger.log(`[WebhookHandler] Previous booking row ${existingActiveInterview.rowIndex} set to CANCELLED`);
          } catch (cancelErr) {
            Logger.log(`[WebhookHandler] Failed to cancel previous row (continuing): ${cancelErr.toString()}`);
            Utils.logError('WebhookHandler.handleEventConfirmed.supersede', cancelErr, { rowIndex: existingActiveInterview.rowIndex });
          }
        }
      }

      // 面談官の特定（優先順位ロジック）
      // 1. event.hostsから全ての面談官のメールアドレスを取得
      // 2. interviewersシートから該当する面談官を抽出（優先順位でソート済み）
      // 3. 最優先の面談官にアサイン
      // 注意: TimeRexが既に予約を確定しているため、カレンダー空き確認は不要
      // event.hostsに含まれる面談官は、TimeRexが予約可能と判断した面談官
      let interviewerId = '';
      let interviewerGoogleCalendarId = '';
      
      if (event.hosts && event.hosts.length > 0) {
        const hostEmails = event.hosts.map(h => h.email);
        Logger.log(`[WebhookHandler] Found ${hostEmails.length} host(s): ${hostEmails.join(', ')}`);
        
        try {
          // 全ての面談官を取得（優先順位でソート）
          const allInterviewers = AdminApiService.getAllInterviewers(true);
          
          // ホストのメールアドレスに一致する面談官を抽出
          const candidateInterviewers = allInterviewers.filter(interviewer => {
            return hostEmails.some(email => 
              email.toLowerCase() === interviewer.googleCalendarId.toLowerCase()
            );
          });
          
          Logger.log(`[WebhookHandler] Found ${candidateInterviewers.length} matching interviewer(s) from hosts`);
          
          if (candidateInterviewers.length > 0) {
            // TimeRexが既に予約を確定しているため、event.hostsに含まれる面談官は全て予約可能と判断された面談官
            // カレンダー空き確認は不要（TimeRex側で既に確認済み）
            // 優先順位でソートされた候補面談官の中から、最優先の面談官を選択
            
            // candidateInterviewersは既に優先順位でソートされている（getAllInterviewers(true)で取得）
            const selectedInterviewer = candidateInterviewers[0];
            interviewerId = selectedInterviewer.id;
            interviewerGoogleCalendarId = selectedInterviewer.googleCalendarId;
            Logger.log(`[WebhookHandler] Selected interviewer by priority: ${interviewerId} (${interviewerGoogleCalendarId}), priority: ${selectedInterviewer.priority}`);
          } else {
            Logger.log(`[WebhookHandler] No matching interviewers found in interviewers sheet for host emails`);
          }
        } catch (e) {
          Logger.log(`[WebhookHandler] Error in priority logic: ${e.toString()}`);
          // エラーが発生した場合、従来の方法（最初のホスト）を使用
          interviewerGoogleCalendarId = hostEmails[0];
          const allInterviewers = AdminApiService.getAllInterviewers();
          const interviewer = Utils.findInterviewerByEmail(interviewerGoogleCalendarId, allInterviewers);
          if (interviewer) {
            interviewerId = interviewer.id;
            Logger.log(`[WebhookHandler] Fallback: Using first host ${interviewerId}`);
          }
        }
      } else {
        Logger.log(`[WebhookHandler] No hosts found in event data`);
      }

      // interviewsシートに記録
      // 注意: 面談官が見つからなくても、スプレッドシートには記録する
      const interviewData = {
        createdAt: Utils.parseISO8601(event.created_at) || new Date(),
        startAt: startAt,
        endAt: endAt,
        guestName: guestName,
        guestEmail: guestEmail,
        meetUrl: meetUrl,
        lineUid: lineUid,
        source: Config.SOURCE.TIMEREX,
        eventId: event.id || '',
        teamUrlPath: payload.team_url_path || '',
        calendarUrlPath: payload.calendar_url_path || '',
        status: Config.EVENT_STATUS.CONFIRMED,
        interviewerId: interviewerId || '' // 面談官が見つからなくても空文字で記録
      };

      Logger.log(`[WebhookHandler] Attempting to append interview data to spreadsheet...`);
      Logger.log(`[WebhookHandler] Interview data: ${JSON.stringify({
        eventId: interviewData.eventId,
        guestName: interviewData.guestName,
        guestEmail: interviewData.guestEmail,
        startAt: interviewData.startAt.toISOString(),
        endAt: interviewData.endAt.toISOString(),
        interviewerId: interviewData.interviewerId || '(not found)'
      })}`);

      // スプレッドシートへの記録は、エラーが発生しても処理を続行
      let rowIndex = null;
      try {
        Logger.log(`[WebhookHandler] ===== ATTEMPTING TO SAVE TO SPREADSHEET =====`);
        rowIndex = SpreadsheetService.appendInterview(interviewData);
        Logger.log(`[WebhookHandler] ===== SUCCESSFULLY SAVED TO SPREADSHEET =====`);
        Logger.log(`[WebhookHandler] Event confirmed: ${event.id || 'no-id'}, row: ${rowIndex}`);
        
        // Slack通知を送信
        try {
          // 面談者名・Slackメンション用IDを取得
          let interviewerName = '未設定';
          let interviewerSlackMemberId = '';
          if (interviewerId) {
            const allInterviewers = AdminApiService.getAllInterviewers();
            const interviewer = allInterviewers.find(i => i.id === interviewerId);
            if (interviewer) {
              if (interviewer.name) interviewerName = interviewer.name;
              if (interviewer.slackMemberId) interviewerSlackMemberId = interviewer.slackMemberId;
            }
          }
          
          SlackService.notifyBookingCreated({
            candidateName: guestName || '未設定',
            dateTime: startAt.toISOString(),
            interviewerName: interviewerName,
            interviewerEmail: interviewerGoogleCalendarId || '',
            interviewerSlackMemberId: interviewerSlackMemberId,
            adminPageUrl: Utils.getAdminPageUrl(interviewerId)
          });
        } catch (slackError) {
          Logger.log(`[WebhookHandler] Slack通知エラー（無視）: ${slackError.toString()}`);
          // Slack通知の失敗は予約処理を止めない
        }
        
        // LステップAPI連携: 友だち情報更新とタグ設置（LSTEP_UID_ONLY のときはスキップ＝UID取得だけ）
        if (lineUid && !Config.LSTEP_UID_ONLY) {
          try {
            Logger.log(`[WebhookHandler] LステップAPI連携開始: lineUid=${lineUid}`);
            const meetingDate = LStepApiService.formatDateTimeForLStep(startAt);
            const tagName = Config.LSTEP_TAG_NAMES.BOOKING_CONFIRMED;

            if (Config.LSTEP_USE_TRIGGER_URL) {
              // トリガーURL経由（/friend/update が利用できない契約向け）
              const lstepData = {
                meeting_date: meetingDate,
                meeting_url: meetUrl || null,
                meeting_cancel_url: guestCancelUrl || null,
                tag: tagName
              };
              Logger.log(`[WebhookHandler] L-step に渡す data キー数: ${Object.keys(lstepData).length} (meeting_date, meeting_url, meeting_cancel_url, tag)`);
              LStepApiService.triggerFriendUpdate(lineUid, lstepData);
              Logger.log(`[WebhookHandler] LステップトリガーURL連携成功: meeting_date=${meetingDate}, tag=${tagName}`);
            } else {
              // REST /friend/update 経由
              LStepApiService.updateFriendInfo(lineUid, {
                meeting_date: meetingDate,
                meeting_url: meetUrl || null,
                meeting_cancel_url: guestCancelUrl || null
              });
              Logger.log(`[WebhookHandler] Lステップ友だち情報更新成功: meeting_date=${meetingDate}, meeting_url=${meetUrl || '(none)'}, meeting_cancel_url=${guestCancelUrl || '(none)'}`);
              try {
                LStepApiService.addTag(lineUid, tagName);
                Logger.log(`[WebhookHandler] Lステップタグ設置成功: tagName=${tagName}`);
              } catch (tagError) {
                Logger.log(`[WebhookHandler] Lステップタグ設置エラー（無視）: ${tagError.toString()}`);
              }
            }

            try {
              SpreadsheetService.saveToUidlog(lineUid || '', '', `LSTEP_API_SUCCESS: ${guestName || 'Unknown'} meeting_date=${meetingDate}`);
            } catch (logError) {}
          } catch (lstepError) {
            Logger.log(`[WebhookHandler] LステップAPI連携エラー（無視）: ${lstepError.toString()}`);
            Utils.logError('WebhookHandler.LStepIntegration', lstepError, { lineUid, eventId: event.id });
            
            // uidlogに記録（LステップAPI連携失敗）
            try {
              SpreadsheetService.saveToUidlog(lineUid || '', '', `LSTEP_API_ERROR: ${lstepError.toString()}`);
            } catch (logError) {
              // ログ記録の失敗は無視
            }
            // LステップAPI連携失敗は予約処理を止めない
          }
        } else if (!lineUid) {
          Logger.log(`[WebhookHandler] LINE UIDが取得できなかったため、LステップAPI連携をスキップ`);
          try {
            SpreadsheetService.saveToUidlog('', '', `LSTEP_API_SKIP: LINE UID未取得 eventId=${event.id}`);
          } catch (logError) {}
        } else if (Config.LSTEP_UID_ONLY) {
          Logger.log(`[WebhookHandler] LSTEP_UID_ONLY のため、友だち情報更新・タグはスキップ（UID取得のみ運用）`);
        }
        
        // uidlogに記録（成功時）
        try {
          SpreadsheetService.saveToUidlog('', '', `INTERVIEW_SAVED: ${interviewData.guestName || 'Unknown'} eventId=${event.id}`);
        } catch (logError) {
          // ログ記録の失敗は無視
        }
      } catch (appendError) {
        // スプレッドシートへの記録に失敗した場合でも、エラーログを記録して処理を続行
        Logger.log(`[WebhookHandler] ===== ERROR: FAILED TO SAVE TO SPREADSHEET =====`);
        Logger.log(`[WebhookHandler] ERROR: Failed to append interview to spreadsheet: ${appendError.toString()}`);
        Logger.log(`[WebhookHandler] Error stack: ${appendError.stack || 'No stack trace'}`);
        Utils.logError('WebhookHandler.appendInterview', appendError, { interviewData });
        
        // uidlogに記録（エラー時）
        try {
          SpreadsheetService.saveToUidlog('', '', `INTERVIEW_SAVE_ERROR: ${appendError.toString()}`);
        } catch (logError) {
          // ログ記録の失敗は無視
        }
        
        // エラーを再スローして、上位のエラーハンドリングに任せる
        throw new Error(`Failed to save interview to spreadsheet: ${appendError.toString()}`);
      }
      
      Logger.log(`[WebhookHandler] ===== handleEventConfirmed COMPLETED SUCCESSFULLY =====`);
      return {
        success: true,
        rowIndex: rowIndex
      };
    } catch (e) {
      Logger.log(`[WebhookHandler] ERROR in handleEventConfirmed: ${e.toString()}`);
      Logger.log(`[WebhookHandler] Error stack: ${e.stack || 'No stack trace'}`);
      Utils.logError('WebhookHandler.handleEventConfirmed', e, { payload });
      throw e;
    }
  },

  /**
   * 予約キャンセルイベントを処理
   * @param {Object} payload - Webhookペイロード
   * @param {string} payload.webhook_type - 'event_cancelled'
   * @param {Object} payload.event - イベントデータ
   * @return {Object} { success: boolean, updated: boolean }
   */
  handleEventCancelled(payload) {
    try {
      const event = payload.event;
      
      if (!event || !event.id) {
        throw new Error('Event ID is required');
      }

      // event_idでレコードを検索
      const interview = SpreadsheetService.findInterviewByEventId(event.id);
      
      if (!interview) {
        Logger.log(`Interview not found for event_id: ${event.id}`);
        // レコードが見つからなくてもエラーにはしない（既に削除済みの可能性）
        return {
          success: true,
          updated: false
        };
      }

      // ステータスをキャンセル（3）に更新
      const updateResult = SpreadsheetService.updateInterviewStatus(interview.rowIndex, Config.EVENT_STATUS.CANCELLED);

      Logger.log(`Event cancelled: ${event.id}, row: ${interview.rowIndex}, status updated: ${updateResult}`);
      
      // uidlogに記録（キャンセルステータス更新）
      try {
        SpreadsheetService.saveToUidlog('', '', `INTERVIEW_CANCELLED: ${interview.data && interview.data.guestName ? interview.data.guestName : 'Unknown'} eventId=${event.id}`);
      } catch (logError) {
        // ログ記録の失敗は無視
      }
      
      // Slack通知を送信
      try {
        // 面談者名・メール・Slackメンション用IDを取得
        let interviewerName = '未設定';
        let interviewerEmail = '';
        let interviewerSlackMemberId = '';
        if (interview.data && interview.data.interviewerId) {
          const allInterviewers = AdminApiService.getAllInterviewers();
          const interviewer = allInterviewers.find(i => i.id === interview.data.interviewerId);
          if (interviewer) {
            if (interviewer.name) interviewerName = interviewer.name;
            if (interviewer.googleCalendarId) interviewerEmail = interviewer.googleCalendarId;
            if (interviewer.slackMemberId) interviewerSlackMemberId = interviewer.slackMemberId;
          }
        }
        
        SlackService.notifyBookingCancelled({
          candidateName: interview.data && interview.data.guestName ? interview.data.guestName : '未設定',
          dateTime: interview.data && interview.data.startAt ? interview.data.startAt.toISOString() : new Date().toISOString(),
          interviewerName: interviewerName,
          interviewerEmail: interviewerEmail,
          interviewerSlackMemberId: interviewerSlackMemberId,
          adminPageUrl: Utils.getAdminPageUrl(interview.data && interview.data.interviewerId ? interview.data.interviewerId : '')
        });
      } catch (slackError) {
        Logger.log(`[WebhookHandler] Slack通知エラー（無視）: ${slackError.toString()}`);
        // Slack通知の失敗はキャンセル処理を止めない
      }
      
      // LステップAPI連携: 友だち情報をクリア（リマインド配信停止）。LSTEP_UID_ONLY のときはスキップ
      const lineUid = interview.data && interview.data.lineUid ? interview.data.lineUid : null;
      if (lineUid && !Config.LSTEP_UID_ONLY) {
        try {
          Logger.log(`[WebhookHandler] LステップAPI連携開始（キャンセル）: lineUid=${lineUid}`);
          if (Config.LSTEP_USE_TRIGGER_URL) {
            LStepApiService.triggerFriendUpdate(lineUid, {
              meeting_date: null,
              meeting_url: null,
              meeting_cancel_url: null
            }, { useCancelUrl: true });
          } else {
            LStepApiService.updateFriendInfo(lineUid, {
              meeting_date: null,
              meeting_url: null,
              meeting_cancel_url: null
            });
          }
          Logger.log(`[WebhookHandler] Lステップ友だち情報クリア成功（リマインド配信停止）`);
          
          // uidlogに記録（キャンセル時のLステップAPI連携成功）
          try {
            SpreadsheetService.saveToUidlog(lineUid || '', '', 'LSTEP_API_CANCEL_SUCCESS: 友だち情報クリア成功');
          } catch (logError) {
            // ログ記録の失敗は無視
          }
        } catch (lstepError) {
          Logger.log(`[WebhookHandler] LステップAPI連携エラー（キャンセル、無視）: ${lstepError.toString()}`);
          Utils.logError('WebhookHandler.LStepIntegration.Cancel', lstepError, { lineUid, eventId: event.id });
          
          // uidlogに記録（キャンセル時のLステップAPI連携失敗）
          try {
            SpreadsheetService.saveToUidlog(lineUid || '', '', `LSTEP_API_CANCEL_ERROR: ${lstepError.toString()}`);
          } catch (logError) {
            // ログ記録の失敗は無視
          }
          // LステップAPI連携失敗はキャンセル処理を止めない
        }
      } else if (!lineUid) {
        Logger.log(`[WebhookHandler] LINE UIDが取得できなかったため、LステップAPI連携をスキップ（キャンセル）`);
        try {
          SpreadsheetService.saveToUidlog('', '', `LSTEP_API_CANCEL_SKIP: LINE UID未取得 eventId=${event.id}`);
        } catch (logError) {}
      } else if (Config.LSTEP_UID_ONLY) {
        Logger.log(`[WebhookHandler] LSTEP_UID_ONLY のため、キャンセル時の友だち情報クリアはスキップ`);
      }
      
      return {
        success: true,
        updated: true,
        rowIndex: interview.rowIndex
      };
    } catch (e) {
      Utils.logError('WebhookHandler.handleEventCancelled', e, { payload });
      throw e;
    }
  }
};

