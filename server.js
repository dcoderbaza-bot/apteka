require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const { initializeDatabase } = require('./config/database');

const { loginLimiter, apiLimiter } = require('./middleware/rateLimiter');
const { authenticateToken, authorizeRole } = require('./middleware/auth');

// Controllers
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const medicineController = require('./controllers/medicineController');
const salesController = require('./controllers/salesController');
const reportController = require('./controllers/reportController');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database tables and default admin account
initializeDatabase();

// 1. Cybersecurity: Helmet secures HTTP Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://va.vercel-scripts.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://vitals.vercel-insights.com"]
    }
  }
}));

// Body parser
app.use(express.json());

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, 'public')));

// Apply general API Rate Limiter
app.use('/api/', apiLimiter);

// ==========================================
// 🔐 AUTHENTICATION ENDPOINTS
// ==========================================
app.post('/api/auth/login', loginLimiter, authController.login);
app.get('/api/auth/me', authenticateToken, authController.getMe);
app.put('/api/auth/change-password', authenticateToken, authController.changePassword);

// ==========================================
// 👥 USER MANAGEMENT (ADMIN ONLY)
// ==========================================
app.get('/api/users', authenticateToken, authorizeRole('admin'), userController.getUsers);
app.post('/api/users', authenticateToken, authorizeRole('admin'), userController.createUser);
app.put('/api/users/:id', authenticateToken, authorizeRole('admin'), userController.updateUser);
app.put('/api/users/:id/reset-password', authenticateToken, authorizeRole('admin'), userController.resetPassword);
app.delete('/api/users/:id', authenticateToken, authorizeRole('admin'), userController.deleteUser);

// ==========================================
// 📦 MEDICINES / INVENTORY MANAGEMENT
// ==========================================
// Sellers and Admins can view/search
app.get('/api/medicines', authenticateToken, medicineController.getMedicines);
app.get('/api/medicines/id/:id', authenticateToken, medicineController.getMedicineById);
app.get('/api/medicines/barcode/:barcode', authenticateToken, medicineController.getMedicineByBarcode);
// Admins only can add, edit, or delete
app.post('/api/medicines', authenticateToken, authorizeRole('admin'), medicineController.createMedicine);
app.put('/api/medicines/:id', authenticateToken, authorizeRole('admin'), medicineController.updateMedicine);
app.delete('/api/medicines/:id', authenticateToken, authorizeRole('admin'), medicineController.deleteMedicine);

// ==========================================
// 🛒 SALES & TRANSACTION MANAGEMENT
// ==========================================
// Both roles can record a sale
app.post('/api/sales', authenticateToken, salesController.createSale);
app.get('/api/sales', authenticateToken, salesController.getSalesHistory);
app.get('/api/sales/:id', authenticateToken, salesController.getSaleDetails);

// ==========================================
// 📊 STATS & TELEGRAM EXCEL REPORTS
// ==========================================
app.get('/api/reports/stats', authenticateToken, authorizeRole('admin'), reportController.getDashboardStats);
app.get('/api/reports/telegram/status', authenticateToken, authorizeRole('admin'), reportController.getTelegramConnectionStatus);
app.post('/api/reports/telegram', authenticateToken, authorizeRole('admin'), reportController.sendTelegramReport);

// ==========================================
// 🤖 TELEGRAM WEBHOOK ENDPOINT (VERCEL RUNTIME)
// ==========================================
app.post('/api/telegram-webhook', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    return res.status(400).send('Telegram Bot Token is not configured.');
  }
  try {
    const { handleUpdate } = require('./utils/telegramPoller');
    await handleUpdate(token, req.body);
    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).send('Webhook processing error: ' + err.message);
  }
});

// ==========================================
// FALLBACK ROUTING TO FRONTEND
// ==========================================
// Redirect any unhandled route to login/main index page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Telegram bot — /start orqali chat ID ni qabul qiladi
const { startTelegramPoller } = require('./utils/telegramPoller');

// Start Express Server only if not on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🏥 Apteka Automation System running on Port ${PORT}`);
    console.log(`🔐 Mode: ${process.env.NODE_ENV || 'production'}`);
    console.log(`=================================================`);
    startTelegramPoller();
  });
}

module.exports = app;
