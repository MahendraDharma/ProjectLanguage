# Style Guide — 道 Michi N3 (living document)

## Filosofi desain
**Swiss International Style × 間 (ma).** Grid yang tegas dan rata kiri (Swiss), ruang kosong yang
lega (ma), kertas washi + tinta sumi, satu aksen merah cap *hanko* (朱 shu). Satu fokus per layar:
saat mengerjakan soal, hanya soal yang terlihat.

## Warna (token di `css/tokens.css`)
| Token | Terang | Gelap | Pakai |
|---|---|---|---|
| `--bg` | #F7F4EE washi | #15161A | latar halaman |
| `--surface` | #FFFFFF | #1E2026 | kartu |
| `--surface-2` | #EFEBE3 | #262932 | area sekunder, chip |
| `--line` | #E2DCD0 | #343844 | border 1px |
| `--ink` | #1B1B1F sumi | #ECEAE4 | teks utama (16.8:1) |
| `--ink-2` | #5A5A63 | #A6A8B2 | teks sekunder (≥ 6:1) |
| `--shu` | #C8372D | #F0675B | aksen/aksi utama, cap |
| `--ai` | #27408B indigo | #8EA6F0 | tautan, info, progres |
| `--ok` | #2E7D4F | #5BC48A | benar |
| `--ng` | #B3261E | #F2857C | salah |
| `--warn` | #A15C00 | #E8A33D | timer hampir habis |

DO: merah hanya untuk satu aksi utama per layar & status. DON'T: gradien ramai, bayangan berlapis.

## Tipografi
- Display JP: **Shippori Mincho** 600/800 (judul, kanji besar di kartu)
- UI & body: **Inter** + **Noto Sans JP** (400/500/700)
- Skala (1.25): 12 · 14 · 16 · 20 · 25 · 31 · 39 · 49 px. Body soal JP 18px / 1.9 line-height.

## Spasi (basis 4px)
4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Dalam grup 8, antar-grup 24–32, antar-seksi 48–64.

## Radius & elevasi
`--r-sm 6px` (chip), `--r-md 10px` (tombol, opsi), `--r-lg 16px` (kartu). Bayangan tunggal tipis
`0 1px 2px rgba(0,0,0,.04), 0 4px 16px rgba(0,0,0,.04)`; hover naik 1px.

## Gerak
120ms (hover), 200ms (panel), easing `cubic-bezier(.2,.7,.2,1)`. Flip kartu 300ms. Semua dimatikan
pada `prefers-reduced-motion`.

## Pola komponen
- **Opsi jawaban**: baris penuh, nomor dalam lingkaran, border 1px; terpilih = border indigo 2px;
  benar = latar hijau lembut + ✓; salah = merah lembut + ✕.
- **Cap hanko**: lingkaran merah berputar −8° untuk hasil LULUS / 合格.
- **Navigasi**: sidebar kiri (desktop) → tab bar bawah (mobile, 5 item).
- **Fokus**: outline 2px `--ai` offset 2px.
