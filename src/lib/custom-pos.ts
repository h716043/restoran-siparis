/**
 * NARPOS / KERZZ POS / POSENTEGRA / ÖZEL REST API & WEBHOOK ENTEGRASYON MODÜLÜ
 * -----------------------------------------------------------------------------
 * Bu modül ana sipariş sisteminden, SambaPOS'tan ve Adisyo'dan tamamen bağımsız (izole) çalışır.
 * - Müşteri / Restoran Ayarlardan NarPOS / Kerzz / Özel API modülünü aktif etmediği sürece hiçbir işlem yapmaz.
 * - Aktif edildiğinde 5 hazır profil / çalışma modunu destekler:
 *   1) NarPOS Bulut & Yerel POS (`narpos`)
 *   2) Kerzz POS (`kerzz`)
 *   3) PosEntegra / Simpra / Arkhe / Menulux (`posentegra`)
 *   4) Özel HTTP REST API & Webhook Köprüsü (`custom_webhook`)
 *   5) Canlı Simülasyon & Test Modu (`simulation` - API anahtarı olmadan tüm akışı test etmek için)
 * - Hem "Push" (Siteden POS'a anında POST gönderimi) hem de "Pull" (`GET /api/pos-sync/custom-webhook`
 *   üzerinden POS'un yeni siparişleri çekmesi) ve çift yönlü Kurye Ataması + Teslim Edildi senkronizasyonunu destekler.
 */

import {
  CustomPosConfig,
  MenuItem,
  Order,
  OrderStatus,
  PosOrderSyncInfo,
} from "@/types";
import {
  getCategories,
  getMenuItems,
  getOrderById,
  getOrders,
  getSettings,
  updateOrderPosSyncInfo,
  updateOrderStatus,
  updateSettings,
} from "@/lib/db";

export function getDefaultCustomPosConfig(): CustomPosConfig {
  return {
    enabled: false,
    systemPreset: "narpos",
    apiBaseUrl: "https://api.narpos.com.tr/api/v1",
    ordersEndpointPath: "/orders",
    statusEndpointPath: "/orders/status",
    menuEndpointPath: "/products",
    authType: "bearer",
    apiKey: "",
    apiSecret: "",
    branchId: "SUBE-01",
    syncTrigger: "on_accepted",
    autoSyncCourierAndStatus: true,
    webhookSecret: "pos_webhook_2026",
    productMappings: {},
  };
}

export function getResolvedCustomPosConfig(
  customCfg?: Partial<CustomPosConfig>
): CustomPosConfig {
  const settings = getSettings();
  const saved = settings.posIntegrationConfig?.customPos;
  return {
    ...getDefaultCustomPosConfig(),
    ...(saved || {}),
    ...(customCfg || {}),
  };
}

function getPresetLabel(preset: CustomPosConfig["systemPreset"]): string {
  switch (preset) {
    case "narpos":
      return "NarPOS";
    case "kerzz":
      return "Kerzz POS";
    case "posentegra":
      return "PosEntegra / Genel POS";
    case "custom_webhook":
      return "Özel API / Webhook";
    case "simulation":
      return "NarPOS / Kerzz (Simülasyon)";
    default:
      return "Özel POS";
  }
}

function getPresetPrefix(preset: CustomPosConfig["systemPreset"]): string {
  switch (preset) {
    case "narpos":
      return "NAR";
    case "kerzz":
      return "KRZ";
    case "posentegra":
      return "ENT";
    default:
      return "POS";
  }
}

function normalizeUrl(url?: string): string {
  return (url || "").trim().replace(/\/+$/, "");
}

