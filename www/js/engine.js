// ============================================================
//  MESIN GAME — tanpa DOM, bisa diuji di Node
// ============================================================
'use strict';

const START_YEAR = 2026;
const MAX_TURN = 160;      // 40 tahun
const WIN_SCORE = 97;
const WIN_HOLD = 4;
const WESTERN = ['usa', 'deu', 'gbr', 'jpn', 'aus', 'kor'];
const EUDR_COMS = ['sawit', 'kopi', 'kakao', 'karet', 'daging'];
const MFG_ORDER = ['bbm', 'baja', 'tekstil', 'elektronik', 'semikonduktor', 'baterai', 'farmasi', 'mobil', 'mesin'];
const ELASTIC = { pangan: 0.15, energi: 0.45, tambang: 0.4, kebun: 0.3, industri: 0.6, teknologi: 0.8 };
const DEBT_RATE0 = { idn: 6.5, usa: 3.3, chn: 2.8, jpn: 0.8, deu: 1.8, gbr: 3.5, ind: 7.2, bra: 10, sau: 4, rus: 8, aus: 3.2, kor: 2.8, vnm: 4, nga: 12 };

let S = null;

// ---------- util ----------
const U = {
  r: (a, b) => a + Math.random() * (b - a),
  g: () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
  cl: (x, a, b) => Math.max(a, Math.min(b, x)),
  pick: (a) => a[Math.floor(Math.random() * a.length)],
  ch: (p) => Math.random() < p,
  wpick(items, wf) {
    const tot = items.reduce((s, x) => s + wf(x), 0);
    if (tot <= 0) return null;
    let r = Math.random() * tot;
    for (const x of items) { r -= wf(x); if (r <= 0) return x; }
    return items[items.length - 1];
  },
};

function fmt(m) {
  const a = Math.abs(m), s = m < 0 ? '-' : '';
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + ' T';
  if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(a >= 1e5 ? 0 : a >= 1e4 ? 1 : 2) + ' M';
  return s + '$' + a.toFixed(a < 10 ? 1 : 0) + ' jt';
}
function fq(x) {
  const a = Math.abs(x);
  if (a >= 1000) return Math.round(x).toLocaleString('id-ID');
  if (a >= 100) return x.toFixed(0);
  if (a >= 10) return x.toFixed(1);
  if (a >= 1) return x.toFixed(2);
  return x.toFixed(3);
}
function pct(x, d = 1) { return (x >= 0 ? '+' : '') + x.toFixed(d) + '%'; }
function dateLabel(t) { return 'K' + ((t % 4) + 1) + ' ' + (START_YEAR + Math.floor(t / 4)); }

const P = () => S.p;
const ME = () => S.countries[S.pid];
const C = (id) => S.countries[id];
const D = (id) => COUNTRIES[id];
const COM = (c) => COMMODITIES[c];

// ---------- skor & peringkat ----------
function gdppc(c) { return c.gdp / c.pop; }
function incomeScore(c) { return Math.min(100, Math.sqrt(gdppc(c) / 100000) * 100); }
function scoreOf(c) { return 0.45 * incomeScore(c) + 0.35 * c.hdi * 100 + 0.2 * c.tech; }
function rankings() {
  return Object.values(S.countries).map(c => ({ id: c.id, score: scoreOf(c) })).sort((a, b) => b.score - a.score);
}
function myRank() { return rankings().findIndex(x => x.id === S.pid) + 1; }

// ---------- modifier event aktif ----------
const ADDITIVE = { pirate: 1, delay: 1, growth: 1, default: 1 };
function mod(kind, key) {
  const add = !!ADDITIVE[kind];
  let v = add ? 0 : 1;
  for (const e of S.events) {
    const m = e.mods && e.mods[kind];
    if (m === undefined) continue;
    let x;
    if (typeof m === 'number') x = m;
    else if (key !== undefined) x = m[key] ?? (COMMODITIES[key] ? m[COMMODITIES[key].cat] : undefined) ?? m.all;
    else x = m.all;
    if (x === undefined) continue;
    v = add ? v + x : v * x;
  }
  return v;
}
function growthModFor(id) {
  let v = mod('growth');
  for (const e of S.events) if (e.mods && e.mods.growthC && e.mods.growthC[id]) v += e.mods.growthC[id];
  return v;
}
function addActive(key, title, t, mods) {
  S.events = S.events.filter(e => e.key !== key);
  S.events.push({ key, title, t, mods });
}
function hasActive(key) { return S.events.some(e => e.key === key); }

// ---------- konsumsi & produksi ----------
function aiScale(c) { return Math.sqrt(c.gdp / c.gdp0); }
function netDemand(cid, com) {
  const d = D(cid);
  let inputs = 0;
  for (const m in RECIPES) if (RECIPES[m].in[com]) inputs += (d.prod[m] || 0) * RECIPES[m].in[com];
  return ((d.use[com] || 0) + inputs - (d.prod[com] || 0)) * aiScale(C(cid));
}
function useNow(com) {
  const u0 = D(S.pid).use[com] || 0;
  if (!u0) return 0;
  const me = ME();
  const gpcR = Math.max(0.2, gdppc(me) / (me.gdp0 / me.pop0));
  return u0 * (me.pop / me.pop0) * Math.pow(gpcR, ELASTIC[COM(com).cat]) * mod('demand', com);
}
function costFactor(com) { return D(S.pid).costF[com] ?? 0.6; }
function basePrice(com) { return COM(com).price * S.trend; }

// Simulasi satu putaran produksi pada salinan stok
function simulateProduction(stock) {
  const p = P(), out = {}, used = {}, cost = {};
  for (const com in p.cap) {
    if (RECIPES[com]) continue;
    const q = p.cap[com] * mod('prod', com);
    if (q <= 0) continue;
    stock[com] = (stock[com] || 0) + q;
    out[com] = q;
    cost[com] = q * basePrice(com) * costFactor(com);
  }
  for (const com of MFG_ORDER) {
    const cap = p.cap[com] || 0;
    if (cap <= 0) continue;
    const r = RECIPES[com];
    let q = cap * mod('prod', com);
    for (const i in r.in) q = Math.min(q, (stock[i] || 0) / r.in[i]);
    q = Math.max(0, q);
    for (const i in r.in) { stock[i] -= q * r.in[i]; used[i] = (used[i] || 0) + q * r.in[i]; }
    stock[com] = (stock[com] || 0) + q;
    out[com] = q;
    cost[com] = q * S.prices[com] * r.opex;
  }
  return { out, used, cost };
}

function inputNeed(com) {
  let n = 0;
  for (const m in RECIPES) if (RECIPES[m].in[com]) n += (P().cap[m] || 0) * RECIPES[m].in[com];
  return n;
}
function contractNeed(com) {
  let n = 0;
  for (const k of P().contracts) if (k.com === com && k.type === 'ekspor' && k.t > 1) n += k.qty;
  return n;
}
function incoming(com) {
  let q = 0;
  for (const s of P().shipments) if (s.kind === 'm' && s.com === com) q += s.qty;
  return q;
}
function contractFlow(com) {
  let q = 0;
  for (const k of P().contracts) if (k.com === com) q += k.type === 'impor' ? k.qty : -k.qty;
  return q;
}
// Proyeksi neraca tiap komoditas untuk akhir kuartal ini
function projection() {
  const p = P();
  const st = {};
  for (const c in COMMODITIES) st[c] = (p.stock[c] || 0) + incoming(c) + contractFlow(c);
  const sim = simulateProduction(st);
  const res = {};
  for (const c in COMMODITIES) {
    const use = useNow(c);
    res[c] = { stock: p.stock[c] || 0, prod: sim.out[c] || 0, input: sim.used[c] || 0, use, inc: incoming(c), contract: contractFlow(c), end: st[c] - use };
  }
  return res;
}

// ---------- harga & kapasitas pasar ----------
function blocked(cid, com) {
  const c = C(cid), p = P();
  if (cid === S.pid) return 'Negara sendiri';
  if (c.embargo > 0) return 'Embargo';
  if (D(cid).sanctioned && WESTERN.includes(S.pid)) return 'Sanksi';
  if (D(S.pid).sanctioned && WESTERN.includes(cid)) return 'Sanksi';
  if (com && p.euBlock && (cid === 'deu' || cid === 'gbr') && EUDR_COMS.includes(com) && !p.certified) return 'Regulasi EUDR';
  return null;
}
function tariffOn(cid, com) {
  const d = D(cid), c = C(cid);
  let t = d.special[com] ?? d.tariff;
  if (c.fta) t = d.special[com] ? d.special[com] * 0.5 : 0;
  if (c.tAddT > 0) t += c.tAdd;
  if (c.xt && c.xt[com] && c.xt[com].t > 0) t += c.xt[com].r;
  if (c.rel < 30) t += 0.1;
  return t;
}
function relFactor(cid) { return 0.6 + C(cid).rel / 125; }
function exportCapTotal(cid, com) {
  if (blocked(cid, com)) return 0;
  const nd = netDemand(cid, com);
  if (nd <= 0) return 0;
  const c = C(cid);
  let m = 1;
  if (c.capMultT > 0) m *= c.capMult;
  if (c.ver && c.ver[com] > 0) m *= 0.5;
  return nd * 0.5 * relFactor(cid) * mod('demand', com) * m;
}
function importCapTotal(cid, com) {
  if (blocked(cid, com)) return 0;
  const c = C(cid);
  if (c.exportBan && c.exportBan[com] > 0) return 0;
  const nd = -netDemand(cid, com);
  if (nd <= 0) return 0;
  return nd * 0.5 * relFactor(cid);
}
function shipRate(fromReg, toReg, com) {
  const dist = regionDist(fromReg, toReg);
  let r = (0.01 + 0.01 * dist) * COM(com).ship * mod('ship');
  if (viaSuez(fromReg, toReg)) r *= mod('suez');
  return r * (1 - ME().infra / 300);
}
function routeRisk(a, b) {
  let r = 0.006;
  if (viaSuez(a, b)) r += 0.004 + mod('pirate');
  else if (viaMalaka(a, b)) r += 0.003 + mod('pirate') * 0.3;
  if (a === 'AFR' || b === 'AFR') r += 0.02;
  return r;
}

function quoteExport(cid, com, qty, pay, ins) {
  const w = S.prices[com], d = D(cid), c = C(cid);
  const nd = netDemand(cid, com);
  const useScaled = ((d.use[com] || 0) * aiScale(c)) || 1;
  const prem = U.cl(nd / useScaled, 0, 1) * 0.12;
  const t = tariffOn(cid, com);
  const capT = exportCapTotal(cid, com);
  const used = (c.bought[com] || 0);
  const capLeft = Math.max(0, capT - used);
  const slip = capT > 0 ? 1 - 0.12 * U.cl((used + qty / 2) / capT, 0, 1) : 1;
  let unit = w * (1 + prem) / (1 + t) * slip;
  if (pay === 'tt') unit *= 0.96;
  const gross = unit * qty;
  const ship = gross * shipRate(D(S.pid).region, d.region, com);
  const fee = (pay === 'lc' ? gross * 0.01 : 0) + (ins ? gross * 0.008 : 0);
  const why = blocked(cid, com);
  return {
    unit, gross, tariff: t, prem, ship, fee, net: gross - ship - fee, capLeft, why,
    ok: !why && qty > 0 && qty <= capLeft * 1.0001 + 1e-9 && qty <= (P().stock[com] || 0) * 1.0001 + 1e-9 && P().kas >= ship + fee,
  };
}
function quoteImport(cid, com, qty, pay, ins) {
  const w = S.prices[com], d = D(cid), c = C(cid);
  const sur = -netDemand(cid, com);
  const prodScaled = ((d.prod[com] || 0) * aiScale(c)) || 1;
  const disc = U.cl(sur / prodScaled, 0, 1) * 0.06;
  const capT = importCapTotal(cid, com);
  const used = c.sold[com] || 0;
  const capLeft = Math.max(0, capT - used);
  const slip = capT > 0 ? 1 + 0.12 * U.cl((used + qty / 2) / capT, 0, 1) : 1;
  let unit = w * (1 - disc) * slip;
  if (pay === 'tt') unit *= 0.98;
  const cost = unit * qty;
  const ship = cost * shipRate(d.region, D(S.pid).region, com);
  const fee = (pay === 'lc' ? cost * 0.01 : 0) + (ins ? cost * 0.008 : 0);
  const why = blocked(cid, com);
  const total = cost + ship + fee;
  return { unit, cost, ship, fee, total, capLeft, why, ok: !why && qty > 0 && qty <= capLeft * 1.0001 + 1e-9 && P().kas >= total };
}

