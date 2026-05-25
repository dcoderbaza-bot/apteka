const { dbRun, dbGet } = require('../config/database');

function parseAmount(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[^\d.,]/g, '').replace(',', '.');
  const amount = parseFloat(cleaned);
  if (!amount || amount <= 0 || !Number.isFinite(amount)) return null;
  return Math.round(amount);
}

async function addTransaction(type, amount, description = '', meta = {}) {
  if (!['income', 'expense'].includes(type)) {
    throw new Error('Noto\'g\'ri tranzaksiya turi');
  }

  const result = await dbRun(
    `INSERT INTO transactions (type, amount, description, source, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      type,
      amount,
      description ? description.trim() : '',
      meta.source || 'telegram',
      meta.createdBy || 'telegram_user'
    ]
  );

  return {
    id: result.lastID,
    type,
    amount,
    description
  };
}

module.exports = {
  addTransaction,
  parseAmount
};
