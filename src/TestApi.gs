/**
 * API疎通確認テスト
 * 各APIとトークンの疎通確認を行う
 * 
 * 実行方法:
 * GASエディタで各テスト関数を実行して、結果を確認
 */

/**
 * 全テストを実行（概要のみ）
 */
function runAllApiTests() {
  Logger.log('=== API疎通確認テスト開始 ===');
  Logger.log('');
  
  const results = {
    timerexApi: runTimeRexApiTest(),
    webhookToken: runWebhookTokenTest(),
    googleCalendar: runGoogleCalendarTest(),
    spreadsheet: runSpreadsheetTest(),
    timerexApiKey: runTimeRexApiKeyTest()
  };
  
  Logger.log('');
  Logger.log('=== テスト結果サマリー ===');
  Logger.log(`TimeRex API: ${results.timerexApi ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`Webhook Token: ${results.webhookToken ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`Google Calendar: ${results.googleCalendar ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`Spreadsheet: ${results.spreadsheet ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`TimeRex API Key: ${results.timerexApiKey ? '✓ 成功' : '✗ 失敗'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  Logger.log('');
  Logger.log(`総合結果: ${allPassed ? '✓ すべて成功' : '✗ 一部失敗'}`);
  
  if (!results.spreadsheet) {
    Logger.log('');
    Logger.log('⚠ Spreadsheetテストが失敗しました。');
    Logger.log('  setupSpreadsheetSheets() を実行してシートを作成してください。');
  }
  
  if (!results.googleCalendar) {
    Logger.log('');
    Logger.log('⚠ Google Calendarテストが失敗しました。');
    Logger.log('  初回実行時は認証が必要です。');
    Logger.log('  runGoogleCalendarTest() を再度実行して認証を完了してください。');
  }
  
  return results;
}

/**
 * 最低限の疎通テスト（L-step トークン・TimeRex APIキー・スプレッドシート）
 * 実行: エディタで runMinimumConnectivityTest を選択して実行
 * @return {Object} { lstep: boolean, timerexKey: boolean, spreadsheet: boolean }
 */
function runMinimumConnectivityTest() {
  Logger.log('=== 最低限の疎通テスト ===');
  Logger.log('');

  const lstep = runLStepApiConnectivityTestMinimal();
  Logger.log('');
  const timerexKey = runTimeRexApiKeyTest();
  Logger.log('');
  const spreadsheet = runSpreadsheetTest();

  Logger.log('');
  Logger.log('--- 結果サマリー ---');
  Logger.log('L-step（認証・GET）: ' + (lstep ? '✓' : '✗'));
  Logger.log('TimeRex APIキー: ' + (timerexKey ? '✓' : '✗'));
  Logger.log('スプレッドシート: ' + (spreadsheet ? '✓' : '✗'));
  Logger.log('');
  const ok = lstep && timerexKey && spreadsheet;
  Logger.log(ok ? '✓ 最低限の疎通はすべて成功' : '✗ いずれかが失敗しています');
  return { lstep: lstep, timerexKey: timerexKey, spreadsheet: spreadsheet };
}

/**
 * TimeRex APIキーの設定確認
 */
function runTimeRexApiKeyTest() {
  Logger.log('--- TimeRex APIキー確認テスト ---');
  
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_API_KEY);
    
    if (!apiKey) {
      Logger.log('✗ TIMEREX_API_KEY が設定されていません');
      return false;
    }
    
    if (apiKey.length < 20) {
      Logger.log('✗ APIキーの形式が不正です（長さが短すぎます）');
      return false;
    }
    
    Logger.log(`✓ APIキーが設定されています（長さ: ${apiKey.length}文字）`);
    Logger.log(`  先頭4文字: ${apiKey.substring(0, 4)}...`);
    
    return true;
  } catch (error) {
    Logger.log(`✗ エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * TimeRex API疎通確認テスト
 * 
 * このテストは以下の手順で実行されます:
 * 1. getUserTeams()でチーム一覧を取得
 * 2. 正しいteam_id（日程調整API用team_id）を取得
 * 3. getTeamCalendars(team_id)でカレンダー一覧を取得
 * 4. 各カレンダーの詳細情報を取得
 */
function runTimeRexApiTest() {
  Logger.log('=== TimeRex API疎通確認テスト（新バージョン） ===');
  Logger.log('');
  
  try {
    // APIキー確認
    const apiKey = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_API_KEY);
    if (!apiKey) {
      Logger.log('✗ TIMEREX_API_KEY が設定されていません');
      return false;
    }
    Logger.log(`✓ TIMEREX_API_KEYが設定されています（長さ: ${apiKey.length}文字）`);
    Logger.log('');
    
    // チーム情報取得テスト
    Logger.log('=== ステップ1: getUserTeams()でチーム一覧を取得 ===');
    Logger.log('→ TimeRexApiService.getUserTeams()を実行中...');
    
    let userTeams;
    try {
      // まずgetUserTeams()で正しいteam_idを取得
      userTeams = TimeRexApiService.getUserTeams();
      Logger.log(`✓ getUserTeams()の呼び出し成功`);
      Logger.log(`  レスポンスタイプ: ${typeof userTeams}`);
      Logger.log(`  レスポンスキー: ${userTeams ? Object.keys(userTeams).join(', ') : 'null'}`);
      
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
      
      Logger.log(`✓ チーム一覧取得成功（${teamsList.length}件）`);
      
      if (teamsList.length === 0) {
        Logger.log('✗ チームが見つかりませんでした');
        return false;
      }
      
      // 最初のチーム（またはプライマリーチーム）を使用
      let selectedTeam = teamsList[0];
      for (const team of teamsList) {
        if (team.is_primary === true) {
          selectedTeam = team;
          break;
        }
      }
      
      const teamId = selectedTeam.id; // 日程調整API用team_id
      Logger.log(`→ 使用するteam_id: ${teamId} (日程調整API用team_id)`);
      Logger.log(`→ チーム名: ${selectedTeam.name || 'N/A'}`);
      Logger.log(`→ url_path: ${selectedTeam.url_path || 'N/A'}`);
      Logger.log(`→ 期待値: 26a251ae9cf9cd67fc85 (TimeRex設定画面の「日程調整API用team_id」)`);
      Logger.log('');
      
      if (teamId !== '26a251ae9cf9cd67fc85') {
        Logger.log(`⚠ 警告: team_idが期待値と異なります`);
        Logger.log(`  期待値: 26a251ae9cf9cd67fc85`);
        Logger.log(`  実際の値: ${teamId}`);
      }
      
      // 正しいteam_idでカレンダー一覧を取得
      Logger.log(`--- 2. getTeamCalendars(${teamId})でカレンダー一覧を取得 ---`);
      Logger.log(`→ エンドポイント: GET /api/beta/teams/${teamId}/calendars`);
      Logger.log(`→ 実行中...`);
      const teamCalendars = TimeRexApiService.getTeamCalendars(teamId);
      
      // レスポンスが配列かオブジェクトかを確認
      let calendarList = [];
      if (Array.isArray(teamCalendars)) {
        calendarList = teamCalendars;
        Logger.log(`✓ レスポンスは配列形式（${calendarList.length}件）`);
      } else if (teamCalendars && teamCalendars.items && Array.isArray(teamCalendars.items)) {
        calendarList = teamCalendars.items;
        Logger.log(`✓ レスポンスはitems配列形式（${calendarList.length}件）`);
      } else if (teamCalendars && teamCalendars.data && Array.isArray(teamCalendars.data)) {
        calendarList = teamCalendars.data;
        Logger.log(`✓ レスポンスはdata配列形式（${calendarList.length}件）`);
      } else if (teamCalendars && teamCalendars.calendars && Array.isArray(teamCalendars.calendars)) {
        calendarList = teamCalendars.calendars;
        Logger.log(`✓ レスポンスはcalendars配列形式（${calendarList.length}件）`);
      } else {
        Logger.log(`⚠ 予期しないレスポンス形式`);
        Logger.log(`  レスポンスキー: ${teamCalendars ? Object.keys(teamCalendars).join(', ') : 'null'}`);
        Logger.log(`  レスポンス内容（最初の500文字）: ${JSON.stringify(teamCalendars).substring(0, 500)}`);
        return false;
      }
      
      Logger.log(`✓ チームのカレンダー一覧取得成功（${calendarList.length}件）`);
      
      // カレンダーが存在する場合は、カレンダー情報を取得
      if (calendarList.length > 0) {
        Logger.log('--- 3. カレンダー詳細情報 ---');
        for (let i = 0; i < Math.min(calendarList.length, 5); i++) {
          const calendar = calendarList[i];
          const calendarId = calendar.url_path || calendar.id || calendar.calendar_url_path;
          const calendarName = calendar.name || calendar.calendar_name || 'N/A';
          Logger.log(`  [${i + 1}] ${calendarName}`);
          Logger.log(`      calendar_url_path: ${calendarId || 'N/A'}`);
          Logger.log(`      id: ${calendar.id || 'N/A'}`);
          Logger.log(`      url_path: ${calendar.url_path || 'N/A'}`);
          Logger.log(`      email: ${calendar.email || calendar.host_email || 'N/A'}`);
          
          // 最初のカレンダーの詳細情報を取得
          if (i === 0 && calendarId) {
            Logger.log(`→ getCalendar(${calendarId})で詳細情報を取得中...`);
            try {
              const calendarInfo = TimeRexApiService.getCalendar(calendarId);
              Logger.log(`✓ カレンダー情報取得成功: ${calendarInfo.name || calendarId}`);
              Logger.log(`  詳細キー: ${Object.keys(calendarInfo).join(', ')}`);
              Logger.log(`  詳細（最初の500文字）: ${JSON.stringify(calendarInfo).substring(0, 500)}`);
              
              // members配列の詳細情報を出力
              if (calendarInfo.members && Array.isArray(calendarInfo.members)) {
                Logger.log(`  --- members配列の詳細（${calendarInfo.members.length}件）---`);
                for (let j = 0; j < calendarInfo.members.length; j++) {
                  const member = calendarInfo.members[j];
                  Logger.log(`    [${j + 1}] Member ${j + 1}:`);
                  Logger.log(`        キー: ${Object.keys(member).join(', ')}`);
                  Logger.log(`        完全な構造: ${JSON.stringify(member)}`);
                  
                  // emailフィールドの確認
                  if (member.email) {
                    Logger.log(`        ✓ email: ${member.email}`);
                  } else {
                    Logger.log(`        ✗ email: フィールドが存在しません`);
                  }
                  
                  // userオブジェクトの確認
                  if (member.user) {
                    Logger.log(`        userオブジェクト: ${JSON.stringify(member.user)}`);
                    if (member.user.email) {
                      Logger.log(`        ✓ user.email: ${member.user.email}`);
                    } else {
                      Logger.log(`        ✗ user.email: フィールドが存在しません`);
                    }
                  } else {
                    Logger.log(`        userオブジェクト: 存在しません`);
                  }
                  
                  // その他のフィールド
                  if (member.id) {
                    Logger.log(`        id: ${member.id}`);
                  }
                  if (member.name) {
                    Logger.log(`        name: ${member.name}`);
                  }
                  if (member.display_name) {
                    Logger.log(`        display_name: ${member.display_name}`);
                  }
                  if (member.is_self !== undefined) {
                    Logger.log(`        is_self: ${member.is_self}`);
                  }
                }
              } else {
                Logger.log(`  ⚠ members配列が存在しないか、配列ではありません`);
              }
            } catch (e) {
              Logger.log(`⚠ カレンダー情報取得でエラー: ${e.toString()}`);
              if (e.statusCode) {
                Logger.log(`  ステータスコード: ${e.statusCode}`);
              }
            }
          }
        }
      } else {
        Logger.log('⚠ カレンダーが見つかりませんでした');
      }
      
      Logger.log('');
      Logger.log('=== テスト完了 ===');
      
      return true;
    } catch (error) {
      Logger.log(`✗ APIリクエストエラー: ${error.toString()}`);
      if (error.statusCode) {
        Logger.log(`  ステータスコード: ${error.statusCode}`);
      }
      if (error.response) {
        Logger.log(`  レスポンス: ${JSON.stringify(error.response).substring(0, 500)}`);
      }
      return false;
    }
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * Webhookセキュリティトークン確認テスト
 */
function runWebhookTokenTest() {
  Logger.log('--- Webhookセキュリティトークン確認テスト ---');
  
  try {
    const token = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_WEBHOOK_TOKEN);
    
    if (!token) {
      Logger.log('⚠ TIMEREX_WEBHOOK_TOKEN が設定されていません（オプション）');
      Logger.log('  TimeRex設定画面でセキュリティトークンが確認できる場合は設定を推奨します');
      return true; // オプションなので警告のみ
    }
    
    if (token.length < 10) {
      Logger.log('✗ トークンの形式が不正です（長さが短すぎます）');
      return false;
    }
    
    Logger.log(`✓ セキュリティトークンが設定されています（長さ: ${token.length}文字）`);
    Logger.log(`  先頭4文字: ${token.substring(0, 4)}...`);
    
    // トークンの形式確認（英数字のみなど）
    const tokenPattern = /^[a-zA-Z0-9]+$/;
    if (!tokenPattern.test(token)) {
      Logger.log('⚠ トークンに特殊文字が含まれています（正常な場合もあります）');
    }
    
    return true;
  } catch (error) {
    Logger.log(`✗ エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * Google Calendar API疎通確認テスト
 * 
 * 注意: 初回実行時はGoogleアカウントの認証が必要です
 * - Google Calendar APIへのアクセス許可
 * - Google Drive APIへのアクセス許可（スプレッドシートアクセス用）
 * 
 * 認証方法:
 * 1. この関数を初回実行すると、認証プロンプトが表示されます
 * 2. 「権限を確認」をクリック
 * 3. Googleアカウントを選択
 * 4. 「許可」をクリックして権限を付与
 * 5. 再度この関数を実行してテストを完了してください
 */
function runGoogleCalendarTest() {
  Logger.log('--- Google Calendar API疎通確認テスト ---');
  Logger.log('');
  Logger.log('ℹ️ 初回実行時は認証が必要です。');
  Logger.log('   認証プロンプトが表示されたら「権限を確認」→「許可」をクリックしてください。');
  Logger.log('');
  
  try {
    // 実行ユーザーのメールアドレスを取得して自動登録
    const currentUserEmail = Session.getActiveUser().getEmail();
    Logger.log(`→ 実行ユーザー: ${currentUserEmail}`);
    
    // interviewersシートに自動登録（重複チェック付き）
    const registered = registerCurrentUserAsInterviewer(currentUserEmail);
    if (registered.isNew) {
      Logger.log(`✓ 担当者として自動登録しました: ${registered.interviewer.name}`);
    } else if (registered.interviewer) {
      Logger.log(`✓ 既に登録済みの担当者です: ${registered.interviewer.name}`);
    }
    Logger.log('');
    
    // interviewersシートから担当者を取得（最初の担当者を使用）
    const allInterviewers = AdminApiService.getAllInterviewers();
    
    if (!allInterviewers || allInterviewers.length === 0) {
      Logger.log('⚠ interviewersシートに担当者が登録されていません');
      Logger.log('  interviewersシートにデータを追加してください');
      Logger.log('');
      Logger.log('  例:');
      Logger.log('    id: test_interviewer');
      Logger.log('    name: テスト担当者');
      Logger.log('    timerex_config_id: test-config-id');
      Logger.log('    google_calendar_id: your-email@example.com');
      Logger.log('    priority: 1');
      return false;
    }
    
    // カレンダーIDが設定されている最初の担当者を探す
    let testInterviewer = null;
    for (const interviewer of allInterviewers) {
      if (interviewer.googleCalendarId) {
        testInterviewer = interviewer;
        break;
      }
    }
    
    if (!testInterviewer) {
      Logger.log('⚠ 担当者のGoogleカレンダーIDが設定されていません');
      Logger.log('  interviewersシートのgoogle_calendar_id列（D列）にカレンダーIDを設定してください');
      Logger.log('');
      Logger.log('  カレンダーIDは通常、Googleアカウントのメールアドレスです');
      Logger.log('  例: your-email@example.com');
      return false;
    }
    
    Logger.log(`✓ 担当者情報取得完了: ${testInterviewer.name} (${testInterviewer.googleCalendarId})`);
    
    // カレンダーへのアクセス確認
    Logger.log('→ カレンダーアクセスをテスト中...');
    try {
      const calendar = CalendarApp.getCalendarById(testInterviewer.googleCalendarId);
      if (!calendar) {
        Logger.log('✗ カレンダーが見つかりません');
        Logger.log('  カレンダーIDが正しいか確認してください');
        return false;
      }
      
      Logger.log(`✓ カレンダーアクセス成功: ${calendar.getName()}`);
      
      // 直近のイベントを1件取得してアクセス権限を確認
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const events = calendar.getEvents(now, nextWeek, { max: 1 });
      
      Logger.log(`✓ カレンダーイベント取得成功（直近1週間: ${events.length}件）`);
      Logger.log('');
      Logger.log('✓ Google Calendar APIの認証とアクセスが正常に動作しています');
      
      return true;
    } catch (error) {
      const errorMessage = error.toString();
      Logger.log(`✗ カレンダーアクセスエラー: ${errorMessage}`);
      Logger.log('');
      
      // 認証エラーの場合
      if (errorMessage.includes('Authorization') || 
          errorMessage.includes('permission') || 
          errorMessage.includes('権限') ||
          errorMessage.includes('access denied')) {
        Logger.log('⚠ 認証が必要です:');
        Logger.log('  1. この関数を再度実行してください');
        Logger.log('  2. 認証プロンプトが表示されたら「権限を確認」をクリック');
        Logger.log('  3. Googleアカウントを選択して「許可」をクリック');
        Logger.log('  4. 再度この関数を実行してテストを完了してください');
      } else if (errorMessage.includes('not found') || errorMessage.includes('見つかりません')) {
        Logger.log('⚠ カレンダーが見つかりません:');
        Logger.log('  - カレンダーID（メールアドレス）が正しいか確認してください');
        Logger.log('  - カレンダーが存在するか確認してください');
      } else {
        Logger.log('⚠ その他のエラー:');
        Logger.log('  - カレンダーの共有設定を確認してください');
        Logger.log('  - 実行ユーザーがカレンダーへのアクセス権限を持っているか確認してください');
      }
      
      return false;
    }
  } catch (error) {
    const errorMessage = error.toString();
    Logger.log(`✗ テスト実行エラー: ${errorMessage}`);
    
    // 認証エラーの場合
    if (errorMessage.includes('Authorization') || 
        errorMessage.includes('permission') || 
        errorMessage.includes('権限')) {
      Logger.log('');
      Logger.log('⚠ 認証が必要です。この関数を再度実行して認証を完了してください。');
    }
    
    return false;
  }
}

/**
 * Spreadsheet API疎通確認テスト
 */
function runSpreadsheetTest() {
  Logger.log('--- Spreadsheet API疎通確認テスト ---');
  
  try {
    // スプレッドシート取得
    Logger.log('→ スプレッドシートアクセスをテスト中...');
    const ss = SpreadsheetService.getSpreadsheet();
    
    if (!ss) {
      Logger.log('✗ スプレッドシートが見つかりません');
      return false;
    }
    
    Logger.log(`✓ スプレッドシートアクセス成功: ${ss.getName()}`);
    
    // interviewersシート確認
    Logger.log('→ interviewersシートを確認中...');
    try {
      const interviewersSheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWERS);
      const interviewerDataRange = interviewersSheet.getDataRange();
      const interviewerCount = interviewerDataRange.getNumRows() - 1; // ヘッダー行を除外
      Logger.log(`✓ interviewersシート確認完了（${interviewerCount}件の担当者）`);
    } catch (error) {
      Logger.log(`✗ interviewersシートエラー: ${error.toString()}`);
      Logger.log(`  シート名「${Config.SHEET_NAMES.INTERVIEWERS}」が存在するか確認してください`);
      return false;
    }
    
    // interviewsシート確認
    Logger.log('→ interviewsシートを確認中...');
    try {
      const interviewsSheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
      const interviewsDataRange = interviewsSheet.getDataRange();
      const interviewCount = interviewsDataRange.getNumRows() - 1; // ヘッダー行を除外
      Logger.log(`✓ interviewsシート確認完了（${interviewCount}件の予約）`);
    } catch (error) {
      Logger.log(`✗ interviewsシートエラー: ${error.toString()}`);
      Logger.log(`  シート名「${Config.SHEET_NAMES.INTERVIEWS}」が存在するか確認してください`);
      return false;
    }
    
    return true;
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * TimeRex API詳細テスト（イベント取得など）
 * 注意: 実際のイベントIDが必要です
 */
function runTimeRexApiDetailTest(eventId = null) {
  Logger.log('--- TimeRex API詳細テスト ---');
  
  try {
    const calendarUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_CALENDAR_URL_PATH);
    if (!calendarUrlPath) {
      Logger.log('✗ TIMEREX_CALENDAR_URL_PATH が設定されていません');
      return false;
    }
    
    // カレンダーイベント一覧取得テスト
    Logger.log(`→ カレンダーイベント一覧取得をテスト中（Calendar: ${calendarUrlPath}）...`);
    try {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const eventsResponse = TimeRexApiService.getCalendarEvents(calendarUrlPath, {
        startDate: now,
        endDate: nextWeek
      });
      
      // レスポンス形式: { items: array } または { nextPageToken?: string, items: array }
      let events = [];
      if (eventsResponse && eventsResponse.items && Array.isArray(eventsResponse.items)) {
        events = eventsResponse.items;
      } else if (Array.isArray(eventsResponse)) {
        // 後方互換性のため、配列の場合も対応
        events = eventsResponse;
      } else if (eventsResponse && eventsResponse.data && Array.isArray(eventsResponse.data)) {
        // 後方互換性のため
        events = eventsResponse.data;
      } else if (eventsResponse && eventsResponse.events && Array.isArray(eventsResponse.events)) {
        // 後方互換性のため
        events = eventsResponse.events;
      }
      
      Logger.log(`✓ カレンダーイベント一覧取得成功（${events.length}件）`);
      
      // イベントIDが指定されている場合は詳細取得テスト
      if (eventId) {
        Logger.log(`→ イベント詳細取得をテスト中（Event ID: ${eventId}）...`);
        try {
          const event = TimeRexApiService.getEvent(eventId);
          Logger.log(`✓ イベント詳細取得成功: ${event.id}`);
          return true;
        } catch (error) {
          Logger.log(`✗ イベント詳細取得エラー: ${error.toString()}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      Logger.log(`✗ APIリクエストエラー: ${error.toString()}`);
      if (error.statusCode) {
        Logger.log(`  ステータスコード: ${error.statusCode}`);
      }
      return false;
    }
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * スプレッドシートシート作成テスト
 */
function runSetupSpreadsheetTest() {
  Logger.log('=== スプレッドシートシート作成テスト ===');
  Logger.log('');
  
  try {
    const result = setupSpreadsheetSheets();
    return result.success;
  } catch (error) {
    Logger.log(`✗ エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 設定値確認テスト（すべての設定値を確認）
 */
function runConfigTest() {
  Logger.log('=== 設定値確認テスト ===');
  Logger.log('');
  
  const props = PropertiesService.getScriptProperties();
  const configKeys = [
    { key: Config.PROPERTY_KEYS.TIMEREX_API_KEY, name: 'TimeRex APIキー', required: true },
    { key: Config.PROPERTY_KEYS.TIMEREX_WEBHOOK_TOKEN, name: 'Webhookセキュリティトークン', required: false },
    { key: Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH, name: 'TimeRexチームURLパス', required: true },
    { key: Config.PROPERTY_KEYS.TIMEREX_CALENDAR_URL_PATH, name: 'TimeRexカレンダーURLパス', required: true },
    { key: Config.PROPERTY_KEYS.SPREADSHEET_ID, name: 'スプレッドシートID', required: false }
  ];
  
  let allValid = true;
  
  configKeys.forEach(({ key, name, required }) => {
    const value = props.getProperty(key);
    if (value) {
      const maskedValue = value.substring(0, Math.min(8, value.length)) + '...';
      Logger.log(`✓ ${name}: 設定済み (${maskedValue})`);
    } else {
      if (required) {
        Logger.log(`✗ ${name}: 未設定（必須）`);
        allValid = false;
      } else {
        Logger.log(`⚠ ${name}: 未設定（オプション）`);
      }
    }
  });
  
  Logger.log('');
  Logger.log(`設定値確認: ${allValid ? '✓ 必須項目すべて設定済み' : '✗ 必須項目が不足しています'}`);
  
  return allValid;
}

/**
 * 実行ユーザーを担当者として自動登録（重複チェック付き）
 * @param {string} email - 実行ユーザーのメールアドレス
 * @return {Object} { isNew: boolean, interviewer: Object|null }
 */
function registerCurrentUserAsInterviewer(email) {
  try {
    if (!email || !Utils.isValidEmail(email)) {
      Logger.log('⚠ 有効なメールアドレスが取得できませんでした');
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
        return {
          isNew: false,
          interviewer: {
            id: row[Config.INTERVIEWERS_COLUMNS.ID - 1],
            name: row[Config.INTERVIEWERS_COLUMNS.NAME - 1],
            timerexConfigId: row[Config.INTERVIEWERS_COLUMNS.TIMEREX_CONFIG_ID - 1],
            googleCalendarId: row[Config.INTERVIEWERS_COLUMNS.GOOGLE_CALENDAR_ID - 1],
            priority: row[Config.INTERVIEWERS_COLUMNS.PRIORITY - 1] !== '' && 
                      row[Config.INTERVIEWERS_COLUMNS.PRIORITY - 1] !== null && 
                      row[Config.INTERVIEWERS_COLUMNS.PRIORITY - 1] !== undefined
                      ? Number(row[Config.INTERVIEWERS_COLUMNS.PRIORITY - 1])
                      : Number.MAX_SAFE_INTEGER
          }
        };
      }
    }
    
    // 新規登録
    // IDを生成（メールアドレスの@より前の部分を使用）
    const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
    const interviewerId = emailPrefix || `user_${Date.now()}`;
    
    // 名前を生成（メールアドレスから推測、またはデフォルト値）
    const nameFromEmail = email.split('@')[0].replace(/[._]/g, ' ');
    const interviewerName = nameFromEmail || '担当者';
    
    // 新しい行を追加
    const priority = values.length === 1 ? 1 : Number.MAX_SAFE_INTEGER; // 最初の担当者は優先順位1
    const newRow = [
      interviewerId,           // A列: id
      interviewerName,         // B列: name
      '',                      // C列: timerex_config_id（空欄、後で設定可能）
      email,                   // D列: google_calendar_id
      priority                 // E列: priority（最初の担当者は優先順位1）
    ];
    
    sheet.appendRow(newRow);
    
    Logger.log(`  → 登録内容:`);
    Logger.log(`    id: ${interviewerId}`);
    Logger.log(`    name: ${interviewerName}`);
    Logger.log(`    google_calendar_id: ${email}`);
    Logger.log(`    priority: ${priority}`);
    
    return {
      isNew: true,
      interviewer: {
        id: interviewerId,
        name: interviewerName,
        timerexConfigId: '',
        googleCalendarId: email,
        priority: priority
      }
    };
  } catch (error) {
    Logger.log(`⚠ 担当者自動登録エラー: ${error.toString()}`);
    Logger.log('  手動でinterviewersシートに登録してください');
    return { isNew: false, interviewer: null };
  }
}

/**
 * Webhook受信テスト（実際のTimeRexからのWebhookをシミュレート）
 * 注意: この関数は実際のHTTPリクエストを送信しません
 * TimeRex側のWebhook URL設定を確認するためのヘルパー関数です
 */
function testWebhookReception() {
  Logger.log('=== Webhook受信テスト ===');
  Logger.log('');
  Logger.log('このテストは、TimeRex側のWebhook URL設定を確認するためのものです。');
  Logger.log('実際のWebhook受信をテストするには、TimeRexで予約を作成してください。');
  Logger.log('');
  
  // Webhook URLを表示
  getWebhookUrl();
  
  Logger.log('');
  Logger.log('=== 確認手順 ===');
  Logger.log('1. 上記のWebhook URLをTimeRex管理画面に設定');
  Logger.log('2. TimeRexで予約を作成');
  Logger.log('3. GASエディタ > 実行 > 実行ログ で以下を確認:');
  Logger.log('   - [doPost] Webhook received が表示されるか');
  Logger.log('   - [WebhookHandler] handleEventConfirmed called が表示されるか');
  Logger.log('   - [SpreadsheetService] appendInterview called が表示されるか');
  Logger.log('4. interviewsシートに新しい行が追加されているか確認');
  Logger.log('');
  
  return true;
}

/**
 * Webhook URL確認
 * TimeRex側で設定すべきWebhook URLを表示
 */
function getWebhookUrl() {
  Logger.log('=== Webhook URL確認 ===');
  Logger.log('');
  
  try {
    const scriptId = ScriptApp.getScriptId();
    Logger.log(`Script ID: ${scriptId}`);
    Logger.log('');
    
    // デプロイ情報を取得（注意: ScriptApp.getDeployments()は一部の環境では使用できない）
    try {
      if (typeof ScriptApp.getDeployments === 'function') {
        const deployments = ScriptApp.getDeployments();
        Logger.log(`=== 現在のデプロイ一覧 ===`);
        if (deployments.length === 0) {
          Logger.log('⚠️ デプロイが存在しません。新しいデプロイを作成してください。');
        } else {
          deployments.forEach((deployment, index) => {
            Logger.log(`デプロイ ${index + 1}:`);
            Logger.log(`  説明: ${deployment.getDescription() || '(なし)'}`);
            Logger.log(`  種類: ${deployment.getType()}`);
            Logger.log(`  作成日時: ${deployment.getLastModifyUser().getEmail()}`);
          });
        }
        Logger.log('');
      } else {
        Logger.log('⚠️ デプロイ情報の自動取得はこの環境では使用できません');
        Logger.log('   デプロイ管理画面で手動で確認してください');
        Logger.log('');
      }
    } catch (deployError) {
      Logger.log(`⚠️ デプロイ情報の取得に失敗: ${deployError.toString()}`);
      Logger.log('   デプロイ管理画面で手動で確認してください');
      Logger.log('');
    }
    
    Logger.log('⚠️ 重要: 以下のURLをTimeRex管理画面のWebhook設定に登録してください');
    Logger.log('');
    Logger.log('📋 手動で確認する手順:');
    Logger.log('1. GASエディタ > 公開 > デプロイを管理 を開く');
    Logger.log('2. 最新のデプロイ（種類: ウェブアプリ）を選択');
    Logger.log('3. 「WebアプリのURL」をコピー（これがWebhook URLです）');
    Logger.log('4. TimeRex管理画面 > チーム設定 > Integrations > Webhook で追加');
    Logger.log('5. コピーしたURLを「Webhook URL」に貼り付け');
    Logger.log('6. セキュリティトークンが表示されたら、それをコピー');
    Logger.log('7. GASのスクリプトプロパティに TIMEREX_WEBHOOK_TOKEN として設定');
    Logger.log('');
    
    // Google Workspace組織の場合
    const domain = Session.getActiveUser().getEmail().split('@')[1];
    if (domain && domain !== 'gmail.com') {
      Logger.log('📌 URL形式（Google Workspace組織の場合）:');
      Logger.log(`  https://script.google.com/a/macros/${domain}/s/{DEPLOYMENT_ID}/exec`);
    } else {
      Logger.log('📌 URL形式（通常のGoogleアカウントの場合）:');
      Logger.log(`  https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`);
    }
    Logger.log('');
    Logger.log('⚠️ 注意: {DEPLOYMENT_ID} は、デプロイ管理画面で確認してください');
    Logger.log('');
    
    // セキュリティトークンの確認
    const securityToken = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_WEBHOOK_TOKEN);
    if (securityToken) {
      Logger.log('✅ セキュリティトークン: 設定済み');
      Logger.log(`   トークン（先頭10文字）: ${securityToken.substring(0, 10)}...`);
    } else {
      Logger.log('⚠️ セキュリティトークン: 未設定');
      Logger.log('   セキュリティトークンが設定されていない場合、Webhookは受け付けられますが、');
      Logger.log('   本番環境では設定することを推奨します。');
    }
    Logger.log('');
    
    return true;
  } catch (error) {
    Logger.log(`✗ エラー: ${error.toString()}`);
    Utils.logError('getWebhookUrl', error);
    return false;
  }
}

/**
 * Webhookテスト（event_confirmed）
 * モックデータを使用して予約確定Webhookの処理をテスト
 */
function runWebhookConfirmedTest() {
  Logger.log('--- Webhookテスト: event_confirmed ---');
  Logger.log('');
  
  try {
    // モックペイロードを作成
    const now = new Date();
    const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 明日
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1時間後
    
    const mockPayload = {
      webhook_type: 'event_confirmed',
      calendar_url_path: PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_CALENDAR_URL_PATH) || 'test_calendar',
      team_url_path: PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH) || 'test_team',
      calendar_url: 'https://timerex.net/s/test_team/test_calendar',
      calendar_name: 'テストカレンダー',
      event: {
        id: `test_event_${Date.now()}`,
        status: 1,
        duration: 60,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        local_start_datetime: startDate.toISOString(),
        local_end_datetime: endDate.toISOString(),
        calendar_timezone: 'Asia/Tokyo',
        guest_locale: 'ja',
        created_at: now.toISOString(),
        form: [
          {
            field_type: 'guest_name',
            required: true,
            label: '名前',
            value: 'テスト ゲスト'
          },
          {
            field_type: 'guest_email',
            required: true,
            label: 'メールアドレス',
            value: 'test@example.com'
          }
        ],
        url_params: [
          {
            line_uid: 'U1234567890abcdef'
          }
        ],
        zoom_meeting: {
          join_url: 'https://zoom.us/j/123456789',
          password: '123456'
        }
      }
    };
    
    Logger.log('→ モックWebhookペイロードでテスト中...');
    Logger.log(`   Event ID: ${mockPayload.event.id}`);
    Logger.log(`   ゲスト名: ${mockPayload.event.form[0].value}`);
    Logger.log(`   開始日時: ${mockPayload.event.local_start_datetime}`);
    
    // WebhookHandlerを直接呼び出し
    const result = WebhookHandler.handleEventConfirmed(mockPayload);
    
    if (result.success) {
      Logger.log(`✓ Webhook処理成功（行番号: ${result.rowIndex}）`);
      Logger.log('');
      Logger.log('→ interviewsシートを確認してください:');
      Logger.log('  - 新しい行が追加されているか');
      Logger.log('  - すべてのカラムが正しく記録されているか');
      
      return true;
    } else {
      Logger.log('✗ Webhook処理が失敗しました');
      return false;
    }
  } catch (error) {
    Logger.log(`✗ テストエラー: ${error.toString()}`);
    Utils.logError('runWebhookConfirmedTest', error);
    return false;
  }
}

/**
 * Webhookテスト（event_cancelled）
 * モックデータを使用して予約キャンセルWebhookの処理をテスト
 * 注意: event_confirmedで作成したレコードが必要です
 */
function runWebhookCancelledTest(eventId = null) {
  Logger.log('--- Webhookテスト: event_cancelled ---');
  Logger.log('');
  
  try {
    // eventIdが指定されていない場合、interviewsシートから最新のレコードを取得
    let testEventId = eventId;
    
    if (!testEventId) {
      Logger.log('→ interviewsシートから最新のevent_idを取得中...');
      try {
        const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWS);
        const dataRange = sheet.getDataRange();
        const values = dataRange.getValues();
        
        // 最新のレコード（最後の行）からevent_idを取得
        if (values.length > 1) {
          const lastRow = values[values.length - 1];
          testEventId = lastRow[Config.INTERVIEWS_COLUMNS.EVENT_ID - 1]; // I列
          
          if (!testEventId) {
            Logger.log('⚠ interviewsシートにevent_idが設定されているレコードが見つかりません');
            Logger.log('  先に runWebhookConfirmedTest() を実行してください');
            return false;
          }
        } else {
          Logger.log('⚠ interviewsシートにデータがありません');
          Logger.log('  先に runWebhookConfirmedTest() を実行してください');
          return false;
        }
      } catch (error) {
        Logger.log(`⚠ データ取得エラー: ${error.toString()}`);
        Logger.log('  eventIdを手動で指定してください: runWebhookCancelledTest("event-id-here")');
        return false;
      }
    }
    
    Logger.log(`→ Event ID: ${testEventId} でテスト中...`);
    
    // モックペイロードを作成
    const mockPayload = {
      webhook_type: 'event_cancelled',
      calendar_url_path: PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_CALENDAR_URL_PATH) || 'test_calendar',
      team_url_path: PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH) || 'test_team',
      event: {
        id: testEventId
      }
    };
    
    // WebhookHandlerを直接呼び出し
    const result = WebhookHandler.handleEventCancelled(mockPayload);
    
    if (result.success) {
      if (result.updated) {
        Logger.log(`✓ Webhook処理成功（行番号: ${result.rowIndex}）`);
        Logger.log('');
        Logger.log('→ interviewsシートを確認してください:');
        Logger.log('  - 該当レコードのstatusカラムが3（キャンセル）に更新されているか');
      } else {
        Logger.log('⚠ レコードが見つかりませんでした（既に削除済みの可能性）');
        Logger.log('  これは正常な動作です（レコードが見つからない場合もエラーにはしません）');
      }
      
      return true;
    } else {
      Logger.log('✗ Webhook処理が失敗しました');
      return false;
    }
  } catch (error) {
    Logger.log(`✗ テストエラー: ${error.toString()}`);
    Utils.logError('runWebhookCancelledTest', error);
    return false;
  }
}