function spotRef(com) {
  let t = 0;
  for (const id in S.countries) t += (D(id).prod[com] || 0) * aiScale(C(id));
  return Math.max(1, t * 0.5);
}
function quoteSpotSell(com, qty) {
  const p = P(), ref = spotRef(com);
  const unit = S.prices[com] * 0.9 * (1 - Math.min(0.25, ((p.spotSold[com] || 0) + qty / 2) / ref));
  return { unit, total: unit * qty, ok: qty > 0 && qty <= (p.stock[com] || 0) + 1e-9 };
}
function quoteSpotBuy(com, qty) {
  const p = P(), ref = spotRef(com);
  const unit = S.prices[com] * 1.1 * (1 + Math.min(0.3, ((p.spotBought[com] || 0) + qty / 2) / ref));
  return { unit, total: unit * qty, ok: qty > 0 && p.kas >= unit * qty };
}

// ---------- aksi perdagangan ----------
function markTrade(cid, com, val) {
  const p = P();
  p.lastTrade[cid] = S.turn;
  p.recentX[cid] = p.recentX[cid] || {};
  p.recentX[cid][com] = (p.recentX[cid][com] || 0) + val;
}
function doExport(cid, com, qty, pay, ins) {
  const q = quoteExport(cid, com, qty, pay, ins);
  if (!q.ok) return { ok: false, msg: q.why || 'Tidak bisa: cek stok, kapasitas pasar, atau kas.' };
  const p = P();
  p.stock[com] = Math.max(0, p.stock[com] - qty);
  p.kas -= q.ship + q.fee;
  C(cid).bought[com] = (C(cid).bought[com] || 0) + qty;
  p.shipments.push({ id: ++p.sid, kind: 'x', cid, com, qty, value: q.gross, pay, ins, status: 'transit', t0: S.turn });
  p.q.exp += q.gross; p.q.shipCost += q.ship + q.fee;
  markTrade(cid, com, q.gross);
  return { ok: true, msg: `Ekspor ${fq(qty)} ${COM(com).unit} ${COM(com).name} ke ${D(cid).name} dikirim. Nilai ${fmt(q.gross)}, dibayar saat tiba.` };
}
function doImport(cid, com, qty, pay, ins) {
  const q = quoteImport(cid, com, qty, pay, ins);
  if (!q.ok) return { ok: false, msg: q.why || 'Tidak bisa: cek kapasitas pemasok atau kas.' };
  const p = P();
  p.kas -= q.total;
  C(cid).sold[com] = (C(cid).sold[com] || 0) + qty;
  p.shipments.push({ id: ++p.sid, kind: 'm', cid, com, qty, value: q.cost, pay, ins, status: 'transit', t0: S.turn });
  p.q.imp += q.cost; p.q.shipCost += q.ship + q.fee;
  if (COM(com).cat === 'pangan') p.q.foodImport = true;
  p.lastTrade[cid] = S.turn;
  return { ok: true, msg: `Impor ${fq(qty)} ${COM(com).unit} ${COM(com).name} dari ${D(cid).name} dipesan (${fmt(q.total)}). Tiba akhir kuartal.` };
}
function doSpotSell(com, qty) {
  const q = quoteSpotSell(com, qty);
  if (!q.ok) return { ok: false, msg: 'Stok tidak cukup.' };
  const p = P();
  if (p.ban[com]) return { ok: false, msg: 'Ekspor bahan mentah ini sedang dilarang (kebijakan hilirisasi).' };
  p.stock[com] -= qty; p.kas += q.total;
  p.spotSold[com] = (p.spotSold[com] || 0) + qty;
  p.q.exp += q.total;
  return { ok: true, msg: `Terjual ${fq(qty)} ${COM(com).unit} ${COM(com).name} di pasar spot seharga ${fmt(q.total)}.` };
}
function doSpotBuy(com, qty, silent) {
  const q = quoteSpotBuy(com, qty);
  if (!q.ok) return { ok: false, msg: 'Kas tidak cukup.' };
  const p = P();
  p.stock[com] = (p.stock[com] || 0) + qty; p.kas -= q.total;
  p.spotBought[com] = (p.spotBought[com] || 0) + qty;
  p.q.imp += q.total;
  if (COM(com).cat === 'pangan') p.q.foodImport = true;
  return { ok: true, cost: q.total, msg: `Dibeli ${fq(qty)} ${COM(com).unit} ${COM(com).name} dari pasar spot seharga ${fmt(q.total)}.` };
}

// ---------- industri ----------
function factoryCost(com) { return RECIPES[com].cost * S.trend; }
function expandInfo(com) {
  const base = D(S.pid).prod[com] || P().disc[com] || 0;
  const lot = Math.max(base * 0.1, 0.0001);
  return { lot, cost: lot * basePrice(com) * 0.4 * 7, time: 3 };
}
function canBuild(com) {
  const r = RECIPES[com];
  if (ME().tech < r.tech) return `Butuh teknologi ${r.tech}`;
  if (P().kas < factoryCost(com)) return 'Kas tidak cukup';
  return null;
}
function buildFactory(com) {
  const why = canBuild(com);
  if (why) return { ok: false, msg: why };
  const p = P(), r = RECIPES[com];
  p.kas -= factoryCost(com);
  p.q.invest += factoryCost(com);
  p.building.push({ com, amt: r.lot, t: r.time, label: r.label });
  return { ok: true, msg: `${r.label} mulai dibangun (${r.time} kuartal). Kapasitas +${fq(r.lot)} ${COM(com).unit}/kuartal.` };
}
function expandRaw(com) {
  const e = expandInfo(com), p = P();
  if (p.kas < e.cost) return { ok: false, msg: 'Kas tidak cukup' };
  p.kas -= e.cost; p.q.invest += e.cost;
  p.building.push({ com, amt: e.lot, t: e.time, label: 'Perluasan ' + COM(com).name });
  return { ok: true, msg: `Perluasan produksi ${COM(com).name} dimulai (+${fq(e.lot)} ${COM(com).unit}/kuartal dalam ${e.time} kuartal).` };
}
function kekCost() { return ME().gdp * 0.003; }
function buildKEK() {
  const p = P(), cost = kekCost();
  if (p.kek >= 5) return { ok: false, msg: 'Maksimal 5 KEK.' };
  if (p.kas < cost) return { ok: false, msg: 'Kas tidak cukup' };
  p.kas -= cost; p.q.invest += cost;
  p.building.push({ kek: true, t: 4, label: 'Kawasan Ekonomi Khusus' });
  return { ok: true, msg: 'Kawasan Ekonomi Khusus mulai dibangun (4 kuartal). Menarik investasi asing.' };
}
function toggleBan(com) {
  const p = P();
  p.ban[com] = !p.ban[com];
  return { ok: true, msg: p.ban[com] ? `Ekspor ${COM(com).name} mentah DILARANG. Investor didorong membangun industri hilir, tapi mitra dagang bisa protes ke WTO.` : `Larangan ekspor ${COM(com).name} dicabut.` };
}

// ---------- keuangan ----------
function ratingRaw() {
  const me = ME(), p = P();
  const dr = p.debt / me.gdp * 100;
  return 70 - Math.max(0, dr - 40) * 0.35 - Math.max(0, me.inf - 4) * 2 - (60 - me.stab) * 0.3
    + (incomeScore(me) - 30) * 0.25 + U.cl(p.kas / me.gdp * 100 * 2, -10, 10) - (p.defaulted > 0 ? 30 : 0);
}
function ratingScore() { return ratingRaw() + P().ratingBonus; }
function rating() {
  if (P().defaulted > 0 && P().kas < 0) return RATINGS[RATINGS.length - 1];
  const s = ratingScore();
  return RATINGS.find(r => s >= r.min);
}
function policyRate() { return S.fx[D(S.pid).cur.code] ? S.fx[D(S.pid).cur.code].int : D(S.pid).cur.int; }
function bondRate() {
  const r = rating();
  return Math.max(0.3, policyRate() + (S.globalRate - 4) * 0.5 + r.spread * 0.6 + Math.max(0, ME().inf - 6) * 0.3);
}
function maxIssue() { return Math.max(0, ME().gdp * rating().issue - P().issuedQ); }
function addDebt(amt, rate) {
  const p = P();
  p.debtRate = (p.debt * p.debtRate + amt * rate) / Math.max(1, p.debt + amt);
  p.debt += amt;
}
function issueBonds(amt) {
  amt = Math.min(amt, maxIssue());
  if (amt <= 0) return { ok: false, msg: 'Batas penerbitan obligasi kuartal ini habis / rating terlalu rendah.' };
  const r = bondRate();
  addDebt(amt, r);
  P().kas += amt; P().issuedQ += amt;
  return { ok: true, msg: `Obligasi negara ${fmt(amt)} terjual dengan bunga ${r.toFixed(2)}%/tahun.` };
}
function wbAvailable() {
  const me = ME(), p = P();
  return gdppc(me) < 20000 && S.turn - p.wbLast >= 4;
}
function wbAmount() { return ME().gdp * 0.005; }
function borrowWorldBank() {
  if (!wbAvailable()) return { ok: false, msg: 'Pinjaman Bank Dunia hanya untuk negara berkembang (PDB/kapita < $20.000), sekali per 4 kuartal.' };
  const amt = wbAmount(), p = P();
  addDebt(amt, 2.0);
  p.kas += amt; p.wbLast = S.turn;
  ME().infra = Math.min(100, ME().infra + 1);
  return { ok: true, msg: `Bank Dunia mencairkan pinjaman proyek ${fmt(amt)} berbunga 2%. Infrastruktur +1.` };
}
function imfAvailable() {
  const p = P();
  return (p.kas < 0 || ['B', 'CCC', 'D'].includes(rating().r)) && S.turn - p.imfLast >= 8;
}
function borrowIMF() {
  if (!imfAvailable()) return { ok: false, msg: 'IMF hanya membantu negara dalam krisis (kas negatif atau rating B ke bawah), maks sekali per 8 kuartal.' };
  const p = P(), me = ME();
  const amt = me.gdp * 0.04;
  addDebt(amt, 3.0);
  p.kas += amt; p.imfLast = S.turn;
  p.budget.tax = Math.min(45, p.budget.tax + 1.5);
  p.budget.rutin = Math.max(p.budget0.rutin * 0.6, p.budget.rutin - 1.5);
  me.stab -= 12;
  p.defaulted = 0;
  C('usa').rel = Math.min(100, C('usa').rel + 3);
  return { ok: true, msg: `IMF mencairkan ${fmt(amt)} (bunga 3%). Syarat: pajak dinaikkan 1,5 poin & belanja rutin dipangkas 1,5 poin. Rakyat protes (stabilitas -12).` };
}
function repayDebt(amt) {
  const p = P();
  amt = Math.min(amt, p.debt, p.kas);
  if (amt <= 0) return { ok: false, msg: 'Tidak ada yang bisa dibayar.' };
  p.debt -= amt; p.kas -= amt;
  return { ok: true, msg: `Utang ${fmt(amt)} dilunasi.` };
}
function printMoney(amt) {
  const p = P(), me = ME();
  amt = Math.min(amt, me.gdp * 0.03 - p.printedQ);
  if (amt <= 0) return { ok: false, msg: 'Batas cetak uang kuartal ini (3% PDB) tercapai.' };
  p.kas += amt; p.printedQ += amt;
  const sh = amt / me.gdp * 100;
  p.q.infShock += sh * 2.2;
  const fx = S.fx[D(S.pid).cur.code];
  if (fx) { fx.v *= Math.exp(-sh * 0.025); fx.fund *= Math.exp(-sh * 0.02); }
  return { ok: true, msg: `Bank sentral mencetak ${fmt(amt)}. Kas bertambah, tapi inflasi & pelemahan mata uang menanti.` };
}

