const fs = require('fs');
const path = require('path');

const CHAT_FILE = path.join(__dirname, '..', 'telegram-chat.json');

function getBotId(token) {
  return token ? String(token).split(':')[0] : null;
}

function isValidChatId(chatId, token) {
  if (!chatId) return false;
  const botId = getBotId(token);
  return String(chatId) !== String(botId);
}

function getTelegramChatId() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const fromEnv = process.env.TELEGRAM_CHAT_ID;

  if (fromEnv && fromEnv !== 'YOUR_TELEGRAM_CHAT_ID_HERE' && isValidChatId(fromEnv, token)) {
    return String(fromEnv);
  }

  try {
    const data = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
    if (isValidChatId(data.chatId, token)) {
      return String(data.chatId);
    }
  } catch {
    // fayl yo'q yoki noto'g'ri
  }

  return null;
}

function saveTelegramChatId(chatId, meta = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!isValidChatId(chatId, token)) {
    throw new Error('Noto\'g\'ri chat ID — bot o\'ziga xabar yubora olmaydi.');
  }

  const payload = {
    chatId: String(chatId),
    updatedAt: new Date().toISOString(),
    ...meta
  };

  fs.writeFileSync(CHAT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function getTelegramStatus() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const configured = !!(token && token !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE');
  const chatId = getTelegramChatId();

  return {
    configured,
    connected: configured && !!chatId,
    chatId: chatId || null,
    botUsername: 'Apteka_hisobot_uz_bot'
  };
}

module.exports = {
  getTelegramChatId,
  saveTelegramChatId,
  getTelegramStatus,
  isValidChatId
};
