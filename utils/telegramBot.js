const { getTelegramChatId } = require('./telegramChatStore');

/**
 * Sends a document (Excel buffer) to a Telegram Chat/Channel using modern native fetch.
 * @param {Buffer} fileBuffer - The file content as a buffer.
 * @param {String} filename - Name of the file as it will appear in Telegram.
 * @param {String} caption - Text message sent alongside the document.
 * @returns {Promise<Boolean>} - Resolves to true if successful, false otherwise.
 */
const sendExcelToTelegram = async (fileBuffer, filename, caption) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = getTelegramChatId();

  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    console.warn('Telegram Bot token yo\'q. Skipping send.');
    throw new Error('Telegram bot token (.env) sozlanmagan.');
  }

  if (!chatId) {
    throw new Error(
      'Telegram chat ulanmagan. @Apteka_hisobot_uz_bot ga kirib /start yuboring, keyin qayta urinib ko\'ring.'
    );
  }

  try {
    const formData = new FormData();
    formData.append('chat_id', chatId);
    
    // Create Blob from Buffer
    const blob = new Blob([fileBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    formData.append('document', blob, filename);
    formData.append('caption', caption);

    console.log(`Sending report to Telegram Chat ID: ${chatId}...`);
    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Telegram API error:', result);
      throw new Error(`Telegram xatosi: ${result.description}`);
    }

    console.log('Report successfully sent to Telegram.');
    return true;
  } catch (error) {
    console.error('Error sending report to Telegram:', error.message);
    throw error;
  }
};

module.exports = {
  sendExcelToTelegram
};
