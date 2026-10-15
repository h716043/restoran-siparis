import { NextRequest, NextResponse } from "next/server";
import {
  createReservation,
  getReservations,
  getSettings,
  updateReservationStatus,
} from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { syncActivityWithCloud } from "@/lib/cloud-sync";

export async function GET(req: NextRequest) {
  try {
    await syncActivityWithCloud();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (phone) {
      const reservations = getReservations(phone);
      return NextResponse.json({ reservations });
    }

    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin" && role !== "kitchen") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const reservations = getReservations();
    return NextResponse.json({ reservations });
  } catch (error) {
    console.error("GET /api/reservations error:", error);
    return NextResponse.json(
      { error: "Rezervasyonlar alınamadı" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await syncActivityWithCloud();
    const body = await req.json();
    const customerName = String(body.customerName || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const guestCount = Number(body.guestCount || 2);
    const reservationDate = String(body.reservationDate || "").trim();
    const reservationTime = String(body.reservationTime || "").trim();
    const specialRequests = body.specialRequests
      ? String(body.specialRequests).trim()
      : undefined;

    if (
      !customerName ||
      !customerPhone ||
      !reservationDate ||
      !reservationTime
    ) {
      return NextResponse.json(
        { error: "Lütfen tüm zorunlu rezervasyon alanlarını doldurun." },
        { status: 400 }
      );
    }

    const reservation = createReservation({
      customerName,
      customerPhone,
      guestCount,
      reservationDate,
      reservationTime,
      specialRequests,
    });

    await syncActivityWithCloud();
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    console.error("POST /api/reservations error:", error);
    return NextResponse.json(
      { error: "Rezervasyon oluşturulamadı" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin" && role !== "kitchen") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await syncActivityWithCloud();
    const body = await req.json();
    const id = String(body.id || "");
    const status = body.status as "confirmed" | "rejected";
    const assignedTable = body.assignedTable
      ? String(body.assignedTable).trim()
      : undefined;
    const rejectReason = body.rejectReason
      ? String(body.rejectReason).trim()
      : undefined;

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID ve durum bilgisi gerekli" },
        { status: 400 }
      );
    }

    const updated = updateReservationStatus(
      id,
      status,
      assignedTable,
      rejectReason
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Rezervasyon bulunamadı" },
        { status: 404 }
      );
    }

    await syncActivityWithCloud();

    // Müşteriye otomatik WhatsApp rezervasyon bilgilendirme mesajı gönder
    const settings = getSettings();
    if (
      settings.whatsappConfig?.sendOrderUpdates !== false &&
      updated.customerPhone &&
      updated.customerPhone.replace(/\D/g, "").length >= 10
    ) {
      if (status === "confirmed") {
        const msg = `🎉 *${settings.name} - Masa Rezervasyonunuz Onaylandı!*\n\nSayın *${updated.customerName}*,\n📅 Tarih: *${updated.reservationDate}*\n⏰ Saat: *${updated.reservationTime}*\n👥 Kişi Sayısı: *${updated.guestCount} Kişi*${
          updated.assignedTable ? `\n🪑 Ayrılan Masa: *${updated.assignedTable}*` : ""
        }\n\nSizi ağırlamaktan mutluluk duyacağız!`;
        await sendWhatsAppMessage(updated.customerPhone, msg, "order_status");
      } else if (status === "rejected") {
        const msg = `⚠️ *${settings.name} - Masa Rezervasyon Bilgilendirmesi*\n\nSayın *${updated.customerName}*, *${updated.reservationDate} ${updated.reservationTime}* tarihli rezervasyon talebiniz maalesef onaylanamamıştır.\nSebep: ${
          updated.rejectReason || "Seçilen saatte uygun masamız bulunmamaktadır."
        }`;
        await sendWhatsAppMessage(updated.customerPhone, msg, "order_status");
      }
    }

    return NextResponse.json({ reservation: updated });
  } catch (error) {
    console.error("PATCH /api/reservations error:", error);
    return NextResponse.json(
      { error: "Rezervasyon güncellenemedi" },
      { status: 500 }
    );
  }
}

