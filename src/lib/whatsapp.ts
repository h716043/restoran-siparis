import { getSettings, logWhatsAppMessage, normalizePhone } from "@/lib/db";

export interface SendWhatsAppResult {
  success: boolean;
  provider: "simulation" | "custom_gateway" | "meta_cloud";
  status: "sent" | "simulated" | "failed";
  previewMessage: string;
}

export async function sendWhatsAppMessage(
  rawPhone: string,
  message: string,
  type: "otp" | "order_status" = "otp"
): Promise<SendWhatsAppResult> {
  const phone = normalizePhone(rawPhone);
  const settings = getSettings();
  const config = settings.whatsappConfig || {
    provider: "simulation",
    gatewayUrl: "http://localhost:3001/send-message",
    gatewayApiKey: "",
    metaPhoneNumberId: "",
    metaAccessToken: "",
    sendOrderUpdates: true,
    requireAuthForDeliveryAndPickup: true,
  };

  // 1. Kendi QR WhatsApp Web Köprüsü (Ücretsiz Baileys / whatsapp-web.js / WAHA / Evolution)
  const isNetlifyCloud =
    process.env.NETLIFY === "true" ||
    process.env.NEXT_PUBLIC_CUSTOMER_ONLY === "true";

  // Netlify bulut sunucusundaysak (ve Meta Cloud seçili değilse), yerel WhatsApp köprüsünün göndermesi için doğrudan bulut kuyruğuna al
  if (isNetlifyCloud && config.provider !== "meta_cloud") {
    logWhatsAppMessage(phone, message, type, "queued_for_local");
    return {
      success: true,
      provider: "custom_gateway",
      status: "sent",
      previewMessage: message,
    };
  }

  if (config.provider === "custom_gateway") {
    const gatewayUrl =
      config.gatewayUrl || "http://localhost:3001/send-message";

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.gatewayApiKey) {
        headers["Authorization"] = `Bearer ${config.gatewayApiKey}`;
        headers["x-api-key"] = config.gatewayApiKey;
      }

      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone,
          chatId: `${phone}@c.us`,
          jid: `${phone}@s.whatsapp.net`,
          message,
          text: message,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        logWhatsAppMessage(phone, message, type, "sent");
        return {
          success: true,
          provider: "custom_gateway",
          status: "sent",
          previewMessage: message,
        };
      }
    } catch (err) {
      console.warn(
        "Yerel WhatsApp QR servisine doğrudan ulaşılamadı, kuyruğa alındı:",
        err
      );
    }

    // Doğrudan HTTP isteği anlık başarısız olursa test moduna düşmek yerine yerel köprü kuyruğuna al
    logWhatsAppMessage(phone, message, type, "queued_for_local");
    return {
      success: true,
      provider: "custom_gateway",
      status: "sent",
      previewMessage: message,
    };
  }

  // 2. Resmi Meta WhatsApp Cloud API
  if (
    config.provider === "meta_cloud" &&
    config.metaPhoneNumberId &&
    config.metaAccessToken
  ) {
    try {
      const url = `https://graph.facebook.com/v20.0/${config.metaPhoneNumberId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.metaAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message },
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        logWhatsAppMessage(phone, message, type, "sent");
        return {
          success: true,
          provider: "meta_cloud",
          status: "sent",
          previewMessage: message,
        };
      }
    } catch (err) {
      console.warn("Meta Cloud API hatası:", err);
    }
  }

  // 3. Simülasyon / Test Modu (Canlı önizleme + Log kaydı)
  logWhatsAppMessage(phone, message, type, "simulated");
  return {
    success: true,
    provider: "simulation",
    status: "simulated",
    previewMessage: message,
  };
}
