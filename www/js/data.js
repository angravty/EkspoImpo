// ============================================================
//  DATA DUNIA — negara, komoditas, industri
//  Satuan uang internal: juta USD ($jt). Kuantitas per kuartal.
// ============================================================

const COMMODITIES = {
  // ---- Energi & tambang ----
  minyak:   { name: 'Minyak Mentah',      unit: 'jt barel',  price: 80,   cat: 'energi',  ship: 1.2, decay: 0.01, vol: 0.10 },
  gas:      { name: 'Gas Alam (LNG)',     unit: 'jt ton',    price: 500,  cat: 'energi',  ship: 1.4, decay: 0.01, vol: 0.12 },
  batubara: { name: 'Batu Bara',          unit: 'jt ton',    price: 110,  cat: 'tambang', ship: 2.0, decay: 0.005, vol: 0.10 },
  bijihbesi:{ name: 'Bijih Besi',         unit: 'jt ton',    price: 105,  cat: 'tambang', ship: 2.0, decay: 0.005, vol: 0.09 },
  nikel:    { name: 'Bijih Nikel',        unit: 'jt ton',    price: 50,   cat: 'tambang', ship: 2.0, decay: 0.005, vol: 0.11 },
  tembaga:  { name: 'Tembaga',            unit: 'rb ton',    price: 9,    cat: 'tambang', ship: 0.8, decay: 0.005, vol: 0.08 },
  // ---- Pertanian & perkebunan ----
  sawit:    { name: 'Minyak Sawit (CPO)', unit: 'jt ton',    price: 850,  cat: 'kebun',   ship: 1.0, decay: 0.03, vol: 0.09 },
  karet:    { name: 'Karet Alam',         unit: 'jt ton',    price: 1600, cat: 'kebun',   ship: 1.0, decay: 0.02, vol: 0.08 },
  kopi:     { name: 'Kopi',               unit: 'rb ton',    price: 4.5,  cat: 'kebun',   ship: 0.8, decay: 0.03, vol: 0.10 },
  kakao:    { name: 'Kakao',              unit: 'rb ton',    price: 6,    cat: 'kebun',   ship: 0.8, decay: 0.03, vol: 0.12 },
  beras:    { name: 'Beras',              unit: 'jt ton',    price: 550,  cat: 'pangan',  ship: 1.2, decay: 0.04, vol: 0.07, essential: true },
  gandum:   { name: 'Gandum',             unit: 'jt ton',    price: 260,  cat: 'pangan',  ship: 1.5, decay: 0.03, vol: 0.09, essential: true },
  kedelai:  { name: 'Kedelai',            unit: 'jt ton',    price: 450,  cat: 'pangan',  ship: 1.4, decay: 0.03, vol: 0.08, essential: true },
  gula:     { name: 'Gula',               unit: 'jt ton',    price: 500,  cat: 'pangan',  ship: 1.3, decay: 0.02, vol: 0.09, essential: true },
  daging:   { name: 'Daging Sapi',        unit: 'rb ton',    price: 5.5,  cat: 'pangan',  ship: 1.0, decay: 0.10, vol: 0.06, essential: true },
  // ---- Manufaktur ----
  bbm:      { name: 'BBM (Produk Kilang)',unit: 'jt barel',  price: 100,  cat: 'industri',ship: 1.2, decay: 0.01, vol: 0.08, essential: true },
  baja:     { name: 'Baja',               unit: 'jt ton',    price: 650,  cat: 'industri',ship: 1.2, decay: 0.005, vol: 0.06 },
  tekstil:  { name: 'Tekstil & Garmen',   unit: 'jt potong', price: 10,   cat: 'industri',ship: 0.5, decay: 0.01, vol: 0.04 },
  elektronik:{name: 'Elektronik',         unit: 'jt unit',   price: 200,  cat: 'teknologi',ship: 0.4, decay: 0.02, vol: 0.05 },
  semikonduktor:{name:'Semikonduktor',    unit: 'jt chip',   price: 150,  cat: 'teknologi',ship: 0.2, decay: 0.02, vol: 0.08 },
  mobil:    { name: 'Mobil',              unit: 'rb unit',   price: 25,   cat: 'industri',ship: 0.7, decay: 0.01, vol: 0.04 },
  mesin:    { name: 'Mesin Industri',     unit: 'rb unit',   price: 80,   cat: 'industri',ship: 0.6, decay: 0.01, vol: 0.04 },
  farmasi:  { name: 'Farmasi & Obat',     unit: 'jt paket',  price: 50,   cat: 'teknologi',ship: 0.3, decay: 0.02, vol: 0.04, essential: true },
  baterai:  { name: 'Baterai EV',         unit: 'rb unit',   price: 8,    cat: 'teknologi',ship: 0.5, decay: 0.01, vol: 0.07 },
};

