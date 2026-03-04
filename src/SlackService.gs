/**
 * Slack通知サービス
 * 予約・キャンセル時にSlackにリッチな通知を送信
 */

const SlackService = {
  /**
   * Webhook URL（PropertiesServiceから取得）
   */
  getWebhookUrl() {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(Config.PROPERTY_KEYS.SLACK_WEBHOOK_URL) || null;
  },

  /**
   * 予約作成通知を送信
   * @param {Object} bookingData - 予約データ
   * @param {string} bookingData.candidateName - 予約者名
   * @param {string} bookingData.dateTime - 日時（ISO形式推奨）
   * @param {string} bookingData.interviewerName - 面談者名
   * @param {string} bookingData.interviewerEmail - 面談者メール（オプション）
   * @param {string} bookingData.interviewerSlackMemberId - 面談者のSlackメンバーID（メンション用、オプション）
   * @param {string} [bookingData.adminPageUrl] - 管理者ページのURL（オプション、Slackにリンク表示）
   */
  notifyBookingCreated(bookingData) {
    try {
      const message = this._buildBookingMessage(bookingData, 'created');
      this._sendToSlack(message);
    } catch (error) {
      console.error('Slack通知エラー（予約作成）:', error);
      // 通知エラーは予約処理を止めない
    }
  },

  /**
   * 予約キャンセル通知を送信
   * @param {Object} bookingData - 予約データ
   * @param {string} bookingData.candidateName - 予約者名
   * @param {string} bookingData.dateTime - 日時（ISO形式推奨）
   * @param {string} bookingData.interviewerName - 面談者名
   * @param {string} bookingData.interviewerEmail - 面談者メール（オプション）
   * @param {string} bookingData.interviewerSlackMemberId - 面談者のSlackメンバーID（メンション用、オプション）
   * @param {string} [bookingData.adminPageUrl] - 管理者ページのURL（オプション、Slackにリンク表示）
   */
  notifyBookingCancelled(bookingData) {
    try {
      const message = this._buildBookingMessage(bookingData, 'cancelled');
      this._sendToSlack(message);
    } catch (error) {
      console.error('Slack通知エラー（予約キャンセル）:', error);
      // 通知エラーは予約処理を止めない
    }
  },

  /**
   * 予約メッセージを構築
   * @private
   */
  _buildBookingMessage(bookingData, action) {
    const isCreated = action === 'created';
    const color = isCreated ? '#36a64f' : '#ff0000'; // 緑（作成） / 赤（キャンセル）
    const emoji = isCreated ? '✅' : '❌';
    const title = isCreated ? '予約が作成されました' : '予約がキャンセルされました';
    
    // 日時をフォーマット
    const dateTime = this._formatDateTime(bookingData.dateTime);
    
    // 面談者表示: SLACK_MEMBER_ID があればメンション、なければ名前のみ
    const slackId = (bookingData.interviewerSlackMemberId || '').toString().trim();
    const interviewerText = slackId
      ? `<@${slackId}>`
      : (bookingData.interviewerName || '未設定');
    
    // 管理画面URL（呼び出し元から渡されていなければ Utils で取得）
    const adminPageUrl = (bookingData.adminPageUrl && bookingData.adminPageUrl.trim()) || (typeof Utils !== 'undefined' && Utils.getAdminPageUrl ? Utils.getAdminPageUrl('') : '');
    
    // 面談日時・予約者・面談者を緑（作成）／赤（キャンセル）のアウトラインで表示
    const message = {
      text: `${emoji} ${title}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${title}`,
            emoji: true
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*面談日時:*\n${dateTime}`
            },
            {
              type: 'mrkdwn',
              text: `*予約者:*\n${bookingData.candidateName}`
            }
          ]
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*面談者:*\n${interviewerText}`
            },
            ...(adminPageUrl ? [{
              type: 'mrkdwn',
              text: `*管理画面URL:*\n<${adminPageUrl}|exec?page=admin で開く>`
            }] : [])
          ]
        }
      ],
      attachments: [
        {
          color: color,
          footer: 'Interview Reserve Career',
          ts: Math.floor(new Date(bookingData.dateTime).getTime() / 1000)
        }
      ]
    };

    return message;
  },

  /**
   * 日時をフォーマット（常に日本時間 JST で表示）
   * @private
   */
  _formatDateTime(dateTimeString) {
    try {
      const date = new Date(dateTimeString);
      if (isNaN(date.getTime())) {
        return dateTimeString; // パース失敗時はそのまま返す
      }
      // 日本時間（JST = UTC+9）で表示するため、UTCに9時間を足したうえで
      // getUTC* で日付・時刻を取得する
      const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
      const jstTime = date.getTime() + JST_OFFSET_MS;
      const jstDate = new Date(jstTime);
      const year = jstDate.getUTCFullYear();
      const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(jstDate.getUTCDate()).padStart(2, '0');
      const hours = String(jstDate.getUTCHours()).padStart(2, '0');
      const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday = weekdays[jstDate.getUTCDay()];
      return `${year}年${month}月${day}日(${weekday}) ${hours}:${minutes}`;
    } catch (error) {
      console.error('日時フォーマットエラー:', error);
      return dateTimeString;
    }
  },

  /**
   * Slackにメッセージを送信
   * @private
   */
  _sendToSlack(message) {
    const url = this.getWebhookUrl();
    if (!url) {
      console.error('Slack Webhook URLが設定されていません');
      return;
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      const responseText = response.getContentText();
      console.error(`Slack通知失敗: ${responseCode} - ${responseText}`);
      throw new Error(`Slack通知失敗: ${responseCode}`);
    }
  }
};

