const { saveTelegramChatId, getTelegramChatId } = require('./telegramChatStore');
const { mainMenuKeyboard, cancelKeyboard } = require('./telegramKeyboard');
const { getFinanceStats, buildStatsMessage } = require('./financeStats');
const { addTransaction, parseAmount } = require('./transactionService');
const { sendSalesExcelReport, sendInventoryExcelReport } = require('./reportBuilder');

let polling = false;
let offset = 0;
const pendingActions = new Map();

async function telegramApi(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response.json();
}

async function sendTelegramMessage(token, chatId, text, replyMarkup = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return telegramApi(token, 'sendMessage', body);
}

async function answerCallback(token, callbackQueryId, text = '') {
  return telegramApi(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false
  });
}

function setPending(chatId, data) {
  pendingActions.set(String(chatId), data);
}

function getPending(chatId) {
  return pendingActions.get(String(chatId));
}

function clearPending(chatId) {
  pendingActions.delete(String(chatId));
}

async function showMainMenu(token, chatId, text) {
  await sendTelegramMessage(token, chatId, text, mainMenuKeyboard());
}

async function sendStats(token, chatId) {
  const stats = await getFinanceStats();
  await sendTelegramMessage(token, chatId, buildStatsMessage(stats), mainMenuKeyboard());
}

async function handleCallback(token, callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data;
  const from = callbackQuery.from || {};

  if (!chatId) return;

  await answerCallback(token, callbackQuery.id);

  if (data === 'cancel') {
    clearPending(chatId);
    await showMainMenu(token, chatId, '❌ Amal bekor qilindi.');
    return;
  }

  if (data === 'menu') {
    clearPending(chatId);
    await showMainMenu(token, chatId, '🏠 <b>Asosiy menyu</b>\nKerakli tugmani tanlang:');
    return;
  }

  if (data === 'stats') {
    clearPending(chatId);
    await sendStats(token, chatId);
    return;
  }

  if (data === 'add_income' || data === 'add_expense') {
    const type = data === 'add_income' ? 'income' : 'expense';
    const label = type === 'income' ? 'KIRIM' : 'CHIQIM';
    setPending(chatId, { type, step: 'amount', username: from.username || '' });
    await sendTelegramMessage(
      token,
      chatId,
      `💵 <b>${label} qo'shish</b>\n\nSummani yozing (UZS):\n<i>Masalan: 150000</i>`,
      cancelKeyboard()
    );
    return;
  }

  if (data === 'excel_sales') {
    try {
      await sendSalesExcelReport('📱 Telegram bot orqali');
      await sendTelegramMessage(token, chatId, '✅ Sotuvlar Excel fayli yuborildi!', mainMenuKeyboard());
    } catch (err) {
      await sendTelegramMessage(token, chatId, `⚠️ ${err.message}`, mainMenuKeyboard());
    }
    return;
  }

  if (data === 'excel_inventory') {
    try {
      await sendInventoryExcelReport('📱 Telegram bot orqali');
      await sendTelegramMessage(token, chatId, '✅ Ombor Excel fayli yuborildi!', mainMenuKeyboard());
    } catch (err) {
      await sendTelegramMessage(token, chatId, `⚠️ ${err.message}`, mainMenuKeyboard());
    }
    return;
  }
}

async function handlePendingMessage(token, chatId, text, from) {
  const pending = getPending(chatId);
  if (!pending) return false;

  if (text === '/bekor' || text === '/cancel') {
    clearPending(chatId);
    await showMainMenu(token, chatId, '❌ Amal bekor qilindi.');
    return true;
  }

  if (pending.step === 'amount') {
    const amount = parseAmount(text);
    if (!amount) {
      await sendTelegramMessage(token, chatId, '⚠️ Noto\'g\'ri summa. Faqat raqam kiriting.\n<i>Masalan: 250000</i>', cancelKeyboard());
      return true;
    }
    pending.amount = amount;
    pending.step = 'description';
    setPending(chatId, pending);
    const label = pending.type === 'income' ? 'kirim' : 'chiqim';
    await sendTelegramMessage(
      token,
      chatId,
      `📝 <b>${amount.toLocaleString('uz-UZ')} UZS</b> ${label} uchun izoh yozing:\n<i>(yoki - belgisini yuboring)</i>`,
      cancelKeyboard()
    );
    return true;
  }

  if (pending.step === 'description') {
    const description = text === '-' ? '' : text;
    try {
      const tx = await addTransaction(pending.type, pending.amount, description, {
        source: 'telegram',
        createdBy: from.username ? `@${from.username}` : String(from.id || chatId)
      });
      clearPending(chatId);
      const icon = tx.type === 'income' ? '💰' : '💸';
      const label = tx.type === 'income' ? 'Kirim' : 'Chiqim';
      await sendTelegramMessage(
        token,
        chatId,
        `✅ <b>${label} saqlandi!</b>\n\n${icon} Summa: <b>${tx.amount.toLocaleString('uz-UZ')} UZS</b>\n📝 Izoh: ${tx.description || '—'}`,
        mainMenuKeyboard()
      );
    } catch (err) {
      await sendTelegramMessage(token, chatId, `⚠️ Xatolik: ${err.message}`, mainMenuKeyboard());
      clearPending(chatId);
    }
    return true;
  }

  return false;
}