const CAT_NAMES = { energi: 'Energi', tambang: 'Tambang', kebun: 'Perkebunan', pangan: 'Pangan', industri: 'Industri', teknologi: 'Teknologi' };

// Resep industri: input per 1 unit output, opex = porsi harga untuk biaya operasi
const RECIPES = {
  bbm:          { label: 'Kilang Minyak',            in: { minyak: 1.05 },                 opex: 0.05, tech: 20, lot: 25,  cost: 3000, time: 4 },
  baja:         { label: 'Pabrik Baja',              in: { bijihbesi: 1.6, batubara: 0.7 }, opex: 0.30, tech: 25, lot: 3,   cost: 5000, time: 3 },
  tekstil:      { label: 'Pabrik Tekstil & Garmen',  in: {},                               opex: 0.70, tech: 10, lot: 100, cost: 2000, time: 2 },
  elektronik:   { label: 'Pabrik Elektronik',        in: { tembaga: 0.5 },                 opex: 0.50, tech: 45, lot: 10,  cost: 7000, time: 3 },
  semikonduktor:{ label: 'Pabrik Chip (Fab)',        in: { gas: 0.02 },                    opex: 0.45, tech: 75, lot: 10,  cost: 9000, time: 6 },
  mobil:        { label: 'Pabrik Mobil',             in: { baja: 0.0012 },                 opex: 0.55, tech: 50, lot: 100, cost: 9000, time: 4 },
  mesin:        { label: 'Pabrik Mesin Industri',    in: { baja: 0.003 },                  opex: 0.50, tech: 60, lot: 30,  cost: 9000, time: 4 },
  farmasi:      { label: 'Pabrik Farmasi',           in: {},                               opex: 0.40, tech: 55, lot: 20,  cost: 4800, time: 3 },
  baterai:      { label: 'Pabrik Baterai EV',        in: { nikel: 0.03 },                  opex: 0.45, tech: 45, lot: 100, cost: 2600, time: 4 },
};

const REGIONS = { SEA: 'Asia Tenggara', EAS: 'Asia Timur', SAS: 'Asia Selatan', MEA: 'Timur Tengah', EUR: 'Eropa', NAM: 'Amerika Utara', SAM: 'Amerika Selatan', OCE: 'Oseania', AFR: 'Afrika' };

const DIST = {
  SEA: { SEA: 1, EAS: 2, SAS: 2, MEA: 3, EUR: 4, NAM: 4, SAM: 5, OCE: 2, AFR: 4 },
  EAS: { EAS: 1, SAS: 3, MEA: 3, EUR: 4, NAM: 3, SAM: 5, OCE: 3, AFR: 4 },
  SAS: { SAS: 1, MEA: 2, EUR: 3, NAM: 4, SAM: 5, OCE: 3, AFR: 3 },
  MEA: { MEA: 1, EUR: 2, NAM: 4, SAM: 4, OCE: 4, AFR: 2 },
  EUR: { EUR: 1, NAM: 2, SAM: 3, OCE: 5, AFR: 2 },
  NAM: { NAM: 1, SAM: 2, OCE: 4, AFR: 3 },
  SAM: { SAM: 1, OCE: 5, AFR: 2 },
  OCE: { OCE: 1, AFR: 4 },
  AFR: { AFR: 1 },
};
function regionDist(a, b) { return (DIST[a] && DIST[a][b]) || (DIST[b] && DIST[b][a]) || 3; }
// Rute yang melewati Laut Merah / Terusan Suez
function viaSuez(a, b) {
  const asia = ['SEA', 'EAS', 'SAS', 'OCE'];
  return (asia.includes(a) && b === 'EUR') || (asia.includes(b) && a === 'EUR');
}
// Rute yang melewati Selat Malaka
function viaMalaka(a, b) {
  const east = ['EAS'], west = ['SAS', 'MEA', 'EUR', 'AFR'];
  return (east.includes(a) && west.includes(b)) || (east.includes(b) && west.includes(a)) || a === 'SEA' || b === 'SEA';
}

// Rating kredit
const RATINGS = [
  { r: 'AAA', min: 85, spread: 0.0, issue: 0.05 },
  { r: 'AA',  min: 75, spread: 0.4, issue: 0.045 },
  { r: 'A',   min: 65, spread: 0.9, issue: 0.04 },
  { r: 'BBB', min: 55, spread: 1.7, issue: 0.03 },
  { r: 'BB',  min: 45, spread: 3.0, issue: 0.022 },
  { r: 'B',   min: 35, spread: 5.0, issue: 0.015 },
  { r: 'CCC', min: 20, spread: 9.0, issue: 0.008 },
  { r: 'D',   min: -999, spread: 99, issue: 0 },
];

