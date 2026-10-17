import { NextRequest, NextResponse } from "next/server";
import { getOrders, getSettings, updateSettings } from "@/lib/db";
import { syncActivityWithCloud } from "@/lib/cloud-sync";
import {
  DEFAULT_SAMBAPOS_CONFIG,
  getResolvedPosConfig,
  sendOrderToSambaPos,
  testSambaPosConnection,
} from "@/lib/sambapos";

export async function GET() {
  try {
    const posConfig = getResolvedPosConfig();
    return NextResponse.json({ posIntegrationConfig: posConfig });
  } catch (err) {
    console.error("GET /api/pos-sync error:", err);
    return NextResponse.json(
      { error: "POS entegrasyon ayarları alınamadı" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const settings = getSettings();
    const role = req.cookies.get("restoran_staff_role")?.value;
    const isAuthorized = role === "admin" || role === "kitchen";

    if (!isAuthorized) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const body = await req.json();

    // 1) SambaPOS Ayarlarını Kaydetme
    if (body.action === "save_config") {
      if (role !== "admin") {
        return NextResponse.json(
          { error: "Sadece yönetici POS ayarlarını değiştirebilir" },
          { status: 403 }
        );
      }
      const nextSamba = {
        ...DEFAULT_SAMBAPOS_CONFIG,
        ...(settings.posIntegrationConfig?.sambaPos || {}),
        ...(body.sambaPos || {}),
      };
      const nextPosConfig = {
        activeProvider: nextSamba.enabled ? ("sambapos" as const) : ("none" as const),
        sambaPos: nextSamba,
      };
      const updatedSettings = updateSettings({
        posIntegrationConfig: nextPosConfig,
      });
      return NextResponse.json({
        ok: true,
        message: nextSamba.enabled
          ? "✅ SambaPOS entegrasyon ayarları kaydedildi ve aktif edildi!"
          : "ℹ️ SambaPOS entegrasyonu pasif olarak kaydedildi.",
        posIntegrationConfig: updatedSettings.posIntegrationConfig,
      });
    }

    // 2) SambaPOS Bağlantısını Test Etme
    if (body.action === "test_connection") {
      const result = await testSambaPosConnection(body.sambaPos);
      return NextResponse.json(result);
    }

    // 3) Tek Bir Siparişi Manuel Olarak SambaPOS'a Aktarma (veya Tekrar Gönderme)
    if (body.action === "sync_order") {
      const orderId = String(body.orderId || "").trim();
      if (!orderId) {
        return NextResponse.json(
          { ok: false, message: "Sipariş ID eksik" },
          { status: 400 }
        );
      }
      const res = await sendOrderToSambaPos(orderId, { force: true });
      if (res.ok) {
        await syncActivityWithCloud().catch(() => {});
      }
      return NextResponse.json(res);
    }

    // 4) Aktarılmamış Tüm Aktif Siparişleri Toplu Olarak SambaPOS'a Aktarma
    if (body.action === "sync_all_pending") {
      const activeOrders = getOrders().filter(
        (o) =>
          (o.status === "pending" ||
            o.status === "accepted" ||
            o.status === "ready") &&
          o.posSyncInfo?.status !== "synced"
      );
      let syncedCount = 0;
      let lastError = "";
      for (const ord of activeOrders) {
        const r = await sendOrderToSambaPos(ord, { force: true });
        if (r.ok) {
          syncedCount++;
        } else {
          lastError = r.message;
        }
      }
      if (syncedCount > 0) {
        await syncActivityWithCloud().catch(() => {});
      }
      return NextResponse.json({
        ok: syncedCount > 0 || activeOrders.length === 0,
        message:
          activeOrders.length === 0
            ? "Aktarılacak bekleyen sipariş bulunmuyor (tümü zaten aktarılmış)."
            : syncedCount > 0
            ? `✅ ${syncedCount} / ${activeOrders.length} sipariş SambaPOS'a başarıyla aktarıldı!`
            : lastError || "Siparişler aktarılamadı.",
        syncedCount,
      });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/pos-sync error:", err);
    return NextResponse.json(
      { ok: false, message: "POS aktarım işlemi sırasında hata oluştu" },
      { status: 500 }
    );
  }
}
