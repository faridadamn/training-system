// ========== OPTIMASI: CACHE & LOADING ==========
let materiList = [];
let karyawanList = [];
let selectedMateriObj = null;
let currentStep = 1, quizAnswers = {}, quizSubmitted = false;
let SHEET_URL = localStorage.getItem('trainup_sheet_url') || '';
let isLoading = false;

// Tampilkan loading state
function showLoading(message = 'Memuat data...') {
  const loader = document.getElementById('global-loader');
  if (!loader) {
    const div = document.createElement('div');
    div.id = 'global-loader';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
    div.innerHTML = `<div class="sync-spinner" style="width:40px;height:40px;"></div><div style="color:white;">${message}</div>`;
    document.body.appendChild(div);
  } else {
    loader.style.display = 'flex';
    loader.querySelector('div:last-child').textContent = message;
  }
}

function hideLoading() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.style.display = 'none';
}

// Render ikon (sama seperti sebelumnya)
function renderIcon(iconValue) {
  if (!iconValue) return '<span style="font-size: 30px;">📘</span>';
  if (iconValue.includes('drive.google.com')) {
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
  if (iconValue.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) || iconValue.includes('imgur.com')) {
    return `<img src="${iconValue}" width="40" height="40" style="object-fit: contain; border-radius: 8px;">`;
  }
  return `<span style="font-size: 30px;">${iconValue}</span>`;
}

// ========== SYNC DENGAN CACHE ==========
async function syncAllData(force = false) {
  if (!SHEET_URL) {
    alert('Masukkan URL Web App terlebih dahulu!');
    return false;
  }
  
  // Cek cache dulu (jika tidak force)
  if (!force) {
    const cached = localStorage.getItem('trainup_master_data');
    const cachedTime = localStorage.getItem('trainup_master_time');
    if (cached && cachedTime && (Date.now() - parseInt(cachedTime)) < 3600000) { // 1 jam cache
      console.log('📦 Pakai cache');
      const data = JSON.parse(cached);
      karyawanList = data.karyawan || [];
      materiList = data.materi || [];
      populateKaryawanDropdown();
      populateMateriGrid();
      updateConfigStatus(true);
      return true;
    }
  }
  
  showLoading('Menyinkronkan data dari Google Sheets...');
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Timeout 15 detik
    
    const response = await fetch(`${SHEET_URL}?action=getAllData&_=${Date.now()}`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    if (data.success) {
      karyawanList = data.karyawan || [];
      materiList = data.materi || [];
      
      // Simpan ke cache
      localStorage.setItem('trainup_master_data', JSON.stringify({ karyawan: karyawanList, materi: materiList }));
      localStorage.setItem('trainup_master_time', Date.now().toString());
      
      populateKaryawanDropdown();
      populateMateriGrid();
      updateConfigStatus(true);
      document.getElementById('cfg-status-txt').textContent = 'Data tersinkron';
      alert(`✅ Berhasil sync: ${karyawanList.length} karyawan, ${materiList.length} materi`);
      return true;
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (err) {
    console.error('Sync error:', err);
    if (err.name === 'AbortError') {
      alert('⏰ Timeout! Cek koneksi internet atau URL Web App.');
    } else {
      alert('❌ Gagal sync data. Pastikan Web App sudah di-deploy dan URL benar.');
    }
    return false;
  } finally {
    hideLoading();
  }
}

// ========== FUNGSI LAINNYA (sama seperti sebelumnya) ==========
function populateKaryawanDropdown() {
  const select = document.getElementById('inp-nama-select');
  if (!select) return;
  select.innerHTML = '<option value="">— Pilih Nama —</option>';
  karyawanList.forEach(k => {
    const option = document.createElement('option');
    option.value = k.nama;
    option.textContent = `${k.nama} (${k.id || '-'})`;
    option.dataset.id = k.id;
    option.dataset.dept = k.departemen;
    option.dataset.jabatan = k.jabatan;
    select.appendChild(option);
  });
  
  select.onchange = function() {
    const selected = select.options[select.selectedIndex];
    if (selected.value) {
      document.getElementById('inp-id').value = selected.dataset.id || '';
      document.getElementById('inp-dept').value = selected.dataset.dept || '';
      document.getElementById('inp-jabatan').value = selected.dataset.jabatan || '';
    } else {
      document.getElementById('inp-id').value = '';
      document.getElementById('inp-dept').value = '';
      document.getElementById('inp-jabatan').value = '';
    }
  };
}

function populateMateriGrid() {
  const container = document.getElementById('materi-grid-container');
  if (!container) return;
  if (!materiList.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Belum ada materi. Sinkronkan data terlebih dahulu.</div>';
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
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
  if (!selectedMateriObj || !selectedMateriObj.soal) return;
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
  if (!selectedMateriObj) return;
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
  const namaSelect = document.getElementById('inp-nama-select');
  const nama = namaSelect.options[namaSelect.selectedIndex]?.value || 'Unknown';
  const dept = document.getElementById('inp-dept').value;
  document.getElementById('result-nama-info').innerHTML = `${escapeHtml(nama)} · ${escapeHtml(dept)} · Modul: ${escapeHtml(selectedMateriObj?.judul)}`;
  document.getElementById('st-benar').textContent = benar;
  document.getElementById('st-salah').textContent = total - benar;
  document.getElementById('st-total').textContent = total;
  document.getElementById('score-val').textContent = skor;
  const pass = skor >= 60;
  document.getElementById('result-title').innerHTML = skor>=80 ? '🎉 Lulus Pujian!' : (skor>=60 ? '✅ Lulus' : '📖 Perlu Belajar Lagi');
  if(pass){ document.getElementById('cert-badge').style.display='inline-flex'; document.getElementById('btn-cetak').style.display='flex'; }
  else { document.getElementById('cert-badge').style.display='none'; document.getElementById('btn-cetak').style.display='none'; }
  setTimeout(() => {
    const circ = document.getElementById('score-circle');
    const offset = 364.4 - (364.4 * skor / 100);
    circ.style.strokeDashoffset = offset;
  }, 100);
  kirimHasilKeSheet(benar, total, skor, nama, dept);
}

async function kirimHasilKeSheet(benar, total, skor, nama, dept) {
  if (!SHEET_URL) return;
  try {
    await fetch(SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'hasil',
        nama: nama,
        id_karyawan: document.getElementById('inp-id').value,
        departemen: dept,
        jabatan: document.getElementById('inp-jabatan').value,
        modul: selectedMateriObj?.judul,
        skor: skor,
        benar: benar,
        salah: total - benar,
        status: skor >= 60 ? 'LULUS' : 'TIDAK LULUS'
      })
    });
  } catch(e) { console.error(e); }
}

