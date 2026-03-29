/**
 * メインエントリーポイント
 * doGet: HTTP GETリクエスト（予約画面・管理画面）
 * doPost: HTTP POSTリクエスト（Webhook受信）
 */

/**
 * HTTP GETリクエストハンドラー
 * @param {Object} e - リクエストパラメータ
 * @return {HtmlOutput|TextOutput} HTMLまたはJSONレスポンス
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const fromLine = (e.parameter.from || '').toString().trim() === 'line';
    // L-step フロー: postback タップ → メッセージでURL送信 → ユーザーがURLクリックでGET
    // 【重要】session_id がURLに含まれている場合はそれを優先する。含まれていない場合のみ「直近1件」を使用。
    // 「直近1件」は同時刻に他ユーザーがpostbackすると別ユーザーのセッションが割り当てられるため危険。→ docs/operations/INCIDENT_UID_MIXING_2026-02.md
    // action=lstep_webhook だと一部環境でPC表示になるため、メッセージ用リンクは ?from=line を推奨。
    if (action === 'lstep_webhook' || fromLine) {
      const interviewerId = (e.parameter.interviewer_id || '').toString().trim();
      const sessionIdFromUrl = (e.parameter.session_id || '').toString().trim();
      let sessionIdToUse = sessionIdFromUrl;
      if (!sessionIdToUse) {
        const recent = SpreadsheetService.getMostRecentSession(120);
        if (recent) sessionIdToUse = recent.sessionId;
      }
      if (sessionIdToUse) {
        // リダイレクトHTMLを返すと一部環境でPC表示になるため、予約画面を直接返す（中間ページを出さない）
        const bookingParams = { session_id: sessionIdToUse };
        if (interviewerId) bookingParams.interviewer_id = interviewerId;
        return handleBookingPage({ parameter: bookingParams });
      }
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
        <meta name="mobile-web-app-capable" content="yes">
        <title>エラー</title></head><body style="font-size:16px;padding:16px;">
        <h1>セッションが見つかりません</h1>
        <p>ボタンをタップしてから、表示されたURLを2分以内にクリックしてください。</p>
        <p>時間が経過した場合は、もう一度ボタンをタップし直してください。</p>
        </body></html>
      `).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    
    const page = e.parameter.page || 'booking';

    // ページ分岐
    if (page === 'admin') {
      return handleAdminPage(e);
    } else if (page === 'simple') {
      return handleSimplePage(e);
    } else {
      return handleBookingPage(e);
    }
  } catch (error) {
    Utils.logError('doGet', error, { parameters: e.parameter });
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Internal server error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * オブジェクトを再帰的に走査し、userId または uid らしき文字列（Uで始まる等）を返す
 * @param {Object} obj - ペイロード
 * @param {number} depth - 再帰深度（無限ループ防止）
 * @return {string} 見つかったuidまたは空文字
 */
function extractUidFromPayload(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 10 || obj === null || typeof obj !== 'object') return '';
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = extractUidFromPayload(obj[i], depth + 1);
      if (v) return v;
    }
    return '';
  }
  if (typeof obj.userId === 'string' && obj.userId.trim()) return obj.userId.trim();
  if (typeof obj.uid === 'string' && obj.uid.trim()) return obj.uid.trim();
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const v = extractUidFromPayload(obj[key], depth + 1);
      if (v) return v;
    }
  }
  return '';
}

/**
 * LステップWebhook転送を受信してUIDを取得し、セッションを保存する。
 * 戻り値はリダイレクト用HTML（L-stepサーバーが受け取る。ユーザーはメッセージ内の ?from=line を開き、そのときは予約画面を直接表示）。
 * @param {Object} e - リクエストパラメータ
 * @return {HtmlOutput} HTMLレスポンス
 */