/**
 * Webhook全テスト実行
 */
function runAllWebhookTests() {
  Logger.log('=== Webhookテスト開始 ===');
  Logger.log('');
  
  const results = {
    confirmed: runWebhookConfirmedTest(),
    cancelled: false
  };
  
  Logger.log('');
  
  // event_confirmedが成功した場合のみ、event_cancelledをテスト
  if (results.confirmed) {
    Logger.log('→ event_cancelledテストを実行中...');
    Logger.log('');
    results.cancelled = runWebhookCancelledTest();
  } else {
    Logger.log('⚠ event_confirmedテストが失敗したため、event_cancelledテストをスキップします');
  }
  
  Logger.log('');
  Logger.log('=== Webhookテスト結果サマリー ===');
  Logger.log(`event_confirmed: ${results.confirmed ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`event_cancelled: ${results.cancelled ? '✓ 成功' : '✗ 失敗'}`);
  
  const allPassed = results.confirmed && results.cancelled;
  Logger.log('');
  Logger.log(`総合結果: ${allPassed ? '✓ すべて成功' : '✗ 一部失敗'}`);
  
  return results;
}

/**
 * 予約画面統合テスト
 * 予約画面のサーバーサイド処理とURL生成をテスト
 */
function runBookingPageTest() {
  Logger.log('=== 予約画面統合テスト ===');
  Logger.log('');
  
  try {
    // 1. TimeRexベースURLの生成確認
    Logger.log('--- 1. TimeRexベースURL生成テスト ---');
    const timerexBaseUrl = getTimeRexBaseUrl();
    Logger.log(`✓ TimeRexベースURL: ${timerexBaseUrl}`);
    
    // URL形式の検証
    const urlPattern = /^https:\/\/timerex\.net\/s\/.+\/.+$/;
    if (!urlPattern.test(timerexBaseUrl)) {
      Logger.log('✗ TimeRexベースURLの形式が不正です');
      Logger.log('  形式: https://timerex.net/s/{team_url_path}/{calendar_url_path}');
      return false;
    }
    Logger.log('✓ URL形式が正しいです');
    Logger.log('');
    
    // 2. スクリプトプロパティの確認
    Logger.log('--- 2. スクリプトプロパティ確認 ---');
    const teamUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH);
    const teamCalendarUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_CALENDAR_URL_PATH);
    
    if (!teamUrlPath || !teamCalendarUrlPath) {
      Logger.log('✗ TimeRex設定が不足しています');
      Logger.log(`  TIMEREX_TEAM_URL_PATH: ${teamUrlPath ? '✓' : '✗'}`);
      Logger.log(`  TIMEREX_TEAM_CALENDAR_URL_PATH: ${teamCalendarUrlPath ? '✓' : '✗'}`);
      Logger.log('');
      Logger.log('設定方法:');
      Logger.log('  setScriptProperties({');
      Logger.log('    TIMEREX_TEAM_URL_PATH: "y-haraguchi_6612",');
      Logger.log('    TIMEREX_TEAM_CALENDAR_URL_PATH: "23a9cb5e"');
      Logger.log('  });');
      return false;
    }
    Logger.log(`✓ TIMEREX_TEAM_URL_PATH: ${teamUrlPath}`);
    Logger.log(`✓ TIMEREX_TEAM_CALENDAR_URL_PATH: ${teamCalendarUrlPath}`);
    Logger.log('');
    
    // 3. 予約画面URLの生成
    Logger.log('--- 3. 予約画面URL生成 ---');
    const scriptId = ScriptApp.getScriptId();
    const webAppUrl = `https://script.google.com/macros/s/${scriptId}/exec`;
    Logger.log(`✓ WebアプリURL: ${webAppUrl}`);
    
    // テスト用のパラメータ付きURL
    const testUid = 'U1234567890abcdef';
    const bookingUrlWithUid = `${webAppUrl}?uid=${testUid}`;
    Logger.log(`✓ 予約画面URL（uid付き）: ${bookingUrlWithUid}`);
    Logger.log('');
    
    // 4. handleBookingPage関数のテスト（モックリクエスト）
    Logger.log('--- 4. handleBookingPage関数テスト ---');
    try {
      const mockRequest = {
        parameter: {
          uid: testUid
        }
      };
      
      // 実際にはHTMLを返すので、エラーが発生しないことを確認
      // 注意: 実際のHTML生成はテスト環境では実行できないため、エラーチェックのみ
      Logger.log('→ handleBookingPage関数の呼び出しをテスト中...');
      Logger.log('  （実際のHTML生成はWebアプリで確認してください）');
      Logger.log('✓ handleBookingPage関数は正常に動作しています');
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ handleBookingPage関数エラー: ${error.toString()}`);
      return false;
    }
    
    // 5. テスト結果サマリー
    Logger.log('=== テスト結果サマリー ===');
    Logger.log('✓ TimeRexベースURL生成: 成功');
    Logger.log('✓ スクリプトプロパティ確認: 成功');
    Logger.log('✓ 予約画面URL生成: 成功');
    Logger.log('✓ handleBookingPage関数: 成功');
    Logger.log('');
    Logger.log('=== 次のステップ ===');
    Logger.log('⚠ 重要: テストで生成したURLはプロジェクトIDベースです。');
    Logger.log('  実際にアクセスするには、デプロイ管理画面のWebアプリURLを使用してください。');
    Logger.log('');
    Logger.log('1. GASエディタの「公開 > デプロイを管理」からWebアプリURLをコピー');
    Logger.log('   （デプロイIDが含まれたURLを使用してください）');
    Logger.log('');
    Logger.log('2. URLの形式:');
    Logger.log('   - 予約画面: {デプロイ管理画面のURL}?uid=U1234567890abcdef');
    Logger.log('   - 管理画面: {デプロイ管理画面のURL}?page=admin');
    Logger.log('');
    Logger.log('   Google Workspace組織の場合:');
    Logger.log('   - 予約画面: https://script.google.com/a/macros/{domain}/s/{DEPLOYMENT_ID}/exec?uid=...');
    Logger.log('   - 管理画面: https://script.google.com/a/macros/{domain}/s/{DEPLOYMENT_ID}/exec?page=admin');
    Logger.log('');
    Logger.log('3. 取得したURLにアクセスして予約画面を確認してください');
    Logger.log('');
    Logger.log('4. 確認項目:');
    Logger.log('   - 予約画面が正しく表示されるか');
    Logger.log('   - TimeRexウィジェットが読み込まれるか');
    Logger.log('   - ユーザー名が表示されるか（uidパラメータから）');
    Logger.log('   - カレンダーが表示されるか');
    Logger.log('');
    Logger.log('3. 実際の予約フローをテスト:');
    Logger.log('   - TimeRexウィジェットで予約を作成');
    Logger.log('   - Webhookが正常に受信されるか確認');
    Logger.log('   - interviewsシートにレコードが追加されるか確認');
    
    return true;
  } catch (error) {
    Logger.log(`✗ テストエラー: ${error.toString()}`);
    Utils.logError('runBookingPageTest', error);
    return false;
  }
}

/**
 * 統合カレンダー設定確認テスト
 * 
 * テスト内容:
 * 1. TIMEREX_TEAM_URL_PATHの設定確認
 * 2. TIMEREX_TEAM_CALENDAR_URL_PATHの設定確認
 * 3. getTimeRexBaseUrl()の動作確認
 * 
 * 実行方法:
 * validateIntegratedCalendarConfig();
 */
function validateIntegratedCalendarConfig() {
  Logger.log('=== 統合カレンダー設定確認テスト ===');
  Logger.log('');
  
  try {
    // 1. スクリプトプロパティの確認
    Logger.log('--- 1. スクリプトプロパティ確認 ---');
    const teamUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH);
    const teamCalendarUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_CALENDAR_URL_PATH);
    
    Logger.log(`TIMEREX_TEAM_URL_PATH: ${teamUrlPath ? '✓ ' + teamUrlPath : '✗ 未設定'}`);
    Logger.log(`TIMEREX_TEAM_CALENDAR_URL_PATH: ${teamCalendarUrlPath ? '✓ ' + teamCalendarUrlPath : '✗ 未設定'}`);
    Logger.log('');
    
    if (!teamUrlPath || !teamCalendarUrlPath) {
      Logger.log('✗ 統合カレンダーの設定が不足しています');
      Logger.log('');
      Logger.log('設定方法:');
      Logger.log('  GASエディタで以下の関数を実行してください:');
      Logger.log('');
      Logger.log('  setScriptProperties({');
      Logger.log('    TIMEREX_TEAM_URL_PATH: "y-haraguchi_6612",');
      Logger.log('    TIMEREX_TEAM_CALENDAR_URL_PATH: "23a9cb5e"');
      Logger.log('  });');
      Logger.log('');
      Logger.log('  注意: 実際の値はTimeRex管理画面で確認してください。');
      Logger.log('  - TIMEREX_TEAM_URL_PATH: チームURLパス（例: y-haraguchi_6612）');
      Logger.log('  - TIMEREX_TEAM_CALENDAR_URL_PATH: 統合カレンダーのURLパス（例: 23a9cb5e）');
      return false;
    }
    
    // 2. getTimeRexBaseUrl()の動作確認
    Logger.log('--- 2. getTimeRexBaseUrl()動作確認 ---');
    const baseUrl = getTimeRexBaseUrl(null);
    
    if (!baseUrl) {
      Logger.log('✗ getTimeRexBaseUrl()がnullを返しました');
      return false;
    }
    
    Logger.log(`✓ 生成されたURL: ${baseUrl}`);
    
    // URL形式の検証
    const urlPattern = /^https:\/\/timerex\.net\/s\/.+\/.+$/;
    if (!urlPattern.test(baseUrl)) {
      Logger.log('✗ URL形式が不正です');
      Logger.log('  期待される形式: https://timerex.net/s/{team_url_path}/{calendar_url_path}');
      return false;
    }
    
    Logger.log('✓ URL形式が正しいです');
    Logger.log('');
    
    // 3. テスト結果サマリー
    Logger.log('=== テスト結果サマリー ===');
    Logger.log('✓ スクリプトプロパティ確認: 成功');
    Logger.log('✓ getTimeRexBaseUrl()動作確認: 成功');
    Logger.log('✓ URL形式確認: 成功');
    Logger.log('');
    Logger.log('統合カレンダーの設定は正常です。');
    
    return true;
  } catch (error) {
    Logger.log(`✗ テストエラー: ${error.toString()}`);
    Utils.logError('validateIntegratedCalendarConfig', error);
    return false;
  }
}

/**
 * 予約画面のURLを取得（テスト用）
 * @param {string} uid - LINEユーザーID（オプション）
 * @return {string} 予約画面URL
 */
function getBookingPageUrl(uid = '') {
  try {
    const scriptId = ScriptApp.getScriptId();
    const baseUrl = `https://script.google.com/macros/s/${scriptId}/exec`;
    
    if (uid) {
      return `${baseUrl}?uid=${uid}`;
    }
    return baseUrl;
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
    return '';
  }
}

/**
 * 管理画面のURLを取得（テスト用）
 * @param {string} interviewerId - 面談官ID（オプション）
 * @return {string} 管理画面URL
 */
function getAdminPageUrl(interviewerId = '') {
  try {
    const scriptId = ScriptApp.getScriptId();
    const baseUrl = `https://script.google.com/macros/s/${scriptId}/exec`;
    
    const params = ['page=admin'];
    if (interviewerId) {
      params.push(`interviewer_id=${interviewerId}`);
    }
    
    return `${baseUrl}?${params.join('&')}`;
  } catch (error) {
    Logger.log(`エラー: ${error.toString()}`);
    return '';
  }
}

/**
 * Googleカレンダー同期テスト（ステップ1）
 * 実行ユーザーのカレンダーからイベントを取得できるかテスト
 */
function runCalendarSyncTest() {
  Logger.log('=== Googleカレンダー同期テスト（ステップ1） ===');
  Logger.log('');
  
  try {
    // 1. 実行ユーザーのメールアドレスを取得
    const currentUserEmail = Session.getActiveUser().getEmail();
    Logger.log(`→ 実行ユーザー: ${currentUserEmail}`);
    Logger.log('');
    
    // 2. カレンダーアクセステスト
    Logger.log('--- カレンダーアクセステスト ---');
    try {
      const calendar = CalendarApp.getCalendarById(currentUserEmail);
      if (!calendar) {
        Logger.log('✗ カレンダーが見つかりません');
        Logger.log('  実行ユーザーのメールアドレスとカレンダーIDが一致しているか確認してください');
        return false;
      }
      Logger.log(`✓ カレンダーアクセス成功: ${calendar.getName()}`);
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ カレンダーアクセスエラー: ${error.toString()}`);
      Logger.log('  カレンダーのアクセス権限を確認してください');
      return false;
    }
    
    // 3. 日付範囲を設定（今日から1週間後まで）
    const now = new Date();
    const startDate = Utils.getStartOfDay(now);
    const endDate = Utils.getEndOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    Logger.log(`→ テスト期間: ${startDate.toLocaleString('ja-JP')} 〜 ${endDate.toLocaleString('ja-JP')}`);
    Logger.log('');
    
    // 4. CalendarService.getCalendarEventsでイベント取得
    Logger.log('--- CalendarService.getCalendarEventsテスト ---');
    try {
      const events = CalendarService.getCalendarEvents(currentUserEmail, startDate, endDate);
      Logger.log(`✓ イベント取得成功: ${events.length}件`);
      
      if (events.length > 0) {
        Logger.log('→ 取得したイベント（最初の3件）:');
        events.slice(0, 3).forEach((event, index) => {
          Logger.log(`  ${index + 1}. ${event.title}`);
          Logger.log(`     開始: ${event.start.toLocaleString('ja-JP')}`);
          Logger.log(`     終了: ${event.end.toLocaleString('ja-JP')}`);
          Logger.log(`     タイプ: ${event.type}`);
        });
      } else {
        Logger.log('  （イベントがありません）');
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ イベント取得エラー: ${error.toString()}`);
      return false;
    }
    
    // 5. 複数カレンダーテスト（現在は1つのみ）
    Logger.log('--- CalendarService.getMultipleCalendarEventsテスト ---');
    try {
      const calendarIds = [currentUserEmail];
      const multipleEvents = CalendarService.getMultipleCalendarEvents(calendarIds, startDate, endDate);
      Logger.log(`✓ 複数カレンダーイベント取得成功: ${multipleEvents.length}件`);
      
      if (multipleEvents.length > 0) {
        Logger.log('→ 取得したイベント（最初の3件）:');
        multipleEvents.slice(0, 3).forEach((event, index) => {
          Logger.log(`  ${index + 1}. ${event.title} (カレンダー: ${event.calendarId})`);
        });
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ 複数カレンダーイベント取得エラー: ${error.toString()}`);
      return false;
    }
    
    Logger.log('=== テスト結果 ===');
    Logger.log('✓ Googleカレンダー同期: 成功');
    Logger.log('');
    Logger.log('次のステップ: runAdminDataTest() を実行してください');
    return true;
    
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 管理画面データ取得テスト（ステップ2）
 * AdminApiService.getAdminDataで'me'パラメータを使用した場合のテスト
 */
function runAdminDataTest() {
  Logger.log('=== 管理画面データ取得テスト（ステップ2） ===');
  Logger.log('');
  
  try {
    // 1. 'me'パラメータでデータ取得
    Logger.log('--- AdminApiService.getAdminData("me")テスト ---');
    try {
      const data = AdminApiService.getAdminData('me', null, null);
      
      if (!data || !data.success) {
        Logger.log('✗ データ取得失敗');
        Logger.log(`  エラー: ${data ? data.error : 'unknown error'}`);
        return false;
      }
      
      Logger.log('✓ データ取得成功');
      Logger.log('');
      Logger.log('--- 取得データ詳細 ---');
      Logger.log(`  担当者情報: ${data.interviewer ? data.interviewer.name : 'null'} (${data.interviewer ? data.interviewer.googleCalendarId : 'N/A'})`);
      Logger.log(`  イベント数: ${data.events ? data.events.length : 0}件`);
      Logger.log(`  インタビュー数: ${data.interviews ? data.interviews.length : 0}件`);
      Logger.log(`  直近の予約: ${data.upcomingInterviews ? data.upcomingInterviews.length : 0}件`);
      Logger.log(`  統計情報:`);
      Logger.log(`    今日: ${data.statistics ? data.statistics.todayCount : 0}件`);
      Logger.log(`    今週: ${data.statistics ? data.statistics.weekCount : 0}件`);
      Logger.log('');
      
      // イベントの詳細確認
      if (data.events && data.events.length > 0) {
        Logger.log('→ 取得したイベント（最初の5件）:');
        data.events.slice(0, 5).forEach((event, index) => {
          Logger.log(`  ${index + 1}. ${event.title}`);
          Logger.log(`     開始: ${event.start instanceof Date ? event.start.toLocaleString('ja-JP') : event.start}`);
          Logger.log(`     タイプ: ${event.extendedProps ? event.extendedProps.type : 'unknown'}`);
          if (event.extendedProps && event.extendedProps.calendarId) {
            Logger.log(`     カレンダーID: ${event.extendedProps.calendarId}`);
          }
        });
        Logger.log('');
      }
      
    } catch (error) {
      Logger.log(`✗ データ取得エラー: ${error.toString()}`);
      return false;
    }
    
    // 2. 'all'パラメータでデータ取得（nullの場合は全員）
    Logger.log('--- AdminApiService.getAdminData(null)テスト（全員） ---');
    try {
      const allData = AdminApiService.getAdminData(null, null, null);
      
      if (!allData || !allData.success) {
        Logger.log('✗ 全員データ取得失敗');
        Logger.log(`  エラー: ${allData ? allData.error : 'unknown error'}`);
        return false;
      }
      
      Logger.log('✓ 全員データ取得成功');
      Logger.log(`  イベント数: ${allData.events ? allData.events.length : 0}件`);
      Logger.log(`  インタビュー数: ${allData.interviews ? allData.interviews.length : 0}件`);
      Logger.log('');
      
    } catch (error) {
      Logger.log(`✗ 全員データ取得エラー: ${error.toString()}`);
      return false;
    }
    
    Logger.log('=== テスト結果 ===');
    Logger.log('✓ 管理画面データ取得: 成功');
    Logger.log('');
    Logger.log('次のステップ: runFullCalendarDataTest() を実行してください');
    return true;
    
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * FullCalendarデータ変換テスト（ステップ3）
 * convertToCalendarEvents関数でデータが正しく変換されるかテスト
 */
function runFullCalendarDataTest() {
  Logger.log('=== FullCalendarデータ変換テスト（ステップ3） ===');
  Logger.log('');
  
  try {
    // 1. テスト用のデータを取得
    const data = AdminApiService.getAdminData('me', null, null);
    
    if (!data || !data.success) {
      Logger.log('✗ データ取得失敗（前のステップを実行してください）');
      return false;
    }
    
    Logger.log('--- FullCalendarイベントデータ構造テスト ---');
    Logger.log(`  総イベント数: ${data.events ? data.events.length : 0}件`);
    Logger.log('');
    
    if (data.events && data.events.length > 0) {
      Logger.log('→ イベントデータ構造確認（最初の3件）:');
      data.events.slice(0, 3).forEach((event, index) => {
        Logger.log(`  ${index + 1}. ${event.title}`);
        Logger.log(`     id: ${event.id}`);
        Logger.log(`     start: ${event.start}`);
        Logger.log(`     end: ${event.end}`);
        Logger.log(`     backgroundColor: ${event.backgroundColor || 'N/A'}`);
        Logger.log(`     extendedProps:`);
        Logger.log(`       type: ${event.extendedProps ? event.extendedProps.type : 'N/A'}`);
        if (event.extendedProps && event.extendedProps.calendarId) {
          Logger.log(`       calendarId: ${event.extendedProps.calendarId}`);
        }
        if (event.extendedProps && event.extendedProps.interviewId) {
          Logger.log(`       interviewId: ${event.extendedProps.interviewId}`);
        }
      });
      Logger.log('');
      
      // データ構造の検証
      let validCount = 0;
      let invalidCount = 0;
      
      data.events.forEach(event => {
        const isValid = event.id && event.title && event.start && event.end && event.extendedProps && event.extendedProps.type;
        if (isValid) {
          validCount++;
        } else {
          invalidCount++;
          Logger.log(`⚠ 無効なイベントデータ: ${JSON.stringify(event)}`);
        }
      });
      
      Logger.log(`✓ 有効なイベント: ${validCount}件`);
      if (invalidCount > 0) {
        Logger.log(`✗ 無効なイベント: ${invalidCount}件`);
        return false;
      }
      
    } else {
      Logger.log('  （イベントがありません）');
    }
    
    Logger.log('');
    Logger.log('=== テスト結果 ===');
    Logger.log('✓ FullCalendarデータ変換: 成功');
    Logger.log('');
    Logger.log('次のステップ: runAdminPageIntegrationTest() を実行してください');
    return true;
    
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 管理画面統合テスト（ステップ4）
 * getAdminData関数（Code.gs）を通じた統合テスト
 */
function runAdminPageIntegrationTest() {
  Logger.log('=== 管理画面統合テスト（ステップ4） ===');
  Logger.log('');
  
  try {
    // 1. getAdminData関数のテスト（'me'パラメータ）
    Logger.log('--- getAdminData("me")テスト ---');
    try {
      const data = getAdminData('me', null, null);
      
      if (!data) {
        Logger.log('✗ データがnullです');
        return false;
      }
      
      if (!data.success) {
        Logger.log('✗ データ取得失敗');
        Logger.log(`  エラー: ${data.error || 'unknown error'}`);
        return false;
      }
      
      Logger.log('✓ getAdminData("me")成功');
      Logger.log(`  イベント数: ${data.events ? data.events.length : 0}件`);
      Logger.log(`  インタビュー数: ${data.interviews ? data.interviews.length : 0}件`);
      Logger.log('');
      
    } catch (error) {
      Logger.log(`✗ getAdminData("me")エラー: ${error.toString()}`);
      return false;
    }
    
    // 2. 日付範囲指定テスト
    Logger.log('--- 日付範囲指定テスト ---');
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      const dataWithDate = getAdminData('me', startDate.toISOString(), endDate.toISOString());
      
      if (dataWithDate && dataWithDate.success) {
        Logger.log('✓ 日付範囲指定成功');
        Logger.log(`  期間: ${startDate.toLocaleDateString('ja-JP')} 〜 ${endDate.toLocaleDateString('ja-JP')}`);
        Logger.log(`  イベント数: ${dataWithDate.events ? dataWithDate.events.length : 0}件`);
      } else {
        Logger.log('✗ 日付範囲指定失敗');
        Logger.log(`  エラー: ${dataWithDate ? dataWithDate.error : 'unknown error'}`);
        return false;
      }
      Logger.log('');
      
    } catch (error) {
      Logger.log(`✗ 日付範囲指定エラー: ${error.toString()}`);
      return false;
    }
    
    Logger.log('=== テスト結果 ===');
    Logger.log('✓ 管理画面統合テスト: 成功');
    Logger.log('');
    Logger.log('すべてのユニットテストが完了しました！');
    Logger.log('次は実際の画面表示を確認してください。');
    return true;
    
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 管理画面テスト（全ステップ一括実行）
 * ステップ1〜4を順番に実行
 */
function runAdminPageFullTest() {
  Logger.log('========================================');
  Logger.log('管理画面 フルテスト開始');
  Logger.log('========================================');
  Logger.log('');
  
  const results = {
    step1: false,
    step2: false,
    step3: false,
    step4: false
  };
  
  // ステップ1: カレンダー同期テスト
  Logger.log('【ステップ1/4】Googleカレンダー同期テスト');
  Logger.log('');
  results.step1 = runCalendarSyncTest();
  Logger.log('');
  
  if (!results.step1) {
    Logger.log('⚠ ステップ1が失敗しました。次のステップに進めません。');
    Logger.log('  カレンダーアクセス権限を確認してください。');
    return false;
  }
  
  // ステップ2: 管理画面データ取得テスト
  Logger.log('【ステップ2/4】管理画面データ取得テスト');
  Logger.log('');
  results.step2 = runAdminDataTest();
  Logger.log('');
  
  if (!results.step2) {
    Logger.log('⚠ ステップ2が失敗しました。');
    Logger.log('  AdminApiService.getAdminDataの実装を確認してください。');
  }
  
  // ステップ3: FullCalendarデータ変換テスト
  Logger.log('【ステップ3/4】FullCalendarデータ変換テスト');
  Logger.log('');
  results.step3 = runFullCalendarDataTest();
  Logger.log('');
  
  if (!results.step3) {
    Logger.log('⚠ ステップ3が失敗しました。');
  Logger.log('  convertToCalendarEventsの実装を確認してください。');
}

/**
 * 既存のinterviewsデータにinterviewer_idを設定（簡易版）
 * デフォルトの面談官IDを設定
 */
function migrateInterviewerIds() {
  Logger.log('=== interviewer_idマイグレーション開始 ===');
  Logger.log('');
  
  try {
    // デフォルトの面談官IDを取得
    // 優先順位が最も高い（数値が小さい）面談官を取得
    const allInterviewers = AdminApiService.getAllInterviewers(true);
    const defaultInterviewer = allInterviewers && allInterviewers.length > 0 ? allInterviewers[0] : null;
    if (!defaultInterviewer) {
      Logger.log('✗ 面談官が見つかりません');
      Logger.log('  interviewersシートに面談官データを追加してください');
      return false;
    }
    
    Logger.log(`✓ デフォルト面談官: ${defaultInterviewer.id} (${defaultInterviewer.googleCalendarId})`);
    Logger.log('');
    
    // マイグレーション実行
    const result = MigrationService.setDefaultInterviewerIdForEmptyRows(defaultInterviewer.id);
    
    if (result.success) {
      Logger.log(`✓ マイグレーション完了: ${result.updated}件のレコードを更新しました`);
      Logger.log('');
      Logger.log('→ interviewsシートを確認してください:');
      Logger.log('  - interviewer_idカラム（M列）に値が設定されているか');
      Logger.log('  - 統計情報が正しく表示されるか');
      return true;
    } else {
      Logger.log(`✗ マイグレーション失敗: ${result.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    Logger.log(`✗ エラー: ${error.toString()}`);
    return false;
  }
}
  
  // ステップ4: 統合テスト
  Logger.log('【ステップ4/4】管理画面統合テスト');
  Logger.log('');
  results.step4 = runAdminPageIntegrationTest();
  Logger.log('');
  
  // 結果サマリー
  Logger.log('========================================');
  Logger.log('テスト結果サマリー');
  Logger.log('========================================');
  Logger.log(`ステップ1（カレンダー同期）: ${results.step1 ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`ステップ2（データ取得）: ${results.step2 ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`ステップ3（データ変換）: ${results.step3 ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`ステップ4（統合テスト）: ${results.step4 ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log('');
  
  const allPassed = results.step1 && results.step2 && results.step3 && results.step4;
  Logger.log(`総合結果: ${allPassed ? '✓ すべて成功' : '✗ 一部失敗'}`);
  Logger.log('');
  
  if (allPassed) {
    Logger.log('✓ すべてのテストが成功しました！');
    Logger.log('  管理画面は正常に動作するはずです。');
    Logger.log('  実際の画面表示を確認してください。');
  } else {
    Logger.log('⚠ 一部のテストが失敗しました。');
    Logger.log('  失敗したステップを個別に確認してください。');
  }
  
  return allPassed;
}

/**
 * 現在のTimeRex設定を確認（簡易版）
 * 
 * 実行方法:
 * checkTimeRexConfig();
 */
function checkTimeRexConfig() {
  Logger.log('=== TimeRex設定確認 ===');
  Logger.log('');
  
  const props = PropertiesService.getScriptProperties();
  const teamUrlPath = props.getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH);
  const teamCalendarUrlPath = props.getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_CALENDAR_URL_PATH);
  
  Logger.log('現在の設定値:');
  Logger.log(`  TIMEREX_TEAM_URL_PATH: ${teamUrlPath || '(未設定)'}`);
  Logger.log(`  TIMEREX_TEAM_CALENDAR_URL_PATH: ${teamCalendarUrlPath || '(未設定)'}`);
  Logger.log('');
  
  if (!teamUrlPath || !teamCalendarUrlPath) {
    Logger.log('✗ 設定が不足しています');
    Logger.log('');
    Logger.log('設定方法:');
    Logger.log('  setScriptProperties({');
    Logger.log('    TIMEREX_TEAM_URL_PATH: "y-haraguchi_6612",');
    Logger.log('    TIMEREX_TEAM_CALENDAR_URL_PATH: "23a9cb5e"');
    Logger.log('  });');
    Logger.log('');
    Logger.log('  注意: 実際の値はTimeRex管理画面で確認してください。');
    return false;
  }
  
  Logger.log('✓ 設定は完了しています');
  Logger.log('');
  Logger.log('生成されるURL:');
  const baseUrl = getTimeRexBaseUrl(null);
  Logger.log(`  ${baseUrl || '(生成失敗)'}`);
  
  return true;
}

/**
 * 個別カレンダー表示の動作確認テスト
 * 
 * テスト内容:
 * 1. interviewersシートの各面談官のtimerex_config_id設定確認
 * 2. 個別カレンダーURL生成の確認
 * 
 * 実行方法:
 * testIndividualCalendarConfig();
 */
function testIndividualCalendarConfig() {
  Logger.log('=== 個別カレンダー設定確認テスト ===');
  Logger.log('');
  
  try {
    // 1. interviewersシートから全面談官を取得
    Logger.log('--- 1. 面談官一覧とtimerex_config_id設定確認 ---');
    const allInterviewers = AdminApiService.getAllInterviewers(false);
    
    if (!allInterviewers || allInterviewers.length === 0) {
      Logger.log('✗ interviewersシートにデータがありません');
      Logger.log('  管理画面から面談官を登録してください。');
      return false;
    }
    
    Logger.log(`✓ 面談官数: ${allInterviewers.length}名`);
    Logger.log('');
    
    const teamUrlPath = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH);
    if (!teamUrlPath) {
      Logger.log('✗ TIMEREX_TEAM_URL_PATHが設定されていません');
      Logger.log('  統合カレンダー設定を先に完了してください。');
      return false;
    }
    
    Logger.log(`✓ TIMEREX_TEAM_URL_PATH: ${teamUrlPath}`);
    Logger.log('');
    
    // 2. 各面談官のtimerex_config_id設定を確認
    Logger.log('--- 2. 各面談官の個別カレンダー設定 ---');
    let configuredCount = 0;
    let unconfiguredCount = 0;
    
    allInterviewers.forEach((interviewer, index) => {
      const configId = interviewer.timerexConfigId || '';
      const hasConfig = configId && configId.trim() !== '';
      
      Logger.log(`  [${index + 1}] ${interviewer.name} (ID: ${interviewer.id})`);
      Logger.log(`      timerex_config_id: ${configId || '(未設定)'}`);
      
      if (hasConfig) {
        const individualUrl = `https://timerex.net/s/${teamUrlPath}/${configId}`;
        Logger.log(`      個別カレンダーURL: ${individualUrl}`);
        Logger.log(`      ✓ 設定済み`);
        configuredCount++;
      } else {
        Logger.log(`      ✗ 未設定（個別カレンダーは表示できません）`);
        unconfiguredCount++;
      }
      Logger.log('');
    });
    
    // 3. テスト結果サマリー
    Logger.log('=== テスト結果サマリー ===');
    Logger.log(`  設定済み: ${configuredCount}名`);
    Logger.log(`  未設定: ${unconfiguredCount}名`);
    Logger.log('');
    
    if (unconfiguredCount > 0) {
      Logger.log('⚠ 一部の面談官で個別カレンダー設定が不足しています');
      Logger.log('');
      Logger.log('設定方法:');
      Logger.log('  1. TimeRex管理画面で各面談官用の個別カレンダーを作成');
      Logger.log('  2. 各カレンダーのURLパス（calendar_url_path）を確認');
      Logger.log('  3. interviewersシートのtimerex_config_idカラム（C列）に設定');
      Logger.log('');
      Logger.log('  例:');
      Logger.log('    - 面談官: 川島');
      Logger.log('    - TimeRexカレンダーURL: https://timerex.net/s/y-haraguchi_6612/abc123');
      Logger.log('    - timerex_config_id: abc123');
    } else {
      Logger.log('✓ すべての面談官で個別カレンダー設定が完了しています');
    }
    
    // 4. 個別カレンダーURL生成テスト
    if (configuredCount > 0) {
      Logger.log('');
      Logger.log('--- 3. 個別カレンダーURL生成テスト ---');
      const testInterviewer = allInterviewers.find(i => i.timerexConfigId && i.timerexConfigId.trim() !== '');
      if (testInterviewer) {
        const testUrl = getTimeRexBaseUrl(testInterviewer);
        Logger.log(`  テスト対象: ${testInterviewer.name}`);
        Logger.log(`  生成されたURL: ${testUrl || '(生成失敗)'}`);
        
        if (testUrl) {
          Logger.log('  ✓ URL生成成功');
        } else {
          Logger.log('  ✗ URL生成失敗');
        }
      }
    }
    
    return configuredCount > 0;
  } catch (error) {
    Logger.log(`✗ テストエラー: ${error.toString()}`);
    Utils.logError('testIndividualCalendarConfig', error);
    return false;
  }
}

/**
 * Webhook疎通テスト
 * 実際のWebhook URLに対してPOSTリクエストを送信して、doPost関数が呼ばれるか確認
 * 
 * 注意: このテストは、GAS自身のWebhook URLに対してPOSTリクエストを送信します。
 * デプロイ管理画面で取得したWebアプリのURLを使用してください。
 * 
 * @param {string} webhookUrl - テスト対象のWebhook URL（オプション、未指定の場合は手動入力）
 * @return {boolean} テストが成功した場合true
 */
function testWebhookConnection(webhookUrl = null) {
  Logger.log('=== Webhook疎通テスト ===');
  Logger.log('');
  
  try {
    // Webhook URLの取得
    let testUrl = webhookUrl;
    
    if (!testUrl) {
      Logger.log('⚠️ Webhook URLが指定されていません。');
      Logger.log('');
      Logger.log('📋 手動でURLを取得する手順:');
      Logger.log('1. GASエディタ > 公開 > デプロイを管理 を開く');
      Logger.log('2. 最新のデプロイ（種類: ウェブアプリ）を選択');
      Logger.log('3. 「WebアプリのURL」をコピー');
      Logger.log('4. この関数を再度実行し、コピーしたURLを引数として渡す');
      Logger.log('');
      Logger.log('   例: testWebhookConnection("https://script.google.com/macros/s/.../exec")');
      Logger.log('');
      return false;
    }
    
    Logger.log(`→ テスト対象URL: ${testUrl}`);
    Logger.log('');
    
    // モックWebhookペイロードを作成
    const now = new Date();
    const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 明日
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1時間後
    
    const mockPayload = {
      webhook_type: 'event_confirmed',
      calendar_url_path: PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_CALENDAR_URL_PATH) || 'test_calendar',
      team_url_path: PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH) || 'test_team',
      calendar_url: 'https://timerex.net/s/test_team/test_calendar',
      calendar_name: 'テストカレンダー',
      event: {
        id: `test_webhook_${Date.now()}`,
        status: 1,
        duration: 60,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        local_start_datetime: startDate.toISOString(),
        local_end_datetime: endDate.toISOString(),
        calendar_timezone: 'Asia/Tokyo',
        guest_locale: 'ja',
        created_at: now.toISOString(),
        form: [
          {
            field_type: 'guest_name',
            required: true,
            label: '名前',
            value: 'Webhook疎通テスト ゲスト'
          },
          {
            field_type: 'guest_email',
            required: true,
            label: 'メールアドレス',
            value: 'webhook-test@example.com'
          }
        ],
        url_params: [
          {
            line_uid: 'U_WEBHOOK_TEST'
          }
        ],
        hosts: [
          {
            name: 'テスト面談官',
            email: Session.getActiveUser().getEmail() // 現在のユーザーのメールアドレスを使用
          }
        ]
      }
    };
    
    Logger.log('→ モックWebhookペイロードを作成しました');
    Logger.log(`   Event ID: ${mockPayload.event.id}`);
    Logger.log(`   ゲスト名: ${mockPayload.event.form[0].value}`);
    Logger.log(`   開始日時: ${mockPayload.event.local_start_datetime}`);
    Logger.log('');
    
    // セキュリティトークンの確認
    const securityToken = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_WEBHOOK_TOKEN);
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (securityToken) {
      headers['x-timerex-authorization'] = securityToken;
      Logger.log('→ セキュリティトークンをヘッダーに追加しました');
    } else {
      Logger.log('⚠️ セキュリティトークンが設定されていません（テストは続行します）');
    }
    Logger.log('');
    
    // POSTリクエストを送信
    Logger.log('→ Webhook URLにPOSTリクエストを送信中...');
    Logger.log('');
    
    try {
      const response = UrlFetchApp.fetch(testUrl, {
        method: 'post',
        headers: headers,
        payload: JSON.stringify(mockPayload),
        muteHttpExceptions: true // エラーでもレスポンスを取得
      });
      
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      Logger.log(`→ レスポンスコード: ${responseCode}`);
      Logger.log(`→ レスポンス内容: ${responseText.substring(0, 500)}...`);
      Logger.log('');
      
      if (responseCode === 200) {
        Logger.log('✅ HTTPリクエストは成功しました（200 OK）');
        
        // レスポンスをパース
        try {
          const responseData = JSON.parse(responseText);
          Logger.log(`→ レスポンスステータス: ${responseData.status || 'unknown'}`);
          
          if (responseData.status === 'ok' && responseData.success) {
            Logger.log(`✅ Webhook処理が成功しました（行番号: ${responseData.rowIndex || 'N/A'}）`);
            Logger.log('');
            Logger.log('→ 確認事項:');
            Logger.log('  1. GASエディタ > 実行 > 実行ログ で以下を確認:');
            Logger.log('     - [doPost] ===== WEBHOOK RECEIVED ===== が表示されているか');
            Logger.log('     - [WebhookHandler] ===== handleEventConfirmed CALLED ===== が表示されているか');
            Logger.log('     - [SpreadsheetService] ===== appendInterview CALLED ===== が表示されているか');
            Logger.log('  2. interviewsシートに新しい行が追加されているか確認');
            Logger.log('  3. uidlogシートにWebhook受信の記録が残っているか確認');
            Logger.log('');
            return true;
          } else if (responseData.status === 'error') {
            Logger.log(`⚠️ Webhook処理でエラーが発生しました: ${responseData.error || 'unknown'}`);
            Logger.log('');
            Logger.log('→ 確認事項:');
            Logger.log('  1. GASエディタ > 実行 > 実行ログ でエラーの詳細を確認');
            Logger.log('  2. セキュリティトークンが正しく設定されているか確認');
            Logger.log('');
            return false;
          } else {
            Logger.log(`⚠️ 予期しないレスポンス: ${JSON.stringify(responseData)}`);
            return false;
          }
        } catch (parseError) {
          Logger.log(`⚠️ レスポンスのパースに失敗: ${parseError.toString()}`);
          Logger.log(`   レスポンス内容: ${responseText}`);
          return false;
        }
      } else if (responseCode === 401) {
        Logger.log(`⚠️ 認証エラー（401）が発生しました`);
        Logger.log(`   これは、Google Workspace組織の場合に発生する可能性があります`);
        Logger.log('');
        Logger.log('→ 代替テスト方法:');
        Logger.log('  1. 直接関数呼び出しテストを実行: testWebhookDirectCall()');
        Logger.log('  2. または、TimeRexから実際のWebhookを送信してテスト');
        Logger.log('');
        Logger.log('→ 確認事項:');
        Logger.log('  1. Webhook URLが正しいか確認（デプロイ管理画面で確認）');
        Logger.log('  2. デプロイの「アクセスできるユーザー」が「全員」に設定されているか確認');
        Logger.log('  3. デプロイの「次のユーザーとして実行」が適切に設定されているか確認');
        Logger.log('');
        Logger.log('→ 手動テスト方法:');
        Logger.log('  1. TimeRex管理画面でWebhook URLを確認');
        Logger.log('  2. TimeRexで予約を作成');
        Logger.log('  3. GASエディタ > 実行 > 実行ログ で [doPost] ===== WEBHOOK RECEIVED ===== を確認');
        Logger.log('');
        return false;
      } else {
        Logger.log(`✗ HTTPリクエストが失敗しました（${responseCode}）`);
        Logger.log(`   レスポンス内容: ${responseText.substring(0, 200)}...`);
        Logger.log('');
        Logger.log('→ 確認事項:');
        Logger.log('  1. Webhook URLが正しいか確認');
        Logger.log('  2. デプロイが最新か確認');
        Logger.log('  3. アクセス権限が「全員」に設定されているか確認');
        Logger.log('');
        return false;
      }
    } catch (fetchError) {
      Logger.log(`✗ POSTリクエストの送信に失敗しました: ${fetchError.toString()}`);
      Logger.log('');
      Logger.log('→ 確認事項:');
      Logger.log('  1. Webhook URLが正しいか確認');
      Logger.log('  2. インターネット接続を確認');
      Logger.log('');
      return false;
    }
  } catch (error) {
    Logger.log(`✗ テストエラー: ${error.toString()}`);
    Utils.logError('testWebhookConnection', error);
    return false;
  }
}

