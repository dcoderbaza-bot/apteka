let medicines = [];
let cart = [];

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

  if (!token || !user) {
    localStorage.clear();
    window.location.href = '/index.html';
    return null;
  }

  // Display user details
  document.getElementById('sellerName').textContent = user.fullname;
  document.getElementById('sellerUsername').textContent = `@${user.username}`;
  return token;
}

const token = checkAuth();

if (!token) {
  // Redirect in progress; skip binding handlers
} else {
  initSellerPanel();
}

function initSellerPanel() {
const searchInput = document.getElementById('searchInput');
const scannerStatus = document.getElementById('scannerStatus');

let scanBuffer = '';
let scanLastKeyAt = 0;
const SCAN_GAP_MS = 80;
const MIN_BARCODE_LEN = 3;

function setScannerStatus(text, state = '') {
  if (!scannerStatus) return;
  scannerStatus.textContent = text;
  scannerStatus.className = 'scanner-status' + (state ? ` ${state}` : '');
}

function focusScanner() {
  if (searchInput && !document.getElementById('receiptModal')?.classList.contains('active')) {
    searchInput.focus();
    searchInput.select();
  }
}

function ensureMedicineInList(med) {
  const idx = medicines.findIndex((m) => m.id === med.id);
  if (idx === -1) {
    medicines.unshift(med);
  } else {
    medicines[idx] = med;
  }
}

async function lookupByBarcode(barcode) {
  const response = await fetch(`/api/medicines/barcode/${encodeURIComponent(barcode)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  return { ok: response.ok, data };
}

async function handleBarcodeScan(barcode) {
  const code = barcode.trim();
  if (!code || code.length < MIN_BARCODE_LEN) return false;

  setScannerStatus('Skaner qidirilmoqda...', 'scanning');

  try {
    const { ok, data } = await lookupByBarcode(code);

    if (!ok) {
      setScannerStatus(data.error || 'Shtrix-kod bo\'yicha dori topilmadi', 'error');
      showToast(data.error || 'Shtrix-kod bo\'yicha dori topilmadi', 'error');
      return false;
    }

    const med = data.medicine;
    ensureMedicineInList(med);
    addToCart(med.id);
    setScannerStatus(`✔ ${med.name} aravaga qo'shildi`, 'success');
    showToast(`${med.name} aravaga qo'shildi`, 'success');
    renderInventory();
    return true;
  } catch (error) {
    console.error('Barcode scan error:', error);
    setScannerStatus('Skaner xatoligi — qayta urinib ko\'ring', 'error');
    showToast('Skaner qidiruvida tarmoq xatoligi', 'error');
    return false;
  } finally {
    focusScanner();
  }
}

function isReceiptOpen() {
  return document.getElementById('receiptModal')?.classList.contains('active');
}

function isOtherFormFieldFocused() {
  const el = document.activeElement;
  if (!el || el === searchInput) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

// USB/HID skaner: klaviatura kabi tez yozadi + Enter bosadi
document.addEventListener('keydown', (e) => {
  if (isReceiptOpen() || isOtherFormFieldFocused()) return;

  if (document.activeElement === searchInput) {
    scanBuffer = '';
    return;
  }

  const now = Date.now();

  if (e.key === 'Enter') {
    if (document.activeElement === searchInput) return;

    if (scanBuffer.length >= MIN_BARCODE_LEN) {
      e.preventDefault();
      const code = scanBuffer;
      scanBuffer = '';
      handleBarcodeScan(code);
    }
    return;
  }

  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;

  if (now - scanLastKeyAt > SCAN_GAP_MS) {
    scanBuffer = '';
  }
  scanLastKeyAt = now;
  scanBuffer += e.key;

  if (document.activeElement !== searchInput) {
    e.preventDefault();
  }
});

searchInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  clearTimeout(searchTimeout);

  const value = searchInput.value.trim();
  searchInput.value = '';

  if (!value) {
    focusScanner();
    return;
  }

  const found = await handleBarcodeScan(value);
  if (!found) {
    setScannerStatus('Nom bo\'yicha qidirilmoqda...', 'scanning');
    await loadMedicines(value);
    setScannerStatus('Skaner tayyor — shtrix-kodni skaner qiling', '');
  }
});

