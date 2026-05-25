const { db, dbGet, dbRun, dbAll, logAudit } = require('../config/database');

const getSalesHistory = async (req, res) => {
  try {
    let sql = `
      SELECT s.id, s.total_amount, s.payment_method, s.sold_at, u.fullname as seller_name
      FROM sales s
      LEFT JOIN users u ON s.seller_id = u.id
    `;
    let params = [];

    // Sellers can only see their own sales, admins see all
    if (req.user.role === 'seller') {
      sql += ` WHERE s.seller_id = ?`;
      params = [req.user.id];
    }

    sql += ` ORDER BY s.sold_at DESC`;

    const sales = await dbAll(sql, params);
    res.json({ sales });
  } catch (error) {
    res.status(500).json({ error: 'Sotuvlar tarixini yuklashda xatolik yuz berdi.' });
  }
};

const getSaleDetails = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Get Sale Main Info
    let saleSql = `
      SELECT s.id, s.total_amount, s.payment_method, s.sold_at, u.fullname as seller_name, s.seller_id
      FROM sales s
      LEFT JOIN users u ON s.seller_id = u.id
      WHERE s.id = ?
    `;
    const sale = await dbGet(saleSql, [id]);

    if (!sale) {
      return res.status(404).json({ error: 'Sotuv topilmadi.' });
    }

    // Access Control: Seller can only see their own sales details
    if (req.user.role === 'seller' && sale.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Ushbu sotuv ma\'lumotlarini ko\'rishga ruxsatingiz yo\'q.' });
    }

    // 2. Get Sale Items
    const items = await dbAll(`
      SELECT si.id, si.quantity, si.price_at_sale, m.name as medicine_name, m.generic_name
      FROM sale_items si
      LEFT JOIN medicines m ON si.medicine_id = m.id
      WHERE si.sale_id = ?
    `, [id]);

    res.json({ sale, items });
  } catch (error) {
    res.status(500).json({ error: 'Sotuv tafsilotlarini yuklashda xatolik yuz berdi.' });
  }
};

const createSale = async (req, res) => {
  const { items, paymentMethod } = req.body; // items: [{ id, quantity }]

  if (!items || !Array.isArray(items) || items.length === 0 || !paymentMethod) {
    return res.status(400).json({ error: 'Savdo tafsilotlari yoki to\'lov turi to\'liq emas.' });
  }

  // Helper inside transaction to rollback easily
  const rollbackTransaction = async () => {
    try {
      await dbRun('ROLLBACK');
    } catch (e) {
      console.error('Failed to rollback transaction:', e.message);
    }
  };

  try {
    // Start Transaction
    await dbRun('BEGIN TRANSACTION');

    let totalAmount = 0;
    const itemsToInsert = [];

    // Verify stock and calculate total price inside the transaction
    for (const item of items) {
      const med = await dbGet('SELECT * FROM medicines WHERE id = ?', [item.id]);
      if (!med) {
        await rollbackTransaction();
        return res.status(404).json({ error: `ID: ${item.id} bo'lgan dori omborda topilmadi.` });
      }

      if (med.stock < item.quantity) {
        await rollbackTransaction();
        return res.status(400).json({ 
          error: `Zaxira yetarli emas: "${med.name}" dorisidan omborda faqat ${med.stock} dona bor, siz ${item.quantity} dona sotmoqchisiz.` 
        });
      }

      const itemCost = med.selling_price * item.quantity;
      totalAmount += itemCost;

      itemsToInsert.push({
        medicine_id: med.id,
        name: med.name,
        quantity: item.quantity,
        price_at_sale: med.selling_price
      });

      // Deduct Stock
      await dbRun('UPDATE medicines SET stock = stock - ? WHERE id = ?', [item.quantity, med.id]);
    }

    // Insert into sales table
    const saleResult = await dbRun(
      `INSERT INTO sales (seller_id, total_amount, payment_method) VALUES (?, ?, ?)`,
      [req.user.id, totalAmount, paymentMethod]
    );

    const saleId = saleResult.lastID;

    // Insert into sale_items table
    for (const insertItem of itemsToInsert) {
      await dbRun(
        `INSERT INTO sale_items (sale_id, medicine_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)`,
        [saleId, insertItem.medicine_id, insertItem.quantity, insertItem.price_at_sale]
      );
    }

    // Commit Transaction
    await dbRun('COMMIT');

    // Audit Log
    await logAudit(
      req.user.id,
      'CREATE_SALE',
      `Yangi sotuv amalga oshirildi. ID: ${saleId}, Jami: ${totalAmount} UZS, To'lov: ${paymentMethod}`,
      req.ip
    );

    res.status(201).json({
      message: 'Savdo muvaffaqiyatli yakunlandi.',
      saleId,
      totalAmount
    });

  } catch (error) {
    await rollbackTransaction();
    console.error('Sale transaction error:', error);
    res.status(500).json({ error: 'Sotuvni amalga oshirishda xatolik yuz berdi. Tranzaksiya bekor qilindi.' });
  }
};

module.exports = {
  getSalesHistory,
  getSaleDetails,
  createSale
};