function goStep(n) {
  if (n===2 && (!document.getElementById('inp-nama-select').value || !document.getElementById('inp-dept').value)) { alert('Pilih karyawan terlebih dahulu!'); return; }
  if (n===3 && !selectedMateriObj) { alert('Pilih materi!'); return; }
  if (n===3) loadMateri();
  if (n===4) loadKuis();
  document.querySelectorAll('.step-view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+n).classList.add('active');
  currentStep = n;
  for(let i=1;i<=5;i++){ const el=document.getElementById('stp-'+i); el.classList.remove('active','done'); if(i<n) el.classList.add('done'); else if(i===n) el.classList.add('active'); }
  window.scrollTo({top:0,behavior:'smooth'});
}

function updateProgress() {
  const box = document.getElementById('content-box');
  if(!box) return;
  const ratio = box.scrollTop / (box.scrollHeight - box.clientHeight);
  const pct = Math.min(100, Math.round(ratio*100));
  document.getElementById('prog-fill').style.width = pct+'%';
  document.getElementById('read-pct').textContent = pct+'%';
}

function toggleCheck(el){ el.classList.toggle('checked'); }
function cetakSertifikat(){ window.print(); }
function resetApp(){ 
  localStorage.removeItem('trainup_master_data');
  localStorage.removeItem('trainup_master_time');
  location.reload(); 
}

function validateSheetUrlLive() {
  const url = document.getElementById('cfg-url-input').value.trim();
  const feedback = document.getElementById('url-feedback');
  if(url && !url.startsWith('https://script.google.com/')) feedback.innerHTML = '❌ URL tidak valid';
  else feedback.innerHTML = url ? '✅ Format URL valid' : '';
}

function simpanConfig() {
  const val = document.getElementById('cfg-url-input').value.trim();
  if(!val.startsWith('https://script.google.com/')) { alert('URL tidak valid'); return; }
  SHEET_URL = val;
  localStorage.setItem('trainup_sheet_url', val);
  updateConfigStatus(true);
  syncAllData(true);
}

function updateConfigStatus(ok) {
  const dot = document.getElementById('cfg-dot'), txt = document.getElementById('cfg-status-txt');
  if(ok && SHEET_URL) { dot.style.background='var(--green)'; txt.textContent='Tersambung'; }
  else { dot.style.background='var(--amber)'; txt.textContent='Belum sinkron'; }
}

function toggleConfig() {
  const body = document.getElementById('config-body');
  const arrow = document.getElementById('config-arrow');
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

// Initial load
window.addEventListener('DOMContentLoaded', async () => {
  if(SHEET_URL) { 
    document.getElementById('cfg-url-input').value = SHEET_URL; 
    updateConfigStatus(true);
    await syncAllData(false); // Pakai cache jika ada
  } else { 
    populateMateriGrid(); 
  }
  document.getElementById('config-body').style.display = 'block';
});
