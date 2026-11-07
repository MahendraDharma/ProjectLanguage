# 道 Michi — web belajar bahasa (JLPT N5–N1)

Web statis untuk berlatih bahasa. Kursus pertama: **bahasa Jepang, JLPT N5 sampai N1**. Struktur
datanya `data/<kursus>/<level>/`, jadi bahasa lain bisa ditambahkan sebagai kursus baru.
Antarmuka tersedia dalam tiga bahasa: **日本語 / Bahasa Indonesia / English**.

## Materi per level

| Level | Tes | Soal | Tata bahasa | Catatan |
|---|---|---|---|---|
| N5 | 2 tes latihan + 10 tes OpenJLPT | 659 | 61 pola | tes OpenJLPT dibuat otomatis (kosakata & tata bahasa) |
| N4 | 2 tes latihan + 10 tes OpenJLPT | 640 | 80 pola | tes OpenJLPT dibuat otomatis (kosakata & tata bahasa) |
| N3 | 17 ujian simulasi + 2 tes latihan | 1.896 | 73 pola | |
| N2 | 15 ujian simulasi | 1.535 | 141 pola | |
| N1 | 7 ujian simulasi | 628 | 172 pola | 2 set tanpa bagian mendengarkan di sumber |

Semua 527 pola tata bahasa punya arti dalam Bahasa Indonesia (`data/ja/<level>/grammar.id.json`,
diterjemahkan untuk proyek ini). Penjelasan dan terjemahan contoh kalimat berbahasa Inggris dari sumber.

## Fitur

| Halaman | Isi |
|---|---|
| **Beranda** | Kartu peserta 受験票 level aktif (tanggal ujian, sisa hari, set selesai), statistik, grafik skor terhadap batas lulus level itu, rekomendasi hari ini. |
| **Ujian** | Tiga bagian per tes. **Mode Latihan** langsung dinilai + pembahasan; **Mode Ujian** memakai waktu resmi per level dan dinilai di akhir. **Rapor lengkap** memakai aturan JLPT tiap level (lihat di bawah). |
| **Mendengarkan** | Sumber tidak menyediakan audio, jadi transkrip dibacakan suara Jepang perangkat (Web Speech API). |
| **Tata bahasa** | Pola per level: arti (ID/EN), pembentukan, penjelasan, contoh berfurigana, kuis. |
| **Kosakata** | Kartu flash dari soal kosakata level itu (cara baca, penulisan, konteks, sinonim, penggunaan), sistem Leitner. |
| **Kesalahan** | Soal yang salah dari semua level; hilang setelah dijawab benar. |
| **Pengaturan** | Level, bahasa, tema, tanggal ujian, target kartu harian, furigana, suara TTS, ekspor/impor progres. |

Ganti level lewat pemilih N5–N1 di sidebar (desktop) atau di atas halaman (HP).

### Penilaian per level

| Level | Batas lulus | Bagian (nilai minimum) | Waktu (kosakata / bagian 2 / mendengarkan) |
|---|---|---|---|
| N1 | 100/180 | Bahasa 19/60 · Membaca 19/60 · Mendengarkan 19/60 | 50 / 60 / 55 menit* |
| N2 | 90/180 | sama seperti N1 | 40 / 65 / 50 menit* |
| N3 | 95/180 | sama seperti N1 | 30 / 70 / 40 menit |
| N4 | 90/180 | Bahasa & Membaca 38/120 · Mendengarkan 19/60 | 25 / 55 / 35 menit |
| N5 | 80/180 | sama seperti N4 | 20 / 40 / 30 menit |

\* Di N1/N2, kosakata+tata bahasa dan membaca adalah satu kertas (110/105 menit); pembagiannya di sini perkiraan.
Skor dikonversi dari proporsi poin, jadi perkiraan, bukan skor resmi JLPT.

Progres disimpan di `localStorage` browser. Progres dari versi N3-saja otomatis dipindahkan ke format baru.

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
Arti tata bahasa dalam Bahasa Indonesia (`data/ja/<level>/grammar.id.json`) diterjemahkan khusus untuk proyek ini.

### Soal OpenJLPT (N5, N4)

Karena situs sumber hanya punya 2 tes latihan untuk N5 dan N4, ada 10 tes tambahan per level yang
dibuat otomatis dari dataset [OpenJLPT](https://github.com/evanclan/OpenJLPT) (CC BY-SA 4.0; memakai
JMdict/KANJIDIC2 dari EDRDG, daftar JLPT Jonathan Waller, dan kalimat Tatoeba). Tiap tes berisi 47 soal:
cara baca kanji, penulisan kanji, kata dalam konteks, arti kata (pilihan dalam bahasa Inggris), dan isian
tata bahasa dari kalimat contoh. Tidak ada soal membaca panjang dan mendengarkan. Karena dibuat otomatis,
sesekali ada soal dengan dua jawaban yang wajar. File-file ini dirilis dengan lisensi CC BY-SA 4.0, lihat
`data/ja/LICENSE-openjlpt.md`.

Memperbarui data:

```bash
pip install beautifulsoup4 lxml pillow
python3 scripts/scrape_dethitiengnhat.py                 # semua level (pakai cache di .cache/)
python3 scripts/scrape_dethitiengnhat.py --levels N3 --only exams
python3 scripts/build_openjlpt_tests.py                    # tes OpenJLPT N5/N4
```

## Desain

Versi pertama dibuat dengan alur **Define → Build → Review → Refine** dari plugin `design-mastery`
([LibreUIUX-Claude-Code](https://github.com/Ormus-Solutions/LibreUIUX-Claude-Code)).

Versi sekarang dibangun ulang dengan skill **[unslop](https://github.com/heydamir/unslop)** oleh
Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0: audit tanda-tanda "AI slop", lalu
sembilan pass (spasi, warna, ikon, copy, huruf, layout, detail, visual, gerak). Arahnya "malam sebelum ujian":
abu-abu gelap yang tenang (tema terang tetap ada), satu aksen kuning lampu meja, teks soal dicetak huruf
Mincho seperti buku soal asli, kartu peserta 受験票 dari kertas sebagai satu-satunya benda terang di beranda,
dan oval lembar jawaban マークシート sebagai detail khas. Audit dan arah lengkap ada di `docs/design/03-unslop-audit.md`.

## Struktur

```
index.html            shell aplikasi
css/tokens.css        token warna/tipografi/spasi (terang & gelap)
css/app.css           komponen & layout responsif
js/app.js             router hash + navigasi + pemilih level
js/courses.js         kursus & level: waktu, aturan penilaian, label bagian
js/i18n.js            string UI (ja / id / en)
js/store.js           progres di localStorage (+ migrasi dari versi N3-saja)
js/data.js            pemuatan data, skor, kartu kosakata
js/tts.js             listening via Web Speech API
js/srs.js             spaced repetition (Leitner)
js/views/*.js         halaman
data/courses.json     ringkasan kursus dan level
data/ja/<L>/exams/    tes per level (index.json + <id>.json, "t1" = tes latihan)
data/ja/<L>/grammar*.json  pola tata bahasa + arti Bahasa Indonesia
assets/img/ja/<L>/    gambar soal (WebP)
scripts/              scraper
docs/design/          project brief & style guide
```
