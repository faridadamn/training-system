// ========== HARDCODE URL APPS SCRIPT ==========
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyUxwchrYDXjEtDQPnlVocjtSflQjRHOzfk2rghA_XQDPgyaQQw3alZR2Ddz0t_ezrN/exec';

// ========== GLOBAL VARIABLES ==========
let materiList = [];
let selectedMateriObj = null;
let currentStep = 1, quizAnswers = {}, quizSubmitted = false;
let currentUser = null;

// ========== LOADING UTILITY ==========
function showLoading(message = 'Memuat data...') {
  let loader = document.getElementById('global-loader');
  if (!loader) {
    const div = document.createElement('div');
    div.id = 'global-loader';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
    div.innerHTML = `<div class="sync-spinner" style="width:48px;height:48px;border:3px solid rgba(255,255,255,0.3);border-top-color:#4f8ef7;border-radius:50%;animation:spin 0.8s linear infinite;"></div><div style="color:white;font-size:14px;">${message}</div>`;
    document.body.appendChild(div);
  } else {
    loader.style.display = 'flex';
    const msgDiv = loader.querySelector('div:last-child');
    if (msgDiv) msgDiv.textContent = message;
  }
}

function hideLoading() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.style.display = 'none';
}

function showError(msg) {
  const errorDiv = document.getElementById('auth-error');
  if (errorDiv) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 3000);
  } else {
    alert(msg);
  }
}

function showSuccess(msg) {
  const successDiv = document.getElementById('auth-success');
  if (successDiv) {
    successDiv.textContent = msg;
    successDiv.style.display = 'block';
    setTimeout(() => successDiv.style.display = 'none', 3000);
  } else {
    alert(msg);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function renderIcon(iconValue) {
  if (!iconValue) return '<span style="font-size: 30px;">📘</span>';
  if (typeof iconValue === 'string' && iconValue.includes('drive.google.com')) {
    let fileId = '';
    const idMatch = iconValue.match(/\/d\/(.+?)\//);
    if (idMatch) fileId = idMatch[1];
    else {
      const paramMatch = iconValue.match(/id=([^&]+)/);
      if (paramMatch) fileId = paramMatch[1];
    }
    if (fileId) {
      return `<img src="https://drive.google.com/uc?export=view&id=${fileId}" width="40" height="40" style="object-fit: contain; border-radius: 8px;">`;
    }
  }
  if (typeof iconValue === 'string' && iconValue.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    return `<img src="${iconValue}" width="40" height="40" style="object-fit: contain; border-radius: 8px;">`;
  }
  return `<span style="font-size: 30px;">${iconValue}</span>`;
}

// ========== FUNGSI POST REQUEST (CORS AMAN) ==========
async function postToSheet(action, params) {
  const formData = new URLSearchParams();
  formData.append('action', action);
  for (const [key, value] of Object.entries(params)) {
    formData.append(key, value);
  }
  
  await fetch(SHEET_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString()
  });
  
  // Request terkirim, response tidak bisa dibaca karena no-cors
  return true;
}

// ========== FUNGSI REGISTER (POST Form) ==========
async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const nama = document.getElementById('reg-nama').value.trim();
  const id = document.getElementById('reg-id').value.trim();
  const dept = document.getElementById('reg-dept').value.trim();
  const jabatan = document.getElementById('reg-jabatan').value.trim();
  
  if (!username || !password || !nama || !id || !dept || !jabatan) {
    showError('Semua field harus diisi!');
    return;
  }
  
  if (password.length < 4) {
    showError('Password minimal 4 karakter!');
    return;
  }
  
  showLoading('Mendaftarkan akun...');
  
  try {
    // Kirim ke Google Sheets
    await postToSheet('register', { username, password, nama, id, departemen: dept, jabatan });
    
    // Simpan ke localStorage untuk login otomatis
    const newUser = {
      username: username,
      nama: nama,
      id: id,
      departemen: dept,
      jabatan: jabatan,
      role: 'user'
    };
    localStorage.setItem('trainup_user', JSON.stringify(newUser));
    currentUser = newUser;
    
    showSuccess('Registrasi berhasil! Login otomatis...');
    showLoginSuccess();
    
  } catch (err) {
    console.error(err);
    showError('Gagal registrasi.');
  } finally {
    hideLoading();
  }
}

// ========== FUNGSI LOGIN (Cek localStorage) ==========
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!username || !password) {
    showError('Username dan password harus diisi!');
    return;
  }
  
  showLoading('Login...');
  
  // Cek di localStorage dulu (untuk user yang sudah register)
  const savedUser = localStorage.getItem('trainup_user');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    if (user.username === username) {
      currentUser = user;
      showLoginSuccess();
      showSuccess('Login berhasil!');
      hideLoading();
      return;
    }
  }
  
  // Jika tidak ditemukan, buat user sementara (untuk testing)
  // Data tetap akan tersimpan di sheet saat register
  currentUser = {
    username: username,
    nama: username,
    id: 'EMP001',
    departemen: 'IT',
    jabatan: 'Staff',
    role: 'user'
  };
  localStorage.setItem('trainup_user', JSON.stringify(currentUser));
  showLoginSuccess();
  showSuccess('Login berhasil (mode testing)');
  
  hideLoading();
}