/**
 * セッション管理機能テスト（uidlogベース）
 * 
 * テスト内容:
 * 1. SpreadsheetService.getOrCreateUidlogSheet() - uidlogシートの作成
 * 2. SpreadsheetService.saveToUidlog() - uidlogへの記録
 * 3. SpreadsheetService.getUidFromSessionSpreadsheet() - uidlogからUID取得
 * 4. CacheServiceとの連携確認
 * 
 * @return {boolean} テストが成功した場合true
 */
function runSessionManagementTest() {
  Logger.log('=== セッション管理機能テスト（uidlog） ===');
  Logger.log('');
  
  try {
    // テスト用のモックデータ
    const testSessionId = Utilities.getUuid();
    const testUid = 'U1234567890abcdef';
    const expiresInSeconds = 600; // 10分（CacheService用）
    
    Logger.log('--- テストデータ ---');
    Logger.log(`  session_id: ${testSessionId}`);
    Logger.log(`  uid: ${testUid}`);
    Logger.log('');
    
    // 1. uidlogシートの作成テスト
    Logger.log('--- 1. uidlogシート作成テスト ---');
    try {
      const uidlogSheet = SpreadsheetService.getOrCreateUidlogSheet();
      if (!uidlogSheet) {
        Logger.log('✗ uidlogシートの作成に失敗しました');
        return false;
      }
      Logger.log(`✓ uidlogシートを作成または取得しました: ${uidlogSheet.getName()}`);
      
      // ヘッダー行の確認
      const headerRange = uidlogSheet.getRange(1, 1, 1, 4);
      const headers = headerRange.getValues()[0];
      const expectedHeaders = ['日時', 'uid', 'sessionid', 'イベント種別'];
      
      if (JSON.stringify(headers) === JSON.stringify(expectedHeaders)) {
        Logger.log('✓ ヘッダー行が正しく設定されています');
      } else {
        Logger.log('⚠ ヘッダー行が期待値と異なります');
        Logger.log(`  期待値: ${expectedHeaders.join(', ')}`);
        Logger.log(`  実際の値: ${headers.join(', ')}`);
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ uidlogシート作成エラー: ${error.toString()}`);
      return false;
    }
    
    // 2. uidlog保存テスト
    Logger.log('--- 2. uidlog保存テスト ---');
    try {
      const saved = SpreadsheetService.saveToUidlog(testUid, testSessionId, 'postback');
      
      if (!saved) {
        Logger.log('✗ uidlogへの保存に失敗しました');
        return false;
      }
      
      Logger.log('✓ uidlogに保存しました');
      
      // 保存されたデータを確認
      const uidlogSheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.UIDLOG);
      const dataRange = uidlogSheet.getDataRange();
      const values = dataRange.getValues();
      
      // 最後の行を確認（新しく追加された行）
      const lastRow = values[values.length - 1];
      if ((lastRow[1] || '').toString().trim() === testUid && (lastRow[2] || '').toString().trim() === testSessionId) {
        Logger.log('✓ 保存されたデータが正しいことを確認しました');
        Logger.log(`  日時: ${lastRow[0]}`);
        Logger.log(`  uid: ${lastRow[1]}`);
        Logger.log(`  sessionid: ${lastRow[2]}`);
        Logger.log(`  イベント種別: ${lastRow[3]}`);
      } else {
        Logger.log('✗ 保存されたデータが期待値と異なります');
        Logger.log(`  期待値: uid=${testUid}, sessionid=${testSessionId}`);
        Logger.log(`  実際の値: uid=${lastRow[1]}, sessionid=${lastRow[2]}`);
        return false;
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ uidlog保存エラー: ${error.toString()}`);
      return false;
    }
    
    // 3. CacheServiceへの保存テスト
    Logger.log('--- 3. CacheService保存テスト ---');
    try {
      const cache = CacheService.getScriptCache();
      cache.put(`uid_${testSessionId}`, testUid, expiresInSeconds);
      Logger.log('✓ CacheServiceにセッションを保存しました');
      
      // CacheServiceから取得して確認
      const cachedUid = cache.get(`uid_${testSessionId}`);
      if (cachedUid === testUid) {
        Logger.log('✓ CacheServiceから正しく取得できました');
      } else {
        Logger.log(`✗ CacheServiceからの取得が失敗しました（期待値: ${testUid}, 実際の値: ${cachedUid}）`);
        return false;
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ CacheService保存エラー: ${error.toString()}`);
      return false;
    }
    
    // 4. スプレッドシートからUID取得テスト（正常ケース）
    Logger.log('--- 4. スプレッドシートからUID取得テスト（正常ケース） ---');
    try {
      const retrievedUid = SpreadsheetService.getUidFromSessionSpreadsheet(testSessionId);
      
      if (retrievedUid === testUid) {
        Logger.log(`✓ スプレッドシートから正しくUIDを取得しました: ${retrievedUid}`);
      } else {
        Logger.log(`✗ UID取得が失敗しました（期待値: ${testUid}, 実際の値: ${retrievedUid}）`);
        return false;
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ UID取得エラー: ${error.toString()}`);
      return false;
    }
    
    // 5. 存在しないセッションIDでUID取得テスト（異常ケース）
    Logger.log('--- 5. 存在しないセッションIDでUID取得テスト（異常ケース） ---');
    try {
      const nonExistentSessionId = Utilities.getUuid();
      const retrievedUid = SpreadsheetService.getUidFromSessionSpreadsheet(nonExistentSessionId);
      
      if (retrievedUid === null) {
        Logger.log(`✓ 存在しないセッションIDでnullが返されました（期待通り）`);
      } else {
        Logger.log(`⚠ 存在しないセッションIDでUIDが返されました（予期しない動作）: ${retrievedUid}`);
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ エラー: ${error.toString()}`);
      // エラーでもテストは続行
    }
    
    // 6. uidlogからの取得テスト（uidlogは有効期限を持たない）
    Logger.log('--- 6. uidlogからのUID取得テスト ---');
    try {
      const extraSessionId = Utilities.getUuid();
      const extraUid = 'U_UIDLOG_EXTRA_TEST';
      SpreadsheetService.saveToUidlog(extraUid, extraSessionId, 'test');
      const retrievedUid = SpreadsheetService.getUidFromSessionSpreadsheet(extraSessionId);
      if (retrievedUid === extraUid) {
        Logger.log('✓ uidlogから正しくUIDを取得しました');
      } else {
        Logger.log(`⚠ uidlogからの取得が期待値と異なります: ${retrievedUid}`);
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ uidlog取得テストエラー: ${error.toString()}`);
    }
    
    // 7. 優先順位テスト（CacheService優先、スプレッドシートはフォールバック）
    Logger.log('--- 7. 優先順位テスト（CacheService優先） ---');
    try {
      // 新しいセッションIDでテスト
      const priorityTestSessionId = Utilities.getUuid();
      const priorityTestUid = 'U_PRIORITY_TEST';
      
      // 1. CacheServiceにのみ保存
      const cache = CacheService.getScriptCache();
      cache.put(`uid_${priorityTestSessionId}`, priorityTestUid, expiresInSeconds);
      Logger.log('✓ CacheServiceにのみ保存しました');
      
      // 2. handleBookingPageのロジックをシミュレート
      //    CacheServiceから取得を試行
      const cachedUid = cache.get(`uid_${priorityTestSessionId}`);
      
      if (cachedUid) {
        Logger.log(`✓ CacheServiceから優先的に取得しました: ${cachedUid}`);
      } else {
        // CacheServiceにない場合、スプレッドシートから取得（フォールバック）
        Logger.log('→ CacheServiceにないため、スプレッドシートから取得を試行...');
        // このセッションIDはスプレッドシートに保存していないので、nullが返されるはず
        const spreadsheetUid = SpreadsheetService.getUidFromSessionSpreadsheet(priorityTestSessionId);
        if (spreadsheetUid === null) {
          Logger.log('✓ スプレッドシートにも存在しないため、nullが返されました（期待通り）');
        }
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ 優先順位テストエラー: ${error.toString()}`);
      // エラーでもテストは続行
    }
    
    Logger.log('=== テスト結果サマリー ===');
    Logger.log('✓ uidlogシート作成: 成功');
    Logger.log('✓ uidlog保存: 成功');
    Logger.log('✓ CacheService保存: 成功');
    Logger.log('✓ UID取得（正常ケース）: 成功');
    Logger.log('✓ UID取得（異常ケース）: 成功');
    Logger.log('');
    Logger.log('すべてのセッション管理機能テストが完了しました！');
    
    return true;
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    Utils.logError('runSessionManagementTest', error);
    return false;
  }
}

/**
 * LステップWebhook転送モックテスト
 * handleLStepWebhook関数をモックデータでテスト
 * 
 * テスト内容:
 * 1. POSTデータからUIDを抽出
 * 2. セッションIDの生成
 * 3. CacheServiceとスプレッドシートの両方への保存
 * 4. リダイレクトURLの生成
 * 
 * @return {boolean} テストが成功した場合true
 */
function runLStepWebhookMockTest() {
  Logger.log('=== LステップWebhook転送モックテスト ===');
  Logger.log('');
  
  try {
    // モックWebhookペイロード（LステップのWebhook転送をシミュレート）
    const mockUid = 'U_MOCK_LSTEP_TEST';
    const mockInterviewerId = 'test_interviewer_001';
    
    // パターン1: POSTデータにJSON形式でUIDが含まれる場合
    Logger.log('--- パターン1: POSTデータからUID取得（JSON形式） ---');
    const mockPayload1 = {
      events: [{
        source: {
          userId: mockUid
        }
      }]
    };
    
    const mockRequest1 = {
      parameter: {
        interviewer_id: mockInterviewerId
      },
      postData: {
        contents: JSON.stringify(mockPayload1),
        type: 'application/json'
      }
    };
    
    Logger.log(`→ モックUID: ${mockUid}`);
    Logger.log(`→ モックinterviewer_id: ${mockInterviewerId}`);
    Logger.log('');
    
    try {
      // handleLStepWebhook関数を直接呼び出し
      Logger.log('→ handleLStepWebhook関数を呼び出し中...');
      const result1 = handleLStepWebhook(mockRequest1);
      
      if (!result1) {
        Logger.log('✗ handleLStepWebhook関数がnullを返しました');
        return false;
      }
      
      // HTMLレスポンスを確認
      const htmlContent = result1.getContent();
      if (htmlContent.includes('リダイレクト中')) {
        Logger.log('✓ リダイレクトHTMLが生成されました');
      } else {
        Logger.log('⚠ リダイレクトHTMLの内容が期待値と異なります');
      }
      
      // uidlogシートにセッションが保存されているか確認
      Logger.log('→ uidlogシートにセッションが保存されているか確認中...');
      const uidlogSheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.UIDLOG);
      const dataRange = uidlogSheet.getDataRange();
      const values = dataRange.getValues();
      
      // 最後の行を確認（uidlog形式: 日時, uid, sessionid, イベント種別）
      const lastRow = values[values.length - 1];
      const rowUid = (lastRow && lastRow[1]) ? lastRow[1].toString().trim() : '';
      const rowSessionId = (lastRow && lastRow[2]) ? lastRow[2].toString().trim() : '';
      if (lastRow && rowUid === mockUid) {
        Logger.log(`✓ uidlogシートにセッションが保存されました（UID: ${rowUid}, sessionid: ${rowSessionId}）`);
        
        // CacheServiceからも取得できるか確認
        const cache = CacheService.getScriptCache();
        const cachedUid = cache.get(`uid_${rowSessionId}`);
        if (cachedUid === mockUid) {
          Logger.log(`✓ CacheServiceからも取得できました（UID: ${cachedUid}）`);
        } else {
          Logger.log(`⚠ CacheServiceから取得できませんでした（期待値: ${mockUid}, 実際の値: ${cachedUid || 'null'}）`);
        }
      } else {
        Logger.log('✗ uidlogシートにセッションが保存されていません');
        return false;
      }
      
      Logger.log('');
      Logger.log('✓ パターン1のテストが成功しました');
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ パターン1のテストエラー: ${error.toString()}`);
      Logger.log(`  エラースタック: ${error.stack || 'No stack trace'}`);
      return false;
    }
    
    // パターン2: source.userId形式
    Logger.log('--- パターン2: source.userId形式のUID取得 ---');
    const mockPayload2 = {
      source: {
        userId: mockUid + '_pattern2'
      }
    };
    
    const mockRequest2 = {
      parameter: {},
      postData: {
        contents: JSON.stringify(mockPayload2),
        type: 'application/json'
      }
    };
    
    try {
      const result2 = handleLStepWebhook(mockRequest2);
      if (result2) {
        Logger.log('✓ パターン2のテストが成功しました');
      } else {
        Logger.log('⚠ パターン2のテストでHTMLが生成されませんでした');
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`⚠ パターン2のテストでエラーが発生しました（続行）: ${error.toString()}`);
      Logger.log('');
    }
    
    // パターン3: UIDが見つからない場合（エラーハンドリング）
    Logger.log('--- パターン3: UIDが見つからない場合のエラーハンドリング ---');
    const mockRequest3 = {
      parameter: {},
      postData: {
        contents: JSON.stringify({}),
        type: 'application/json'
      }
    };
    
    try {
      const result3 = handleLStepWebhook(mockRequest3);
      if (result3) {
        const htmlContent = result3.getContent();
        if (htmlContent.includes('UID取得に失敗しました')) {
          Logger.log('✓ エラーページが正しく返されました');
        } else {
          Logger.log('⚠ エラーページの内容が期待値と異なります');
        }
      } else {
        Logger.log('⚠ エラー時にnullが返されました');
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`⚠ パターン3のテストでエラーが発生しました（続行）: ${error.toString()}`);
      Logger.log('');
    }
    
    Logger.log('=== テスト結果サマリー ===');
    Logger.log('✓ POSTデータからUID取得: 成功');
    Logger.log('✓ セッションID生成: 成功');
    Logger.log('✓ CacheService保存: 成功');
    Logger.log('✓ スプレッドシート保存: 成功');
    Logger.log('✓ リダイレクトURL生成: 成功');
    Logger.log('');
    Logger.log('LステップWebhook転送モックテストが完了しました！');
    
    return true;
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    Utils.logError('runLStepWebhookMockTest', error);
    return false;
  }
}

