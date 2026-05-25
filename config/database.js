const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Helper for running queries with Promises
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// Helper for getting single row with Promises
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Helper for getting all rows with Promises
const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Log audit events securely
const logAudit = async (userId, action, details, ipAddress = '') => {
  try {
    await dbRun(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [userId, action, details, ipAddress]
    );
  } catch (error) {
    console.error('Audit logging failed:', error.message);
  }
};

const initializeDatabase = async () => {
  // Use serialization to ensure tables are created in order
  db.serialize(async () => {
    try {
      // 1. Create Users Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'seller')),
          fullname TEXT NOT NULL,
          status INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Create Medicines Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS medicines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          generic_name TEXT,
          barcode TEXT UNIQUE,
          category TEXT,
          stock INTEGER NOT NULL DEFAULT 0,
          purchase_price REAL NOT NULL,
          selling_price REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 3. Create Sales Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          seller_id INTEGER,
          total_amount REAL NOT NULL,
          payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'terminal')),
          sold_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(seller_id) REFERENCES users(id)
        )
      `);

      // 4. Create Sale Items Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER,
          medicine_id INTEGER,
          quantity INTEGER NOT NULL,
          price_at_sale REAL NOT NULL,
          FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY(medicine_id) REFERENCES medicines(id)
        )
      `);

      // 5. Create Transactions Table (kirim / chiqim)
      await dbRun(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
          amount REAL NOT NULL,
          description TEXT,
          source TEXT DEFAULT 'telegram',
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 6. Create Audit Logs Table
      await dbRun(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          details TEXT,
          ip_address TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Database tables verified/created successfully.');

      // Check if admin exists, if not seed default admin
      const admin = await dbGet(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
      if (!admin) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await dbRun(`
          INSERT INTO users (username, password, role, fullname, status)
          VALUES ('admin', ?, 'admin', 'Tizim Administratori', 1)
        `, [hashedPassword]);
        console.log('Default Admin user created successfully (username: admin, password: admin123).');
      }

    } catch (err) {
      console.error('Error during database initialization:', err.message);
    }
  });
};

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  logAudit,
  initializeDatabase
};
