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
import https from "node:https";

const APP_PORT = 5439;
const noBrowserOpen = process.argv.includes("--no-open");

function checkAlreadyRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${APP_PORT}/api/settings`, (res) => {
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function openBrowser() {
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", `http://localhost:${APP_PORT}/admin`], {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    }).unref();
  }
}

const alreadyRunning = await checkAlreadyRunning();
if (alreadyRunning) {
  console.log(`✅ Sistem zaten arka planda çalışıyor (Port ${APP_PORT}).`);
  if (!noBrowserOpen) {
    openBrowser();
  }
  process.exit(0);
}

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
  windowsHide: true,
});

// 2. Next.js Sunucusunu Port 5439 üzerinde Başlat
const nextBin = "./node_modules/next/dist/bin/next";
const nextProcess = spawn(
  process.execPath,
  [nextBin, "dev", "-p", String(APP_PORT)],
  {
    stdio: "inherit",
    cwd: process.cwd(),
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(APP_PORT),
    },
  }
);

// Sunucu hazır olduğunda tüm ekranları arka planda önceden ısıt (Pre-Warm) ve tarayıcıda Admin panelini otomatik aç
function preWarmAllRoutes() {
  const routes = [
    "/api/menu",
    "/api/orders?publicTv=1",
    "/api/table-calls",
    "/api/caller-id",
    "/admin",
    "/kitchen",
    "/waiter",
    "/courier",
    "/tv",
    "/",
  ];
  routes.forEach((route, idx) => {
    setTimeout(() => {
      try {
        const req = http.get(`http://localhost:${APP_PORT}${route}`, (res) => {
          res.resume();
        });
        req.on("error", () => {});
        req.setTimeout(20000, () => req.destroy());
      } catch {}
    }, idx * 400);
  });
}

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
          `\n🌐 Sunucu hazır! Tüm ekranlar önbelleğe alınıyor ve Admin Paneli açılıyor: http://localhost:${APP_PORT}/admin\n`
        );
        preWarmAllRoutes();
        openBrowser();
      }
    });
    req.on("error", () => {});
    req.end();
  }, 1500);
} else {
  let warmed = false;
  const checkWarm = setInterval(() => {
    if (warmed) {
      clearInterval(checkWarm);
      return;
    }
    const req = http.get(`http://localhost:${APP_PORT}/api/settings`, (res) => {
      if (res.statusCode && res.statusCode < 500 && !warmed) {
        warmed = true;
        clearInterval(checkWarm);
        preWarmAllRoutes();
      }
    });
    req.on("error", () => {});
    req.end();
  }, 1500);
}

// Render 7/24 Bulut WhatsApp Köprüsünü uykuya dalmaması için her 8 dakikada bir otomatik pingle
const cloudBridgeStatusUrl =
  process.env.IS_NEW_FIRMA_PACKAGE === "true"
    ? ""
    : "https://restoran-siparis-v55a.onrender.com/status";

if (cloudBridgeStatusUrl) {
  const pingCloudBridge = () => {
    try {
      const req = https.get(cloudBridgeStatusUrl, (res) => {
        res.resume();
      });
      req.on("error", () => {});
      req.setTimeout(10000, () => req.destroy());
    } catch {}
  };
  pingCloudBridge();
  setInterval(pingCloudBridge, 8 * 60 * 1000);
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
