const { dbAll } = require('../config/database');
const { generateExcelBuffer } = require('./excelGenerator');
const { sendExcelToTelegram } = require('./telegramBot');

async function sendSalesExcelReport(captionExtra = '') {
  const sales = await dbAll(`
    SELECT 
      s.id as [Taqdimot ID], 
      s.sold_at as [Sotilgan Vaqt], 
      u.fullname as [Sotuvchi], 
      s.total_amount as [Jami Summa (UZS)], 
      s.payment_method as [To'lov Turi]
    FROM sales s
    LEFT JOIN users u ON s.seller_id = u.id
    ORDER BY s.sold_at DESC
  `);

  if (sales.length === 0) {
    throw new Error('Hisobot yaratish uchun sotuvlar mavjud emas.');
  }

  const buffer = generateExcelBuffer(sales, 'Sotuvlar');
  const filename = `Sotuvlar_Hisoboti_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const caption = `📊 Dorixona Sotuvlar Hisoboti\n📅 ${new Date().toLocaleDateString('uz-UZ')}${captionExtra ? '\n' + captionExtra : ''}`;

  await sendExcelToTelegram(buffer, filename, caption);
}

async function sendInventoryExcelReport(captionExtra = '') {
  const medicines = await dbAll(`
    SELECT 
      id as [ID],
      name as [Dori Nomi],
      generic_name as [Xalqaro Nomi],
      barcode as [Shtrix-Kod],
      category as [Kategoriya],
      stock as [Zaxira Soni],
      purchase_price as [Sotib Olingan Narxi (UZS)],
      selling_price as [Sotish Narxi (UZS)]
    FROM medicines
    ORDER BY stock ASC
  `);

  if (medicines.length === 0) {
    throw new Error('Hisobot yaratish uchun dorilar mavjud emas.');
  }

  const buffer = generateExcelBuffer(medicines, 'Ombor Zaxirasi');
  const filename = `Ombor_Zaxira_Hisoboti_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const caption = `📦 Dorixona Ombor Hisoboti\n📅 ${new Date().toLocaleDateString('uz-UZ')}${captionExtra ? '\n' + captionExtra : ''}`;

  await sendExcelToTelegram(buffer, filename, caption);
}

module.exports = {
  sendSalesExcelReport,
  sendInventoryExcelReport
};