// ------------------------------------------------------------
// NEGARA — data kira-kira sesuai kondisi nyata (disederhanakan)
// gdp dalam $jt/tahun, pop dalam juta jiwa, prod/use per kuartal
// ------------------------------------------------------------
const COUNTRIES = {
  idn: {
    name: 'Indonesia', region: 'SEA', diff: 'Sulit',
    cur: { code: 'IDR', name: 'Rupiah', rate: 16300, int: 6.0, depth: 15000, vol: 3.0 },
    pop: 278, gdp: 1400000, hdi: 0.713, tech: 40, infra: 50, stab: 65, inf: 2.8, infTarget: 3, debt: 39, ratingTarget: 58,
    budget: { tax: 10.5, rutin: 5.5, infra: 2.5, edu: 3.5, health: 1.5, rnd: 0.3 },
    growth: 5.0, popGrowth: 0.9, tariff: 0.08, special: { beras: 0.25, gula: 0.1 }, buyerRisk: 0.03, strict: 0.2,
    costF: { batubara: 0.5 },
    prod: { batubara: 170, sawit: 12, nikel: 50, karet: 0.8, kopi: 190, kakao: 45, gas: 4, minyak: 55, tembaga: 250, bijihbesi: 1, beras: 8, gula: 0.6, daging: 110,
            tekstil: 400, bbm: 60, baja: 4, elektronik: 10, mobil: 300 },
    use: { batubara: 50, sawit: 5, beras: 8.5, gandum: 3, kedelai: 0.7, gula: 1.8, daging: 180, bbm: 110, gas: 2, tekstil: 200, elektronik: 15, mobil: 250,
           farmasi: 30, mesin: 20, semikonduktor: 5, karet: 0.2, kopi: 70, baja: 4, tembaga: 60, kakao: 10, baterai: 5 },
    plus: ['Produsen sawit & nikel terbesar dunia', 'Cadangan batu bara besar, biaya tambang murah', 'Pasar domestik besar (278 juta jiwa)', 'Posisi strategis di Selat Malaka'],
    minus: ['Net importir BBM, gandum, gula & kedelai', 'Teknologi & infrastruktur masih tertinggal', 'Rentan El Niño dan bencana alam', 'Sawit terancam regulasi deforestasi Uni Eropa'],
  },
  usa: {
    name: 'Amerika Serikat', region: 'NAM', diff: 'Mudah',
    cur: { code: 'USD', name: 'Dolar AS', rate: 1, int: 4.5, depth: 0, vol: 0 },
    pop: 335, gdp: 28000000, hdi: 0.927, tech: 95, infra: 80, stab: 62, inf: 3.0, infTarget: 2.2, debt: 122, ratingTarget: 80,
    budget: { tax: 19, rutin: 13, infra: 1.5, edu: 2, health: 6, rnd: 0.8 },
    growth: 2.2, popGrowth: 0.5, tariff: 0.12, special: { baja: 0.5, mobil: 0.25, gula: 0.3 }, buyerRisk: 0.01, strict: 0.6,
    costF: { minyak: 0.55, gas: 0.45 },
    prod: { minyak: 1100, gas: 60, batubara: 130, bijihbesi: 12, tembaga: 300, gandum: 12, kedelai: 30, gula: 2, daging: 3200, beras: 2.5, bbm: 1600, baja: 20,
            elektronik: 60, semikonduktor: 60, mobil: 2500, mesin: 400, farmasi: 500, baterai: 150, tekstil: 300 },
    use: { gas: 50, batubara: 100, bbm: 1650, gandum: 8, kedelai: 16, gula: 2.8, daging: 3100, beras: 1.2, kopi: 400, kakao: 200, karet: 0.25, sawit: 0.6, baja: 25,
           elektronik: 120, semikonduktor: 45, mobil: 3900, mesin: 450, farmasi: 480, tekstil: 1500, baterai: 200, tembaga: 450 },
    plus: ['Pemimpin teknologi & semikonduktor dunia', 'Dolar = mata uang cadangan dunia (utang murah)', 'Produsen minyak, gas & kedelai terbesar', 'Pasar konsumen terbesar di dunia'],
    minus: ['Utang pemerintah sangat tinggi (>120% PDB)', 'Defisit perdagangan barang kronis', 'Polarisasi politik (stabilitas sedang)', 'Sering terlibat perang dagang'],
  },
  chn: {
    name: 'Tiongkok', region: 'EAS', diff: 'Sedang',
    cur: { code: 'CNY', name: 'Yuan', rate: 7.2, int: 3.0, depth: 400000, vol: 1.5 },
    pop: 1410, gdp: 18500000, hdi: 0.788, tech: 82, infra: 85, stab: 70, inf: 0.5, infTarget: 2, debt: 85, ratingTarget: 68,
    budget: { tax: 20, rutin: 12, infra: 4, edu: 3.5, health: 2, rnd: 2.5 },
    growth: 4.8, popGrowth: -0.1, tariff: 0.075, special: { gandum: 0.2, gula: 0.5 }, buyerRisk: 0.02, strict: 0.35,
    costF: {},
    prod: { batubara: 1150, bijihbesi: 60, minyak: 380, gas: 15, beras: 50, gandum: 34, kedelai: 5, gula: 2.5, daging: 1800, tembaga: 450, nikel: 5, karet: 0.2, kopi: 30,
            baja: 260, bbm: 1200, tekstil: 12000, elektronik: 800, semikonduktor: 90, mobil: 7500, mesin: 2500, farmasi: 600, baterai: 2000 },
    use: { batubara: 1250, gas: 30, beras: 52, gandum: 36, kedelai: 28, gula: 4, daging: 2500, tembaga: 1500, nikel: 10, sawit: 2.5, karet: 1.5, kopi: 60, kakao: 80,
           baja: 240, bbm: 1250, tekstil: 6000, elektronik: 450, semikonduktor: 150, mobil: 6500, mesin: 2000, farmasi: 650, baterai: 1200 },
    plus: ['"Pabrik dunia" — kapasitas industri raksasa', 'Dominan di baterai EV, baja & elektronik', 'Infrastruktur sangat maju', 'Cadangan devisa besar'],
    minus: ['Sangat bergantung impor bijih besi, minyak & kedelai', 'Populasi menua dan menyusut', 'Sering jadi sasaran tarif & tuduhan dumping', 'Pertumbuhan melambat'],
  },
  jpn: {
    name: 'Jepang', region: 'EAS', diff: 'Sedang',
    cur: { code: 'JPY', name: 'Yen', rate: 150, int: 0.5, depth: 300000, vol: 3.0 },
    pop: 124, gdp: 4100000, hdi: 0.920, tech: 88, infra: 90, stab: 80, inf: 2.5, infTarget: 2, debt: 250, ratingTarget: 66,
    budget: { tax: 19, rutin: 11, infra: 2.5, edu: 3, health: 4, rnd: 1.5 },
    growth: 0.8, popGrowth: -0.5, tariff: 0.04, special: { beras: 3.0, daging: 0.385, gandum: 0.4, gula: 0.5 }, buyerRisk: 0.01, strict: 0.9,
    costF: {},
    prod: { beras: 2, daging: 120, gula: 0.2, baja: 22, bbm: 300, elektronik: 100, semikonduktor: 40, mobil: 2100, mesin: 700, farmasi: 250, baterai: 150, tekstil: 50 },
    use: { gas: 16, batubara: 40, beras: 1.8, gandum: 1.5, kedelai: 0.9, gula: 0.45, daging: 330, kopi: 110, kakao: 50, sawit: 0.18, karet: 0.18, tembaga: 250,
           bbm: 320, baja: 16, elektronik: 80, semikonduktor: 30, mobil: 1150, mesin: 400, farmasi: 350, tekstil: 900, baterai: 100 },
    plus: ['Teknologi & manufaktur kelas dunia', 'Industri otomotif & mesin sangat kuat', 'Stabilitas politik tinggi', 'IPM tinggi'],
    minus: ['Hampir tidak punya sumber daya alam', 'Wajib impor minyak, gas, batu bara & bijih besi', 'Utang pemerintah ~250% PDB', 'Populasi menua & menyusut'],
  },
  deu: {
    name: 'Jerman', region: 'EUR', diff: 'Sedang',
    cur: { code: 'EUR', name: 'Euro', rate: 0.92, int: 3.0, depth: 600000, vol: 2.0 },
    pop: 84, gdp: 4500000, hdi: 0.950, tech: 88, infra: 85, stab: 78, inf: 2.3, infTarget: 2, debt: 63, ratingTarget: 90,
    budget: { tax: 38, rutin: 25, infra: 2.5, edu: 4.5, health: 7, rnd: 3.1 },
    growth: 0.6, popGrowth: 0.0, tariff: 0.05, special: { daging: 0.3, gula: 0.3, beras: 0.2 }, buyerRisk: 0.01, strict: 1.0,
    costF: {},
    prod: { batubara: 25, daging: 250, gandum: 5.5, gula: 1.1, baja: 9, bbm: 200, mobil: 1050, mesin: 900, farmasi: 500, elektronik: 40, semikonduktor: 10, baterai: 100, tekstil: 100 },
    use: { gas: 20, batubara: 30, gandum: 4, kedelai: 1, gula: 0.8, beras: 0.12, daging: 280, kopi: 300, kakao: 120, sawit: 1.5, karet: 0.06, tembaga: 300,
           bbm: 230, baja: 9, mobil: 700, mesin: 450, farmasi: 350, elektronik: 70, semikonduktor: 20, tekstil: 1200, baterai: 150 },
    plus: ['Eksportir mobil & mesin premium', 'Rating kredit AAA, utang murah', 'IPM & infrastruktur sangat tinggi', 'Bagian dari pasar tunggal Uni Eropa'],
    minus: ['Bergantung impor energi (gas & minyak)', 'Biaya tenaga kerja & pajak tinggi', 'Pertumbuhan ekonomi lambat', 'Standar impor sangat ketat'],
  },
  gbr: {
    name: 'Inggris', region: 'EUR', diff: 'Sedang',
    cur: { code: 'GBP', name: 'Pound', rate: 0.79, int: 4.5, depth: 350000, vol: 2.2 },
    pop: 68, gdp: 3300000, hdi: 0.940, tech: 82, infra: 78, stab: 70, inf: 3.0, infTarget: 2, debt: 100, ratingTarget: 78,
    budget: { tax: 33, rutin: 22, infra: 2, edu: 4, health: 8, rnd: 1.7 },
    growth: 1.0, popGrowth: 0.4, tariff: 0.04, special: { daging: 0.2 }, buyerRisk: 0.01, strict: 0.9,
    costF: {},
    prod: { minyak: 75, gas: 8, gandum: 3.5, daging: 220, gula: 0.25, bbm: 90, mobil: 230, mesin: 300, farmasi: 450, semikonduktor: 5, elektronik: 10, baja: 1.5, tekstil: 50 },
    use: { gas: 18, batubara: 2, bbm: 140, gandum: 3.8, beras: 0.2, kedelai: 0.3, gula: 0.5, daging: 300, kopi: 60, kakao: 100, sawit: 0.4, tembaga: 60,
           baja: 2.5, mobil: 450, mesin: 300, farmasi: 320, elektronik: 60, semikonduktor: 10, tekstil: 900, baterai: 60 },
    plus: ['Pusat keuangan global (London)', 'Industri farmasi kuat', 'IPM tinggi', 'Minyak & gas Laut Utara'],
    minus: ['Pasca-Brexit: akses pasar Eropa berkurang', 'Produksi pangan terbatas', 'Utang ~100% PDB', 'Industri manufaktur menyusut'],
  },
  ind: {
    name: 'India', region: 'SAS', diff: 'Sangat Sulit',
    cur: { code: 'INR', name: 'Rupee', rate: 83, int: 6.5, depth: 60000, vol: 2.5 },
    pop: 1430, gdp: 3900000, hdi: 0.644, tech: 55, infra: 55, stab: 60, inf: 5.0, infTarget: 4.5, debt: 83, ratingTarget: 56,
    budget: { tax: 18, rutin: 11, infra: 3.3, edu: 4, health: 1.8, rnd: 0.7 },
    growth: 6.5, popGrowth: 0.8, tariff: 0.15, special: { gandum: 0.4, sawit: 0.275, mobil: 0.7, beras: 0.7 }, buyerRisk: 0.03, strict: 0.4,
    costF: {},
    prod: { batubara: 250, bijihbesi: 70, beras: 34, gandum: 27, gula: 9, kedelai: 3, daging: 1100, kopi: 90, tembaga: 150, minyak: 55, karet: 0.2,
            bbm: 400, baja: 36, tekstil: 3000, farmasi: 700, elektronik: 80, mobil: 1200, mesin: 300, baterai: 20 },
    use: { batubara: 300, gas: 8, beras: 29, gandum: 27, kedelai: 3.5, gula: 7.3, daging: 700, sawit: 3, kopi: 30, kakao: 20, tembaga: 250, bbm: 380,
           baja: 34, tekstil: 2000, farmasi: 400, elektronik: 150, semikonduktor: 20, mobil: 1050, mesin: 400, baterai: 40, karet: 0.35 },
    plus: ['"Apotek dunia" — eksportir obat generik', 'Eksportir beras terbesar dunia', 'Pertumbuhan ekonomi tercepat di antara ekonomi besar', 'Tenaga kerja muda melimpah'],
    minus: ['PDB per kapita rendah, IPM rendah', 'Importir minyak & minyak sawit besar', 'Infrastruktur belum merata', 'Rentan inflasi pangan'],
  },
  bra: {
    name: 'Brasil', region: 'SAM', diff: 'Sulit',
    cur: { code: 'BRL', name: 'Real', rate: 5.0, int: 10.5, depth: 40000, vol: 4.0 },
    pop: 216, gdp: 2200000, hdi: 0.760, tech: 50, infra: 50, stab: 55, inf: 4.5, infTarget: 4, debt: 87, ratingTarget: 47,
    budget: { tax: 25, rutin: 18, infra: 1.5, edu: 5, health: 4, rnd: 1.2 },
    growth: 2.5, popGrowth: 0.5, tariff: 0.13, special: { mobil: 0.35 }, buyerRisk: 0.04, strict: 0.3,
    costF: { bijihbesi: 0.45 },
    prod: { bijihbesi: 100, minyak: 300, kedelai: 40, gula: 11, kopi: 900, kakao: 60, daging: 2700, beras: 2.7, gandum: 2.5, tembaga: 100, nikel: 1.5,
            bbm: 180, baja: 8, mobil: 600, mesin: 80, farmasi: 60, tekstil: 400, elektronik: 20 },
    use: { gas: 3, batubara: 5, kedelai: 14, gula: 3, kopi: 380, kakao: 60, daging: 2000, beras: 2.6, gandum: 3.2, bbm: 230, baja: 6, mobil: 550, mesin: 150,
           farmasi: 120, tekstil: 500, elektronik: 60, semikonduktor: 10, sawit: 0.25, karet: 0.12, tembaga: 100, baterai: 20 },
    plus: ['Raksasa agrikultur: kedelai, kopi, gula, daging', 'Bijih besi kualitas tinggi', 'Minyak lepas pantai (pre-salt)', 'Energi terbarukan melimpah'],
    minus: ['Jauh dari pasar Asia (ongkos kirim tinggi)', 'Suku bunga & inflasi tinggi', 'Birokrasi & pajak rumit', 'Kurs Real sangat fluktuatif'],
  },
  sau: {
    name: 'Arab Saudi', region: 'MEA', diff: 'Sedang',
    cur: { code: 'SAR', name: 'Riyal', rate: 3.75, int: 5.5, depth: 50000, vol: 0.2, peg: true },
    pop: 36, gdp: 1100000, hdi: 0.875, tech: 52, infra: 75, stab: 70, inf: 2.0, infTarget: 2, debt: 26, ratingTarget: 68,
    budget: { tax: 6, rutin: 18, infra: 3, edu: 5, health: 3, rnd: 0.5 },
    growth: 3.0, popGrowth: 1.5, tariff: 0.05, special: {}, buyerRisk: 0.02, strict: 0.5,
    costF: { minyak: 0.2 },
    prod: { minyak: 900, bbm: 300, gandum: 0.2, daging: 50, baja: 2.5, farmasi: 5 },
    use: { minyak: 60, bbm: 250, beras: 0.35, gandum: 1, kedelai: 0.4, gula: 0.4, daging: 250, kopi: 20, sawit: 0.1, baja: 3, mobil: 160, mesin: 80,
           farmasi: 60, elektronik: 20, semikonduktor: 3, tekstil: 300, tembaga: 20, baterai: 5 },
    plus: ['Cadangan minyak terbesar, biaya produksi termurah', 'Riyal dipatok ke dolar (kurs stabil)', 'Utang pemerintah rendah', 'Dana investasi negara besar'],
    minus: ['Ekonomi sangat bergantung minyak', 'Hampir semua pangan harus impor', 'Basis industri & teknologi sempit', 'Pajak rendah — APBN bergantung harga minyak'],
  },
  rus: {
    name: 'Rusia', region: 'EUR', diff: 'Sulit',
    cur: { code: 'RUB', name: 'Rubel', rate: 90, int: 16, depth: 20000, vol: 6.0 },
    pop: 144, gdp: 2000000, hdi: 0.821, tech: 60, infra: 60, stab: 55, inf: 8, infTarget: 5, debt: 20, ratingTarget: 30,
    budget: { tax: 20, rutin: 16, infra: 2, edu: 3.5, health: 3, rnd: 1 },
    growth: 1.5, popGrowth: -0.3, tariff: 0.07, special: {}, buyerRisk: 0.06, strict: 0.3, sanctioned: true,
    costF: { minyak: 0.4, gas: 0.35 },
    prod: { minyak: 900, gas: 25, batubara: 110, bijihbesi: 25, gandum: 22, gula: 1.6, nikel: 5, tembaga: 220, daging: 450, bbm: 500, baja: 19, mesin: 50, mobil: 180, farmasi: 40 },
    use: { minyak: 0, gas: 5, batubara: 60, gandum: 11, beras: 0.3, kedelai: 1.5, gula: 1.7, daging: 500, kopi: 60, kakao: 40, sawit: 0.3, karet: 0.08, bbm: 330,
           baja: 12, mobil: 300, mesin: 200, farmasi: 100, elektronik: 80, semikonduktor: 15, tekstil: 500, tembaga: 100, baterai: 5 },
    plus: ['Kaya energi: minyak, gas & batu bara', 'Eksportir gandum terbesar dunia', 'Utang pemerintah rendah', 'Nikel & tembaga melimpah'],
    minus: ['Terkena sanksi Barat — akses pasar & pembayaran terbatas', 'Rubel sangat volatil, inflasi tinggi', 'Rating kredit sangat rendah', 'Impor teknologi & chip sulit'],
  },
  aus: {
    name: 'Australia', region: 'OCE', diff: 'Mudah',
    cur: { code: 'AUD', name: 'Dolar Australia', rate: 1.52, int: 4.35, depth: 150000, vol: 3.0 },
    pop: 27, gdp: 1750000, hdi: 0.946, tech: 72, infra: 80, stab: 82, inf: 3.5, infTarget: 2.5, debt: 50, ratingTarget: 88,
    budget: { tax: 28, rutin: 17, infra: 3, edu: 4, health: 4.5, rnd: 1.8 },
    growth: 2.2, popGrowth: 1.2, tariff: 0.025, special: {}, buyerRisk: 0.01, strict: 0.9,
    costF: { bijihbesi: 0.4, batubara: 0.5 },
    prod: { bijihbesi: 230, batubara: 110, gas: 20, gandum: 9, gula: 1, daging: 600, nikel: 3, tembaga: 200, minyak: 25, bbm: 20, baja: 1.3, beras: 0.1 },
    use: { batubara: 25, gas: 10, gandum: 2, beras: 0.12, kedelai: 0.2, gula: 0.3, daging: 170, bbm: 90, kopi: 30, kakao: 15, sawit: 0.05, tembaga: 40, baja: 1.5,
           mobil: 280, mesin: 100, farmasi: 60, elektronik: 40, semikonduktor: 5, tekstil: 300, baterai: 20 },
    plus: ['Eksportir bijih besi & batu bara raksasa', 'Rating AAA, stabilitas sangat tinggi', 'IPM tertinggi di dunia', 'Dekat dengan pasar Asia'],
    minus: ['Industri manufaktur kecil', 'Ekonomi bergantung permintaan Tiongkok', 'Populasi kecil', 'Rentan kekeringan & kebakaran hutan'],
  },
  kor: {
    name: 'Korea Selatan', region: 'EAS', diff: 'Sedang',
    cur: { code: 'KRW', name: 'Won', rate: 1350, int: 3.25, depth: 100000, vol: 3.0 },
    pop: 52, gdp: 1700000, hdi: 0.929, tech: 90, infra: 85, stab: 72, inf: 2.5, infTarget: 2, debt: 55, ratingTarget: 78,
    budget: { tax: 20, rutin: 11, infra: 2, edu: 3.5, health: 3, rnd: 3 },
    growth: 2.2, popGrowth: -0.2, tariff: 0.08, special: { beras: 5.13, daging: 0.4 }, buyerRisk: 0.01, strict: 0.8,
    costF: {},
    prod: { beras: 1.1, daging: 70, baja: 17, bbm: 380, elektronik: 150, semikonduktor: 250, mobil: 1050, mesin: 250, farmasi: 60, baterai: 350, tekstil: 100 },
    use: { gas: 12, batubara: 30, beras: 1.0, gandum: 1.5, kedelai: 0.35, gula: 0.35, daging: 270, kopi: 45, kakao: 20, sawit: 0.1, karet: 0.1, tembaga: 180,
           bbm: 230, baja: 13, elektronik: 80, semikonduktor: 100, mobil: 450, mesin: 200, farmasi: 100, tekstil: 400, baterai: 100 },
    plus: ['Raksasa chip memori & elektronik', 'Industri baterai EV & mobil kuat', 'Belanja riset tertinggi di dunia (% PDB)', 'Tenaga kerja sangat terdidik'],
    minus: ['Nyaris tanpa sumber daya alam', 'Impor energi & bahan baku sangat besar', 'Tingkat kelahiran terendah di dunia', 'Terjepit rivalitas AS–Tiongkok'],
  },
  vnm: {
    name: 'Vietnam', region: 'SEA', diff: 'Sulit',
    cur: { code: 'VND', name: 'Dong', rate: 25000, int: 4.5, depth: 10000, vol: 1.5 },
    pop: 100, gdp: 430000, hdi: 0.726, tech: 45, infra: 55, stab: 70, inf: 3.5, infTarget: 3.5, debt: 37, ratingTarget: 50,
    budget: { tax: 16, rutin: 10, infra: 3.5, edu: 3.5, health: 1.5, rnd: 0.5 },
    growth: 6.0, popGrowth: 0.7, tariff: 0.09, special: {}, buyerRisk: 0.03, strict: 0.3,
    costF: {},
    prod: { beras: 11, kopi: 450, karet: 0.35, batubara: 12, minyak: 20, daging: 60, gula: 0.3, elektronik: 200, tekstil: 1600, baja: 5, bbm: 40, mesin: 10 },
    use: { beras: 5.5, kopi: 80, karet: 0.1, batubara: 25, bbm: 60, gandum: 1.2, kedelai: 0.6, gula: 0.6, daging: 120, tembaga: 100, elektronik: 40,
           semikonduktor: 60, mobil: 100, mesin: 80, farmasi: 40, tekstil: 400, baja: 7, sawit: 0.2, kakao: 5, baterai: 5 },
    plus: ['Basis perakitan elektronik (Samsung dll.)', 'Eksportir beras & kopi robusta top dunia', 'Pertumbuhan tinggi, upah kompetitif', 'Banyak perjanjian dagang bebas'],
    minus: ['PDB per kapita masih rendah', 'Bergantung komponen impor', 'Infrastruktur logistik terbatas', 'Rentan banjir & perubahan iklim'],
  },
  nga: {
    name: 'Nigeria', region: 'AFR', diff: 'Sangat Sulit',
    cur: { code: 'NGN', name: 'Naira', rate: 1500, int: 22, depth: 3000, vol: 10.0 },
    pop: 225, gdp: 400000, hdi: 0.548, tech: 22, infra: 25, stab: 35, inf: 25, infTarget: 15, debt: 45, ratingTarget: 38,
    budget: { tax: 7, rutin: 6, infra: 1.5, edu: 1.2, health: 0.8, rnd: 0.1 },
    growth: 3.0, popGrowth: 2.4, tariff: 0.12, special: { beras: 0.6 }, buyerRisk: 0.12, strict: 0.2,
    costF: { minyak: 0.5 },
    prod: { minyak: 130, gas: 5, kakao: 70, beras: 2, daging: 90, gula: 0.03, bbm: 30, tekstil: 50 },
    use: { bbm: 70, beras: 2.8, gandum: 1.6, kedelai: 0.2, gula: 0.5, daging: 110, sawit: 0.4, kopi: 5, farmasi: 40, mobil: 60, mesin: 30, elektronik: 30,
           tekstil: 300, baja: 2, semikonduktor: 1, tembaga: 5, gas: 2, batubara: 1, baterai: 1 },
    plus: ['Produsen minyak terbesar di Afrika', 'Populasi terbesar Afrika, sangat muda', 'Eksportir kakao', 'Potensi pertumbuhan besar'],
    minus: ['Inflasi sangat tinggi, Naira sangat lemah', 'Infrastruktur & listrik buruk', 'Kilang minim — impor BBM besar', 'Pembajakan di Teluk Guinea, stabilitas rendah'],
  },
};

