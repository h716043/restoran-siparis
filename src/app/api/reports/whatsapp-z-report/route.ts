import { NextRequest, NextResponse } from "next/server";
import { getOrders, getSettings, updateSettings } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const settings = getSettings();
    const currency = settings.currency || "₺";

    const rawPhone = String(
      body.targetPhone ||
        settings.ownerReportPhone ||
        settings.phone ||
        ""
    ).trim();

    if (!rawPhone) {
      return NextResponse.json(
        {
          error:
            "Rapor gönderilecek Patron WhatsApp numarası tanımlı değil. Lütfen telefon numarası girin.",
        },
        { status: 400 }
      );
    }

    if (body.saveOwnerPhone && body.targetPhone) {
      updateSettings({
        ...settings,
        ownerReportPhone: String(body.targetPhone).trim(),
      });
    }

    const period: "today" | "all" =
      body.period === "all" ? "all" : "today";
    const now = new Date();
    const todayStr = now.toLocaleDateString("tr-TR");

    const allOrders = getOrders();
    const filteredOrders =
      period === "today"
        ? allOrders.filter(
            (o) =>
              new Date(o.createdAt).toLocaleDateString("tr-TR") === todayStr
          )
        : allOrders;

    const validOrders = filteredOrders.filter((o) => o.status !== "rejected");
    const rejectedOrders = filteredOrders.filter((o) => o.status === "rejected");

    const grossRevenue = validOrders.reduce((s, o) => s + o.totalAmount, 0);
    const totalDiscounts = validOrders.reduce(
      (s, o) => s + (o.discountAmount || 0),
      0
    );

    const cashTotal = validOrders
      .filter((o) => o.paymentMethod === "cash")
      .reduce((s, o) => s + o.totalAmount, 0);
    const cardTotal = validOrders
      .filter(
        (o) =>
          o.paymentMethod === "card_at_door" ||
          o.paymentMethod === "pos_at_table"
      )
      .reduce((s, o) => s + o.totalAmount, 0);
    const onlineTotal = validOrders
      .filter((o) => (o.paymentMethod as string) === "online")
      .reduce((s, o) => s + o.totalAmount, 0);
    const creditTotal = validOrders
      .filter((o) => o.paymentMethod === "credit")
      .reduce((s, o) => s + o.totalAmount, 0);

    const deliveryOrders = validOrders.filter((o) => o.orderType === "delivery");
    const dineInOrders = validOrders.filter((o) => o.orderType === "dine_in");
    const pickupOrders = validOrders.filter((o) => o.orderType === "pickup");

    const todayIsoPrefix = now.toISOString().slice(0, 10);
    const expenses = (settings.cashExpenses || []).filter((ex) =>
      period === "today" ? ex.createdAt?.startsWith(todayIsoPrefix) : true
    );
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const netCashInDrawer = cashTotal - totalExpense;

    // En çok satan 5 ürün
    const itemStats: Record<string, { qty: number; rev: number }> = {};
    for (const ord of validOrders) {
      for (const item of ord.items) {
        if (!itemStats[item.name]) {
          itemStats[item.name] = { qty: 0, rev: 0 };
        }
        itemStats[item.name].qty += item.quantity;
        itemStats[item.name].rev += item.totalPrice;
      }
    }
    const topItems = Object.entries(itemStats)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);

    const topItemsLines =
      topItems.length > 0
        ? topItems
            .map(
              ([name, st], idx) =>
                `  ${idx + 1}. ${name}: *${st.qty} adet* (${st.rev.toFixed(0)} ${currency})`
            )
            .join("\n")
        : "  • Henüz ürün satışı yok";

    const reportMessage = [
      `📊 *${settings.name || "RESTORAN"} — GÜN SONU (Z) RAPORU*`,
      `📅 Tarih: *${todayStr}* (${now.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
      })})`,
      `────────────────────`,
      `💰 *NET CİRO:* *${grossRevenue.toFixed(2)} ${currency}*`,
      `🧾 Toplam Sipariş: *${validOrders.length} Adet* (İptal: ${rejectedOrders.length})`,
      totalDiscounts > 0
        ? `🏷️ Uygulanan İndirim: ${totalDiscounts.toFixed(2)} ${currency}`
        : null,
      `────────────────────`,
      `💳 *ÖDEME DAĞILIMI:*`,
      `  • 💵 Nakit: *${cashTotal.toFixed(2)} ${currency}*`,
      `  • 💳 Kredi Kartı / POS: *${cardTotal.toFixed(2)} ${currency}*`,
      onlineTotal > 0
        ? `  • 🌐 Online Ödeme: *${onlineTotal.toFixed(2)} ${currency}*`
        : null,
      creditTotal > 0
        ? `  • 📒 Veresiye / Cari: *${creditTotal.toFixed(2)} ${currency}*`
        : null,
      `────────────────────`,
      `🛵 *KANAL DAĞILIMI:*`,
      `  • 🪑 Masada Servis: ${dineInOrders.length} sipariş (${dineInOrders
        .reduce((s, o) => s + o.totalAmount, 0)
        .toFixed(0)} ${currency})`,
      `  • 🛵 Paket Servis: ${deliveryOrders.length} sipariş (${deliveryOrders
        .reduce((s, o) => s + o.totalAmount, 0)
        .toFixed(0)} ${currency})`,
      `  • 🛍️ Gel-Al: ${pickupOrders.length} sipariş (${pickupOrders
        .reduce((s, o) => s + o.totalAmount, 0)
        .toFixed(0)} ${currency})`,
      `────────────────────`,
      `📉 *KASA & GİDER ÖZETİ:*`,
      `  • Günlük Nakit Gider: ${totalExpense.toFixed(2)} ${currency}`,
      `  • 🏦 *Kasadaki Net Nakit:* *${netCashInDrawer.toFixed(2)} ${currency}*`,
      `────────────────────`,
      `🏆 *EN ÇOK SATAN 5 ÜRÜN:*`,
      topItemsLines,
    ]
      .filter(Boolean)
      .join("\n");

    const sendRes = await sendWhatsAppMessage(
      rawPhone,
      reportMessage,
      "order_status"
    );

    return NextResponse.json({
      success: sendRes.success,
      phone: rawPhone,
      provider: sendRes.provider,
      status: sendRes.status,
      reportMessage,
    });
  } catch (err) {
    console.error("WhatsApp Z raporu gönderilemedi:", err);
    return NextResponse.json(
      { error: "WhatsApp Z raporu oluşturulurken hata oluştu" },
      { status: 500 }
    );
  }
}
