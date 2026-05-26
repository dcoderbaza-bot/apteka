let activeTab = 'dashboard';
let medicinesList = [];
let usersList = [];
let salesChart = null;

// Reusable toast
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  toastMessage.textContent = message;
  toast.className = `toast toast-${type} show`;
  toastIcon.textContent = type === 'success' ? '✔️' : '⚠️';

  setTimeout(() => {
    toast.className = 'toast';
  }, 4000);
}

// Authentication Check
function checkAuth() {
  const token = localStorage.getItem('token');
  let user = null;
  try {
    const raw = localStorage.getItem('user');
    user = raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.clear();
    window.location.href = '/index.html';
    return null;
  }

  if (!token || !user || user.role !== 'admin') {
    localStorage.clear();
    window.location.href = '/index.html';
    return null;
  }

  // Display admin details
  document.getElementById('adminName').textContent = user.fullname;
  return token;
}

const token = checkAuth();

if (token) {
  document.querySelectorAll('.nav-item[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ==========================================
// 🧭 TAB NAVIGATION LOGIC
// ==========================================
window.switchTab = function(tabId) {
  activeTab = tabId;
  
  // Update nav buttons active state
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Find current button and activate
  const currentBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
  if (currentBtn) currentBtn.classList.add('active');

  // Switch tab display
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.getElementById(`tab-${tabId}`).classList.add('active');

  // Trigger tab data reloading
  if (tabId === 'dashboard') loadDashboardStats();
  if (tabId === 'inventory') loadMedicines();
  if (tabId === 'users') loadUsers();
  if (tabId === 'reports') loadTelegramStatus();
};

// ==========================================
// 📊 DASHBOARD AND ANALYTICS LOGIC
// ==========================================
async function loadDashboardStats() {
  try {
    const response = await fetch('/api/reports/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      window.location.href = '/index.html';
      return;
    }

    const stats = await response.json();

    // Populate KPIs
    document.getElementById('statToday').textContent = `${stats.todaySales.toLocaleString('uz-UZ')} UZS`;
    document.getElementById('statMonth').textContent = `${stats.monthSales.toLocaleString('uz-UZ')} UZS`;
    document.getElementById('statProfit').textContent = `${stats.netProfit.toLocaleString('uz-UZ')} UZS`;
    document.getElementById('statLowStock').textContent = `${stats.lowStockCount} ta`;

    // Low stock warning highlight
    const lowStockCard = document.getElementById('kpiLowStockCard');
    if (stats.lowStockCount > 0) {
      lowStockCard.classList.add('alert-active');
    } else {
      lowStockCard.classList.remove('alert-active');
    }

    // Top Selling Medicines List
    const topList = document.getElementById('topMedicinesList');
    topList.innerHTML = '';
    if (stats.topMedicines.length === 0) {
      topList.innerHTML = '<p class="text-muted">Hozircha sotuvlar yo\'q.</p>';
    } else {
      stats.topMedicines.forEach(item => {
        const row = document.createElement('div');
        row.className = 'top-item-row';
        row.innerHTML = `
          <span class="top-item-name">${item.name}</span>
          <span class="top-item-sold">${item.total_sold} dona sotildi</span>
        `;
        topList.appendChild(row);
      });
    }

    // Render Weekly Sales Chart
    renderChart(stats.chartData);

  } catch (error) {
    console.error('Failed to load dashboard stats:', error);
    showToast('Statistikalarni yuklashda xatolik yuz berdi.', 'error');
  }
}

function renderChart(chartData) {
  const ctx = document.getElementById('salesChart').getContext('2d');
  
  if (salesChart) {
    salesChart.destroy();
  }

  const labels = chartData.map(d => d.date);
  const data = chartData.map(d => d.total);

  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Kunlik sotuv summasi (UZS)',
        data: data,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#f8fafc' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

// ==========================================
// 📦 INVENTORY / MEDICINE CRUD
// ==========================================
async function loadMedicines(search = '') {
  try {
    const response = await fetch(`/api/medicines?search=${encodeURIComponent(search)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    medicinesList = data.medicines || [];
    renderMedicinesTable();
  } catch (error) {
    console.error('Inventory fetch error:', error);
    showToast('Dorilar ro\'yxatini yuklashda xatolik yuz berdi.', 'error');
  }
}

function renderMedicinesTable() {
  const tbody = document.getElementById('medicineTableBody');
  tbody.innerHTML = '';

  if (medicinesList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Dorilar mavjud emas yoki qidiruv bo\'yicha topilmadi.</td></tr>';
    return;
  }

  medicinesList.forEach(med => {
    const tr = document.createElement('tr');
    const isLow = med.stock <= 5;
    const stockBadge = isLow ? `<span class="badge badge-rose">Oz qoldi: ${med.stock}</span>` : `<span class="badge badge-emerald">${med.stock}</span>`;

    tr.innerHTML = `
      <td style="font-weight: 600;">${med.name}</td>
      <td class="text-secondary italic">${med.generic_name || '-'}</td>
      <td><code>${med.barcode || '-'}</code></td>
      <td>${med.category || '-'}</td>
      <td>${stockBadge}</td>
      <td>${med.purchase_price.toLocaleString('uz-UZ')}</td>
      <td style="font-weight: 600; color: var(--accent-emerald);">${med.selling_price.toLocaleString('uz-UZ')}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-warning btn-sm" onclick="editMedicine(${med.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMedicine(${med.id})">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Medicine Search filter
const inventorySearch = document.getElementById('inventorySearch');
let inventorySearchTimeout;
inventorySearch.addEventListener('input', (e) => {
  clearTimeout(inventorySearchTimeout);
  inventorySearchTimeout = setTimeout(() => {
    loadMedicines(e.target.value);
  }, 350);
});

// Medicine Modal — avval skaner, keyin qolgan maydonlar
const medBarcodeInput = document.getElementById('medBarcode');
const medScanStatus = document.getElementById('medScanStatus');
const medicineDetailsStep = document.getElementById('medicineDetailsStep');
const medicineScanStep = document.getElementById('medicineScanStep');
const medicineSubmitBtn = document.getElementById('medicineSubmitBtn');

function setMedScanStatus(text, state = '') {
  if (!medScanStatus) return;
  medScanStatus.textContent = text;
  medScanStatus.className = 'med-scan-status' + (state ? ` ${state}` : '');
}

function resetMedicineFormSteps() {
  medicineDetailsStep?.classList.add('is-hidden');
  medicineScanStep?.classList.remove('is-hidden');
  if (medicineSubmitBtn) medicineSubmitBtn.disabled = true;
  setMedScanStatus('Skaner tayyor — shtrix-kodni skaner qiling');
}

function showMedicineDetailsStep() {
  medicineDetailsStep?.classList.remove('is-hidden');
  if (medicineSubmitBtn) medicineSubmitBtn.disabled = false;
}

function focusMedBarcode() {
  setTimeout(() => {
    medBarcodeInput?.focus();
    medBarcodeInput?.select();
  }, 100);
}

async function isBarcodeTaken(barcode, excludeId = '') {
  try {
    const response = await fetch(`/api/medicines/barcode/${encodeURIComponent(barcode)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (!excludeId) return true;
    return String(data.medicine?.id) !== String(excludeId);
  } catch {
    return false;
  }
}

async function handleMedicineBarcodeScan() {
  const code = medBarcodeInput?.value.trim();
  if (!code || code.length < 3) {
    setMedScanStatus('Shtrix-kod juda qisqa', 'error');
    showToast('To\'g\'ri shtrix-kod skaner qiling', 'error');
    return;
  }

  const editId = document.getElementById('medId').value;
  setMedScanStatus('Shtrix-kod tekshirilmoqda...', 'scanning');

  const taken = await isBarcodeTaken(code, editId);
  if (taken && !editId) {
    setMedScanStatus('Bu shtrix-kod allaqachon mavjud!', 'error');
    showToast('Bu shtrix-kod boshqa dori uchun ishlatilgan', 'error');
    medBarcodeInput?.select();
    return;
  }

  showMedicineDetailsStep();
  setMedScanStatus(`✔ Shtrix-kod qabul qilindi: ${code}`, 'success');

  if (!editId) {
    document.getElementById('medName')?.focus();
  }
}

medBarcodeInput?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  handleMedicineBarcodeScan();
});

// Medicine Modal Handlers
window.openMedicineModal = function() {
  document.getElementById('medicineForm').reset();
  document.getElementById('medId').value = '';
  document.getElementById('medicineModalTitle').textContent = 'Yangi Dori Qo\'shish';
  resetMedicineFormSteps();
  document.getElementById('medicineModal').classList.add('active');
  focusMedBarcode();
};

window.closeMedicineModal = function() {
  document.getElementById('medicineModal').classList.remove('active');
  resetMedicineFormSteps();
};

window.editMedicine = async function(id) {
  try {
    const response = await fetch(`/api/medicines/id/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) return;

    const med = data.medicine;
    document.getElementById('medId').value = med.id;
    document.getElementById('medName').value = med.name;
    document.getElementById('medGeneric').value = med.generic_name || '';
    document.getElementById('medBarcode').value = med.barcode || '';
    document.getElementById('medCategory').value = med.category || '';
    document.getElementById('medStock').value = med.stock;
    document.getElementById('medPurchase').value = med.purchase_price;
    document.getElementById('medSelling').value = med.selling_price;

    document.getElementById('medicineModalTitle').textContent = 'Dorini Tahrirlash';
    showMedicineDetailsStep();
    setMedScanStatus('Tahrirlash rejimi — shtrix-kodni o\'zgartirsangiz Enter bosing', '');
    document.getElementById('medicineModal').classList.add('active');
    document.getElementById('medName')?.focus();
  } catch (error) {
    showToast('Dori ma\'lumotlarini yuklashda xatolik yuz berdi.', 'error');
  }
};

document.getElementById('medicineForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('medId').value;
  const barcode = document.getElementById('medBarcode').value.trim();

  if (!id && medicineDetailsStep?.classList.contains('is-hidden')) {
    showToast('Avval shtrix-kodni skaner qiling', 'error');
    focusMedBarcode();
    return;
  }

  if (!barcode) {
    showToast('Shtrix-kod majburiy', 'error');
    focusMedBarcode();
    return;
  }

  const payload = {
    name: document.getElementById('medName').value,
    generic_name: document.getElementById('medGeneric').value,
    barcode: document.getElementById('medBarcode').value,
    category: document.getElementById('medCategory').value,
    stock: parseInt(document.getElementById('medStock').value),
    purchase_price: parseFloat(document.getElementById('medPurchase').value),
    selling_price: parseFloat(document.getElementById('medSelling').value)
  };

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/medicines/${id}` : '/api/medicines';

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Saqlashda xatolik yuz berdi.', 'error');
      return;
    }

    showToast(data.message || 'Dori muvaffaqiyatli saqlandi!', 'success');
    closeMedicineModal();
    loadMedicines();
  } catch (error) {
    showToast('Taqdim etishda xatolik yuz berdi.', 'error');
  }
});

window.deleteMedicine = async function(id) {
  if (!confirm('Haqiqatdan ham ushbu dorini o\'chirmoqchisiz? Bu amalni ortga qaytarib bo\'lmaydi.')) return;

  try {
    const response = await fetch(`/api/medicines/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'O\'chirishda xatolik yuz berdi.', 'error');
      return;
    }

    showToast(data.message, 'success');
    loadMedicines();
  } catch (error) {
    showToast('O\'chirish jarayonida tarmoq xatoligi.', 'error');
  }
};

// ==========================================
// 👥 USER MANAGEMENT LOGIC
// ==========================================
async function loadUsers() {
  try {
    const response = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    usersList = data.users || [];
    renderUsersTable();
  } catch (error) {
    console.error('Users load error:', error);
    showToast('Xodimlarni yuklashda xatolik yuz berdi.', 'error');
  }
}

function renderUsersTable() {
  const tbody = document.getElementById('userTableBody');
  tbody.innerHTML = '';

  usersList.forEach(usr => {
    const tr = document.createElement('tr');
    const statusBadge = usr.status === 1 
      ? '<span class="badge badge-emerald">Faol</span>' 
      : '<span class="badge badge-rose">Bloklangan</span>';

    tr.innerHTML = `
      <td style="font-weight: 600;">${usr.fullname}</td>
      <td><code>@${usr.username}</code></td>
      <td><span class="badge ${usr.role === 'admin' ? 'badge-rose' : 'badge-emerald'}">${usr.role}</span></td>
      <td>${statusBadge}</td>
      <td>${new Date(usr.created_at).toLocaleDateString('uz-UZ')}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-warning btn-sm" onclick="editUser(${usr.id})">✏️ Tahrirlash</button>
          <button class="btn btn-secondary btn-sm" onclick="openResetPassword(${usr.id}, '${usr.fullname}')">🔑 Parol</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${usr.id})">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openUserModal = function() {
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('userPasswordGroup').style.display = 'block';
  document.getElementById('userPassword').required = true;
  document.getElementById('userStatusGroup').style.display = 'none';
  document.getElementById('userModalTitle').textContent = 'Yangi Xodim Qo\'shish';
  document.getElementById('userModal').classList.add('active');
};

window.closeUserModal = function() {
  document.getElementById('userModal').classList.remove('active');
};

window.editUser = async function(id) {
  const usr = usersList.find(u => u.id === id);
  if (!usr) return;

  document.getElementById('userId').value = usr.id;
  document.getElementById('userFullname').value = usr.fullname;
  document.getElementById('userUsername').value = usr.username;
  document.getElementById('userPasswordGroup').style.display = 'none';
  document.getElementById('userPassword').required = false;
  document.getElementById('userRole').value = usr.role;
  document.getElementById('userStatusGroup').style.display = 'block';
  document.getElementById('userStatus').value = usr.status;

  document.getElementById('userModalTitle').textContent = 'Xodim ma\'lumotlarini tahrirlash';
  document.getElementById('userModal').classList.add('active');
};

document.getElementById('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('userId').value;
  const payload = {
    fullname: document.getElementById('userFullname').value,
    username: document.getElementById('userUsername').value,
    role: document.getElementById('userRole').value,
  };

  if (!id) {
    payload.password = document.getElementById('userPassword').value;
  } else {
    payload.status = parseInt(document.getElementById('userStatus').value);
  }

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/users/${id}` : '/api/users';

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Xodimni saqlashda xatolik.', 'error');
      return;
    }

    showToast(data.message, 'success');
    closeUserModal();
    loadUsers();
  } catch (error) {
    showToast('Xatolik yuz berdi.', 'error');
  }
});

window.openResetPassword = function(userId, fullname) {
  document.getElementById('resetNewPassword').value = '';
  document.getElementById('resetUserId').value = userId;
  document.getElementById('resetUserHeading').textContent = `Xodim: ${fullname}`;
  document.getElementById('resetPasswordModal').classList.add('active');
};

window.closeResetPasswordModal = function() {
  document.getElementById('resetPasswordModal').classList.remove('active');
};

document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('resetUserId').value;
  const newPassword = document.getElementById('resetNewPassword').value;

  try {
    const response = await fetch(`/api/users/${id}/reset-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ newPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Parolni yangilashda xatolik.', 'error');
      return;
    }

    showToast(data.message, 'success');
    closeResetPasswordModal();
  } catch (error) {
    showToast('Xatolik yuz berdi.', 'error');
  }
});

window.deleteUser = async function(id) {
  if (!confirm('Ushbu xodimni butunlay o\'chirmoqchisiz?')) return;

  try {
    const response = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'O\'chirishda xatolik.', 'error');
      return;
    }

    showToast(data.message, 'success');
    loadUsers();
  } catch (error) {
    showToast('Xatolik yuz berdi.', 'error');
  }
};

// ==========================================
// 📈 REPORTS & TELEGRAM INTEGRATION
// ==========================================
async function loadTelegramStatus() {
  const box = document.getElementById('telegramStatusBox');
  const icon = document.getElementById('telegramStatusIcon');
  const title = document.getElementById('telegramStatusTitle');
  const text = document.getElementById('telegramStatusText');

  if (!box) return;

  try {
    const response = await fetch('/api/reports/telegram/status', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (data.connected) {
      box.className = 'telegram-status-box glass-card connected';
      icon.textContent = '🟢';
      title.textContent = 'Telegram bot ulangan';
      text.textContent = `Hisobotlar Chat ID ${data.chatId} ga yuboriladi.`;
    } else if (data.configured) {
      box.className = 'telegram-status-box glass-card disconnected';
      icon.textContent = '🟡';
      title.textContent = 'Telegram bot tayyor, lekin ulanmagan';
      text.textContent = '@Apteka_hisobot_uz_bot ga kirib /start yuboring, keyin sahifani yangilang.';
    } else {
      box.className = 'telegram-status-box glass-card disconnected';
      icon.textContent = '🔴';
      title.textContent = 'Telegram token sozlanmagan';
      text.textContent = '.env faylida TELEGRAM_BOT_TOKEN ni kiriting.';
    }
  } catch (error) {
    box.className = 'telegram-status-box glass-card disconnected';
    icon.textContent = '⚠️';
    title.textContent = 'Telegram holatini tekshirib bo\'lmadi';
    text.textContent = 'Server bilan aloqani tekshiring.';
  }

  // Fetch secure environment diagnostics for Admin UI
  try {
    const diagResponse = await fetch('/api/admin/diagnose-env', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (diagResponse.ok) {
      const diag = await diagResponse.json();
      const diagBox = document.getElementById('diagnosticsBox');
      const diagContent = document.getElementById('diagnosticsContent');
      if (diagBox && diagContent) {
        diagBox.style.display = 'block';
        diagContent.innerHTML = `
          <div>🌐 <strong>Vercel Muhit:</strong> ${diag.isVercel ? '🟢 Ha (Vercel Cloud)' : '💻 Yo\'q (Localhost)'}</div>
          <div>🤖 <strong>Bot Token:</strong> ${diag.telegramBotToken.defined ? '🟢 Kiritilgan' : '🔴 Kiritilmagan'} (Uzunligi: ${diag.telegramBotToken.length} belgi, Boshlanishi: <code>${diag.telegramBotToken.prefix}</code>)</div>
          <div>💬 <strong>Telegram Chat ID:</strong> ${diag.telegramChatId.defined ? '🟢 Kiritilgan' : '🔴 Kiritilmagan'} (Qiymat: <code>${diag.telegramChatId.value}</code>)</div>
          <div>🔑 <strong>JWT Maxfiy Kalit:</strong> ${diag.jwtSecret.defined ? '🟢 Kiritilgan' : '🔴 Kiritilmagan'}</div>
          <div style="margin-top: 10px; font-size: 0.8rem; color: #94a3b8;">💡 <em>Agar kiritilgan bo'lsa ham qizil bo'lsa, Vercel Dashboard'da o'zgaruvchini saqlab, loyihani qayta deploy qilishingiz lozim.</em></div>
        `;
      }
    }
  } catch (e) {
    console.warn('Diagnostics fetch failed:', e);
  }
}

window.sendReportToTelegram = async function(type, clickedBtn) {
  const currentBtn = clickedBtn || (typeof event !== 'undefined' ? event.currentTarget : null);
  if (!currentBtn) return;
  const originalText = currentBtn.innerHTML;

  // Visual loading feedback
  currentBtn.disabled = true;
  currentBtn.innerHTML = 'Hisobot shakllanmoqda... ⏳';

  try {
    const response = await fetch(`/api/reports/telegram?type=${type}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Hisobot yuborishda xatolik yuz berdi.', 'error');
      loadTelegramStatus();
      return;
    }

    showToast('Excel hisoboti Telegram bot orqali muvaffaqiyatli yuborildi! 🚀', 'success');
    loadTelegramStatus();

  } catch (error) {
    console.error('Telegram trigger error:', error);
    showToast('Tarmoq xatoligi yoki Telegram bot credential-lari xato kiritilgan.', 'error');
  } finally {
    currentBtn.disabled = false;
    currentBtn.innerHTML = originalText;
  }
};

// Logout handler
if (token) {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = '/index.html';
  });

  // Initial Dashboard Load
  loadDashboardStats();
}
