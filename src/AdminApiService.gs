/**
 * 管理画面用APIサービス
 * 管理画面に必要なデータを統合・提供
 */

const AdminApiService = {
  /**
   * 管理画面用データを取得
   * @param {string} interviewerId - 面談官ID（オプション）
   * @param {Date} startDate - 開始日（オプション、デフォルトは当月の開始）
   * @param {Date} endDate - 終了日（オプション、デフォルトは当月の終了）
   * @return {Object} 管理画面用データ
   */
  getAdminData(interviewerId = null, startDate = null, endDate = null) {
    try {
      // 日付範囲の設定
      const now = new Date();
      if (!startDate) {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      if (!endDate) {
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }
      
      Logger.log(`[AdminApiService] getAdminData called with startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`);

      // interviewersシートのデータ存在チェック
      const allInterviewersCheck = AdminApiService.getAllInterviewers(false);
      if (!allInterviewersCheck || allInterviewersCheck.length === 0) {
        throw new Error('interviewersシートにデータが登録されていません。まず、スプレッドシートに面談官データを追加してください。');
      }

      // 実行ユーザーのメールアドレスを取得
      const currentUserEmail = Session.getActiveUser().getEmail();
      
      // 面談官情報取得
      let interviewer = null;
      let calendarIds = [];

      if (interviewerId && interviewerId !== 'me') {
        // 特定のinterviewerIdが指定されている場合
        interviewer = SpreadsheetService.getInterviewerById(interviewerId);
        if (!interviewer) {
          throw new Error(`指定された面談官ID（${interviewerId}）がinterviewersシートに見つかりません。`);
        }
        if (!interviewer.googleCalendarId) {
          throw new Error(`面談官ID（${interviewerId}）のgoogle_calendar_idが設定されていません。`);
        }
        calendarIds = [interviewer.googleCalendarId];
      } else {
        // interviewerIdがnullまたは'me'の場合、実行ユーザーのメールアドレスで検索
        const allInterviewers = AdminApiService.getAllInterviewers();
        interviewer = Utils.findInterviewerByEmail(currentUserEmail, allInterviewers);
        
        if (interviewer && interviewer.googleCalendarId) {
          // 実行ユーザーに一致する担当者を見つけた場合
          calendarIds = [interviewer.googleCalendarId];
        } else {
          // 一致する担当者が見つからない場合、自動登録を試みる
          Logger.log(`[AdminApiService] 実行ユーザーが見つからないため、自動登録を試みます: ${currentUserEmail}`);
          const registrationResult = SpreadsheetService.registerInterviewerByEmail(currentUserEmail);
          if (registrationResult.interviewer && registrationResult.interviewer.googleCalendarId) {
            interviewer = registrationResult.interviewer;
            calendarIds = [interviewer.googleCalendarId];
            Logger.log(`[AdminApiService] 自動登録成功: ${interviewer.name}`);
          } else {
            // 自動登録に失敗した場合、エラーを返す
            throw new Error(`実行ユーザー（${currentUserEmail}）に一致する面談官がinterviewersシートに登録されていません。自動登録にも失敗しました。`);
          }
        }
      }

      // interviewsシートから予約データを取得（全員の予約を取得）
      const interviews = SpreadsheetService.getInterviewsByInterviewer(null, startDate, endDate);

      // Google Calendarからイベントを取得（全員のカレンダーから取得）
      const allInterviewers = AdminApiService.getAllInterviewers();
      const allCalendarIds = [];
      allInterviewers.forEach(i => {
        if (i.googleCalendarId && 
            !allCalendarIds.some(id => id.toLowerCase() === i.googleCalendarId.toLowerCase())) {
          allCalendarIds.push(i.googleCalendarId);
        }
      });
      
      const calendarEvents = allCalendarIds.length > 0
        ? CalendarService.getMultipleCalendarEvents(allCalendarIds, startDate, endDate)
        : [];

      // 統計情報を取得（全員の予定を対象）
      const statistics = SpreadsheetService.getStatistics(null);

      // 直近の予約リスト（今日以降、時間順）
      const upcomingInterviews = interviews
        .filter(i => {
          const start = i.startAt instanceof Date ? i.startAt : new Date(i.startAt);
          return start >= Utils.getStartOfDay(new Date());
        })
        .sort((a, b) => {
          const startA = a.startAt instanceof Date ? a.startAt : new Date(a.startAt);
          const startB = b.startAt instanceof Date ? b.startAt : new Date(b.startAt);
          return startA - startB;
        })
        .slice(0, 10) // 直近10件
        .map(interview => {
          // 面談官名を取得
          let interviewerName = null;
          if (interview.interviewerId) {
            try {
              const interviewer = SpreadsheetService.getInterviewerById(interview.interviewerId);
              if (interviewer) {
                interviewerName = interviewer.name;
              }
            } catch (e) {
              Logger.log(`[AdminApiService] Failed to get interviewer name for ${interview.interviewerId}: ${e.toString()}`);
            }
          }
          return {
            ...interview,
            interviewerName: interviewerName
          };
        });

      // FullCalendar用のイベントデータに変換
      // 現在のユーザーのカレンダーIDを渡して色分けに使用
      const currentUserCalendarId = interviewer && interviewer.googleCalendarId 
        ? interviewer.googleCalendarId 
        : currentUserEmail;
      const currentUserInterviewerId = interviewer && interviewer.id ? interviewer.id : null;
      const events = AdminApiService.convertToCalendarEvents(
        interviews, 
        calendarEvents, 
        currentUserInterviewerId,
        currentUserCalendarId,
        allInterviewers,
        startDate,
        endDate
      );

      Logger.log(`[AdminApiService] getAdminData returning ${events.length} events (interviews: ${interviews.length}, calendarEvents: ${calendarEvents.length})`);

      // 返却データを軽量化（DateオブジェクトをISO文字列に変換）
      // 注意: allInterviewersは77行目で既に取得済み（優先順位でソート済み）
      return {
        success: true,
        interviewer: interviewer,
        interviewers: allInterviewers, // 面談官一覧（優先順位順）
        events: events,
        interviews: interviews.map(i => ({
          ...i,
          startAt: i.startAt instanceof Date ? i.startAt.toISOString() : i.startAt,
          endAt: i.endAt instanceof Date ? i.endAt.toISOString() : i.endAt,
          createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt
        })),
        upcomingInterviews: upcomingInterviews.map(i => ({
          ...i,
          startAt: i.startAt instanceof Date ? i.startAt.toISOString() : i.startAt,
          endAt: i.endAt instanceof Date ? i.endAt.toISOString() : i.endAt,
          createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt
        })),
        statistics: statistics,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      };
    } catch (e) {
      Utils.logError('AdminApiService.getAdminData', e, { interviewerId, startDate, endDate });
      return {
        success: false,
        error: e.toString()
      };
    }
  },

  /**
   * 全ての面談官情報を取得（優先順位でソート）
   * @param {boolean} sortByPriority - 優先順位でソートするか（デフォルト: true）
   * @return {Array} 面談官情報の配列
   */
  getAllInterviewers(sortByPriority = true) {
    try {
      // SpreadsheetServiceの共通メソッドを使用
      const interviewers = SpreadsheetService._getAllInterviewersRaw(true);

      // 優先順位でソート（低い数値ほど優先度が高い、同じ場合は行番号順）
      if (sortByPriority) {
        interviewers.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return a.rowIndex - b.rowIndex;
        });
      }

      return interviewers;
    } catch (e) {
      Utils.logError('AdminApiService.getAllInterviewers', e);
      return [];
    }
  },

  /**
   * interviewsとGoogle CalendarイベントをFullCalendar形式に変換
   * @param {Array} interviews - interviewsシートのデータ
   * @param {Array} calendarEvents - Google Calendarイベント
   * @param {string} currentInterviewerId - 現在の面談官ID（色分け用）
   * @param {string} currentUserCalendarId - 現在のユーザーのカレンダーID（色分け用）
   * @param {Array} allInterviewers - 全面談官情報（カレンダーIDから面談官を特定するため）
   * @param {Date} startDate - 表示開始日（面談可能枠計算用）
   * @param {Date} endDate - 表示終了日（面談可能枠計算用）
   * @return {Array} FullCalendarイベント配列
   */
  convertToCalendarEvents(interviews, calendarEvents, currentInterviewerId = null, currentUserCalendarId = null, allInterviewers = [], startDate = null, endDate = null) {
    const events = [];
    
    Logger.log(`[AdminApiService] convertToCalendarEvents called with ${interviews.length} interviews, ${calendarEvents.length} calendar events`);
    
    // interviewsのeventIdセットを作成（重複チェック用）
    const interviewEventIds = new Set();
    interviews.forEach(interview => {
      if (interview.eventId) {
        interviewEventIds.add(interview.eventId);
      }
    });
    
    Logger.log(`[AdminApiService] interviewEventIds: ${Array.from(interviewEventIds).join(', ')}`);

    // interviewsデータを変換
    Logger.log(`[AdminApiService] Converting ${interviews.length} interviews to calendar events`);
    interviews.forEach(interview => {
      // statusが確定（1）のもののみ表示
      if (interview.status !== Config.EVENT_STATUS.CONFIRMED) {
        Logger.log(`[AdminApiService] Skipping interview with status ${interview.status}: ${interview.guestName} (eventId: ${interview.eventId})`);
        return;
      }
      
      const start = interview.startAt instanceof Date ? interview.startAt : new Date(interview.startAt);
      const end = interview.endAt instanceof Date ? interview.endAt : new Date(interview.endAt);
      
      // 面談官IDを取得して、自分の予約かどうかを判定
      const interviewInterviewerId = interview.interviewerId || '';
      const isCurrentUserInterview = currentInterviewerId && 
        interviewInterviewerId.toLowerCase() === currentInterviewerId.toLowerCase();
      
      // 面談官名を取得
      let interviewerName = '担当者';
      if (interviewInterviewerId) {
        try {
          const interviewer = SpreadsheetService.getInterviewerById(interviewInterviewerId);
          if (interviewer) {
            interviewerName = interviewer.name;
          }
        } catch (e) {
          Logger.log(`[AdminApiService] Failed to get interviewer name for ${interviewInterviewerId}: ${e.toString()}`);
        }
      }

      // 色分け: 自分の予約=緑、他メンバーの予約=ブルー（薄い）
      let backgroundColor, borderColor;
      if (isCurrentUserInterview) {
        backgroundColor = '#10B981'; // green-500（自分の面談予約）
        borderColor = '#10B981';
      } else {
        backgroundColor = '#60A5FA'; // blue-400（他メンバーの面談予約）
        borderColor = '#60A5FA';
      }

      const eventData = {
        id: interview.eventId || `interview-${interview.rowIndex}`,
        title: `面談：${interview.guestName}様`,
        start: start.toISOString(),
        end: end.toISOString(),
        backgroundColor: backgroundColor,
        borderColor: borderColor,
        extendedProps: {
          type: isCurrentUserInterview ? 'interview' : 'other_member_interview',
          guestName: interview.guestName,
          guestEmail: interview.guestEmail,
          meetUrl: interview.meetUrl,
          interviewerName: interviewerName,
          interviewerId: interviewInterviewerId,
          source: interview.source,
          eventId: interview.eventId,
          rowIndex: interview.rowIndex,
          isCurrentUser: isCurrentUserInterview
        }
      };
      
      Logger.log(`[AdminApiService] Adding interview event: ${eventData.title} (id: ${eventData.id}), type: ${eventData.extendedProps.type}, color: ${eventData.backgroundColor}`);
      events.push(eventData);
    });

    // Google Calendarイベントを変換
    calendarEvents.forEach(event => {
      // 終日イベントや時間情報がないイベントは既にCalendarService.getCalendarEventsで除外されているが、
      // 念のため再度チェック
      const start = event.start instanceof Date ? event.start : new Date(event.start);
      const end = event.end instanceof Date ? event.end : new Date(event.end);
      const duration = end.getTime() - start.getTime();
      
      // 終日イベントは既にCalendarService.getCalendarEventsで9時-21時に変換されている
      // ここではallDayフラグのチェックは不要（既にfalseになっている）
      
      // 勤務場所イベントを除外（「オフィス」「自宅」など）
      // 注意: GASのCalendarAppでは勤務場所を直接識別できないため、タイトルで判定
      const title = event.title || '';
      const workLocationKeywords = ['オフィス', '自宅', '在宅', 'リモート', '出社', 'Office', 'Home', 'Remote', '勤務場所'];
      if (workLocationKeywords.some(keyword => title.includes(keyword))) {
        return; // スキップ
      }
      
      // 時間差が0または極端に短い（5分未満）のイベントを除外
      // これにより、勤務場所やTODOなどの時間情報のないイベントを除外
      if (duration <= 0 || duration < 5 * 60 * 1000) { // 5分未満
        return; // スキップ
      }
      
      // 時間差が1時間未満のイベントを除外（TODOやタスクなど）
      if (duration < 60 * 60 * 1000) {
        return; // スキップ
      }
      
      // TimeRexから作成された面談予約イベントを除外（interviewsシートに記録されているため重複を避ける）
      // 1. 「面談:」または「面談：」で始まるタイトルのGoogle Calendarイベントは、すべて除外
      if (title.startsWith('面談:') || title.startsWith('面談：')) {
        Logger.log(`[AdminApiService] Skipping Google Calendar event with interview title: "${title}" (start: ${start.toISOString()}, end: ${end.toISOString()})`);
        Logger.log(`[AdminApiService] Reason: This event is already recorded in interviews sheet and will be displayed from there`);
        return; // スキップ
      }
      
      // 2. eventIdがinterviewsシートに存在する場合は除外
      if (event.id && interviewEventIds.has(event.id)) {
        Logger.log(`[AdminApiService] Skipping Google Calendar event with matching eventId: "${event.id}" (title: "${title}")`);
        Logger.log(`[AdminApiService] Reason: This event is already recorded in interviews sheet`);
        return; // スキップ
      }
      
      // 3. 時間とタイトルで重複チェック（eventIdが空の場合のフォールバック）
      // interviewsシートのデータと時間が一致し、タイトルに「面談」または「面談」が含まれる場合は除外
      const timeTolerance = 5 * 60 * 1000; // 5分の許容誤差
      const isDuplicate = interviews.some(interview => {
        if (interview.status !== Config.EVENT_STATUS.CONFIRMED) return false;
        const interviewStart = interview.startAt instanceof Date ? interview.startAt : new Date(interview.startAt);
        const timeDiff = Math.abs(start.getTime() - interviewStart.getTime());
        return timeDiff <= timeTolerance && (title.includes('面談') || title.includes('面談'));
      });
      
      if (isDuplicate) {
        Logger.log(`[AdminApiService] Skipping Google Calendar event (duplicate by time and title): "${title}" (start: ${start.toISOString()})`);
        Logger.log(`[AdminApiService] Reason: This event matches an interview in the interviews sheet`);
        return; // スキップ
      }
      
      // ブロックイベントの判定
      const isBlock = event.title && event.title.includes('【ブロック】');
      
      // カレンダーIDから面談官を特定
      const eventCalendarId = event.calendarId || '';
      const eventInterviewer = allInterviewers.find(i => 
        i.googleCalendarId && 
        i.googleCalendarId.toLowerCase() === eventCalendarId.toLowerCase()
      );
      const isCurrentUserCalendar = currentUserCalendarId && eventCalendarId && 
        eventCalendarId.toLowerCase() === currentUserCalendarId.toLowerCase();
      
      // 面談予約と同じ時間帯の場合は表示しない（重複を避ける）
      // ブロックイベントは除外（ブロックは表示する）
      const hasOverlappingInterview = !isBlock && interviews.some(interview => {
        if (interview.status !== Config.EVENT_STATUS.CONFIRMED) return false;
        const interviewStart = interview.startAt instanceof Date ? interview.startAt : new Date(interview.startAt);
        const interviewEnd = interview.endAt instanceof Date ? interview.endAt : new Date(interview.endAt);
        // 時間帯が重複しているかチェック
        return (start.getTime() < interviewEnd.getTime() + timeTolerance && 
                end.getTime() > interviewStart.getTime() - timeTolerance);
      });
      
      // 面談予約と重複している場合は、Google Calendarイベントを表示しない
      if (hasOverlappingInterview) {
        Logger.log(`[AdminApiService] Skipping Google Calendar event (overlaps with interview): "${title}" (start: ${start.toISOString()})`);
        return; // スキップ
      }
      
      // 色分け: ブロック=赤、その他=グレー
      // 面談以外のカレンダー予定はタイトルを表示せず、グレーアウトのみ
      let backgroundColor, borderColor, displayTitle;
      if (isBlock) {
        backgroundColor = '#EF4444'; // red-500
        borderColor = '#EF4444';
        displayTitle = event.title; // ブロックはタイトルを表示
      } else {
        backgroundColor = '#E5E7EB'; // gray-200（その他のGoogle Calendarイベント）- より薄く
        borderColor = '#E5E7EB';
        displayTitle = ''; // 面談以外のカレンダー予定はタイトルを表示しない（時間も表示しない）
      }
      
      // 点線枠で自身と他メンバーを区別
      const borderStyle = isCurrentUserCalendar ? 'solid' : 'dashed';
      const borderWidth = isCurrentUserCalendar ? 2 : 1;
      
      events.push({
        id: event.id || `gcal-${Date.now()}-${Math.random()}`,
        title: displayTitle,
        start: start.toISOString(),
        end: end.toISOString(),
        backgroundColor: backgroundColor,
        borderColor: borderColor,
        borderStyle: borderStyle,
        borderWidth: borderWidth,
        extendedProps: {
          type: isBlock ? 'block' : 'gcal',
          calendarId: eventCalendarId,
          description: event.description,
          location: event.location,
          isCurrentUser: isCurrentUserCalendar,
          interviewerId: eventInterviewer ? eventInterviewer.id : null,
          interviewerName: eventInterviewer ? eventInterviewer.name : null,
          originalTitle: event.title // モーダル表示用に元のタイトルを保持
        }
      });
    });

    // 面談可能枠を計算して追加
    // 各時間帯で2人未満の予定が入っている場合は面談可能枠として表示
    if (startDate && endDate && allInterviewers.length > 0) {
      const availableSlots = AdminApiService.calculateAvailableSlots(
        interviews,
        calendarEvents,
        allInterviewers,
        startDate,
        endDate
      );
      events.push(...availableSlots);
      Logger.log(`[AdminApiService] Added ${availableSlots.length} available slot events`);
    }

    return events;
  },

  /**
   * 面談可能枠を計算
   * 各時間帯（30分ごと）で、2人未満の予定が入っている場合は面談可能枠として返す
   * @param {Array} interviews - interviewsシートのデータ
   * @param {Array} calendarEvents - Google Calendarイベント
   * @param {Array} allInterviewers - 全面談官情報
   * @param {Date} startDate - 表示開始日
   * @param {Date} endDate - 表示終了日
   * @return {Array} 面談可能枠のイベント配列
   */
  calculateAvailableSlots(interviews, calendarEvents, allInterviewers, startDate, endDate) {
    const slots = [];
    const slotDuration = 30 * 60 * 1000; // 30分（ミリ秒）
    
    // 営業時間（9:00-20:00）を設定
    const businessStartHour = 9;
    const businessEndHour = 20;
    
    // startDateからendDateまで、1日ずつ処理
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    
    while (currentDate <= endDate) {
      // その日の営業時間内の30分スロットを生成
      for (let hour = businessStartHour; hour < businessEndHour; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotStart = new Date(currentDate);
          slotStart.setHours(hour, minute, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setTime(slotStart.getTime() + slotDuration);
          
          // このスロットに予定が入っている面談官のセット
          const busyInterviewerIds = new Set();
          
          // interviewsシートの確定予約をチェック
          interviews.forEach(interview => {
            if (interview.status !== Config.EVENT_STATUS.CONFIRMED) return;
            const interviewStart = interview.startAt instanceof Date ? interview.startAt : new Date(interview.startAt);
            const interviewEnd = interview.endAt instanceof Date ? interview.endAt : new Date(interview.endAt);
            
            // 時間帯が重複しているかチェック
            if (slotStart.getTime() < interviewEnd.getTime() && slotEnd.getTime() > interviewStart.getTime()) {
              if (interview.interviewerId) {
                busyInterviewerIds.add(interview.interviewerId);
              }
            }
          });
          
          // Google Calendarイベント（ブロックを含む）をチェック
          calendarEvents.forEach(event => {
            const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
            const eventEnd = event.end instanceof Date ? event.end : new Date(event.end);
            
            // 時間帯が重複しているかチェック
            if (slotStart.getTime() < eventEnd.getTime() && slotEnd.getTime() > eventStart.getTime()) {
              // カレンダーIDから面談官を特定
              const eventCalendarId = event.calendarId || '';
              const eventInterviewer = allInterviewers.find(i => 
                i.googleCalendarId && 
                i.googleCalendarId.toLowerCase() === eventCalendarId.toLowerCase()
              );
              if (eventInterviewer && eventInterviewer.id) {
                busyInterviewerIds.add(eventInterviewer.id);
              }
            }
          });
          
          // チーム空き枠: 2人未満の予定が入っている時間帯（青系、実線）
          if (busyInterviewerIds.size < 2 && allInterviewers.length >= 2) {
            slots.push({
              id: `team-available-slot-${slotStart.getTime()}`,
              title: '', // タイトルは表示しない
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              backgroundColor: '#EFF6FF', // blue-50
              borderColor: '#93C5FD', // blue-300
              borderStyle: 'solid',
              borderWidth: 1,
              display: 'background', // 背景として表示
              extendedProps: {
                type: 'available_slot',
                slotType: 'team',
                busyCount: busyInterviewerIds.size,
                totalInterviewers: allInterviewers.length
              }
            });
          }
          
          // 個人空き枠: 各面談官について、その面談官が空いている時間帯（緑系、点線）
          allInterviewers.forEach(interviewer => {
            if (!interviewer.id) return;
            // この面談官が忙しくない場合
            if (!busyInterviewerIds.has(interviewer.id)) {
              slots.push({
                id: `individual-available-slot-${interviewer.id}-${slotStart.getTime()}`,
                title: '', // タイトルは表示しない
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
                backgroundColor: '#F0FDF4', // green-50
                borderColor: '#86EFAC', // green-300
                borderStyle: 'dashed',
                borderWidth: 1,
                display: 'background', // 背景として表示
                extendedProps: {
                  type: 'available_slot',
                  slotType: 'individual',
                  interviewerId: interviewer.id,
                  interviewerName: interviewer.name
                }
              });
            }
          });
        }
      }
      
      // 次の日に進む
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return slots;
  },

  /**
   * 面談官の優先順位を更新
   * @param {string} interviewerId - 面談官ID
   * @param {number} priority - 優先順位（低い数値ほど優先度が高い）
   * @return {Object} { success: boolean, error?: string }
   */
  updateInterviewerPriority(interviewerId, priority) {
    try {
      if (!interviewerId) {
        throw new Error('interviewerId is required');
      }

      if (priority !== null && priority !== undefined && (isNaN(priority) || priority < 1)) {
        throw new Error('priority must be a positive number or null');
      }

      // SpreadsheetServiceの共通メソッドを使用
      SpreadsheetService.updateInterviewerPriority(interviewerId, priority);
      
      Logger.log(`Priority updated for interviewer ${interviewerId}: ${priority}`);
      return {
        success: true
      };
    } catch (e) {
      Utils.logError('AdminApiService.updateInterviewerPriority', e, { interviewerId, priority });
      return {
        success: false,
        error: e.toString()
      };
    }
  },

  /**
   * 複数の面談官の優先順位を一括更新
   * @param {Array} updates - 更新データの配列 [{ interviewerId: string, priority: number }, ...]
   * @return {Object} { success: boolean, updated: number, errors: Array }
   */
  updateInterviewerPriorities(updates) {
    try {
      if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error('updates must be a non-empty array');
      }

      // SpreadsheetServiceの共通メソッドを使用
      return SpreadsheetService.updateInterviewerPriorities(updates);
    } catch (e) {
      Utils.logError('AdminApiService.updateInterviewerPriorities', e, { updates });
      return {
        success: false,
        error: e.toString(),
        updated: 0,
        errors: []
      };
    }
  }
};

