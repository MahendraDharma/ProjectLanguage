# Project Brief — 道 Michi N3

> Disusun mengikuti loop **Define → Build → Review → Refine** dan artefak konteks dari
> skill `premium-saas-design` + `design-principles` (plugin `design-mastery`, LibreUIUX-Claude-Code).

## Apa yang dibangun
Web belajar pribadi untuk naik dari **JLPT N4 → N3**. Statis (tanpa server), jalan di GitHub Pages
atau `python3 -m http.server`. Semua progres disimpan di `localStorage` perangkat.

## Pengguna utama
- **Pembelajar N4 → N3** (pemilik repo): penutur Indonesia, nyaman dengan Inggris, belajar di laptop & HP,
  sesi pendek harian + simulasi ujian penuh menjelang tes.

## Tujuan (berurutan)
1. Latihan soal ujian N3 yang realistis dengan kunci jawaban & pembahasan.
2. Menyimulasikan ujian sesungguhnya (timer, skor per bagian, batas lulus 95/180, minimum 19/60).
3. Mengubah kesalahan menjadi bahan ulang: daftar kesalahan + kartu kosakata ber-SRS.
4. Referensi tata bahasa N3 (73 pola) yang cepat dicari.

## Bahasa antarmuka
Hanya tiga: **日本語 / Bahasa Indonesia / English**. Konten soal tetap bahasa Jepang (seperti ujian asli).

## Sumber materi
dethitiengnhat.com/en — 17 set ujian simulasi N3 (語彙, 文法・読解, 聴解) dan kamus tata bahasa N3.
Diambil dengan `scripts/scrape_dethitiengnhat.py`; setiap soal menyimpan URL sumbernya.

## Persyaratan
- Mobile-first, responsif, tanpa build step.
- Aksesibel (WCAG 2.1 AA): kontras ≥ 4.5:1, fokus terlihat, target sentuh ≥ 44px, `lang="ja"` pada teks Jepang.
- Mode gelap mengikuti sistem + toggle manual. Hormati `prefers-reduced-motion`.
- Listening tanpa file audio: dibacakan dengan Web Speech API (suara ja-JP), transkrip disembunyikan sampai menjawab.

## Halaman
1. Beranda (dasbor: hitung mundur, streak, skor terakhir, kartu jatuh tempo, lanjutkan)
2. Ujian (17 set × 3 bagian; mode Latihan / mode Ujian)
3. Tata Bahasa (daftar + detail, sembunyikan arti untuk latihan)
4. Kosakata (kartu flash SRS dari soal 語彙)
5. Ulasan Kesalahan
6. Pengaturan (bahasa, tema, tanggal ujian, furigana, suara, ekspor/impor progres)
