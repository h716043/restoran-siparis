import { NextRequest, NextResponse } from "next/server";
import {
  adjustUserLoyaltyPoints,
  appendItemsToOrder,
  closeTableOrdersWithPayment,
  createOrder,
  getMenuItems,
  getOrders,
  getSettings,
  getUserByPhone,
  payPartialTableItems,
  recordCreditAccountTransaction,
  settleCourierOrders,
  transferTableOrders,
  upsertUserAfterOtp,
} from "@/lib/db";
import {
  pullActivityFromCloud,
  pushCatalogToCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";
import { autoSyncOrdersWithPosIfNeeded } from "@/lib/sambapos";

export async function GET(req: NextRequest) {
  try {
    await pullActivityFromCloud();
    const settings = getSettings();

    // TV Müşteri Sıra Çağrı Ekranı (/tv) için şifresiz, kişisel veri içermeyen özet akış + Digital Signage kampanya bandı
    if (req.nextUrl.searchParams.get("publicTv") === "1") {
      const allowedTvTypes = Array.isArray(settings.tvDisplayOrderTypes)
        ? settings.tvDisplayOrderTypes
        : ["pickup", "dine_in", "delivery"];
      const allOrders = getOrders();
      const tvOrders = allOrders
        .filter(
          (o) =>
            (o.status === "accepted" ||
              o.status === "ready" ||
              o.status === "pending") &&
            allowedTvTypes.includes(o.orderType)
        )
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          orderType: o.orderType,
          tableNumber: o.tableNumber,
          status: o.status,
          estimatedMinutes: o.estimatedMinutes,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        }));

      const featuredItems = getMenuItems()
        .filter((i) => i.available && (i.popular || i.categoryId === "cat-kampanya"))
        .slice(0, 6)
        .map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
        }));

      return NextResponse.json({
        orders: tvOrders,
        restaurantName: settings.name,
        slogan: settings.slogan,
        currency: settings.currency || "₺",
        tvDisplayOrderTypes: allowedTvTypes,
        tvTickerSpeed: settings.tvTickerSpeed || "normal",
        tvCustomNote: settings.tvCustomNote ?? "",
        announcementBar: settings.announcementBar || null,
        happyHourConfig: settings.happyHourConfig || null,
        featuredItems,
      });
    }

    // Masa QR müşterisinin kendi masasının açık adisyonunu görebilmesi için şifresiz masa özeti
    const publicTable = req.nextUrl.searchParams.get("publicTable");
    if (publicTable) {
      const cleanT = String(publicTable).trim();
      const tableOrders = getOrders()
        .filter(
          (o) =>
            o.orderType === "dine_in" &&
            String(o.tableNumber) === cleanT &&
            (o.status === "pending" ||
              o.status === "accepted" ||
              o.status === "ready")
        )
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          tableNumber: o.tableNumber,
          status: o.status,
          items: o.items,
          subtotal: o.subtotal,
          discountAmount: o.discountAmount,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
        }));
      return NextResponse.json({ orders: tableOrders });
    }

    const role = req.cookies.get("restoran_staff_role")?.value;
    const courierPin = req.headers.get("x-courier-pin")?.trim();
    const rawCourierHeader = req.headers.get("x-courier-name");
    const requestedCourierName = rawCourierHeader
      ? decodeURIComponent(rawCourierHeader).trim()
      : "";
    const waiterPin = req.headers.get("x-waiter-pin")?.trim();
    const rawWaiterHeader = req.headers.get("x-waiter-name");
    const requestedWaiterName = rawWaiterHeader
      ? decodeURIComponent(rawWaiterHeader).trim()
      : "";

    const validKitchenPin = settings.securityConfig?.kitchenPassword || "1234";
    const validAdminPin = settings.securityConfig?.adminPassword || "admin1234";
    const courierPins = settings.courierPins || {};
    const courierList = settings.couriers || [];
    const waiterPins = settings.waiterPins || {};
    const waiterList = settings.waiters || [];

    let matchedCourier: string | null = null;
    if (courierPin) {
      if (
        requestedCourierName &&
        requestedCourierName !== "all" &&
        courierPins[requestedCourierName] === courierPin
      ) {
        matchedCourier = requestedCourierName;
      } else {
        const foundEntry = Object.entries(courierPins).find(
          ([cName, cPin]) =>
            cPin === courierPin && courierList.includes(cName)
        );
        if (foundEntry) {
          matchedCourier = foundEntry[0];
        }
      }
    }

    let matchedWaiter: string | null = null;
    if (waiterPin) {
      if (
        requestedWaiterName &&
        requestedWaiterName !== "auto" &&
        requestedWaiterName !== "all" &&
        waiterPins[requestedWaiterName] === waiterPin
      ) {
        matchedWaiter = requestedWaiterName;
      } else {
        const foundWaiter = Object.entries(waiterPins).find(
          ([wName, wPin]) =>
            wPin === waiterPin && waiterList.includes(wName)
        );
        if (foundWaiter) {
          matchedWaiter = foundWaiter[0];
        }
      }
    }

    const isMasterPin =
      (Boolean(courierPin) &&
        (courierPin === validKitchenPin || courierPin === validAdminPin)) ||
      (Boolean(waiterPin) &&
        (waiterPin === validKitchenPin || waiterPin === validAdminPin));

    const isAuthorized =
      role === "admin" ||
      role === "kitchen" ||
      Boolean(matchedCourier) ||
      Boolean(matchedWaiter) ||
      isMasterPin;

    if (!isAuthorized) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    if (role === "admin" || role === "kitchen") {
      await autoSyncOrdersWithPosIfNeeded().catch(() => {});
    }

    const orders = getOrders();
    return NextResponse.json({
      orders,
      couriers: courierList,
      waiters: waiterList,
      authenticatedCourier: matchedCourier,
      authenticatedWaiter: matchedWaiter,
      isMasterCourierLogin: Boolean(
        isMasterPin || role === "admin" || role === "kitchen"
      ),
      isMasterWaiterLogin: Boolean(
        isMasterPin || role === "admin" || role === "kitchen"
      ),
    });
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
    const waiterPin = req.headers.get("x-waiter-pin")?.trim();
    const validKitchenPin = settings.securityConfig?.kitchenPassword || "1234";
    const validAdminPin = settings.securityConfig?.adminPassword || "admin1234";
    const waiterPins = settings.waiterPins || {};
    const waiterList = settings.waiters || [];
    const hasValidWaiterPin =
      Boolean(waiterPin) &&
      (waiterPin === validKitchenPin ||
        waiterPin === validAdminPin ||
        Object.entries(waiterPins).some(
          ([wName, wPin]) => wPin === waiterPin && waiterList.includes(wName)
        ));

    const isStaffPosOrder =
      Boolean(body.isStaffPosOrder) &&
      (role === "admin" || role === "kitchen" || hasValidWaiterPin);

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
      const rawSubtotal = Number(body.subtotal);
      const safeSubtotal = Number.isFinite(rawSubtotal)
        ? rawSubtotal
        : Array.isArray(body.items)
        ? body.items.reduce(
            (sum: number, item: { totalPrice?: number; unitPrice?: number; quantity?: number }) =>
              sum +
              (Number.isFinite(Number(item.totalPrice))
                ? Number(item.totalPrice)
                : Number(item.unitPrice || 0) * Number(item.quantity || 1)),
            0
          )
        : 0;

      if (requestedPoints > 0 && availablePoints >= minRedeem) {
        loyaltyPointsUsed = Math.min(
          requestedPoints,
          availablePoints,
          safeSubtotal
        );
      }
      const netAmountForPoints = Math.max(
        0,
        safeSubtotal - Number(body.discountAmount || 0)
      );
      if (earnPercent > 0 && netAmountForPoints > 0) {
        loyaltyPointsEarned = Math.round((netAmountForPoints * earnPercent) / 100);
      }
      const netPointDelta = loyaltyPointsEarned - loyaltyPointsUsed;
      if (netPointDelta !== 0) {
        adjustUserLoyaltyPoints(customerRecord.phone, netPointDelta);
      }
    }

    const fallbackSubtotal = Array.isArray(body.items)
      ? body.items.reduce(
          (sum: number, item: { totalPrice?: number; unitPrice?: number; quantity?: number }) =>
            sum +
            (Number.isFinite(Number(item.totalPrice))
              ? Number(item.totalPrice)
              : Number(item.unitPrice || 0) * Number(item.quantity || 1)),
          0
        )
      : 0;
    const computedSubtotal = Number.isFinite(Number(body.subtotal))
      ? Number(body.subtotal)
      : fallbackSubtotal;
    const computedDiscount = Number.isFinite(Number(body.discountAmount))
      ? Number(body.discountAmount)
      : 0;
    const computedDeliveryFee = Number.isFinite(Number(body.deliveryFee))
      ? Number(body.deliveryFee)
      : 0;
    const computedTotal = Number.isFinite(Number(body.totalAmount))
      ? Number(body.totalAmount)
      : Math.max(0, computedSubtotal - computedDiscount + computedDeliveryFee);

    // 2. ÖZELLİK: Masa QR müşterisi açık masa adisyonuna ek sipariş veriyorsa mevcut masa adisyonuna birleştir
    if (
      body.orderType === "dine_in" &&
      body.tableNumber &&
      body.appendToActiveTableOrder
    ) {
      const cleanT = String(body.tableNumber).trim();
      const existingOpenOrder = getOrders().find(
        (o) =>
          o.orderType === "dine_in" &&
          String(o.tableNumber) === cleanT &&
          (o.status === "pending" ||
            o.status === "accepted" ||
            o.status === "ready")
      );
      if (existingOpenOrder) {
        const appended = appendItemsToOrder(
          existingOpenOrder.id,
          body.items,
          body.orderNote
        );
        if (appended) {
          await syncActivityWithCloud();
          await pushCatalogToCloud();
          return NextResponse.json(
            { order: appended, appended: true },
            { status: 201 }
          );
        }
      }
    }

    const order = createOrder({
      orderType: body.orderType,
      tableNumber: body.tableNumber,
      guestCount: body.guestCount ? Number(body.guestCount) : undefined,
      isPriority: Boolean(body.isPriority),
      userId: customerRecord?.id || body.userId,
      customerName: body.customerName || "Misafir",
      customerPhone: body.customerPhone || "-",
      customerAddress: body.customerAddress,
      deliveryZoneId: body.deliveryZoneId,
      deliveryZoneName: body.deliveryZoneName,
      scheduledTime: body.scheduledTime || undefined,
      orderNote: body.orderNote,
      paymentMethod: body.paymentMethod || "cash",
      splitPaymentInfo:
        body.paymentMethod === "credit"
          ? {
              cashAmount: 0,
              cardAmount: 0,
              creditAccountId: body.creditAccountId,
              creditAccountName: body.creditAccountName || body.customerName,
            }
          : undefined,
      subtotal: computedSubtotal,
      discountAmount: computedDiscount,
      couponCode: body.couponCode || undefined,
      deliveryFee: computedDeliveryFee,
      totalAmount: computedTotal,
      estimatedMinutes: isStaffPosOrder
        ? settings.estimatedPrepMinutes || 25
        : undefined,
      loyaltyPointsEarned,
      loyaltyPointsUsed,
      initialStatus: isStaffPosOrder ? "accepted" : "pending",
      items: body.items,
    });

    if (body.paymentMethod === "credit" && computedTotal > 0) {
      recordCreditAccountTransaction({
        accountId: body.creditAccountId,
        customerName: body.creditAccountName || body.customerName || "Veresiye Müşterisi",
        customerPhone: body.customerPhone,
        type: "debt",
        amount: computedTotal,
        description: `Sipariş #${order.orderNumber} (Cari / Veresiye)`,
        orderNumber: order.orderNumber,
      });
    }

    await autoSyncOrdersWithPosIfNeeded().catch(() => {});
    await syncActivityWithCloud();
    await pushCatalogToCloud();
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: "Sipariş oluşturulamadı" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await pullActivityFromCloud(true);
    const settings = getSettings();
    const role = req.cookies.get("restoran_staff_role")?.value;
    const waiterPin = req.headers.get("x-waiter-pin")?.trim();
    const validKitchenPin = settings.securityConfig?.kitchenPassword || "1234";
    const validAdminPin = settings.securityConfig?.adminPassword || "admin1234";
    const waiterPins = settings.waiterPins || {};
    const waiterList = settings.waiters || [];
    const hasValidWaiterPin =
      Boolean(waiterPin) &&
      (waiterPin === validKitchenPin ||
        waiterPin === validAdminPin ||
        Object.entries(waiterPins).some(
          ([wName, wPin]) => wPin === waiterPin && waiterList.includes(wName)
        ));

    const isAuthorized =
      role === "admin" || role === "kitchen" || hasValidWaiterPin;
    if (!isAuthorized) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();

    if (body.action === "transfer_table") {
      const orders = transferTableOrders(
        String(body.fromTable || ""),
        String(body.toTable || "")
      );
      await syncActivityWithCloud();
      return NextResponse.json({ orders });
    }

    if (body.action === "partial_table_payment") {
      const orders = payPartialTableItems(
        String(body.tableNumber || ""),
        Array.isArray(body.selectedItemKeys) ? body.selectedItemKeys : [],
        body.paymentMethod || "cash"
      );
      await syncActivityWithCloud();
      return NextResponse.json({ orders });
    }

    if (body.action === "close_table_payment") {
      const orders = closeTableOrdersWithPayment(
        String(body.tableNumber || ""),
        {
          paymentMethod: body.paymentMethod || "cash",
          cashAmount:
            body.cashAmount !== undefined ? Number(body.cashAmount) : undefined,
          cardAmount:
            body.cardAmount !== undefined ? Number(body.cardAmount) : undefined,
          discountAmount:
            body.discountAmount !== undefined
              ? Number(body.discountAmount)
              : undefined,
          creditAccountId: body.creditAccountId,
          creditAccountName: body.creditAccountName,
        }
      );
      await syncActivityWithCloud();
      if (body.paymentMethod === "credit") {
        await pushCatalogToCloud();
      }
      return NextResponse.json({ orders });
    }

    if (body.action === "settle_courier") {
      const orders = settleCourierOrders(String(body.courierName || ""));
      await syncActivityWithCloud();
      return NextResponse.json({ orders });
    }

    if (body.action === "credit_transaction") {
      const updatedSettings = recordCreditAccountTransaction({
        accountId: body.accountId,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        type: body.type === "payment" ? "payment" : "debt",
        amount: Number(body.amount || 0),
        description: String(body.description || "Cari İşlem"),
      });
      await pushCatalogToCloud();
      return NextResponse.json({ settings: updatedSettings });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/orders error:", error);
    return NextResponse.json(
      { error: "İşlem gerçekleştirilemedi" },
      { status: 500 }
    );
  }
}