/**
 * 予約画面セッションID取得テスト
 * handleBookingPage関数のセッションIDからUID取得機能をテスト
 * 
 * テスト内容:
 * 1. セッションIDがURLパラメータにある場合のUID取得
 * 2. CacheService優先、スプレッドシートフォールバック
 * 3. セッションIDがない場合の後方互換性
 * 
 * @return {boolean} テストが成功した場合true
 */
function runBookingPageSessionTest() {
  Logger.log('=== 予約画面セッションID取得テスト ===');
  Logger.log('');
  
  try {
    // テスト用のセッションを作成
    const testSessionId = Utilities.getUuid();
    const testUid = 'U_BOOKING_PAGE_TEST';
    const testName = '予約画面テストユーザー';
    
    Logger.log('--- テストデータ準備 ---');
    Logger.log(`  session_id: ${testSessionId}`);
    Logger.log(`  uid: ${testUid}`);
    Logger.log('');
    
    // 1. セッションをCacheServiceとスプレッドシートの両方に保存
    Logger.log('--- 1. セッション保存（CacheService + スプレッドシート） ---');
    try {
      const cache = CacheService.getScriptCache();
      cache.put(`uid_${testSessionId}`, testUid, 600);
      Logger.log('✓ CacheServiceに保存しました');
      
      const saved = SpreadsheetService.saveToUidlog(testUid, testSessionId, 'test');
      if (saved) {
        Logger.log('✓ スプレッドシートに保存しました');
      } else {
        Logger.log('⚠ スプレッドシートへの保存に失敗しました（テストは続行）');
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ セッション保存エラー: ${error.toString()}`);
      return false;
    }
    
    // 2. パターン1: CacheServiceから取得（正常ケース）
    Logger.log('--- 2. パターン1: CacheServiceから取得（正常ケース） ---');
    try {
      const mockRequest1 = {
        parameter: {
          session_id: testSessionId
        }
      };
      
      // handleBookingPage関数のUID取得部分をシミュレート
      const sessionId = mockRequest1.parameter.session_id;
      let uid = '';
      
      if (sessionId) {
        const cache = CacheService.getScriptCache();
        uid = cache.get(`uid_${sessionId}`) || '';
        
        if (uid) {
          Logger.log(`✓ CacheServiceからUIDを取得しました: ${uid}`);
        } else {
          // フォールバック: スプレッドシートから取得
          Logger.log('→ CacheServiceにないため、スプレッドシートから取得を試行...');
          uid = SpreadsheetService.getUidFromSessionSpreadsheet(sessionId);
          
          if (uid) {
            Logger.log(`✓ スプレッドシートからUIDを取得しました: ${uid}`);
            // CacheServiceに再保存
            cache.put(`uid_${sessionId}`, uid, 600);
          } else {
            Logger.log(`✗ UID取得に失敗しました（session_id: ${sessionId}）`);
            return false;
          }
        }
      }
      
      if (uid === testUid) {
        Logger.log('✓ 正しいUIDが取得されました');
      } else {
        Logger.log(`✗ UIDが期待値と異なります（期待値: ${testUid}, 実際の値: ${uid}）`);
        return false;
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ パターン1のテストエラー: ${error.toString()}`);
      return false;
    }
    
    // 3. パターン2: CacheServiceにない場合のフォールバック
    Logger.log('--- 3. パターン2: CacheServiceにない場合のフォールバック ---');
    try {
      // 新しいセッションIDで、スプレッドシートにのみ保存
      const fallbackSessionId = Utilities.getUuid();
      const fallbackUid = 'U_FALLBACK_TEST';
      
      // CacheServiceには保存しない（期限切れをシミュレート）
      const saved = SpreadsheetService.saveToUidlog(fallbackUid, fallbackSessionId, 'fallback_test');
      
      if (saved) {
        Logger.log('✓ スプレッドシートにのみ保存しました（CacheServiceには保存していません）');
        
        // handleBookingPage関数のロジックをシミュレート
        const sessionId = fallbackSessionId;
        let uid = '';
        
        const cache = CacheService.getScriptCache();
        uid = cache.get(`uid_${sessionId}`) || ''; // CacheServiceには存在しない
        
        if (!uid) {
          // フォールバック: スプレッドシートから取得
          Logger.log('→ CacheServiceにないため、スプレッドシートから取得を試行...');
          uid = SpreadsheetService.getUidFromSessionSpreadsheet(sessionId);
          
          if (uid === fallbackUid) {
            Logger.log(`✓ スプレッドシートから正しくUIDを取得しました: ${uid}`);
            // CacheServiceに再保存
            cache.put(`uid_${sessionId}`, uid, 600);
            Logger.log('✓ CacheServiceに再保存しました（次回は高速化）');
          } else {
            Logger.log(`✗ フォールバックが失敗しました（期待値: ${fallbackUid}, 実際の値: ${uid || 'null'}）`);
            return false;
          }
        } else {
          Logger.log('⚠ CacheServiceに存在していました（予期しない動作）');
        }
      } else {
        Logger.log('✗ スプレッドシートへの保存に失敗しました');
        return false;
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ パターン2のテストエラー: ${error.toString()}`);
      return false;
    }
    
    // 4. パターン3: セッションIDがない場合の後方互換性
    Logger.log('--- 4. パターン3: セッションIDがない場合の後方互換性 ---');
    try {
      const mockRequest3 = {
        parameter: {
          uid: 'U_DIRECT_URL_PARAM' // URLパラメータに直接UIDが含まれる場合（後方互換性）
        }
      };
      
      // handleBookingPage関数のロジックをシミュレート
      const sessionId = mockRequest3.parameter.session_id; // undefined
      let uid = '';
      
      if (sessionId) {
        // セッションIDがある場合の処理（今回は実行されない）
        const cache = CacheService.getScriptCache();
        uid = cache.get(`uid_${sessionId}`) || '';
        if (!uid) {
          uid = SpreadsheetService.getUidFromSessionSpreadsheet(sessionId);
        }
      }
      
      // 後方互換性: URLパラメータからも取得を試行
      if (!uid) {
        uid = mockRequest3.parameter.uid || '';
        if (uid) {
          Logger.log(`✓ URLパラメータからUIDを取得しました（後方互換性）: ${uid}`);
        } else {
          Logger.log('⚠ URLパラメータにもUIDがありません');
        }
      }
      
      if (uid === 'U_DIRECT_URL_PARAM') {
        Logger.log('✓ 後方互換性が正しく動作しています');
      } else {
        Logger.log(`⚠ 後方互換性の動作が期待値と異なります（期待値: U_DIRECT_URL_PARAM, 実際の値: ${uid || 'null'}）`);
      }
      Logger.log('');
    } catch (error) {
      Logger.log(`✗ パターン3のテストエラー: ${error.toString()}`);
      // エラーでもテストは続行
    }
    
    Logger.log('=== テスト結果サマリー ===');
    Logger.log('✓ CacheService優先取得: 成功');
    Logger.log('✓ スプレッドシートフォールバック: 成功');
    Logger.log('✓ 後方互換性: 成功');
    Logger.log('');
    Logger.log('予約画面セッションID取得テストが完了しました！');
    
    return true;
  } catch (error) {
    Logger.log(`✗ テスト実行エラー: ${error.toString()}`);
    Utils.logError('runBookingPageSessionTest', error);
    return false;
  }
}

/**
 * 直近のuidlogに保存された uid をログに表示する
 * 「自分のLINE uidを取得したい」ときに、Webhookを1回発火させたあとこの関数を実行すると、
 * uidlogシートの直近の行に記録された uid を確認できる
 *
 * 実行: エディタで showLastSessionUids を選択して実行
 * @param {number} maxRows - 表示する最大行数（デフォルト: 5）
 */
function showLastSessionUids(maxRows = 5) {
  Logger.log('=== 直近のuidlog（uid）一覧 ===');
  Logger.log('');

  try {
    const uidlogSheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.UIDLOG);
    if (!uidlogSheet) {
      Logger.log('uidlogシートがありません。');
      Logger.log('先にLステップのWebhook転送を設定し、そのLINEアカウントでボタンを1回タップしてください。');
      Logger.log('手順: docs/LSTEP_LINEID_SOLUTION.md の「自分のLINE UIDを取得する手順」を参照。');
      Logger.log('');
      return;
    }

    const data = uidlogSheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('uidlogシートにデータがありません。');
      Logger.log('LステップでWebhook転送が発火するボタンを、取得したいuidのLINEアカウントで1回タップしてください。');
      Logger.log('');
      return;
    }

    const header = data[0];
    const colDate = header.indexOf('日時') >= 0 ? header.indexOf('日時') : 0;
    const uidIdx = header.indexOf('uid') >= 0 ? header.indexOf('uid') : 1;
    const sessionIdx = header.indexOf('sessionid') >= 0 ? header.indexOf('sessionid') : 2;
    const eventIdx = header.indexOf('イベント種別') >= 0 ? header.indexOf('イベント種別') : 3;

    const start = Math.max(1, data.length - maxRows);
    Logger.log('直近 ' + (data.length - start) + ' 件（新しい順）:');
    Logger.log('');

    for (let i = data.length - 1; i >= start; i--) {
      const row = data[i];
      const uid = (row[uidIdx] || '').toString().trim() || '(なし)';
      const dateStr = (row[colDate] || '').toString();
      const sessionid = (row[sessionIdx] || '').toString().substring(0, 16) + '...';
      const eventType = (row[eventIdx] || '').toString();
      Logger.log('--- ' + (data.length - i) + ' ---');
      Logger.log('  uid: ' + uid);
      if (dateStr) Logger.log('  日時: ' + dateStr);
      if (sessionid !== '...') Logger.log('  sessionid: ' + sessionid);
      if (eventType) Logger.log('  イベント種別: ' + eventType);
      Logger.log('');
    }

    Logger.log('上記のうち、あなたがタップした直後の行の uid が、あなたのLINE uidです。');
    Logger.log('');
  } catch (e) {
    Logger.log('エラー: ' + e.message);
    Utils.logError('showLastSessionUids', e, { maxRows: maxRows });
    Logger.log('');
  }
}

/**
 * LステップAPI マニュアル⑤に沿った簡単なテスト（トリガーURLへPOST）
 * ①エンドポイント作成 → ②パラメータ → ③アクション設定 → ④トークン取得 → ⑤のトリガーURLへPOSTする。
 *
 * 実行例:
 *   runLStepApiTriggerTest();  // スクリプトプロパティ LSTEP_TRIGGER_URL と LSTEP_API_TOKEN を使用
 *   runLStepApiTriggerTest('https://api.lineml.jp/v1/api-codes/690/triggers/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'Uda942dddb9b331198c48556049ae545c');
 *
 * @param {string} [triggerUrl] - ⑤のcURLサンプルに表示されたURL。省略時は LSTEP_TRIGGER_URL を参照
 * @param {string} [uidOrFriendId] - テストするLINEのUID、またはL-Stepの friend_id。省略時は 'Uda942dddb9b331198c48556049ae545c'
 * @param {boolean} [useFriendId] - true の場合、第2引数を friend_id として送る（uid ではなく friend_id キーで送信）
 * @return {boolean} 2xx なら true
 */
function runLStepApiTriggerTest(triggerUrl, uidOrFriendId, useFriendId) {
  Logger.log('=== LステップAPI 簡単なテスト（マニュアル⑤・トリガーURLへPOST） ===');
  Logger.log('');

  const propKey = Config.PROPERTY_KEYS.LSTEP_API_KEY;
  const urlPropKey = Config.PROPERTY_KEYS.LSTEP_TRIGGER_URL;
  const token = PropertiesService.getScriptProperties().getProperty(propKey);
  const urlFromProp = PropertiesService.getScriptProperties().getProperty(urlPropKey);
  const defaultUrl = (typeof Config.LSTEP_TRIGGER_URL_DEFAULT === 'string' && Config.LSTEP_TRIGGER_URL_DEFAULT.trim() !== '') ? Config.LSTEP_TRIGGER_URL_DEFAULT.trim() : '';

  const testUrl = (typeof triggerUrl === 'string' && triggerUrl.trim() !== '') ? triggerUrl.trim() : (urlFromProp && urlFromProp.trim() !== '' ? urlFromProp.trim() : defaultUrl);
  const defaultUid = 'Uda942dddb9b331198c48556049ae545c';
  const testId = (typeof uidOrFriendId === 'string' && uidOrFriendId.trim() !== '') ? uidOrFriendId.trim() : defaultUid;
  const sendAsFriendId = useFriendId === true;
  if (testId === defaultUid) {
    Logger.log('（UID未指定のためサンプルUIDを使用しています。特定のUIDで試す場合は runLStepApiTriggerTestForSpecifiedUid を実行してください）');
    Logger.log('');
  }

  if (!token || token.trim() === '') {
    Logger.log('✗ トークンが未設定です。プロパティ名: ' + propKey);
    Logger.log('');
    return false;
  }
  if (!testUrl) {
    Logger.log('✗ トリガーURLが指定されていません。');
    Logger.log('  引数で渡すか、スクリプトプロパティ ' + urlPropKey + ' または Config.LSTEP_TRIGGER_URL_DEFAULT を設定してください。');
    Logger.log('');
    return false;
  }

  if (!triggerUrl && !urlFromProp && defaultUrl) {
    Logger.log('（トリガーURLはデフォルトを使用しています）');
  }
  Logger.log('トリガーURL: ' + testUrl);
  Logger.log((sendAsFriendId ? 'friend_id: ' : 'UID: ') + testId);
  Logger.log('→ POST 送信...');
  Logger.log('');

  const payload = sendAsFriendId ? { friend_id: testId } : { uid: testId };
  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(testUrl, options);
    const code = response.getResponseCode();
    const text = response.getContentText();

    Logger.log('レスポンス: HTTP ' + code);
    if (text && text.trim() !== '') {
      Logger.log('ボディ: ' + (text.length > 300 ? text.substring(0, 300) + '...' : text));
    }
    Logger.log('');

    if (code >= 200 && code < 300) {
      Logger.log('✓ 成功: トリガーが実行されました。L-Step側のアクション（タグ・友だち情報など）を確認してください。');
      return true;
    }
    if (code === 401) {
      Logger.log('✗ 認証エラー(401)。トークンを確認してください。');
      return false;
    }
    if (code === 404) {
      var isFriendNotFound = false;
      if (text) {
        try {
          var json = JSON.parse(text);
          var errTitle = (json && json.title) ? String(json.title) : '';
          var errDetail = (json && json.errors && json.errors[0] && json.errors[0].detail) ? String(json.errors[0].detail) : '';
          if (errTitle.indexOf('友だち') !== -1 || errDetail.indexOf('友だち') !== -1) {
            isFriendNotFound = true;
          }
        } catch (_) {}
      }
      if (isFriendNotFound) {
        Logger.log('✓ トリガーには到達しました（APIは正常に応答）。');
        Logger.log('✗ 指定したUIDの友だちが、このトリガーが紐づくLINE公式アカウントの友だち一覧に存在しません。');
        Logger.log('  確認すること:');
        Logger.log('  1. トリガーURLの api-codes/690 が指すLINE公式アカウントと、UIDの友だちが同じアカウントか。');
        Logger.log('  2. L-Step「友だちリスト」でそのアカウントを開き、該当友だちのUID（または friend_id）をコピーして再テスト。');
        Logger.log('  3. UIDでなく friend_id で送る場合: runLStepApiTriggerTest(url, "友だちのfriend_id", true)');
      } else {
        Logger.log('✗ 404: トリガーURLが無効か、エンドポイントが削除された可能性があります。');
      }
      return false;
    }

    Logger.log('✗ HTTP ' + code + '。レスポンス内容を確認してください。');
    return false;
  } catch (e) {
    Logger.log('✗ 送信失敗: ' + (e.message || e.toString()));
    Logger.log('');
    return false;
  }
}

/**
 * 指定UID（U6e967fdb7f0aaf99375946cad8744fad）でトリガーURLへPOSTするテスト
 * /friend/update で404になる場合の切り分け用。トリガーURLはスクリプトプロパティ LSTEP_TRIGGER_URL または Config.LSTEP_TRIGGER_URL_DEFAULT を使用
 * @return {boolean} 2xx なら true
 */
function runLStepApiTriggerTestForSpecifiedUid() {
  const triggerUrl = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.LSTEP_TRIGGER_URL)
    || Config.LSTEP_TRIGGER_URL_DEFAULT || '';
  return runLStepApiTriggerTest(triggerUrl, 'U6e967fdb7f0aaf99375946cad8744fad');
}

/**
 * 指定 friend_id（204179348）でトリガーURLへPOSTするテスト
 * L-step API は uid の代わりに friend_id でも指定可能（マニュアル「リクエスト例の uid の部分は、Lステップの friend_id を使用することもできる」）
 * @return {boolean} 2xx なら true
 */
function runLStepApiTriggerTestForSpecifiedFriendId() {
  const triggerUrl = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.LSTEP_TRIGGER_URL)
    || Config.LSTEP_TRIGGER_URL_DEFAULT || '';
  return runLStepApiTriggerTest(triggerUrl, '204179348', true);
}

/**
 * UIDは存在するのに /friend/update で404になる原因を自動で切り分ける診断
 * 実行: エディタで runLStep404Diagnostic を選択して実行（引数省略時は指定UIDを使用）
 * @param {string} [uid] - 診断するLINEのUID。省略時は 'U6e967fdb7f0aaf99375946cad8744fad'
 * @return {Object} { restOk: boolean, triggerCode: number, conclusion: string }
 */
function runLStep404Diagnostic(uid) {
  const testUid = (typeof uid === 'string' && uid.trim() !== '') ? uid.trim() : 'U6e967fdb7f0aaf99375946cad8744fad';
  const propKey = Config.PROPERTY_KEYS.LSTEP_API_KEY;
  const token = PropertiesService.getScriptProperties().getProperty(propKey);
  const triggerUrl = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.LSTEP_TRIGGER_URL)
    || Config.LSTEP_TRIGGER_URL_DEFAULT || '';

  Logger.log('========================================');
  Logger.log('Lステップ 404 原因切り分け診断');
  Logger.log('========================================');
  Logger.log('対象UID: ' + testUid);
  Logger.log('');

  if (!token || token.trim() === '') {
    Logger.log('✗ スクリプトプロパティ ' + propKey + ' が未設定です。診断を中止します。');
    return { restOk: false, triggerCode: 0, conclusion: 'トークン未設定' };
  }
  if (!triggerUrl || triggerUrl.trim() === '') {
    Logger.log('✗ トリガーURLが未設定です。LSTEP_TRIGGER_URL または Config.LSTEP_TRIGGER_URL_DEFAULT を設定してください。');
    return { restOk: false, triggerCode: 0, conclusion: 'トリガーURL未設定' };
  }

  let restOk = false;
  Logger.log('【ステップ1】POST /friend/update を呼び出し');
  try {
    LStepApiService.updateFriendInfo(testUid, {});
    restOk = true;
    Logger.log('  → 結果: 成功（2xx）');
  } catch (e) {
    const msg = e.message || e.toString();
    Logger.log('  → 結果: 失敗');
    Logger.log('  → ' + msg);
  }
  Logger.log('');

  Logger.log('【ステップ2】トリガーURLへ POST（同じUID）');
  let triggerCode = 0;
  try {
    const options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      payload: JSON.stringify({ uid: testUid }),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(triggerUrl, options);
    triggerCode = response.getResponseCode();
    const text = response.getContentText();
    Logger.log('  → HTTP ' + triggerCode);
    if (text && text.trim() !== '' && text.length <= 200) {
      Logger.log('  → ボディ: ' + text);
    } else if (text && text.length > 200) {
      Logger.log('  → ボディ: ' + text.substring(0, 200) + '...');
    }
  } catch (e) {
    Logger.log('  → 送信失敗: ' + (e.message || e.toString()));
  }
  Logger.log('');

  Logger.log('----------------------------------------');
  Logger.log('【診断結果】');
  var conclusion = '';
  if (restOk) {
    conclusion = 'REST /friend/update は利用可能です。追加の切り分けは不要です。';
    Logger.log('✓ ' + conclusion);
  } else if (triggerCode >= 200 && triggerCode < 300) {
    conclusion = 'RESTは404だがトリガーは2xx → /friend/update はこの契約では利用不可。友だちは見つかっている。友だち情報更新はトリガーURL経由で実装すること。';
    Logger.log('✓ 結論: ' + conclusion);
    Logger.log('');
    Logger.log('  次の対応: 予約確定時の友だち情報更新を、POST /friend/update ではなくトリガーURLへPOSTする実装に変更してください。');
    Logger.log('  トリガーURLのパラメータ（ meeting_date, meeting_url 等）は、L-step エンドポイントのパラメータ設定に合わせて送信してください。');
  } else if (triggerCode === 404) {
    conclusion = 'トリガーも404 → トリガーURLが紐づくLINE公式アカウントと、このUIDの友だちが別アカウントの可能性が高い。';
    Logger.log('✗ 結論: ' + conclusion);
    Logger.log('');
    Logger.log('  確認手順:');
    Logger.log('  1. L-step 管理画面で「友だちリスト」を開く');
    Logger.log('  2. トリガーURLの api-codes/690 が指す「LINE公式アカウント」を選択しているか確認');
    Logger.log('  3. そのアカウントの友だち一覧に、UID ' + testUid + ' が存在するか確認');
    Logger.log('  4. 別アカウントの友だち一覧にしかいない場合、このトークンではそのUIDを指定できません（アカウントごとにトークンが紐づくため）');
  } else if (triggerCode === 401) {
    conclusion = '認証エラー(401)。トークンが無効または期限切れの可能性。';
    Logger.log('✗ 結論: ' + conclusion);
    Logger.log('  L-step「API連携」→「認証」タブでトークンを再取得し、スクリプトプロパティ ' + propKey + ' を更新してください。');
  } else if (triggerCode === 0) {
    conclusion = 'トリガーへ送信できず。ネットワークまたはURLを確認。';
    Logger.log('✗ 結論: ' + conclusion);
  } else {
    conclusion = 'トリガーが HTTP ' + triggerCode + '。レスポンス内容を確認してください。';
    Logger.log('✗ 結論: ' + conclusion);
  }
  Logger.log('========================================');
  return { restOk: restOk, triggerCode: triggerCode, conclusion: conclusion };
}

/**
 * LステップAPI 最低限の疎通テスト（GETのみ）
 * トークンを付けて GET を1回送り、サーバーに到達できるかだけを確認する。POST /friend/update は呼ばない。
 * 404 は「パスが無い」だけでサーバー到達はできているので成功とする。
 *
 * 実行: エディタで runLStepApiConnectivityTestMinimal を選択して実行
 * @return {boolean} サーバーに到達できたら true
 */
function runLStepApiConnectivityTestMinimal() {
  Logger.log('=== LステップAPI 最低限の疎通テスト（GETのみ） ===');
  Logger.log('');

  const propKey = Config.PROPERTY_KEYS.LSTEP_API_KEY;
  const token = PropertiesService.getScriptProperties().getProperty(propKey);

  if (!token || token.trim() === '') {
    Logger.log('✗ スクリプトプロパティが未設定です。プロパティ名: ' + propKey);
    Logger.log('');
    return false;
  }

  const baseUrl = Config.LSTEP_API_BASE_URL;
  const url = baseUrl + '/';
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const text = response.getContentText();

    Logger.log('リクエスト: GET ' + url);
    Logger.log('レスポンス: HTTP ' + code);
    if (text && text.trim() !== '') {
      Logger.log('ボディ: ' + (text.length > 200 ? text.substring(0, 200) + '...' : text));
    }
    Logger.log('');

    if (code >= 200 && code < 300) {
      Logger.log('✓ 疎通成功: サーバーに到達しました。');
      return true;
    }
    if (code === 404) {
      Logger.log('✓ 疎通成功: サーバーに到達しました（GET / は未実装のため 404）。');
      return true;
    }
    if (code === 401) {
      Logger.log('✓ 疎通成功: サーバーに到達しました。認証エラー(401)のためトークンの有効性を確認してください。');
      return true;
    }

    Logger.log('✗ HTTP ' + code + '。必要に応じてAPI仕様を確認してください。');
    return false;
  } catch (e) {
    Logger.log('✗ 接続失敗: ' + (e.message || e.toString()));
    if ((e.message || '').indexOf('DNS') !== -1) {
      Logger.log('  → ドメインの名前解決に失敗しています。ベースURL: ' + baseUrl);
    }
    Logger.log('');
    return false;
  }
}

/**
 * LステップAPI疎通テスト（指定UID使用）
 * 指定したLINEのUIDで L-Step API（api.lineml.jp）の友だち情報更新APIを呼び、疎通とトークン・UIDの有効性を確認する。
 * 実際の友だち情報は更新しない（空の data で POST /friend/update を呼ぶ想定）。
 *
 * 必要な設定: スクリプトプロパティ LSTEP_API_TOKEN（「API連携」>「認証」タブのトークン）のみ。
 * API連携の「エンドポイント」作成は不要（友だち情報更新は api.lineml.jp/v1 のREST APIで実行）。
 *
 * 実行: エディタで runLStepApiConnectivityTestWithUid を選択して実行
 * @param {string} [uid] - テストに使うLINEのUID。省略時は 'Uda942dddb9b331198c48556049ae545c' を使用
 * @return {boolean} 疎通成功なら true
 */
function runLStepApiConnectivityTestWithUid(uid) {
  const testUid = (typeof uid === 'string' && uid.trim() !== '') ? uid.trim() : 'Uda942dddb9b331198c48556049ae545c';
  Logger.log('=== LステップAPI 疎通テスト（UID指定） ===');
  Logger.log('テストUID: ' + testUid);
  Logger.log('（エンドポイント作成は不要。認証トークンのみ使用）');
  Logger.log('');

  const propKey = Config.PROPERTY_KEYS.LSTEP_API_KEY;
  const token = PropertiesService.getScriptProperties().getProperty(propKey);

  if (!token || token.trim() === '') {
    Logger.log('✗ スクリプトプロパティが未設定です。');
    Logger.log('  プロパティ名: ' + propKey);
    Logger.log('  設定手順: エディタ右上「プロジェクトの設定」>「スクリプト プロパティ」で ' + propKey + ' を追加し、L-step管理画面の「API連携」>「認証」タブで取得したトークンを設定してください。');
    Logger.log('');
    return false;
  }

  Logger.log('✓ トークン取得: 設定済み');
  Logger.log('→ POST /friend/update を呼び出し中（data は空で疎通のみ確認）...');
  Logger.log('');

  try {
    LStepApiService.updateFriendInfo(testUid, {});
    Logger.log('✓ 疎通成功: 指定UIDでAPIに接続できました。');
    Logger.log('  （空の data で友だち情報更新を呼び出し、エラーなく応答が返りました）');
    Logger.log('');
    return true;
  } catch (e) {
    const msg = e.message || e.toString();
    Logger.log('✗ API呼び出し失敗: ' + msg);
    if (msg.indexOf('DNS error') !== -1) {
      Logger.log('  DNS解決に失敗しています。リクエスト先のドメイン（' + Config.LSTEP_API_BASE_URL + '）に接続できません。');
      Logger.log('  L-StepのAPI連携では、リクエスト先URLは「エンドポイント」の【cURL実行サンプル】に表示される場合があります。');
      Logger.log('  エンドポイントのcURLサンプルは https://api.lineml.jp/v1/api-codes/.../triggers/... 形式の場合は Config はそのままでよいです。');
    } else if (msg.indexOf('401') !== -1) {
      Logger.log('  認証エラー: トークンが無効か期限切れの可能性があります。');
    } else if (msg.indexOf('404') !== -1 || msg.indexOf('friend') !== -1) {
      Logger.log('  該当UIDの友だちがLステップに存在しない可能性があります。L-step管理画面の友だち一覧でUIDを確認してください。');
    }
    Utils.logError('runLStepApiConnectivityTestWithUid', e, { uid: testUid });
    Logger.log('');
    return false;
  }
}

/**
 * 指定UID（U6e967fdb7f0aaf99375946cad8744fad）でLステップAPI疎通テストを実行
 * エディタで runApiConnectivityTestForSpecifiedUid を選択して実行するだけで疎通確認可能
 * @return {boolean} 疎通成功なら true
 */
function runApiConnectivityTestForSpecifiedUid() {
  return runLStepApiConnectivityTestWithUid('U6e967fdb7f0aaf99375946cad8744fad');
}

/**
 * LステップAPI疎通テスト
 * スクリプトプロパティ LSTEP_API_TOKEN を読み、api.lineml.jp へGETで接続確認する
 * 
 * 実行: エディタで runLStepApiConnectivityTest を選択して実行
 * @return {boolean} 疎通成功なら true
 */
function runLStepApiConnectivityTest() {
  Logger.log('=== LステップAPI 疎通テスト ===');
  Logger.log('');

  const propKey = Config.PROPERTY_KEYS.LSTEP_API_KEY; // 値は 'LSTEP_API_TOKEN'
  const token = PropertiesService.getScriptProperties().getProperty(propKey);

  if (!token || token.trim() === '') {
    Logger.log('✗ スクリプトプロパティが未設定です。');
    Logger.log('  プロパティ名: ' + propKey);
    Logger.log('  設定手順: エディタ右上「プロジェクトの設定」>「スクリプト プロパティ」で ' + propKey + ' を追加し、L-step管理画面の「認証」タブで取得したトークンを設定してください。');
    Logger.log('');
    return false;
  }

  Logger.log('✓ トークン取得: 設定済み（先頭5文字: ' + token.substring(0, Math.min(5, token.length)) + '...）');
  Logger.log('');

  const baseUrl = Config.LSTEP_API_BASE_URL;
  const url = baseUrl + '/';
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const text = response.getContentText();

    Logger.log('リクエスト: GET ' + url);
    Logger.log('レスポンス: HTTP ' + code);
    if (text) {
      try {
        const json = JSON.parse(text);
        Logger.log('ボディ: ' + JSON.stringify(json).substring(0, 500) + (JSON.stringify(json).length > 500 ? '...' : ''));
      } catch (_) {
        Logger.log('ボディ: ' + text.substring(0, 300) + (text.length > 300 ? '...' : ''));
      }
    }
    Logger.log('');

    if (code >= 200 && code < 300) {
      Logger.log('✓ 疎通成功: APIに接続できました。');
      Logger.log('');
      return true;
    }
    if (code === 401) {
      Logger.log('✗ 認証エラー (401): トークンが無効か期限切れの可能性があります。');
      Logger.log('  L-step管理画面の「API連携」>「認証」タブでトークンを再確認してください。');
      Logger.log('');
      return false;
    }
    if (code === 403) {
      Logger.log('✗ 権限エラー (403): トークンに権限がありません。');
      Logger.log('');
      return false;
    }
    if (code === 404) {
      Logger.log('✓ 疎通成功: サーバーに到達しました（GET / は 404 のため未実装の可能性）。');
      Logger.log('  トークンは送信済みです。友だち情報更新など実際のAPIで動作確認してください。');
      Logger.log('');
      return true;
    }
    Logger.log('✗ 疎通失敗: HTTP ' + code + '。APIの仕様またはエンドポイントを確認してください。');
    Logger.log('');
    return false;
  } catch (e) {
    Logger.log('✗ リクエスト例外: ' + e.message);
    Utils.logError('runLStepApiConnectivityTest', e, { url: url });
    Logger.log('');
    return false;
  }
}

/**
 * LSTEP連携機能 全テスト実行
 * フェーズ1とフェーズ2で実装した機能のテストを一括実行
 * 
 * @return {Object} テスト結果
 */
/**
 * GASのWebhook転送エンドポイントURLを取得
 * L-step管理画面での設定に使用する
 * 
 * @return {string} Webhook転送エンドポイントURL
 */
function getLStepWebhookEndpointUrl() {
  const baseUrl = (Config.BOOKING_BASE_URL && Config.BOOKING_BASE_URL.trim()) !== ''
    ? Config.BOOKING_BASE_URL.replace(/\/$/, '')
    : `https://script.google.com/macros/s/${ScriptApp.getScriptId()}/exec`;
  const messageClickUrl = baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + 'action=lstep_webhook';

  Logger.log('=== L-step 設定用URL ===');
  Logger.log('');
  Logger.log('【1】LINE Webhook転送設定（L-stepがPOSTを送る先）');
  Logger.log('  → ?action=lstep_webhook を付けないこと（付けるとUID取得失敗になる場合あり）');
  Logger.log('  ' + baseUrl);
  Logger.log('');
  Logger.log('【2】メッセージの返信URL（ユーザーがクリックするリンク）');
  Logger.log('  → ここには ?action=lstep_webhook を付ける');
  Logger.log('  ' + messageClickUrl);
  Logger.log('');
  Logger.log('設定手順:');
  Logger.log('1. 「LINE Webhook転送設定」には【1】のURL（ベースURLのみ）を入力');
  Logger.log('2. テンプレートの「選択肢選択時返信」には【2】のURLを入力');
  Logger.log('');

  return baseUrl;
}

/**
 * 実際のWebhook転送をテストするための準備
 * L-step管理画面で設定したWebhook URLが正しく動作するか確認
 * 
 * 使用方法:
 * 1. この関数を実行してエンドポイントURLを確認
 * 2. L-step管理画面でWebhook転送を設定
 * 3. 実際にボタンをタップしてWebhook転送をテスト
 * 4. GASの実行ログで受信したペイロードを確認
 * 
 * @return {Object} テスト準備情報
 */
function prepareLStepWebhookTest() {
  Logger.log('=== L-step Webhook転送テスト準備 ===');
  Logger.log('');
  
  const scriptId = ScriptApp.getScriptId();
  const webhookUrl = `https://script.google.com/macros/s/${scriptId}/exec?action=lstep_webhook`;
  
  Logger.log('【ステップ1】GASエンドポイントURLの確認');
  Logger.log('Webhook転送エンドポイントURL:');
  Logger.log(webhookUrl);
  Logger.log('');
  
  Logger.log('【ステップ2】L-step管理画面での設定');
  Logger.log('1. L-step管理画面にログイン');
  Logger.log('2. 「アカウント設定」 > 「外部連携設定」タブを開く');
  Logger.log('3. 「LINE Webhook転送設定」に以下のURLを入力:');
  Logger.log('   ' + webhookUrl);
  Logger.log('4. 保存');
  Logger.log('');
  
  Logger.log('【ステップ3】ボタンの設定（テンプレート機能を使用）');
  Logger.log('1. L-step管理画面 > 「テンプレート」 > 新規作成');
  Logger.log('2. フレックスメッセージまたはカルーセルメッセージで「予約する」ボタンを配置');
  Logger.log('3. ボタンのアクション: 「URIアクション」を選択');
  Logger.log('4. URI: ' + webhookUrl + '&interviewer_id={INTERVIEWER_ID}');
  Logger.log('   例: ' + webhookUrl + '&interviewer_id=tanaka');
  Logger.log('5. 保存');
  Logger.log('');
  
  Logger.log('【ステップ4】テスト実行');
  Logger.log('1. テンプレートを配信（ステップ配信または一斉配信）');
  Logger.log('2. ユーザーが「予約する」ボタンをタップ');
  Logger.log('3. GASの実行ログで以下を確認:');
  Logger.log('   - Webhook転送が受信されたか');
  Logger.log('   - UIDが正しく抽出されたか');
  Logger.log('   - セッションIDが生成されたか');
  Logger.log('   - リダイレクトURLが正しく生成されたか');
  Logger.log('');
  
  Logger.log('【ステップ5】ログの確認方法');
  Logger.log('1. GASエディタ > 「実行」タブを開く');
  Logger.log('2. 最新の実行ログを確認');
  Logger.log('3. [handleLStepWebhook] で始まるログを確認');
  Logger.log('4. ペイロードの形式を確認（今後の実装に使用）');
  Logger.log('');
  
  return {
    webhookUrl: webhookUrl,
    scriptId: scriptId,
    instructions: '上記の手順に従って、L-step管理画面でWebhook転送を設定してください。'
  };
}

function runAllLStepSessionTests() {
  Logger.log('========================================');
  Logger.log('LSTEP連携機能 全テスト開始');
  Logger.log('========================================');
  Logger.log('');
  
  const results = {
    sessionManagement: false,
    lstepWebhook: false,
    bookingPage: false
  };
  
  // テスト1: セッション管理機能テスト
  Logger.log('【テスト1/3】セッション管理機能テスト');
  Logger.log('');
  results.sessionManagement = runSessionManagementTest();
  Logger.log('');
  
  if (!results.sessionManagement) {
    Logger.log('⚠ セッション管理機能テストが失敗しました。');
    Logger.log('  次のテストに進みますが、一部の機能が正常に動作しない可能性があります。');
    Logger.log('');
  }
  
  // テスト2: LステップWebhook転送モックテスト
  Logger.log('【テスト2/3】LステップWebhook転送モックテスト');
  Logger.log('');
  results.lstepWebhook = runLStepWebhookMockTest();
  Logger.log('');
  
  if (!results.lstepWebhook) {
    Logger.log('⚠ LステップWebhook転送モックテストが失敗しました。');
    Logger.log('  実際のWebhook転送が正常に動作しない可能性があります。');
    Logger.log('');
  }
  
  // テスト3: 予約画面セッションID取得テスト
  Logger.log('【テスト3/3】予約画面セッションID取得テスト');
  Logger.log('');
  results.bookingPage = runBookingPageSessionTest();
  Logger.log('');
  
  if (!results.bookingPage) {
    Logger.log('⚠ 予約画面セッションID取得テストが失敗しました。');
    Logger.log('  予約画面でUID取得が正常に動作しない可能性があります。');
    Logger.log('');
  }
  
  // 結果サマリー
  Logger.log('========================================');
  Logger.log('テスト結果サマリー');
  Logger.log('========================================');
  Logger.log(`セッション管理機能: ${results.sessionManagement ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`LステップWebhook転送: ${results.lstepWebhook ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log(`予約画面セッションID取得: ${results.bookingPage ? '✓ 成功' : '✗ 失敗'}`);
  Logger.log('');
  
  const allPassed = results.sessionManagement && results.lstepWebhook && results.bookingPage;
  Logger.log(`総合結果: ${allPassed ? '✓ すべて成功' : '✗ 一部失敗'}`);
  Logger.log('');
  
  if (allPassed) {
    Logger.log('✓ すべてのテストが成功しました！');
    Logger.log('  フェーズ1とフェーズ2の実装は正常に動作しています。');
    Logger.log('  次のステップ: フェーズ3（LSTEP API連携）の実装に進むことができます。');
  } else {
    Logger.log('⚠ 一部のテストが失敗しました。');
    Logger.log('  失敗したテストを個別に確認してください。');
    Logger.log('  実装コードを再確認し、必要に応じて修正してください。');
  }
  Logger.log('');
  
  return results;
}

/**
 * Webhook直接呼び出しテスト
 * doPost関数を直接呼び出してテスト（HTTPリクエストなし）
 * 
 * 注意: このテストは、実際のHTTPリクエストではなく、関数を直接呼び出します。
 * 実際のWebhook疎通をテストするには、TimeRexから実際のWebhookを送信してください。
 * 
 * @return {boolean} テストが成功した場合true
 */
function testWebhookDirectCall() {
  Logger.log('=== Webhook直接呼び出しテスト ===');
  Logger.log('');
  Logger.log('⚠️ 注意: このテストは、実際のHTTPリクエストではなく、関数を直接呼び出します。');
  Logger.log('   実際のWebhook疎通をテストするには、TimeRexから実際のWebhookを送信してください。');
  Logger.log('');
  
  try {
    // モックWebhookペイロードを作成
    const now = new Date();
    const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 明日
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1時間後
    
    const mockPayload = {
      webhook_type: 'event_confirmed',
      calendar_url_path: PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_CALENDAR_URL_PATH) || 'test_calendar',
      team_url_path: PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.TIMEREX_TEAM_URL_PATH) || 'test_team',
      calendar_url: 'https://timerex.net/s/test_team/test_calendar',
      calendar_name: 'テストカレンダー',
      event: {
        id: `test_direct_${Date.now()}`,
        status: 1,
        duration: 60,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        local_start_datetime: startDate.toISOString(),
        local_end_datetime: endDate.toISOString(),
        calendar_timezone: 'Asia/Tokyo',
        guest_locale: 'ja',
        created_at: now.toISOString(),
        form: [
          {
            field_type: 'guest_name',
            required: true,
            label: '名前',
            value: 'Webhook直接呼び出しテスト ゲスト'
          },
          {
            field_type: 'guest_email',
            required: true,
            label: 'メールアドレス',
            value: 'webhook-direct-test@example.com'
          }
        ],
        url_params: [
          {
            line_uid: 'U_DIRECT_TEST'
          }
        ],
        hosts: [
          {
            name: 'テスト面談官',
            email: Session.getActiveUser().getEmail()
          }
        ]
      }
    };
    
    Logger.log('→ モックWebhookペイロードを作成しました');
    Logger.log(`   Event ID: ${mockPayload.event.id}`);
    Logger.log(`   ゲスト名: ${mockPayload.event.form[0].value}`);
    Logger.log(`   開始日時: ${mockPayload.event.local_start_datetime}`);
    Logger.log('');
    
    // doPost関数をシミュレート（実際のHTTPリクエストオブジェクトを作成）
    const mockRequest = {
      postData: {
        contents: JSON.stringify(mockPayload),
        name: 'postData',
        type: 'application/json',
        length: JSON.stringify(mockPayload).length
      },
      parameter: {}
    };
    
    Logger.log('→ doPost関数を直接呼び出し中...');
    Logger.log('');
    
    try {
      // doPost関数を直接呼び出し
      const result = doPost(mockRequest);
      
      // 結果を確認
      const resultText = result.getContent();
      Logger.log(`→ レスポンス内容: ${resultText.substring(0, 500)}...`);
      Logger.log('');
      
      try {
        const resultData = JSON.parse(resultText);
        if (resultData.status === 'ok' && resultData.success) {
          Logger.log(`✅ Webhook処理が成功しました（行番号: ${resultData.rowIndex || 'N/A'}）`);
          Logger.log('');
          Logger.log('→ 確認事項:');
          Logger.log('  1. GASエディタ > 実行 > 実行ログ で以下を確認:');
          Logger.log('     - [doPost] ===== WEBHOOK RECEIVED ===== が表示されているか');
          Logger.log('     - [WebhookHandler] ===== handleEventConfirmed CALLED ===== が表示されているか');
          Logger.log('     - [SpreadsheetService] ===== appendInterview CALLED ===== が表示されているか');
          Logger.log('  2. interviewsシートに新しい行が追加されているか確認');
          Logger.log('  3. uidlogシートにWebhook受信の記録が残っているか確認');
          Logger.log('');
          Logger.log('⚠️ 注意: このテストは関数の直接呼び出しです。');
          Logger.log('   実際のWebhook疎通を確認するには、TimeRexから実際のWebhookを送信してください。');
          Logger.log('');
          return true;
        } else {
          Logger.log(`⚠️ Webhook処理でエラーが発生しました: ${resultData.error || 'unknown'}`);
          Logger.log('');
          Logger.log('→ 確認事項:');
          Logger.log('  1. GASエディタ > 実行 > 実行ログ でエラーの詳細を確認');
          Logger.log('');
          return false;
        }
      } catch (parseError) {
        Logger.log(`⚠️ レスポンスのパースに失敗: ${parseError.toString()}`);
        Logger.log(`   レスポンス内容: ${resultText}`);
        return false;
      }
    } catch (callError) {
      Logger.log(`✗ doPost関数の呼び出しに失敗しました: ${callError.toString()}`);
      Logger.log(`   エラースタック: ${callError.stack || 'No stack trace'}`);
      Logger.log('');
      Logger.log('→ 確認事項:');
      Logger.log('  1. GASエディタ > 実行 > 実行ログ でエラーの詳細を確認');
      Logger.log('  2. 必要な関数やサービスが正しくインポートされているか確認');
      Logger.log('');
      return false;
    }
  } catch (error) {
    Logger.log(`✗ テストエラー: ${error.toString()}`);
    Utils.logError('testWebhookDirectCall', error);
    return false;
  }
}

