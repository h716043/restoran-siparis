import { NextRequest, NextResponse } from "next/server";
import {
  adjustUserLoyaltyPoints,
  getAllUsers,
  getOrders,
  getOrdersByCustomer,
  getUserByPhone,
  normalizePhone,
} from "@/lib/db";
import {
  pullActivityFromCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin" && role !== "kitchen") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await pullActivityFromCloud();
    const { searchParams } = new URL(req.url);
    const phoneQuery = searchParams.get("phone");

    // 1. Kasa POS telefon numarası ile hızlı müşteri sorgulama
    if (phoneQuery) {
      const user = getUserByPhone(phoneQuery);
      const pastOrders = getOrdersByCustomer(phoneQuery, user?.id);
      return NextResponse.json({
        user,
        lastOrder: pastOrders[0] || null,
        orderCount: pastOrders.length,
      });
    }

    // 2. Admin CRM: Tüm müşterileri (Üyeler + Sipariş geçmişindeki numaralar) birleştir
    const users = getAllUsers();
    const orders = getOrders();

    const map = new Map<
      string,
      {
        id: string;
        phone: string;
        name: string;
        address: string;
        loyaltyPoints: number;
        orderCount: number;
        totalSpent: number;
        lastOrderAt: string;
      }
    >();

    for (const u of users) {
      const norm = normalizePhone(u.phone);
      if (!norm) continue;
      map.set(norm, {
        id: u.id,
        phone: u.phone,
        name: u.name,
        address: u.addresses?.[0]?.fullAddress || "",
        loyaltyPoints: Number(u.loyaltyPoints || 0),
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: u.lastLoginAt || u.createdAt,
      });
    }

    for (const o of orders) {
      if (o.status === "rejected") continue;
      const norm = normalizePhone(o.customerPhone || "");
      if (!norm || norm.length < 10) continue;

      const existing = map.get(norm);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += o.totalAmount;
        if (!existing.address && o.customerAddress) {
          existing.address = o.customerAddress;
        }
        if (o.createdAt > existing.lastOrderAt) {
          existing.lastOrderAt = o.createdAt;
        }
      } else {
        map.set(norm, {
          id: `crm-${norm}`,
          phone: norm,
          name: o.customerName || "Müşteri",
          address: o.customerAddress || "",
          loyaltyPoints: 0,
          orderCount: 1,
          totalSpent: o.totalAmount,
          lastOrderAt: o.createdAt,
        });
      }
    }

    const customers = Array.from(map.values()).sort(
      (a, b) => b.totalSpent - a.totalSpent
    );

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json(
      { error: "Müşteri listesi alınamadı" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();

    if (body.action === "send_campaign") {
      const phone = String(body.phone || "").trim();
      const message = String(body.message || "").trim();
      if (!phone || !message) {
        return NextResponse.json(
          { error: "Telefon ve mesaj zorunludur" },
          { status: 400 }
        );
      }
      const result = await sendWhatsAppMessage(phone, message, "campaign");
      await syncActivityWithCloud();
      return NextResponse.json({
        success: true,
        deliveryStatus: result.status,
      });
    }

    if (body.action === "adjust_points") {
      const phone = String(body.phone || "").trim();
      const delta = Number(body.delta || 0);
      const updatedUser = adjustUserLoyaltyPoints(phone, delta);
      await syncActivityWithCloud();
      return NextResponse.json({ user: updatedUser });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/customers error:", error);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
