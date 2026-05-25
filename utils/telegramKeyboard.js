const mainMenuKeyboard = () => ({
  inline_keyboard: [
    [{ text: '📈 Statistika', callback_data: 'stats' }],
    [
      { text: '💰 Kirim qo\'shish', callback_data: 'add_income' },
      { text: '💸 Chiqim qo\'shish', callback_data: 'add_expense' }
    ],
    [
      { text: '📊 Sotuvlar Excel', callback_data: 'excel_sales' },
      { text: '📦 Ombor Excel', callback_data: 'excel_inventory' }
    ],
    [{ text: '🏠 Asosiy menyu', callback_data: 'menu' }]
  ]
});

const cancelKeyboard = () => ({
  inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'cancel' }]]
});

module.exports = {
  mainMenuKeyboard,
  cancelKeyboard
};
