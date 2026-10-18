import { NextRequest, NextResponse } from "next/server";
import {
  adjustUserLoyaltyPoints,
  getAllUsers,
  getOrders,
  getOrdersByCustomer,
  getSettings,
  getUserByPhone,
  normalizePhone,
} from "@/lib/db";
import {
  pullActivityFromCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { exportCustomersToSambaPos } from "@/lib/sambapos";

function collectSiteCustomers() {
  const users = getAllUsers();
  const orders = getOrders();
  const settings = getSettings();
  const creditAccounts = settings.creditAccounts || [];

  const map = new Map<
    string,
    {
      id: string;
      userId: string | null;
      phone: string;
      name: string;
      address: string;
      loyaltyPoints: number;
      orderCount: number;
      totalSpent: number;
      lastOrderAt: string | null;
    }
  >();

  for (const u of users) {
    const norm = normalizePhone(u.phone);
    if (!norm) continue;
    map.set(norm, {
      id: u.id,
      userId: u.id,
      phone: u.phone,
      name: u.name,
      address: u.addresses?.[0]?.fullAddress || "",
      loyaltyPoints: Number(u.loyaltyPoints || 0),
      orderCount: 0,
      totalSpent: 0,
      lastOrderAt: null,
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
      if (!existing.lastOrderAt || o.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = o.createdAt;
      }
    } else {
      map.set(norm, {
        id: `crm-${norm}`,
        userId: null,
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

  for (const acc of creditAccounts) {
    const norm = normalizePhone(acc.customerPhone || "");
    const key =
      norm && norm.length >= 10
        ? norm
        : `cari:${acc.customerName.trim().toLocaleLowerCase("tr-TR")}`;
    const existing = map.get(key);
    if (existing) {
      if (
        (!existing.name || existing.name === "Müşteri") &&
        acc.customerName
      ) {
        existing.name = acc.customerName;
      }
      if (!existing.phone && acc.customerPhone) {
        existing.phone = acc.customerPhone;
      }
    } else if (acc.customerName.trim()) {
      map.set(key, {
        id: acc.id,
        userId: null,
        phone: acc.customerPhone || "",
        name: acc.customerName.trim(),
        address: "",
        loyaltyPoints: 0,
        orderCount: 0,
        totalSpent: 0,
        lastOrderAt: null,
      });
    }
  }

  return Array.from(map.values());
}

export async function GET(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin" && role !== "kitchen") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await pullActivityFromCloud();
    const { searchParams } = new URL(req.url);
    const phoneQuery = searchParams.get("phone");

    // 1. Kasa POS telefon numarası ile hızlı müşteri sorgulama (Sitedeki kayıtlı müşterilerden)
    if (phoneQuery) {
      const user = getUserByPhone(phoneQuery);
      const pastOrders = getOrdersByCustomer(phoneQuery, user?.id);
      return NextResponse.json({
        user,
        lastOrder: pastOrders[0] || null,
        orderCount: pastOrders.length,
      });
    }

    // 2. Admin CRM & Cari Müşteri Seçimi: Sitedeki tüm müşterileri (Üyeler + Sipariş geçmişi + Cari Hesaplar) birleştir
    const rawList = collectSiteCustomers();
    const nowMs = Date.now();
    const customers = rawList
      .map((c) => {
        const lastOrderMs = c.lastOrderAt ? new Date(c.lastOrderAt).getTime() : NaN;
        const daysSinceLastOrder = Number.isFinite(lastOrderMs)
          ? Math.max(0, Math.floor((nowMs - lastOrderMs) / (1000 * 60 * 60 * 24)))
          : null;
        const isVip = c.orderCount >= 5 || c.totalSpent >= 1500;
        const isInactive15Days =
          daysSinceLastOrder !== null ? daysSinceLastOrder >= 15 : c.orderCount === 0;
        return {
          ...c,
          daysSinceLastOrder,
          isVip,
          isInactive15Days,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);

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

    // Sitedeki tüm kayıtlı müşterileri (Üyeler + Sipariş Verenler + Cari Kartlar) SambaPOS V5'e aktar
    if (body.action === "export_to_sambapos") {
      await pullActivityFromCloud();
      const siteCustomers = collectSiteCustomers();
      const result = await exportCustomersToSambaPos(
        siteCustomers.map((c) => ({
          name: c.name,
          phone: c.phone,
          address: c.address,
        }))
      );
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (body.action === "send_campaign") {
      // Toplu kampanya gönderimi ({ recipients, messageTemplate }) veya tekil gönderim ({ phone, message })
      const rawRecipients: Array<{ phone: string; name?: string }> = Array.isArray(
        body.recipients
      )
        ? body.recipients
        : body.phone
        ? [{ phone: String(body.phone), name: body.name ? String(body.name) : "Müşterimiz" }]
        : [];

      const template = String(body.messageTemplate ?? body.message ?? "").trim();

      if (rawRecipients.length === 0 || !template) {
        return NextResponse.json(
          { error: "Telefon ve mesaj zorunludur" },
          { status: 400 }
        );
      }

      let sentCount = 0;
      for (const recipient of rawRecipients) {
        const phone = String(recipient.phone || "").trim();
        if (!phone) continue;
        const customerName = String(recipient.name || "Değerli Müşterimiz").trim();
        const personalizedMessage = template.replace(/\{isim\}/gi, customerName);
        await sendWhatsAppMessage(phone, personalizedMessage, "campaign");
        sentCount++;
      }

      await syncActivityWithCloud();
      return NextResponse.json({
        success: true,
        sentCount,
        message: `📲 ${sentCount} müşteriye WhatsApp kampanya mesajı gönderildi!`,
      });
    }

    if (body.action === "adjust_points") {
      const phone = String(body.phone || "").trim();
      const delta = Number(body.deltaPoints ?? body.delta ?? 0);
      const exactPoints =
        body.exactPoints !== undefined && body.exactPoints !== null
          ? Number(body.exactPoints)
          : undefined;
      const prevUser = getUserByPhone(phone);
      const prevPoints = Number(prevUser?.loyaltyPoints || 0);
      const updatedUser = adjustUserLoyaltyPoints(
        phone,
        delta,
        body.name ? String(body.name) : undefined,
        body.address ? String(body.address) : undefined,
        exactPoints
      );
      if (updatedUser && body.notifyWhatsApp) {
        const settings = getSettings();
        const actualDiff = Number(
          ((updatedUser.loyaltyPoints || 0) - prevPoints).toFixed(2)
        );
        if (actualDiff > 0) {
          const reasonNote = body.reason ? `\n📌 Not: _${String(body.reason).trim()}_` : "";
          const msg = `🎁 *${settings.name}*\n\nMerhaba *${updatedUser.name}*, cüzdanınıza *+${actualDiff.toFixed(
            2
          )} ${settings.currency}* Hediye Para Puan tanımlandı! 🎉${reasonNote}\n💰 Güncel Cüzdan Bakiyeniz: *${Number(
            updatedUser.loyaltyPoints || 0
          ).toFixed(2)} ${settings.currency}*\n\nKeyifli siparişler dileriz!`;
          await sendWhatsAppMessage(phone, msg, "campaign").catch(() => {});
        }
      }
      await syncActivityWithCloud();
      return NextResponse.json({ user: updatedUser });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/customers error:", error);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}

