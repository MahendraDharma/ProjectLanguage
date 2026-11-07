# 道 Michi N3 — web belajar JLPT N3

Web statis untuk naik dari **JLPT N4 ke N3**. Antarmuka tersedia dalam tiga bahasa:
**日本語 / Bahasa Indonesia / English** (ganti lewat tombol di sidebar atau halaman Pengaturan).

## Fitur

| Halaman | Isi |
|---|---|
| **Beranda** | Hitung mundur ke tanggal ujian, streak harian, akurasi per bagian, rekomendasi belajar hari ini, hasil terakhir. |
| **Ujian** | 17 set ujian simulasi N3 × 3 bagian (文字・語彙, 文法・読解, 聴解) — ~1.690 soal dengan kunci jawaban. **Mode Latihan**: jawaban langsung dinilai + pembahasan. **Mode Ujian**: timer resmi (30/70/40 menit), dinilai di akhir. **Rapor lengkap**: skor 0–60 per bagian, total /180, cap 合格 jika ≥ 95 dan tiap bagian ≥ 19. |
| **Mendengarkan** | Tidak ada file audio di sumber, jadi transkrip dibacakan oleh suara Jepang perangkat (Web Speech API) dengan nada berbeda untuk 男/女. Transkrip baru terlihat setelah menjawab. |
| **Tata bahasa** | 73 pola N3: arti (ID/EN), pembentukan, penjelasan, contoh dengan furigana, mode sembunyikan arti/terjemahan, tandai "sudah hafal", kuis 10 soal. |
| **Kosakata** | ~594 kartu flash dibuat otomatis dari soal 語彙 (cara baca, penulisan kanji, konteks, sinonim, penggunaan), diulang dengan sistem Leitner. Pintasan keyboard: `Space` balik, `1/2/3` nilai. |
| **Kesalahan** | Setiap soal yang salah masuk ke sini; kerjakan ulang, dan soal hilang setelah dijawab benar. |
| **Pengaturan** | Bahasa, tema terang/gelap/otomatis, tanggal ujian, target kartu harian, furigana, suara & kecepatan TTS, ekspor/impor progres (JSON). |

Progres disimpan di `localStorage` browser — gunakan Ekspor/Impor untuk pindah perangkat.

## Menjalankan

Tidak perlu build. Karena data dimuat dengan `fetch`, buka lewat server lokal (bukan `file://`):

```bash
python3 -m http.server 8000
```

Lalu buka http://localhost:8000. Untuk online: aktifkan **GitHub Pages** (Settings → Pages → Deploy from branch → root).

> Listening membutuhkan suara bahasa Jepang di perangkat. Chrome/Edge/Safari umumnya sudah punya;
> di Windows/Android tambahkan "Japanese" di pengaturan text-to-speech jika belum ada.

## Materi

Soal ujian simulasi dan kamus tata bahasa diambil dari [dethitiengnhat.com/en](https://dethitiengnhat.com/en)
untuk belajar pribadi; setiap bagian ujian dan pola tata bahasa menyimpan tautan ke halaman sumbernya.
Arti tata bahasa dalam Bahasa Indonesia (`data/grammar.id.json`) diterjemahkan khusus untuk proyek ini.

Memperbarui data:

```bash
pip install beautifulsoup4 lxml pillow
python3 scripts/scrape_dethitiengnhat.py          # semua (pakai cache di .cache/)
python3 scripts/scrape_dethitiengnhat.py --no-cache --only exams
```

## Desain

Dibuat dengan alur **Define → Build → Review → Refine** dari plugin `design-mastery`
([LibreUIUX-Claude-Code](https://github.com/Ormus-Solutions/LibreUIUX-Claude-Code)):
skill `premium-saas-design` (artefak konteks), `design-principles` (hierarki, Gestalt, kontras WCAG)
dan `design-movements` (Swiss International Style). Arah visual: grid Swiss × 間 (ruang kosong),
kertas washi, tinta sumi, satu aksen merah cap hanko. Lihat `docs/design/`.

## Struktur

```
index.html            shell aplikasi
css/tokens.css        token warna/tipografi/spasi (terang & gelap)
css/app.css           komponen & layout responsif
js/app.js             router hash + navigasi
js/i18n.js            string UI (ja / id / en)
js/store.js           progres di localStorage
js/data.js            pemuatan data, skor, kartu kosakata
js/tts.js             listening via Web Speech API
js/srs.js             spaced repetition (Leitner)
js/views/*.js         halaman
data/exams/*.json     17 ujian N3
data/grammar*.json    73 pola tata bahasa N3
assets/img/           gambar soal (WebP)
scripts/              scraper
docs/design/          project brief & style guide
```
