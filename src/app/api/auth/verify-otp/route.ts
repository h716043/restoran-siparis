import { NextRequest, NextResponse } from "next/server";
import { upsertUserAfterOtp, verifyOtpCode } from "@/lib/db";
import { syncActivityWithCloud } from "@/lib/cloud-sync";

export async function POST(req: NextRequest) {
  try {
    await syncActivityWithCloud();
    const body = await req.json();
    const { phone, code, name, address } = body;

    if (!phone || !code) {
      return NextResponse.json(
        { error: "Telefon numarası ve 6 haneli doğrulama kodu gereklidir." },
        { status: 400 }
      );
    }

    const isValid = verifyOtpCode(String(phone), String(code));
    if (!isValid) {
      return NextResponse.json(
        { error: "Doğrulama kodu hatalı veya süresi dolmuş. Lütfen tekrar deneyin." },
        { status: 401 }
      );
    }

    const user = upsertUserAfterOtp(String(phone), name, address);
    await syncActivityWithCloud();
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("POST /api/auth/verify-otp error:", error);
    return NextResponse.json(
      { error: "Doğrulama işlemi başarısız oldu." },
      { status: 500 }
    );
  }
}