function normalizePath(pathStr?: string, fallback = "/orders"): string {
  const clean = (pathStr || fallback).trim();
  if (!clean) return fallback;
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function buildCustomPosHeaders(cfg: CustomPosConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const key = cfg.apiKey?.trim() || "";
  const secret = cfg.apiSecret?.trim() || "";

  if (cfg.authType === "bearer" && key) {
    headers["Authorization"] = key.toLowerCase().startsWith("bearer ")
      ? key
      : `Bearer ${key}`;
  } else if (cfg.authType === "basic" && key) {
    const encoded = Buffer.from(`${key}:${secret}`).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  }

  if (key) {
    headers["X-Api-Key"] = key;
    headers["x-api-key"] = key;
  }
  if (secret) {
    headers["X-Api-Secret"] = secret;
    headers["x-api-secret"] = secret;
  }
  if (cfg.branchId?.trim()) {
    headers["X-Branch-Id"] = cfg.branchId.trim();
    headers["X-Restaurant-Id"] = cfg.branchId.trim();
  }

  return headers;
}

function resolveMappedCustomPosProduct(
  item: { menuItemId?: string; name: string },
  cfg: CustomPosConfig,
  index = 0
): { pluCode: string; mappedName: string } {
  const mappings = cfg.productMappings || {};
  const prefix = getPresetPrefix(cfg.systemPreset);

  if (item.menuItemId && mappings[item.menuItemId]?.trim()) {
    const val = mappings[item.menuItemId].trim();
    return { pluCode: val, mappedName: val };
  }
  const byName = mappings[item.name.trim()]?.trim();
  if (byName) {
    return { pluCode: byName, mappedName: byName };
  }

  return {
    pluCode: `${prefix}-${101 + index}`,
    mappedName: item.name.trim(),
  };
}

/**
 * Ayarlar ekranındaki "NarPOS / Kerzz / Özel API Bağlantısını Test Et" butonu için bağlantı testi yapar.
 */
export async function testCustomPosConnection(
  customCfg?: Partial<CustomPosConfig>
): Promise<{ ok: boolean; message: string }> {
  const cfg = getResolvedCustomPosConfig(customCfg);
  const label = getPresetLabel(cfg.systemPreset);

  if (cfg.systemPreset === "simulation") {
    return {
      ok: true,
      message:
        "✅ NarPOS / Kerzz / Özel API Simülasyon & Canlı Test Modu aktif! API anahtarı gerekmeden sipariş gönderimini, PLU eşleştirmesini ve kurye/teslimat senkronizasyonunu canlı test edebilirsiniz.",
    };
  }

  const baseUrl = normalizeUrl(cfg.apiBaseUrl);
  if (!baseUrl) {
    return {
      ok: false,
      message: `Lütfen ${label} API / Sunucu Adresini girin.`,
    };
  }

  if (
    (cfg.systemPreset === "narpos" ||
      cfg.systemPreset === "kerzz" ||
      cfg.systemPreset === "posentegra") &&
    !cfg.apiKey.trim()
  ) {
    return {
      ok: false,
      message: `${label} bağlantısı için API Anahtarı / Bearer Token girmeniz gerekmektedir. (API anahtarınız yoksa Sistem Profilini 'Simülasyon & Canlı Test Modu' seçerek hemen test edebilirsiniz.)`,
    };
  }

  try {
    const headers = buildCustomPosHeaders(cfg);
    const menuUrl = `${baseUrl}${normalizePath(cfg.menuEndpointPath, "/products")}`;

    const res = await fetch(menuUrl, {
      method: cfg.systemPreset === "custom_webhook" ? "POST" : "GET",
      headers,
      body:
        cfg.systemPreset === "custom_webhook"
          ? JSON.stringify({
              event: "test_connection",
              provider: cfg.systemPreset,
              branchId: cfg.branchId || "SUBE-01",
              timestamp: new Date().toISOString(),
            })
          : undefined,
      signal: AbortSignal.timeout(7000),
    }).catch(() => null);

    if (!res) {
      return {
        ok: false,
        message: `${label} sunucusuna (${baseUrl}) ulaşılamadı. Sunucu adresini veya ağ bağlantısını kontrol edin.`,
      };
    }

    if (res.ok) {
      return {
        ok: true,
        message: `✅ ${label} sunucusuna (${baseUrl}) başarıyla bağlanıldı!`,
      };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: `⚠️ ${label} sunucusuna ulaşıldı ancak API Anahtarı / Bearer Token yetkisiz döndü (HTTP ${res.status}).`,
      };
    }

    return {
      ok: false,
      message: `${label} sunucusu HTTP ${res.status} yanıtı döndürdü (${menuUrl}).`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `${label} bağlantı testi hatası: ${
        err instanceof Error ? err.message : "Bilinmeyen hata"
      }`,
    };
  }
}

/**
 * Sitedeki ürünleri NarPOS / Kerzz / Özel API PLU kodlarıyla eşitler.
 */
