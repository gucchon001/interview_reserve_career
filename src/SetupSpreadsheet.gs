/**
 * スプレッドシート初期設定
 * 必要なシートとヘッダー行を作成
 */

/**
 * 必要なシートを自動作成
 * 既に存在する場合はスキップ
 */
function setupSpreadsheetSheets() {
  Logger.log('=== スプレッドシートシート作成開始 ===');
  
  try {
    const ss = SpreadsheetService.getSpreadsheet();
    if (!ss) {
      Logger.log('✗ スプレッドシートにアクセスできません');
      return { success: false, error: 'Spreadsheet not found' };
    }
    
    Logger.log(`✓ スプレッドシートアクセス成功: ${ss.getName()}`);
    
    const results = {
      interviewers: setupInterviewersSheet(ss),
      interviews: setupInterviewsSheet(ss)
    };
    
    const allSuccess = results.interviewers.success && results.interviews.success;
    
    Logger.log('');
    Logger.log('=== シート作成結果 ===');
    Logger.log(`interviewers: ${results.interviewers.success ? '✓ 作成/確認完了' : '✗ 失敗'}`);
    Logger.log(`interviews: ${results.interviews.success ? '✓ 作成/確認完了' : '✗ 失敗'}`);
    
    return {
      success: allSuccess,
      results: results
    };
  } catch (error) {
    Utils.logError('setupSpreadsheetSheets', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * interviewersシートをセットアップ
 */
function setupInterviewersSheet(ss) {
  try {
    let sheet = ss.getSheetByName(Config.SHEET_NAMES.INTERVIEWERS);
    
    if (!sheet) {
      Logger.log(`→ ${Config.SHEET_NAMES.INTERVIEWERS}シートを作成中...`);
      sheet = ss.insertSheet(Config.SHEET_NAMES.INTERVIEWERS);
      Logger.log(`✓ ${Config.SHEET_NAMES.INTERVIEWERS}シートを作成しました`);
    } else {
      Logger.log(`✓ ${Config.SHEET_NAMES.INTERVIEWERS}シートは既に存在します`);
    }
    
    // ヘッダー行を設定
    const headerRange = sheet.getRange(1, 1, 1, 5);
    const headers = headerRange.getValues()[0];
    
    // ヘッダーが空または正しくない場合は設定
    if (!headers[0] || headers[0] !== 'id') {
      Logger.log('→ ヘッダー行を設定中...');
      headerRange.setValues([[
        'id',                    // A列
        'name',                  // B列
        'timerex_config_id',     // C列
        'google_calendar_id',    // D列
        'priority'               // E列（優先順位：低い数値ほど優先度が高い）
      ]]);
      
      // ヘッダー行の書式設定
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#F3F4F6');
      
      Logger.log('✓ ヘッダー行を設定しました');
    } else {
      // 既存のヘッダーがある場合、priorityカラムが存在するか確認
      const existingHeaders = headers;
      // is_defaultカラム（E列）がある場合は削除し、priorityに置き換える
      if (existingHeaders.length >= 5 && existingHeaders[4] === 'is_default') {
        Logger.log('→ is_defaultカラムをpriorityに置き換え中...');
        sheet.getRange(1, 5).setValue('priority');
        sheet.getRange(1, 5).setFontWeight('bold');
        sheet.getRange(1, 5).setBackground('#F3F4F6');
        Logger.log('✓ is_defaultカラムをpriorityに置き換えました');
      } else if (existingHeaders.length < 5 || !existingHeaders[4] || existingHeaders[4] !== 'priority') {
        Logger.log('→ priorityカラムを追加中...');
        // E列にpriorityヘッダーを追加
        sheet.getRange(1, 5).setValue('priority');
        sheet.getRange(1, 5).setFontWeight('bold');
        sheet.getRange(1, 5).setBackground('#F3F4F6');
        Logger.log('✓ priorityカラムを追加しました');
      }
      Logger.log('✓ ヘッダー行は既に設定されています');
    }
    
    // シートの幅を調整
    sheet.setColumnWidth(1, 100); // id
    sheet.setColumnWidth(2, 150); // name
    sheet.setColumnWidth(3, 150); // timerex_config_id
    sheet.setColumnWidth(4, 200); // google_calendar_id
    sheet.setColumnWidth(5, 100); // priority
    
    return { success: true, sheet: sheet };
  } catch (error) {
    Utils.logError('setupInterviewersSheet', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * interviewsシートをセットアップ
 */
function setupInterviewsSheet(ss) {
  try {
    let sheet = ss.getSheetByName(Config.SHEET_NAMES.INTERVIEWS);
    
    if (!sheet) {
      Logger.log(`→ ${Config.SHEET_NAMES.INTERVIEWS}シートを作成中...`);
      sheet = ss.insertSheet(Config.SHEET_NAMES.INTERVIEWS);
      Logger.log(`✓ ${Config.SHEET_NAMES.INTERVIEWS}シートを作成しました`);
    } else {
      Logger.log(`✓ ${Config.SHEET_NAMES.INTERVIEWS}シートは既に存在します`);
    }
    
    // ヘッダー行を設定
    const headerRange = sheet.getRange(1, 1, 1, 13);
    const headers = headerRange.getValues()[0];
    
    // ヘッダーが空または正しくない場合は設定
    if (!headers[0] || headers[0] !== 'created_at') {
      Logger.log('→ ヘッダー行を設定中...');
      headerRange.setValues([[
        'created_at',           // A列
        'start_at',             // B列
        'end_at',               // C列
        'guest_name',           // D列
        'guest_email',          // E列
        'meet_url',             // F列
        'line_uid',             // G列
        'source',               // H列
        'event_id',             // I列
        'team_url_path',        // J列
        'calendar_url_path',    // K列
        'status',               // L列
        'interviewer_id'        // M列
      ]]);
      
      // ヘッダー行の書式設定
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#F3F4F6');
      
      Logger.log('✓ ヘッダー行を設定しました');
    } else {
      Logger.log('✓ ヘッダー行は既に設定されています');
    }
    
    // シートの幅を調整
    sheet.setColumnWidth(1, 150); // created_at
    sheet.setColumnWidth(2, 150); // start_at
    sheet.setColumnWidth(3, 150); // end_at
    sheet.setColumnWidth(4, 150); // guest_name
    sheet.setColumnWidth(5, 200); // guest_email
    sheet.setColumnWidth(6, 300); // meet_url
    sheet.setColumnWidth(7, 150); // line_uid
    sheet.setColumnWidth(8, 100); // source
    sheet.setColumnWidth(9, 200); // event_id
    sheet.setColumnWidth(10, 150); // team_url_path
    sheet.setColumnWidth(11, 150); // calendar_url_path
    sheet.setColumnWidth(12, 80);  // status
    sheet.setColumnWidth(13, 150); // interviewer_id
    
    // 日時列の書式設定
    sheet.getRange('A:A').setNumberFormat('yyyy/mm/dd hh:mm');
    sheet.getRange('B:B').setNumberFormat('yyyy/mm/dd hh:mm');
    sheet.getRange('C:C').setNumberFormat('yyyy/mm/dd hh:mm');
    
    return { success: true, sheet: sheet };
  } catch (error) {
    Utils.logError('setupInterviewsSheet', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * サンプルデータを追加（テスト用）
 * 注意: 実際の環境では不要です
 */
function addSampleInterviewerData() {
  Logger.log('=== サンプル担当者データ追加 ===');
  
  try {
    const sheet = SpreadsheetService.getSheet(Config.SHEET_NAMES.INTERVIEWERS);
    
    // 既存データをチェック
    const dataRange = sheet.getDataRange();
    const existingRows = dataRange.getNumRows();
    
    if (existingRows > 1) {
      Logger.log('⚠ 既にデータが存在します。スキップします。');
      return { success: false, message: 'Data already exists' };
    }
    
    // サンプルデータを追加
    const sampleData = [
      ['test_interviewer', 'テスト担当者', 'test-config-id', 'your-email@example.com', true]
    ];
    
    sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);
    Logger.log('✓ サンプルデータを追加しました');
    Logger.log('⚠ 注意: google_calendar_id を実際のメールアドレスに変更してください');
    
    return { success: true };
  } catch (error) {
    Utils.logError('addSampleInterviewerData', error);
    return { success: false, error: error.toString() };
  }
}

