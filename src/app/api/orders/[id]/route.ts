import { NextRequest, NextResponse } from "next/server";
import { getOrderById, getSettings, updateOrderStatus } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  pullActivityFromCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";
import {
  autoSyncOrdersWithPosIfNeeded,
  syncSiteOrderUpdateToSambaPos,
} from "@/lib/sambapos";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await pullActivityFromCloud();
    await autoSyncOrdersWithPosIfNeeded().catch(() => {});
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

    // Müşteri tarafından mutfak onaylamadan önce ("pending" aşamasında) sipariş iptali
    if (body.action === "customer_cancel") {
      const targetOrder = getOrderById(id);
      if (!targetOrder) {
        return NextResponse.json(
          { error: "Sipariş bulunamadı" },
          { status: 404 }
        );
      }
      if (targetOrder.status !== "pending") {
        return NextResponse.json(
          {
            error:
              "Siparişiniz mutfak tarafından hazırlanmaya başlandığı için doğrudan iptal edilemez. Lütfen restoranımızla iletişime geçin.",
          },
          { status: 400 }
        );
      }
      const cancelled = updateOrderStatus(
        id,
        "rejected",
        undefined,
        body.reason
          ? `Müşteri İptali: ${String(body.reason).trim()}`
          : "Müşteri tarafından onay öncesi iptal edildi"
      );
      const { getUserByPhone, pushCatalogToCloud } = await import(
        "@/lib/cloud-sync"
      ).then(async (cs) => {
        const dbMod = await import("@/lib/db");
        return {
          getUserByPhone: dbMod.getUserByPhone,
          pushCatalogToCloud: cs.pushCatalogToCloud,
        };
      });
      const updatedUser = cancelled?.customerPhone
        ? getUserByPhone(cancelled.customerPhone)
        : null;
      await syncActivityWithCloud();
      await pushCatalogToCloud().catch(() => {});
      return NextResponse.json({ order: cancelled, user: updatedUser });
    }

    // Müşteri tarafından aktif siparişe sonradan ek not iletme
    if (body.action === "customer_update_note") {
      const targetOrder = getOrderById(id);
      if (!targetOrder) {
        return NextResponse.json(
          { error: "Sipariş bulunamadı" },
          { status: 404 }
        );
      }
      if (!["pending", "accepted"].includes(targetOrder.status)) {
        return NextResponse.json(
          { error: "Bu siparişe artık ek not eklenemez." },
          { status: 400 }
        );
      }
      const { appendOrderCustomerNote } = await import("@/lib/db");
      const updatedNoteOrder = appendOrderCustomerNote(
        id,
        String(body.note || "")
      );
      await syncActivityWithCloud();
      return NextResponse.json({ order: updatedNoteOrder });
    }

    const settings = getSettings();
    const role = req.cookies.get("restoran_staff_role")?.value;
    const courierPin = req.headers.get("x-courier-pin")?.trim();
    const waiterPin = req.headers.get("x-waiter-pin")?.trim();
    const validKitchenPin = settings.securityConfig?.kitchenPassword || "1234";
    const validAdminPin = settings.securityConfig?.adminPassword || "admin1234";
    const courierPins = settings.courierPins || {};
    const courierList = settings.couriers || [];
    const waiterPins = settings.waiterPins || {};
    const waiterList = settings.waiters || [];

    const hasValidCourierPin =
      Boolean(courierPin) &&
      Object.entries(courierPins).some(
        ([cName, cPin]) => cPin === courierPin && courierList.includes(cName)
      );

    const hasValidWaiterPin =
      Boolean(waiterPin) &&
      (waiterPin === validKitchenPin ||
        waiterPin === validAdminPin ||
        Object.entries(waiterPins).some(
          ([wName, wPin]) => wPin === waiterPin && waiterList.includes(wName)
        ));

    const isAuthorized =
      role === "admin" ||
      role === "kitchen" ||
      hasValidCourierPin ||
      hasValidWaiterPin ||
      (courierPin &&
        (courierPin === validKitchenPin || courierPin === validAdminPin));

    if (!isAuthorized) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    // Mutfak ekranında usta ürün bazlı "Hazırlandı ✓" tiklemesi
    if (body.action === "toggle_item_prepared") {
      const { toggleOrderItemPrepared } = await import("@/lib/db");
      const toggled = toggleOrderItemPrepared(id, String(body.itemId || "all"));
      if (!toggled) {
        return NextResponse.json(
          { error: "Sipariş bulunamadı" },
          { status: 404 }
        );
      }
      await syncActivityWithCloud();
      return NextResponse.json({ order: toggled });
    }

    // Adisyondaki bir ürünü tek tuşla "Müessese İkramı (0 ₺)" yapma veya ikramı geri alma
    if (body.action === "toggle_item_complimentary") {
      const { toggleOrderItemComplimentary } = await import("@/lib/db");
      const toggled = toggleOrderItemComplimentary(
        id,
        String(body.itemId || "")
      );
      if (!toggled) {
        return NextResponse.json(
          { error: "Sipariş bulunamadı" },
          { status: 404 }
        );
      }
      await syncActivityWithCloud();
      return NextResponse.json({ order: toggled });
    }

    // Mutfak ekranında siparişi Acil / Öncelikli (VIP) olarak sabitleme veya kaldırma
    if (body.action === "toggle_priority") {
      const { toggleOrderPriority } = await import("@/lib/db");
      const toggled = toggleOrderPriority(id);
      if (!toggled) {
        return NextResponse.json(
          { error: "Sipariş bulunamadı" },
          { status: 404 }
        );
      }
      await syncActivityWithCloud();
      return NextResponse.json({ order: toggled });
    }

    // Açık masa adisyonuna sonradan ürün ekleme
    if (body.action === "append_items") {
      const { appendItemsToOrder } = await import("@/lib/db");
      const { pushCatalogToCloud } = await import("@/lib/cloud-sync");
      const appended = appendItemsToOrder(
        id,
        body.items || [],
        body.extraNote
      );
      if (!appended) {
        return NextResponse.json(
          { error: "Sipariş bulunamadı" },
          { status: 404 }
        );
      }
      await syncActivityWithCloud();
      await pushCatalogToCloud();
      return NextResponse.json({ order: appended });
    }

    // Açık masa adisyonundan kalem iptali veya adet azaltma
    if (body.action === "remove_order_item") {
      const { removeItemFromOrder } = await import("@/lib/db");
      const { pushCatalogToCloud } = await import("@/lib/cloud-sync");
      const updatedOrder = removeItemFromOrder(
        id,
        String(body.itemId || ""),
        Boolean(body.decrementOnly)
      );
      if (!updatedOrder) {
        return NextResponse.json(
          { error: "Sipariş bulunamadı" },
          { status: 404 }
        );
      }
      await syncActivityWithCloud();
      await pushCatalogToCloud();
      return NextResponse.json({ order: updatedOrder });
    }

    const existingOrder = getOrderById(id);
    if (!existingOrder) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    // Aynı durum için mükerrer tıklama veya çift istek gelirse tekrar bildirim/POS tetikleme
    if (
      existingOrder.status === body.status &&
      (!body.courierName || existingOrder.courierName === body.courierName) &&
      (!body.paymentMethod || existingOrder.paymentMethod === body.paymentMethod)
    ) {
      return NextResponse.json({
        order: existingOrder,
        alreadyUpdated: true,
      });
    }

    const updated = updateOrderStatus(
      id,
      body.status,
      body.estimatedMinutes,
      body.rejectReason,
      body.courierName,
      body.paymentMethod
    );
    if (!updated) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    // Dış servisleri (WhatsApp, SambaPOS SQL, Bulut Senkronizasyonu) arka planda çalıştırarak
    // mutfak ekranının anında yanıt almasını sağla
    void (async () => {
      try {
        const digits = (updated.customerPhone || "").replace(/\D/g, "");
        if (
          settings.whatsappConfig?.sendOrderUpdates !== false &&
          digits.length >= 10
        ) {
          if (updated.status === "accepted") {
            const mins =
              updated.estimatedMinutes || settings.estimatedPrepMinutes;
            const msg = `✅ *${settings.name}*\n\nMerhaba *${updated.customerName}*, *#${updated.orderNumber}* numaralı siparişiniz onaylandı ve hazırlanmaya başlandı!\n\n⏱️ Tahmini Süre: *${mins} dakika*`;
            await sendWhatsAppMessage(
              updated.customerPhone,
              msg,
              "order_status"
            );
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
            await sendWhatsAppMessage(
              updated.customerPhone,
              msg,
              "order_status"
            );
          } else if (updated.status === "rejected") {
            const refundLine =
              (updated.loyaltyPointsUsed || 0) > 0
                ? `\n🎁 Harcadığınız *${Number(updated.loyaltyPointsUsed).toFixed(2)} ${settings.currency}* Para Puan cüzdanınıza iade edilmiştir.`
                : "";
            const msg = `⚠️ *${settings.name}*\n\nÜzgünüz *${updated.customerName}*, *#${updated.orderNumber}* numaralı siparişiniz iptal edildi.\nSebep: ${
              updated.rejectReason || "Yoğunluk"
            }${refundLine}`;
            await sendWhatsAppMessage(
              updated.customerPhone,
              msg,
              "order_status"
            );
          }
        }

        if (updated.status === "accepted") {
          await autoSyncOrdersWithPosIfNeeded().catch(() => {});
        } else if (
          updated.status === "ready" ||
          updated.status === "completed" ||
          Boolean(body.courierName)
        ) {
          await syncSiteOrderUpdateToSambaPos(updated).catch(() => {});
        }

        await syncActivityWithCloud();
      } catch (bgErr) {
        console.error("PATCH /api/orders/[id] background sync error:", bgErr);
      }
    })();

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("PATCH /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Sipariş güncellenemedi" }, { status: 500 });
  }
}