// ---------- forex ----------
function fxBuy(code, usd) {
  const f = S.fx[code], p = P();
  if (!f) return { ok: false, msg: '?' };
  if (usd <= 0 || usd > p.kas) return { ok: false, msg: 'Kas (USD) tidak cukup.' };
  const imp = usd / f.depth;
  const avg = f.v * (1 + imp / 2) * 1.003;
  const units = usd / avg;
  f.v *= (1 + imp); f.imp += Math.log(1 + imp);
  p.fx[code] = (p.fx[code] || 0) + units;
  p.fxCost[code] = (p.fxCost[code] || 0) + usd;
  p.kas -= usd;
  return { ok: true, msg: `Membeli ${fq(units)} ${code} seharga ${fmt(usd)}. Pembelianmu mendorong kurs ${code} naik ${(imp * 100).toFixed(2)}%.` };
}
function fxSell(code, units) {
  const f = S.fx[code], p = P();
  if (!f) return { ok: false, msg: '?' };
  const have = p.fx[code] || 0;
  units = Math.min(units, have);
  if (units <= 0) return { ok: false, msg: 'Tidak punya mata uang ini.' };
  const gross = units * f.v;
  const imp = Math.min(0.5, gross / f.depth);
  const avg = f.v * (1 - imp / 2) * 0.997;
  const usd = units * avg;
  f.v *= (1 - imp); f.imp += Math.log(1 - imp);
  const costPart = (p.fxCost[code] || 0) * (units / have);
  p.fxCost[code] = (p.fxCost[code] || 0) - costPart;
  p.fx[code] = have - units;
  if (p.fx[code] < 1e-9) { delete p.fx[code]; delete p.fxCost[code]; }
  p.kas += usd;
  p.fxPnl += usd - costPart;
  return { ok: true, msg: `Menjual ${fq(units)} ${code} → ${fmt(usd)}. Penjualanmu menekan kurs ${code} ${(imp * 100).toFixed(2)}%.` };
}
function fxPortfolio() {
  const p = P();
  let val = 0, cost = 0;
  for (const code in p.fx) { val += p.fx[code] * S.fx[code].v; cost += p.fxCost[code] || 0; }
  return { val, cost, pnl: val - cost };
}
function genFlow(f) {
  const base = f.depth * 0.06;
  const gap = (f.fund - f.v) / f.v;
  f.sent = f.sent * 0.5 + U.g() * 0.25;
  const bias = gap * 8 + f.sent + (f.int - S.globalRate) * 0.02;
  f.D = base * (1 + Math.max(0, bias) + U.r(0, 0.5));
  f.S = base * (1 + Math.max(0, -bias) + U.r(0, 0.5));
}

// ---------- diplomasi ----------
function missionCost() { return Math.max(50, ME().gdp * 0.0002); }
function tradeMission(cid) {
  const p = P(), c = C(cid), cost = missionCost();
  if (blocked(cid)) return { ok: false, msg: 'Tidak bisa — ' + blocked(cid) };
  if (c.missionT > 0) return { ok: false, msg: 'Misi dagang ke negara ini baru saja dilakukan.' };
  if (p.kas < cost) return { ok: false, msg: 'Kas tidak cukup' };
  p.kas -= cost;
  c.rel = Math.min(100, c.rel + 6); c.capMult = 1.35; c.capMultT = 4; c.missionT = 3;
  return { ok: true, msg: `Misi dagang ke ${D(cid).name} sukses: hubungan +6, akses pasar +35% selama 4 kuartal.` };
}
function ftaCost() { return Math.max(300, ME().gdp * 0.001); }
function signFTA(cid) {
  const p = P(), c = C(cid), cost = ftaCost();
  if (blocked(cid)) return { ok: false, msg: 'Tidak bisa — ' + blocked(cid) };
  if (c.fta) return { ok: false, msg: 'Sudah ada FTA.' };
  if (c.rel < 60) return { ok: false, msg: 'Hubungan minimal 60 untuk merundingkan FTA.' };
  if (p.kas < cost) return { ok: false, msg: 'Kas tidak cukup' };
  p.kas -= cost; c.fta = true; c.rel = Math.min(100, c.rel + 5);
  return { ok: true, msg: `Perjanjian Perdagangan Bebas dengan ${D(cid).name} ditandatangani! Tarif dihapus (tarif khusus dipotong 50%).` };
}
function aidCost() { return Math.max(80, ME().gdp * 0.0004); }
function giveAid(cid) {
  const p = P(), c = C(cid), cost = aidCost();
  if (p.kas < cost) return { ok: false, msg: 'Kas tidak cukup' };
  p.kas -= cost; c.rel = Math.min(100, c.rel + 9);
  return { ok: true, msg: `Bantuan pembangunan untuk ${D(cid).name} disalurkan. Hubungan +9.` };
}
function certifyEUDR() {
  const p = P(), cost = Math.max(300, ME().gdp * 0.0006);
  if (p.certified) return { ok: false, msg: 'Sudah tersertifikasi.' };
  if (p.kas < cost) return { ok: false, msg: 'Kas tidak cukup' };
  p.kas -= cost; p.certified = true; p.euBlock = false;
  return { ok: true, msg: `Sistem ketertelusuran & sertifikasi bebas deforestasi selesai (${fmt(cost)}). Akses pasar Eropa terbuka kembali.` };
}

// ---------- kontrak ----------
function acceptOffer(id) {
  const p = P(), i = S.offers.findIndex(o => o.id === id);
  if (i < 0) return { ok: false, msg: 'Tawaran sudah tidak berlaku.' };
  const o = S.offers[i];
  S.offers.splice(i, 1);
  p.contracts.push({ ...o });
  C(o.cid).rel = Math.min(100, C(o.cid).rel + 2);
  return { ok: true, msg: `Kontrak ${o.type} ${COM(o.com).name} dengan ${D(o.cid).name} disepakati (${o.t} kuartal).` };
}
function rejectOffer(id) { S.offers = S.offers.filter(o => o.id !== id); return { ok: true, msg: 'Tawaran ditolak.' }; }

// ============================================================
//  GAME BARU
// ============================================================
function newGame(pid) {
  S = { v: 1, turn: 0, pid, over: null, trend: 1, globalRate: 4.0, events: [], pending: [], offers: [], news: [], prices: {}, phist: {}, fx: {}, countries: {}, oid: 0 };
  for (const c in COMMODITIES) { S.prices[c] = COMMODITIES[c].price * U.r(0.95, 1.05); S.phist[c] = [S.prices[c]]; }
  for (const id in COUNTRIES) {
    const d = COUNTRIES[id];
    S.countries[id] = {
      id, gdp: d.gdp, pop: d.pop, gdp0: d.gdp, pop0: d.pop, hdi: d.hdi, tech: d.tech, infra: d.infra, stab: d.stab, inf: d.inf,
      growth: d.growth, rel: id === pid ? 100 : baseRelation(pid, id), tAdd: 0, tAddT: 0, fta: false, embargo: 0,
      bought: {}, sold: {}, capMult: 1, capMultT: 0, missionT: 0, xt: {}, ver: {}, exportBan: {}, hist: [],
    };
    if (d.cur.code !== 'USD') {
      S.fx[d.cur.code] = { cid: id, code: d.cur.code, name: d.cur.name, v: 1 / d.cur.rate, v0: 1 / d.cur.rate, fund: 1 / d.cur.rate, depth: d.cur.depth, vol: d.cur.vol, int: d.cur.int, peg: !!d.cur.peg, imp: 0, sent: 0, D: 0, S: 0, hist: [1 / d.cur.rate] };
    }
  }
  for (const k in S.fx) genFlow(S.fx[k]);
  const d = D(pid), me = C(pid);
  const p = S.p = {
    kas: d.gdp * 0.03, debt: d.gdp * d.debt / 100, debtRate: DEBT_RATE0[pid], ratingBonus: 0,
    stock: {}, cap: {}, disc: {}, budget: { ...d.budget }, budget0: { ...d.budget },
    building: [], contracts: [], shipments: [], sid: 0, fx: {}, fxCost: {}, fxPnl: 0,
    policy: { autoEssential: true, autoSell: true }, ban: {}, kek: 0, certified: false, euBlock: false,
    wbLast: -99, imfLast: -99, issuedQ: 0, printedQ: 0, defaulted: 0, defaultT: 0, lowStab: 0, top1: 0,
    lastTrade: {}, recentX: {}, spotSold: {}, spotBought: {}, ntAvg: 0, hist: [], log: [],
    infra0: d.infra, tech0: d.tech, inf0: d.inf, q: null, lastReport: null, bestRank: 99,
  };
  for (const c in d.prod) p.cap[c] = d.prod[c];
  resetQ();
  // stok awal = surplus satu kuartal + cadangan kebutuhan pokok
  const st = {};
  const sim = simulateProduction(st);
  for (const c in COMMODITIES) {
    const u = d.use[c] || 0;
    p.stock[c] = Math.max(0, (st[c] || 0) - u) * 0.8 + (COM(c).essential ? u * 0.35 : 0);
  }
  // baseline neraca dagang (setara pemain yang menjual surplus di pasar spot)
  let nt = 0, tf = 0;
  for (const c in COMMODITIES) {
    const pr = COM(c).price, u = d.use[c] || 0;
    const net = (sim.out[c] || 0) - (sim.used[c] || 0) - u;
    const own = Math.min(Math.max(0, (sim.out[c] || 0) - (sim.used[c] || 0)), u);
    tf += own * pr * 0.9 - (sim.cost[c] || 0);
    if (net > 0) { nt += net * pr * 0.85; tf += net * pr * 0.85; }
    else if (COM(c).essential) { nt += net * pr * 1.12; tf += net * pr * 0.25; }
    else nt += net * pr;
  }
  p.nt0 = nt; p.ntAvg = nt;
  // kalibrasi belanja rutin: pemain yang menjual surplus ≈ seimbang
  const bb = p.budget;
  const rutin = bb.tax - (bb.infra + bb.edu + bb.health + bb.rnd) - p.debt * p.debtRate / d.gdp + tf * 4 / d.gdp * 100 - 0.6;
  bb.rutin = Math.round(U.cl(rutin, 1, 40) * 10) / 10;
  p.budget0.rutin = bb.rutin;
  p.ratingBonus = d.ratingTarget - ratingRaw();
  p.attr0 = attractiveness();
  p.techK = 0.004 * (97 - d.tech) / Math.max(0.01, (bb.rnd + bb.edu * 0.08) * (100 - d.tech) / 100);
  p.infraK = bb.infra * 0.45 * (100 - d.infra) / 100 / d.infra;
  p.hdiK = (bb.edu * 0.001 + bb.health * 0.0008) * 1.5 * (1 - d.hdi) - 0.006 * (0.97 - d.hdi);
  p.stabOffset = 0; p.stabOffset = d.stab - stabTarget(d.growth);
  S.news.unshift({ t: 0, type: 'info', text: `Selamat datang, Menteri! Anda memimpin ekonomi ${d.name}. Tujuan: menjadi negara maju #1 (skor ≥ ${WIN_SCORE}) dan bertahan ${WIN_HOLD} kuartal.` });
  genOffers();
  return S;
}
function resetQ() {
  S.p.q = { exp: 0, imp: 0, privImp: 0, shipCost: 0, invest: 0, infShock: 0, stabShock: 0, foodImport: false, notes: [] };
  S.p.spotSold = {}; S.p.spotBought = {};
}

