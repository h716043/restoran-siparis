/**
 * ÜCRETSİZ KENDİ WHATSAPP NUMARANIZ İLE OTP & SİPARİŞ BİLDİRİM KÖPRÜSÜ (QR KODLU)
 * Hem yerel bilgisayarda (localhost:3001) hem de Render.com (https://dashboard.render.com/)
 * ücretsiz bulut sunucusunda 7/24 (PC kapalıyken bile) çalışacak şekilde tasarlanmıştır.
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const PORT = Number(process.env.PORT || 3001);
const DB_PATH = path.join(process.cwd(), "data", "restaurant.sqlite");
const DEFAULT_TURSO_URL =
  process.env.TURSO_DATABASE_URL ||
  "libsql://restoran-siparis-h716043.aws-eu-west-1.turso.io";
const DEFAULT_TURSO_TOKEN =
  process.env.TURSO_AUTH_TOKEN ||
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTIwMjk4NTksImlkIjoiMDFhMTNkNGQtMTIwMS03MjBmLWJiM2EtMzQwMmMzOTJiMmJiIiwia2lkIjoicU5MRDQ0b2tMUmMzYUVXU1BfUVhTQzk1RUFfLUUzUS1MZmhOVkFKY215ZyIsInJpZCI6ImQwNjhlMzJjLTMzOWYtNDcyZi04NWE5LTZiMDljNzdkNDA5MSJ9.loMcw0-7YNgjdnkq7LW78c4dmIRRobd4eeISokLfSwyAP_QMGRjDi8LKctOWpRPlSwgXdy__t5u8f2ir3_b_Bw";

const sentLogIds = new Set();

async function openLocalSqliteIfAvailable() {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    const sqliteMod = await import("node:sqlite");
    return new sqliteMod.DatabaseSync(DB_PATH);
  } catch {
    return null;
  }
}

async function startBridge() {
  let sock = null;
  let isConnected = false;
  let latestQrString = "";

  try {
    const baileys = await import("@whiskeysockets/baileys");
    const qrcode = await import("qrcode-terminal");
    const pino = (await import("pino")).default;

    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
    } = baileys;

    const authDir = process.env.WA_AUTH_DIR || "./data/whatsapp_auth";
    fs.mkdirSync(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const connectToWhatsApp = () => {
      sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
      });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          latestQrString = qr;
          console.log(
            "\n📱 LÜTFEN AŞAĞIDAKİ QR KODU WHATSAPP (BAĞLI CİHAZLAR) İLE OKUTUN (Veya Tarayıcıdan Servis URL'sini Açın):\n"
          );
          qrcode.default.generate(qr, { small: true });
        }
        if (connection === "close") {
          isConnected = false;
          const shouldReconnect =
            lastDisconnect?.error?.output?.statusCode !==
            DisconnectReason.loggedOut;
          console.log(
            "WhatsApp bağlantısı kapandı. Yeniden bağlanılıyor:",
            shouldReconnect
          );
          if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
          isConnected = true;
          latestQrString = "";
          console.log(
            "\n✅ WHATSAPP BAĞLANTISI AKTİF! Yerel ve Netlify / Render Bulut OTP & Sipariş mesajları 7/24 otomatik gönderiliyor.\n"
          );
        }
      });
    };

    connectToWhatsApp();
  } catch {
    console.log(
      "⚠️ Not: Gerçek WhatsApp QR bağlantısı için '@whiskeysockets/baileys qrcode-terminal pino' paketlerini kurabilirsiniz:"
    );
    console.log("   npm install @whiskeysockets/baileys qrcode-terminal pino\n");
  }

  // Yerel SQLite (varsa) ve Turso Bulut Kuyruğundaki WhatsApp Mesajlarını Otomatik Gönderici
  let isProcessingQueue = false;
  setInterval(async () => {
    if (!sock || !isConnected || isProcessingQueue) return;

    isProcessingQueue = true;
    let db = null;
    try {
      db = await openLocalSqliteIfAvailable();

      // A) Yerel SQLite varsa 'queued_for_local' mesajlarını gönder
      if (db) {
        const localPending = db
          .prepare(
            "SELECT id, phone, message, type, status, createdAt FROM whatsapp_logs WHERE status = 'queued_for_local' ORDER BY createdAt ASC LIMIT 20"
          )
          .all();

        for (const item of localPending) {
          if (sentLogIds.has(item.id)) {
            db.prepare(
              "UPDATE whatsapp_logs SET status = 'sent' WHERE id = ?"
            ).run(item.id);
            continue;
          }
          const jid = `${String(item.phone).replace(/\D/g, "")}@s.whatsapp.net`;
          try {
            await sock.sendMessage(jid, { text: item.message });
            sentLogIds.add(item.id);
            db.prepare(
              "UPDATE whatsapp_logs SET status = 'sent' WHERE id = ?"
            ).run(item.id);
            console.log(
              `📤 [YEREL KUYRUK -> WHATSAPP] +${item.phone} numarasına mesaj gönderildi (${item.type})`
            );
          } catch (err) {
            console.warn("Yerel kuyruk mesajı gönderilemedi:", err);
          }
        }
      }

      // B) Turso Bulut veritabanındaki ('restoran_cloud_store' -> k='activity') 'queued_for_local' mesajlarını kontrol et
      let tursoUrl = DEFAULT_TURSO_URL;
      let tursoToken = DEFAULT_TURSO_TOKEN;

      if (db) {
        const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
        if (row && row.data) {
          const settings = JSON.parse(row.data);
          const cloudCfg = settings?.cloudSyncConfig;
          if (cloudCfg?.tursoUrl && cloudCfg?.tursoAuthToken) {
            tursoUrl = cloudCfg.tursoUrl;
            tursoToken = cloudCfg.tursoAuthToken;
          }
        }
      }

      if (tursoUrl && tursoToken) {
        const baseUrl = tursoUrl
          .trim()
          .replace(/^libsql:\/\//i, "https://")
          .replace(/^wss:\/\//i, "https://")
          .replace(/\/+$/, "");

        const res = await fetch(`${baseUrl}/v2/pipeline`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tursoToken.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                type: "execute",
                stmt: {
                  sql: "SELECT v FROM restoran_cloud_store WHERE k = 'activity'",
                },
              },
              { type: "close" },
            ],
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const json = await res.json();
          const activityStr =
            json?.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value;
          if (activityStr) {
            const activity = JSON.parse(activityStr);
            const waLogs = Array.isArray(activity.whatsappLogs)
              ? activity.whatsappLogs
              : [];
            let changedInCloud = false;

            for (const logItem of waLogs) {
              if (logItem.status === "queued_for_local") {
                if (sentLogIds.has(logItem.id)) {
                  logItem.status = "sent";
                  changedInCloud = true;
                  continue;
                }

                const jid = `${String(logItem.phone).replace(/\D/g, "")}@s.whatsapp.net`;
                try {
                  await sock.sendMessage(jid, { text: logItem.message });
                  sentLogIds.add(logItem.id);
                  logItem.status = "sent";
                  changedInCloud = true;

                  if (db) {
                    db.prepare(
                      `INSERT INTO whatsapp_logs (id, phone, message, type, status, createdAt)
                       VALUES (?, ?, ?, ?, 'sent', ?)
                       ON CONFLICT(id) DO UPDATE SET status = 'sent'`
                    ).run(
                      logItem.id,
                      logItem.phone,
                      logItem.message,
                      logItem.type || "otp",
                      logItem.createdAt || new Date().toISOString()
                    );
                  }

                  console.log(
                    `📤 [BULUT -> WHATSAPP] +${logItem.phone} numarasına doğrulama/sipariş mesajı gönderildi! (${logItem.type})`
                  );
                } catch (sendErr) {
                  console.warn(
                    "WhatsApp bulut kuyruk mesajı gönderilemedi:",
                    sendErr
                  );
                }
              }
            }

            if (db && Array.isArray(activity.otpCodes)) {
              const upsertOtp = db.prepare(`
                INSERT INTO otp_codes (phone, code, expiresAt)
                VALUES (?, ?, ?)
                ON CONFLICT(phone) DO UPDATE SET
                  code = excluded.code,
                  expiresAt = excluded.expiresAt
              `);
              for (const otp of activity.otpCodes) {
                upsertOtp.run(otp.phone, otp.code, otp.expiresAt);
              }
            }

            if (changedInCloud) {
              const updatedActivityJson = JSON.stringify({
                ...activity,
                whatsappLogs: waLogs,
              });
              await fetch(`${baseUrl}/v2/pipeline`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${tursoToken.trim()}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  requests: [
                    {
                      type: "execute",
                      stmt: {
                        sql: `INSERT INTO restoran_cloud_store (k, v, updatedAt) VALUES ('activity', ?, ?)
                              ON CONFLICT(k) DO UPDATE SET v = excluded.v, updatedAt = excluded.updatedAt`,
                        args: [
                          { type: "text", value: updatedActivityJson },
                          {
                            type: "text",
                            value: new Date().toISOString(),
                          },
                        ],
                      },
                    },
                    { type: "close" },
                  ],
                }),
              });
            }
          }
        }
      }
    } catch {
      // Anlık kilitlenme veya ağ hatalarında bir sonraki döngüde devam et
    } finally {
      try {
        if (db) db.close();
      } catch {}
      isProcessingQueue = false;
    }
  }, 2000);

  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-api-key"
    );
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/send-message") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body);
          const rawPhone = String(parsed.phone || parsed.to || "");
          const textMsg = String(
            parsed.message || parsed.text || parsed.body || ""
          );
          const jid = `${rawPhone.replace(/\D/g, "")}@s.whatsapp.net`;

          if (sock && isConnected) {
            await sock.sendMessage(jid, { text: textMsg });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, status: "sent" }));
          } else {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "WhatsApp QR henüz bağlı değil",
              })
            );
          }
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    if (
      req.method === "POST" &&
      (req.url?.startsWith("/order/") || req.url?.startsWith("/yemeksepeti/"))
    ) {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parts = (req.url || "").split("/").filter(Boolean);
          const rawRemoteId = parts[parts.length - 1] || "genel";
          const cleanId =
            rawRemoteId
              .replace(/[^a-zA-Z0-9_]/g, "_")
              .replace(/^_+|_+$/g, "")
              .toLowerCase() || "genel";
          const tableName = `yemeksepeti_siparis_${cleanId}`;

          let parsed = {};
          try {
            parsed = JSON.parse(body);
          } catch {}
          const orderObj = parsed.ysOrderData || parsed;
          const orderId = String(
            orderObj.token ||
              orderObj.code ||
              `ys_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`
          );
          const orderCode = String(orderObj.code || orderId);
          const nowIso = new Date().toISOString();

          const ysTursoUrl =
            "https://yemeksepeti-musteri-h716043.aws-eu-west-1.turso.io";
          const ysTursoToken =
            "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI5NTA5MzIsImlkIjoiMDFhMTc0MzMtYjMwMS03YTIwLWI0ZjUtOTM4NDA0NmUxNDA0Iiwia2lkIjoicU5MRDQ0b2tMUmMzYUVXU1BfUVhTQzk1RUFfLUUzUS1MZmhOVkFKY215ZyIsInJpZCI6ImJlNzA5NTc3LWM3N2QtNGIyYi04YTZkLTE4Y2M5MWNlNzM4OSJ9.rWpp8aV0HJd5kKNwJB60Ofz4-b1dXF8DeVbhjwQCp9Aml4W-pQGLiMN5pN9fSnpHEFOJPi_FCUz9ocRoSdXlCw";

          await fetch(`${ysTursoUrl}/v2/pipeline`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${ysTursoToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [
                {
                  type: "execute",
                  stmt: {
                    sql: `CREATE TABLE IF NOT EXISTS ${tableName} (order_id TEXT PRIMARY KEY, remote_id TEXT NOT NULL, order_code TEXT, raw_json TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at TEXT NOT NULL, read_at TEXT)`,
                  },
                },
                {
                  type: "execute",
                  stmt: {
                    sql: `INSERT INTO ${tableName} (order_id, remote_id, order_code, raw_json, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(order_id) DO UPDATE SET raw_json = excluded.raw_json, is_read = 0`,
                    args: [
                      { type: "text", value: orderId },
                      { type: "text", value: rawRemoteId },
                      { type: "text", value: orderCode },
                      { type: "text", value: body },
                      { type: "text", value: nowIso },
                    ],
                  },
                },
                { type: "close" },
              ],
            }),
          });

          res.writeHead(202, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              remoteOrderId: `ys_${orderId}`,
              status: "order_accepted",
              tursoTable: tableName,
            })
          );
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    if (req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          connected: isConnected,
          hasQr: Boolean(latestQrString),
        })
      );
      return;
    }

    // Tarayıcıdan (Örn: Render.com servis URL'sinden) açıldığında Canlı QR Kod Okutma Sayfası
    const qrImgUrl = latestQrString
      ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
          latestQrString
        )}`
      : "";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="6" />
  <title>7/24 WhatsApp QR Köprü Servisi</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 28px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 13px; margin-bottom: 14px; }
    .ok { background: rgba(16,185,129,0.2); color: #34d399; border: 1px solid rgba(16,185,129,0.4); }
    .wait { background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4); }
    img { background: #fff; padding: 12px; border-radius: 16px; margin: 14px auto; display: block; }
    code { background: #0f172a; padding: 4px 8px; border-radius: 6px; font-size: 12px; color: #38bdf8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge ${isConnected ? "ok" : "wait"}">
      ${
        isConnected
          ? "🟢 WHATSAPP BAĞLANTISI AKTİF (7/24 ÇALIŞIYOR)"
          : "📱 WHATSAPP QR KOD BEKLENİYOR"
      }
    </div>
    <h2 style="margin: 0 0 8px 0; font-size: 18px;">Restoran 7/24 WhatsApp OTP Köprüsü</h2>
    ${
      isConnected
        ? `<p style="font-size: 13px; color: #94a3b8;">Telefonunuz başarıyla bağlandı! PC kapalı olsa bile Netlify ve Turso üzerinden gelen tüm üyelik (OTP) ve sipariş mesajları otomatik gönderilmektedir.</p>
           <p style="font-size: 12px; color: #cbd5e1; margin-top: 14px;">Admin Panel Gateway Endpoint:<br/><code>/send-message</code></p>`
        : qrImgUrl
        ? `<p style="font-size: 13px; color: #cbd5e1;">WhatsApp uygulamanızdan <strong>Bağlı Cihazlar &rarr; Cihaz Bağla</strong> menüsüne girerek aşağıdaki QR kodu okutun:</p>
           <img src="${qrImgUrl}" width="260" height="260" alt="WhatsApp QR" />
           <p style="font-size: 11px; color: #64748b;">Sayfa her 6 saniyede bir otomatik yenilenir.</p>`
        : `<p style="font-size: 13px; color: #94a3b8;">QR kod hazırlanıyor, lütfen birkaç saniye bekleyin (sayfa otomatik yenilenir)...</p>`
    }
  </div>
</body>
</html>`);
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `🚀 WhatsApp 7/24 Köprü Servisi çalışıyor: Port ${PORT} (/send-message)`
    );
  });

  // Render.com Free Tier uyku modunu (spin-down) önlemek için her 9 dakikada bir kendi /status uç noktasına ping at
  const selfUrl = (
    process.env.RENDER_EXTERNAL_URL ||
    "https://restoran-siparis-v55a.onrender.com"
  ).replace(/\/+$/, "");
  if (selfUrl.startsWith("https://")) {
    setInterval(() => {
      fetch(`${selfUrl}/status`).catch(() => {});
    }, 9 * 60 * 1000);
  }
}

startBridge();
