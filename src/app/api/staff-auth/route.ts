import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/db";

const COOKIE_NAME = "restoran_staff_role";

export async function GET(req: NextRequest) {
  const role = req.cookies.get(COOKIE_NAME)?.value || null;
  return NextResponse.json({
    authenticated: role === "admin" || role === "kitchen",
    role,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = String(body.password || "").trim();
    const target = String(body.target || "kitchen"); // "admin" | "kitchen"

    const settings = getSettings();
    const adminPass = settings.securityConfig?.adminPassword || "admin1234";
    const kitchenPass = settings.securityConfig?.kitchenPassword || "1234";

    let grantedRole: "admin" | "kitchen" | null = null;

    if (password === adminPass) {
      // Yönetici şifresi hem Admin hem Mutfak ekranına girebilir
      grantedRole = "admin";
    } else if (target === "kitchen" && password === kitchenPass) {
      grantedRole = "kitchen";
    }

    if (!grantedRole) {
      return NextResponse.json(
        {
          error:
            target === "admin"
              ? "Yönetici (Admin) şifresi hatalı!"
              : "Mutfak / Personel şifresi hatalı!",
        },
        { status: 401 }
      );
    }

    const res = NextResponse.json({
      success: true,
      role: grantedRole,
    });

    res.cookies.set(COOKIE_NAME, grantedRole, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 gün
    });

    return res;
  } catch (error) {
    console.error("POST /api/staff-auth error:", error);
    return NextResponse.json({ error: "Giriş yapılamadı" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
