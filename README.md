# Ekspor Impor: Menuju Negara Maju

Game teks simulasi perdagangan internasional. Pilih satu dari 14 negara nyata, kelola ekspor-impor, industri, APBN, utang, dan valas, lalu bawa negaramu menjadi **negara maju #1 dunia**.

## Isi game

- **14 negara** dengan data kira-kira sesuai kenyataan: Indonesia, AS, Tiongkok, Jepang, Jerman, Inggris, Korea Selatan, India, Vietnam, Australia, Arab Saudi, Brasil, Rusia, Nigeria. Masing-masing punya kelebihan, kekurangan, dan tingkat kesulitan sendiri.
- **24 komoditas**: minyak, gas, batu bara, nikel, sawit, kopi, beras, gandum, baja, mobil, chip, baterai EV, dan lainnya.
- **Perdagangan**: ekspor/impor langsung ke negara tertentu (dengan tarif, ongkos kirim, dan kuota pasar), pasar spot, kontrak jangka panjang, serta pilihan pembayaran L/C, T/T, atau Open Account, ditambah asuransi kargo.
- **Masalah dunia nyata**: pembeli gagal bayar, kapal tenggelam atau dibajak, barang ditolak karena mutu, kemacetan pelabuhan, pungli, penipuan, tuduhan dumping, perang dagang, sanksi sekunder, regulasi EUDR, El Niño, krisis keuangan, pandemi, dan lainnya.
- **Pemodalan**: pajak, obligasi negara (bunganya ikut rating kredit), Bank Dunia, bailout IMF, dan cetak uang (memicu inflasi).
- **Industri**: bangun pabrik (hilirisasi), perluas tambang/lahan, Kawasan Ekonomi Khusus, dan larangan ekspor bahan mentah.
- **Forex**: trading valas sederhana berbasis permintaan dan penawaran, plus bunga.
- **Menang**: skor ≥ 97 dan peringkat #1 selama 4 kuartal berturut-turut. **Kalah**: bangkrut (gagal bayar 4 kuartal) atau pemerintahan jatuh.

Permainan tersimpan otomatis di perangkat.

## Struktur

```
www/            ← seluruh game (HTML/CSS/JS, tanpa library)
  js/data.js    ← data negara, komoditas, industri
  js/engine.js  ← logika ekonomi
  js/ui.js      ← tampilan
android/        ← proyek Android (Capacitor)
```

## Mencoba di komputer

Buka `www/index.html` di browser, atau jalankan server lokal:

```bash
npx serve www
```

## Membuat APK

### Cara 1 — GitHub Actions (tanpa install Android Studio)

1. Upload folder ini ke repository GitHub.
2. Buka tab **Actions** → **Build APK** → **Run workflow**.
3. Setelah selesai (~5 menit), unduh artifact **EksporImpor-apk**. Isinya `app-debug.apk`, yang bisa langsung dipasang di HP Android (izinkan "instal dari sumber tidak dikenal").

### Cara 2 — Build lokal

Butuh **JDK 21** dan **Android Studio** (Android SDK).

```bash
npm install
npx cap sync android
npx cap open android
```

Di Android Studio: **Build → Build App Bundle(s)/APK(s) → Build APK(s)**.

Setiap kali mengubah file di `www/`, jalankan `npx cap sync android` lagi.