async function handleUpdate(token, update) {
  if (update.callback_query) {
    await handleCallback(token, update.callback_query);
    return;
  }

  const message = update.message || update.edited_message;
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const from = message.from || {};

  if (await handlePendingMessage(token, chatId, text, from)) return;

  if (text === '/start' || text.startsWith('/start ')) {
    saveTelegramChatId(chatId, {
      firstName: from.first_name || '',
      username: from.username || '',
      type: message.chat.type
    });

    await showMainMenu(
      token,
      chatId,
      `✅ <b>Apteka hisobot boti ulandi!</b>\n\n` +
      `📌 Chat ID: <code>${chatId}</code>\n\n` +
      `Quyidagi tugmalardan foydalaning:`
    );
    console.log(`Telegram chat ulandi: ${chatId} (@${from.username || 'user'})`);
    return;
  }

  if (text === '/menu' || text === '/menyu') {
    clearPending(chatId);
    await showMainMenu(token, chatId, '🏠 <b>Asosiy menyu</b>');
    return;
  }

  if (text === '/statistika' || text === '/stats') {
    clearPending(chatId);
    await sendStats(token, chatId);
    return;
  }

  if (text === '/status' || text === '/holat') {
    const saved = getTelegramChatId();
    const linked = saved && String(saved) === String(chatId);
    await sendTelegramMessage(
      token,
      chatId,
      linked
        ? `🟢 <b>Bot ulangan</b>\nChat ID: <code>${chatId}</code>`
        : `🟡 Bot ishlayapti. /start yuboring.`,
      mainMenuKeyboard()
    );
    return;
  }

  if (text === '/help' || text === '/yordam') {
    await sendTelegramMessage(
      token,
      chatId,
      `<b>🏥 Apteka Bot — Yordam</b>\n\n` +
      `📈 <b>Statistika</b> — kun/oy kirim-chiqim\n` +
      `💰 <b>Kirim</b> — qo'shimcha tushum\n` +
      `💸 <b>Chiqim</b> — xarajat\n` +
      `📊/📦 Excel hisobotlar\n\n` +
      `/menu — asosiy menyu\n` +
      `/stats — statistika`,
      mainMenuKeyboard()
    );
    return;
  }

  // Tez kirim/chiqim: +500000 ijara yoki -120000 kommunal
  const quickMatch = text.match(/^([+-])([\d.,\s]+)\s*(.*)$/);
  if (quickMatch) {
    const isIncome = quickMatch[1] === '+';
    const amount = parseAmount(quickMatch[2]);
    const parts = quickMatch[3].trim();
    if (amount) {
      const type = isIncome ? 'income' : 'expense';
      await addTransaction(type, amount, parts, {
        source: 'telegram',
        createdBy: from.username ? `@${from.username}` : String(chatId)
      });
      const label = isIncome ? 'Kirim' : 'Chiqim';
      await sendTelegramMessage(
        token,
        chatId,
        `✅ <b>${label}:</b> ${amount.toLocaleString('uz-UZ')} UZS${parts ? `\n📝 ${parts}` : ''}`,
        mainMenuKeyboard()
      );
      return;
    }
  }

  await sendTelegramMessage(
    token,
    chatId,
    `🤖 Tushunmadim. /menu yuboring yoki tugmalardan foydalaning.`,
    mainMenuKeyboard()
  );
}

async function pollOnce(token) {
  const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=25&offset=${offset}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.ok) {
    console.error('Telegram polling xatosi:', data.description || data);
    return;
  }

  for (const update of data.result) {
    offset = update.update_id + 1;
    try {
      await handleUpdate(token, update);
    } catch (err) {
      console.error('Telegram update ishlov xatosi:', err.message);
    }
  }
}

function startTelegramPoller() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    console.warn('Telegram bot token yo\'q — polling o\'chirilgan.');
    return;
  }

  if (polling) return;
  polling = true;

  const savedChat = getTelegramChatId();
  console.log(
    savedChat
      ? `Telegram bot polling (chat: ${savedChat}) — kirim/chiqim/stats tugmalar`
      : 'Telegram bot polling — /start: @Apteka_hisobot_uz_bot'
  );

  const loop = async () => {
    while (polling) {
      try {
        await pollOnce(token);
      } catch (err) {
        console.error('Telegram poll tarmoq xatosi:', err.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };

  loop();
}

function stopTelegramPoller() {
  polling = false;
}

module.exports = {
  startTelegramPoller,
  stopTelegramPoller,
  sendTelegramMessage
};
