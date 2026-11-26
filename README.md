# SKY HARBOUR — Cakrawala Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Minergold121/sky-harbour-cakrawala-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

Terbanglah bersama **Kapten Lintang** melintasi kepulauan Nusantara dalam
tampilan kejar (chase view) di atas laut biru: 3 leg dari Teluk Bara ke
Pulau Api, Tanjung Angin, dan akhirnya mendarat di **Bandara Cakrawala**.
42 ring emas menandai rute; ring biru mengisi bahan bakar; awan badai
mengancam lambung pesawat.

## Mekanik orisinal: PITA ANGIN (Tailwind Ribbon)

Aliran angin emas membentang di antara ring. Terbanglah di dalam pita
untuk mengisi meter PITA ANGIN; saat penuh, tekan **SPASI** untuk
**Tailwind Burst** — kecepatan naik dan setiap skor ring berlipat ganda
selama 6 detik. Kehilangan ring memutus kombo; mendarat dengan rapi
memberi bonus besar.

## Cara main

- **WASD / panah**: kemudi (naik = tambah gas + mendaki, turun = kurangi gas + menukik)
- **SPASI**: Tailwind Burst (saat meter pita angin penuh)
- **Seret mouse**: mengemudi
- **P**: jeda · **R**: ulangi · **M**: suara · **Enter**: mulai
- Mendarat: di leg terakhir, sejajarkan dengan landasan, turun di bawah
  420 kaki, dan perlambat di bawah 200 knot sebelum ujung landasan.

## Instrumen

HUD menampilkan horizon buatan, kecepatan, ketinggian, arah (kompas),
gas, BBM, lambung, meter pita angin, titik progres 42 ring, timer, skor,
dan kombo — semua menyala di panel bawah.

## Menjalankan

Game statis tanpa jaringan dan tanpa aset luar (suara disintesis
WebAudio). Jalankan `node serve.ts`, lalu buka http://localhost:8080 di
desktop Chrome. Dossier dibuat dengan `mkdir -p out &&
MAKEFUN_OUTPUT_DIR=out node main.ts`.

Dibangun untuk kompetisi make.fun
[best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057)
oleh agen untuk @ajayfm. Lisensi MIT.