function attractiveness() {
  const me = ME(), p = P();
  const rels = Object.values(S.countries).filter(c => c.id !== S.pid).map(c => c.rel);
  const avgRel = rels.reduce((a, b) => a + b, 0) / rels.length;
  const bans = Object.values(p.ban).filter(Boolean).length;
  return (me.stab - 60) * 0.03 + (me.infra - 50) * 0.02 + (ratingScore() - 55) * 0.02 + p.kek * 0.4 + bans * 0.25 + (avgRel - 55) * 0.02;
}
function stabTarget(g) {
  const me = ME(), p = P(), b = p.budget, b0 = p.budget0;
  return 50 + (me.hdi - 0.7) * 50 + (g - 3) * 2 - Math.max(0, me.inf - Math.max(5, p.inf0)) * 2
    - Math.max(0, b.tax - b0.tax) * 1.5 + (b.rutin - b0.rutin) * 2.5 + (p.kas < 0 ? -8 : 0) + (p.stabOffset || 0);
}

// ============================================================
//  AKHIR KUARTAL
// ============================================================
function endTurn() {
  if (S.over) return null;
  if (S.pending.length) return { blocked: true };
  const p = P(), me = ME(), d = D(S.pid);
  const rep = { date: dateLabel(S.turn), ship: [], lines: [], events: [], warn: [] };
  const kas0 = p.kas, rank0 = myRank(), score0 = scoreOf(me);
  const fin = rep.fin = {};

  // 1. Kontrak jangka panjang
  for (const k of p.contracts) {
    if (k.type === 'ekspor') {
      const q = Math.min(k.qty, p.stock[k.com] || 0);
      p.stock[k.com] -= q;
      p.kas += q * k.price; p.q.exp += q * k.price;
      fin.contract = (fin.contract || 0) + q * k.price;
      if (q < k.qty - 1e-6) {
        const pen = (k.qty - q) * k.price * 0.25;
        p.kas -= pen; C(k.cid).rel -= 4;
        rep.ship.push(`⚠ Kontrak ekspor ${COM(k.com).name} ke ${D(k.cid).name} kurang ${fq(k.qty - q)} ${COM(k.com).unit}. Denda ${fmt(pen)}, hubungan -4.`);
      }
      markTrade(k.cid, k.com, q * k.price);
    } else {
      const cost = k.qty * k.price;
      p.kas -= cost; p.q.imp += cost;
      fin.contract = (fin.contract || 0) - cost;
      p.stock[k.com] = (p.stock[k.com] || 0) + k.qty;
    }
    k.t--;
  }
  const doneK = p.contracts.filter(k => k.t <= 0);
  for (const k of doneK) rep.ship.push(`Kontrak ${k.type} ${COM(k.com).name} dengan ${D(k.cid).name} selesai.`);
  p.contracts = p.contracts.filter(k => k.t > 0);

  // 2. Pengiriman
  resolveShipments(rep);

  // 3. Proyek pembangunan
  for (const b of p.building) {
    b.t--;
    if (b.t <= 0) {
      if (b.kek) { p.kek++; rep.lines.push('🏗 Kawasan Ekonomi Khusus beroperasi.'); }
      else {
        p.cap[b.com] = (p.cap[b.com] || 0) + b.amt;
        if (RECIPES[b.com]) me.tech = Math.min(100, me.tech + (b.com === 'semikonduktor' ? 2.5 : RECIPES[b.com].tech >= 45 ? 1 : 0.3));
        rep.lines.push(`🏗 ${b.label} selesai. Kapasitas ${COM(b.com).name} kini ${fq(p.cap[b.com])} ${COM(b.com).unit}/kuartal.`);
      }
    }
  }
  p.building = p.building.filter(b => b.t > 0);

  // 4. Produksi
  const sim = simulateProduction(p.stock);
  let prodCost = 0;
  for (const c in sim.cost) prodCost += sim.cost[c];
  p.kas -= prodCost; fin.prodCost = -prodCost;

  // 5. Konsumsi domestik
  let domRev = 0, autoCost = 0;
  const shortages = [];
  for (const c in COMMODITIES) {
    const need = useNow(c);
    if (need <= 0) continue;
    const take = Math.min(need, p.stock[c] || 0);
    p.stock[c] = (p.stock[c] || 0) - take;
    domRev += take * S.prices[c] * 0.9;
    let short = need - take;
    if (short > 1e-9) {
      if (COM(c).essential) {
        if (p.policy.autoEssential) {
          const q = quoteSpotBuy(c, short);
          const cost = q.total * 1.03;
          p.kas -= cost; autoCost += cost; p.q.imp += cost;
          p.spotBought[c] = (p.spotBought[c] || 0) + short;
          domRev += short * S.prices[c] * 0.9;
          if (COM(c).cat === 'pangan') p.q.foodImport = true;
          shortages.push({ c, frac: 0, auto: true, q: short, cost });
        } else {
          const frac = short / need;
          p.q.infShock += frac * 3;
          p.q.stabShock -= frac * 9;
          shortages.push({ c, frac, q: short });
        }
      } else {
        p.q.privImp += short * S.prices[c];
      }
    }
  }
  p.kas += domRev; fin.domRev = domRev; fin.autoImport = -autoCost;
  for (const s of shortages) {
    if (s.auto) rep.lines.push(`🛒 Impor darurat otomatis ${COM(s.c).name} ${fq(s.q)} ${COM(s.c).unit} (${fmt(s.cost)}) — lebih mahal dari impor biasa.`);
    else rep.warn.push(`🚨 KELANGKAAN ${COM(s.c).name}: ${(s.frac * 100).toFixed(0)}% kebutuhan tak terpenuhi! Harga naik, rakyat resah.`);
  }

  // 6. Susut stok & jual otomatis stok berlebih
  for (const c in p.stock) { p.stock[c] *= (1 - COM(c).decay); if (p.stock[c] < 1e-6) p.stock[c] = 0; }
  let autoSold = 0;
  if (p.policy.autoSell) {
    for (const c in p.stock) {
      if (p.ban[c]) continue;
      const ex = (p.stock[c] || 0) - useNow(c) - inputNeed(c) - contractNeed(c);
      if (ex > 1e-6) {
        const got = quoteSpotSell(c, ex).total * 0.95;
        p.stock[c] -= ex; p.kas += got; autoSold += got; p.q.exp += got;
        p.spotSold[c] = (p.spotSold[c] || 0) + ex;
      }
    }
    if (autoSold > 0) rep.lines.push(`🏪 Stok berlebih dijual otomatis ke pasar spot via broker: +${fmt(autoSold)} (harga spot, komisi 5%). Ekspor langsung biasanya lebih untung!`);
  }
  fin.autoSell = autoSold;

  // 7. APBN
  const b = p.budget;
  const tax = me.gdp * b.tax / 400, rutin = me.gdp * b.rutin / 400;
  const dev = me.gdp * (b.infra + b.edu + b.health + b.rnd) / 400;
  const interest = p.debt * p.debtRate / 400;
  p.kas += tax - rutin - dev - interest;
  Object.assign(fin, { tax, rutin: -rutin, dev: -dev, interest: -interest });
  // bunga valas
  let fxInt = 0;
  for (const code in p.fx) { const add = p.fx[code] * S.fx[code].int / 400; p.fx[code] += add; fxInt += add * S.fx[code].v; }
  fin.fxInt = fxInt;

  // 8. Statistik pemain
  const nt = p.q.exp - p.q.imp - p.q.privImp;
  p.ntAvg = p.ntAvg * 0.5 + nt * 0.5;
  const ntBase = p.nt0 * S.trend * (me.gdp / me.gdp0);
  const tradeE = U.cl((p.ntAvg - ntBase) * 4 / me.gdp * 100 * 0.45, -2, 5);
  const gpc0 = me.gdp0 / me.pop0;
  const conv = U.cl(Math.pow(gpc0 / gdppc(me), 0.35), 0.25, 1.3);
  const pot = 1 + (d.growth - 1) * conv;
  const infraE = (me.infra - p.infra0) * 0.04;
  const techE = (me.tech - p.tech0) * 0.03;
  const devSum = b.infra + b.edu + b.health + b.rnd, dev0 = p.budget0.infra + p.budget0.edu + p.budget0.health + p.budget0.rnd;
  const devE = (devSum - dev0) * 0.25;
  const fdiE = U.cl(attractiveness() - p.attr0, -2, 2.5);
  const taxE = (p.budget0.tax - b.tax) * 0.15;
  const infP = Math.max(0, me.inf - Math.max(p.inf0, d.infTarget) - 2) * 0.3;
  const stabP = Math.max(0, 45 - me.stab) * 0.06;
  const shortP = shortages.filter(s => !s.auto).reduce((a, s) => a + s.frac, 0) * 1.5;
  const g = U.cl(pot + infraE + techE + devE + tradeE + fdiE + taxE - infP - stabP - shortP + growthModFor(S.pid) + U.g() * 0.35, -15, 20);
  rep.gparts = { pot, infraE, techE, devE, tradeE, fdiE, taxE, pen: -(infP + stabP + shortP), ev: growthModFor(S.pid) };
  me.growth = g;
  // investasi swasta: kapasitas produksi ikut tumbuh bersama ekonomi
  for (const c in p.cap) p.cap[c] *= 1 + Math.max(0, g) / 400 * 0.55;
  me.gdp *= 1 + g / 400;
  me.pop *= 1 + d.popGrowth / 400;
  me.infra = U.cl(me.infra + b.infra * 0.45 * (100 - me.infra) / 100 - p.infraK * me.infra + 0.1, 0, 100);
  me.tech = U.cl(me.tech + (b.rnd + b.edu * 0.08) * (100 - me.tech) / 100 * p.techK, 0, 100);
  me.hdi = U.cl(me.hdi + (b.edu * 0.001 + b.health * 0.0008) * 1.5 * (1 - me.hdi) - p.hdiK + 0.0002 * (g - d.growth), 0.3, 0.995);
  // inflasi: kurs sendiri
  const myFx = S.fx[d.cur.code];
  let dep = 0;
  if (myFx) dep = (myFx.hist[myFx.hist.length - 1] / myFx.v - 1) * 100;
  const infT = d.infTarget + Math.max(0, g - 7) * 0.4;
  me.inf = U.cl(me.inf + 0.3 * (infT - me.inf) + p.q.infShock + Math.max(-2, dep * 0.15) + U.g() * 0.3, -3, 200);
  me.stab = U.cl(me.stab + 0.25 * (stabTarget(g) - me.stab) + p.q.stabShock + U.g() * 0.8, 0, 100);

  // 9. Negara AI
  for (const id in S.countries) {
    if (id === S.pid) continue;
    const c = C(id), dc = D(id);
    const cv = U.cl(Math.pow((c.gdp0 / c.pop0) / gdppc(c), 0.5), 0.3, 1.3);
    c.growth = U.cl(1.2 + (dc.growth - 1.2) * cv + U.g() * 0.7 + growthModFor(id), -12, 15);
    c.gdp *= 1 + c.growth / 400;
    c.pop *= 1 + dc.popGrowth / 400;
    c.hdi = U.cl(c.hdi + 0.006 * (0.97 - c.hdi) + U.g() * 0.0005, 0.3, 0.97);
    c.tech = U.cl(c.tech + 0.004 * (97 - c.tech) + U.g() * 0.05, 0, 97);
    c.stab = U.cl(c.stab + 0.2 * (dc.stab - c.stab) + U.g() * 1.5, 0, 100);
    c.inf = U.cl(c.inf + 0.25 * (dc.infTarget - c.inf) + U.g() * 0.4, -2, 100);
    c.bought = {}; c.sold = {};
    if (c.tAddT > 0) c.tAddT--;
    if (c.capMultT > 0) c.capMultT--;
    if (c.missionT > 0) c.missionT--;
    if (c.embargo > 0) c.embargo--;
    for (const k in c.xt) if (c.xt[k].t > 0) c.xt[k].t--;
    for (const k in c.ver) if (c.ver[k] > 0) c.ver[k]--;
    for (const k in c.exportBan) if (c.exportBan[k] > 0) c.exportBan[k]--;
    // hubungan perlahan kembali ke dasar
    const br = baseRelation(S.pid, id);
    c.rel = U.cl(c.rel + (br - c.rel) * 0.02 + (p.lastTrade[id] === S.turn ? 0.4 : 0), 0, 100);
  }

  // 10. Harga komoditas
  let foodEnergyChg = 0;
  for (const c in COMMODITIES) {
    const anchor = basePrice(c) * mod('anchor', c);
    const pr = S.prices[c];
    const sold = (p.spotSold[c] || 0) - (p.spotBought[c] || 0);
    const lnp = Math.log(pr) + 0.3 * (Math.log(anchor) - Math.log(pr)) + U.g() * COM(c).vol * 0.6 - 0.08 * sold / spotRef(c);
    S.prices[c] = Math.exp(lnp);
    S.phist[c].push(S.prices[c]); if (S.phist[c].length > 16) S.phist[c].shift();
    if (['pangan'].includes(COM(c).cat) || c === 'bbm') foodEnergyChg += (S.prices[c] / pr - 1) / 6;
  }
  me.inf += U.cl(foodEnergyChg * 100 * 0.08, -1, 2);

  // 11. Forex
  for (const code in S.fx) {
    const f = S.fx[code], cid = f.cid, c = C(cid);
    const prev = f.v;
    let tf = U.g() * 0.004;
    if (cid === S.pid) {
      tf = U.cl(p.ntAvg * 4 / me.gdp, -0.1, 0.1) * 0.05 + U.cl(p.kas / me.gdp, -0.1, 0.1) * 0.02 - Math.max(0, me.inf - 6) * 0.002;
    }
    f.fund *= Math.exp((3 - c.inf) / 400 + tf);
    if (f.peg) {
      f.v = f.v0 * (1 + U.g() * 0.0008);
      f.fund = f.v0;
    } else {
      const pr = (f.D - f.S) / (f.D + f.S);
      f.v *= Math.exp(pr * f.vol / 100 * 2.2 + U.g() * f.vol / 100 * 0.35 - 0.6 * f.imp);
    }
    f.imp = 0;
    f.chg = (f.v / prev - 1) * 100;
    f.hist.push(f.v); if (f.hist.length > 16) f.hist.shift();
    genFlow(f);
  }

  // 12. Tick event aktif
  for (const e of S.events) e.t--;
  const ended = S.events.filter(e => e.t <= 0);
  for (const e of ended) S.news.unshift({ t: S.turn + 1, type: 'info', text: `Berakhir: ${e.title}.` });
  S.events = S.events.filter(e => e.t > 0);
  for (const cid in p.recentX) if ((p.lastTrade[cid] ?? -99) < S.turn - 1) delete p.recentX[cid];

  // 13. Kas & utang
  p.issuedQ = 0; p.printedQ = 0;
  if (p.kas < 0) {
    const need = -p.kas * 1.05;
    const room = maxIssue();
    if (room > 0) {
      const amt = Math.min(need, room);
      const r = bondRate() + 1;
      addDebt(amt, r); p.kas += amt;
      rep.warn.push(`💸 Kas negatif! Obligasi darurat ${fmt(amt)} diterbitkan otomatis (bunga ${r.toFixed(1)}%).`);
    }
  }
  if (p.kas < 0) {
    p.defaultT++;
    if (p.defaulted <= 0) {
      p.defaulted = 8; me.stab -= 20;
      rep.warn.push('☠ GAGAL BAYAR! Negara tidak mampu membayar kewajiban. Rating jatuh ke D, stabilitas anjlok. Segera cari dana (IMF / cetak uang / jual aset)!');
    } else rep.warn.push(`☠ Negara masih gagal bayar (${p.defaultT} kuartal). Bangkrut total jika 4 kuartal berturut-turut.`);
  } else { p.defaultT = 0; if (p.defaulted > 0) p.defaulted--; }

  // 14. Event acak, tawaran kontrak
  S.turn++;
  const ratingNow = rating().r;
  if (p.lastRating && p.lastRating !== ratingNow) {
    const up = RATINGS.findIndex(r => r.r === ratingNow) < RATINGS.findIndex(r => r.r === p.lastRating);
    rep.events.push({ title: up ? 'Rating Naik' : 'Rating Turun', text: `Lembaga pemeringkat mengubah rating kredit Anda dari ${p.lastRating} menjadi ${ratingNow}. ${up ? 'Bunga pinjaman baru lebih murah.' : 'Bunga pinjaman baru lebih mahal.'}` });
  }
  p.lastRating = ratingNow;
  rollEvents(rep);
  genOffers();

  // 15. Peringkat, menang/kalah
  const rank = myRank(), score = scoreOf(me);
  p.bestRank = Math.min(p.bestRank, rank);
  if (rank === 1 && score >= WIN_SCORE) p.top1++; else p.top1 = 0;
  if (me.stab < 8) p.lowStab++; else p.lowStab = 0;
  p.hist.push({ t: S.turn, gdp: me.gdp, kas: p.kas, score, rank, g });
  if (p.hist.length > 200) p.hist.shift();
  for (const id in S.countries) { const c = C(id); c.hist.push(scoreOf(c)); if (c.hist.length > 16) c.hist.shift(); }

  if (p.top1 >= WIN_HOLD) S.over = { win: true, text: `${d.name} resmi menjadi negara maju nomor 1 dunia! Skor kemajuan ${score.toFixed(1)}. Sejarah akan mengenang kebijakan Anda.` };
  else if (p.defaultT >= 4) S.over = { win: false, text: `${d.name} bangkrut setelah gagal bayar 4 kuartal berturut-turut. Kreditur menyita aset, pemerintahan Anda dibubarkan.` };
  else if (p.lowStab >= 2) S.over = { win: false, text: `Kerusuhan meluas di seluruh ${d.name}. Pemerintahan Anda jatuh.` };
  else if (S.turn >= MAX_TURN) S.over = { win: rank === 1, text: `Masa jabatan 40 tahun berakhir. ${d.name} berada di peringkat #${rank} dengan skor ${score.toFixed(1)}.` };

  rep.kasDelta = p.kas - kas0; rep.rank0 = rank0; rep.rank = rank; rep.score0 = score0; rep.score = score; rep.g = g;
  rep.exp = p.q.exp; rep.imp = p.q.imp + p.q.privImp;
  p.lastReport = rep;
  for (const e of rep.events) S.news.unshift({ t: S.turn, type: 'event', text: `${e.title}: ${e.text}` });
  for (const w of rep.warn) S.news.unshift({ t: S.turn, type: 'warn', text: w });
  for (const l of rep.ship) S.news.unshift({ t: S.turn, type: 'ship', text: l });
  if (S.news.length > 150) S.news.length = 150;
  resetQ();
  return rep;
}