function handleLStepWebhook(e) {
  try {
    Logger.log('[handleLStepWebhook] ========================================');
    Logger.log('[handleLStepWebhook] LステップWebhook転送を受信');
    Logger.log('[handleLStepWebhook] 受信時刻: ' + new Date().toISOString());
    Logger.log('[handleLStepWebhook] Parameters: ' + JSON.stringify(e.parameter));
    
    // POSTデータの詳細ログ（デバッグ用）
    if (e.postData) {
      Logger.log('[handleLStepWebhook] POST Data Type: ' + (e.postData.type || 'unknown'));
      Logger.log('[handleLStepWebhook] POST Data Length: ' + (e.postData.contents ? e.postData.contents.length : 0));
      if (e.postData.contents) {
        Logger.log('[handleLStepWebhook] POST Data Contents (raw): ' + e.postData.contents.substring(0, 1000)); // 最初の1000文字のみ
      }
    } else {
      Logger.log('[handleLStepWebhook] ⚠️ POST Data is not available');
    }

    // 直接AG申込（jukust_career-agent-portal）: ag:v1: postback は面接セッションを汚さず Vercel に中継のみ
    if (e.postData && e.postData.contents) {
      if (isAgApplicationLineWebhookPayload_(e.postData.contents)) {
        Logger.log('[handleLStepWebhook] AG申込 postback (ag:v1:) → Vercel 中継のうえ面接フローをスキップ');
        relayRawLineWebhookToAgPortal_(e.postData.contents);
        return agPortalRelayMinimalOkHtml_();
      }
    }

    // LステップのWebhook転送からUIDを取得
    // 注意: ボタンがURIの場合はブラウザでGETが飛ぶためPOSTが来ないことがある。L-stepがPOSTで転送する場合は別リクエストで届く。
    let uid = '';
    let parsedPayload = null;

    // まずURLパラメータを確認（L-stepがリダイレクト時にuidを付与している場合）
    if (e.parameter) {
      uid = (e.parameter.uid || e.parameter.user_id || e.parameter.line_user_id || e.parameter.userId || '').toString().trim();
      if (uid) {
        Logger.log('[handleLStepWebhook] UID from URL parameters: ' + uid);
      }
    }

    // POSTデータから取得を試行（JSON形式）
    // LINE標準: { "destination":"...", "events":[ { "source":{ "userId":"Uxxxx" } } ] }
    // 仕様の抽出順: docs/LSTEP_WEBHOOK_SPEC.md 5.2（uid, user_id, line_user_id, source?.userId, events?.[0]?.source?.userId）
    if (!uid && e.postData && e.postData.contents) {
      try {
        parsedPayload = JSON.parse(e.postData.contents);
        Logger.log('[handleLStepWebhook] Parsed Payload (first 2000 chars): ' + JSON.stringify(parsedPayload).substring(0, 2000));

        // events 配列を取得（L-step が body / data / payload でラップしている場合に対応）
        const events = parsedPayload.events ||
          parsedPayload.body?.events ||
          parsedPayload.data?.events ||
          parsedPayload.payload?.events ||
          [];
        const firstEvent = Array.isArray(events) && events.length > 0 ? events[0] : null;

        // LINE形式を優先し、仕様5.2のトップレベルキーをフォールバック
        uid = (firstEvent?.source?.userId || firstEvent?.source?.user_id || '') ||
              parsedPayload.uid ||
              parsedPayload.user_id ||
              parsedPayload.line_user_id ||
              parsedPayload.userId ||
              parsedPayload.source?.userId ||
              parsedPayload.events?.[0]?.source?.userId ||
              parsedPayload.body?.events?.[0]?.source?.userId ||
              (parsedPayload.friend_id && parsedPayload.friend_id.toString()) ||
              '';
        if (!uid && typeof parsedPayload === 'object') {
          uid = extractUidFromPayload(parsedPayload);
        }
        Logger.log('[handleLStepWebhook] UID extracted from POST: ' + (uid || '(none)'));
      } catch (parseError) {
        Logger.log('[handleLStepWebhook] Failed to parse POST data: ' + parseError.toString());
        Logger.log('[handleLStepWebhook] Raw POST data: ' + (e.postData.contents || '').substring(0, 500));
      }
    }

    if (!uid && (!e.postData || !e.postData.contents)) {
      Logger.log('[handleLStepWebhook] ⚠️ POST data is empty. Request may be GET (browser opened the link). L-step must send Webhook as POST to this URL with LINE event body.');
    }

    if (!uid) {
      Logger.log('[handleLStepWebhook] ⚠️ UID not found in webhook payload');
      Logger.log('[handleLStepWebhook] URL parameters: ' + JSON.stringify(e.parameter || {}));
      if (parsedPayload && typeof parsedPayload === 'object') {
        Logger.log('[handleLStepWebhook] Payload top-level keys: ' + Object.keys(parsedPayload).join(', '));
      }
      // uidlogに記録（doPostのログを開けなくても確認できるように）
      try {
        const hasPost = e.postData && e.postData.contents ? 'yes' : 'no';
        const payloadKeys = parsedPayload && typeof parsedPayload === 'object' ? Object.keys(parsedPayload).join(',') : '-';
        const rawPost = (e.postData && e.postData.contents) ? e.postData.contents.substring(0, 500) : '(none)';
        SpreadsheetService.saveToUidlog('', '', `LSTEP_UID_NG: POST=${hasPost} keys=${payloadKeys} ${rawPost}`);
      } catch (_) { /* ログ失敗は無視 */ }
      // UIDが取得できない場合はエラーページを返す
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
          <title>エラー | 予約システム</title>
        </head>
        <body style="font-size:16px;padding:16px;">
          <h1>UID取得に失敗しました</h1>
          <p>LステップのWebhook転送からUIDを取得できませんでした。設定を確認してください。</p>
          <p><strong>次の手順で原因を確認してください：</strong></p>
          <ol>
            <li>GASエディタで「実行数」または「実行」タブを開き、<strong>今タップした時刻の前後</strong>の実行を確認する。</li>
            <li>ログに <code>[doPost]</code> が出ているか確認する。<br>
              → <strong>出ていない</strong>場合：L-stepからPOSTが届いていません。「LINE Webhook転送設定」のURLがこのGASの<strong>デプロイURL（フルURL）</strong>か、L-stepが「URIタップ」時に転送する仕様か確認する。</li>
            <li>ログに <code>[handleLStepWebhook] ⚠️ POST data is empty</code> が出ているか確認する。<br>
              → <strong>出ている</strong>場合：届いているのはGET（ブラウザ）だけです。LINEの<strong>トーク内のボタン</strong>からタップし、L-stepが同じURLにPOSTで転送する設定になっているか確認する。</li>
            <li><code>[handleLStepWebhook] Payload top-level keys: ...</code> が出ている場合、その「...」のキー名を控えると、ペイロード形式の対応に使えます。</li>
          </ol>
          <p>参照: docs/LSTEP_LINEID_SOLUTION.md / docs/LSTEP_WEBHOOK_SPEC.md</p>
        </body>
        </html>
      `).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    
    Logger.log('[handleLStepWebhook] ✅ UID extracted: ' + uid);
    
    // interviewer_id を取得（postback.data または URL パラメータから）
    let interviewerId = (e.parameter && e.parameter.interviewer_id) ? String(e.parameter.interviewer_id).trim() : '';
    if (!interviewerId && parsedPayload) {
      const events = parsedPayload.events || parsedPayload.body?.events || parsedPayload.data?.events || [];
      const ev = Array.isArray(events) && events[0] ? events[0] : null;
      if (ev && ev.postback && ev.postback.data) {
        try {
          const pb = typeof ev.postback.data === 'string' ? JSON.parse(ev.postback.data) : ev.postback.data;
          interviewerId = (pb.interviewer_id || pb.interviewerId || '').toString().trim();
        } catch (_) { /* postback.data がJSONでない場合 */ }
      }
    }
    if (interviewerId) Logger.log('[handleLStepWebhook] interviewer_id from postback: ' + interviewerId);

    // template シート: postback.data に含まれる tag から interviewer_id（outer_id）を解決
    const eventsForData = parsedPayload && (parsedPayload.events || parsedPayload.body?.events || parsedPayload.data?.events || []);
    const firstEventForData = Array.isArray(eventsForData) && eventsForData.length > 0 ? eventsForData[0] : null;
    const dataStrForTemplate = (firstEventForData && firstEventForData.postback && firstEventForData.postback.data) ? String(firstEventForData.postback.data) : '';
    if (!interviewerId && dataStrForTemplate) {
      const outerId = SpreadsheetService.getInterviewerIdForPostbackData(dataStrForTemplate);
      if (outerId) {
        interviewerId = outerId;
        Logger.log('[handleLStepWebhook] interviewer_id from template sheet (outer_id): ' + interviewerId);
      }
    }

    // L-stepのfriend_id（1. ペイロード先頭 2. postback.data の friend_id キー 3. postback.data の flex_code 内 _9桁_）
    let friendId = (parsedPayload && parsedPayload.friend_id != null && parsedPayload.friend_id !== '') ? String(parsedPayload.friend_id).trim() : '';
    if (!friendId && dataStrForTemplate) {
      friendId = Utils.extractFriendIdFromPostbackData(dataStrForTemplate);
      if (friendId) Logger.log('[handleLStepWebhook] friend_id from postback.data (flex_code): ' + friendId);
    }

    // セッションIDを生成
    const sessionId = Utilities.getUuid();
    
    // 【並列保存】CacheServiceとuidlogの両方に保存
    // 1. CacheServiceに保存（高速取得用、10分有効期限）
    const cache = CacheService.getScriptCache();
    cache.put(`uid_${sessionId}`, uid, 600);
    Logger.log('[handleLStepWebhook] UID saved to cache with session_id: ' + sessionId);
    
    // 2. uidlogに保存（日時, uid, sessionid, イベント種別, friendid）
    const saved = SpreadsheetService.saveToUidlog(uid, sessionId, 'postback', friendId);
    
    if (!saved) {
      Logger.log('[handleLStepWebhook] ⚠️ Failed to save to uidlog (continuing anyway)');
      // エラーでも処理を続行（CacheServiceに保存されているため）
    } else {
      Logger.log('[handleLStepWebhook] UID saved to uidlog with session_id: ' + sessionId);
    }
    
    // 予約システムにリダイレクト（本番デプロイURLがあればそちらへ）
    const baseUrl = (Config.BOOKING_BASE_URL && Config.BOOKING_BASE_URL.trim()) !== ''
      ? Config.BOOKING_BASE_URL.replace(/\/$/, '')
      : `https://script.google.com/macros/s/${ScriptApp.getScriptId()}/exec`;
    const redirectUrl = `${baseUrl}?session_id=${sessionId}${interviewerId ? '&interviewer_id=' + interviewerId : ''}&from=line`;
    const redirectUrlEscaped = redirectUrl.replace(/&/g, '&amp;'); // meta content 用

    Logger.log('[handleLStepWebhook] Redirecting to: ' + redirectUrl);

    // API連携で「予約URLをメッセージに埋め込んで送信」する（LSTEP_BOOKING_LINK_TRIGGER_URL が設定されている場合）
    // 送信条件: event.type === 'postback'。さらに (1) LSTEP_BOOKING_LINK_POSTBACK_PATTERN が設定されていればその文字列が postback.data に含まれるとき、(2) 未設定で template シートに行があれば postback.data がその tag のいずれかに一致するとき、(3) それ以外はすべての postback で送信
    const bookingLinkTriggerUrl = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.LSTEP_BOOKING_LINK_TRIGGER_URL) || '';
    const bookingLinkPostbackPattern = (PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.LSTEP_BOOKING_LINK_POSTBACK_PATTERN) || '').trim();
    Logger.log('[handleLStepWebhook] LSTEP_BOOKING_LINK_TRIGGER_URL: ' + (bookingLinkTriggerUrl && bookingLinkTriggerUrl.trim() ? 'set len=' + bookingLinkTriggerUrl.trim().length : 'empty'));
    let shouldSendBookingLink = false;
    if (bookingLinkTriggerUrl && bookingLinkTriggerUrl.trim()) {
      const events = parsedPayload && (parsedPayload.events || parsedPayload.body?.events || parsedPayload.data?.events || []);
      const firstEvent = Array.isArray(events) && events.length > 0 ? events[0] : null;
      if (firstEvent && firstEvent.type === 'postback') {
        const dataStr = (firstEvent.postback && firstEvent.postback.data) ? String(firstEvent.postback.data) : '';
        Logger.log('[handleLStepWebhook] postback.data (パターン判定用): ' + (dataStr || '(空)'));
        // 実行ログを開かずに確認できるよう、postback.data を uidlog に1行追記
        try {
          SpreadsheetService.saveToUidlog(uid, sessionId, 'POSTBACK_DATA: ' + (dataStr || '(空)').substring(0, 100), friendId);
        } catch (_) { /* ログ失敗は無視 */ }
        if (bookingLinkPostbackPattern) {
          shouldSendBookingLink = dataStr.indexOf(bookingLinkPostbackPattern) !== -1;
          if (!shouldSendBookingLink) Logger.log('[handleLStepWebhook] 予約URL送信スキップ: postback.data がパターン "' + bookingLinkPostbackPattern + '" に一致しません');
        } else {
          const templates = SpreadsheetService.getBookingLinkTemplates();
          if (templates.length > 0) {
            shouldSendBookingLink = SpreadsheetService.isPostbackDataMatchingTemplate(dataStr);
            if (!shouldSendBookingLink) Logger.log('[handleLStepWebhook] 予約URL送信スキップ: postback.data が template シートのいずれの tag にも一致しません');
          } else {
            shouldSendBookingLink = true;
          }
        }
      } else {
        Logger.log('[handleLStepWebhook] 予約URL送信スキップ: イベント種別が postback ではありません (type=' + (firstEvent ? firstEvent.type : 'none') + ')');
      }
    }
    if (bookingLinkTriggerUrl && bookingLinkTriggerUrl.trim() && shouldSendBookingLink) {
      try {
        LStepApiService.triggerBookingLinkMessage(uid, redirectUrl);
        Logger.log('[handleLStepWebhook] 予約URL送信トリガー呼び出し完了');
        try {
          SpreadsheetService.saveToUidlog(uid, sessionId, 'BOOKING_LINK_SENT', friendId);
        } catch (_) { /* ログ失敗は無視 */ }
      } catch (linkErr) {
        Logger.log('[handleLStepWebhook] 予約URL送信トリガーエラー（処理は続行）: ' + linkErr.toString());
        Utils.logError('handleLStepWebhook.triggerBookingLinkMessage', linkErr, { uid, sessionId });
        try {
          SpreadsheetService.saveToUidlog(uid, sessionId, 'BOOKING_LINK_ERROR: ' + (linkErr.message || linkErr.toString()).substring(0, 80), friendId);
        } catch (_) { /* ログ失敗は無視 */ }
      }
    }
    
    // L-step がレスポンスからメッセージ用URLを取得できるよう、session_id 付きURLを機械可読で埋め込む（UID混入防止）
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
        <meta name="booking_url" content="${redirectUrlEscaped}">
        <meta http-equiv="refresh" content="0;url=${redirectUrl}">
        <title>リダイレクト中...</title>
        <script>
          window.LSTEP_BOOKING_URL = ${JSON.stringify(redirectUrl)};
        </script>
      </head>
      <body style="font-size:16px;padding:16px;">
        <p>リダイレクト中...</p>
        <!-- LSTEP_BOOKING_URL: ${redirectUrl} -->
        <script>
          window.location.href = ${JSON.stringify(redirectUrl)};
        </script>
      </body>
      </html>
    `).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    Utils.logError('handleLStepWebhook', error, { parameters: e.parameter });
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
        <title>エラー | 予約システム</title>
      </head>
      <body style="font-size:16px;padding:16px;">
        <h1>エラーが発生しました</h1>
        <p>${error.toString()}</p>
      </body>
      </html>
    `).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