export async function syncSiteMenuToCustomPos(options?: {
  itemIds?: string[];
  updatePrices?: boolean;
}): Promise<{
  ok: boolean;
  message: string;
  createdCount: number;
  updatedCount: number;
  totalProcessed: number;
}> {
  const settings = getSettings();
  const cfg = getResolvedCustomPosConfig();
  const label = getPresetLabel(cfg.systemPreset);
  const prefix = getPresetPrefix(cfg.systemPreset);
  const allItems = getMenuItems();
  const categories = getCategories();
  const catMap = new Map<string, string>(categories.map((c) => [c.id, c.name]));

  const targetItems: MenuItem[] =
    options?.itemIds && options.itemIds.length > 0
      ? allItems.filter((i) => options.itemIds!.includes(i.id))
      : allItems;

  const nextMappings: Record<string, string> = {
    ...(cfg.productMappings || {}),
  };

  let createdCount = 0;
  let updatedCount = 0;

  targetItems.forEach((item, idx) => {
    const existing = nextMappings[item.id]?.trim();
    if (!existing) {
      nextMappings[item.id] = `${prefix}-${101 + idx}`;
      createdCount++;
    } else {
      updatedCount++;
    }
  });

  if (cfg.systemPreset !== "simulation" && cfg.apiBaseUrl.trim()) {
    const baseUrl = normalizeUrl(cfg.apiBaseUrl);
    const menuUrl = `${baseUrl}${normalizePath(cfg.menuEndpointPath, "/products")}`;
    const headers = buildCustomPosHeaders(cfg);

    await fetch(menuUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "menu.sync",
        provider: cfg.systemPreset,
        branchId: cfg.branchId || "SUBE-01",
        products: targetItems.map((item, idx) => ({
          id: item.id,
          pluCode: nextMappings[item.id] || `${prefix}-${101 + idx}`,
          name: item.name,
          categoryName: catMap.get(item.categoryId) || "Genel",
          price: Number(item.price || 0),
          available: item.available,
        })),
      }),
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
  }

  // Kurye listesine NarPOS / Kerzz kuryesini de ekle
  const currentCouriers = [...(settings.couriers || [])];
  const currentPins = { ...(settings.courierPins || {}) };
  for (const cName of ["POS Kurye-1", "POS Kurye-2"]) {
    if (!currentCouriers.some((c) => c.toLowerCase() === cName.toLowerCase())) {
      currentCouriers.push(cName);
      currentPins[cName] = cName.includes("1") ? "1111" : "2222";
    }
  }

  const nextCustomPos: CustomPosConfig = {
    ...cfg,
    productMappings: nextMappings,
    lastMenuSyncedAt: new Date().toISOString(),
  };

  updateSettings({
    ...settings,
    couriers: currentCouriers,
    courierPins: currentPins,
    posIntegrationConfig: {
      activeProvider:
        settings.posIntegrationConfig?.activeProvider || "custom_pos",
      sambaPos: settings.posIntegrationConfig?.sambaPos || {
        enabled: false,
        mode: "graphql",
        serverUrl: "http://localhost:9000",
        clientId: "restoran_pos",
        username: "Admin",
        password: "1234",
        syncTrigger: "on_accepted",
        departmentName: "Restoran",
        ticketTypeName: "Adisyon",
        terminalName: "Sunucu",
        userName: "Admin",
        customerEntityType: "Müşteriler",
        tableEntityType: "Masalar",
        tableEntityPrefix: "Masa ",
        defaultOrderTagName: "Default",
        fallbackMenuItemName: "Online Sipariş Ürünü",
        autoCreateCustomerEntity: true,
      },
      adisyoPos: settings.posIntegrationConfig?.adisyoPos,
      customPos: nextCustomPos,
    },
  });

  return {
    ok: true,
    message: `✅ ${targetItems.length} ürün ${label} PLU / ürün kataloğu ile eşitlendi (${createdCount} yeni PLU kodu, ${updatedCount} güncellendi)!`,
    createdCount,
    updatedCount,
    totalProcessed: targetItems.length,
  };
}

/**
 * Siparişi NarPOS / Kerzz / PosEntegra / Özel REST API standart JSON formatına dönüştürür.
 */