function resolveShipments(rep) {
  const p = P(), me = ME(), myReg = D(S.pid).region;
  const keep = [];
  for (const s of p.shipments) {
    const d = D(s.cid), c = C(s.cid), name = COM(s.com).name, u = COM(s.com).unit;
    const tag = `${fq(s.qty)} ${u} ${name}`;
    if (s.kind === 'x') {
      if (s.status === 'delay') {
        p.kas += s.value * 0.98;
        rep.ship.push(`✅ Ekspor ${tag} ke ${d.name} (tertunda) akhirnya diterima. +${fmt(s.value * 0.98)}`);
        continue;
      }
      if (U.ch(routeRisk(myReg, d.region))) {
        const pirate = viaSuez(myReg, d.region) || d.region === 'AFR' || myReg === 'AFR';
        const cause = pirate && U.ch(0.5) ? 'dibajak perompak' : 'tenggelam dihantam badai';
        if (s.ins) { p.kas += s.value * 0.9; rep.ship.push(`🌊 Kapal berisi ${tag} ke ${d.name} ${cause}. Asuransi membayar klaim ${fmt(s.value * 0.9)}.`); }
        else rep.ship.push(`🌊 Kapal berisi ${tag} ke ${d.name} ${cause}. TANPA ASURANSI — kerugian total ${fmt(s.value)}!`);
        continue;
      }
      const food = ['pangan', 'kebun'].includes(COM(s.com).cat);
      let pRej = (food ? 0.06 : 0.02) * d.strict * (1 - me.tech / 150);
      if ((s.cid === 'deu' || s.cid === 'gbr') && EUDR_COMS.includes(s.com) && !p.certified) pRej += 0.08;
      if (U.ch(pRej)) {
        p.kas += s.value * 0.55;
        rep.ship.push(`🚫 ${tag} DITOLAK otoritas ${d.name} karena tidak memenuhi standar mutu/sanitasi. Terpaksa dijual murah: ${fmt(s.value * 0.55)}.`);
        continue;
      }
      if (s.pay === 'oa') {
        const pDef = d.buyerRisk * (1 + (60 - c.stab) / 60) + mod('default');
        if (U.ch(pDef)) {
          p.kas += s.value * 0.2; c.rel -= 2;
          rep.ship.push(`💀 Pembeli di ${d.name} GAGAL BAYAR atas ${tag} (Open Account). Hanya ${fmt(s.value * 0.2)} kembali lewat jalur hukum. Gunakan L/C untuk negara berisiko!`);
          continue;
        }
      }
      if (U.ch(0.05 + mod('delay') - me.infra / 1000)) {
        s.status = 'delay';
        p.kas -= s.value * 0.02;
        rep.ship.push(`⏳ ${tag} ke ${d.name} tertahan di pelabuhan (kongesti/dokumen). Biaya demurrage ${fmt(s.value * 0.02)}; pembayaran mundur 1 kuartal.`);
        keep.push(s); continue;
      }
      let disc = 0;
      if (U.ch(0.06 * (1 - me.tech / 120))) disc = U.r(0.08, 0.2);
      p.kas += s.value * (1 - disc);
      rep.ship.push(disc ? `⚠ Ekspor ${tag} ke ${d.name} diterima dengan klaim kualitas (potongan ${(disc * 100).toFixed(0)}%). +${fmt(s.value * (1 - disc))}`
        : `✅ Ekspor ${tag} ke ${d.name} dibayar penuh. +${fmt(s.value)}`);
    } else {
      if (s.status === 'delay') {
        p.stock[s.com] = (p.stock[s.com] || 0) + s.qty;
        rep.ship.push(`✅ Impor ${tag} dari ${d.name} (tertunda) akhirnya tiba.`);
        continue;
      }
      if (U.ch(routeRisk(d.region, myReg))) {
        if (s.ins) { p.kas += s.value * 0.9; rep.ship.push(`🌊 Kapal impor ${tag} dari ${d.name} hilang di laut. Asuransi mengganti ${fmt(s.value * 0.9)}.`); }
        else rep.ship.push(`🌊 Kapal impor ${tag} dari ${d.name} hilang di laut. Tanpa asuransi — rugi ${fmt(s.value)}!`);
        continue;
      }
      if (s.pay === 'tt' && U.ch(0.02 + d.buyerRisk * 0.6)) {
        rep.ship.push(`🕵 PENIPUAN! Pemasok di ${d.name} menghilang setelah menerima pembayaran di muka (T/T) untuk ${tag}. Rugi ${fmt(s.value)}.`);
        continue;
      }
      if (U.ch(0.05 + mod('delay') - me.infra / 1000)) {
        s.status = 'delay';
        rep.ship.push(`⏳ Impor ${tag} dari ${d.name} tertunda (antrean bongkar muat). Tiba kuartal depan — waspadai kelangkaan!`);
        keep.push(s); continue;
      }
      let q = s.qty;
      if (U.ch(0.05 * (1 - me.tech / 150))) { const l = U.r(0.1, 0.2); q *= 1 - l; rep.ship.push(`⚠ Sebagian impor ${name} dari ${d.name} rusak/tidak sesuai spesifikasi (-${(l * 100).toFixed(0)}%).`); }
      if (U.ch(0.08 * (1 - me.stab / 150))) { const f = s.value * 0.03; p.kas -= f; rep.ship.push(`🧾 Pungli di pelabuhan saat bongkar ${name}: biaya tak resmi ${fmt(f)}.`); }
      p.stock[s.com] = (p.stock[s.com] || 0) + q;
      rep.ship.push(`📦 Impor ${fq(q)} ${u} ${name} dari ${d.name} tiba di gudang.`);
    }
  }
  p.shipments = keep;
}

