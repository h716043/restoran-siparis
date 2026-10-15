import { NextRequest, NextResponse } from "next/server";
import { exportFullBackup, importFullBackup } from "@/lib/db";
import {
  pullActivityFromCloud,
  pushCatalogToCloud,
  syncActivityWithCloud,
} from "@/lib/cloud-sync";

export async function GET(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    await pullActivityFromCloud(true);
    const backup = exportFullBackup();
    return NextResponse.json(backup);
  } catch (error) {
    console.error("GET /api/backup error:", error);
    return NextResponse.json(
      { error: "Yedek oluşturulamadı" },
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
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Geçersiz yedek dosyası" },
        { status: 400 }
      );
    }

    importFullBackup(body);
    await Promise.all([pushCatalogToCloud(), syncActivityWithCloud()]);

    return NextResponse.json({
      success: true,
      message: "Yedek başarıyla geri yüklendi ve bulut ile senkronize edildi!",
    });
  } catch (error) {
    console.error("POST /api/backup error:", error);
    return NextResponse.json(
      { error: "Yedek geri yüklenemedi" },
      { status: 500 }
    );
  }
}
