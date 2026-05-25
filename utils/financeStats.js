const { dbGet, dbAll } = require('../config/database');

const formatMoney = (n) => Number(n || 0).toLocaleString('uz-UZ');

async function getFinanceStats() {
  const todaySales = await dbGet(`
    SELECT COALESCE(SUM(total_amount), 0) as total
    FROM sales
    WHERE date(sold_at) = date('now', 'localtime')
  `);

  const monthSales = await dbGet(`
    SELECT COALESCE(SUM(total_amount), 0) as total
    FROM sales
    WHERE strftime('%Y-%m', sold_at) = strftime('%Y-%m', 'now', 'localtime')
  `);

  const todayIncome = await dbGet(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'income' AND date(created_at) = date('now', 'localtime')
  `);

  const monthIncome = await dbGet(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'income' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
  `);

  const todayExpense = await dbGet(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'expense' AND date(created_at) = date('now', 'localtime')
  `);

  const monthExpense = await dbGet(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE type = 'expense' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
  `);

  const todayProfit = await dbGet(`
    SELECT COALESCE(SUM(si.quantity * (si.price_at_sale - m.purchase_price)), 0) as profit
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    JOIN medicines m ON si.medicine_id = m.id
    WHERE date(s.sold_at) = date('now', 'localtime')
  `);

  const lowStock = await dbGet(`SELECT COUNT(*) as count FROM medicines WHERE stock <= 5`);

  const recentTransactions = await dbAll(`
    SELECT type, amount, description, created_at
    FROM transactions
    ORDER BY created_at DESC
    LIMIT 5
  `);

  const todayKirim = todaySales.total + todayIncome.total;
  const monthKirim = monthSales.total + monthIncome.total;
  const todayBalance = todayKirim - todayExpense.total;
  const monthBalance = monthKirim - monthExpense.total;

  return {
    todaySales: todaySales.total,
    monthSales: monthSales.total,
    todayIncome: todayIncome.total,
    monthIncome: monthIncome.total,
    todayExpense: todayExpense.total,
    monthExpense: monthExpense.total,
    todayKirim,
    monthKirim,
    todayBalance,
    monthBalance,
    todayProfit: todayProfit.profit,
    lowStockCount: lowStock.count,
    recentTransactions
  };
}

function buildStatsMessage(stats) {
  let msg =
    `<b>📈 APTEKA STATISTIKA</b>\n` +
    `<i>${new Date().toLocaleString('uz-UZ')}</i>\n\n` +
    `<b>📅 BUGUN</b>\n` +
    `🛒 Sotuv: <b>${formatMoney(stats.todaySales)} UZS</b>\n` +
    `💰 Qo'shimcha kirim: <b>${formatMoney(stats.todayIncome)} UZS</b>\n` +
    `📥 Jami kirim: <b>${formatMoney(stats.todayKirim)} UZS</b>\n` +
    `💸 Chiqim: <b>${formatMoney(stats.todayExpense)} UZS</b>\n` +
    `📊 Kun balansi: <b>${formatMoney(stats.todayBalance)} UZS</b>\n` +
    `💹 Tovar foydasi: <b>${formatMoney(stats.todayProfit)} UZS</b>\n\n` +
    `<b>🗓️ OY</b>\n` +
    `🛒 Sotuv: <b>${formatMoney(stats.monthSales)} UZS</b>\n` +
    `💰 Qo'shimcha kirim: <b>${formatMoney(stats.monthIncome)} UZS</b>\n` +
    `📥 Jami kirim: <b>${formatMoney(stats.monthKirim)} UZS</b>\n` +
    `💸 Chiqim: <b>${formatMoney(stats.monthExpense)} UZS</b>\n` +
    `📊 Oy balansi: <b>${formatMoney(stats.monthBalance)} UZS</b>\n\n` +
    `📦 Kam zaxira (≤5): <b>${stats.lowStockCount} ta</b>`;

  if (stats.recentTransactions.length > 0) {
    msg += `\n\n<b>🕐 So'nggi harakatlar:</b>\n`;
    stats.recentTransactions.forEach((t) => {
      const icon = t.type === 'income' ? '💰' : '💸';
      const label = t.type === 'income' ? 'Kirim' : 'Chiqim';
      const date = new Date(t.created_at).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      msg += `${icon} ${label}: ${formatMoney(t.amount)} — ${t.description || '—'} (${date})\n`;
    });
  }

  return msg;
}

module.exports = {
  getFinanceStats,
  buildStatsMessage,
  formatMoney
};
