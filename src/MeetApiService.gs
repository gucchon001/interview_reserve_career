/**
 * Google Meet API 連携サービス
 * ドメイン全体の委任で主催者になりすまし、Meet の文字起こしを自動オンにする
 */

const MEET_API_BASE = 'https://meet.googleapis.com/v2';
const MEET_OAUTH_SCOPE = 'https://www.googleapis.com/auth/meetings.space.settings';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const MeetApiService = {
  /**
   * Meet URL から meetingCode を抽出
   * @param {string} meetUrl - 例: https://meet.google.com/kob-tctv-mjj
   * @return {string|null} meetingCode（例: kob-tctv-mjj）または null
   */
  extractMeetingCodeFromMeetUrl(meetUrl) {
    if (!meetUrl || typeof meetUrl !== 'string') {
      return null;
    }
    const trimmed = meetUrl.trim();
    // https://meet.google.com/xxx-yyy-zzz または meet.google.com/xxx-yyy-zzz
    const match = trimmed.match(/meet\.google\.com\/([a-z]+-[a-z]+-[a-z]+)/i);
    return match ? match[1].toLowerCase() : null;
  },

  /**
   * サービスアカウントの JWT を作成し、OAuth2 でアクセストークンを取得（ドメイン全体の委任）
   * @param {string} subjectEmail - なりすますユーザー（主催者）のメールアドレス
   * @return {string} アクセストークン
   */
  getAccessTokenForUser(subjectEmail) {
    const clientEmail = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.MEET_SA_CLIENT_EMAIL);
    let privateKey = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.MEET_SA_PRIVATE_KEY);
    if (!clientEmail || !privateKey) {
      throw new Error('MeetApiService: MEET_SA_CLIENT_EMAIL または MEET_SA_PRIVATE_KEY が未設定です。スクリプトのプロパティを設定してください。');
    }
    // PEM の改行（\n が文字列で保存されている場合）
    privateKey = privateKey.replace(/\\n/g, '\n');

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientEmail,
      sub: subjectEmail,
      scope: MEET_OAUTH_SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const jwt = this._createJwtRsa256(header, payload, privateKey);

    const response = UrlFetchApp.fetch(TOKEN_URL, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      },
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const body = JSON.parse(response.getContentText());
    if (code !== 200) {
      Logger.log(`[MeetApiService] Token error: ${code} ${response.getContentText()}`);
      throw new Error(`Meet API トークン取得失敗: ${code} ${(body.error || body.error_description || JSON.stringify(body))}`);
    }
    if (!body.access_token) {
      throw new Error('Meet API トークン取得: access_token がありません');
    }
    return body.access_token;
  },

  /**
   * RS256 で JWT を署名して作成
   * @private
   */
  _createJwtRsa256(header, payload, privateKeyPem) {
    const base64url = (obj) => {
      const json = typeof obj === 'object' ? JSON.stringify(obj) : obj;
      const blob = Utilities.newBlob(json);
      return Utilities.base64EncodeWebSafe(blob).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const headerB64 = base64url(header);
    const payloadB64 = base64url(payload);
    const toSign = `${headerB64}.${payloadB64}`;
    const signatureBytes = Utilities.computeRsaSha256Signature(toSign, privateKeyPem);
    // GAS: base64EncodeWebSafe は string または Blob を取る。byte[] は newBlob で Blob にして渡す
    const signatureBlob = Utilities.newBlob(signatureBytes);
    const signatureB64 = Utilities.base64EncodeWebSafe(signatureBlob).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${toSign}.${signatureB64}`;
  },

  /**
   * 指定した Meet の文字起こしを自動オンにする
   * GET で space を取得し、PATCH で config.artifactConfig.transcriptionConfig を ON に設定
   * @param {string} meetUrl - Google Meet の join URL
   * @param {string} organizerEmail - 主催者（オーナー）のメールアドレス（ドメイン全体の委任でこのユーザーになりすます）
   * @return {{ success: boolean, message?: string }}
   */
  enableTranscriptionForMeet(meetUrl, organizerEmail) {
    if (!meetUrl || !organizerEmail) {
      return { success: false, message: 'meetUrl と organizerEmail は必須です' };
    }

    const meetingCode = this.extractMeetingCodeFromMeetUrl(meetUrl);
    if (!meetingCode) {
      Logger.log(`[MeetApiService] Invalid Meet URL (no meetingCode): ${meetUrl}`);
      return { success: false, message: 'Meet URL から meetingCode を抽出できません' };
    }

    let accessToken;
    try {
      accessToken = this.getAccessTokenForUser(organizerEmail);
    } catch (e) {
      Logger.log(`[MeetApiService] getAccessTokenForUser failed: ${e.toString()}`);
      return { success: false, message: `トークン取得失敗: ${e.message}` };
    }

    const options = {
      muteHttpExceptions: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    // GET space by meetingCode
    const getUrl = `${MEET_API_BASE}/spaces/${encodeURIComponent(meetingCode)}`;
    const getRes = UrlFetchApp.fetch(getUrl, { ...options, method: 'get' });
    const getCode = getRes.getResponseCode();
    if (getCode !== 200) {
      Logger.log(`[MeetApiService] GET space failed: ${getCode} ${getRes.getContentText()}`);
      return { success: false, message: `Meet space 取得失敗: ${getCode}` };
    }

    const space = JSON.parse(getRes.getContentText());
    const spaceName = space.name; // spaces/xxxx (server-generated ID)
    if (!spaceName || !spaceName.startsWith('spaces/')) {
      Logger.log(`[MeetApiService] GET response missing name: ${getRes.getContentText()}`);
      return { success: false, message: 'Meet space の name を取得できません' };
    }
    const spaceId = spaceName.replace(/^spaces\//, '');

    // PATCH: update only config.artifactConfig.transcriptionConfig
    const patchUrl = `${MEET_API_BASE}/spaces/${encodeURIComponent(spaceId)}?updateMask=config.artifactConfig`;
    const patchBody = {
      config: {
        artifactConfig: {
          transcriptionConfig: {
            autoTranscriptionGeneration: 'ON'
          }
        }
      }
    };
    const patchRes = UrlFetchApp.fetch(patchUrl, {
      ...options,
      method: 'patch',
      payload: JSON.stringify(patchBody)
    });
    const patchCode = patchRes.getResponseCode();
    if (patchCode !== 200) {
      Logger.log(`[MeetApiService] PATCH space failed: ${patchCode} ${patchRes.getContentText()}`);
      return { success: false, message: `Meet 文字起こし設定失敗: ${patchCode}` };
    }

    Logger.log(`[MeetApiService] Transcription enabled for space ${spaceName}`);
    return { success: true };
  },

  /**
   * Webhook 用: Google Meet のとき主催者になりすまして文字起こしをオンにする
   * 設定が未完了（MEET_SA_* が空）の場合は何もしない
   * @param {string} meetUrl - event.google_meet_meeting.join_url
   * @param {string} organizerEmail - event.hosts[0].email
   */
  enableTranscriptionIfConfigured(meetUrl, organizerEmail) {
    const clientEmail = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.MEET_SA_CLIENT_EMAIL);
    const privateKey = PropertiesService.getScriptProperties().getProperty(Config.PROPERTY_KEYS.MEET_SA_PRIVATE_KEY);
    if (!clientEmail || !privateKey || !meetUrl || !organizerEmail) {
      return;
    }
    try {
      const result = this.enableTranscriptionForMeet(meetUrl, organizerEmail);
      if (!result.success) {
        Logger.log(`[MeetApiService] enableTranscriptionIfConfigured: ${result.message}`);
      }
    } catch (e) {
      Logger.log(`[MeetApiService] enableTranscriptionIfConfigured error: ${e.toString()}`);
      Utils.logError('MeetApiService.enableTranscriptionIfConfigured', e, { meetUrl: meetUrl.substring(0, 50), organizerEmail });
    }
  }
};
