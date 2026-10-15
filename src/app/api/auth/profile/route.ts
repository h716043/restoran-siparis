import { NextRequest, NextResponse } from "next/server";
import {
  getAllUsers,
  getOrdersByCustomer,
  getUserByPhone,
  getWhatsAppLogs,
  updateUserAddresses,
} from "@/lib/db";
import {
  pullActivityFromCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";

export async function GET(req: NextRequest) {
  await pullActivityFromCloud();
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (phone) {
    const user = getUserByPhone(phone);
    const orders = getOrdersByCustomer(phone, user?.id);
    return NextResponse.json({ user, orders });
  }

  // Tüm üyeleri ve WhatsApp loglarını sadece Admin görebilir
  const role = req.cookies.get("restoran_staff_role")?.value;
  if (role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  }

  return NextResponse.json({
    users: getAllUsers(),
    whatsappLogs: getWhatsAppLogs(),
  });
}

export async function PUT(req: NextRequest) {
  try {
    await pullActivityFromCloud(true);
    const body = await req.json();
    const { phone, name, addresses } = body;
    if (!phone) {
      return NextResponse.json({ error: "Telefon gerekli" }, { status: 400 });
    }
    const updated = updateUserAddresses(phone, name, addresses || []);
    await syncActivityWithCloud();
    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("PUT /api/auth/profile error:", error);
    return NextResponse.json({ error: "Profil güncellenemedi" }, { status: 500 });
  }
}

