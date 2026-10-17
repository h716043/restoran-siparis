import { NextRequest, NextResponse } from "next/server";
import { getOrders, getSettings, updateSettings } from "@/lib/db";
import { syncActivityWithCloud } from "@/lib/cloud-sync";
import {
  DEFAULT_SAMBAPOS_CONFIG,
  fetchSambaPosCatalog,
  fetchSambaPosTables,
  getResolvedPosConfig,
  sendOrderToSambaPos,
  syncSiteMenuToSambaPos,
  syncSiteTablesToSambaPos,
  testSambaPosConnection,
} from "@/lib/sambapos";
import {
  applyAdisyoOrderStatusUpdate,
  fetchAdisyoCatalog,
  getDefaultAdisyoPosConfig,
  getResolvedAdisyoConfig,
  syncOrderStatusesFromAdisyoPos,
  syncOrderToAdisyoPos,
  syncSiteMenuToAdisyo,
  testAdisyoPosConnection,
} from "@/lib/adisyo";
import {
  applyCustomPosOrderStatusUpdate,
  getDefaultCustomPosConfig,
  getResolvedCustomPosConfig,
  syncOrderStatusesFromCustomPos,
  syncOrderToCustomPos,
  syncSiteMenuToCustomPos,
  testCustomPosConnection,
} from "@/lib/custom-pos";

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

    // 1) SambaPOS, Adisyo ve NarPOS / Kerzz / Özel API Ayarlarını Kaydetme
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
      const nextAdisyo = {
        ...getDefaultAdisyoPosConfig(),
        ...(settings.posIntegrationConfig?.adisyoPos || {}),
        ...(body.adisyoPos || {}),
      };
      const nextCustomPos = {
        ...getDefaultCustomPosConfig(),
        ...(settings.posIntegrationConfig?.customPos || {}),
        ...(body.customPos || {}),
      };
      const nextActiveProvider =
        body.activeProvider ||
        (nextCustomPos.enabled
          ? ("custom_pos" as const)
          : nextAdisyo.enabled
          ? ("adisyo" as const)
          : nextSamba.enabled
          ? ("sambapos" as const)
          : ("none" as const));

      const nextPosConfig = {
        activeProvider: nextActiveProvider,
        sambaPos: nextSamba,
        adisyoPos: nextAdisyo,
        customPos: nextCustomPos,
      };
      const updatedSettings = updateSettings({
        ...settings,
        posIntegrationConfig: nextPosConfig,
      });
      return NextResponse.json({
        ok: true,
        message: "✅ POS entegrasyon ayarları başarıyla kaydedildi!",
        posIntegrationConfig: updatedSettings.posIntegrationConfig,
      });
    }

    // 2) SambaPOS Bağlantısını Test Etme
    if (body.action === "test_connection") {
      const result = await testSambaPosConnection(
        body.sambaPos || body.sambaPosConfig
      );
      return NextResponse.json(result);
    }

    // 2B) Adisyo / Kurye POS Bağlantısını Test Etme
    if (body.action === "test_adisyo_connection") {
      const result = await testAdisyoPosConnection(
        body.adisyoPos || body.adisyoConfig
      );
      return NextResponse.json(result);
    }

    // 2C) NarPOS / Kerzz / Özel API Bağlantısını Test Etme
    if (body.action === "test_custom_pos_connection") {
      const result = await testCustomPosConnection(
        body.customPos || body.customPosConfig
      );
      return NextResponse.json(result);
    }

    // 3) SambaPOS Mevcut Ürün Kataloğunu & Site Ürün Eşleşme Durumunu Çekme
    if (body.action === "fetch_samba_catalog") {
      const catalog = await fetchSambaPosCatalog(
        body.sambaPos || body.sambaPosConfig
      );
      return NextResponse.json(catalog);
    }

    // 3B) Adisyo / Kurye POS Ürün Kataloğunu Çekme
    if (body.action === "fetch_adisyo_catalog") {
      const catalog = await fetchAdisyoCatalog(
        body.adisyoPos || body.adisyoConfig
      );
      return NextResponse.json(catalog);
    }

    // 4) Sitedeki Ürünleri (Tümünü veya Seçileni) SambaPOS'a Aktarma & Eşitleme
    if (body.action === "sync_menu_to_samba") {
      if (role !== "admin") {
        return NextResponse.json(
          { error: "Sadece yönetici menü aktarımı yapabilir" },
          { status: 403 }
        );
      }
      const result = await syncSiteMenuToSambaPos({
        itemIds: Array.isArray(body.itemIds) ? body.itemIds : undefined,
        updatePrices: body.updatePrices !== false,
        syncScreenMenu: body.syncScreenMenu !== false,
        customConfig: body.sambaPos || body.sambaPosConfig,
      });
      return NextResponse.json(result);
    }

    // 4B) Sitedeki Ürünleri Adisyo / Kurye POS ile Eşitleme
    if (body.action === "sync_menu_to_adisyo") {
      if (role !== "admin") {
        return NextResponse.json(
          { error: "Sadece yönetici menü aktarımı yapabilir" },
          { status: 403 }
        );
      }
      const result = await syncSiteMenuToAdisyo({
        itemIds: Array.isArray(body.itemIds) ? body.itemIds : undefined,
        updatePrices: body.updatePrices !== false,
      });
      return NextResponse.json(result);
    }

    // 4C) Sitedeki Ürünleri NarPOS / Kerzz / Özel API ile Eşitleme
    if (body.action === "sync_menu_to_custom_pos") {
      if (role !== "admin") {
        return NextResponse.json(
          { error: "Sadece yönetici menü aktarımı yapabilir" },
          { status: 403 }
        );
      }
      const result = await syncSiteMenuToCustomPos({
        itemIds: Array.isArray(body.itemIds) ? body.itemIds : undefined,
        updatePrices: body.updatePrices !== false,
      });
      return NextResponse.json(result);
    }

    // 5) Tekil Ürün Eşleştirmesini (Site Ürünü -> SambaPOS Ürün Adı) Kaydetme
    if (body.action === "save_product_mapping") {
      if (role !== "admin") {
        return NextResponse.json(
          { error: "Sadece yönetici ürün eşleştirmesi değiştirebilir" },
          { status: 403 }
        );
      }
      const currentSamba = {
        ...DEFAULT_SAMBAPOS_CONFIG,
        ...(settings.posIntegrationConfig?.sambaPos || {}),
      };
      const nextMappings: Record<string, string> = {
        ...(currentSamba.productMappings || {}),
        ...(body.productMappings || {}),
      };
      if (body.siteItemId !== undefined) {
        const val = String(body.sambaProductName || "").trim();
        if (val) {
          nextMappings[String(body.siteItemId)] = val;
        } else {
          delete nextMappings[String(body.siteItemId)];
        }
      }
      const nextSamba = {
        ...currentSamba,
        productMappings: nextMappings,
      };
      const updatedSettings = updateSettings({
        ...settings,
        posIntegrationConfig: {
          activeProvider:
            settings.posIntegrationConfig?.activeProvider ||
            (nextSamba.enabled ? "sambapos" : "none"),
          sambaPos: nextSamba,
          adisyoPos: getResolvedAdisyoConfig(
            settings.posIntegrationConfig?.adisyoPos
          ),
          customPos: getResolvedCustomPosConfig(
            settings.posIntegrationConfig?.customPos
          ),
        },
      });
      const catalog = await fetchSambaPosCatalog(nextSamba);
      return NextResponse.json({
        ok: true,
        message: "✅ SambaPOS ürün eşleştirmesi kaydedildi.",
        posIntegrationConfig: updatedSettings.posIntegrationConfig,
        catalog,
      });
    }

    // 5B) Tekil Ürün Eşleştirmesini (Site Ürünü -> Adisyo Ürün Kodu / Adı) Kaydetme
    if (body.action === "save_adisyo_product_mapping") {
      if (role !== "admin") {
        return NextResponse.json(
          { error: "Sadece yönetici ürün eşleştirmesi değiştirebilir" },
          { status: 403 }
        );
      }
      const currentAdisyo = getResolvedAdisyoConfig(
        settings.posIntegrationConfig?.adisyoPos
      );
      const nextMappings: Record<string, string> = {
        ...(currentAdisyo.productMappings || {}),
        ...(body.productMappings || {}),
      };
      if (body.siteItemId !== undefined) {
        const val = String(body.adisyoProductName || "").trim();
        if (val) {
          nextMappings[String(body.siteItemId)] = val;
        } else {
          delete nextMappings[String(body.siteItemId)];
        }
      }
      const nextAdisyo = {
        ...currentAdisyo,
        productMappings: nextMappings,
      };
      const updatedSettings = updateSettings({
        ...settings,
        posIntegrationConfig: {
          activeProvider:
            settings.posIntegrationConfig?.activeProvider || "adisyo",
          sambaPos: {
            ...DEFAULT_SAMBAPOS_CONFIG,
            ...(settings.posIntegrationConfig?.sambaPos || {}),
          },
          adisyoPos: nextAdisyo,
          customPos: getResolvedCustomPosConfig(
            settings.posIntegrationConfig?.customPos
          ),
        },
      });
      const catalog = await fetchAdisyoCatalog(nextAdisyo);
      return NextResponse.json({
        ok: true,
        message: "✅ Adisyo / Kurye POS ürün eşleştirmesi kaydedildi.",
        posIntegrationConfig: updatedSettings.posIntegrationConfig,
        catalog,
      });
    }

    // 5C) Tekil Ürün Eşleştirmesini (Site Ürünü -> NarPOS / Kerzz / Özel API PLU Kodu) Kaydetme
    if (body.action === "save_custom_pos_product_mapping") {
      if (role !== "admin") {
        return NextResponse.json(
          { error: "Sadece yönetici ürün eşleştirmesi değiştirebilir" },
          { status: 403 }
        );
      }
      const currentCustomPos = getResolvedCustomPosConfig(
        settings.posIntegrationConfig?.customPos
      );
      const nextMappings: Record<string, string> = {
        ...(currentCustomPos.productMappings || {}),
        ...(body.productMappings || {}),
      };
      if (body.siteItemId !== undefined) {
        const val = String(body.customPosProductName || "").trim();
        if (val) {
          nextMappings[String(body.siteItemId)] = val;
        } else {
          delete nextMappings[String(body.siteItemId)];
        }
      }
      const nextCustomPos = {
        ...currentCustomPos,
        productMappings: nextMappings,
      };
      const updatedSettings = updateSettings({
        ...settings,
        posIntegrationConfig: {
          activeProvider:
            settings.posIntegrationConfig?.activeProvider || "custom_pos",
          sambaPos: {
            ...DEFAULT_SAMBAPOS_CONFIG,
            ...(settings.posIntegrationConfig?.sambaPos || {}),
          },
          adisyoPos: getResolvedAdisyoConfig(
            settings.posIntegrationConfig?.adisyoPos
          ),
          customPos: nextCustomPos,
        },
      });
      return NextResponse.json({
        ok: true,
        message: "✅ NarPOS / Kerzz / Özel API PLU eşleştirmesi kaydedildi.",
        posIntegrationConfig: updatedSettings.posIntegrationConfig,
      });
    }

    // 6) Tek Bir Siparişi Manuel Olarak POS'a Aktarma (SambaPOS, Adisyo veya NarPOS/Kerzz/Özel API)
    if (
      body.action === "sync_order" ||
      body.action === "sync_order_to_adisyo" ||
      body.action === "sync_order_to_custom_pos"
    ) {
      const orderId = String(body.orderId || "").trim();
      if (!orderId) {
        return NextResponse.json(
          { ok: false, message: "Sipariş ID eksik" },
          { status: 400 }
        );
      }
      const targetProvider =
        body.action === "sync_order_to_custom_pos" ||
        body.provider === "custom_pos"
          ? "custom_pos"
          : body.action === "sync_order_to_adisyo" || body.provider === "adisyo"
          ? "adisyo"
          : body.provider === "sambapos"
          ? "sambapos"
          : settings.posIntegrationConfig?.activeProvider === "custom_pos"
          ? "custom_pos"
          : settings.posIntegrationConfig?.activeProvider === "adisyo"
          ? "adisyo"
          : "sambapos";

      const res =
        targetProvider === "custom_pos"
          ? await syncOrderToCustomPos(orderId, { force: true })
          : targetProvider === "adisyo"
          ? await syncOrderToAdisyoPos(orderId, { force: true })
          : await sendOrderToSambaPos(orderId, { force: true });

      if (res.ok) {
        await syncActivityWithCloud().catch(() => {});
      }
      return NextResponse.json(res);
    }

    // 7) Aktarılmamış Tüm Siparişleri Toplu Olarak POS'a Aktarma
    if (body.action === "sync_all_pending") {
      const targetProvider =
        body.provider === "custom_pos"
          ? "custom_pos"
          : body.provider === "adisyo"
          ? "adisyo"
          : body.provider === "sambapos"
          ? "sambapos"
          : settings.posIntegrationConfig?.activeProvider === "custom_pos"
          ? "custom_pos"
          : settings.posIntegrationConfig?.activeProvider === "adisyo"
          ? "adisyo"
          : "sambapos";

      const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
      const activeOrders = getOrders().filter(
        (o) =>
          o.status !== "rejected" &&
          o.posSyncInfo?.status !== "synced" &&
          new Date(o.createdAt).getTime() >= cutoffMs
      );
      let syncedCount = 0;
      let lastError = "";
      for (const ord of activeOrders) {
        const r =
          targetProvider === "custom_pos"
            ? await syncOrderToCustomPos(ord, { force: true })
            : targetProvider === "adisyo"
            ? await syncOrderToAdisyoPos(ord, { force: true })
            : await sendOrderToSambaPos(ord, { force: true });
        if (r.ok) {
          syncedCount++;
        } else {
          lastError = r.message;
        }
      }
      if (syncedCount > 0) {
        await syncActivityWithCloud().catch(() => {});
      }
      const providerLabel =
        targetProvider === "custom_pos"
          ? "NarPOS / Kerzz / Özel API"
          : targetProvider === "adisyo"
          ? "Adisyo / Kurye POS"
          : "SambaPOS";
      return NextResponse.json({
        ok: syncedCount > 0 || activeOrders.length === 0,
        message:
          activeOrders.length === 0
            ? "Aktarılacak bekleyen sipariş bulunmuyor (tümü zaten aktarılmış)."
            : syncedCount > 0
            ? `✅ ${syncedCount} / ${activeOrders.length} sipariş ${providerLabel}'a başarıyla aktarıldı!`
            : lastError || "Siparişler aktarılamadı.",
        syncedCount,
      });
    }

    // 8) SambaPOS'ta Kurye Atanan veya Teslim Edilen Siparişleri Siteye Çekme
    if (body.action === "sync_from_samba") {
      const { syncOrderStatusesFromSambaPos } = await import("@/lib/sambapos");
      const res = await syncOrderStatusesFromSambaPos({
        customConfig: body.sambaPos || body.sambaPosConfig,
        force: true,
      });
      return NextResponse.json(res);
    }

    // 8B) Adisyo / Kurye POS'tan Kurye Atanan veya Teslim Edilen Siparişleri Siteye Çekme
    if (body.action === "sync_from_adisyo") {
      const res = await syncOrderStatusesFromAdisyoPos({ force: true });
      if (res.updatedCount > 0) {
        await syncActivityWithCloud().catch(() => {});
      }
      return NextResponse.json(res);
    }

    // 8C) NarPOS / Kerzz / Özel API'den Kurye Atanan veya Teslim Edilen Siparişleri Siteye Çekme
    if (body.action === "sync_from_custom_pos") {
      const res = await syncOrderStatusesFromCustomPos({ force: true });
      if (res.updatedCount > 0) {
        await syncActivityWithCloud().catch(() => {});
      }
      return NextResponse.json(res);
    }

    // 9) Adisyo / Kurye POS üzerinden Kurye Atama veya Teslim Edildi Simülasyonu / Anlık Tetikleme
    if (body.action === "simulate_adisyo_event") {
      const res = applyAdisyoOrderStatusUpdate({
        orderId: body.orderId ? String(body.orderId) : undefined,
        orderNumber: body.orderNumber ? Number(body.orderNumber) : undefined,
        externalTicketId: body.externalTicketId
          ? String(body.externalTicketId)
          : undefined,
        courierName: body.courierName ? String(body.courierName) : undefined,
        status: body.status ? String(body.status) : undefined,
      });
      if (res.updated) {
        await syncActivityWithCloud().catch(() => {});
      }
      return NextResponse.json(res);
    }

    // 9B) NarPOS / Kerzz / Özel API üzerinden Kurye Atama veya Teslim Edildi Simülasyonu / Anlık Tetikleme
    if (body.action === "simulate_custom_pos_event") {
      const res = applyCustomPosOrderStatusUpdate({
        orderId: body.orderId ? String(body.orderId) : undefined,
        orderNumber: body.orderNumber ? Number(body.orderNumber) : undefined,
        externalTicketId: body.externalTicketId
          ? String(body.externalTicketId)
          : undefined,
        courierName: body.courierName ? String(body.courierName) : undefined,
        status: body.status ? String(body.status) : undefined,
      });
      if (res.updated) {
        await syncActivityWithCloud().catch(() => {});
      }
      return NextResponse.json(res);
    }

    // 10) SambaPOS'taki Kayıtlı Masaları Okuma / Siteye Çekme
    if (body.action === "fetch_samba_tables") {
      const res = await fetchSambaPosTables({
        importToSite: Boolean(body.importToSite),
        customConfig: body.sambaPos || body.sambaPosConfig,
      });
      return NextResponse.json(res);
    }

    // 11) Sitedeki Masa Listesini (Ekleme / İsim Düzenleme / Silme) Kaydetme ve SambaPOS ile Eşitleme
    if (body.action === "sync_tables_to_samba") {
      const res = await syncSiteTablesToSambaPos({
        tables: Array.isArray(body.tables) ? body.tables : [],
        renameMap:
          body.renameMap && typeof body.renameMap === "object"
            ? body.renameMap
            : undefined,
        deleteRemoved: body.deleteRemoved !== false,
        syncToSamba: body.syncToSamba !== false,
        customConfig: body.sambaPos || body.sambaPosConfig,
      });
      return NextResponse.json(res);
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