// ========== DEMO LOGIN (Untuk testing tanpa register) ==========
function demoLogin() {
  currentUser = {
    username: 'demo',
    nama: 'Demo User',
    id: 'DEMO001',
    departemen: 'Information Technology',
    jabatan: 'Staff',
    role: 'user'
  };
  localStorage.setItem('trainup_user', JSON.stringify(currentUser));
  showLoginSuccess();
  showSuccess('Demo Login berhasil!');
}

function showLogin() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
}

function showRegister() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('auth-success').style.display = 'none';
}

function showLoginSuccess() {
  document.getElementById('inp-nama').value = currentUser.nama || currentUser.username;
  document.getElementById('inp-id').value = currentUser.id || '';
  document.getElementById('inp-dept').value = currentUser.departemen || '';
  document.getElementById('inp-jabatan').value = currentUser.jabatan || '';
  
  document.getElementById('user-nama-display').textContent = currentUser.nama || currentUser.username;
  document.getElementById('user-role-display').textContent = currentUser.role || 'user';
  document.getElementById('user-dept-display').textContent = currentUser.departemen || '';
  
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  
  syncAllData();
}

function doLogout() {
  localStorage.removeItem('trainup_user');
  currentUser = null;
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  showLogin();
}

// ========== SYNC DATA (GET Request - CORS OK) ==========
async function syncAllData() {
  showLoading('Menyinkronkan data materi...');
  
  try {
    const response = await fetch(`${SHEET_URL}?action=getAllData&_=${Date.now()}`, { method: 'GET' });
    const data = await response.json();
    
    if (data.success) {
      materiList = data.materi || [];
      localStorage.setItem('trainup_materi_cache', JSON.stringify(materiList));
      populateMateriGrid();
      console.log(`✅ Sync berhasil: ${materiList.length} materi`);
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    console.error('Sync error:', err);
    const cached = localStorage.getItem('trainup_materi_cache');
    if (cached) {
      materiList = JSON.parse(cached);
      populateMateriGrid();
      showError('⚠️ Menggunakan data cached (offline mode)');
    } else {
      showError('Gagal sync data.');
    }
  } finally {
    hideLoading();
  }
}

function populateMateriGrid() {
  const container = document.getElementById('materi-grid-container');
  if (!container) return;
  
  if (!materiList.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Belum ada materi. Periksa sheet "Materi" di Google Sheets.</div>';
    return;
  }
  
  container.innerHTML = materiList.map((m, idx) => `
    <div class="materi-card" onclick="pilihMateriObj(${idx})" data-idx="${idx}">
      <div class="materi-icon">${renderIcon(m.ikon)}</div>
      <div class="materi-info">
        <div class="materi-title">${escapeHtml(m.judul)}</div>
        <div class="materi-meta">${escapeHtml((m.deskripsi || '').substring(0, 40))}...</div>
        <span class="materi-badge badge-blue">${m.soal ? m.soal.length : 0} soal</span>
      </div>
    </div>
  `).join('');
}

function pilihMateriObj(idx) {
  document.querySelectorAll('.materi-card').forEach(c => c.classList.remove('selected'));
  const cards = document.querySelectorAll('.materi-card');
  if (cards[idx]) cards[idx].classList.add('selected');
  selectedMateriObj = materiList[idx];
}

function loadMateri() {
  if (!selectedMateriObj) return;
  document.getElementById('materi-icon-display').innerHTML = renderIcon(selectedMateriObj.ikon);
  document.getElementById('materi-title-display').textContent = selectedMateriObj.judul;
  document.getElementById('materi-desc-display').textContent = selectedMateriObj.deskripsi;
  document.getElementById('content-box').innerHTML = selectedMateriObj.konten || '<p>Materi tidak tersedia.</p>';
  document.getElementById('prog-fill').style.width = '0%';
  document.getElementById('read-pct').textContent = '0%';
  document.querySelectorAll('.check-item').forEach(c => c.classList.remove('checked'));
}

function loadKuis() {
  if (!selectedMateriObj || !selectedMateriObj.soal || !selectedMateriObj.soal.length) {
    document.getElementById('quiz-container').innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Belum ada soal untuk materi ini.</div>';
    return;
  }
  quizAnswers = {};
  quizSubmitted = false;
  const container = document.getElementById('quiz-container');
  container.innerHTML = '';
  selectedMateriObj.soal.forEach((s, i) => {
    const letters = ['A','B','C','D'];
    const optsHTML = s.opts.map((o, j) => `
      <div class="opt" onclick="pilihJawaban(${i}, ${j}, this)">
        <div class="opt-letter">${letters[j]}</div>
        <span>${escapeHtml(o)}</span>
      </div>
    `).join('');
    container.innerHTML += `
      <div class="quiz-item" id="qi-${i}">
        <div class="q-num">SOAL ${i+1}</div>
        <div class="q-text">${escapeHtml(s.q)}</div>
        <div class="options" id="opts-${i}">${optsHTML}</div>
        <div class="q-feedback" id="fb-${i}"></div>
      </div>
    `;
  });
}

function pilihJawaban(qIdx, aIdx, el) {
  if (quizSubmitted) return;
  document.querySelectorAll(`#opts-${qIdx} .opt`).forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  quizAnswers[qIdx] = aIdx;
}

function submitKuis() {
  if (!selectedMateriObj || !selectedMateriObj.soal) return;
  const total = selectedMateriObj.soal.length;
  const unanswered = selectedMateriObj.soal.filter((_, i) => quizAnswers[i] === undefined).length;
  if (unanswered > 0) { alert(`Masih ${unanswered} soal belum dijawab!`); return; }
  quizSubmitted = true;
  let benar = 0;
  selectedMateriObj.soal.forEach((s, i) => {
    const isCorrect = quizAnswers[i] === s.ans;
    if (isCorrect) benar++;
    const qi = document.getElementById('qi-' + i);
    const fb = document.getElementById('fb-' + i);
    qi.classList.add(isCorrect ? 'correct' : 'wrong');
    document.querySelectorAll(`#opts-${i} .opt`).forEach((o, j) => {
      o.classList.add('locked');
      if (j === s.ans) o.classList.add('correct-ans');
      else if (j === quizAnswers[i] && !isCorrect) o.classList.add('wrong-ans');
    });
    fb.textContent = isCorrect ? '✅ Benar!' : `❌ Salah. Jawaban: ${['A','B','C','D'][s.ans]}`;
    fb.className = 'q-feedback show ' + (isCorrect ? 'ok' : 'err');
  });
  document.getElementById('btn-submit').disabled = true;
  setTimeout(() => { showResult(benar, total); goStep(5); }, 1500);
}

function showResult(benar, total) {
  const skor = Math.round(benar/total*100);
  const nama = currentUser?.nama || 'User';
  const dept = currentUser?.departemen || '-';
  
  document.getElementById('result-nama-info').innerHTML = `${escapeHtml(nama)} · ${escapeHtml(dept)} · Modul: ${escapeHtml(selectedMateriObj?.judul)}`;
  document.getElementById('st-benar').textContent = benar;
  document.getElementById('st-salah').textContent = total - benar;
  document.getElementById('st-total').textContent = total;
  document.getElementById('score-val').textContent = skor;
  
  const pass = skor >= 60;
  document.getElementById('result-title').innerHTML = skor>=80 ? '🎉 Lulus Pujian!' : (skor>=60 ? '✅ Lulus' : '📖 Perlu Belajar Lagi');
  document.getElementById('result-desc').innerHTML = pass ? 'Selamat! Anda telah menyelesaikan pelatihan.' : 'Jangan menyerah, pelajari lagi materinya.';
  
  if(pass){ 
    document.getElementById('cert-badge').style.display='inline-flex'; 
    document.getElementById('btn-cetak').style.display='flex'; 
  } else { 
    document.getElementById('cert-badge').style.display='none'; 
    document.getElementById('btn-cetak').style.display='none'; 
  }
  
  setTimeout(() => {
    const circ = document.getElementById('score-circle');
    const offset = 364.4 - (364.4 * skor / 100);
    circ.style.strokeDashoffset = offset;
  }, 100);
}

function goStep(n) {
  if (n===3 && !selectedMateriObj) { alert('Pilih materi terlebih dahulu!'); return; }
  if (n===3) loadMateri();
  if (n===4) loadKuis();
  
  document.querySelectorAll('.step-view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-'+n).classList.add('active');
  currentStep = n;
  
  for(let i=1; i<=5; i++){ 
    const el = document.getElementById('stp-'+i); 
    if(el) {
      el.classList.remove('active','done'); 
      if(i < n) el.classList.add('done'); 
      else if(i === n) el.classList.add('active');
    }
  }
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function updateProgress() {
  const box = document.getElementById('content-box');
  if(!box) return;
  const ratio = box.scrollTop / (box.scrollHeight - box.clientHeight);
  const pct = Math.min(100, Math.round(ratio*100));
  const progFill = document.getElementById('prog-fill');
  const readPct = document.getElementById('read-pct');
  if(progFill) progFill.style.width = pct+'%';
  if(readPct) readPct.textContent = pct+'%';
}

function toggleCheck(el){ el.classList.toggle('checked'); }
function cetakSertifikat(){ window.print(); }
function resetApp(){ 
  selectedMateriObj = null;
  quizAnswers = {};
  quizSubmitted = false;
  goStep(1);
}

// ========== INITIAL LOAD ==========
window.addEventListener('DOMContentLoaded', async () => {
  const savedUser = localStorage.getItem('trainup_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById('inp-nama').value = currentUser.nama || '';
    document.getElementById('inp-id').value = currentUser.id || '';
    document.getElementById('inp-dept').value = currentUser.departemen || '';
    document.getElementById('inp-jabatan').value = currentUser.jabatan || '';
    document.getElementById('user-nama-display').textContent = currentUser.nama || currentUser.username;
    document.getElementById('user-role-display').textContent = currentUser.role || 'user';
    document.getElementById('user-dept-display').textContent = currentUser.departemen || '';
    
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    
    const cached = localStorage.getItem('trainup_materi_cache');
    if (cached) {
      materiList = JSON.parse(cached);
      populateMateriGrid();
    }
    syncAllData();
  } else {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('main-app').style.display = 'none';
    showLogin();
  }
});
