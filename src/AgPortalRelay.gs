/**
 * 直接AG申込（jukust_career-agent-portal）向け: LINE Webhook ボディを Vercel に中継する。
 * postback.data が ag:v1: で始まる場合のみ対象（ポータル側 line_link_token 紐付け）。
 * 仕様: jukust docs/planning/roadmap/AG_L-step連携_開発計画.md §7B
 */

/** ポータル lib/ag-application/lstep-webhook.ts の AG_POSTBACK_DATA_PREFIX と一致 */
var AG_APPLICATION_POSTBACK_PREFIX = 'ag:v1:';

/**
 * LINE Webhook JSON（文字列）に AG 申込用 postback が含まれるか
 * @param {string} rawContents - e.postData.contents
 * @return {boolean}
 */
function isAgApplicationLineWebhookPayload_(rawContents) {
  if (!rawContents || typeof rawContents !== 'string') return false;
  try {
    var body = JSON.parse(rawContents);
    var events = body.events || (body.body && body.body.events) || (body.data && body.data.events) || (body.payload && body.payload.events) || [];
    if (!Array.isArray(events)) return false;
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (!ev || ev.type !== 'postback' || !ev.postback) continue;
      var dataStr = ev.postback.data != null ? String(ev.postback.data).trim() : '';
      if (dataStr.indexOf(AG_APPLICATION_POSTBACK_PREFIX) === 0) return true;
    }
  } catch (err) {
    Logger.log('[AgPortalRelay] isAgApplicationLineWebhookPayload_ parse skip: ' + err);
  }
  return false;
}

/**
 * 受信した生 JSON をそのまま Vercel に POST（改変しない）
 * @param {string} rawContents - e.postData.contents
 */
function relayRawLineWebhookToAgPortal_(rawContents) {
  var props = PropertiesService.getScriptProperties();
  var url = (props.getProperty(Config.PROPERTY_KEYS.VERCEL_AG_LSTEP_WEBHOOK_URL) || '').trim();
  var secret = (props.getProperty(Config.PROPERTY_KEYS.LSTEP_INTERNAL_WEBHOOK_SECRET) || '').trim();
  if (!url || !secret) {
    Logger.log('[AgPortalRelay] スキップ: VERCEL_AG_LSTEP_WEBHOOK_URL または LSTEP_INTERNAL_WEBHOOK_SECRET が未設定');
    try {
      if (SpreadsheetService.getSpreadsheet()) {
        SpreadsheetService.saveToUidlog('', '', 'AG_RELAY_SKIP: missing URL or LSTEP_INTERNAL_WEBHOOK_SECRET');
      }
    } catch (_) { /* ignore */ }
    return;
  }
  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: rawContents,
      headers: { 'X-Internal-Auth': secret },
      followRedirects: true,
      validateHttpsCertificates: true,
    });
    var code = resp.getResponseCode();
    var text = resp.getContentText() || '';
    Logger.log('[AgPortalRelay] Vercel POST status=' + code + ' body=' + text.substring(0, 300));
    if (code < 200 || code >= 300) {
      try {
        if (SpreadsheetService.getSpreadsheet()) {
          SpreadsheetService.saveToUidlog('', '', 'AG_RELAY_HTTP_' + code + ': ' + text.substring(0, 80));
        }
      } catch (_) { /* ignore */ }
    }
  } catch (err) {
    Logger.log('[AgPortalRelay] UrlFetchApp error: ' + err);
    Utils.logError('relayRawLineWebhookToAgPortal_', err, {});
    try {
      if (SpreadsheetService.getSpreadsheet()) {
        SpreadsheetService.saveToUidlog('', '', 'AG_RELAY_ERR: ' + String(err).substring(0, 120));
      }
    } catch (_) { /* ignore */ }
  }
}

/**
 * L-step が受け取る最小 HTML（200 応答用）
 * @return {HtmlOutput}
 */
function agPortalRelayMinimalOkHtml_() {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>OK</body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
