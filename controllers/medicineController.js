const { dbGet, dbRun, dbAll, logAudit } = require('../config/database');

const getMedicines = async (req, res) => {
  const { search } = req.query;
  let sql = `SELECT * FROM medicines`;
  let params = [];

  if (search) {
    sql += ` WHERE name LIKE ? OR generic_name LIKE ? OR barcode = ?`;
    const searchParam = `%${search}%`;
    params = [searchParam, searchParam, search];
  }

  sql += ` ORDER BY name ASC`;

  try {
    const medicines = await dbAll(sql, params);
    res.json({ medicines });
  } catch (error) {
    res.status(500).json({ error: 'Dorilarni yuklashda xatolik yuz berdi.' });
  }
};

const getMedicineById = async (req, res) => {
  const { id } = req.params;
  try {
    const medicine = await dbGet(`SELECT * FROM medicines WHERE id = ?`, [id]);
    if (!medicine) {
      return res.status(404).json({ error: 'Dori topilmadi.' });
    }
    res.json({ medicine });
  } catch (error) {
    res.status(500).json({ error: 'Dori ma\'lumotlarini yuklashda xatolik yuz berdi.' });
  }
};

const getMedicineByBarcode = async (req, res) => {
  const { barcode } = req.params;
  try {
    const medicine = await dbGet(`SELECT * FROM medicines WHERE barcode = ?`, [barcode]);
    if (!medicine) {
      return res.status(404).json({ error: 'Ushbu shtrix-kodga ega dori topilmadi.' });
    }
    res.json({ medicine });
  } catch (error) {
    res.status(500).json({ error: 'Dori ma\'lumotlarini yuklashda xatolik yuz berdi.' });
  }
};

const createMedicine = async (req, res) => {
  const { name, generic_name, barcode, category, stock, purchase_price, selling_price } = req.body;

  if (!name || stock === undefined || !purchase_price || !selling_price) {
    return res.status(400).json({ error: 'Dori nomi, soni, sotib olingan va sotish narxlari majburiy.' });
  }

  try {
    if (barcode) {
      const existing = await dbGet(`SELECT id FROM medicines WHERE barcode = ?`, [barcode.trim()]);
      if (existing) {
        return res.status(400).json({ error: 'Ushbu shtrix-kod allaqachon boshqa dori uchun kiritilgan.' });
      }
    }

    const result = await dbRun(
      `INSERT INTO medicines (name, generic_name, barcode, category, stock, purchase_price, selling_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        generic_name ? generic_name.trim() : null,
        barcode ? barcode.trim() : null,
        category ? category.trim() : null,
        parseInt(stock),
        parseFloat(purchase_price),
        parseFloat(selling_price)
      ]
    );

    await logAudit(req.user.id, 'ADD_MEDICINE', `Yangi dori qo'shildi: ${name} (Soni: ${stock}, Narxi: ${selling_price})`, req.ip);

    res.status(201).json({
      message: 'Dori muvaffaqiyatli qo\'shildi.',
      medicineId: result.lastID
    });
  } catch (error) {
    res.status(500).json({ error: 'Dorini qo\'shishda xatolik yuz berdi.' });
  }
};

const updateMedicine = async (req, res) => {
  const { id } = req.params;
  const { name, generic_name, barcode, category, stock, purchase_price, selling_price } = req.body;

  if (!name || stock === undefined || !purchase_price || !selling_price) {
    return res.status(400).json({ error: 'Dori nomi, soni, sotib olingan va sotish narxlari majburiy.' });
  }

  try {
    const medicine = await dbGet(`SELECT * FROM medicines WHERE id = ?`, [id]);
    if (!medicine) {
      return res.status(404).json({ error: 'Dori topilmadi.' });
    }

    if (barcode) {
      const existing = await dbGet(`SELECT id FROM medicines WHERE barcode = ? AND id != ?`, [barcode.trim(), id]);
      if (existing) {
        return res.status(400).json({ error: 'Ushbu shtrix-kod boshqa dori uchun ishlatilmoqda.' });
      }
    }

    await dbRun(
      `UPDATE medicines SET name = ?, generic_name = ?, barcode = ?, category = ?, stock = ?, purchase_price = ?, selling_price = ?
       WHERE id = ?`,
      [
        name.trim(),
        generic_name ? generic_name.trim() : null,
        barcode ? barcode.trim() : null,
        category ? category.trim() : null,
        parseInt(stock),
        parseFloat(purchase_price),
        parseFloat(selling_price),
        id
      ]
    );

    await logAudit(req.user.id, 'UPDATE_MEDICINE', `Dori yangilandi: ${name} (Soni: ${stock}, Sotish narxi: ${selling_price})`, req.ip);

    res.json({ message: 'Dori ma\'lumotlari muvaffaqiyatli yangilandi.' });
  } catch (error) {
    res.status(500).json({ error: 'Dorini yangilashda xatolik yuz berdi.' });
  }
};

const deleteMedicine = async (req, res) => {
  const { id } = req.params;

  try {
    const medicine = await dbGet(`SELECT name FROM medicines WHERE id = ?`, [id]);
    if (!medicine) {
      return res.status(404).json({ error: 'Dori topilmadi.' });
    }

    await dbRun(`DELETE FROM medicines WHERE id = ?`, [id]);
    await logAudit(req.user.id, 'DELETE_MEDICINE', `Dori o'chirildi: ${medicine.name}`, req.ip);

    res.json({ message: 'Dori muvaffaqiyatli o\'chirildi.' });
  } catch (error) {
    res.status(500).json({ error: 'Dorini o\'chirishda xatolik yuz berdi.' });
  }
};

module.exports = {
  getMedicines,
  getMedicineById,
  getMedicineByBarcode,
  createMedicine,
  updateMedicine,
  deleteMedicine
};