// Sahifaga qaytganda skaner maydoni fokusda bo'lsin
document.addEventListener('click', (e) => {
  if (isReceiptOpen()) return;
  if (e.target.closest('button, a, label, input, textarea, select, .modal')) return;
  focusScanner();
});

window.addEventListener('focus', () => {
  if (!isReceiptOpen()) focusScanner();
});

// Load Medicines from API
async function loadMedicines(search = '') {
  try {
    const response = await fetch(`/api/medicines?search=${encodeURIComponent(search)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      window.location.href = '/index.html';
      return;
    }

    const data = await response.json();
    medicines = data.medicines || [];
    renderInventory();
  } catch (error) {
    console.error('Failed to load medicines:', error);
    showToast('Dorilar ro\'yxatini yuklashda xatolik yuz berdi.', 'error');
  }
}

// Render inventory items in grid
function renderInventory() {
  const grid = document.getElementById('inventoryGrid');
  grid.innerHTML = '';

  if (medicines.length === 0) {
    grid.innerHTML = '<div class="empty-cart"><p>Dorilar topilmadi.</p></div>';
    return;
  }

  medicines.forEach(med => {
    const isLow = med.stock <= 5;
    const stockClass = isLow ? 'med-stock low-stock' : 'med-stock';
    const card = document.createElement('div');
    card.className = 'med-card glass-card';
    
    card.innerHTML = `
      <div class="med-header">
        <span class="med-name">${med.name}</span>
        <span class="med-generic">${med.generic_name || 'Noma\'lum tarkib'}</span>
      </div>
      <div>
        <div class="med-meta">
          <span class="${stockClass}">Zaxira: ${med.stock} dona</span>
        </div>
        <div class="med-meta" style="margin-top: 8px; align-items: center;">
          <span class="med-price">${med.selling_price.toLocaleString('uz-UZ')} UZS</span>
          <button class="btn btn-primary btn-sm" onclick="addToCart(${med.id})" ${med.stock <= 0 ? 'disabled' : ''}>
            ${med.stock <= 0 ? 'Tugagan' : 'Aravaga ➕'}
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Cart management
window.addToCart = function(medId) {
  const medicine = medicines.find(m => m.id === medId);
  if (!medicine) return;

  if (medicine.stock <= 0) {
    showToast('Ushbu dori omborda qolmagan!', 'error');
    return;
  }

  const existing = cart.find(item => item.id === medId);
  if (existing) {
    if (existing.quantity >= medicine.stock) {
      showToast(`Omborda faqat ${medicine.stock} dona bor!`, 'error');
      return;
    }
    existing.quantity++;
  } else {
    cart.push({
      id: medicine.id,
      name: medicine.name,
      price: medicine.selling_price,
      quantity: 1,
      maxStock: medicine.stock
    });
  }

  renderCart();
  focusScanner();
};

window.removeFromCart = function(medId) {
  cart = cart.filter(item => item.id !== medId);
  renderCart();
};

window.changeQuantity = function(medId, amt) {
  const item = cart.find(i => i.id === medId);
  if (!item) return;

  const newQty = item.quantity + amt;
  if (newQty <= 0) {
    removeFromCart(medId);
  } else if (newQty > item.maxStock) {
    showToast(`Omborda faqat ${item.maxStock} dona bor!`, 'error');
  } else {
    item.quantity = newQty;
    renderCart();
  }
};

function renderCart() {
  const cartContainer = document.getElementById('cartItems');
  cartContainer.innerHTML = '';

  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div class="empty-cart">
        <span>🛒</span>
        <p>Aravacha bo'sh. O'ng tomondan dorilarni qo'shing.</p>
      </div>
    `;
    document.getElementById('totalPrice').textContent = '0 UZS';
    return;
  }

  let total = 0;

  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="cart-item-details">
        <h4>${item.name}</h4>
        <span class="cart-item-price">${item.price.toLocaleString('uz-UZ')} x ${item.quantity} = ${itemTotal.toLocaleString('uz-UZ')} UZS</span>
      </div>
      <div class="cart-item-actions">
        <button class="qty-btn" onclick="changeQuantity(${item.id}, -1)">-</button>
        <span class="qty-input">${item.quantity}</span>
        <button class="qty-btn" onclick="changeQuantity(${item.id}, 1)">+</button>
        <button class="remove-item-btn" onclick="removeFromCart(${item.id})">&times;</button>
      </div>
    `;
    cartContainer.appendChild(div);
  });

  document.getElementById('totalPrice').textContent = `${total.toLocaleString('uz-UZ')} UZS`;
}

// Clear Cart
document.getElementById('clearCartBtn').addEventListener('click', () => {
  cart = [];
  renderCart();
});

// Checkout action
document.getElementById('checkoutBtn').addEventListener('click', async () => {
  if (cart.length === 0) {
    showToast('Aravacha bo\'sh. Sotuv qilish uchun dori tanlang.', 'error');
    return;
  }

  const paymentInput = document.querySelector('input[name="paymentMethod"]:checked');
  if (!paymentInput) {
    showToast('To\'lov usulini tanlang.', 'error');
    return;
  }
  const paymentMethod = paymentInput.value;

  try {
    const checkoutItems = cart.map(item => ({ id: item.id, quantity: item.quantity }));
    
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ items: checkoutItems, paymentMethod })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Savdoni amalga oshirishda xatolik.', 'error');
      return;
    }

    showToast('Savdo muvaffaqiyatli yakunlandi!', 'success');
    
    // Generate and show receipt modal
    showReceipt(data.saleId, paymentMethod);

    // Reset cart and reload stocks
    cart = [];
    renderCart();
    loadMedicines();
    setScannerStatus('Skaner tayyor — keyingi mahsulotni skaner qiling', '');

  } catch (error) {
    console.error('Checkout error:', error);
    showToast('Sotuvda tarmoq xatoligi yuz berdi.', 'error');
  }
});

