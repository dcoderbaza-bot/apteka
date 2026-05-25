const { dbAll, dbGet } = require('../config/database');
const { getTelegramStatus } = require('../utils/telegramChatStore');
const { sendSalesExcelReport, sendInventoryExcelReport } = require('../utils/reportBuilder');
const { getFinanceStats } = require('../utils/financeStats');

const getDashboardStats = async (req, res) => {
  try {
    // 1. Today's Sales
    const todaySales = await dbGet(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM sales
      WHERE date(sold_at) = date('now', 'localtime')
    `);

    // 2. Month's Sales
    const monthSales = await dbGet(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM sales
      WHERE strftime('%Y-%m', sold_at) = strftime('%Y-%m', 'now', 'localtime')
    `);

    // 3. Net Profit (selling price - purchase price)
    const netProfit = await dbGet(`
      SELECT COALESCE(SUM(si.quantity * (si.price_at_sale - m.purchase_price)), 0) as profit
      FROM sale_items si
      LEFT JOIN sales s ON si.sale_id = s.id
      LEFT JOIN medicines m ON si.medicine_id = m.id
    `);

    // 4. Low stock medicines count (<= 5)
    const lowStock = await dbGet(`
      SELECT COUNT(*) as count FROM medicines WHERE stock <= 5
    `);

    const finance = await getFinanceStats();

    // 5. Total Unique Medicines count
    const totalMedicines = await dbGet(`SELECT COUNT(*) as count FROM medicines`);

    // 6. Active Sellers count
    const activeSellers = await dbGet(`SELECT COUNT(*) as count FROM users WHERE role = 'seller' AND status = 1`);

    // 7. Sales of the last 7 days (for chart)
    const chartData = await dbAll(`
      SELECT date(sold_at) as date, SUM(total_amount) as total
      FROM sales
      WHERE sold_at >= date('now', '-7 days')
      GROUP BY date(sold_at)
      ORDER BY date(sold_at) ASC
    `);

    // 8. Top Selling Medicines
    const topMedicines = await dbAll(`
      SELECT m.name, SUM(si.quantity) as total_sold
      FROM sale_items si
      LEFT JOIN medicines m ON si.medicine_id = m.id
      GROUP BY si.medicine_id
      ORDER BY total_sold DESC
      LIMIT 5
    `);

    res.json({
      todaySales: todaySales.total,
      monthSales: monthSales.total,
      netProfit: netProfit.profit,
      lowStockCount: lowStock.count,
      totalMedicines: totalMedicines.count,
      activeSellers: activeSellers.count,
      todayIncome: finance.todayIncome,
      todayExpense: finance.todayExpense,
      todayKirim: finance.todayKirim,
      todayBalance: finance.todayBalance,
      monthKirim: finance.monthKirim,
      monthBalance: finance.monthBalance,
      chartData,
      topMedicines
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Statistikalarni yuklashda xatolik yuz berdi.' });
  }
};

const sendTelegramReport = async (req, res) => {
  const { type } = req.query;

  try {
    const extra = `\n👤 ${req.user.fullname}`;

    if (type === 'sales') {
      await sendSalesExcelReport(extra);
    } else if (type === 'inventory') {
      await sendInventoryExcelReport(extra);
    } else {
      return res.status(400).json({ error: 'Noto\'g\'ri hisobot turi tanlandi.' });
    }

    res.json({ message: 'Hisobot muvaffaqiyatli Telegram botga yuborildi!' });
  } catch (error) {
    console.error('Report sending failed:', error);
    res.status(500).json({ error: error.message || 'Hisobotni Telegram botga yuborishda xatolik yuz berdi.' });
  }
};

const getTelegramConnectionStatus = async (req, res) => {
  res.json(getTelegramStatus());
};

module.exports = {
  getDashboardStats,
  sendTelegramReport,
  getTelegramConnectionStatus
};
