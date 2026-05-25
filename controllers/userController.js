const bcrypt = require('bcryptjs');
const { dbGet, dbRun, dbAll, logAudit } = require('../config/database');

const getUsers = async (req, res) => {
  try {
    const users = await dbAll(`SELECT id, username, role, fullname, status, created_at FROM users ORDER BY created_at DESC`);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Foydalanuvchilarni yuklashda xatolik yuz berdi.' });
  }
};

const createUser = async (req, res) => {
  const { username, password, role, fullname } = req.body;

  if (!username || !password || !role || !fullname) {
    return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart.' });
  }

  if (!['admin', 'seller'].includes(role)) {
    return res.status(400).json({ error: 'Noto\'g\'ri foydalanuvchi roli.' });
  }

  try {
    const existing = await dbGet(`SELECT id FROM users WHERE username = ?`, [username.toLowerCase().trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Ushbu foydalanuvchi nomi band. Boshqasini tanlang.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      `INSERT INTO users (username, password, role, fullname, status) VALUES (?, ?, ?, ?, 1)`,
      [username.toLowerCase().trim(), hashedPassword, role, fullname.trim()]
    );

    await logAudit(req.user.id, 'CREATE_USER', `Yangi foydalanuvchi yaratildi: ${username} (${role})`, req.ip);

    res.status(201).json({
      message: 'Foydalanuvchi muvaffaqiyatli yaratildi.',
      userId: result.lastID
    });
  } catch (error) {
    res.status(500).json({ error: 'Foydalanuvchini yaratishda xatolik yuz berdi.' });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { fullname, role, status } = req.body;

  if (!fullname || !role || status === undefined) {
    return res.status(400).json({ error: 'Barcha maydonlar to\'ldirilishi shart.' });
  }

  try {
    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    // Prevent self-disabling or role demotion
    if (parseInt(id) === req.user.id && (status === 0 || role !== 'admin')) {
      return res.status(400).json({ error: 'O\'z rolingizni yoki holatingizni o\'zgartira olmaysiz.' });
    }

    await dbRun(
      `UPDATE users SET fullname = ?, role = ?, status = ? WHERE id = ?`,
      [fullname.trim(), role, status, id]
    );

    await logAudit(req.user.id, 'UPDATE_USER', `Foydalanuvchi ma'lumotlari tahrirlandi: ID ${id} (${fullname})`, req.ip);

    res.json({ message: 'Foydalanuvchi ma\'lumotlari muvaffaqiyatli tahrirlandi.' });
  } catch (error) {
    res.status(500).json({ error: 'Tahrirlashda xatolik yuz berdi.' });
  }
};

const resetPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: 'Yangi parol kiritilishi shart.' });
  }

  try {
    const user = await dbGet(`SELECT username FROM users WHERE id = ?`, [id]);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbRun(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, id]);

    await logAudit(req.user.id, 'RESET_PASSWORD', `Foydalanuvchi paroli admin tomonidan tiklandi: ${user.username}`, req.ip);

    res.json({ message: 'Parol muvaffaqiyatli tiklandi.' });
  } catch (error) {
    res.status(500).json({ error: 'Parolni tiklashda xatolik yuz berdi.' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'O\'zingizning profilingizni o\'chira olmaysiz.' });
  }

  try {
    const user = await dbGet(`SELECT username FROM users WHERE id = ?`, [id]);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }

    await dbRun(`DELETE FROM users WHERE id = ?`, [id]);
    await logAudit(req.user.id, 'DELETE_USER', `Foydalanuvchi o'chirildi: ${user.username}`, req.ip);

    res.json({ message: 'Foydalanuvchi muvaffaqiyatli o\'chirildi.' });
  } catch (error) {
    res.status(500).json({ error: 'Foydalanuvchini o\'chirishda xatolik yuz berdi.' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  resetPassword,
  deleteUser
};
