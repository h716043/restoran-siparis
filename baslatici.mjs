/**
 * RESTORAN SİPARİŞ SİSTEMİ - TEK TIKLA BAŞLATICI (PORT 5439 + WHATSAPP SERVİSİ)
 * -----------------------------------------------------------------------------
 * Bu başlatıcı:
 * 1. WhatsApp QR & Bulut Bildirim Köprüsünü (Port 3001)
 * 2. Restoran Admin / Mutfak / Menü Sunucusunu (Port 5439)
 * aynı anda başlatır ve tarayıcıda Yönetici Panelini otomatik açar.
 */

import { spawn } from "node:child_process";
import http from "node:http";

const APP_PORT = 5439;
const noBrowserOpen = process.argv.includes("--no-open");

console.log("==================================================================");
console.log("  🍽️  RESTORAN SİPARİŞ & YÖNETİM SİSTEMİ BAŞLATILIYOR...");
console.log("==================================================================");
console.log(`  👉 Yönetici (Admin) Paneli : http://localhost:${APP_PORT}/admin`);
console.log(`  👉 Canlı Mutfak & Kasa     : http://localhost:${APP_PORT}/kitchen`);
console.log(`  👉 Yerel Müşteri Menüsü    : http://localhost:${APP_PORT}`);
console.log(`  👉 WhatsApp QR Köprüsü     : http://localhost:3001/send-message`);
console.log("==================================================================\n");

// 1. WhatsApp Köprü Servisini Başlat
const waProcess = spawn(process.execPath, ["whatsapp-bridge.mjs"], {
  stdio: "inherit",
  cwd: process.cwd(),
});

// 2. Next.js Sunucusunu Port 5439 üzerinde Başlat
const nextBin = "./node_modules/next/dist/bin/next";
const nextProcess = spawn(
  process.execPath,
  [nextBin, "dev", "-p", String(APP_PORT)],
  {
    stdio: "inherit",
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(APP_PORT),
    },
  }
);

// Sunucu hazır olduğunda tarayıcıda Admin panelini otomatik aç
if (!noBrowserOpen) {
  let opened = false;
  const checkServer = setInterval(() => {
    if (opened) {
      clearInterval(checkServer);
      return;
    }
    const req = http.get(`http://localhost:${APP_PORT}/api/settings`, (res) => {
      if (res.statusCode && res.statusCode < 500 && !opened) {
        opened = true;
        clearInterval(checkServer);
        console.log(
          `\n🌐 Sunucu hazır! Tarayıcıda Admin Paneli açılıyor: http://localhost:${APP_PORT}/admin\n`
        );
        if (process.platform === "win32") {
          spawn("cmd.exe", ["/c", "start", "", `http://localhost:${APP_PORT}/admin`], {
            stdio: "ignore",
            detached: true,
          }).unref();
        }
      }
    });
    req.on("error", () => {});
    req.end();
  }, 1500);
}

const cleanup = () => {
  try {
    waProcess.kill();
  } catch {}
  try {
    nextProcess.kill();
  } catch {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
