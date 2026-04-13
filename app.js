// Konfigurasi
const API_BASE = 'https://autumn-disk-fa08.namecheapel.workers.dev'; // GANTI dengan URL worker Anda
let authToken = localStorage.getItem('authToken');

// Helper Functions
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} text-xl"></i>
    <div class="flex-1">${message}</div>
    <button onclick="this.parentElement.remove()" class="ml-4">
      <i class="fas fa-times"></i>
    </button>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast('URL berhasil disalin!', 'success');
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Authentication
async function login() {
  const password = document.getElementById('password').value;
  const loginError = document.getElementById('loginError');
  
  if (!password) {
    loginError.textContent = 'Password tidak boleh kosong!';
    loginError.classList.remove('hidden');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    if (response.ok) {
      const data = await response.json();
      authToken = data.token;
      localStorage.setItem('authToken', authToken);
      showToast('Login berhasil! Selamat datang admin.', 'success');
      loadDashboard();
    } else {
      loginError.classList.remove('hidden');
      showToast('Password salah!', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Gagal connect ke server!', 'error');
  }
}

function logout() {
  localStorage.removeItem('authToken');
  authToken = null;
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('loginBox').classList.remove('hidden');
  showToast('Logout berhasil!', 'info');
}

// Dashboard Functions
async function loadDashboard() {
  if (!authToken) return;
  
  try {
    await loadStats();
    await loadLinks();
    
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
  } catch (error) {
    console.error('Load dashboard error:', error);
    if (error.message.includes('401') || error.message.includes('403')) {
      logout();
    }
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const stats = await response.json();
      document.getElementById('totalLinks').textContent = stats.total_links || 0;
      document.getElementById('totalClicks').textContent = stats.total_clicks || 0;
      
      // Simulasi today's clicks (bisa ditambahkan di API nanti)
      document.getElementById('todayClicks').textContent = stats.today_clicks || 0;
    }
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

async function loadLinks() {
  const loadingSpinner = document.getElementById('loadingSpinner');
  const tableBody = document.getElementById('table');
  
  loadingSpinner.classList.remove('hidden');
  
  try {
    const response = await fetch(`${API_BASE}/api/links`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      const links = await response.json();
      displayLinks(links);
    } else if (response.status === 401 || response.status === 403) {
      logout();
    }
  } catch (error) {
    console.error('Load links error:', error);
    showToast('Gagal memuat data!', 'error');
  } finally {
    loadingSpinner.classList.add('hidden');
  }
}

function displayLinks(links) {
  const tableBody = document.getElementById('table');
  
  if (!links || links.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-12 text-gray-400">
          <i class="fas fa-inbox text-4xl mb-3 block"></i>
          Belum ada data shortlink
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = links.map((link, index) => `
    <tr class="hover:bg-gray-50 transition">
      <td class="px-6 py-4 font-medium text-gray-600">${index + 1}</td>
      <td class="px-6 py-4">
        <div class="flex items-center gap-2">
          <code class="text-sm bg-gray-100 px-2 py-1 rounded">/${link.slug}</code>
          <button onclick="copyToClipboard('https://lynkz.site/${link.slug}')" 
                  class="copy-btn text-xs">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </td>
      <td class="px-6 py-4">
        <div class="max-w-xs truncate">
          <a href="${link.url}" target="_blank" class="text-blue-600 hover:underline text-sm">
            ${link.url}
          </a>
        </div>
      </td>
      <td class="px-6 py-4 text-center">
        <span class="click-count">${formatNumber(link.clicks || 0)}</span>
      </td>
      <td class="px-6 py-4 text-sm text-gray-500">
        ${formatDate(link.created_at)}
      </td>
      <td class="px-6 py-4">
        <div class="flex gap-2">
          <button onclick="openEdit('${link.slug}', '${escapeHtml(link.url)}')" 
                  class="action-btn edit">
            <i class="fas fa-edit"></i> Edit
          </button>
          <button onclick="deleteLink('${link.slug}')" 
                  class="action-btn delete">
            <i class="fas fa-trash"></i> Hapus
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// CRUD Operations
async function addLink() {
  const slug = document.getElementById('slug').value.trim();
  const url = document.getElementById('url').value.trim();
  
  if (!slug || !url) {
    showToast('Slug dan URL harus diisi!', 'error');
    return;
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    showToast('URL harus dimulai dengan http:// atau https://', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ slug, url })
    });
    
    if (response.ok) {
      showToast(`Shortlink /${slug} berhasil dibuat!`, 'success');
      document.getElementById('slug').value = '';
      document.getElementById('url').value = '';
      await loadLinks();
      await loadStats();
    } else {
      const error = await response.json();
      showToast(error.error || 'Gagal membuat shortlink!', 'error');
    }
  } catch (error) {
    console.error('Add link error:', error);
    showToast('Gagal membuat shortlink!', 'error');
  }
}

let currentEditSlug = null;

function openEdit(slug, url) {
  currentEditSlug = slug;
  document.getElementById('currentSlug').textContent = slug;
  document.getElementById('editUrl').value = url;
  document.getElementById('editModal').classList.remove('hidden');
  document.getElementById('editModal').classList.add('flex');
}

function closeEdit() {
  document.getElementById('editModal').classList.add('hidden');
  document.getElementById('editModal').classList.remove('flex');
  currentEditSlug = null;
}

async function saveEdit() {
  const newUrl = document.getElementById('editUrl').value.trim();
  
  if (!newUrl) {
    showToast('URL tidak boleh kosong!', 'error');
    return;
  }
  
  if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
    showToast('URL harus dimulai dengan http:// atau https://', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/links`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ slug: currentEditSlug, url: newUrl })
    });
    
    if (response.ok) {
      showToast(`Shortlink /${currentEditSlug} berhasil diupdate!`, 'success');
      closeEdit();
      await loadLinks();
    } else {
      showToast('Gagal mengupdate shortlink!', 'error');
    }
  } catch (error) {
    console.error('Update link error:', error);
    showToast('Gagal mengupdate shortlink!', 'error');
  }
}

async function deleteLink(slug) {
  if (!confirm(`Yakin ingin menghapus shortlink /${slug}?`)) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/links`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ slug })
    });
    
    if (response.ok) {
      showToast(`Shortlink /${slug} berhasil dihapus!`, 'success');
      await loadLinks();
      await loadStats();
    } else {
      showToast('Gagal menghapus shortlink!', 'error');
    }
  } catch (error) {
    console.error('Delete link error:', error);
    showToast('Gagal menghapus shortlink!', 'error');
  }
}

async function refreshData() {
  showToast('Merefresh data...', 'info');
  await loadLinks();
  await loadStats();
}

// Live Preview
document.addEventListener('DOMContentLoaded', () => {
  const slugInput = document.getElementById('slug');
  if (slugInput) {
    slugInput.addEventListener('input', (e) => {
      const preview = document.getElementById('slugPreview');
      if (preview) {
        preview.textContent = e.target.value || 'your-link';
      }
    });
  }
  
  // Auto login if token exists
  if (authToken) {
    loadDashboard();
  }
  
  // Enter key login
  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') login();
    });
  }
});