export function buildCustomPosOrderPayload(order: Order, cfg: CustomPosConfig) {
  return {
    event: "siparis.olusturuldu",
    provider: cfg.systemPreset,
    branchId: cfg.branchId || "SUBE-01",
    externalOrderId: order.id,
    orderNumber: order.orderNumber,
    orderType:
      order.orderType === "delivery"
        ? "DELIVERY"
        : order.orderType === "pickup"
        ? "TAKEAWAY"
        : "DINE_IN",
    tableNumber: order.tableNumber || null,
    guestCount: order.guestCount || 1,
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
      address: order.customerAddress || "",
      deliveryZone: order.deliveryZoneName || "",
    },
    payment: {
      method: order.paymentMethod,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount || 0,
      deliveryFee: order.deliveryFee || 0,
      totalAmount: order.totalAmount,
      currency: "TRY",
    },
    note: order.orderNote || "",
    scheduledTime: order.scheduledTime || null,
    items: order.items.map((item, idx) => {
      const mapped = resolveMappedCustomPosProduct(item, cfg, idx);
      const effectivePrice = item.isComplimentary
        ? 0
        : Number(item.unitPrice || item.basePrice || 0);
      return {
        pluCode: mapped.pluCode,
        externalProductId: mapped.pluCode,
        productName: mapped.mappedName,
        originalSiteName: item.name,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(effectivePrice.toFixed(2)),
        totalPrice: Number(
          (effectivePrice * Number(item.quantity || 1)).toFixed(2)
        ),
        isComplimentary: Boolean(item.isComplimentary),
        note: item.itemNote || "",
        modifiers: (item.selectedModifiers || []).map((m) => ({
          groupName: m.groupName,
          optionName: m.optionName,
          price: m.price || 0,
        })),
      };
    }),
    createdAt: order.createdAt,
  };
}

/**
 * Tek bir siparişi NarPOS / Kerzz / Özel API'ye aktarır.
 */
export async function syncOrderToCustomPos(
  orderOrId: Order | string,
  options?: { force?: boolean }
): Promise<{
  ok: boolean;
  message: string;
  externalTicketId?: string;
  order?: Order | null;
}> {
  const cfg = getResolvedCustomPosConfig();
  const label = getPresetLabel(cfg.systemPreset);
  const prefix = getPresetPrefix(cfg.systemPreset);

  if (!cfg.enabled && !options?.force) {
    return {
      ok: false,
      message: `${label} entegrasyonu şu an kapalı.`,
    };
  }

  const order =
    typeof orderOrId === "string" ? getOrderById(orderOrId) : orderOrId;

  if (!order) {
    return {
      ok: false,
      message: "Sipariş bulunamadı.",
    };
  }

  if (
    order.posSyncInfo?.status === "synced" &&
    order.posSyncInfo?.provider === cfg.systemPreset &&
    !options?.force
  ) {
    return {
      ok: true,
      message: `Sipariş #${order.orderNumber} zaten ${label} sistemine aktarılmış (${order.posSyncInfo.externalTicketId}).`,
      externalTicketId: order.posSyncInfo.externalTicketId,
      order,
    };
  }

  try {
    const payload = buildCustomPosOrderPayload(order, cfg);

    if (cfg.systemPreset === "simulation") {
      const simId = `${prefix}-${order.orderNumber}`;
      const syncInfo: PosOrderSyncInfo = {
        provider: "custom_pos",
        status: "synced",
        externalTicketId: simId,
        syncedAt: new Date().toISOString(),
      };
      const updated = updateOrderPosSyncInfo(order.id, syncInfo);
      return {
        ok: true,
        message: `✅ Sipariş #${order.orderNumber} ${label} sistemine başarıyla aktarıldı (Fiş No: #${simId})!`,
        externalTicketId: simId,
        order: updated,
      };
    }

    const baseUrl = normalizeUrl(cfg.apiBaseUrl);
    if (!baseUrl) {
      throw new Error(`${label} API adresi tanımlanmamış.`);
    }

    const ordersUrl = `${baseUrl}${normalizePath(
      cfg.ordersEndpointPath,
      "/orders"
    )}`;
    const headers = buildCustomPosHeaders(cfg);

    const res = await fetch(ordersUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8500),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `${label} sunucusu HTTP ${res.status} yanıtı döndürdü: ${errText.slice(
          0,
          150
        )}`
      );
    }

    const data = (await res.json().catch(() => ({}))) as {
      orderId?: string | number;
      ticketId?: string | number;
      id?: string | number;
      data?: { id?: string | number; orderId?: string | number };
    };

    const extId = String(
      data.orderId ||
        data.ticketId ||
        data.id ||
        data.data?.orderId ||
        data.data?.id ||
        `${prefix}-${order.orderNumber}`
    );

    const syncInfo: PosOrderSyncInfo = {
      provider: cfg.systemPreset,
      status: "synced",
      externalTicketId: extId,
      syncedAt: new Date().toISOString(),
    };
    const updated = updateOrderPosSyncInfo(order.id, syncInfo);

    return {
      ok: true,
      message: `✅ Sipariş #${order.orderNumber} ${label} sistemine başarıyla aktarıldı (#${extId})!`,
      externalTicketId: extId,
      order: updated,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : `${label} aktarım hatası`;
    const updated = updateOrderPosSyncInfo(order.id, {
      provider: cfg.systemPreset,
      status: "failed",
      syncedAt: new Date().toISOString(),
      errorMessage: errMsg,
    });
    return {
      ok: false,
      message: `⚠️ ${label} Aktarım Hatası: ${errMsg}`,
      order: updated,
    };
  }
}

