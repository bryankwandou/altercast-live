# Blender 3D Archive & Interactive Catalog

Katalog interaktif modern untuk 188 aset model 3D Blender (total volume 5.40 GB / 163 model unik). Aplikasi web ini dilengkapi dengan interactive WebGL 3D Model Viewer, pencarian instan, filter kategori cerdas, mode gelap/terang terintegrasi, serta dukungan dua bahasa (Bahasa Indonesia dan English).

---

## Fitur Utama

- **Interactive 3D WebGL Viewer**: Pratinjau langsung model 3D di browser dengan rotasi orbital 360 derajat, kontrol auto-rotate, dan reset kamera.
- **Local File Drag & Drop Loader**: Pengguna dapat menarik file `.glb` atau `.gltf` apa pun langsung dari drive komputer ke dalam viewer untuk dirender instan pada performa 60 FPS tanpa perlu upload ke server.
- **Katalog Terindeks Penuh**: Menampilkan 188 file aset dengan kategori lengkap (Game Characters, Anime & Manga, Base Mesh & Anatomy, Props & Costumes, Environment & Scene, Stylized & Fantasy).
- **Pencarian & Pengurutan Real-Time**: Pencarian instan berdasarkan judul, nama file fisik, dan tag spesifik, disertai pengurutan berdasarkan abjad dan ukuran file.
- **Design System Silicon Valley**: Menggunakan token CSS terpusat (`tokens.css`), kontras WCAG 2.1 Level AA, touch-target minimum 44px, dan nol ikon dekoratif yang tidak fungsional.
- **Bilingual (ID / EN)**: Lokalisasi penuh antara Bahasa Indonesia dan English yang tersimpan secara persisten pada `localStorage`.
- **Dark & Light Mode**: Tema gelap dan terang yang responsif terhadap sistem operasi maupun tombol toggle manual.

---

## Struktur Proyek

```
blender-3d-catalog/
├── index.html                  # Halaman utama aplikasi web semantik
├── package.json                # Dependensi dan script build
├── vercel.json                 # Konfigurasi deployment Vercel
├── scripts/
│   └── generate-catalog.js     # Script pemindai direktori sumber E:\0download blender
├── public/
│   └── models/                 # Model sampel ringan untuk viewer awal
└── src/
    ├── main.js                 # Bootstrapper aplikasi
    ├── data/
    │   └── models.json         # Dataset metadata 188 file aset
    ├── scripts/
    │   ├── catalog.js          # Controller pencarian, filter, dan dialog spesifikasi
    │   ├── i18n.js             # Modul lokalisasi dua bahasa (ID & EN)
    │   └── viewer.js           # Modul kontrol 3D WebGL viewer
    └── styles/
        ├── tokens.css          # Design token (warna, tipografi, spacing, elevasi)
        └── main.css            # Stylesheet utama aplikasi responsif
```

---

## Menjalankan Secara Lokal

1. Pasang dependensi:
   ```bash
   npm install
   ```
2. Jalankan server pengembangan lokal:
   ```bash
   npm run dev
   ```
3. Bangun paket produksi:
   ```bash
   npm run build
   ```

---

## Deployment

Proyek ini telah dikonfigurasi untuk deployment ke:
- **GitHub**: Repositori kode sumber publik/privat via GitHub CLI (`gh`).
- **Vercel**: Deployment hosting statis performa tinggi via Vercel CLI atau GitHub Integration.
