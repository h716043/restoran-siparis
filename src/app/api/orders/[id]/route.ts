import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getSettings, updateOrderStatus } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  pullActivityFromCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await pullActivityFromCloud();
    const { id } = await context.params;
    const order = getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }
    return NextResponse.json({ order });
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await pullActivityFromCloud(true);
    const { id } = await context.params;
    const body = await req.json();

    // Müşteri sipariş değerlendirmesi (1-5 Yıldız + Yorum)
    if (body.action === "review") {
      const { submitOrderReview } = await import("@/lib/db");
      const reviewed = submitOrderReview(
        id,
        Number(body.rating || 5),
        body.reviewText
      );
      if (!reviewed) {
        return NextResponse.json(
          { error: "Sipariş bulunamadı" },
          { status: 404 }
        );
      }
      await syncActivityWithCloud();
      return NextResponse.json({ order: reviewed });
    }

    const settings = getSettings();
    const role = req.cookies.get("restoran_staff_role")?.value;
    const courierPin = req.headers.get("x-courier-pin");
    const validKitchenPin = settings.securityConfig?.kitchenPassword || "1234";
    const validAdminPin = settings.securityConfig?.adminPassword || "admin1234";

    const isAuthorized =
      role === "admin" ||
      role === "kitchen" ||
      (courierPin &&
        (courierPin === validKitchenPin || courierPin === validAdminPin));

    if (!isAuthorized) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const updated = updateOrderStatus(
      id,
      body.status,
      body.estimatedMinutes,
      body.rejectReason,
      body.courierName
    );
    if (!updated) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    // Müşteriye otomatik WhatsApp sipariş durumu bildirimi gönder
    const digits = (updated.customerPhone || "").replace(/\D/g, "");
    if (
      settings.whatsappConfig?.sendOrderUpdates !== false &&
      digits.length >= 10
    ) {
      if (updated.status === "accepted") {
        const mins = updated.estimatedMinutes || settings.estimatedPrepMinutes;
        const msg = `✅ *${settings.name}*\n\nMerhaba *${updated.customerName}*, *#${updated.orderNumber}* numaralı siparişiniz onaylandı ve hazırlanmaya başlandı!\n\n⏱️ Tahmini Süre: *${mins} dakika*`;
        await sendWhatsAppMessage(updated.customerPhone, msg, "order_status");
      } else if (updated.status === "ready") {
        const payLabel =
          updated.paymentMethod === "cash"
            ? "Kapıda Nakit"
            : updated.paymentMethod === "card_at_door"
            ? "Kapıda Kredi Kartı (POS)"
            : "Masada Ödeme";
        const courierLine = updated.courierName
          ? `\n🛵 Kurye: *${updated.courierName}*`
          : "";
        const msg =
          updated.orderType === "delivery"
            ? `🛵 *${settings.name}*\n\nMerhaba *${updated.customerName}*, *#${updated.orderNumber}* numaralı siparişiniz hazırlandı ve kuryemize teslim edilerek adresinize doğru yola çıktı!${courierLine}\n💰 Tutar: *${updated.totalAmount.toFixed(
                2
              )} ${settings.currency}* (${payLabel})\n\nAfiyet olsun!`
            : `🍽️ *${settings.name}*\n\nMerhaba *${updated.customerName}*, *#${updated.orderNumber}* numaralı siparişiniz hazır! Afiyet olsun.`;
        await sendWhatsAppMessage(updated.customerPhone, msg, "order_status");
      } else if (updated.status === "rejected") {
        const msg = `⚠️ *${settings.name}*\n\nÜzgünüz *${updated.customerName}*, *#${updated.orderNumber}* numaralı siparişiniz iptal edildi.\nSebep: ${
          updated.rejectReason || "Yoğunluk"
        }`;
        await sendWhatsAppMessage(updated.customerPhone, msg, "order_status");
      }
    }

    await syncActivityWithCloud();

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("PATCH /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Sipariş güncellenemedi" }, { status: 500 });
  }
}


