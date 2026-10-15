/**
 * ÜCRETSİZ KENDİ WHATSAPP NUMARANIZ İLE OTP & SİPARİŞ BİLDİRİM KÖPRÜSÜ (QR KODLU)
 * ---------------------------------------------------------------------------------
 * Bu servis:
 * 1. Yerel Admin / Mutfak panelinden (http://localhost:5439) gelen WhatsApp mesajlarını gönderir.
 * 2. Netlify'daki canlı müşteri sayfasından oluşturulan OTP doğrulama kodlarını ve
 *    sipariş bildirimlerini Turso Bulut veritabanından otomatik çekip kendi WhatsApp
 *    numaranız üzerinden müşteriye anında gönderir!
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const PORT = 3001;
const DB_PATH = path.join(process.cwd(), "data", "restaurant.sqlite");

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

  // Netlify / Turso Bulut Kuyruğundaki WhatsApp Mesajlarını Otomatik Gönderici
  let isProcessingQueue = false;
  setInterval(async () => {
    if (!sock || !isConnected || isProcessingQueue) return;
    if (!fs.existsSync(DB_PATH)) return;

    isProcessingQueue = true;
    try {
      const db = new DatabaseSync(DB_PATH);
      const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
      if (!row || !row.data) {
        db.close();
        return;
      }
      const settings = JSON.parse(row.data);
      const cloudCfg = settings?.cloudSyncConfig;

      // 1. Eğer Turso Bulut aktifse, buluttaki 'queued_for_local' mesajlarını çek
      if (cloudCfg?.enabled && cloudCfg?.tursoUrl && cloudCfg?.tursoAuthToken) {
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
                  sql: "SELECT id, data FROM whatsapp_logs ORDER BY created_at DESC LIMIT 30",
                },
              },
              { type: "close" },
            ],
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const json = await res.json();
          const rows = json?.results?.[0]?.response?.result?.rows || [];
          for (const r of rows) {
            const logDataStr = r?.[1]?.value;
            if (!logDataStr) continue;
            const logItem = JSON.parse(logDataStr);
            if (logItem.status === "queued_for_local") {
              const jid = `${String(logItem.phone).replace(/\D/g, "")}@s.whatsapp.net`;
              try {
                await sock.sendMessage(jid, { text: logItem.message });
                logItem.status = "sent";
                const updatedJson = JSON.stringify(logItem);

                // Bulutta güncelle
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
                          sql: "UPDATE whatsapp_logs SET data = ? WHERE id = ?",
                          args: [
                            { type: "text", value: updatedJson },
                            { type: "text", value: String(logItem.id) },
                          ],
                        },
                      },
                      { type: "close" },
                    ],
                  }),
                });

                // Yerel veritabanında da kaydet
                db.prepare(
                  "INSERT OR REPLACE INTO whatsapp_logs (id, created_at, data) VALUES (?, ?, ?)"
                ).run(logItem.id, logItem.createdAt, updatedJson);

                console.log(
                  `📤 [NETLIFY -> WHATSAPP] +${logItem.phone} numarasına mesaj gönderildi (${logItem.type})`
                );
              } catch (sendErr) {
                console.warn("WhatsApp bulut kuyruk mesajı gönderilemedi:", sendErr);
              }
            }
          }
        }
      }

      db.close();
    } catch {
      // Sessizce geç (veritabanı kilitli veya internet anlık kopuk olabilir)
    } finally {
      isProcessingQueue = false;
    }
  }, 2500);

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
