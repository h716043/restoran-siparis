import { NextRequest, NextResponse } from "next/server";
import {
  adjustUserLoyaltyPoints,
  createOrder,
  getOrders,
  getSettings,
  getUserByPhone,
  upsertUserAfterOtp,
} from "@/lib/db";
import {
  pullActivityFromCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";

export async function GET(req: NextRequest) {
  try {
    await pullActivityFromCloud();
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

    const orders = getOrders();
    return NextResponse.json({ orders, couriers: settings.couriers || [] });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: "Siparişler alınamadı" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await pullActivityFromCloud(true);
    const body = await req.json();
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "Sepet boş" }, { status: 400 });
    }

    const settings = getSettings();
    const role = req.cookies.get("restoran_staff_role")?.value;
    const isStaffPosOrder =
      Boolean(body.isStaffPosOrder) && (role === "admin" || role === "kitchen");

    const requireAuth =
      !isStaffPosOrder &&
      settings.whatsappConfig?.requireAuthForDeliveryAndPickup !== false;

    // Paket Servis ve Gel-Al'da üyelik doğrulaması zorunluysa kontrol et (Kasa POS siparişleri hariç)
    if (
      requireAuth &&
      (body.orderType === "delivery" || body.orderType === "pickup")
    ) {
      const verifiedUser = body.customerPhone
        ? getUserByPhone(body.customerPhone)
        : null;
      if (!verifiedUser) {
        return NextResponse.json(
          {
            error:
              "Paket servis ve Gel-Al siparişleri için lütfen WhatsApp doğrulaması ile giriş yapın.",
            requireWhatsAppAuth: true,
          },
          { status: 401 }
        );
      }
    }

    // Kullanıcı telefon numarası varsa müşteri kaydını güncelle veya Kasa POS ise oluştur
    let customerRecord =
      body.customerPhone && body.customerPhone !== "Masadan Sipariş"
        ? getUserByPhone(body.customerPhone)
        : null;

    if (
      body.customerPhone &&
      body.customerPhone !== "Masadan Sipariş" &&
      (customerRecord || isStaffPosOrder)
    ) {
      customerRecord = upsertUserAfterOtp(
        body.customerPhone,
        body.customerName,
        body.orderType === "delivery" ? body.customerAddress : undefined
      );
    }

    // İsteğe Bağlı Müşteri Sadakat & Para Puan (Cüzdan) Hesaplaması
    const loyaltyEnabled = settings.loyaltyConfig?.enabled === true;
    const earnPercent = Number(settings.loyaltyConfig?.earnPercent || 0);
    const minRedeem = Number(settings.loyaltyConfig?.minRedeemPoints || 0);

    let loyaltyPointsUsed = 0;
    let loyaltyPointsEarned = 0;

    if (loyaltyEnabled && customerRecord) {
      const requestedPoints = Number(body.loyaltyPointsUsed || 0);
      const availablePoints = Number(customerRecord.loyaltyPoints || 0);
      if (requestedPoints > 0 && availablePoints >= minRedeem) {
        loyaltyPointsUsed = Math.min(
          requestedPoints,
          availablePoints,
          Number(body.subtotal || 0)
        );
      }
      const netAmountForPoints = Math.max(
        0,
        Number(body.subtotal || 0) -
          Number(body.discountAmount || 0)
      );
      if (earnPercent > 0 && netAmountForPoints > 0) {
        loyaltyPointsEarned = Math.round((netAmountForPoints * earnPercent) / 100);
      }
      const netPointDelta = loyaltyPointsEarned - loyaltyPointsUsed;
      if (netPointDelta !== 0) {
        adjustUserLoyaltyPoints(customerRecord.phone, netPointDelta);
      }
    }

    const order = createOrder({
      orderType: body.orderType,
      tableNumber: body.tableNumber,
      userId: customerRecord?.id || body.userId,
      customerName: body.customerName || "Misafir",
      customerPhone: body.customerPhone || "-",
      customerAddress: body.customerAddress,
      deliveryZoneId: body.deliveryZoneId,
      deliveryZoneName: body.deliveryZoneName,
      scheduledTime: body.scheduledTime || undefined,
      orderNote: body.orderNote,
      paymentMethod: body.paymentMethod || "cash",
      subtotal: Number(body.subtotal),
      discountAmount: Number(body.discountAmount || 0),
      couponCode: body.couponCode || undefined,
      deliveryFee: Number(body.deliveryFee || 0),
      totalAmount: Number(body.totalAmount),
      estimatedMinutes: isStaffPosOrder
        ? settings.estimatedPrepMinutes || 25
        : undefined,
      loyaltyPointsEarned,
      loyaltyPointsUsed,
      initialStatus: isStaffPosOrder ? "accepted" : "pending",
      items: body.items,
    });
    await syncActivityWithCloud();
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Sipariş oluşturulamadı" },
      { status: 500 }
    );
  }
}


