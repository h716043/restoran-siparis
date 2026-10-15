import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db";
import { testAndSyncCloudConnection } from "@/lib/cloud-sync";

export async function POST(req: NextRequest) {
  try {
    const role = req.cookies.get("restoran_staff_role")?.value;
    if (role !== "admin") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
    }

    const body = await req.json();
    if (body.cloudSyncConfig) {
      const current = getSettings();
      updateSettings({
        ...current,
        cloudSyncConfig: body.cloudSyncConfig,
      });
    }

    const result = await testAndSyncCloudConnection();
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const updated = updateSettings({
      ...getSettings(),
      cloudSyncConfig: {
        ...(getSettings().cloudSyncConfig || {
          enabled: true,
          tursoUrl: "",
          tursoAuthToken: "",
        }),
        lastSyncedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: result.message,
      settings: updated,
    });
  } catch (error) {
    console.error("POST /api/cloud-sync error:", error);
    return NextResponse.json(
      { error: "Senkronizasyon sırasında hata oluştu." },
      { status: 500 }
    );
  }
}
