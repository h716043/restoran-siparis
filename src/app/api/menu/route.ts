import { NextRequest, NextResponse } from "next/server";
import {
  getCategories,
  getMenuItems,
  getOrders,
  getSettings,
  saveMenuItem,
  deleteMenuItem,
  createCategory,
  deleteCategory,
  createReservation,
  updateReservationStatus,
  resetDailyMenuStocks,
  bulkUpdateMenuPrices,
} from "@/lib/db";
import {
  pullActivityFromCloud,
  pullCatalogFromCloud,
  pushCatalogToCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin") {
      await Promise.all([pullCatalogFromCloud(), pullActivityFromCloud()]);
    }
    const rawSettings = getSettings();
    const settings =
      role === "admin"
        ? rawSettings
        : {
            ...rawSettings,
            courierPins: undefined,
            waiterPins: undefined,
            securityConfig: undefined,
            cloudSyncConfig: undefined,
          };

    const categories = getCategories();
    const items = getMenuItems();
    const publicReviews = getOrders()
      .filter((o) => (o.rating || 0) >= 4)
      .slice(0, 12)
      .map((o) => {
        const parts = (o.customerName || "Müşteri").trim().split(/\s+/);
        const maskedName =
          parts.length > 1
            ? `${parts[0]} ${parts[parts.length - 1][0]}.`
            : parts[0];
        return {
          id: o.id,
          customerName: maskedName,
          rating: o.rating || 5,
          reviewText: o.reviewText || "Çok lezzetli ve hızlı servis, teşekkürler!",
          itemsSummary: o.items.map((i) => i.name).join(", "),
          reviewedAt: o.reviewedAt || o.updatedAt,
        };
      });

    return NextResponse.json({ settings, categories, items, publicReviews });
  } catch (error) {
    console.error("GET /api/menu error:", error);
    return NextResponse.json({ error: "Menü yüklenemedi" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 5. ÖZELLİK: Müşteri Online Masa Rezervasyonu Talebi (Herkese açık)
    if (body.type === "create_reservation") {
      const customerName = String(body.customerName || "").trim();
      const customerPhone = String(body.customerPhone || "").trim();
      const guests = Math.max(1, Number(body.guests || body.guestCount || 2));
      const date = String(body.date || body.reservationDate || "").trim();
      const time = String(body.time || body.reservationTime || "").trim();
      const note = body.note || body.specialRequests ? String(body.note || body.specialRequests).trim() : undefined;

      if (!customerName || !customerPhone || !date || !time) {
        return NextResponse.json(
          { error: "İsim, telefon, tarih ve saat zorunludur." },
          { status: 400 }
        );
      }

      const newRes = createReservation({
        customerName,
        customerPhone,
        guestCount: guests,
        reservationDate: date,
        reservationTime: time,
        specialRequests: note,
      });

      await syncActivityWithCloud();
      return NextResponse.json({ reservation: newRes, settings: getSettings() });
    }

    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin" && role !== "kitchen") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    // Personel / Admin Rezervasyon Durumu Güncelleme & Masa Atama
    if (body.type === "update_reservation") {
      const resId = String(body.reservationId || body.id || "");
      const nextStatus = body.status || "confirmed";
      const nextTable = body.tableNumber !== undefined ? String(body.tableNumber) : undefined;

      const updated = updateReservationStatus(
        resId,
        nextStatus,
        nextTable,
        body.rejectReason
      );
      if (!updated) {
        return NextResponse.json({ error: "Rezervasyon bulunamadı" }, { status: 404 });
      }

      const settings = getSettings();
      if (nextStatus === "confirmed" && updated.customerPhone) {
        const msg = `📅 *${settings.name} — Rezervasyon Onayı*\nSayın ${updated.customerName}, ${updated.reservationDate} saat ${updated.reservationTime} (${updated.guestCount} Kişilik)${
          nextTable ? ` Masa ${nextTable}` : ""
        } rezervasyonunuz onaylanmıştır. Sizi ağırlamaktan mutluluk duyarız!`;
        await sendWhatsAppMessage(updated.customerPhone, msg, "order_status");
      }

      await syncActivityWithCloud();
      return NextResponse.json({ reservation: updated, settings: getSettings() });
    }

    if (body.type === "reset_daily_stocks") {
      const refreshedItems = resetDailyMenuStocks(
        Number(body.defaultStock || 50)
      );
      await pushCatalogToCloud();
      return NextResponse.json({ items: refreshedItems });
    }

    if (body.type === "bulk_update_prices") {
      const catId = body.categoryId || "all";
      const beforeItems = getMenuItems();
      const updatedCount =
        catId === "all"
          ? beforeItems.length
          : beforeItems.filter((i) => i.categoryId === catId).length;
      const updatedItems = bulkUpdateMenuPrices({
        categoryId: catId,
        mode: body.mode === "fixed" ? "fixed" : "percent",
        value: Number(body.value || 0),
        rounding: body.rounding || "nearest_5",
        includeModifiers: Boolean(body.includeModifiers),
      });
      await pushCatalogToCloud();
      return NextResponse.json({ items: updatedItems, updatedCount });
    }

    if (body.type === "category") {
      const cat = createCategory({
        name: body.name,
        slug: body.slug || body.name.toLowerCase().replace(/\s+/g, "-"),
        sortOrder: Number(body.sortOrder || 99),
        icon: body.icon || "Utensils",
      });
      await pushCatalogToCloud();
      return NextResponse.json({ category: cat });
    } else {
      const item = saveMenuItem(body.item);
      await pushCatalogToCloud();
      return NextResponse.json({ item });
    }
  } catch (error) {
    console.error("POST /api/menu error:", error);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type") || "item";
    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }
    if (type === "category") {
      deleteCategory(id);
    } else {
      deleteMenuItem(id);
    }
    await pushCatalogToCloud();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/menu error:", error);
    return NextResponse.json({ error: "Silinemedi" }, { status: 500 });
  }
}

