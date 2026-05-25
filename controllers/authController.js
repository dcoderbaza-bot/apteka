const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbGet, dbRun, logAudit } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'apteka_secure_jwt_secret_key_2026_xyz';

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Foydalanuvchi nomi va parol kiritilishi shart.' });
  }

  try {
    const user = await dbGet(`SELECT * FROM users WHERE username = ?`, [username.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol xato.' });
    }

    if (user.status !== 1) {
      return res.status(403).json({ error: 'Ushbu foydalanuvchi faolsizlantirilgan. Admin bilan bog\'laning.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol xato.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, fullname: user.fullname },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Audit login
    await logAudit(user.id, 'LOGIN', 'Tizimga muvaffaqiyatli kirdi', req.ip);

    res.json({
      message: 'Tizimga muvaffaqiyatli kirildi.',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullname: user.fullname
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Tizimda xatolik yuz berdi. Qayta urinib ko\'ring.' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await dbGet(`SELECT id, username, role, fullname, status, created_at FROM users WHERE id = ?`, [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Tizimda xatolik yuz berdi.' });
  }
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Eski va yangi parollar kiritilishi shart.' });
  }

  try {
    const user = await dbGet(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Eski parol noto\'g\'ri.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbRun(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, req.user.id]);
    await logAudit(req.user.id, 'PASSWORD_CHANGE', 'Parolini muvaffaqiyatli o\'zgartirdi', req.ip);

    res.json({ message: 'Parol muvaffaqiyatli o\'zgartirildi.' });
  } catch (error) {
    res.status(500).json({ error: 'Parolni o\'zgartirishda xatolik yuz berdi.' });
  }
};

module.exports = {
  login,
  getMe,
  changePassword
};