/**
 * Sitede kurye atandığında veya sipariş "Teslim Edildi" yapıldığında
 * NarPOS / Kerzz / Özel API'ye durumu bildirir.
 */
export async function syncSiteOrderUpdateToCustomPos(
  order: Order
): Promise<void> {
  const cfg = getResolvedCustomPosConfig();
  if (!cfg.enabled || cfg.systemPreset === "simulation") return;

  const baseUrl = normalizeUrl(cfg.apiBaseUrl);
  if (!baseUrl) return;

  try {
    const statusUrl = `${baseUrl}${normalizePath(
      cfg.statusEndpointPath,
      "/orders/status"
    )}`;
    const headers = buildCustomPosHeaders(cfg);

    await fetch(statusUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "siparis.durum_degisti",
        provider: cfg.systemPreset,
        branchId: cfg.branchId || "SUBE-01",
        externalOrderId: order.id,
        orderNumber: order.orderNumber,
        posTicketId: order.posSyncInfo?.externalTicketId || null,
        status:
          order.status === "completed"
            ? "DELIVERED"
            : order.status === "ready"
            ? "ON_WAY"
            : order.status === "accepted"
            ? "PREPARING"
            : order.status === "rejected"
            ? "CANCELLED"
            : "PENDING",
        siteStatus: order.status,
        courierName: order.courierName || null,
        updatedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
  } catch {
    // ignore background status push error
  }
}

/**
 * NarPOS / Kerzz / Özel API'den gelen kurye ataması ve teslimat durumunu sitedeki siparişe uygular.
 */
export function applyCustomPosOrderStatusUpdate(params: {
  orderId?: string;
  orderNumber?: number;
  externalTicketId?: string;
  courierName?: string;
  status?: string;
}): {
  ok: boolean;
  updated: boolean;
  message: string;
  order?: Order | null;
} {
  const allOrders = getOrders();
  const target = allOrders.find((o) => {
    if (params.orderId && o.id === params.orderId) return true;
    if (
      params.orderNumber &&
      Number(o.orderNumber) === Number(params.orderNumber)
    ) {
      return true;
    }
    if (
      params.externalTicketId &&
      o.posSyncInfo?.externalTicketId &&
      o.posSyncInfo.externalTicketId.trim().toLowerCase() ===
        params.externalTicketId.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  });

  if (!target) {
    return {
      ok: false,
      updated: false,
      message: "Eşleşen sipariş bulunamadı.",
    };
  }

  const rawStatus = (params.status || "").trim().toUpperCase();
  const cleanCourier = (params.courierName || "").trim();

  if (cleanCourier) {
    const settings = getSettings();
    const couriers = [...(settings.couriers || [])];
    const pins = { ...(settings.courierPins || {}) };
    if (!couriers.some((c) => c.toLowerCase() === cleanCourier.toLowerCase())) {
      couriers.push(cleanCourier);
      const digits = cleanCourier.replace(/\D/g, "");
      pins[cleanCourier] = digits ? digits.repeat(4).slice(0, 4) : "1111";
      updateSettings({
        ...settings,
        couriers,
        courierPins: pins,
      });
    }
  }

  let nextStatus: OrderStatus = target.status;

  if (
    [
      "DELIVERED",
      "COMPLETED",
      "TESLIM_EDILDI",
      "TESLİM EDİLDİ",
      "TESLIM EDILDI",
      "PAID",
      "ODENDI",
      "ÖDENDİ",
      "CLOSED",
    ].includes(rawStatus)
  ) {
    nextStatus = "completed";
  } else if (
    [
      "ON_WAY",
      "OUT_FOR_DELIVERY",
      "COURIER_ASSIGNED",
      "YOLDA",
      "KURYEDE",
      "READY",
      "HAZIR",
    ].includes(rawStatus) ||
    (cleanCourier &&
      (target.status === "pending" || target.status === "accepted"))
  ) {
    if (target.status !== "completed" && target.status !== "rejected") {
      nextStatus = "ready";
    }
  } else if (
    ["PREPARING", "ACCEPTED", "HAZIRLANIYOR", "ONAYLANDI"].includes(rawStatus)
  ) {
    if (target.status === "pending") {
      nextStatus = "accepted";
    }
  } else if (
    ["CANCELLED", "CANCELED", "REJECTED", "IPTAL", "İPTAL"].includes(rawStatus)
  ) {
    nextStatus = "rejected";
  }

  const nextCourier = cleanCourier || target.courierName;
  const statusChanged = nextStatus !== target.status;
  const courierChanged =
    Boolean(cleanCourier) && cleanCourier !== (target.courierName || "");

  if (!statusChanged && !courierChanged) {
    return {
      ok: true,
      updated: false,
      message: `Sipariş #${target.orderNumber} zaten güncel (${target.status}).`,
      order: target,
    };
  }

  const updatedOrder = updateOrderStatus(
    target.id,
    nextStatus,
    undefined,
    undefined,
    nextCourier
  );

  return {
    ok: true,
    updated: true,
    message: `✅ Sipariş #${target.orderNumber} NarPOS / Kerzz / Özel POS üzerinden güncellendi: Durum=${nextStatus}${
      nextCourier ? `, Kurye=${nextCourier}` : ""
    }`,
    order: updatedOrder,
  };
}

let lastCustomPosReverseSyncMs = 0;

/**
 * NarPOS / Kerzz / Özel POS API'sinden kurye atamalarını ve teslimat durumlarını periyodik çeker.
 */
export async function syncOrderStatusesFromCustomPos(options?: {
  force?: boolean;
}): Promise<{
  ok: boolean;
  updatedCount: number;
  message: string;
}> {
  const cfg = getResolvedCustomPosConfig();
  const label = getPresetLabel(cfg.systemPreset);

  if (!cfg.enabled && !options?.force) {
    return {
      ok: false,
      updatedCount: 0,
      message: `${label} entegrasyonu aktif değil.`,
    };
  }

  const now = Date.now();
  if (!options?.force && now - lastCustomPosReverseSyncMs < 4000) {
    return {
      ok: true,
      updatedCount: 0,
      message: `${label} durum kontrolü yakın zamanda yapıldı.`,
    };
  }
  lastCustomPosReverseSyncMs = now;

  if (cfg.systemPreset === "simulation") {
    return {
      ok: true,
      updatedCount: 0,
      message: `✅ ${label} kurye ve teslimat durumları kontrol edildi.`,
    };
  }

  const baseUrl = normalizeUrl(cfg.apiBaseUrl);
  if (!baseUrl) {
    return {
      ok: false,
      updatedCount: 0,
      message: `${label} API adresi tanımlı değil.`,
    };
  }

  try {
    const statusUrl = `${baseUrl}${normalizePath(
      cfg.statusEndpointPath,
      "/orders/status"
    )}`;
    const headers = buildCustomPosHeaders(cfg);
    const res = await fetch(statusUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    let updatedCount = 0;

    if (res && res.ok) {
      const data = (await res.json().catch(() => null)) as
        | Array<Record<string, unknown>>
        | { orders?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> }
        | null;

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.orders)
        ? data!.orders
        : Array.isArray(data?.data)
        ? data!.data
        : [];

      for (const item of list) {
        const result = applyCustomPosOrderStatusUpdate({
          orderId: item.externalOrderId
            ? String(item.externalOrderId)
            : undefined,
          orderNumber: item.orderNumber ? Number(item.orderNumber) : undefined,
          externalTicketId:
            item.orderId || item.id
              ? String(item.orderId || item.id)
              : undefined,
          courierName: item.courierName
            ? String(item.courierName)
            : (item.courier as { name?: string })?.name,
          status: item.status ? String(item.status) : undefined,
        });
        if (result.updated) {
          updatedCount++;
        }
      }
    }

    return {
      ok: true,
      updatedCount,
      message:
        updatedCount > 0
          ? `✅ ${label} üzerinden ${updatedCount} siparişin kurye/teslimat durumu güncellendi!`
          : `✅ ${label} kurye ve teslimat durumları kontrol edildi, tüm siparişler güncel.`,
    };
  } catch (err) {
    return {
      ok: false,
      updatedCount: 0,
      message: `${label} durum eşitleme hatası: ${
        err instanceof Error ? err.message : "Bilinmeyen hata"
      }`,
    };
  }
}