/**
 * 予約画面を返す
 * @param {Object} e - リクエストパラメータ
 * @return {HtmlOutput} HTMLレスポンス
 */
function handleBookingPage(e) {
  let uid = '';
  
  // セッションIDからUIDを取得（優先順位: CacheService → スプレッドシート）
  const sessionId = e.parameter.session_id;
  if (sessionId) {
    // 1. CacheServiceから取得（高速）
    const cache = CacheService.getScriptCache();
    uid = cache.get(`uid_${sessionId}`) || '';
    
    if (uid) {
      Logger.log(`[handleBookingPage] ✅ UID retrieved from cache: ${uid}`);
    } else {
      // 2. CacheServiceにない場合、スプレッドシートから取得（フォールバック）
      Logger.log(`[handleBookingPage] UID not found in cache, trying uidlog...`);
      uid = SpreadsheetService.getUidFromSessionSpreadsheet(sessionId);
      
      if (uid) {
        Logger.log(`[handleBookingPage] ✅ UID retrieved from uidlog: ${uid}`);
        // uidlogから取得できた場合、CacheServiceにも再保存（次回は高速化）
        cache.put(`uid_${sessionId}`, uid, 600);
      } else {
        Logger.log(`[handleBookingPage] ⚠️ UID not found in both cache and uidlog for session_id: ${sessionId}`);
      }
    }
  }
  
  // 後方互換性: URLパラメータからも取得を試行（既存の実装を維持）
  if (!uid) {
    uid = e.parameter.uid || '';
    if (uid) {
      Logger.log(`[handleBookingPage] UID retrieved from URL parameter: ${uid}`);
    }
  }
  
  const interviewerId = e.parameter.interviewer_id || null;
  
  // ユーザー情報取得（現時点では簡易実装）
  // uid と session_id をセットで渡し、予約確定時の line_uid と一意に紐づける（UID混入防止）
  const userData = {
    uid: uid,
    sessionId: sessionId || '', // 予約画面URLの session_id（uid と対応）。L-step メッセージURLに含めることで混入防止
    userName: 'ゲスト様', // デフォルト値
    userEmail: '',
    userImage: ''
  };

  // TimeRex設定取得（interviewer_idベース）
  let timerexBaseUrl = '';
  let errorMessage = null;
  let interviewerName = null; // 個別カレンダー表示用
  
  try {
    if (interviewerId) {
      // 個別カレンダー: interviewer_idが指定されている場合
      const interviewer = SpreadsheetService.getInterviewerById(interviewerId);
      if (!interviewer) {
        errorMessage = `面談官ID（${interviewerId}）が見つかりません。`;
      } else if (!interviewer.timerexConfigId) {
        errorMessage = `面談官（${interviewer.name}）のTimeRex設定が完了していません。`;
      } else {
        timerexBaseUrl = getTimeRexBaseUrl(interviewer);
        interviewerName = interviewer.name; // 面談官名を保存
      }
    } else {
      // 統合カレンダー: interviewer_idが指定されていない場合
      timerexBaseUrl = getTimeRexBaseUrl(null);
      if (!timerexBaseUrl) {
        const teamUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH);
        const teamCalendarUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_CALENDAR_URL_PATH);
        
        if (!teamUrlPath) {
          errorMessage = 'TimeRexチームURLパス（TIMEREX_TEAM_URL_PATH）が設定されていません。GASエディタで setScriptProperties({ TIMEREX_TEAM_URL_PATH: "y-haraguchi_6612", TIMEREX_TEAM_CALENDAR_URL_PATH: "23a9cb5e" }); を実行してください。';
        } else if (!teamCalendarUrlPath) {
          errorMessage = '統合カレンダーURLパス（TIMEREX_TEAM_CALENDAR_URL_PATH）が設定されていません。GASエディタで setScriptProperties({ TIMEREX_TEAM_CALENDAR_URL_PATH: "23a9cb5e" }); を実行してください。';
        } else {
          errorMessage = '統合カレンダーの設定が完了していません。設定を確認してください。';
        }
      }
    }
  } catch (error) {
    Utils.logError('handleBookingPage', error, { interviewerId, uid });
    errorMessage = 'カレンダー情報の取得中にエラーが発生しました。';
  }

  // HTMLテンプレートを読み込み
  const template = HtmlService.createTemplateFromFile('Booking');
  
  // テンプレートにデータを埋め込み
  template.userData = JSON.stringify(userData);
  template.timerexBaseUrl = timerexBaseUrl || '';
  template.errorMessage = errorMessage || '';
  template.interviewerName = interviewerName || ''; // 個別カレンダー表示用

  return template.evaluate()
    .setTitle('面談予約 | エージェント日程調整')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // LINEアプリ内ブラウザ対応（DEFAULTだとLINEで真っ白になる）
}

