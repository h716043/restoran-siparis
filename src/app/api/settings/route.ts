import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db";
import { pullCatalogFromCloud, pushCatalogToCloud } from "@/lib/cloud-sync";

export async function GET(req: NextRequest) {
  const role = req.cookies.get("restoran_staff_role")?.value;
  if (role !== "admin") {
    await pullCatalogFromCloud();
  }
  const raw = getSettings();
  if (role === "admin") {
    return NextResponse.json(raw);
  }
  return NextResponse.json({
    ...raw,
    securityConfig: undefined,
    cloudSyncConfig: undefined,
  });
}

export async function PUT(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const body = await req.json();
    const current = getSettings();
    const updated = updateSettings({
      ...current,
      ...body,
      securityConfig: body.securityConfig || current.securityConfig,
      cloudSyncConfig: body.cloudSyncConfig || current.cloudSyncConfig,
    });
    await pushCatalogToCloud();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json({ error: "Ayarlar kaydedilemedi" }, { status: 500 });
  }
}

