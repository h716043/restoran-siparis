import { NextRequest, NextResponse } from "next/server";
import {
  createOtpCode,
  getSettings,
  getUserByPhone,
  normalizePhone,
} from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  pullCatalogFromCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";

export async function POST(req: NextRequest) {
  try {
    await pullCatalogFromCloud();
    await syncActivityWithCloud();
    const body = await req.json();
    const rawPhone = String(body.phone || "").trim();
    const normalized = normalizePhone(rawPhone);

    if (normalized.length < 10) {
      return NextResponse.json(
        { error: "Lütfen geçerli bir cep telefonu numarası girin (Örn: 0532 123 45 67)." },
        { status: 400 }
      );
    }

    const existingUser = getUserByPhone(normalized);
    const { code } = createOtpCode(normalized);
    const settings = getSettings();

    const waMessage = `🔐 *${settings.name}*\n\nGiriş ve sipariş doğrulama kodunuz: *${code}*\n\nBu kod 5 dakika süreyle geçerlidir. Afiyet olsun!`;

    const waResult = await sendWhatsAppMessage(normalized, waMessage, "otp");

    // Hem üretilen OTP kodunu hem de WhatsApp kuyruk kaydını (queued_for_local) buluta hemen aktar
    await syncActivityWithCloud();

    return NextResponse.json({
      success: true,
      phone: normalized,
      isExistingUser: Boolean(existingUser),
      existingUserName: existingUser?.name || null,
      provider: waResult.provider,
      status: waResult.status,
      simulatedCode: waResult.status === "simulated" ? code : undefined,
      previewMessage: waResult.status === "simulated" ? waMessage : undefined,
    });
  } catch (error) {
    console.error("POST /api/auth/send-otp error:", error);
    return NextResponse.json(
      { error: "Doğrulama kodu gönderilemedi." },
      { status: 500 }
    );
  }
}

