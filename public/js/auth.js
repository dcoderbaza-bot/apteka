// Reusable Toast Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  toastMessage.textContent = message;
  
  if (type === 'success') {
    toast.className = 'toast toast-success show';
    toastIcon.textContent = '✔️';
  } else {
    toast.className = 'toast toast-error show';
    toastIcon.textContent = '⚠️';
  }

  setTimeout(() => {
    toast.className = 'toast';
  }, 4000);
}

// Redirect based on role
function redirectUser(role) {
  if (role === 'admin') {
    window.location.href = '/admin.html';
  } else if (role === 'seller') {
    window.location.href = '/seller.html';
  }
}

// Check session on page load
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  if (token && user) {
    // Verify token validity by calling getMe
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        redirectUser(user.role);
      } else {
        localStorage.clear();
      }
    } catch (e) {
      console.error('Session validation failed:', e);
    }
  }
});

// Handle Login Form Submission
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Kirishda xatolik yuz berdi.', 'error');
        return;
      }

      // Store in localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      showToast(data.message, 'success');

      // Redirect user after short delay
      setTimeout(() => {
        redirectUser(data.user.role);
      }, 1000);

    } catch (error) {
      console.error('Login error:', error);
      showToast('Server bilan aloqa uzildi. Iltimos keyinroq qayta urinib ko\'ring.', 'error');
    }
  });
}
