/**
 * Google Calendar操作サービス
 * カレンダーの予定取得、イベント作成を担当
 */

const CalendarService = {
  /**
   * カレンダーIDでカレンダーを取得
   * @param {string} calendarId - カレンダーID（メールアドレス）
   * @return {Calendar} カレンダーオブジェクト
   */
  getCalendar(calendarId) {
    try {
      const calendar = CalendarApp.getCalendarById(calendarId);
      if (!calendar) {
        throw new Error(`${Config.ERROR_MESSAGES.CALENDAR_NOT_FOUND}: ${calendarId}`);
      }
      return calendar;
    } catch (e) {
      Utils.logError('CalendarService.getCalendar', e, { calendarId });
      throw e;
    }
  },

  /**
   * カレンダーのイベントを取得
   * @param {string} calendarId - カレンダーID
   * @param {Date} startDate - 開始日
   * @param {Date} endDate - 終了日
   * @return {Array} イベントデータの配列
   */
  getCalendarEvents(calendarId, startDate, endDate) {
    try {
      const calendar = CalendarService.getCalendar(calendarId);
      const events = calendar.getEvents(startDate, endDate);

      return events
        .map(event => ({
          id: event.getId(),
          title: event.getTitle(),
          start: event.getStartTime(), // Dateオブジェクト（convertToCalendarEventsでISO文字列に変換される）
          end: event.getEndTime(), // Dateオブジェクト（convertToCalendarEventsでISO文字列に変換される）
          description: event.getDescription(),
          location: event.getLocation(),
          // guests情報は削除してデータサイズを削減（必要に応じてdescriptionに含める）
          allDay: event.isAllDayEvent(),
          type: 'gcal' // Google Calendar予定の識別子
        }))
        .map(event => {
          // 終日イベントの場合、9時-21時に変換
          if (event.allDay) {
            const eventDate = new Date(event.start);
            eventDate.setHours(9, 0, 0, 0); // 9時開始
            const eventEnd = new Date(event.start);
            eventEnd.setHours(21, 0, 0, 0); // 21時終了
            
            return {
              ...event,
              start: eventDate,
              end: eventEnd,
              allDay: false // 終日フラグを解除
            };
          }
          return event;
        })
        .filter(event => {
          // 勤務場所イベントを除外（「オフィス」「自宅」など）
          // 注意: GASのCalendarAppでは勤務場所を直接識別できないため、タイトルで判定
          const title = event.title || '';
          const workLocationKeywords = ['オフィス', '自宅', '在宅', 'リモート', '出社', 'Office', 'Home', 'Remote', '勤務場所'];
          if (workLocationKeywords.some(keyword => title.includes(keyword))) {
            return false;
          }
          
          // 開始時刻と終了時刻の時間差を計算
          const duration = event.end.getTime() - event.start.getTime();
          
          // 時間差が0または極端に短い（5分未満）のイベントを除外
          // これにより、勤務場所やTODOなどの時間情報のないイベントを除外
          if (duration <= 0 || duration < 5 * 60 * 1000) { // 5分未満
            return false;
          }
          
          // 時間差が1時間未満のイベントも除外（TODOやタスクなど）
          if (duration < 60 * 60 * 1000) { // 1時間未満
            return false;
          }
          
          return true;
        });
    } catch (e) {
      Utils.logError('CalendarService.getCalendarEvents', e, { calendarId, startDate, endDate });
      return [];
    }
  },

  /**
   * ブロック時間を作成（TimeRexで予約不可にする）
   * @param {string} calendarId - カレンダーID
   * @param {Date} startTime - 開始時刻
   * @param {Date} endTime - 終了時刻
   * @return {CalendarEvent} 作成されたイベント
   */
  createBlockEvent(calendarId, startTime, endTime) {
    try {
      const calendar = CalendarService.getCalendar(calendarId);
      const event = calendar.createEvent(
        '【ブロック】面談不可',
        startTime,
        endTime
      );
      
      Logger.log(`Block event created: ${event.getId()}, ${startTime} - ${endTime}`);
      return {
        id: event.getId(),
        title: event.getTitle(),
        start: event.getStartTime(),
        end: event.getEndTime(),
        type: 'block'
      };
    } catch (e) {
      Utils.logError('CalendarService.createBlockEvent', e, { calendarId, startTime, endTime });
      throw e;
    }
  },

  /**
   * 面談予定イベントを作成
   * @param {Object} eventData - イベントデータ
   * @param {string} eventData.calendarId - カレンダーID
   * @param {string} eventData.title - イベントタイトル
   * @param {Date} eventData.startTime - 開始時刻
   * @param {Date} eventData.endTime - 終了時刻
   * @param {string} eventData.description - 説明（オプション）
   * @param {string} eventData.location - 場所（オプション）
   * @param {Array} eventData.guests - ゲストのメールアドレス配列（オプション）
   * @return {CalendarEvent} 作成されたイベント
   */
  createInterviewEvent(eventData) {
    try {
      const calendar = CalendarService.getCalendar(eventData.calendarId);
      
      const event = calendar.createEvent(
        eventData.title || '面談予約',
        eventData.startTime,
        eventData.endTime,
        {
          description: eventData.description || '',
          location: eventData.location || '',
          guests: eventData.guests || []
        }
      );

      Logger.log(`Interview event created: ${event.getId()}, ${eventData.startTime} - ${eventData.endTime}`);
      return {
        id: event.getId(),
        title: event.getTitle(),
        start: event.getStartTime(),
        end: event.getEndTime(),
        description: event.getDescription(),
        location: event.getLocation(),
        guests: event.getGuestList().map(guest => ({
          email: guest.getEmail(),
          name: guest.getName()
        }))
      };
    } catch (e) {
      Utils.logError('CalendarService.createInterviewEvent', e, { eventData });
      throw e;
    }
  },

  /**
   * 複数のカレンダーからイベントを取得
   * @param {Array} calendarIds - カレンダーIDの配列
   * @param {Date} startDate - 開始日
   * @param {Date} endDate - 終了日
   * @return {Array} イベントデータの配列（カレンダーID情報付き）
   */
  getMultipleCalendarEvents(calendarIds, startDate, endDate) {
    const allEvents = [];
    
    for (const calendarId of calendarIds) {
      try {
        const events = CalendarService.getCalendarEvents(calendarId, startDate, endDate);
        // カレンダーID情報を追加
        events.forEach(event => {
          event.calendarId = calendarId;
        });
        allEvents.push(...events);
      } catch (e) {
        // エラーが発生したカレンダーはスキップして続行
        Utils.logError('CalendarService.getMultipleCalendarEvents', e, { calendarId });
      }
    }

    return allEvents;
  }
};

