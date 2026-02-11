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
   * @param {string} bookingData.candidateName - 候補者名
   * @param {string} bookingData.dateTime - 日時（ISO形式推奨）
   * @param {string} bookingData.interviewerName - 面談担当者名
   * @param {string} bookingData.interviewerEmail - 面談担当者メール（オプション）
   * @param {string} bookingData.bookingId - 予約ID（オプション）
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
   * @param {string} bookingData.candidateName - 候補者名
   * @param {string} bookingData.dateTime - 日時（ISO形式推奨）
   * @param {string} bookingData.interviewerName - 面談担当者名
   * @param {string} bookingData.interviewerEmail - 面談担当者メール（オプション）
   * @param {string} bookingData.bookingId - 予約ID（オプション）
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
    
    // カレンダーアイコン付きのリッチなメッセージ
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
              text: `*📅 日時:*\n${dateTime}`
            },
            {
              type: 'mrkdwn',
              text: `*👤 候補者:*\n${bookingData.candidateName}`
            }
          ]
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*👨‍💼 面談担当者:*\n${bookingData.interviewerName}`
            },
            ...(bookingData.bookingId ? [{
              type: 'mrkdwn',
              text: `*🆔 予約ID:*\n\`${bookingData.bookingId}\``
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
   * 日時をフォーマット
   * @private
   */
  _formatDateTime(dateTimeString) {
    try {
      const date = new Date(dateTimeString);
      if (isNaN(date.getTime())) {
        return dateTimeString; // パース失敗時はそのまま返す
      }
      
      // 日本語形式でフォーマット
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      const weekday = weekdays[date.getDay()];
      
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