const COUNTRY_ORDER = ['idn', 'usa', 'chn', 'jpn', 'deu', 'gbr', 'kor', 'ind', 'vnm', 'aus', 'sau', 'bra', 'rus', 'nga'];

// Hubungan diplomatik awal (default 55)
const RELATIONS = {
  'usa-chn': 25, 'usa-rus': 5, 'usa-jpn': 85, 'usa-kor': 85, 'usa-gbr': 90, 'usa-aus': 88, 'usa-deu': 80, 'usa-sau': 65, 'usa-ind': 65, 'usa-vnm': 60, 'usa-idn': 60, 'usa-bra': 55, 'usa-nga': 55,
  'chn-rus': 80, 'chn-jpn': 30, 'chn-kor': 50, 'chn-ind': 35, 'chn-aus': 40, 'chn-vnm': 45, 'chn-idn': 62, 'chn-bra': 70, 'chn-nga': 65, 'chn-sau': 65, 'chn-gbr': 40, 'chn-deu': 55,
  'rus-deu': 12, 'rus-gbr': 10, 'rus-jpn': 20, 'rus-kor': 25, 'rus-aus': 15, 'rus-ind': 72, 'rus-vnm': 65, 'rus-idn': 55, 'rus-sau': 60, 'rus-bra': 60,
  'jpn-kor': 50, 'jpn-idn': 72, 'jpn-aus': 78, 'jpn-deu': 70, 'jpn-gbr': 72, 'jpn-vnm': 70, 'jpn-ind': 70,
  'deu-gbr': 72, 'gbr-aus': 85, 'kor-vnm': 72, 'kor-idn': 65, 'aus-idn': 58, 'ind-idn': 62, 'sau-idn': 70, 'ind-sau': 65, 'vnm-idn': 60, 'aus-kor': 70, 'deu-idn': 55,
};
function baseRelation(a, b) {
  return RELATIONS[a + '-' + b] ?? RELATIONS[b + '-' + a] ?? 55;
}
