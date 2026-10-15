/**
 * ÜCRETSİZ KENDİ WHATSAPP NUMARANIZ İLE OTP & SİPARİŞ BİLDİRİM KÖPRÜSÜ (QR KODLU)
 * ---------------------------------------------------------------------------------
 * Bu servis, kendi WhatsApp numaranızı (WhatsApp Web -> Cihaz Bağla mantığıyla)
 * bağlayarak müşterilerinize tamamen ÜCRETSİZ 6 haneli doğrulama kodu (OTP) ve
 * sipariş onay mesajı göndermenizi sağlar.
 *
 * Kurulum (İlk seferde 1 kez çalıştırın):
 *   npm install @whiskeysockets/baileys qrcode-terminal pino
 *
 * Çalıştırma:
 *   node whatsapp-bridge.mjs
 *
 * Çalıştırdığınızda terminalde beliren QR kodu telefonunuzdaki WhatsApp
 * uygulamasından (Ayarlar -> Bağlı Cihazlar -> Cihaz Bağla) okutun.
 * Ardından /admin panelinden WhatsApp modunu "Kendi WhatsApp Numaram (QR Servisi)" yapın.
 */

import http from "node:http";

const PORT = 3001;

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
            "\n✅ WHATSAPP BAĞLANTISI AKTİF! Artık siteden ücretsiz OTP ve sipariş mesajları gönderilebilir.\n"
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