// ============================================================
//  TAWARAN KONTRAK
// ============================================================
function genOffers() {
  const p = P();
  S.offers = S.offers.filter(o => o.exp > S.turn);
  if (S.offers.length >= 3) return;
  const proj = projection();
  if (U.ch(0.45)) {
    // pembeli asing
    const coms = Object.keys(COMMODITIES).filter(c => proj[c].stock > 0 && proj[c].prod > 0 && !p.ban[c]);
    for (let tries = 0; tries < 6 && coms.length; tries++) {
      const com = U.pick(coms);
      const buyers = Object.keys(S.countries).filter(id => exportCapTotal(id, com) > 0);
      if (!buyers.length) continue;
      const cid = U.pick(buyers);
      const surplus = Math.max(proj[com].prod - proj[com].use - proj[com].input, proj[com].stock * 0.3);
      const qty = Math.min(exportCapTotal(cid, com) * 0.6, surplus * U.r(0.25, 0.5));
      if (qty <= 0) continue;
      const q = quoteExport(cid, com, 0.0001, 'lc', false);
      S.offers.push({ id: ++S.oid, type: 'ekspor', cid, com, qty, price: q.unit * U.r(0.97, 1.1), t: 4, exp: S.turn + 1 });
      break;
    }
  }
  if (U.ch(0.35)) {
    const coms = Object.keys(COMMODITIES).filter(c => proj[c].use > 0 && proj[c].end < proj[c].use * 0.5);
    for (let tries = 0; tries < 6 && coms.length; tries++) {
      const com = U.pick(coms);
      const sellers = Object.keys(S.countries).filter(id => importCapTotal(id, com) > 0);
      if (!sellers.length) continue;
      const cid = U.pick(sellers);
      const qty = Math.min(importCapTotal(cid, com) * 0.6, Math.max(0.0001, (proj[com].use - Math.max(0, proj[com].end)) * U.r(0.3, 0.6)));
      if (qty <= 0) continue;
      const q = quoteImport(cid, com, 0.0001, 'lc', false);
      S.offers.push({ id: ++S.oid, type: 'impor', cid, com, qty, price: q.unit * (1 + shipRate(D(cid).region, D(S.pid).region, com)) * U.r(0.97, 1.06), t: 4, exp: S.turn + 1 });
      break;
    }
  }
}

// ============================================================
//  EVENT
// ============================================================
function otherCountries() { return Object.keys(S.countries).filter(id => id !== S.pid); }
function hasProd(c) { return (P().cap[c] || 0) > 0; }
function gdpPct(x) { return ME().gdp * x / 100; }

