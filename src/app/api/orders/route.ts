import { NextRequest, NextResponse } from "next/server";
import {
  createOrder,
  getOrders,
  getSettings,
  getUserByPhone,
  upsertUserAfterOtp,
} from "@/lib/db";
import { syncActivityWithCloud } from "@/lib/cloud-sync";

export async function GET(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin" && role !== "kitchen") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await syncActivityWithCloud();
    const orders = getOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: "Siparişler alınamadı" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await syncActivityWithCloud();
    const body = await req.json();
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "Sepet boş" }, { status: 400 });
    }

    const settings = getSettings();
    const requireAuth =
      settings.whatsappConfig?.requireAuthForDeliveryAndPickup !== false;

    // Paket Servis ve Gel-Al'da üyelik doğrulaması zorunluysa kontrol et
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

    // Kullanıcı kayıtlıysa ve yeni adres girdiyse adres defterine kaydet
    if (
      body.customerPhone &&
      body.orderType === "delivery" &&
      body.customerAddress
    ) {
      const u = getUserByPhone(body.customerPhone);
      if (u) {
        upsertUserAfterOtp(
          body.customerPhone,
          body.customerName,
          body.customerAddress
        );
      }
    }

    const order = createOrder({
      orderType: body.orderType,
      tableNumber: body.tableNumber,
      userId: body.userId,
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

