# Unslop — audit & direction

Pass dengan skill [unslop](https://github.com/heydamir/unslop) oleh Damir Sokolovsky (@heydamir), CC BY 4.0.

## Audit (versi 1)

**Tingkat: slop sedang–berat** → proses penuh 9 pass.

Permukaan & warna
- Latar washi krem (#F7F4EE) di seluruh aplikasi — `css/tokens.css`. Untuk app yang dipakai berjam-jam, permukaan harus netral.
- Dua aksen bersaing: merah (tombol, badge, meter, garis grup, angka countdown, ikon nav aktif) dan indigo (opsi terpilih, meter, tombol seksi aktif).
- Lingkaran dekoratif "enso" di hero — `.hero::after`.
- Hover kartu naik + bayangan membesar — `a.card:hover`.

Tipografi
- Label UPPERCASE ber-tracking lebar di hampir semua halaman — `.eyebrow` (home, exams, grammar, vocab, settings).
- Judul 700/800, angka besar Shippori 800 — `.h1`, `.countdown b`, `.exam-card .num`, `.fc-word`.
- Serif display dipakai untuk label kecil (nomor set, hitung kotak).

Ikon
- Ikon sparkle untuk "Akurasi" dan tombol kuis; ikon api untuk streak — `home.js`, `grammar.js`.
- Ikon di dalam kotak chip berwarna di daftar rekomendasi — `home.js`.
- Stroke 1.8 / 20px, bukan 1.5 / 16–18px.

Copy
- Sapaan "Selamat datang kembali" + slogan "Dari N4 ke N3, selangkah demi selangkah." yang cocok untuk produk apa pun.
- Tanda seru: "Kerja bagus! Sesi selesai.", "Mantap!", "Beres!", "お疲れさまでした！".
- Titik di akhir judul/label pendek.
- Angka tanpa pembanding ("Akurasi 0%").

Komponen & layout
- 4 kartu statistik identik, masing-masing dengan ikon.
- Dua kartu sama lebar berdampingan di beranda (template).
- Semua chip berbentuk pil, termasuk "2pt", "Salah", "Terbaik 64%".
- Kanji raksasa pudar (迷 誤 無 完) sebagai pengisi empty state.
- Konten dibatasi kolom sempit 880px di app.

Visual
- Tidak ada momen nyata; hero hanya teks + dekorasi.

## Arah (disetujui: versi "lebih gelap/dramatis")

- **Produk.** Meja latihan pribadi untuk lulus JLPT N3: ujian simulasi, tata bahasa, dan kartu kosakata, untuk pelajar Indonesia yang naik dari N4.
- **Karakter.** Tepat seperti ruang ujian, sabar, fokus di malam hari.
- **Dunia.** Malam sebelum ujian JLPT: meja gelap di bawah lampu belajar, lembar jawaban マークシート, pensil HB, kartu peserta 受験票, buku soal bercetak Mincho.
- **Momen.** (1) Kartu peserta 受験票 dari kertas hangat di beranda, satu-satunya benda terang di layar gelap, dibuat dengan kode: level N3, tanggal ujian, sisa hari, set yang selesai. (2) Grafik skor ujian simulasi per bagian terhadap batas lulus.
- **Signature.** Oval マークシート: nomor pilihan jawaban adalah oval tegak yang terisi grafit pensil saat dipilih; dipakai di opsi jawaban dan peta soal saja.

Token: ramp graphite gelap sebagai default (terang tetap tersedia), satu aksen kuning lampu `#F0B44C` (di tema terang `#9A6206` untuk teks), semantik hijau `#4CC38A` / merah `#E5484D`. Huruf: IBM Plex Sans JP (antarmuka), IBM Plex Mono (angka dan meta), Shippori Mincho 400–500 untuk teks soal, bacaan, dan judul besar. Easing tunggal `cubic-bezier(0.22, 1, 0.36, 1)`.