const EVENTS = [
  { id: 'suez', w: 2.5, cond: () => !hasActive('suez'),
    run: () => { addActive('suez', 'Krisis Laut Merah', 4, { suez: 2.2, pirate: 0.025 });
      return { title: 'Krisis Laut Merah', text: 'Serangan terhadap kapal dagang di Laut Merah memaksa kapal memutar lewat Tanjung Harapan. Ongkos kirim rute Asia–Eropa melonjak 2x lipat dan risiko pembajakan naik selama 4 kuartal.' }; } },
  { id: 'pandemi', w: 0.35, cond: () => S.turn > 8 && !hasActive('pandemi'),
    run: () => { addActive('pandemi', 'Pandemi Global', 4, { ship: 2.2, demand: { industri: 0.75, teknologi: 0.85, energi: 0.8 }, growth: -4, anchor: { minyak: 0.7, bbm: 0.75 } });
      ME().stab -= 8; S.prices.minyak *= 0.7;
      return { title: 'Pandemi Global', text: 'Virus baru menyebar ke seluruh dunia. Lockdown membuat permintaan industri anjlok, ongkos kirim naik 2x, harga minyak jatuh, dan semua ekonomi melambat.' }; } },
  { id: 'krisis', w: 0.8, cond: () => S.turn > 4 && !hasActive('krisis'),
    run: () => { addActive('krisis', 'Krisis Keuangan Global', 4, { growth: -2.5, default: 0.05, anchor: { tambang: 0.85, energi: 0.85, kebun: 0.9 } });
      for (const k in S.fx) if (!['EUR', 'JPY', 'GBP', 'SAR'].includes(k)) { S.fx[k].sent -= 0.6; S.fx[k].fund *= 0.94; }
      ME().stab -= 5;
      return { title: 'Krisis Keuangan Global', text: 'Bank besar di Wall Street runtuh. Modal kabur dari negara berkembang, mata uangnya melemah, harga komoditas turun, dan risiko pembeli gagal bayar meningkat (+5%).' }; } },
  { id: 'fed_up', w: 2, cond: () => S.globalRate < 7.5,
    run: () => { S.globalRate += 0.75;
      for (const k in S.fx) if (!['EUR', 'JPY', 'GBP', 'SAR'].includes(k)) S.fx[k].sent -= 0.35;
      return { title: 'The Fed Menaikkan Suku Bunga', text: `Bank sentral AS menaikkan bunga menjadi ${S.globalRate.toFixed(2)}%. Dolar menguat, mata uang negara berkembang tertekan, dan bunga obligasi baru naik.` }; } },
  { id: 'fed_down', w: 2, cond: () => S.globalRate > 2,
    run: () => { S.globalRate -= 0.5;
      for (const k in S.fx) S.fx[k].sent += 0.25;
      return { title: 'The Fed Memangkas Suku Bunga', text: `Suku bunga global turun ke ${S.globalRate.toFixed(2)}%. Modal kembali mengalir ke pasar berkembang; biaya utang baru lebih murah.` }; } },
  { id: 'opec', w: 2, cond: () => !hasActive('opec') && !hasActive('oilcrash'),
    run: () => { addActive('opec', 'OPEC+ Pangkas Produksi', 4, { anchor: { minyak: 1.35, bbm: 1.2, gas: 1.15 } }); S.prices.minyak *= 1.2; S.prices.bbm *= 1.1;
      return { title: 'OPEC+ Memangkas Produksi', text: 'Kartel minyak mengurangi pasokan. Harga minyak mentah melonjak, BBM ikut naik. Untung bagi eksportir minyak, pukulan bagi importir.' }; } },
  { id: 'oilcrash', w: 1.5, cond: () => !hasActive('opec') && !hasActive('oilcrash'),
    run: () => { addActive('oilcrash', 'Harga Minyak Anjlok', 4, { anchor: { minyak: 0.7, bbm: 0.8, gas: 0.85 } }); S.prices.minyak *= 0.8;
      return { title: 'Perang Harga Minyak', text: 'Produsen besar membanjiri pasar. Harga minyak anjlok ~30%. Negara pengekspor minyak kehilangan pendapatan besar.' }; } },
  { id: 'chinaslow', w: 1.5, cond: () => S.pid !== 'chn' && !hasActive('chinaslow'),
    run: () => { addActive('chinaslow', 'Perlambatan Tiongkok', 4, { anchor: { batubara: 0.8, bijihbesi: 0.78, nikel: 0.8, tembaga: 0.85 }, growthC: { chn: -1.5, aus: -0.8 } });
      return { title: 'Ekonomi Tiongkok Melambat', text: 'Krisis properti di Tiongkok menekan permintaan bahan baku. Harga batu bara, bijih besi, nikel dan tembaga turun 15–22%.' }; } },
  { id: 'supercycle', w: 1, cond: () => !hasActive('supercycle'),
    run: () => { addActive('supercycle', 'Supercycle Komoditas', 6, { anchor: { tambang: 1.25, energi: 1.15 } });
      return { title: 'Supercycle Komoditas', text: 'Pembangunan infrastruktur hijau global membuat permintaan logam & energi melonjak. Harga tambang naik ~25% selama 6 kuartal.' }; } },
  { id: 'elnino', w: 2, cond: () => !hasActive('elnino'),
    run: () => { const hit = ['SEA', 'OCE', 'SAS'].includes(D(S.pid).region);
      addActive('elnino', 'El Niño', 3, { anchor: { beras: 1.2, sawit: 1.15, kopi: 1.15, gula: 1.15, kakao: 1.1 }, ...(hit ? { prod: { pangan: 0.78, kebun: 0.8 } } : {}) });
      return { title: 'El Niño Melanda', text: 'Kemarau panjang melanda Asia & Oseania. Harga beras, sawit, kopi dan gula naik.' + (hit ? ' Produksi pertanian & perkebunan ANDA turun ~20% selama 3 kuartal — siapkan impor pangan!' : '') }; } },
  { id: 'wheat', w: 1.5, cond: () => !hasActive('wheat'),
    run: () => { addActive('wheat', 'Krisis Gandum', 3, { anchor: { gandum: 1.35, kedelai: 1.1 } });
      return { title: 'Gagal Panen Gandum', text: 'Kekeringan di kawasan Laut Hitam dan Amerika Utara. Harga gandum melonjak 35%.' }; } },
  { id: 'aiboom', w: 1.3, cond: () => !hasActive('aiboom'),
    run: () => { addActive('aiboom', 'Ledakan AI', 6, { anchor: { semikonduktor: 1.3, elektronik: 1.1 }, demand: { semikonduktor: 1.3, elektronik: 1.15 } });
      return { title: 'Ledakan Kecerdasan Buatan', text: 'Perusahaan teknologi berlomba membangun pusat data. Permintaan & harga chip melonjak selama 6 kuartal.' }; } },
  { id: 'foodprice', w: 1.3, cond: () => !hasActive('foodprice'),
    run: () => { addActive('foodprice', 'Harga Pangan Global Naik', 3, { anchor: { pangan: 1.2 } });
      return { title: 'Inflasi Pangan Global', text: 'Biaya pupuk dan logistik naik. Harga pangan dunia naik ~20% selama 3 kuartal.' }; } },
  { id: 'exportban', w: 1.2, cond: () => true,
    run: () => {
      const opts = [];
      for (const id of otherCountries()) for (const c of ['beras', 'gandum', 'gula', 'nikel', 'bijihbesi', 'kopi', 'sawit']) if (importCapTotal(id, c) > 0) opts.push([id, c]);
      if (!opts.length) return null;
      const [id, c] = U.pick(opts);
      C(id).exportBan[c] = 4; S.prices[c] *= 1.15;
      addActive('ban_' + id + c, `${D(id).name} larang ekspor ${COM(c).name}`, 4, { anchor: { [c]: 1.2 } });
      return { title: 'Larangan Ekspor', text: `${D(id).name} melarang ekspor ${COM(c).name} demi mengamankan pasokan dalam negeri. Harga dunia naik; Anda tidak bisa membeli dari ${D(id).name} selama 4 kuartal.` }; } },
  // ---- event dengan pilihan ----
  { id: 'dumping', w: 2.5, choice: true,
    cond: () => Object.keys(P().recentX).some(id => Object.keys(P().recentX[id]).some(c => ['baja', 'tekstil', 'sawit', 'baterai', 'mobil', 'elektronik', 'bbm', 'batubara'].includes(c))),
    run: () => {
      let best = null;
      for (const id in P().recentX) for (const c in P().recentX[id]) if (['baja', 'tekstil', 'sawit', 'baterai', 'mobil', 'elektronik', 'bbm', 'batubara'].includes(c)) {
        if (!best || P().recentX[id][c] > best.v) best = { id, c, v: P().recentX[id][c] };
      }
      const fee = Math.max(100, best.v * 0.05);
      return { title: 'Tuduhan Dumping', data: { ...best, fee },
        text: `Produsen di ${D(best.id).name} menuduh ${COM(best.c).name} Anda dijual di bawah harga wajar (dumping) dan meminta bea antidumping 25%.` };
    },
    choices: (dt) => [
      { label: `Lawan di WTO (${fmt(dt.fee)})`, desc: 'Biaya pengacara. Peluang menang ~55%.', run: () => {
        P().kas -= dt.fee;
        if (U.ch(0.55)) return 'Panel WTO memenangkan Anda! Tuduhan dumping ditolak.';
        C(dt.id).xt[dt.c] = { r: 0.25, t: 8 }; return `Anda kalah di WTO. Bea antidumping 25% untuk ${COM(dt.c).name} ke ${D(dt.id).name} selama 8 kuartal.`; } },
      { label: 'Terima bea antidumping', desc: 'Bea 15% selama 8 kuartal, hubungan membaik.', run: () => {
        C(dt.id).xt[dt.c] = { r: 0.15, t: 8 }; C(dt.id).rel += 3; return `Bea antidumping 15% berlaku untuk ${COM(dt.c).name} ke ${D(dt.id).name}.`; } },
      { label: 'Batasi ekspor sukarela (VER)', desc: 'Kuota ekspor ke negara itu dipotong 50% selama 8 kuartal, tanpa bea.', run: () => {
        C(dt.id).ver[dt.c] = 8; C(dt.id).rel += 5; return `Anda setuju membatasi ekspor ${COM(dt.c).name} ke ${D(dt.id).name}. Hubungan +5.`; } },
    ] },
  { id: 'tradewar', w: 1.8, choice: true,
    cond: () => S.turn > 3 && otherCountries().some(id => C(id).rel < 65 && C(id).tAddT <= 0 && !blocked(id) && ['usa', 'chn', 'ind', 'deu', 'bra'].includes(id)),
    run: () => {
      const id = U.pick(otherCountries().filter(id => C(id).rel < 65 && C(id).tAddT <= 0 && !blocked(id) && ['usa', 'chn', 'ind', 'deu', 'bra'].includes(id)));
      C(id).tAdd = 0.2; C(id).tAddT = 8;
      return { title: 'Perang Dagang!', data: { id, cost: Math.max(200, gdpPct(0.05)) },
        text: `${D(id).name} mengenakan tarif tambahan 20% atas SEMUA barang Anda selama 8 kuartal, dengan alasan "defisit perdagangan yang tidak adil".` };
    },
    choices: (dt) => [
      { label: 'Balas dengan tarif', desc: '40% mereka mundur; jika tidak, eskalasi.', run: () => {
        const c = C(dt.id); c.rel -= 12;
        if (U.ch(0.4)) { c.tAddT = 0; return `${D(dt.id).name} mundur dan mencabut tarif. Nyali Anda membuahkan hasil.`; }
        c.tAdd = 0.3; ME().stab -= 3; return `Eskalasi! ${D(dt.id).name} menaikkan tarif menjadi 30%. Hubungan memburuk.`; } },
      { label: `Negosiasi & konsesi (${fmt(dt.cost)})`, desc: 'Komitmen membeli produk mereka. Tarif turun jadi 5%.', run: () => {
        P().kas -= dt.cost; C(dt.id).tAdd = 0.05; C(dt.id).rel += 8; return `Kesepakatan tercapai. Tarif tambahan turun menjadi 5%, hubungan +8.`; } },
      { label: 'Terima & cari pasar lain', desc: 'Tarif tetap 20%.', run: () => 'Anda memilih diversifikasi pasar ekspor.' },
    ] },
  { id: 'secondary', w: 3, choice: true,
    cond: () => S.pid !== 'rus' && !WESTERN.includes(S.pid) && (P().lastTrade.rus ?? -99) >= S.turn - 2 && C('rus').embargo <= 0,
    run: () => ({ title: 'Ancaman Sanksi Sekunder', data: {},
      text: 'Amerika Serikat memperingatkan: negara yang terus berdagang dengan Rusia akan terkena sanksi sekunder berupa tarif tinggi dan pembekuan akses dolar.' }),
    choices: () => [
      { label: 'Hentikan dagang dengan Rusia', desc: 'Embargo Rusia 8 kuartal. Hubungan AS membaik.', run: () => {
        C('rus').embargo = 8; C('rus').rel -= 15; C('usa').rel += 5; P().contracts = P().contracts.filter(k => k.cid !== 'rus');
        return 'Anda menghentikan perdagangan dengan Rusia. Semua kontrak dengan Rusia dibatalkan.'; } },
      { label: 'Abaikan ancaman', desc: 'AS mengenakan tarif +25%, hubungan Barat memburuk.', run: () => {
        C('usa').tAdd = 0.25; C('usa').tAddT = 8; C('usa').rel -= 20; C('deu').rel -= 8; C('gbr').rel -= 8; C('rus').rel += 8;
        return 'AS mengenakan tarif 25% atas barang Anda. Rusia berterima kasih atas "persahabatan"-nya.'; } },
    ] },
  { id: 'eudr', w: 2.5, choice: true,
    cond: () => !P().certified && !P().euBlock && EUDR_COMS.some(c => hasProd(c)) && !['deu', 'gbr'].includes(S.pid),
    run: () => ({ title: 'Regulasi Anti-Deforestasi Eropa (EUDR)', data: { cost: Math.max(300, gdpPct(0.06)) },
      text: 'Uni Eropa & Inggris mewajibkan bukti bahwa sawit, kopi, kakao, karet dan daging tidak berasal dari lahan hasil deforestasi. Tanpa sertifikasi, produk Anda berisiko ditolak.' }),
    choices: (dt) => [
      { label: `Bangun sistem sertifikasi (${fmt(dt.cost)})`, desc: 'Akses Eropa aman.', run: () => { P().kas -= dt.cost; P().certified = true; return 'Sistem ketertelusuran dibangun. Produk Anda lolos EUDR.'; } },
      { label: 'Tolak — ini proteksionisme!', desc: 'Pasar Jerman & Inggris tertutup untuk komoditas tsb.', run: () => { P().euBlock = true; C('deu').rel -= 5; C('gbr').rel -= 3; ME().stab += 2; return 'Anda menolak EUDR. Ekspor komoditas perkebunan ke Eropa terblokir (bisa disertifikasi nanti lewat menu Dunia).'; } },
    ] },
  { id: 'congestion', w: 2.5, choice: true, cond: () => !hasActive('congest'),
    run: () => ({ title: 'Kemacetan Pelabuhan', data: { cost: Math.max(40, gdpPct(0.01)) },
      text: 'Antrean kapal di pelabuhan utama mengular hingga 2 minggu. Jika dibiarkan, banyak pengiriman kuartal ini akan tertunda.' }),
    choices: (dt) => [
      { label: `Sewa crane & lembur (${fmt(dt.cost)})`, desc: 'Masalah teratasi.', run: () => { P().kas -= dt.cost; return 'Pelabuhan kembali lancar.'; } },
      { label: 'Biarkan', desc: 'Risiko keterlambatan +35% kuartal ini.', run: () => { addActive('congest', 'Kemacetan Pelabuhan', 1, { delay: 0.35 }); return 'Pengiriman kuartal ini berisiko besar tertunda.'; } },
    ] },
  { id: 'strike', w: 1.8, choice: true, cond: () => true,
    run: () => ({ title: 'Mogok Buruh Pelabuhan', data: { cost: Math.max(60, gdpPct(0.03)) },
      text: 'Serikat buruh pelabuhan menuntut kenaikan upah 15% dan mengancam mogok nasional.' }),
    choices: (dt) => [
      { label: `Penuhi tuntutan (${fmt(dt.cost)})`, desc: 'Stabilitas +2.', run: () => { P().kas -= dt.cost; ME().stab += 2; return 'Buruh kembali bekerja dengan gembira.'; } },
      { label: 'Tolak tuntutan', desc: 'Mogok: risiko keterlambatan +50%, stabilitas -5.', run: () => { addActive('strike', 'Mogok Pelabuhan', 1, { delay: 0.5 }); ME().stab -= 5; return 'Mogok nasional terjadi. Pelabuhan lumpuh kuartal ini.'; } },
    ] },
  { id: 'customs', w: 1.8, choice: true, cond: () => ME().stab < 85,
    run: () => { const loss = Math.max(30, gdpPct(0.02)); P().kas -= loss;
      return { title: 'Skandal Korupsi Bea Cukai', data: { cost: Math.max(80, gdpPct(0.04)), loss },
        text: `Investigasi mengungkap jaringan korupsi di bea cukai. Kerugian negara ${fmt(loss)}.` }; },
    choices: (dt) => [
      { label: `Reformasi total bea cukai (${fmt(dt.cost)})`, desc: 'Stabilitas +4, infrastruktur +1.', run: () => { P().kas -= dt.cost; ME().stab += 4; ME().infra += 1; return 'Sistem bea cukai digital & transparan diluncurkan.'; } },
      { label: 'Tutup kasus diam-diam', desc: 'Stabilitas -6.', run: () => { ME().stab -= 6; return 'Media membongkar upaya menutupi kasus. Publik marah.'; } },
    ] },
  { id: 'smuggling', w: 1.8, choice: true, cond: () => true,
    run: () => { const loss = ME().gdp * P().budget.tax / 400 * 0.04; P().kas -= loss;
      return { title: 'Penyelundupan Marak', data: { cost: Math.max(50, gdpPct(0.025)) },
        text: `Barang selundupan (tekstil, elektronik, rokok) membanjiri pasar gelap. Penerimaan pajak hilang ${fmt(loss)} dan industri lokal terpukul.` }; },
    choices: (dt) => [
      { label: `Operasi patroli laut (${fmt(dt.cost)})`, desc: 'Masalah teratasi.', run: () => { P().kas -= dt.cost; return 'Patroli gabungan menangkap puluhan kapal penyelundup.'; } },
      { label: 'Abaikan', desc: 'Stabilitas -2, industri tekstil tertekan.', run: () => { ME().stab -= 2; addActive('smug', 'Penyelundupan', 2, { prod: { tekstil: 0.85, elektronik: 0.9 } }); return 'Penyelundupan terus berlanjut.'; } },
    ] },
  { id: 'disaster', w: 1.6, choice: true, cond: () => true,
    run: () => {
      const kinds = ['Gempa bumi besar', 'Banjir bandang', 'Topan dahsyat', 'Kebakaran hutan'];
      const k = U.pick(kinds), dmg = U.r(2, 5);
      ME().infra = Math.max(0, ME().infra - dmg);
      const raws = Object.keys(P().cap).filter(c => !RECIPES[c]);
      const hit = raws.length ? U.pick(raws) : null;
      if (hit) addActive('disaster', 'Pemulihan bencana', 2, { prod: { [hit]: 0.8 } });
      return { title: 'Bencana Alam', data: { cost: Math.max(100, gdpPct(0.15)), aid: Math.max(50, gdpPct(0.06)) },
        text: `${k} melanda wilayah industri. Infrastruktur -${dmg.toFixed(1)}.` + (hit ? ` Produksi ${COM(hit).name} turun 20% selama 2 kuartal.` : '') };
    },
    choices: (dt) => [
      { label: `Terima bantuan internasional (+${fmt(dt.aid)})`, desc: 'Hubungan dengan negara donor membaik.', run: () => { P().kas += dt.aid; for (const id of ['usa', 'jpn', 'aus', 'chn']) if (id !== S.pid) C(id).rel += 2; return 'Bantuan kemanusiaan berdatangan.'; } },
      { label: `Tangani sendiri (${fmt(dt.cost)})`, desc: 'Rekonstruksi cepat: infrastruktur pulih, stabilitas +4.', run: () => { P().kas -= dt.cost; ME().infra += 3; ME().stab += 4; return 'Rekonstruksi berjalan cepat. Rakyat bangga.'; } },
    ] },
  { id: 'investor', w: 2.5, choice: true, cond: () => ME().stab > 40,
    run: () => {
      const opts = Object.keys(RECIPES).filter(c => RECIPES[c].tech <= ME().tech + 12);
      if (!opts.length) return null;
      const com = U.pick(opts);
      const srcs = otherCountries().filter(id => (D(id).prod[com] || 0) > 0 && !blocked(id));
      const src = srcs.length ? U.pick(srcs) : otherCountries().find(id => !blocked(id));
      return { title: 'Tawaran Investasi Asing', data: { com, src, cost: factoryCost(com) * 0.25 },
        text: `Konsorsium dari ${D(src).name} ingin membangun ${RECIPES[com].label} di negara Anda (kapasitas +${fq(RECIPES[com].lot)} ${COM(com).unit}/kuartal). Mereka meminta insentif pajak & lahan senilai ${fmt(factoryCost(com) * 0.25)}.` };
    },
    choices: (dt) => [
      { label: `Terima (${fmt(dt.cost)})`, desc: 'Pabrik dibangun investor. Teknologi & hubungan naik.', run: () => {
        P().kas -= dt.cost; P().building.push({ com: dt.com, amt: RECIPES[dt.com].lot, t: 2, label: RECIPES[dt.com].label + ' (PMA)' }); C(dt.src).rel += 4; ME().tech += 0.5;
        return 'Investor mulai membangun pabrik. Selesai dalam 2 kuartal.'; } },
      { label: 'Tolak', desc: '', run: () => 'Investor mengalihkan modalnya ke negara tetangga.' },
    ] },
  { id: 'discovery', w: 1, cond: () => true,
    run: () => {
      const raws = Object.keys(COMMODITIES).filter(c => !RECIPES[c] && ['tambang', 'energi'].includes(COM(c).cat));
      const c = U.pick(raws), p = P();
      if (hasProd(c)) { const add = p.cap[c] * 0.15; p.cap[c] += add; return { title: 'Penemuan Cadangan Baru', text: `Ahli geologi menemukan cadangan ${COM(c).name} baru. Produksi +${fq(add)} ${COM(c).unit}/kuartal.` }; }
      let tot = 0; for (const id in COUNTRIES) tot += COUNTRIES[id].prod[c] || 0;
      const add = tot * 0.01; p.cap[c] = add; p.disc[c] = add;
      return { title: 'Penemuan Sumber Daya Baru!', text: `Cadangan ${COM(c).name} ditemukan di wilayah Anda! Produksi awal ${fq(add)} ${COM(c).unit}/kuartal (bisa diperluas di menu Industri).` };
    } },
  { id: 'farmers', w: 3, choice: true, cond: () => P().q.foodImport,
    run: () => ({ title: 'Demo Petani Tolak Impor Pangan', data: { cost: Math.max(50, gdpPct(0.03)) },
      text: 'Ribuan petani turun ke jalan memprotes impor pangan yang menjatuhkan harga panen mereka.' }),
    choices: (dt) => [
      { label: `Beri subsidi pupuk (${fmt(dt.cost)})`, desc: 'Petani tenang, produksi pangan +3%.', run: () => { P().kas -= dt.cost; for (const c in P().cap) if (COM(c).cat === 'pangan') P().cap[c] *= 1.03; return 'Subsidi pupuk disalurkan. Petani kembali ke sawah.'; } },
      { label: 'Abaikan', desc: 'Stabilitas -5.', run: () => { ME().stab -= 5; return 'Demo meluas di beberapa provinsi.'; } },
    ] },
  { id: 'attack', w: 2, choice: true,
    cond: () => { const f = S.fx[D(S.pid).cur.code]; return f && !f.peg && (ME().inf > 7 || ['BB', 'B', 'CCC', 'D'].includes(rating().r) || f.v < f.v0 * 0.85); },
    run: () => { const f = S.fx[D(S.pid).cur.code]; f.v *= 0.9; f.sent -= 0.5;
      return { title: 'Serangan Spekulan Mata Uang', data: { cost: Math.min(Math.max(0, P().kas * 0.3), gdpPct(1)) },
        text: `Spekulan global memborong dolar dan membuang ${f.name}. Kurs ${f.code} anjlok 10% dalam seminggu!` }; },
    choices: (dt) => [
      { label: `Intervensi pasar (${fmt(dt.cost)})`, desc: 'Jual cadangan dolar untuk membeli mata uang sendiri.', run: () => {
        const f = S.fx[D(S.pid).cur.code]; P().kas -= dt.cost; const up = Math.min(0.12, dt.cost / f.depth); f.v *= 1 + up; f.sent += 0.4;
        return `Bank sentral melakukan intervensi. Kurs pulih ${(up * 100).toFixed(1)}%.`; } },
      { label: 'Biarkan pasar bekerja', desc: 'Inflasi +2 poin (barang impor lebih mahal).', run: () => { ME().inf += 2; return 'Mata uang melemah, harga barang impor naik.'; } },
    ] },
  { id: 'ftaoffer', w: 1.2, choice: true, cond: () => otherCountries().some(id => C(id).rel >= 60 && !C(id).fta && !blocked(id)),
    run: () => { const id = U.pick(otherCountries().filter(id => C(id).rel >= 60 && !C(id).fta && !blocked(id)));
      return { title: 'Tawaran Perjanjian Dagang Bebas', data: { id, cost: ftaCost() * 0.5 },
        text: `${D(id).name} menawarkan perundingan FTA dengan biaya setengah harga.` }; },
    choices: (dt) => [
      { label: `Terima (${fmt(dt.cost)})`, desc: 'Tarif dihapus.', run: () => { P().kas -= dt.cost; C(dt.id).fta = true; C(dt.id).rel += 5; return `FTA dengan ${D(dt.id).name} berlaku!`; } },
      { label: 'Tolak', desc: 'Melindungi industri lokal. Stabilitas +1.', run: () => { ME().stab += 1; C(dt.id).rel -= 3; return 'Tawaran FTA ditolak.'; } },
    ] },
  { id: 'wto_ban', w: 3, choice: true, cond: () => Object.values(P().ban).some(Boolean) && !hasActive('wto'),
    run: () => { const c = Object.keys(P().ban).filter(k => P().ban[k])[0];
      addActive('wto', 'Sengketa WTO', 8, {});
      return { title: 'Digugat ke WTO', data: { c, cost: Math.max(100, gdpPct(0.03)) },
        text: `Uni Eropa menggugat larangan ekspor ${COM(c).name} mentah Anda ke WTO karena dinilai melanggar aturan perdagangan bebas.` }; },
    choices: (dt) => [
      { label: `Lawan & ajukan banding (${fmt(dt.cost)})`, desc: 'Larangan tetap berlaku, hubungan dengan Eropa turun.', run: () => { P().kas -= dt.cost; C('deu').rel -= 6; C('gbr').rel -= 3; return 'Anda banding. Proses hukum berlarut-larut, hilirisasi jalan terus.'; } },
      { label: 'Cabut larangan', desc: 'Hubungan pulih.', run: () => { P().ban[dt.c] = false; C('deu').rel += 3; return 'Larangan ekspor dicabut.'; } },
    ] },
  { id: 'visit', w: 1.5, cond: () => true,
    run: () => { const id = U.pick(otherCountries().filter(id => !blocked(id))); if (!id) return null; C(id).rel += 7;
      return { title: 'Kunjungan Kenegaraan', text: `Kepala negara ${D(id).name} berkunjung dan membawa rombongan pengusaha. Hubungan +7.` }; } },
  { id: 'cyber', w: 1, cond: () => true,
    run: () => { addActive('cyber', 'Serangan Siber', 1, { delay: 0.3 }); const c = Math.max(20, gdpPct(0.01)); P().kas -= c;
      return { title: 'Serangan Siber', text: `Ransomware melumpuhkan sistem kepabeanan nasional. Biaya pemulihan ${fmt(c)}; banyak pengiriman kuartal ini berisiko tertunda.` }; } },
];

