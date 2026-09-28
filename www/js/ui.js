// ============================================================
//  ANTARMUKA — teks saja
// ============================================================
'use strict';

const UI = { tab: 'home', sub: { trade: 'kom' }, form: null, modalOpen: false, lock: false };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TABS = [['home', '◉', 'Ringkasan'], ['trade', '⇄', 'Dagang'], ['ind', '⚙', 'Industri'], ['fin', '$', 'Keuangan'], ['fx', '¤', 'Forex'], ['world', '◎', 'Dunia'], ['news', '≡', 'Berita']];

function spark(arr) {
  if (!arr || arr.length < 2) return '';
  const mn = Math.min(...arr), mx = Math.max(...arr), ch = '▁▂▃▄▅▆▇█';
  return arr.map(v => ch[mx === mn ? 3 : Math.round((v - mn) / (mx - mn) * 7)]).join('');
}
// bulatkan ke bawah (4 angka penting) agar tidak melebihi batas
function sig(x) { if (!(x > 0)) return 0; const k = Math.pow(10, Math.floor(Math.log10(x)) - 3); return +(Math.floor(x / k * (1 + 1e-12)) * k).toPrecision(4); }
function fmtRate(r) { return r >= 100 ? Math.round(r).toLocaleString('id-ID') : r >= 10 ? r.toFixed(2) : r.toFixed(4); }
function clr(x, good = 0) { return x > good ? 'good' : x < good ? 'bad' : ''; }
function arrow(now, prev) { const c = (now / prev - 1) * 100; return `<span class="${clr(c)}">${c >= 0 ? '▲' : '▼'}${Math.abs(c).toFixed(1)}%</span>`; }
function riskLabel(p) { return p < 0.02 ? '<span class="good">rendah</span>' : p < 0.06 ? '<span class="warn">sedang</span>' : '<span class="bad">tinggi</span>'; }

let toastT = null;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg; t.className = bad ? 'bad' : '';
  clearTimeout(toastT); toastT = setTimeout(() => t.className = 'hidden', 3800);
}
function res(r, keepModal) {
  if (!r) return false;
  toast(r.msg, !r.ok);
  if (r.ok) { saveGame(); if (!keepModal) closeModal(); render(); }
  return r.ok;
}
function openModal(html, opts = {}) {
  $('#sheet').innerHTML = (opts.noClose ? '' : '<button class="x" data-act="close">×</button>') + html;
  $('#modal').className = '';
  $('#sheet').scrollTop = 0;
  UI.modalOpen = true; UI.noClose = !!opts.noClose;
}
function closeModal() {
  $('#modal').className = 'hidden'; UI.modalOpen = false; UI.form = null; UI.noClose = false;
  setTimeout(afterModal, 0);
}
function afterModal() {
  if (!S || UI.modalOpen) return;
  if (S.pending.length) showPending();
  else if (S.over && !UI.overShown) showOver();
}

// ============================================================
//  LAYAR AWAL
// ============================================================
function renderStart() {
  $('#top').innerHTML = ''; $('#tabs').innerHTML = '';
  $('#view').innerHTML = `
  <div class="title">
    <div class="ascii">  ⇄  ═══════════  ⇄
 ╔══ E K S P O R ══╗
 ╚══ I M P O R ════╝
  ⇄  ═══════════  ⇄</div>
    <h1>Menuju Negara Maju</h1>
    <div class="tl">simulasi ekonomi perdagangan internasional</div>
  </div>
  <div class="card">
    <p>Anda adalah <b>Menteri Perdagangan & Keuangan</b>. Kelola ekspor-impor, industri, utang, dan cadangan devisa negara Anda.</p>
    <p class="dim small">Hadapi masalah nyata perdagangan dunia: perang tarif, tuduhan dumping, pembajakan kapal, pembeli gagal bayar, sanksi, kemacetan pelabuhan, krisis keuangan, hingga El Niño.</p>
    <p><b>Tujuan:</b> jadi negara maju <b>#1</b> dengan Skor Kemajuan ≥ ${WIN_SCORE} selama ${WIN_HOLD} kuartal berturut-turut, dalam ${MAX_TURN / 4} tahun.</p>
  </div>
  ${hasSave() ? '<button class="btn pri block" data-act="continue">▶ Lanjutkan Permainan</button>' : ''}
  <button class="btn block ${hasSave() ? '' : 'pri'}" data-act="pickScreen">＋ Permainan Baru</button>
  <button class="btn block" data-act="help">? Cara Bermain</button>`;
}
function startScore(id) {
  const d = COUNTRIES[id];
  return 0.45 * Math.min(100, Math.sqrt(d.gdp / d.pop / 100000) * 100) + 0.35 * d.hdi * 100 + 0.2 * d.tech;
}
function renderPick() {
  const order = [...COUNTRY_ORDER];
  const ranks = [...order].sort((a, b) => startScore(b) - startScore(a));
  $('#view').innerHTML = `<h2>Pilih Negara</h2><p class="dim small">Setiap negara punya kekuatan dan kelemahan nyata. Tingkat kesulitan menunjukkan jarak ke posisi #1.</p>` +
    order.map(id => {
      const d = COUNTRIES[id];
      return `<div class="card tap" data-act="pickCountry" data-id="${id}">
        <div class="hbar"><div class="grow"><b>${d.name}</b> <span class="tag">${REGIONS[d.region]}</span></div><span class="small diff-${d.diff}">${d.diff}</span></div>
        <div class="small dim mono">PDB ${fmt(d.gdp)} · per kapita $${Math.round(d.gdp / d.pop).toLocaleString('id-ID')} · peringkat awal #${ranks.indexOf(id) + 1}</div>
        <div class="small" style="margin-top:4px">${esc(d.plus[0])}</div>
      </div>`;
    }).join('') + '<button class="btn block" data-act="toStart">← Kembali</button>';
  $('#view').scrollTop = 0;
}
function topTrade(id, sign) {
  const d = COUNTRIES[id], arr = [];
  for (const c in COMMODITIES) {
    let inp = 0;
    for (const m in RECIPES) if (RECIPES[m].in[c]) inp += (d.prod[m] || 0) * RECIPES[m].in[c];
    const net = ((d.prod[c] || 0) - (d.use[c] || 0) - inp) * COMMODITIES[c].price;
    if (net * sign > 0) arr.push([c, Math.abs(net)]);
  }
  return arr.sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => COMMODITIES[x[0]].name);
}
function pickDetail(id) {
  const d = COUNTRIES[id];
  openModal(`<h2>${d.name}</h2>
    <div class="small dim">${REGIONS[d.region]} · Kesulitan <span class="diff-${d.diff}">${d.diff}</span> · Mata uang ${d.cur.name} (${d.cur.code})</div>
    <div class="grid" style="margin-top:10px">
      <div class="stat"><div class="k">PDB</div><div class="v">${fmt(d.gdp)}</div></div>
      <div class="stat"><div class="k">Penduduk</div><div class="v">${d.pop} jt</div></div>
      <div class="stat"><div class="k">IPM</div><div class="v">${d.hdi.toFixed(3)}</div></div>
      <div class="stat"><div class="k">Teknologi</div><div class="v">${d.tech}</div></div>
      <div class="stat"><div class="k">Utang/PDB</div><div class="v">${d.debt}%</div></div>
      <div class="stat"><div class="k">Inflasi</div><div class="v">${d.inf}%</div></div>
    </div>
    <h3>Kelebihan</h3><ul class="list">${d.plus.map(x => `<li class="good">${esc(x)}</li>`).join('')}</ul>
    <h3>Kekurangan</h3><ul class="list">${d.minus.map(x => `<li class="bad">${esc(x)}</li>`).join('')}</ul>
    <h3>Ekspor utama</h3><p class="small">${topTrade(id, 1).join(', ') || '-'}</p>
    <h3>Harus impor</h3><p class="small">${topTrade(id, -1).join(', ') || '-'}</p>
    <button class="btn pri block" data-act="startGame" data-id="${id}">Mulai sebagai ${d.name}</button>`);
}

