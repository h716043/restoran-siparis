import { getSettings, logWhatsAppMessage, normalizePhone } from "@/lib/db";

export interface SendWhatsAppResult {
  success: boolean;
  provider: "simulation" | "custom_gateway" | "meta_cloud";
  status: "sent" | "simulated" | "queued_for_local" | "failed";
  previewMessage: string;
}

function isLocalNetworkGatewayUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const h = u.hostname.toLowerCase();
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "0.0.0.0" ||
      h.startsWith("192.168.") ||
      h.startsWith("10.") ||
      h.endsWith(".local")
    );
  } catch {
    return true;
  }
}

export async function sendWhatsAppMessage(
  rawPhone: string,
  message: string,
  type: "otp" | "order_status" | "campaign" = "otp"
): Promise<SendWhatsAppResult> {
  const phone = normalizePhone(rawPhone);
  const settings = getSettings();
  const config = settings.whatsappConfig || {
    provider: "custom_gateway",
    gatewayUrl: "https://restoran-siparis-v55a.onrender.com/send-message",
    gatewayApiKey: "",
    metaPhoneNumberId: "",
    metaAccessToken: "",
    sendOrderUpdates: true,
    requireAuthForDeliveryAndPickup: true,
    enableCustomerWaMeVerification: true,
  };

  const isNetlifyCloud =
    process.env.NETLIFY === "true" ||
    process.env.NEXT_PUBLIC_CUSTOMER_ONLY === "true";

  // 1. Kendi QR WhatsApp Köprüsü veya Bulut WhatsApp Gateway (UltraMsg / WaAPI / GreenAPI / Railway / Evolution)
  if (config.provider === "custom_gateway") {
    const gatewayUrl = (
      config.gatewayUrl || "http://localhost:3001/send-message"
    ).trim();
    const isLocalUrl = isLocalNetworkGatewayUrl(gatewayUrl);

    // Eğer Netlify bulut sunucusundaysak VE gatewayUrl yerel bir adres (localhost) ise,
    // doğrudan yerel köprü kuyruğuna al (veya PC kapalıysa yedek doğrulama devreye girsin)
    if (isNetlifyCloud && isLocalUrl) {
      logWhatsAppMessage(phone, message, type, "queued_for_local");
      return {
        success: true,
        provider: "custom_gateway",
        status: "queued_for_local",
        previewMessage: message,
      };
    }

    // Eğer gatewayUrl uzak bir Bulut (https://...) adresi ise (PC kapalı olsa bile 7/24 buluttan gönderir)
    // veya yerel sunucudaysak doğrudan HTTP POST isteği gönder:
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
          to: `+${phone}`,
          chatId: `${phone}@c.us`,
          jid: `${phone}@s.whatsapp.net`,
          message,
          body: message,
          text: message,
          ...(config.gatewayApiKey ? { token: config.gatewayApiKey } : {}),
        }),
        signal: AbortSignal.timeout(6000),
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
        "WhatsApp Gateway servisine doğrudan ulaşılamadı, kuyruğa alındı:",
        err
      );
    }

    // Doğrudan HTTP isteği anlık başarısız olursa (örneğin PC kapalıysa) yerel köprü kuyruğuna al
    logWhatsAppMessage(phone, message, type, "queued_for_local");
    return {
      success: true,
      provider: "custom_gateway",
      status: "queued_for_local",
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