function rollEvents(rep) {
  let n = U.ch(0.65) ? 1 : 0;
  if (U.ch(0.2)) n++;
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const pool = EVENTS.filter(e => !used.has(e.id) && e.cond());
    const e = U.wpick(pool, x => x.w);
    if (!e) break;
    used.add(e.id);
    const r = e.run();
    if (!r) continue;
    if (e.choice) S.pending.push({ id: e.id, title: r.title, text: r.text, data: r.data });
    else rep.events.push(r);
  }
}
function pendingChoices(pe) {
  const e = EVENTS.find(x => x.id === pe.id);
  return e ? e.choices(pe.data || {}) : [];
}
function resolveChoice(idx) {
  const pe = S.pending[0];
  if (!pe) return null;
  const ch = pendingChoices(pe)[idx];
  const txt = ch ? ch.run() : '';
  S.pending.shift();
  const me = ME(); me.stab = U.cl(me.stab, 0, 100); me.infra = U.cl(me.infra, 0, 100); me.tech = U.cl(me.tech, 0, 100);
  for (const id in S.countries) C(id).rel = U.cl(C(id).rel, 0, 100);
  S.news.unshift({ t: S.turn, type: 'event', text: `${pe.title} → ${ch ? ch.label : ''}: ${txt}` });
  return txt;
}

// ---------- simpan / muat ----------
const SAVE_KEY = 'eksporimpor_save_v1';
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
function loadGame() { try { const s = localStorage.getItem(SAVE_KEY); if (s) { S = JSON.parse(s); return true; } } catch (e) { } return false; }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }

if (typeof module !== 'undefined') {
  module.exports = { get S() { return S; }, newGame, endTurn, projection, quoteExport, quoteImport, doExport, doImport, doSpotSell, doSpotBuy, quoteSpotSell,
    buildFactory, expandRaw, issueBonds, repayDebt, resolveChoice, pendingChoices, scoreOf, rankings, myRank, rating, fmt, exportCapTotal, importCapTotal, useNow, P, ME, C, fxBuy, fxSell };
}
