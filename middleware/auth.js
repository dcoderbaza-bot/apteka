const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'apteka_secure_jwt_secret_key_2026_xyz';

const authenticateToken = (req, res, next) => {
  let token = req.headers['authorization'];
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7, token.length).trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Kirish taqiqlangan. Token topilmadi.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Noto\'g\'ri yoki muddati o\'tgan token.' });
  }
};

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Ushbu amalni bajarish uchun huquqingiz yetarli emas.' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole
};