/**
 * 切り分け用: シンプルなページを返す（モバイル表示の原因が iframe 幅かコンテンツか切り分けるため）
 * URL: .../exec?page=simple
 * @param {Object} e - リクエストパラメータ
 * @return {HtmlOutput} HTMLレスポンス
 */
function handleSimplePage(e) {
  const template = HtmlService.createTemplateFromFile('SimpleBooking');
  return template.evaluate()
    .setTitle('モバイル表示テスト | 切り分け用')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 管理画面を返す
 * @param {Object} e - リクエストパラメータ
 * @return {HtmlOutput} HTMLレスポンス
 */
function handleAdminPage(e) {
  const interviewerId = e.parameter.interviewer_id || null;
  
  // 実行ユーザー情報を取得
  const currentUserEmail = Session.getActiveUser().getEmail();
  let currentUserName = '';
  let currentUserImage = '';
  
  // Googleアカウントから名前を取得（試行）
  try {
    const activeUser = Session.getActiveUser();
    const userName = activeUser.getName();
    if (userName && userName.trim() !== '') {
      currentUserName = userName;
      Logger.log(`[handleAdminPage] Got name from Session.getActiveUser().getName(): ${currentUserName}`);
    }
  } catch (error) {
    Logger.log(`[handleAdminPage] Failed to get name from Session.getActiveUser().getName(): ${error.toString()}`);
  }
  
  // 名前が取得できなかった場合、メールアドレスから推測
  if (!currentUserName || currentUserName.trim() === '') {
    currentUserName = currentUserEmail.split('@')[0];
    Logger.log(`[handleAdminPage] Using email prefix as name: ${currentUserName}`);
  }
  
  // interviewersシートのデータ存在チェック
  try {
    const allInterviewers = AdminApiService.getAllInterviewers(false); // ソート不要で取得
    if (!allInterviewers || allInterviewers.length === 0) {
      // interviewersシートが空の場合、実行ユーザーを自動登録
      Logger.log(`[handleAdminPage] interviewersシートが空のため、実行ユーザーを自動登録: ${currentUserEmail}`);
      const registrationResult = SpreadsheetService.registerInterviewerByEmail(currentUserEmail);
      if (!registrationResult.interviewer) {
        // 自動登録に失敗した場合、エラーページを返す
        const errorHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>エラー | 管理画面</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 flex items-center justify-center min-h-screen">
  <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
    <div class="text-center">
      <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
        <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-gray-800 mb-2">データが設定されていません</h1>
      <p class="text-gray-600 mb-6">
        interviewersシートに面談官データが登録されていません。<br>
        まず、スプレッドシートに面談官データを追加してください。
      </p>
      <div class="bg-gray-50 rounded-lg p-4 text-left text-sm text-gray-700 mb-6">
        <p class="font-semibold mb-2">必要な設定:</p>
        <ul class="list-disc list-inside space-y-1">
          <li>interviewersシートに面談官データを追加</li>
          <li>各面談官のid, name, timerex_config_id, google_calendar_idを設定</li>
        </ul>
      </div>
      <button 
        onclick="window.location.reload()" 
        class="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded-lg transition"
      >
        再読み込み
      </button>
    </div>
  </div>
</body>
</html>
      `;
      return HtmlService.createHtmlOutput(errorHtml)
        .setTitle('エラー | 管理画面')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      }
      // 自動登録成功後、通常の処理を続行
      Logger.log(`[handleAdminPage] 自動登録成功: ${registrationResult.interviewer.name}`);
    }
  } catch (error) {
    Utils.logError('handleAdminPage', error, { currentUserEmail });
    // エラーが発生した場合も同様にエラーページを返す
    const errorHtml = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>エラー | 管理画面</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 flex items-center justify-center min-h-screen">
  <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
    <div class="text-center">
      <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
        <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
        </svg>
      </div>
      <h1 class="text-2xl font-bold text-gray-800 mb-2">エラーが発生しました</h1>
      <p class="text-gray-600 mb-6">
        データの取得中にエラーが発生しました。<br>
        スプレッドシートの設定を確認してください。
      </p>
      <button 
        onclick="window.location.reload()" 
        class="bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-2 rounded-lg transition"
      >
        再読み込み
      </button>
    </div>
  </div>
</body>
</html>
    `;
    return HtmlService.createHtmlOutput(errorHtml)
      .setTitle('エラー | 管理画面')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  
  // 実行ユーザーのメールアドレスに一致する担当者を検索
  let currentInterviewer = null;
  try {
    const allInterviewers = AdminApiService.getAllInterviewers();
    currentInterviewer = Utils.findInterviewerByEmail(currentUserEmail, allInterviewers);
    
    // 見つからない場合、自動登録を試みる
    if (!currentInterviewer) {
      Logger.log(`[handleAdminPage] 実行ユーザーが見つからないため、自動登録を試みます: ${currentUserEmail}`);
      const registrationResult = SpreadsheetService.registerInterviewerByEmail(currentUserEmail);
      if (registrationResult.interviewer) {
        currentInterviewer = registrationResult.interviewer;
        Logger.log(`[handleAdminPage] 自動登録成功: ${currentInterviewer.name}`);
      } else {
        Logger.log(`[handleAdminPage] 自動登録に失敗しました: ${currentUserEmail}`);
      }
    }
  } catch (error) {
    Utils.logError('handleAdminPage', error, { currentUserEmail });
    // エラーが発生した場合も自動登録を試みる
    try {
      const registrationResult = SpreadsheetService.registerInterviewerByEmail(currentUserEmail);
      if (registrationResult.interviewer) {
        currentInterviewer = registrationResult.interviewer;
        Logger.log(`[handleAdminPage] エラー後の自動登録成功: ${currentInterviewer.name}`);
      }
    } catch (regError) {
      Utils.logError('handleAdminPage auto-register', regError, { currentUserEmail });
    }
  }
  
  // HTMLテンプレートを読み込み
  const template = HtmlService.createTemplateFromFile('Admin');
  
  // 面談官が見つかった場合、その名前を優先（interviewersシートの名前が正確）
  const displayName = currentInterviewer ? currentInterviewer.name : currentUserName;
  
  // テンプレートにデータを埋め込み
  // interviewerIdがURLパラメータで指定されていない場合、現在のユーザーのIDを使用
  template.interviewerId = interviewerId || (currentInterviewer ? currentInterviewer.id : '');
  template.currentUserEmail = currentUserEmail;
  template.currentUserName = displayName;
  template.currentUserImage = currentUserImage; // 後でGoogle Profile APIから取得できる場合に拡張

  return template.evaluate()
    .setTitle('面談官ポータル | 管理画面')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HTTP POSTリクエストハンドラー（Webhook受信）
 * @param {Object} e - POSTリクエストデータ
 * @return {TextOutput} JSONレスポンス
 */
function doPost(e) {
  try {
    // doPost が呼ばれた証拠を残す（実行一覧に doPost が出ない場合の確認用）
    try {
      PropertiesService.getScriptProperties().setProperty('LAST_DOPOST_AT', new Date().toISOString());
    } catch (_) { /* 失敗は無視 */ }

    // === 最初に必ずログ記録（デプロイ確認用マーカー付き） ===
    const LOG_VER = '20260210'; // デプロイ確認: この値がログに出れば新コードが動いている
    const rawBodyStr = (e.postData && e.postData.contents) ? String(e.postData.contents) : '(no postData)';
    const paramKeys = Object.keys(e.parameter || {});
    try {
      if (SpreadsheetService.getSpreadsheet()) {
        SpreadsheetService.saveToUidlog('', '', `WEBHOOK_RAW: v${LOG_VER} params=[${paramKeys.join(',')}] len=${rawBodyStr.length}`);
      }
    } catch (logErr) {
      Logger.log('[doPost] WEBHOOK_RAW log failed: ' + (logErr && logErr.toString ? logErr.toString() : 'unknown'));
    }

    // Webhook受信ログ（デバッグ用）
    Logger.log('========================================');
    Logger.log('[doPost] ===== WEBHOOK RECEIVED =====');
    Logger.log(`[doPost] Timestamp: ${new Date().toISOString()}`);
    Logger.log(`[doPost] postData: ${e.postData ? 'present' : 'missing'}`);
    Logger.log(`[doPost] parameters: ${JSON.stringify(Object.keys(e.parameter || {}))}`);
    
    // LステップWebhook転送の処理（POSTリクエストの場合）
    // 重要: Webhook転送URLには ?action=lstep_webhook を付けないこと。
    // 付けるとL-stepがPOST本文を転送せず、UID取得に失敗する。
    const action = e.parameter.action;
    if (action === 'lstep_webhook') {
      if (e.postData && e.postData.contents) {
        Logger.log('[doPost] L-step Webhook転送を検出（URLに action=lstep_webhook、POST本文あり）');
        return handleLStepWebhook(e);
      }
      // action=lstep_webhook だが POST本文がない → Webhook転送URLの設定ミス
      Logger.log('[doPost] action=lstep_webhook だが POST本文なし。Webhook転送URLにクエリを付けている可能性');
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
        <title>設定誤り</title></head><body style="font-size:16px;padding:16px;">
        <h1>Webhook転送の設定を確認してください</h1>
        <p><strong>L-stepの「Webhook転送」URLには <code>?action=lstep_webhook</code> を付けないでください。</strong></p>
        <p>ベースURLのみを指定してください。例:</p>
        <pre>https://script.google.com/macros/s/XXXXX/exec</pre>
        <p>メッセージ内のURL（ユーザーがクリックする方）には <code>?action=lstep_webhook</code> を付けてください。</p>
        </body></html>
      `).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    // L-stepがURLにactionを付けずにPOSTしている場合: bodyがLINE形式ならL-stepとして処理
    // L-stepはクエリパラメータなしでPOSTするため、paramKeys が空でもここで検出する
    if (e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        // TimeRex形式ならスキップ（後の処理へ）
        if (body.webhook_type) {
          // TimeRexの場合は何もしない
        } else {
          // body が {hasPostData, paramKeys} 等のメタ情報のみ → LINEの実イベントが届いていない
          const keys = Object.keys(body || {});
          const hasMetaOnly = keys.length <= 2 && (keys.includes('hasPostData') || keys.includes('paramKeys'));
          if (hasMetaOnly) {
            Logger.log('[doPost] body has only meta keys (hasPostData/paramKeys), no LINE events');
            try {
              if (SpreadsheetService.getSpreadsheet()) {
                SpreadsheetService.saveToUidlog('', '', 'LSTEP_BODY_META_ONLY: POST本文がLINEイベントではなくメタ情報のみ。L-stepのWebhook転送設定を確認');
              }
            } catch (_) { /* ignore */ }
            // このbodyからはUIDを抽出できないため、handleLStepWebhookは呼ばない（呼んでも失敗する）
          } else {
            // events の取得（L-stepが body / data 等でラップしている場合に対応）
            const events = body.events || body.body?.events || body.data?.events || body.payload?.events || [];
            const firstEvent = Array.isArray(events) && events.length > 0 ? events[0] : null;
            const hasLineEvent = firstEvent?.source && (firstEvent.source.userId || firstEvent.source.user_id);
            if (hasLineEvent) {
              Logger.log('[doPost] LINE形式のWebhookを検出（events[].source）、L-step転送として処理');
              return handleLStepWebhook(e);
            }
            if (body.destination && events.length > 0) {
              Logger.log('[doPost] LINE Webhook形式を検出（destination+events）、L-step転送として処理');
              return handleLStepWebhook(e);
            }
            // TimeRexでなく、JSONで何かしらある場合はL-stepとして試行（extractUidFromPayloadで再帰検索）
            if (typeof body === 'object' && keys.length > 0) {
              Logger.log('[doPost] TimeRex以外のJSON形式を検出、L-stepとして試行');
              return handleLStepWebhook(e);
            }
          }
        }
      } catch (_) { /* ignore */ }
    }
    
    // uidlogに記録（デバッグ用）
    // 注意: Webhook実行時は権限エラーが発生する可能性があるため、エラーは無視
    try {
      if (SpreadsheetService.getSpreadsheet()) {
        let topKeys = '-';
        try {
          const parsed = rawBodyStr && rawBodyStr !== '(no postData)' ? JSON.parse(e.postData.contents) : {};
          topKeys = typeof parsed === 'object' ? Object.keys(parsed).join(',') : '-';
        } catch (_) { topKeys = '(parse error)'; }
        SpreadsheetService.saveToUidlog('', '', `WEBHOOK_RECEIVED: v${LOG_VER} paramKeys=[${paramKeys.join(',')}] topKeys=[${topKeys}]`);
      }
    } catch (logError) {
      // ログ記録の失敗は無視（権限エラーの可能性があるため）
      Logger.log(`[doPost] Failed to log to sheet: ${logError.toString()}`);
    }
    
    // セキュリティトークンの検証（オプション）
    // 注意: TimeRexのWebhook設定画面では、セキュリティトークンを生成・確認する機能が存在しない可能性があります。
    // 設定されている場合のみ検証を行います。
    const securityToken = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_WEBHOOK_TOKEN);
    
    Logger.log(`[doPost] Security token configured: ${securityToken ? 'YES' : 'NO'}`);
    
    if (securityToken) {
      // ヘッダーからトークンを取得
      // 注意: TimeRexのドキュメントによると、ヘッダー名は小文字に変換される可能性がある
      let receivedToken = null;
      
      // 1. postData.headersから取得（GASでは通常ここに含まれる）
      if (e.postData && e.postData.headers) {
        Logger.log(`[doPost] Headers available: ${JSON.stringify(Object.keys(e.postData.headers))}`);
        // すべてのヘッダー名を小文字で検索（TimeRexは小文字で送信する可能性がある）
        const headerKeys = Object.keys(e.postData.headers);
        for (const key of headerKeys) {
          if (key.toLowerCase() === 'x-timerex-authorization') {
            receivedToken = e.postData.headers[key];
            Logger.log(`[doPost] Found token in header: ${key}`);
            break;
          }
        }
      }
      
      // 2. parameterから取得（URLパラメータ経由、通常は使用されない）
      if (!receivedToken && e.parameter) {
        Logger.log(`[doPost] Checking parameters for token...`);
        receivedToken = e.parameter['x-timerex-authorization'] || 
                       e.parameter['X-Timerex-Authorization'] ||
                       e.parameter['X-TIMEREX-AUTHORIZATION'];
      }
      
      Logger.log(`[doPost] Received token: ${receivedToken ? 'present (' + receivedToken.length + ' chars)' : 'missing'}`);
      
      // 注意: GASのdoPostではHTTPヘッダーを直接取得できないため、
      // TimeRexがヘッダーで送信しているセキュリティトークンは読み取れません。
      // そのため、セキュリティトークンの検証を一時的に無効化しています。
      // 本番環境では、TimeRexのWebhook設定でセキュリティトークンをペイロードに含めるか、
      // または別の方法で検証する必要があります。
      // 
      // 一時的な対応: セキュリティトークンが設定されているが取得できない場合、
      // 警告ログを出力して処理を続行します。
      if (!receivedToken) {
        Logger.log(`[doPost] ⚠️ WARNING: Security token is configured but could not be retrieved from request`);
        Logger.log(`[doPost] ⚠️ This is likely because GAS cannot access HTTP headers directly`);
        Logger.log(`[doPost] ⚠️ Proceeding with webhook processing (security validation skipped for debugging)`);
        Logger.log(`[doPost] ⚠️ Expected token (first 20 chars): ${securityToken.substring(0, 20)}...`);
        Logger.log(`[doPost] ⚠️ Headers: ${e.postData && e.postData.headers ? JSON.stringify(e.postData.headers) : 'no headers'}`);
        Logger.log(`[doPost] ⚠️ Parameters: ${JSON.stringify(e.parameter || {})}`);
        Logger.log(`[doPost] ⚠️ postData keys: ${e.postData ? JSON.stringify(Object.keys(e.postData)) : 'no postData'}`);
        // セキュリティトークンが取得できない場合でも処理を続行（デバッグ用）
        // 本番環境では、この部分を有効化して適切な検証を行う必要があります
      } else if (receivedToken !== securityToken) {
        Logger.log(`[doPost] ===== SECURITY TOKEN VALIDATION FAILED =====`);
        Logger.log(`[doPost] Expected token length: ${securityToken.length}`);
        Logger.log(`[doPost] Expected token (first 20 chars): ${securityToken.substring(0, 20)}...`);
        Logger.log(`[doPost] Received token: ${receivedToken.length + ' chars, first 20: ' + receivedToken.substring(0, 20) + '...'}`);
        Logger.log(`[doPost] Headers: ${e.postData && e.postData.headers ? JSON.stringify(e.postData.headers) : 'no headers'}`);
        Logger.log(`[doPost] Parameters: ${JSON.stringify(e.parameter || {})}`);
        
        Utils.logError('doPost', 'Invalid security token', { 
          receivedToken: 'present',
          expectedLength: securityToken.length,
          receivedLength: receivedToken.length,
          headers: e.postData && e.postData.headers ? Object.keys(e.postData.headers) : 'no headers'
        });
        
        Logger.log(`[doPost] ⚠️ WARNING: Rejecting request due to invalid security token`);
        return ContentService.createTextOutput(JSON.stringify({
          error: Config.ERROR_MESSAGES.UNAUTHORIZED,
          message: 'Security token validation failed'
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        Logger.log(`[doPost] ✅ Security token validation passed`);
      }
    } else {
      // セキュリティトークンが設定されていない場合の警告ログ（本番環境では注意）
      Logger.log(`[doPost] ⚠️ WARNING: Webhook received without security token validation (token not configured)`);
      Logger.log(`[doPost] ⚠️ This is acceptable for testing, but should be configured for production`);
    }

    // ペイロードの取得
    let payload;
    if (e.postData && e.postData.contents) {
      Logger.log(`[doPost] Payload received (length: ${e.postData.contents.length} chars)`);
      Logger.log(`[doPost] Payload preview: ${e.postData.contents.substring(0, 500)}...`);
      payload = Utils.safeJsonParse(e.postData.contents);
      if (payload) {
        Logger.log(`[doPost] Payload parsed successfully`);
        Logger.log(`[doPost] Payload keys: ${JSON.stringify(Object.keys(payload))}`);
      } else {
        Logger.log(`[doPost] ERROR: Payload parsing returned null`);
      }
    } else {
      Logger.log(`[doPost] ERROR: No postData.contents`);
      Logger.log(`[doPost] postData exists: ${!!e.postData}`);
      if (e.postData) {
        Logger.log(`[doPost] postData keys: ${JSON.stringify(Object.keys(e.postData))}`);
      }
      throw new Error('No payload received');
    }

    if (!payload) {
      Logger.log(`[doPost] ERROR: Invalid payload (null or undefined)`);
      throw new Error(Config.ERROR_MESSAGES.INVALID_PAYLOAD);
    }

    // イベントタイプによる分岐
    let result;
    try {
      if (payload.webhook_type === 'event_confirmed') {
        Logger.log('[doPost] Processing event_confirmed');
        result = WebhookHandler.handleEventConfirmed(payload);
        Logger.log(`[doPost] event_confirmed processed: success=${result.success}, rowIndex=${result.rowIndex || 'N/A'}`);
      } else if (payload.webhook_type === 'event_cancelled') {
        Logger.log('[doPost] Processing event_cancelled');
        result = WebhookHandler.handleEventCancelled(payload);
        Logger.log(`[doPost] event_cancelled processed: success=${result.success}, updated=${result.updated || false}`);
      } else {
        Logger.log(`[doPost] ERROR: Unknown webhook_type: ${payload.webhook_type}`);
        throw new Error(`Unknown webhook_type: ${payload.webhook_type}`);
      }

      // 成功レスポンス（200を返すこと）
      // 注意: Webhookは必ず200を返す必要がある（TimeRexがリトライするため）
      Logger.log('[doPost] Returning success response');
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        ...result
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (handlerError) {
      // Webhook処理でエラーが発生した場合でも、200を返す（TimeRexがリトライしないように）
      // ただし、エラーログは記録する
      Utils.logError('doPost handler', handlerError, { 
        webhook_type: payload.webhook_type,
        event_id: payload.event?.id || 'unknown'
      });
      
      // エラーでも200を返す（TimeRexがリトライしないように）
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        error: handlerError.toString(),
        message: 'Webhook processing failed, but request acknowledged'
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    Logger.log(`[doPost] ===== TOP-LEVEL ERROR =====`);
    Logger.log(`[doPost] Error: ${error.toString()}`);
    Logger.log(`[doPost] Error stack: ${error.stack || 'No stack trace'}`);
    Logger.log(`[doPost] postData: ${e.postData ? 'present' : 'missing'}`);
    Logger.log(`[doPost] parameters: ${JSON.stringify(Object.keys(e.parameter || {}))}`);
    
    Utils.logError('doPost', error, { 
      postData: e.postData ? 'present' : 'missing',
      parameters: Object.keys(e.parameter || {})
    });
    
    // エラーでも200を返す（TimeRexがリトライしないように）
    // ただし、エラーログは記録する
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      error: error.toString(),
      message: 'Webhook processing failed, but request acknowledged'
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * TimeRexベースURLを取得
 * @param {Object|null} interviewer - 面談官オブジェクト（nullの場合は統合カレンダー）
 * @return {string|null} TimeRexカレンダーURL（エラーの場合はnull）
 */
function getTimeRexBaseUrl(interviewer = null) {
  const config = getTimeRexCalendarConfig(interviewer);
  return config ? config.calendarUrl : null;
}

/**
 * 取得しているTimeRexカレンダー情報を返す（管理画面表示・テスト用）
 * @param {Object|null} [interviewer] - 面談官オブジェクト（省略時は統合カレンダー）
 * @return {Object|null} { teamUrlPath, calendarUrlPath, calendarUrl } または null
 */
function getTimeRexCalendarConfig(interviewer) {
  try {
    const teamUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH);
    if (!teamUrlPath) return null;

    if (interviewer && interviewer.timerexConfigId) {
      return {
        teamUrlPath: teamUrlPath,
        calendarUrlPath: interviewer.timerexConfigId,
        calendarUrl: `https://timerex.net/s/${teamUrlPath}/${interviewer.timerexConfigId}`,
        label: '個別カレンダー'
      };
    }
    let calendarUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_CALENDAR_URL_PATH);
    if (!calendarUrlPath) {
      calendarUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_CALENDAR_URL_PATH);
    }
    if (!calendarUrlPath) return null;
    return {
      teamUrlPath: teamUrlPath,
      calendarUrlPath: calendarUrlPath,
      calendarUrl: `https://timerex.net/s/${teamUrlPath}/${calendarUrlPath}`,
      label: '統合カレンダー'
    };
  } catch (e) {
    Utils.logError('getTimeRexCalendarConfig', e);
    return null;
  }
}

/**
 * 管理画面用データ取得API（google.script.run用）
 * @param {string} interviewerId - 面談官ID（オプション）
 * @param {string} startDateStr - 開始日（ISO文字列、オプション）
 * @param {string} endDateStr - 終了日（ISO文字列、オプション）
 * @return {Object} 管理画面用データ
 */
function getAdminData(interviewerId = null, startDateStr = null, endDateStr = null) {
  try {
    Logger.log(`[getAdminData] called with interviewerId=${interviewerId}, startDateStr=${startDateStr || 'null'}, endDateStr=${endDateStr || 'null'}`);
    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;
    
    let result;
    try {
      result = AdminApiService.getAdminData(interviewerId, startDate, endDate);
    } catch (innerError) {
      Utils.logError('getAdminData inner', innerError, { interviewerId });
      return {
        success: false,
        error: `AdminApiService error: ${innerError.toString()}`
      };
    }
    
    // 必ずオブジェクトを返す（nullやundefinedを防ぐ）
    if (!result) {
      Utils.logError('getAdminData', new Error('AdminApiService.getAdminData returned null or undefined'), { interviewerId });
      return {
        success: false,
        error: 'Unknown error: AdminApiService.getAdminData returned null or undefined'
      };
    }
    
    Logger.log(`[getAdminData] success: events=${result.events ? result.events.length : 0}, interviews=${result.interviews ? result.interviews.length : 0}`);
    
    result.timerexCalendar = getTimeRexCalendarConfig(null);
    return result;
  } catch (e) {
    Utils.logError('getAdminData', e, { interviewerId, startDateStr, endDateStr });
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * 面談官の優先順位を更新（google.script.run用）
 * @param {string} interviewerId - 面談官ID
 * @param {number} priority - 優先順位（低い数値ほど優先度が高い）
 * @return {Object} 更新結果
 */
function updateInterviewerPriority(interviewerId, priority) {
  try {
    return AdminApiService.updateInterviewerPriority(interviewerId, priority);
  } catch (e) {
    Utils.logError('updateInterviewerPriority', e, { interviewerId, priority });
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * 複数の面談官の優先順位を一括更新（google.script.run用）
 * @param {Array} updates - 更新データの配列 [{ interviewerId: string, priority: number }, ...]
 * @return {Object} 更新結果
 */
function updateInterviewerPriorities(updates) {
  try {
    return AdminApiService.updateInterviewerPriorities(updates);
  } catch (e) {
    Utils.logError('updateInterviewerPriorities', e, { updates });
    return {
      success: false,
      error: e.toString()
    };
  }
}


/**
 * 時間ブロック作成API（google.script.run用）
 * @param {string} interviewerId - 面談官ID
 * @param {string} startTimeStr - 開始時刻（ISO文字列）
 * @param {string} endTimeStr - 終了時刻（ISO文字列）
 * @return {Object} 作成結果
 */
function createBlockEvent(interviewerId, startTimeStr, endTimeStr) {
  try {
    const interviewer = SpreadsheetService.getInterviewerById(interviewerId);
    if (!interviewer || !interviewer.googleCalendarId) {
      return {
        success: false,
        error: 'Interviewer or calendar not found'
      };
    }

    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);

    const event = CalendarService.createBlockEvent(
      interviewer.googleCalendarId,
      startTime,
      endTime
    );

    return {
      success: true,
      event: event
    };
  } catch (e) {
    Utils.logError('createBlockEvent', e, { interviewerId, startTimeStr, endTimeStr });
    return {
      success: false,
      error: e.toString()
    };
  }
}

/**
 * TimeRex API: イベント情報取得（google.script.run用）
 * @param {string} eventId - イベントID
 * @return {Object} イベントデータまたはエラー
 */
function getTimeRexEvent(eventId) {
  try {
    // 入力検証
    if (!eventId || typeof eventId !== 'string') {
      return {
        success: false,
        error: 'eventId is required and must be a string'
      };
    }

    if (!Utils.isValidEventId(eventId)) {
      return {
        success: false,
        error: 'Invalid eventId format'
      };
    }

    const eventData = TimeRexApiService.getEvent(eventId);
    return {
      success: true,
      event: eventData
    };
  } catch (e) {
    Utils.logError('getTimeRexEvent', e, { eventId });
    return {
      success: false,
      error: e.message || e.toString()
    };
  }
}

/**
 * TimeRex API: カレンダーイベント一覧取得（google.script.run用）
 * @param {string} calendarId - カレンダーID（calendar_url_path）
 * @param {string} startDateStr - 開始日（ISO文字列、オプション）
 * @param {string} endDateStr - 終了日（ISO文字列、オプション）
 * @return {Object} イベント一覧データまたはエラー
 */
function getTimeRexCalendarEvents(calendarId, startDateStr = null, endDateStr = null) {
  try {
    // 入力検証
    if (!calendarId || typeof calendarId !== 'string') {
      return {
        success: false,
        error: 'calendarId is required and must be a string'
      };
    }

    const options = {};
    if (startDateStr) {
      options.startDate = new Date(startDateStr);
    }
    if (endDateStr) {
      options.endDate = new Date(endDateStr);
    }

    const events = TimeRexApiService.getCalendarEvents(calendarId, options);
    return {
      success: true,
      events: events
    };
  } catch (e) {
    Utils.logError('getTimeRexCalendarEvents', e, { calendarId, startDateStr, endDateStr });
    return {
      success: false,
      error: e.message || e.toString()
    };
  }
}

/**
 * TimeRex API: イベントキャンセル（google.script.run用）
 * @param {string} eventId - イベントID
 * @param {string} reason - キャンセル理由（オプション）
 * @return {Object} キャンセル結果
 */
function cancelTimeRexEvent(eventId, reason = '') {
  try {
    // 入力検証
    if (!eventId || typeof eventId !== 'string') {
      return {
        success: false,
        error: 'eventId is required and must be a string'
      };
    }

    if (!Utils.isValidEventId(eventId)) {
      return {
        success: false,
        error: 'Invalid eventId format'
      };
    }

    // 注意: キャンセル期限のチェックはTimeRex側で設定可能なため、コード側でのチェックは不要
    // TimeRex管理画面の「予定のキャンセル・リスケジュール期限設定」で期限を設定してください

    const options = {};
    if (reason && typeof reason === 'string' && reason.trim().length > 0) {
      options.reason = reason.trim();
      // 長さ制限
      if (options.reason.length > 500) {
        options.reason = options.reason.substring(0, 500);
      }
    }

    const result = TimeRexApiService.cancelEvent(eventId, options);
    
    // スプレッドシートのステータスも更新（該当するレコードがある場合）
    try {
      SpreadsheetService.updateInterviewStatus(eventId, Config.EVENT_STATUS.CANCELLED);
    } catch (e) {
      Utils.logError('cancelTimeRexEvent', 'Failed to update spreadsheet status', { eventId, error: e });
      // スプレッドシート更新失敗は警告のみ（APIキャンセルは成功しているため）
    }

    return {
      success: true,
      result: result
    };
  } catch (e) {
    Utils.logError('cancelTimeRexEvent', e, { eventId, reason });
    return {
      success: false,
      error: e.message || e.toString()
    };
  }
}

/**
 * TimeRex API: 複数イベント一括キャンセル（google.script.run用）
 * @param {string[]} eventIds - イベントIDの配列
 * @param {string} reason - キャンセル理由（オプション）
 * @return {Object} 一括キャンセル結果
 */
function cancelTimeRexEventsBatch(eventIds, reason = '') {
  try {
    // 入力検証
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return {
        success: false,
        error: 'eventIds is required and must be a non-empty array'
      };
    }

    // 配列サイズ制限（一度に大量キャンセルを防ぐ）
    if (eventIds.length > 50) {
      return {
        success: false,
        error: 'Too many eventIds. Maximum 50 events at a time.'
      };
    }

    // 各イベントIDを検証
    const invalidIds = eventIds.filter(id => !Utils.isValidEventId(id));
    if (invalidIds.length > 0) {
      return {
        success: false,
        error: `Invalid eventId format: ${invalidIds.join(', ')}`
      };
    }

    // 注意: キャンセル期限のチェックはTimeRex側で設定可能なため、コード側でのチェックは不要
    // TimeRex管理画面の「予定のキャンセル・リスケジュール期限設定」で期限を設定してください

    const options = {};
    if (reason && typeof reason === 'string' && reason.trim().length > 0) {
      options.reason = reason.trim().substring(0, 500);
    }

    const results = TimeRexApiService.cancelEventsBatch(eventIds, options);

    // 成功したイベントのステータスをスプレッドシートで更新
    if (results.success > 0) {
      try {
        eventIds.forEach(eventId => {
          try {
            SpreadsheetService.updateInterviewStatus(eventId, Config.EVENT_STATUS.CANCELLED);
          } catch (e) {
            // 個別の更新失敗はログのみ
            Utils.logError('cancelTimeRexEventsBatch', 'Failed to update spreadsheet status', { eventId, error: e });
          }
        });
      } catch (e) {
        Utils.logError('cancelTimeRexEventsBatch', 'Failed to update spreadsheet statuses', { error: e });
      }
    }

    return {
      success: true,
      results: results
    };
  } catch (e) {
    Utils.logError('cancelTimeRexEventsBatch', e, { eventIds, reason });
    return {
      success: false,
      error: e.message || e.toString()
    };
  }
}

/**
 * 手動予約登録API（google.script.run用）
 * @param {Object} bookingData - 予約データ
 * @param {string} bookingData.interviewerId - 面談官ID
 * @param {string} bookingData.guestName - 候補者名
 * @param {string} bookingData.guestEmail - 候補者メールアドレス
 * @param {string} bookingData.startTime - 開始日時（ISO文字列またはdatetime-local形式）
 * @param {string} bookingData.endTime - 終了日時（ISO文字列またはdatetime-local形式）
 * @param {string} bookingData.description - 備考（オプション）
 * @return {Object} 登録結果
 */
function registerManualBooking(bookingData) {
  try {
    // 入力検証
    if (!bookingData || typeof bookingData !== 'object') {
      return {
        success: false,
        error: 'bookingData is required and must be an object'
      };
    }

    if (!bookingData.interviewerId) {
      return {
        success: false,
        error: 'interviewerId is required'
      };
    }

    if (!bookingData.guestName || !bookingData.guestEmail) {
      return {
        success: false,
        error: 'guestName and guestEmail are required'
      };
    }

    if (!bookingData.startTime || !bookingData.endTime) {
      return {
        success: false,
        error: 'startTime and endTime are required'
      };
    }

    // 多重予約ブロック: 同じメールアドレスで既に有効な予約がある場合はエラー
    const existingInterview = SpreadsheetService.findActiveInterviewByGuestEmail(bookingData.guestEmail);
    if (existingInterview) {
      return {
        success: false,
        error: 'DUPLICATE_BOOKING',
        message: `このメールアドレス（${bookingData.guestEmail}）では既に予約が存在します。新しい予約をするには、まず既存の予約をキャンセルしてください。`
      };
    }

    // 面談官情報を取得
    const interviewer = SpreadsheetService.getInterviewerById(bookingData.interviewerId);
    if (!interviewer || !interviewer.googleCalendarId) {
      return {
        success: false,
        error: 'Interviewer not found or calendar ID not set'
      };
    }

    // 日時をDateオブジェクトに変換
    // datetime-local形式（YYYY-MM-DDTHH:mm）またはISO文字列に対応
    let startTime, endTime;
    try {
      startTime = new Date(bookingData.startTime);
      endTime = new Date(bookingData.endTime);
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return {
          success: false,
          error: 'Invalid date format for startTime or endTime'
        };
      }
    } catch (e) {
      return {
        success: false,
        error: `Date parsing error: ${e.toString()}`
      };
    }

    // Google Calendarにイベントを作成
    const eventData = {
      title: `面談：${bookingData.guestName}様`,
      startTime: startTime,
      endTime: endTime,
      description: bookingData.description || '',
      guestEmail: bookingData.guestEmail,
      guestName: bookingData.guestName,
      guests: [bookingData.guestEmail] // 候補者をゲストとして追加
    };

    const calendarEvent = CalendarService.createInterviewEvent({
      calendarId: interviewer.googleCalendarId,
      ...eventData
    });

    if (!calendarEvent || !calendarEvent.id) {
      return {
        success: false,
        error: 'Failed to create calendar event'
      };
    }

    // Google Meet URLを取得（イベントに会議を追加）
    let meetUrl = '';
    try {
      const calendar = CalendarService.getCalendar(interviewer.googleCalendarId);
      const event = calendar.getEventById(calendarEvent.id);
      // Google Meet会議を追加
      event.addConference(CalendarApp.ConferenceType.HANGOUTS_MEET);
      const conferenceData = event.getConferenceData();
      if (conferenceData) {
        const entryPoints = conferenceData.getEntryPoints();
        if (entryPoints && entryPoints.length > 0) {
          meetUrl = entryPoints[0].getUri();
        }
      }
    } catch (e) {
      Logger.log(`[registerManualBooking] Warning: Could not add Google Meet: ${e.toString()}`);
      // Meet URLの取得に失敗してもエラーにはしない
    }

    // interviewsシートに記録
    const interviewData = {
      createdAt: new Date(),
      startAt: startTime,
      endAt: endTime,
      guestName: bookingData.guestName,
      guestEmail: bookingData.guestEmail,
      meetUrl: meetUrl,
      lineUid: '',
      source: Config.SOURCE.MANUAL,
      eventId: '', // 手動登録のためTimeRexイベントIDは空
      teamUrlPath: '',
      calendarUrlPath: '',
      status: Config.EVENT_STATUS.CONFIRMED,
      interviewerId: bookingData.interviewerId
    };

    const rowIndex = SpreadsheetService.appendInterview(interviewData);

    Logger.log(`[registerManualBooking] Successfully registered manual booking: ${bookingData.guestName} (row: ${rowIndex})`);

    // Slack通知を送信
    try {
      SlackService.notifyBookingCreated({
        candidateName: bookingData.guestName || '未設定',
        dateTime: startTime.toISOString(),
        interviewerName: interviewer.name || '未設定',
        interviewerEmail: interviewer.googleCalendarId || '',
        interviewerSlackMemberId: interviewer.slackMemberId || '',
        adminPageUrl: Utils.getAdminPageUrl(bookingData.interviewerId || '')
      });
    } catch (slackError) {
      Logger.log(`[registerManualBooking] Slack通知エラー（無視）: ${slackError.toString()}`);
      // Slack通知の失敗は予約処理を止めない
    }

    return {
      success: true,
      eventId: calendarEvent.id,
      meetUrl: calendarEvent.meetUrl || '',
      rowIndex: rowIndex
    };
  } catch (e) {
    Utils.logError('registerManualBooking', e, { bookingData });
    return {
      success: false,
      error: e.toString()
    };
  }
}


/**
 * HTMLファイルからスクリプトやスタイルをインクルード
 * @param {string} filename - インクルードするファイル名
 * @return {string} ファイル内容
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

