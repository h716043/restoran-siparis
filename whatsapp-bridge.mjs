/**
 * ÜCRETSİZ KENDİ WHATSAPP NUMARANIZ İLE OTP & SİPARİŞ BİLDİRİM KÖPRÜSÜ (QR KODLU)
 * ---------------------------------------------------------------------------------
 * Bu servis:
 * 1. Yerel Admin / Mutfak panelinden (http://localhost:5439) gelen WhatsApp mesajlarını gönderir.
 * 2. Netlify'daki canlı müşteri sayfasından (https://yildizhanpos.netlify.app) oluşturulan
 *    OTP doğrulama kodlarını ve sipariş bildirimlerini Turso Bulut veritabanından
 *    (`restoran_cloud_store` -> `activity.whatsappLogs`) otomatik çekip kendi WhatsApp
 *    numaranız üzerinden müşteriye anında gönderir!
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const PORT = 3001;
const DB_PATH = path.join(process.cwd(), "data", "restaurant.sqlite");
const sentLogIds = new Set();

async function startBridge() {
  let sock = null;
  let isConnected = false;

  try {
    const baileys = await import("@whiskeysockets/baileys");
    const qrcode = await import("qrcode-terminal");
    const pino = (await import("pino")).default;

    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
    } = baileys;

    const { state, saveCreds } = await useMultiFileAuthState(
      "./data/whatsapp_auth"
    );

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
          console.log(
            "\n📱 LÜTFEN AŞAĞIDAKİ QR KODU WHATSAPP (BAĞLI CİHAZLAR) İLE OKUTUN:\n"
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
          console.log(
            "\n✅ WHATSAPP BAĞLANTISI AKTİF! Yerel (Port 5439) ve Netlify Bulut OTP/Sipariş mesajları otomatik gönderiliyor.\n"
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

  // Yerel SQLite ve Netlify / Turso Bulut Kuyruğundaki WhatsApp Mesajlarını Otomatik Gönderici
  let isProcessingQueue = false;
  setInterval(async () => {
    if (!sock || !isConnected || isProcessingQueue) return;
    if (!fs.existsSync(DB_PATH)) return;

    isProcessingQueue = true;
    let db = null;
    try {
      db = new DatabaseSync(DB_PATH);

      // A) Önce yerel SQLite'daki 'queued_for_local' mesajlarını gönder
      const localPending = db
        .prepare(
          "SELECT id, phone, message, type, status, createdAt FROM whatsapp_logs WHERE status = 'queued_for_local' ORDER BY createdAt ASC LIMIT 20"
        )
        .all();

      for (const item of localPending) {
        if (sentLogIds.has(item.id)) {
          db.prepare("UPDATE whatsapp_logs SET status = 'sent' WHERE id = ?").run(
            item.id
          );
          continue;
        }
        const jid = `${String(item.phone).replace(/\D/g, "")}@s.whatsapp.net`;
        try {
          await sock.sendMessage(jid, { text: item.message });
          sentLogIds.add(item.id);
          db.prepare("UPDATE whatsapp_logs SET status = 'sent' WHERE id = ?").run(
            item.id
          );
          console.log(
            `📤 [YEREL KUYRUK -> WHATSAPP] +${item.phone} numarasına mesaj gönderildi (${item.type})`
          );
        } catch (err) {
          console.warn("Yerel kuyruk mesajı gönderilemedi:", err);
        }
      }

      // B) Turso Bulut veritabanındaki ('restoran_cloud_store' -> k='activity') 'queued_for_local' mesajlarını kontrol et
      const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
      if (row && row.data) {
        const settings = JSON.parse(row.data);
        const cloudCfg = settings?.cloudSyncConfig;

        if (
          cloudCfg?.enabled &&
          cloudCfg?.tursoUrl &&
          cloudCfg?.tursoAuthToken
        ) {
          const baseUrl = cloudCfg.tursoUrl
            .trim()
            .replace(/^libsql:\/\//i, "https://")
            .replace(/^wss:\/\//i, "https://")
            .replace(/\/+$/, "");

          const res = await fetch(`${baseUrl}/v2/pipeline`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cloudCfg.tursoAuthToken.trim()}`,
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

                    // Yerel SQLite tablosuna da kaydet
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

                    console.log(
                      `📤 [NETLIFY BULUT -> WHATSAPP] +${logItem.phone} numarasına doğrulama/sipariş mesajı gönderildi! (${logItem.type})`
                    );
                  } catch (sendErr) {
                    console.warn(
                      "WhatsApp bulut kuyruk mesajı gönderilemedi:",
                      sendErr
                    );
                  }
                }
              }

              // Ayrıca buluttaki yeni OTP kodlarını da yerel SQLite'a eşitle
              if (Array.isArray(activity.otpCodes)) {
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
                    Authorization: `Bearer ${cloudCfg.tursoAuthToken.trim()}`,
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
    if (req.method === "POST" && req.url === "/send-message") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { phone, message } = JSON.parse(body);
          const jid = `${phone.replace(/\D/g, "")}@s.whatsapp.net`;

          if (sock && isConnected) {
            await sock.sendMessage(jid, { text: message });
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
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ connected: isConnected }));
    }
  });

  server.listen(PORT, () => {
    console.log(
      `🚀 WhatsApp Yerel Köprü Servisi çalışıyor: http://localhost:${PORT}/send-message`
    );
  });
}

startBridge();
