const rateLimit = require('express-rate-limit');

// Limit login attempts to prevent brute-force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per 15 minutes
  message: {
    error: 'Haddan tashqari ko\'p urinishlar qilindi. Iltimos 15 daqiqadan so\'ng qayta urinib ko\'ring.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// General API rate limiter to prevent server overloading
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: {
    error: 'Haddan tashqari ko\'p so\'rovlar. Iltimos birozdan so\'ng urinib ko\'ring.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  apiLimiter
};