// Build Receipt details in modal
async function showReceipt(saleId, paymentMethod) {
  try {
    const response = await fetch(`/api/sales/${saleId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok) return;

    const { sale, items } = data;
    const body = document.getElementById('receiptBody');

    let methodText = 'Naqd pul';
    if (paymentMethod === 'card') methodText = 'Plastik karta';
    if (paymentMethod === 'terminal') methodText = 'Terminal';

    let itemsHtml = '';
    items.forEach((item, index) => {
      const subtotal = item.price_at_sale * item.quantity;
      itemsHtml += `
        <div class="receipt-item-row">
          <span>${index + 1}. ${item.medicine_name}</span>
          <span>${item.quantity} x ${item.price_at_sale.toLocaleString('uz-UZ')}</span>
        </div>
        <div class="receipt-item-row" style="padding-bottom: 5px; font-weight: bold; text-align: right;">
          <span></span>
          <span>Subtotal: ${subtotal.toLocaleString('uz-UZ')} UZS</span>
        </div>
      `;
    });

    body.innerHTML = `
      <h2>🏥 SHAFOAT APTEKA</h2>
      <h4>Kvitansiya #${sale.id}</h4>
      <p style="text-align: center; font-size: 0.75rem;">Sana: ${new Date(sale.sold_at).toLocaleString('uz-UZ')}</p>
      <div class="receipt-divider"></div>
      <p>Sotuvchi: ${sale.seller_name}</p>
      <p>To'lov turi: ${methodText}</p>
      <div class="receipt-divider"></div>
      <div class="receipt-items">
        ${itemsHtml}
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-row" style="font-size: 1.1rem; font-weight: bold;">
        <span>JAMI:</span>
        <span>${sale.total_amount.toLocaleString('uz-UZ')} UZS</span>
      </div>
      <div class="receipt-divider"></div>
      <p style="text-align: center; font-weight: bold;">Xaridingiz uchun rahmat!</p>
      <p style="text-align: center; font-size: 0.7rem;">Sog'-salomat bo'ling!</p>
    `;

    document.getElementById('receiptModal').classList.add('active');

  } catch (error) {
    console.error('Failed to show receipt:', error);
  }
}

window.closeReceiptModal = function() {
  document.getElementById('receiptModal').classList.remove('active');
  focusScanner();
};

// Search filtering logic (qo'lda yozish — skaner Enter bilan ishlaydi)
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadMedicines(e.target.value);
  }, 350);
});

// Logout action
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/index.html';
});

// Start Load
loadMedicines();
focusScanner();
}