// ============================================================
//  RENDER UTAMA
// ============================================================
function render() {
  if (!S) return renderStart();
  const p = P(), me = ME();
  $('#top').innerHTML = `<div class="hbar"><div class="who"><div class="n">${D(S.pid).name}</div><div class="d">${dateLabel(S.turn)} · giliran ${S.turn + 1}/${MAX_TURN}</div></div>
    <button class="btn pri endturn" data-act="end">Akhiri Kuartal ▶</button></div>
    <div class="hstats"><span>Kas <b class="${p.kas < 0 ? 'bad' : ''}">${fmt(p.kas)}</b></span><span>Peringkat <b>#${myRank()}</b></span><span>Skor <b>${scoreOf(me).toFixed(1)}</b></span><span>Rating <b>${rating().r}</b></span></div>`;
  $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button class="${UI.tab === k ? 'on' : ''}" data-act="tab" data-k="${k}"><b>${i}</b>${n}${k === 'trade' && S.offers.length ? ' •' : ''}</button>`).join('');
  const v = { home: vHome, trade: vTrade, ind: vInd, fin: vFin, fx: vFx, world: vWorld, news: vNews }[UI.tab];
  const y = $('#view').scrollTop;
  $('#view').innerHTML = v();
  $('#view').scrollTop = y;
  if (!UI.modalOpen) afterModal();
}

// ---------- RINGKASAN ----------
function vHome() {
  const p = P(), me = ME(), sc = scoreOf(me), rk = myRank(), rt = rating();
  const proj = projection();
  const alerts = [];
  for (const c in COMMODITIES) {
    const pr = proj[c];
    if (COM(c).essential && pr.use > 0 && pr.end < -1e-6)
      alerts.push(`<b>${COM(c).name}</b> diproyeksi kurang ${fq(-pr.end)} ${COM(c).unit} kuartal ini${p.policy.autoEssential ? ' (akan diimpor otomatis — mahal!)' : ' — KELANGKAAN!'}`);
  }
  if (p.kas < 0) alerts.push('<b>Kas negatif!</b> Terbitkan obligasi, minta IMF, atau jual aset.');
  if (me.inf > 10) alerts.push(`<b>Inflasi ${me.inf.toFixed(1)}%</b> menggerus stabilitas & pertumbuhan.`);
  if (me.stab < 30) alerts.push(`<b>Stabilitas kritis (${me.stab.toFixed(0)})</b> — pemerintahan bisa jatuh!`);
  let stockVal = 0;
  for (const c in p.stock) stockVal += (p.stock[c] || 0) * S.prices[c];
  const lr = p.lastReport;
  return `
  ${S.turn === 0 ? `<div class="card note"><b>Kuartal pertama!</b> Langkah awal yang disarankan:
    <ul class="list small"><li>Buka <b>Dagang</b> → pilih komoditas surplus → <b>Ekspor</b> ke negara yang membayar paling mahal.</li>
    <li>Cek komoditas pokok yang <span class="bad">merah</span> dan <b>Impor</b> sebelum langka.</li>
    <li>Atur anggaran di <b>Keuangan</b>, lalu tekan <b>Akhiri Kuartal</b>.</li></ul>
    <button class="btn sm" data-act="help">Baca panduan lengkap</button></div>` : ''}
  <div class="card">
    <div class="hbar"><div class="grow"><div class="small dim">Skor Kemajuan</div><div class="mono" style="font-size:26px;font-weight:700">${sc.toFixed(1)} <span class="small ${rk === 1 ? 'good' : 'dim'}">#${rk} dunia</span></div></div>
    <div class="r small dim">Target ≥ ${WIN_SCORE} & #1<br>selama ${WIN_HOLD} kuartal<br><b class="acc">${p.top1}/${WIN_HOLD}</b></div></div>
    <div class="bar"><i style="width:${Math.min(100, sc / WIN_SCORE * 100)}%"></i></div>
    <div class="small dim">Skor = 45% pendapatan per kapita + 35% IPM + 20% teknologi</div>
  </div>
  ${alerts.length ? `<div class="card alert">${alerts.map(a => `<div class="small">⚠ ${a}</div>`).join('')}</div>` : ''}
  <div class="grid">
    <div class="stat"><div class="k">PDB</div><div class="v">${fmt(me.gdp)}</div><div class="s">tumbuh <span class="${clr(me.growth)}">${pct(me.growth)}</span>/thn</div></div>
    <div class="stat"><div class="k">PDB per kapita</div><div class="v">$${Math.round(gdppc(me)).toLocaleString('id-ID')}</div><div class="s">${fq(me.pop)} jt jiwa</div></div>
    <div class="stat"><div class="k">IPM</div><div class="v">${me.hdi.toFixed(3)}</div><div class="s">pendidikan & kesehatan</div></div>
    <div class="stat"><div class="k">Teknologi</div><div class="v">${me.tech.toFixed(1)}</div><div class="s">riset & pabrik canggih</div></div>
    <div class="stat"><div class="k">Infrastruktur</div><div class="v">${me.infra.toFixed(1)}</div><div class="s">ongkos logistik & FDI</div></div>
    <div class="stat"><div class="k">Stabilitas</div><div class="v ${me.stab < 35 ? 'bad' : ''}">${me.stab.toFixed(0)}</div><div class="s">kepuasan rakyat</div></div>
    <div class="stat"><div class="k">Inflasi</div><div class="v ${me.inf > 8 ? 'bad' : ''}">${me.inf.toFixed(1)}%</div><div class="s">per tahun</div></div>
    <div class="stat"><div class="k">Utang / PDB</div><div class="v">${(p.debt / me.gdp * 100).toFixed(0)}%</div><div class="s">rating ${rt.r}</div></div>
    <div class="stat"><div class="k">Nilai stok gudang</div><div class="v">${fmt(stockVal)}</div><div class="s">harga dunia</div></div>
    <div class="stat"><div class="k">Kurs ${D(S.pid).cur.code}</div><div class="v">${S.fx[D(S.pid).cur.code] ? fmtRate(1 / S.fx[D(S.pid).cur.code].v) : '1'}</div><div class="s">per USD</div></div>
  </div>
  ${S.events.length ? `<h3>Kondisi dunia</h3><div class="card">${S.events.map(e => `<div class="kv"><span>${esc(e.title)}</span><span class="dim">${e.t} kuartal</span></div>`).join('')}</div>` : ''}
  ${lr ? `<h3>Kuartal lalu (${lr.date})</h3><div class="card tap" data-act="report">
      <div class="kv"><span>Pertumbuhan</span><span class="${clr(lr.g)}">${pct(lr.g)}</span></div>
      <div class="kv"><span>Ekspor / Impor</span><span>${fmt(lr.exp)} / ${fmt(lr.imp)}</span></div>
      <div class="kv"><span>Skor</span><span>${lr.score0.toFixed(1)} → ${lr.score.toFixed(1)}</span></div>
      <div class="small acc">Lihat laporan lengkap ›</div></div>` : ''}
  <div class="btns"><button class="btn" data-act="help">? Panduan</button><button class="btn" data-act="menu">☰ Menu</button></div>`;
}

// ---------- DAGANG ----------
function vTrade() {
  const sub = UI.sub.trade;
  const seg = `<div class="seg">${[['kom', 'Komoditas'], ['ship', `Pengiriman (${P().shipments.length})`], ['kon', `Kontrak (${S.offers.length ? S.offers.length + ' baru' : P().contracts.length})`]]
    .map(([k, n]) => `<button class="${sub === k ? 'on' : ''}" data-act="sub" data-t="trade" data-k="${k}">${n}</button>`).join('')}</div>`;
  if (sub === 'ship') return seg + vShipments();
  if (sub === 'kon') return seg + vContracts();
  const p = P(), proj = projection();
  const groups = {};
  for (const c in COMMODITIES) {
    const pr = proj[c];
    if (pr.stock < 1e-6 && pr.prod < 1e-6 && pr.use < 1e-6 && pr.inc < 1e-6) continue;
    (groups[COM(c).cat] = groups[COM(c).cat] || []).push(c);
  }
  let html = seg + `<div class="card small">
    <label class="kv" style="cursor:pointer"><span>Impor darurat otomatis barang pokok <span class="dim">(harga spot +3%)</span></span><input type="checkbox" data-act="pol" data-k="autoEssential" ${p.policy.autoEssential ? 'checked' : ''}></label>
    <label class="kv" style="cursor:pointer"><span>Jual otomatis stok berlebih ke spot <span class="dim">(komisi 5%)</span></span><input type="checkbox" data-act="pol" data-k="autoSell" ${p.policy.autoSell ? 'checked' : ''}></label>
    <div class="dim" style="margin-top:4px">Kolom kanan = proyeksi stok akhir kuartal (stok + produksi + impor − konsumsi). <span class="bad">Merah</span> = akan kurang.</div></div>`;
  for (const cat of ['pangan', 'energi', 'tambang', 'kebun', 'industri', 'teknologi']) {
    if (!groups[cat]) continue;
    html += `<h3>${CAT_NAMES[cat]}</h3><div class="card" style="padding:4px 10px">`;
    for (const c of groups[cat]) {
      const pr = proj[c], h = S.phist[c];
      html += `<div class="row tap" data-act="com" data-c="${c}">
        <div class="grow"><div class="t">${COM(c).name}${COM(c).essential ? ' <span class="tag warn">pokok</span>' : ''}${p.ban[c] ? ' <span class="tag bad">dilarang ekspor</span>' : ''}</div>
        <div class="sub mono">stok ${fq(pr.stock)} · +${fq(pr.prod)} · −${fq(pr.use + pr.input)}${pr.inc ? ' · ⛴' + fq(pr.inc) : ''}</div></div>
        <div class="r"><div class="mono small">${fmt(S.prices[c])} ${h.length > 1 ? arrow(h[h.length - 1], h[h.length - 2]) : ''}</div>
        <div class="mono small ${pr.end < -1e-6 ? 'bad' : pr.end > pr.use ? 'good' : 'dim'}">${pr.end >= 0 ? '' : ''}${fq(pr.end)} ${COM(c).unit}</div></div></div>`;
    }
    html += '</div>';
  }
  return html + '<p class="small dim">Harga = per satuan (jt = juta, rb = ribu). Ketuk komoditas untuk ekspor/impor.</p>';
}
function vShipments() {
  const p = P();
  if (!p.shipments.length) return '<p class="dim">Tidak ada pengiriman di perjalanan. Pengiriman tiba & diselesaikan saat akhir kuartal.</p>';
  return '<div class="card" style="padding:4px 10px">' + p.shipments.map(s => `<div class="row"><div class="grow">
    <div class="t">${s.kind === 'x' ? '⬆ Ekspor' : '⬇ Impor'} ${COM(s.com).name}</div>
    <div class="sub">${fq(s.qty)} ${COM(s.com).unit} ${s.kind === 'x' ? 'ke' : 'dari'} ${D(s.cid).name} · ${({ lc: 'L/C', tt: 'T/T di muka', oa: 'Open Account' })[s.pay]}${s.ins ? ' · diasuransikan' : ' · <span class="warn">tanpa asuransi</span>'}</div></div>
    <div class="r"><div class="mono small">${fmt(s.value)}</div><div class="small ${s.status === 'delay' ? 'warn' : 'dim'}">${s.status === 'delay' ? 'tertunda' : 'berlayar'}</div></div></div>`).join('') + '</div>';
}
function vContracts() {
  const p = P();
  let html = '<h3>Tawaran baru</h3>';
  if (!S.offers.length) html += '<p class="dim small">Belum ada tawaran. Tawaran kontrak muncul acak tiap kuartal (berlaku 1 kuartal).</p>';
  for (const o of S.offers) {
    const now = S.prices[o.com];
    html += `<div class="card"><div class="t"><b>${o.type === 'ekspor' ? '⬆ Pembeli' : '⬇ Pemasok'}: ${D(o.cid).name}</b></div>
      <p class="small">${o.type === 'ekspor' ? 'Ingin membeli' : 'Menawarkan'} <b>${fq(o.qty)} ${COM(o.com).unit} ${COM(o.com).name}</b> per kuartal selama <b>${o.t} kuartal</b>
      dengan harga tetap <b>${fmt(o.price)}</b>/satuan <span class="dim">(harga dunia kini ${fmt(now)})</span>.</p>
      <p class="small dim">${o.type === 'ekspor' ? 'Dibayar aman (FOB, ongkos kirim ditanggung pembeli). Jika stok kurang saat pengiriman: denda 25% & hubungan turun.' : 'Barang dikirim & dibayar otomatis tiap akhir kuartal. Harga terkunci — aman dari lonjakan harga.'}</p>
      <div class="btns"><button class="btn good" data-act="offerYes" data-id="${o.id}">Terima</button><button class="btn" data-act="offerNo" data-id="${o.id}">Tolak</button></div></div>`;
  }
  html += '<h3>Kontrak aktif</h3>';
  if (!p.contracts.length) html += '<p class="dim small">Tidak ada.</p>';
  else html += '<div class="card" style="padding:4px 10px">' + p.contracts.map(k => `<div class="row"><div class="grow"><div class="t">${k.type === 'ekspor' ? '⬆' : '⬇'} ${COM(k.com).name} · ${D(k.cid).name}</div>
    <div class="sub">${fq(k.qty)} ${COM(k.com).unit}/kuartal @ ${fmt(k.price)} · sisa ${k.t} kuartal</div></div></div>`).join('') + '</div>';
  return html;
}

function comModal(c) {
  const p = P(), pr = projection()[c], h = S.phist[c];
  const buyers = otherCountries().map(id => [id, exportCapTotal(id, c)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sellers = otherCountries().map(id => [id, importCapTotal(id, c)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const isRawInput = !RECIPES[c] && Object.values(RECIPES).some(r => r.in[c]) && (p.cap[c] || 0) > 0;
  openModal(`<h2>${COM(c).name}</h2>
    <div class="small dim">Satuan: ${COM(c).unit} · ${CAT_NAMES[COM(c).cat]}${COM(c).essential ? ' · <span class="warn">kebutuhan pokok</span>' : ''}</div>
    <div class="card"><div class="kv"><span>Harga dunia</span><span>${fmt(S.prices[c])} / ${COM(c).unit}</span></div>
      <div class="kv"><span>Tren 4 tahun</span><span class="spark">${spark(h)}</span></div>
      <div class="kv"><span>Harga dasar</span><span class="dim">${fmt(COM(c).price)}</span></div></div>
    <div class="card">
      <div class="kv"><span>Stok gudang</span><span>${fq(pr.stock)}</span></div>
      <div class="kv"><span>Produksi / kuartal</span><span class="good">+${fq(pr.prod)}</span></div>
      ${pr.input ? `<div class="kv"><span>Bahan baku pabrik</span><span class="bad">−${fq(pr.input)}</span></div>` : ''}
      <div class="kv"><span>Konsumsi domestik</span><span class="bad">−${fq(pr.use)}</span></div>
      ${pr.inc ? `<div class="kv"><span>Impor dalam perjalanan</span><span class="good">+${fq(pr.inc)}</span></div>` : ''}
      ${pr.contract ? `<div class="kv"><span>Kontrak</span><span>${pr.contract > 0 ? '+' : ''}${fq(pr.contract)}</span></div>` : ''}
      <div class="kv tot"><span>Proyeksi akhir kuartal</span><span class="${pr.end < 0 ? 'bad' : ''}">${fq(pr.end)}</span></div>
      <div class="small dim">Stok yang bisa diekspor sekarang: ${fq(p.stock[c] || 0)}. Produksi baru masuk gudang di akhir kuartal.</div>
    </div>
    <div class="btns">
      <button class="btn good" data-act="expList" data-c="${c}" ${(p.stock[c] || 0) > 1e-9 && !p.ban[c] ? '' : 'disabled'}>⬆ Ekspor</button>
      <button class="btn" data-act="impList" data-c="${c}">⬇ Impor</button></div>
    <div class="btns">
      <button class="btn sm" data-act="spot" data-c="${c}" data-s="sell" ${(p.stock[c] || 0) > 1e-9 && !p.ban[c] ? '' : 'disabled'}>Jual spot</button>
      <button class="btn sm" data-act="spot" data-c="${c}" data-s="buy">Beli spot</button></div>
    ${isRawInput ? `<div class="card note small"><b>Hilirisasi:</b> ${p.ban[c] ? 'Ekspor mentah sedang DILARANG.' : 'Larang ekspor bahan mentah ini agar investor membangun industri pengolahan di dalam negeri.'}
      <div class="btns"><button class="btn sm ${p.ban[c] ? '' : 'bad'}" data-act="ban" data-c="${c}">${p.ban[c] ? 'Cabut larangan' : 'Larang ekspor mentah'}</button></div></div>` : ''}
    <h3>Pembeli terbesar</h3><p class="small">${buyers.map(b => D(b[0]).name).join(', ') || '<span class="dim">— tidak ada negara yang kekurangan</span>'}</p>
    <h3>Pemasok terbesar</h3><p class="small">${sellers.map(b => D(b[0]).name).join(', ') || '<span class="dim">— hanya pasar spot</span>'}</p>`);
}
// ---------- EKSPOR ----------
function exportList(c) {
  const rows = otherCountries().map(id => {
    const q = quoteExport(id, c, 1e-6, 'lc', false);
    return { id, q, cap: exportCapTotal(id, c), why: blocked(id, c) };
  });
  const ok = rows.filter(r => r.cap > 0).sort((a, b) => b.q.unit - a.q.unit);
  const bl = rows.filter(r => r.why);
  const spot = quoteSpotSell(c, 1e-6).unit;
  openModal(`<h2>⬆ Ekspor ${COM(c).name}</h2>
    <p class="small dim">Stok siap ekspor: <b>${fq(P().stock[c] || 0)} ${COM(c).unit}</b>. Harga bersih = harga di tujuan setelah tarif masuk (sebelum ongkos kirim). Pasar spot: ${fmt(spot)}.</p>
    <div class="card" style="padding:4px 10px">${ok.length ? ok.map(r => {
      const d = D(r.id), sr = shipRate(D(S.pid).region, d.region, c);
      return `<div class="row tap" data-act="expForm" data-c="${c}" data-id="${r.id}"><div class="grow">
        <div class="t">${d.name}${C(r.id).fta ? ' <span class="tag good">FTA</span>' : ''}</div>
        <div class="sub">tarif ${(r.q.tariff * 100).toFixed(0)}% · kirim ${(sr * 100).toFixed(1)}% · kuota ${fq(r.q.capLeft)} · gagal bayar ${riskLabel(d.buyerRisk * (1 + (60 - C(r.id).stab) / 60))}</div></div>
        <div class="r mono small ${r.q.unit * (1 - sr) > spot ? 'good' : ''}">${fmt(r.q.unit)}</div></div>`;
    }).join('') : '<p class="dim small">Tidak ada negara yang kekurangan komoditas ini. Jual di pasar spot.</p>'}</div>
    ${bl.length ? `<p class="small dim">Tertutup: ${bl.map(r => `${D(r.id).name} (${r.why})`).join(', ')}</p>` : ''}`);
}
function exportForm(c, id) {
  const stock = P().stock[c] || 0;
  const q0 = quoteExport(id, c, 1e-6, 'lc', true);
  const max = Math.max(0, Math.min(stock, q0.capLeft));
  UI.form = { kind: 'x', c, id, pay: 'lc', ins: true };
  openModal(`<h2>Ekspor ke ${D(id).name}</h2>
    <p class="small dim">${COM(c).name} · stok ${fq(stock)} · kuota pasar ${fq(q0.capLeft)} ${COM(c).unit}</p>
    <label class="small">Jumlah (${COM(c).unit})</label>
    <input type="number" id="qty" inputmode="decimal" step="any" value="${sig(max)}">
    <div class="btns">${[0.25, 0.5, 1].map(f => `<button class="btn sm" data-act="setQty" data-v="${max * f}">${f * 100}%</button>`).join('')}</div>
    <h3>Cara pembayaran</h3>
    ${payOpt('lc', 'Letter of Credit (L/C)', 'Dijamin bank. Biaya 1%. Aman dari gagal bayar.', true)}
    ${payOpt('tt', 'T/T di muka', 'Pembeli bayar dulu → aman, tapi harus beri diskon 4%.')}
    ${payOpt('oa', 'Open Account', 'Tanpa biaya, tapi pembeli bisa gagal bayar!')}
    <label class="opt on" id="insL"><input type="checkbox" id="ins" checked> <span><b>Asuransi kargo</b> (0,8%)<br><span class="small dim">Ganti 90% nilai jika kapal tenggelam/dibajak.</span></span></label>
    <div id="quote" class="card"></div>
    <button class="btn pri block" data-act="doExp">Kirim Ekspor</button>`);
  updateQuote();
}
function payOpt(v, t, d, on) {
  return `<label class="opt ${on ? 'on' : ''}"><input type="radio" name="pay" value="${v}" ${on ? 'checked' : ''}> <span><b>${t}</b><br><span class="small dim">${d}</span></span></label>`;
}
function readForm() {
  const f = UI.form; if (!f) return null;
  const qi = $('#qty'); f.qty = qi ? Math.max(0, parseFloat(qi.value) || 0) : 0;
  const pr = document.querySelector('input[name=pay]:checked'); if (pr) f.pay = pr.value;
  const ins = $('#ins'); if (ins) f.ins = ins.checked;
  document.querySelectorAll('label.opt').forEach(l => { const i = l.querySelector('input'); l.classList.toggle('on', i.checked); });
  return f;
}
function updateQuote() {
  const f = readForm(); if (!f) return;
  const box = $('#quote'); if (!box) return;
  if (f.kind === 'x') {
    const q = quoteExport(f.id, f.c, f.qty, f.pay, f.ins), d = D(f.id), me = ME();
    const food = ['pangan', 'kebun'].includes(COM(f.c).cat);
    let pRej = (food ? 0.06 : 0.02) * d.strict * (1 - me.tech / 150);
    if ((f.id === 'deu' || f.id === 'gbr') && EUDR_COMS.includes(f.c) && !P().certified) pRej += 0.08;
    const pDef = f.pay === 'oa' ? d.buyerRisk * (1 + (60 - C(f.id).stab) / 60) + mod('default') : 0;
    const pLoss = routeRisk(D(S.pid).region, d.region);
    const spot = quoteSpotSell(f.c, f.qty).total;
    box.innerHTML = `<div class="kv"><span>Harga / satuan</span><span>${fmt(q.unit)}</span></div>
      <div class="kv"><span>Nilai kontrak (diterima saat tiba)</span><span class="good">${fmt(q.gross)}</span></div>
      <div class="kv"><span>Ongkos kirim (bayar sekarang)</span><span class="bad">−${fmt(q.ship)}</span></div>
      <div class="kv"><span>Biaya L/C & asuransi</span><span class="bad">−${fmt(q.fee)}</span></div>
      <div class="kv tot"><span>Estimasi bersih</span><span>${fmt(q.net)}</span></div>
      <div class="small dim">Bandingkan: jual di spot sekarang ≈ ${fmt(spot)} (tanpa risiko)</div>
      <div class="small" style="margin-top:6px">Risiko: hilang di laut ${(pLoss * 100).toFixed(1)}%${f.ins ? ' (diasuransikan)' : ' <span class="bad">(tanpa asuransi!)</span>'} · ditolak mutu ${(pRej * 100).toFixed(1)}%${f.pay === 'oa' ? ` · <span class="bad">gagal bayar ${(pDef * 100).toFixed(1)}%</span>` : ''}</div>
      ${!q.ok ? `<div class="small bad" style="margin-top:6px">✖ ${q.why || (f.qty > (P().stock[f.c] || 0) + 1e-9 ? 'Stok tidak cukup' : f.qty > q.capLeft + 1e-9 ? 'Melebihi kuota pasar' : P().kas < q.ship + q.fee ? 'Kas tak cukup untuk ongkos kirim' : 'Jumlah tidak valid')}</div>` : ''}`;
  } else if (f.kind === 'm') {
    const q = quoteImport(f.id, f.c, f.qty, f.pay, f.ins), d = D(f.id);
    const pLoss = routeRisk(d.region, D(S.pid).region);
    const spot = quoteSpotBuy(f.c, f.qty).total;
    box.innerHTML = `<div class="kv"><span>Harga / satuan</span><span>${fmt(q.unit)}</span></div>
      <div class="kv"><span>Harga barang</span><span>${fmt(q.cost)}</span></div>
      <div class="kv"><span>Ongkos kirim</span><span>${fmt(q.ship)}</span></div>
      <div class="kv"><span>Biaya L/C & asuransi</span><span>${fmt(q.fee)}</span></div>
      <div class="kv tot"><span>Total dibayar sekarang</span><span class="bad">${fmt(q.total)}</span></div>
      <div class="small dim">Bandingkan: beli spot sekarang ≈ ${fmt(spot)} (langsung masuk gudang)</div>
      <div class="small" style="margin-top:6px">Risiko: hilang ${(pLoss * 100).toFixed(1)}%${f.ins ? ' (diasuransikan)' : ' <span class="bad">(tanpa asuransi!)</span>'} · tertunda ~${Math.max(1, (5 + mod('delay') * 100 - ME().infra / 10)).toFixed(0)}%${f.pay === 'tt' ? ` · <span class="bad">penipuan ${((0.02 + d.buyerRisk * 0.6) * 100).toFixed(1)}%</span>` : ''}</div>
      ${!q.ok ? `<div class="small bad" style="margin-top:6px">✖ ${q.why || (f.qty > q.capLeft + 1e-9 ? 'Melebihi kapasitas pemasok' : P().kas < q.total ? 'Kas tidak cukup' : 'Jumlah tidak valid')}</div>` : ''}`;
  } else if (f.kind === 'spot') {
    const q = f.side === 'sell' ? quoteSpotSell(f.c, f.qty) : quoteSpotBuy(f.c, f.qty);
    box.innerHTML = `<div class="kv"><span>Harga / satuan</span><span>${fmt(q.unit)}</span></div>
      <div class="kv tot"><span>${f.side === 'sell' ? 'Anda terima' : 'Anda bayar'}</span><span>${fmt(q.total)}</span></div>
      <div class="small dim">Makin banyak volume, makin buruk harga (penawaran & permintaan).</div>`;
  } else if (f.kind === 'fx') {
    const fx = S.fx[f.code];
    if (f.side === 'buy') {
      const imp = f.qty / fx.depth;
      box.innerHTML = `<div class="kv"><span>Dapat kira-kira</span><span>${fq(f.qty / (fx.v * (1 + imp / 2) * 1.003))} ${f.code}</span></div>
        <div class="kv"><span>Dampak ke kurs</span><span class="good">+${(imp * 100).toFixed(2)}%</span></div>
        <div class="small dim">Pembelian Anda menambah permintaan → harga naik. Sebagian dampak ini hilang di akhir kuartal.</div>`;
    } else {
      const imp = Math.min(0.5, f.qty * fx.v / fx.depth);
      box.innerHTML = `<div class="kv"><span>Dapat kira-kira</span><span>${fmt(f.qty * fx.v * (1 - imp / 2) * 0.997)}</span></div>
        <div class="kv"><span>Dampak ke kurs</span><span class="bad">−${(imp * 100).toFixed(2)}%</span></div>`;
    }
  } else if (f.kind === 'amt') {
    box.innerHTML = f.note ? f.note(f.qty) : '';
  }
}

// ---------- IMPOR ----------
function importList(c) {
  const rows = otherCountries().map(id => ({ id, q: quoteImport(id, c, 1e-6, 'lc', false), cap: importCapTotal(id, c), why: blocked(id, c) }));
  const ok = rows.filter(r => r.cap > 0).sort((a, b) => (a.q.unit * (1 + shipRate(D(a.id).region, D(S.pid).region, c))) - (b.q.unit * (1 + shipRate(D(b.id).region, D(S.pid).region, c))));
  const bans = otherCountries().filter(id => C(id).exportBan && C(id).exportBan[c] > 0);
  const spot = quoteSpotBuy(c, 1e-6).unit;
  const need = projection()[c];
  openModal(`<h2>⬇ Impor ${COM(c).name}</h2>
    <p class="small dim">Proyeksi akhir kuartal: <b class="${need.end < 0 ? 'bad' : ''}">${fq(need.end)} ${COM(c).unit}</b>. Harga termasuk ongkos kirim. Pasar spot: ${fmt(spot)} (langsung tiba, tanpa risiko).</p>
    <div class="card" style="padding:4px 10px">${ok.length ? ok.map(r => {
      const d = D(r.id), sr = shipRate(d.region, D(S.pid).region, c), landed = r.q.unit * (1 + sr);
      return `<div class="row tap" data-act="impForm" data-c="${c}" data-id="${r.id}"><div class="grow">
        <div class="t">${d.name}</div><div class="sub">kapasitas ${fq(r.q.capLeft)} · kirim ${(sr * 100).toFixed(1)}% · ${REGIONS[d.region]}</div></div>
        <div class="r mono small ${landed < spot ? 'good' : ''}">${fmt(landed)}</div></div>`;
    }).join('') : '<p class="dim small">Tidak ada negara dengan surplus. Gunakan pasar spot.</p>'}</div>
    ${bans.length ? `<p class="small warn">Larangan ekspor: ${bans.map(id => D(id).name).join(', ')}</p>` : ''}
    <button class="btn block" data-act="spot" data-c="${c}" data-s="buy">Beli di pasar spot</button>`);
}
function importForm(c, id) {
  const pr = projection()[c];
  const q0 = quoteImport(id, c, 1e-6, 'lc', true);
  const sug = Math.max(0, Math.min(q0.capLeft, pr.end < 0 ? -pr.end * 1.1 : pr.use * 0.5));
  UI.form = { kind: 'm', c, id, pay: 'lc', ins: true };
  openModal(`<h2>Impor dari ${D(id).name}</h2>
    <p class="small dim">${COM(c).name} · kapasitas pemasok ${fq(q0.capLeft)} ${COM(c).unit} · proyeksi stok ${fq(pr.end)}</p>
    <label class="small">Jumlah (${COM(c).unit})</label>
    <input type="number" id="qty" inputmode="decimal" step="any" value="${sig(sug)}">
    <div class="btns">${[0.25, 0.5, 1].map(f => `<button class="btn sm" data-act="setQty" data-v="${q0.capLeft * f}">${f * 100}%</button>`).join('')}</div>
    <h3>Cara pembayaran</h3>
    ${payOpt('lc', 'Letter of Credit (L/C)', 'Bank membayar setelah dokumen pengapalan lengkap. Biaya 1%.', true)}
    ${payOpt('tt', 'T/T di muka', 'Diskon 2%, tapi risiko pemasok fiktif/menipu.')}
    <label class="opt on"><input type="checkbox" id="ins" checked> <span><b>Asuransi kargo</b> (0,8%)</span></label>
    <div id="quote" class="card"></div>
    <button class="btn pri block" data-act="doImp">Pesan Impor</button>`);
  updateQuote();
}
function spotForm(c, side) {
  const p = P(), pr = projection()[c];
  const def = side === 'sell' ? (p.stock[c] || 0) : Math.max(0, -pr.end);
  UI.form = { kind: 'spot', c, side };
  openModal(`<h2>${side === 'sell' ? 'Jual' : 'Beli'} ${COM(c).name} — Pasar Spot</h2>
    <p class="small dim">Pasar spot = pedagang komoditas global. Transaksi instan & tanpa risiko, tapi harga ${side === 'sell' ? 'lebih rendah (−10%)' : 'lebih mahal (+10%)'} dari harga dunia.</p>
    <label class="small">Jumlah (${COM(c).unit}) ${side === 'sell' ? '· stok ' + fq(p.stock[c] || 0) : ''}</label>
    <input type="number" id="qty" inputmode="decimal" step="any" value="${sig(def)}">
    ${side === 'sell' ? `<div class="btns">${[0.25, 0.5, 1].map(f => `<button class="btn sm" data-act="setQty" data-v="${(p.stock[c] || 0) * f}">${f * 100}%</button>`).join('')}</div>` : ''}
    <div id="quote" class="card"></div>
    <button class="btn pri block" data-act="doSpot">${side === 'sell' ? 'Jual' : 'Beli'}</button>`);
  updateQuote();
}

// ---------- INDUSTRI ----------
function vInd() {
  const p = P(), me = ME(), proj = projection();
  let html = '<h2>Kapasitas Produksi</h2><div class="card" style="padding:4px 10px">';
  const raws = Object.keys(p.cap).filter(c => !RECIPES[c] && p.cap[c] > 0);
  const mfg = MFG_ORDER.filter(c => (p.cap[c] || 0) > 0);
  for (const c of mfg) {
    const r = RECIPES[c], out = proj[c].prod, cap = p.cap[c];
    const lim = out < cap * 0.98;
    html += `<div class="row"><div class="grow"><div class="t">${r.label}</div>
      <div class="sub">${COM(c).name}: ${fq(out)} / ${fq(cap)} ${COM(c).unit}${Object.keys(r.in).length ? ' · bahan: ' + Object.keys(r.in).map(i => `${COM(i).name} ${fq(r.in[i] * cap)}`).join(', ') : ''}</div>
      ${lim ? '<div class="small bad">⚠ Kekurangan bahan baku — impor atau kurangi ekspor bahan mentah!</div>' : ''}</div></div>`;
  }
  for (const c of raws) html += `<div class="row"><div class="grow"><div class="t">${COM(c).name}</div><div class="sub">${fq(p.cap[c])} ${COM(c).unit}/kuartal · biaya produksi ${Math.round(costFactor(c) * 100)}% harga dasar</div></div></div>`;
  html += '</div>';
  if (p.building.length) html += '<h3>Sedang dibangun</h3><div class="card" style="padding:4px 10px">' + p.building.map(b => `<div class="row"><div class="grow">${b.label}</div><div class="dim small">${b.t} kuartal lagi</div></div>`).join('') + '</div>';

  html += `<h2>Bangun Pabrik</h2><p class="small dim">Pabrik mengubah bahan mentah menjadi barang bernilai tinggi (hilirisasi). Teknologi Anda: <b>${me.tech.toFixed(1)}</b>.</p>`;
  for (const c of MFG_ORDER) {
    const r = RECIPES[c], why = canBuild(c), cost = factoryCost(c);
    const inCost = Object.keys(r.in).reduce((a, i) => a + r.in[i] * S.prices[i], 0);
    const margin = (S.prices[c] * (1 - r.opex) - inCost) * r.lot;
    html += `<div class="card"><div class="hbar"><div class="grow"><b>${r.label}</b></div><span class="mono small">${fmt(cost)}</span></div>
      <div class="small">+${fq(r.lot)} ${COM(c).unit} ${COM(c).name}/kuartal · ${r.time} kuartal · tek. min ${r.tech}</div>
      <div class="small dim">Bahan: ${Object.keys(r.in).length ? Object.keys(r.in).map(i => `${fq(r.in[i] * r.lot)} ${COM(i).unit} ${COM(i).name}`).join(', ') : 'tenaga kerja saja'} · est. margin ${fmt(margin)}/kuartal</div>
      <div class="btns"><button class="btn sm ${why ? '' : 'good'}" data-act="build" data-c="${c}" ${why ? 'disabled' : ''}>${why ? why : 'Bangun'}</button></div></div>`;
  }
  html += '<h2>Perluas Tambang & Lahan</h2><div class="card" style="padding:4px 10px">';
  for (const c of raws) {
    const e = expandInfo(c);
    html += `<div class="row"><div class="grow"><div class="t">${COM(c).name}</div><div class="sub">+${fq(e.lot)} ${COM(c).unit}/kuartal · ${e.time} kuartal</div></div>
      <button class="btn sm" data-act="expand" data-c="${c}" ${p.kas < e.cost ? 'disabled' : ''}>${fmt(e.cost)}</button></div>`;
  }
  html += '</div>';
  html += `<h2>Kawasan Ekonomi Khusus</h2><div class="card"><p class="small">KEK aktif: <b>${p.kek}</b>/5. Menarik investasi asing (FDI) → pertumbuhan & tawaran pabrik gratis lebih sering.</p>
    <button class="btn sm" data-act="kek" ${p.kas < kekCost() || p.kek >= 5 ? 'disabled' : ''}>Bangun KEK (${fmt(kekCost())})</button></div>`;
  return html;
}

// ---------- KEUANGAN ----------
const BUD = [
  ['tax', 'Pajak', 'Pendapatan negara. Di atas awal: pertumbuhan & stabilitas turun.', 3, 45],
  ['rutin', 'Belanja rutin', 'Gaji, subsidi, pertahanan. Dipangkas: stabilitas turun.', 0.5, 60],
  ['infra', 'Infrastruktur', 'Jalan, pelabuhan, listrik → ongkos kirim turun, pertumbuhan & FDI naik.', 0, 12],
  ['edu', 'Pendidikan', 'Menaikkan IPM & sedikit teknologi.', 0, 12],
  ['health', 'Kesehatan', 'Menaikkan IPM.', 0, 12],
  ['rnd', 'Riset & Teknologi', 'Menaikkan teknologi → pabrik canggih & produk bermutu.', 0, 12],
];
function vFin() {
  const p = P(), me = ME(), b = p.budget, rt = rating();
  const q = (x) => me.gdp * x / 400;
  const tax = q(b.tax), rutin = q(b.rutin), dev = q(b.infra + b.edu + b.health + b.rnd), intr = p.debt * p.debtRate / 400;
  const bal = tax - rutin - dev - intr;
  let html = `<h2>APBN (% PDB per tahun)</h2><div class="card">` + BUD.map(([k, n, d]) => `
    <div class="row"><div class="grow"><div class="t">${n} <span class="mono acc">${b[k].toFixed(1)}%</span>${Math.abs(b[k] - p.budget0[k]) > 0.05 ? ` <span class="small dim">(awal ${p.budget0[k]})</span>` : ''}</div>
    <div class="sub">${d}</div><div class="sub mono">${fmt(q(b[k]))}/kuartal</div></div>
    <button class="btn sm" data-act="bud" data-k="${k}" data-d="-0.5">−</button><button class="btn sm" data-act="bud" data-k="${k}" data-d="0.5">＋</button></div>`).join('') + `</div>
  <div class="card"><h3 style="margin-top:0">Proyeksi fiskal kuartal ini</h3>
    <div class="kv"><span>Penerimaan pajak</span><span class="good">+${fmt(tax)}</span></div>
    <div class="kv"><span>Belanja rutin</span><span class="bad">−${fmt(rutin)}</span></div>
    <div class="kv"><span>Belanja pembangunan</span><span class="bad">−${fmt(dev)}</span></div>
    <div class="kv"><span>Bunga utang (${p.debtRate.toFixed(2)}%)</span><span class="bad">−${fmt(intr)}</span></div>
    <div class="kv tot"><span>Saldo fiskal</span><span class="${clr(bal)}">${fmt(bal)}</span></div>
    <div class="small dim">Belum termasuk hasil dagang: penjualan domestik, ekspor, impor, biaya produksi.</div></div>`;
  const lr = p.lastReport;
  if (lr) {
    const f = lr.fin, L = [['tax', 'Pajak'], ['domRev', 'Penjualan domestik'], ['contract', 'Kontrak dagang'], ['autoSell', 'Jual otomatis (spot)'], ['prodCost', 'Biaya produksi & pabrik'], ['autoImport', 'Impor darurat otomatis'], ['rutin', 'Belanja rutin'], ['dev', 'Pembangunan'], ['interest', 'Bunga utang'], ['fxInt', 'Bunga valas']];
    html += `<h3>Arus kas akhir kuartal lalu</h3><div class="card">` + L.filter(([k]) => f[k]).map(([k, n]) => `<div class="kv"><span>${n}</span><span class="${clr(f[k])}">${fmt(f[k])}</span></div>`).join('') +
      `<div class="small dim">Hasil ekspor langsung & ongkos kirim tercatat saat transaksi / saat kapal tiba.</div></div>`;
  }
  html += `<h2>Utang & Pembiayaan</h2><div class="card">
    <div class="kv"><span>Total utang</span><span>${fmt(p.debt)}</span></div>
    <div class="kv"><span>Utang / PDB</span><span>${(p.debt / me.gdp * 100).toFixed(1)}%</span></div>
    <div class="kv"><span>Bunga rata-rata</span><span>${p.debtRate.toFixed(2)}%</span></div>
    <div class="kv"><span>Rating kredit</span><span><b>${rt.r}</b> <span class="dim">(${ratingScore().toFixed(0)})</span></span></div>
    <div class="kv"><span>Bunga obligasi baru</span><span>${bondRate().toFixed(2)}%</span></div>
    <div class="kv"><span>Sisa batas terbit kuartal ini</span><span>${fmt(maxIssue())}</span></div>
    <div class="kv"><span>Suku bunga global (The Fed)</span><span>${S.globalRate.toFixed(2)}%</span></div>
    <div class="small dim">Rating dipengaruhi rasio utang, inflasi, stabilitas, kas, dan kekayaan per kapita.</div>
  </div>
  <button class="btn block" data-act="bond">📜 Terbitkan Obligasi Negara (SUN)</button>
  <button class="btn block" data-act="wb" ${wbAvailable() ? '' : 'disabled'}>🏦 Pinjaman Bank Dunia · ${fmt(wbAmount())} @2%${wbAvailable() ? '' : ' (tidak tersedia)'}</button>
  <button class="btn block" data-act="imf" ${imfAvailable() ? '' : 'disabled'}>🆘 Bailout IMF · 4% PDB @3%${imfAvailable() ? ' (bersyarat!)' : ' (hanya saat krisis)'}</button>
  <button class="btn block" data-act="repay" ${p.kas > 0 && p.debt > 0 ? '' : 'disabled'}>💰 Lunasi Utang</button>
  <button class="btn block bad" data-act="print">🖨 Cetak Uang (inflasi!)</button>`;
  return html;
}
function amountForm(title, desc, max, act, noteFn, unit = 'USD jt') {
  UI.form = { kind: 'amt', act, note: noteFn };
  openModal(`<h2>${title}</h2><p class="small dim">${desc}</p>
    <label class="small">Jumlah (${unit}) · maks ${unit === 'USD jt' ? fmt(max) : fq(max)}</label>
    <input type="number" id="qty" inputmode="decimal" step="any" value="${sig(max * 0.5)}">
    <div class="btns">${[0.1, 0.25, 0.5, 1].map(f => `<button class="btn sm" data-act="setQty" data-v="${max * f}">${f * 100}%</button>`).join('')}</div>
    <div id="quote" class="card"></div>
    <button class="btn pri block" data-act="doAmt">Konfirmasi</button>`);
  updateQuote();
}

// ---------- FOREX ----------
function vFx() {
  const p = P(), pf = fxPortfolio();
  let html = `<h2>Pasar Valuta Asing</h2>
  <div class="card"><div class="grid">
    <div class="stat"><div class="k">Kas (USD)</div><div class="v">${fmt(p.kas)}</div></div>
    <div class="stat"><div class="k">Nilai portofolio valas</div><div class="v">${fmt(pf.val)}</div></div>
    <div class="stat"><div class="k">Untung/rugi belum terealisasi</div><div class="v ${clr(pf.pnl)}">${fmt(pf.pnl)}</div></div>
    <div class="stat"><div class="k">Untung/rugi terealisasi</div><div class="v ${clr(p.fxPnl)}">${fmt(p.fxPnl)}</div></div></div>
    <p class="small dim" style="margin-top:8px">Aturannya sederhana: <b class="good">permintaan</b> &gt; <b class="bad">penawaran</b> → mata uang menguat di akhir kuartal, dan sebaliknya. Membeli dalam jumlah besar ikut menaikkan harga. Memegang valas memberi bunga tiap kuartal.</p></div>
  <div class="card" style="padding:4px 10px">`;
  for (const code in S.fx) {
    const f = S.fx[code], d = D(f.cid), hold = p.fx[code] || 0;
    const tot = f.D + f.S, dw = Math.round(f.D / tot * 10), sw = 10 - dw;
    html += `<div class="row tap" data-act="fxm" data-code="${code}"><div class="grow">
      <div class="t">${code} <span class="small dim">${f.name} · ${d.name}${f.cid === S.pid ? ' (Anda)' : ''}</span></div>
      <div class="ds"><span class="d">${'█'.repeat(dw)}</span><span class="s">${'█'.repeat(sw)}</span> <span class="dim">bunga ${f.int}%</span></div>
      ${hold ? `<div class="sub mono">pegang ${fq(hold)} ≈ ${fmt(hold * f.v)}</div>` : ''}</div>
      <div class="r"><div class="mono small">${fmtRate(1 / f.v)}</div><div class="small ${clr(f.chg || 0)}">${f.chg ? pct(f.chg, 2) : '—'}</div></div></div>`;
  }
  return html + '</div><p class="small dim">Kurs = satuan mata uang per 1 USD (angka turun = mata uang menguat). Bar hijau = permintaan, merah = penawaran.</p>';
}
function fxModal(code) {
  const f = S.fx[code], p = P(), hold = p.fx[code] || 0;
  const diff = (f.D - f.S) / (f.D + f.S);
  const hint = f.peg ? 'Mata uang ini dipatok ke dolar — hampir tidak bergerak.' : diff > 0.1 ? '<span class="good">Permintaan jauh lebih tinggi → kemungkinan besar MENGUAT.</span>' : diff > 0.02 ? '<span class="good">Permintaan sedikit lebih tinggi → cenderung menguat.</span>' : diff < -0.1 ? '<span class="bad">Penawaran jauh lebih tinggi → kemungkinan besar MELEMAH.</span>' : diff < -0.02 ? '<span class="bad">Penawaran sedikit lebih tinggi → cenderung melemah.</span>' : 'Seimbang — arah sulit ditebak.';
  const avg = hold ? (p.fxCost[code] || 0) / hold : 0;
  openModal(`<h2>${code} — ${f.name}</h2>
    <div class="card"><div class="kv"><span>Kurs</span><span>${fmtRate(1 / f.v)} ${code}/USD</span></div>
      <div class="kv"><span>Nilai 1 ${code}</span><span>$${f.v.toPrecision(4)}</span></div>
      <div class="kv"><span>Kekuatan (4 thn)</span><span class="spark">${spark(f.hist)}</span></div>
      <div class="kv"><span>Bunga / tahun</span><span>${f.int}%</span></div></div>
    <div class="card"><div class="kv"><span class="good">Permintaan</span><span>${fmt(f.D)}</span></div>
      <div class="kv"><span class="bad">Penawaran</span><span>${fmt(f.S)}</span></div>
      <div class="small">${hint}</div></div>
    ${hold ? `<div class="card"><div class="kv"><span>Dimiliki</span><span>${fq(hold)} ${code}</span></div><div class="kv"><span>Nilai sekarang</span><span>${fmt(hold * f.v)}</span></div><div class="kv"><span>Modal</span><span>${fmt(p.fxCost[code] || 0)}</span></div><div class="kv"><span>Kurs beli rata-rata</span><span>${avg ? fmtRate(1 / (avg / 1)) : '-'}</span></div></div>` : ''}
    <div class="btns"><button class="btn good" data-act="fxForm" data-code="${code}" data-s="buy">Beli ${code}</button>
    <button class="btn bad" data-act="fxForm" data-code="${code}" data-s="sell" ${hold ? '' : 'disabled'}>Jual ${code}</button></div>
    ${f.cid === S.pid ? '<p class="small dim">Membeli mata uang sendiri = intervensi bank sentral untuk menahan pelemahan (mengurangi inflasi impor).</p>' : ''}`);
}
function fxForm(code, side) {
  const p = P(), hold = p.fx[code] || 0;
  UI.form = { kind: 'fx', code, side };
  const max = side === 'buy' ? Math.max(0, p.kas) : hold;
  openModal(`<h2>${side === 'buy' ? 'Beli' : 'Jual'} ${code}</h2>
    <label class="small">${side === 'buy' ? 'Jumlah USD (juta) yang dibelanjakan' : 'Jumlah ' + code + ' yang dijual'} · maks ${side === 'buy' ? fmt(max) : fq(max)}</label>
    <input type="number" id="qty" inputmode="decimal" step="any" value="${sig(side === 'buy' ? Math.min(max, 100) : max)}">
    <div class="btns">${[0.1, 0.25, 0.5, 1].map(f => `<button class="btn sm" data-act="setQty" data-v="${max * f}">${f * 100}%</button>`).join('')}</div>
    <div id="quote" class="card"></div>
    <button class="btn pri block" data-act="doFx">${side === 'buy' ? 'Beli' : 'Jual'}</button>`);
  updateQuote();
}

// ---------- DUNIA ----------
function vWorld() {
  const rk = rankings();
  let html = `<h2>Peringkat Negara Maju</h2><div class="card" style="padding:6px">
    <table class="t"><tr><th>#</th><th>Negara</th><th>Skor</th><th>PDB/kap</th><th>IPM</th><th>Tek</th></tr>` +
    rk.map((r, i) => { const c = C(r.id); return `<tr class="tap ${r.id === S.pid ? 'me' : ''}" data-act="country" data-id="${r.id}"><td>${i + 1}</td><td>${D(r.id).name}</td><td>${r.score.toFixed(1)}</td><td>${(gdppc(c) / 1000).toFixed(1)}k</td><td>${c.hdi.toFixed(2)}</td><td>${c.tech.toFixed(0)}</td></tr>`; }).join('') +
    `</table></div><p class="small dim">Ketuk negara untuk diplomasi: misi dagang, perjanjian dagang bebas (FTA), bantuan.</p>`;
  html += `<h3>Kondisi global</h3><div class="card"><div class="kv"><span>Suku bunga global</span><span>${S.globalRate.toFixed(2)}%</span></div>` +
    (S.events.length ? S.events.map(e => `<div class="kv"><span>${esc(e.title)}</span><span class="dim">${e.t} kuartal</span></div>`).join('') : '<div class="small dim">Tidak ada peristiwa besar.</div>') + '</div>';
  if (P().euBlock && !P().certified) html += `<div class="card note small">Akses Eropa untuk sawit/kopi/kakao/karet/daging tertutup (EUDR).<div class="btns"><button class="btn sm" data-act="eudr">Sertifikasi sekarang</button></div></div>`;
  return html;
}
function countryModal(id) {
  const c = C(id), d = D(id);
  if (id === S.pid) { UI.tab = 'home'; render(); return; }
  const needs = Object.keys(COMMODITIES).map(k => [k, netDemand(id, k) * S.prices[k]]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const sells = Object.keys(COMMODITIES).map(k => [k, -netDemand(id, k) * S.prices[k]]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const why = blocked(id);
  const f = S.fx[d.cur.code];
  openModal(`<h2>${d.name}</h2><div class="small dim">${REGIONS[d.region]} · skor ${scoreOf(c).toFixed(1)} · mata uang ${d.cur.code}${f ? ' ' + fmtRate(1 / f.v) + '/USD' : ''}</div>
    <div class="grid" style="margin-top:8px">
      <div class="stat"><div class="k">PDB</div><div class="v">${fmt(c.gdp)}</div><div class="s">tumbuh ${pct(c.growth)}</div></div>
      <div class="stat"><div class="k">Hubungan</div><div class="v ${c.rel < 30 ? 'bad' : c.rel >= 60 ? 'good' : ''}">${c.rel.toFixed(0)}/100</div><div class="s">${c.fta ? 'FTA aktif' : 'tanpa FTA'}</div></div>
      <div class="stat"><div class="k">Tarif untuk Anda</div><div class="v">${(tariffOn(id, '_') * 100).toFixed(0)}%</div><div class="s">${c.tAddT > 0 ? '<span class="bad">perang dagang</span>' : 'umum'}</div></div>
      <div class="stat"><div class="k">Stabilitas</div><div class="v">${c.stab.toFixed(0)}</div><div class="s">risiko bayar ${riskLabel(d.buyerRisk)}</div></div></div>
    ${why ? `<div class="card alert small">⛔ ${why}: perdagangan tertutup${c.embargo > 0 ? ` (${c.embargo} kuartal)` : ''}.</div>` : ''}
    ${Object.keys(d.special).length ? `<p class="small dim">Tarif khusus: ${Object.keys(d.special).map(k => `${COM(k).name} ${(d.special[k] * 100).toFixed(0)}%`).join(', ')}</p>` : ''}
    <h3>Mereka butuh (peluang ekspor)</h3><p class="small">${needs.map(x => `${COM(x[0]).name} <span class="dim">(${fmt(x[1])})</span>`).join(', ') || '-'}</p>
    <h3>Mereka surplus (sumber impor)</h3><p class="small">${sells.map(x => `${COM(x[0]).name} <span class="dim">(${fmt(x[1])})</span>`).join(', ') || '-'}</p>
    <h3>Diplomasi</h3>
    <button class="btn block" data-act="mission" data-id="${id}" ${why || c.missionT > 0 ? 'disabled' : ''}>🤝 Misi Dagang (${fmt(missionCost())}) — hubungan +6, kuota +35%</button>
    <button class="btn block" data-act="fta" data-id="${id}" ${why || c.fta || c.rel < 60 ? 'disabled' : ''}>📝 Perjanjian Dagang Bebas (${fmt(ftaCost())})${c.rel < 60 ? ' — butuh hubungan 60' : ''}</button>
    <button class="btn block" data-act="aid" data-id="${id}">🎁 Bantuan Pembangunan (${fmt(aidCost())}) — hubungan +9</button>`);
}

// ---------- BERITA ----------
function vNews() {
  if (!S.news.length) return '<p class="dim">Belum ada berita.</p>';
  return '<h2>Berita & Log</h2>' + S.news.map(n => `<div class="news ${n.type}"><div class="when">${dateLabel(Math.max(0, n.t - 1))}</div>${esc(n.text)}</div>`).join('');
}

// ============================================================
//  LAPORAN, EVENT, AKHIR PERMAINAN
// ============================================================
function reportModal(rep) {
  if (!rep) return;
  const gp = rep.gparts || {};
  const G = [['pot', 'Potensi alami'], ['tradeE', 'Neraca dagang'], ['infraE', 'Infrastruktur'], ['techE', 'Teknologi'], ['devE', 'Belanja pembangunan'], ['fdiE', 'Investasi asing'], ['taxE', 'Kebijakan pajak'], ['pen', 'Inflasi/instabilitas/kelangkaan'], ['ev', 'Peristiwa global']];
  openModal(`<h2>Laporan ${rep.date}</h2>
    <div class="grid">
      <div class="stat"><div class="k">Pertumbuhan PDB</div><div class="v ${clr(rep.g)}">${pct(rep.g)}</div><div class="s">tahunan</div></div>
      <div class="stat"><div class="k">Skor</div><div class="v">${rep.score.toFixed(1)}</div><div class="s ${clr(rep.score - rep.score0)}">${pct(rep.score - rep.score0, 2).replace('%', '')} poin</div></div>
      <div class="stat"><div class="k">Peringkat</div><div class="v">#${rep.rank}</div><div class="s">${rep.rank < rep.rank0 ? '<span class="good">naik</span>' : rep.rank > rep.rank0 ? '<span class="bad">turun</span>' : 'tetap'}</div></div>
      <div class="stat"><div class="k">Ekspor / Impor</div><div class="v small">${fmt(rep.exp)}</div><div class="s">impor ${fmt(rep.imp)}</div></div></div>
    ${rep.warn.length ? `<div class="card alert">${rep.warn.map(w => `<p class="small">${esc(w)}</p>`).join('')}</div>` : ''}
    ${rep.events.length ? `<h3>Peristiwa</h3>${rep.events.map(e => `<div class="card note"><b>${esc(e.title)}</b><p class="small">${esc(e.text)}</p></div>`).join('')}` : ''}
    ${rep.ship.length ? `<h3>Pengiriman & kontrak</h3><div class="card">${rep.ship.map(s => `<p class="small">${esc(s)}</p>`).join('')}</div>` : ''}
    ${rep.lines.length ? `<h3>Dalam negeri</h3><div class="card">${rep.lines.map(s => `<p class="small">${esc(s)}</p>`).join('')}</div>` : ''}
    <h3>Rincian pertumbuhan (poin %)</h3><div class="card">${G.map(([k, n]) => `<div class="kv"><span>${n}</span><span class="${clr(gp[k] || 0)}">${pct(gp[k] || 0, 2)}</span></div>`).join('')}</div>
    <button class="btn pri block" data-act="close">Lanjut</button>`);
}
function showPending() {
  const pe = S.pending[0];
  if (!pe) return;
  const ch = pendingChoices(pe);
  openModal(`<div class="small warn">⚡ KEPUTUSAN DIPERLUKAN</div><h2>${esc(pe.title)}</h2><p>${esc(pe.text)}</p>
    ${ch.map((c, i) => `<button class="btn block" style="text-align:left" data-act="choose" data-i="${i}"><b>${esc(c.label)}</b>${c.desc ? `<br><span class="small dim">${esc(c.desc)}</span>` : ''}</button>`).join('')}
    <p class="small dim">Kas saat ini: ${fmt(P().kas)}</p>`, { noClose: true });
}
function showOver() {
  UI.overShown = true;
  const o = S.over, me = ME(), p = P();
  openModal(`<h2>${o.win ? '🏆 KEMENANGAN!' : '📉 Permainan Berakhir'}</h2><p>${esc(o.text)}</p>
    <div class="card"><div class="kv"><span>Tahun</span><span>${dateLabel(S.turn)}</span></div>
    <div class="kv"><span>PDB</span><span>${fmt(me.gdp)} (awal ${fmt(me.gdp0)})</span></div>
    <div class="kv"><span>PDB per kapita</span><span>$${Math.round(gdppc(me)).toLocaleString('id-ID')}</span></div>
    <div class="kv"><span>Skor akhir</span><span>${scoreOf(me).toFixed(1)}</span></div>
    <div class="kv"><span>Peringkat terbaik</span><span>#${p.bestRank}</span></div></div>
    <button class="btn pri block" data-act="newGame">Main Lagi</button>
    <button class="btn block" data-act="close">Lihat kondisi akhir</button>`, {});
}
function helpModal() {
  openModal(`<h2>Cara Bermain</h2>
  <h3>Tujuan</h3><p class="small">Naikkan <b>Skor Kemajuan</b> (pendapatan per kapita, IPM, teknologi) hingga ≥ ${WIN_SCORE} dan jadi <b>#1 dunia</b> selama ${WIN_HOLD} kuartal. Waktu: ${MAX_TURN / 4} tahun (1 giliran = 1 kuartal).</p>
  <h3>Siklus tiap kuartal</h3><ul class="list small">
    <li><b>Ekspor</b> stok yang ada di gudang. Uang diterima saat kapal tiba (akhir kuartal).</li>
    <li><b>Impor</b> kebutuhan pokok (pangan, BBM, obat) sebelum habis. Kelangkaan = inflasi & kerusuhan.</li>
    <li>Tekan <b>Akhiri Kuartal</b>: kapal tiba, pabrik berproduksi, rakyat berbelanja, pajak masuk, utang dibayar.</li></ul>
  <h3>Memilih pembeli</h3><ul class="list small">
    <li>Negara yang <b>kekurangan</b> suatu barang membayar lebih mahal, tapi kuotanya terbatas.</li>
    <li><b>Tarif</b> memotong harga bersih. FTA menghapus tarif umum.</li>
    <li><b>Ongkos kirim</b> naik sesuai jarak. Barang curah (batu bara, bijih) paling mahal dikirim.</li>
    <li><b>Pasar spot</b> = cepat & tanpa risiko, tapi harga lebih buruk.</li></ul>
  <h3>Risiko nyata perdagangan</h3><ul class="list small">
    <li><b>Gagal bayar</b>: gunakan L/C untuk pembeli berisiko (Open Account murah tapi berbahaya).</li>
    <li><b>Kapal tenggelam/dibajak</b>: asuransikan kargo, terutama lewat Laut Merah & Teluk Guinea.</li>
    <li><b>Ditolak mutu</b>: negara maju punya standar ketat; teknologi tinggi mengurangi risiko.</li>
    <li><b>Kemacetan pelabuhan</b>, mogok, penipuan T/T, pungli, tuduhan dumping, perang dagang, sanksi, EUDR, El Niño, krisis global…</li></ul>
  <h3>Pemodalan (seperti dunia nyata)</h3><ul class="list small">
    <li><b>Pajak</b> & <b>laba dagang</b> = sumber utama.</li>
    <li><b>Obligasi (SUN)</b>: bunga tergantung rating. Utang besar → rating turun → bunga naik.</li>
    <li><b>Bank Dunia</b>: murah, untuk negara berkembang. <b>IMF</b>: penyelamat saat krisis, tapi syaratnya pahit.</li>
    <li><b>Cetak uang</b>: kas instan, tapi memicu inflasi & melemahkan mata uang.</li>
    <li>Kas negatif tanpa bisa berutang = <b>gagal bayar</b>. 4 kuartal berturut-turut = bangkrut.</li></ul>
  <h3>Jalan menuju negara maju</h3><ul class="list small">
    <li><b>Hilirisasi</b>: bangun pabrik untuk mengolah bahan mentah → nilai tambah besar.</li>
    <li>Belanja <b>infrastruktur, pendidikan, kesehatan, riset</b> menaikkan pertumbuhan, IPM, & teknologi.</li>
    <li>Jaga <b>inflasi</b> rendah dan <b>stabilitas</b> tinggi agar investor asing datang.</li></ul>
  <h3>Forex (hiburan)</h3><p class="small">Setiap mata uang punya <b class="good">permintaan</b> dan <b class="bad">penawaran</b>. Jika permintaan lebih besar, kurs menguat di akhir kuartal. Beli murah, jual mahal, dan nikmati bunganya. Hati-hati: transaksi besar menggeser harga.</p>
  <h3>Satuan</h3><p class="small">$ jt = juta USD · $ M = miliar USD · $ T = triliun USD.</p>
  <button class="btn pri block" data-act="close">Mengerti</button>`);
}
function menuModal() {
  openModal(`<h2>Menu</h2>
    <p class="small dim">Permainan tersimpan otomatis setiap akhir kuartal dan setiap transaksi.</p>
    <button class="btn block" data-act="help">? Cara Bermain</button>
    <button class="btn block bad" data-act="askNew">Mulai Permainan Baru</button>`);
}

// ============================================================
//  AKSI
// ============================================================
const ACT = {
  close: () => closeModal(),
  tab: (d) => { UI.tab = d.k; $('#view').scrollTop = 0; render(); $('#view').scrollTop = 0; },
  sub: (d) => { UI.sub[d.t] = d.k; render(); },
  help: () => helpModal(),
  menu: () => menuModal(),
  continue: () => { if (loadGame()) { UI.overShown = false; render(); } },
  pickScreen: () => renderPick(),
  toStart: () => renderStart(),
  pickCountry: (d) => pickDetail(d.id),
  startGame: (d) => { newGame(d.id); UI.tab = 'home'; UI.overShown = false; saveGame(); closeModal(); render(); },
  askNew: () => openModal(`<h2>Mulai baru?</h2><p>Permainan saat ini akan dihapus.</p><button class="btn bad block" data-act="newGame">Ya, mulai baru</button><button class="btn block" data-act="close">Batal</button>`),
  newGame: () => { deleteSave(); S = null; closeModal(); renderPick(); },
  end: () => {
    if (UI.lock) return;
    if (S.pending.length) { showPending(); return; }
    if (S.over) { showOver(); return; }
    UI.lock = true;
    const rep = endTurn();
    UI.lock = false;
    saveGame();
    render();
    reportModal(rep);
  },
  report: () => reportModal(P().lastReport),
  choose: (d) => { const t = resolveChoice(+d.i); saveGame(); closeModal(); toast(t); render(); },
  com: (d) => comModal(d.c),
  expList: (d) => exportList(d.c),
  impList: (d) => importList(d.c),
  expForm: (d) => exportForm(d.c, d.id),
  impForm: (d) => importForm(d.c, d.id),
  spot: (d) => spotForm(d.c, d.s),
  setQty: (d) => { const i = $('#qty'); if (i) { i.value = sig(+d.v); updateQuote(); } },
  doExp: () => { const f = readForm(); res(doExport(f.id, f.c, f.qty, f.pay, f.ins)); },
  doImp: () => { const f = readForm(); res(doImport(f.id, f.c, f.qty, f.pay, f.ins)); },
  doSpot: () => { const f = readForm(); res(f.side === 'sell' ? doSpotSell(f.c, f.qty) : doSpotBuy(f.c, f.qty)); },
  ban: (d) => res(toggleBan(d.c)),
  pol: (d, el) => { P().policy[d.k] = el.checked; saveGame(); toast(el.checked ? 'Kebijakan diaktifkan.' : 'Kebijakan dinonaktifkan.'); },
  offerYes: (d) => res(acceptOffer(+d.id)),
  offerNo: (d) => res(rejectOffer(+d.id)),
  build: (d) => res(buildFactory(d.c)),
  expand: (d) => res(expandRaw(d.c)),
  kek: () => res(buildKEK()),
  bud: (d) => {
    const p = P(), k = d.k, spec = BUD.find(b => b[0] === k);
    let lo = spec[3], hi = spec[4];
    if (k === 'rutin') lo = Math.max(0.5, p.budget0.rutin * 0.5);
    p.budget[k] = Math.round(U.cl(p.budget[k] + +d.d, lo, hi) * 10) / 10;
    saveGame(); render();
  },
  bond: () => amountForm('Terbitkan Obligasi Negara', `Bunga ${bondRate().toFixed(2)}%/tahun (rating ${rating().r}). Menambah utang & menurunkan rating jika berlebihan.`, maxIssue(), 'bond',
    (x) => `<div class="kv"><span>Bunga per kuartal</span><span>${fmt(x * bondRate() / 400)}</span></div><div class="kv"><span>Utang/PDB setelahnya</span><span>${((P().debt + x) / ME().gdp * 100).toFixed(1)}%</span></div>`),
  wb: () => res(borrowWorldBank()),
  imf: () => openModal(`<h2>Bailout IMF</h2><p>IMF akan mencairkan <b>${fmt(ME().gdp * 0.04)}</b> berbunga 3%, dengan syarat:</p><ul class="list small"><li>Pajak naik 1,5 poin</li><li>Belanja rutin dipangkas 1,5 poin</li><li>Stabilitas −12 (demo penghematan)</li></ul><button class="btn pri block" data-act="imfYes">Terima</button><button class="btn block" data-act="close">Batal</button>`),
  imfYes: () => res(borrowIMF()),
  repay: () => amountForm('Lunasi Utang', `Utang ${fmt(P().debt)} dengan bunga rata-rata ${P().debtRate.toFixed(2)}%. Mengurangi beban bunga & memperbaiki rating.`, Math.min(P().kas, P().debt), 'repay',
    (x) => `<div class="kv"><span>Hemat bunga per kuartal</span><span class="good">${fmt(x * P().debtRate / 400)}</span></div>`),
  print: () => amountForm('Cetak Uang', 'Bank sentral mencetak uang baru. Kas bertambah instan, tetapi inflasi melonjak dan mata uang melemah. Maks 3% PDB per kuartal.', Math.max(0, ME().gdp * 0.03 - P().printedQ), 'print',
    (x) => `<div class="kv"><span>Tambahan inflasi</span><span class="bad">+${(x / ME().gdp * 100 * 2.2).toFixed(1)} poin</span></div>`),
  doAmt: () => {
    const f = readForm();
    const fn = { bond: issueBonds, repay: repayDebt, print: printMoney }[f.act];
    res(fn(f.qty));
  },
  fxm: (d) => fxModal(d.code),
  fxForm: (d) => fxForm(d.code, d.s),
  doFx: () => { const f = readForm(); res(f.side === 'buy' ? fxBuy(f.code, f.qty) : fxSell(f.code, f.qty)); },
  country: (d) => countryModal(d.id),
  mission: (d) => res(tradeMission(d.id)),
  fta: (d) => res(signFTA(d.id)),
  aid: (d) => res(giveAid(d.id)),
  eudr: () => res(certifyEUDR()),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return;
  const f = ACT[el.dataset.act];
  if (f) { e.preventDefault(); f(el.dataset, el); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('input[type=checkbox][data-act]')) { ACT[el.dataset.act](el.dataset, el); return; }
  if (el.closest('#sheet')) updateQuote();
});
document.addEventListener('input', (e) => { if (e.target.closest('#sheet')) updateQuote(); });
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !UI.noClose) closeModal(); });

// Tombol "kembali" Android (Capacitor)
try {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App) App.addListener('backButton', () => {
    if (UI.modalOpen) { if (!UI.noClose) closeModal(); }
    else if (S && UI.tab !== 'home') { UI.tab = 'home'; render(); }
    else App.exitApp();
  });
} catch (e) { }

// Mulai
if (loadGame()) render(); else renderStart();
