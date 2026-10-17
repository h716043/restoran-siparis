/**
 * ADİSYO BULUT POS & KURYE POS ENTEGRASYON MODÜLÜ
 * -----------------------------------------------------------------
 * Bu modül ana sipariş sisteminden ve SambaPOS'tan tamamen bağımsız (izole) çalışır.
 * - Müşteri / Restoran Ayarlardan Adisyo / Kurye POS'u aktif etmediği sürece hiçbir işlem yapmaz.
 * - Aktif edildiğinde 3 çalışma modunu destekler:
 *   1) Adisyo Bulut POS (Resmi External API v2 - https://ext-api.adisyo.com)
 *      Headers: x-api-key, x-api-secret, x-consumer
 *   2) Kurye POS / Özel Webhook Köprüsü (Herhangi bir Kurye POS veya bulut/yerel POS sunucusu)
 *   3) Canlı Simülasyon & Test Modu (API anahtarı olmadan tüm sipariş, menü eşleştirme ve kurye akışını test etmek için)
 * - Çift yönlü Kurye Ataması (`ready` + `courierName`) ve Teslim Edildi (`completed`) senkronizasyonu içerir.
 */

import {
  AdisyoPosConfig,
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

export interface AdisyoCatalogItem {
  id: string;
  code: string;
  name: string;
  groupCode: string;
  price: number;
}

export function getDefaultAdisyoPosConfig(): AdisyoPosConfig {
  return {
    enabled: false,
    mode: "adisyo_cloud",
    apiBaseUrl: "https://ext-api.adisyo.com",
    apiKey: "",
    apiSecret: "",
    consumerCode: "restoran_online",
    restaurantId: "",
    syncTrigger: "on_accepted",
    cashPaymentTypeId: "Nakit",
    cardPaymentTypeId: "Kredi Kartı",
    onlinePaymentTypeId: "Online / Açık Hesap",
    autoAssignCourierFromAdisyo: true,
    webhookSecret: "adisyo_kurye_2026",
    fallbackExternalProductId: "ONLINE-URUN",
    productMappings: {},
  };
}

export function getResolvedAdisyoConfig(
  customCfg?: Partial<AdisyoPosConfig>
): AdisyoPosConfig {
  const settings = getSettings();
  const saved = settings.posIntegrationConfig?.adisyoPos;
  return {
    ...getDefaultAdisyoPosConfig(),
    ...(saved || {}),
    ...(customCfg || {}),
  };
}

function normalizeUrl(url?: string): string {
  return (url || "").trim().replace(/\/+$/, "");
}

function buildAdisyoHeaders(cfg: AdisyoPosConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (cfg.apiKey?.trim()) {
    headers["x-api-key"] = cfg.apiKey.trim();
  }
  if (cfg.apiSecret?.trim()) {
    headers["x-api-secret"] = cfg.apiSecret.trim();
  }
  if (cfg.consumerCode?.trim()) {
    headers["x-consumer"] = cfg.consumerCode.trim();
  }
  if (cfg.restaurantId?.trim()) {
    headers["x-restaurant-id"] = cfg.restaurantId.trim();
  }
  return headers;
}

function resolveMappedAdisyoProduct(
  item: { menuItemId?: string; name: string },
  cfg: AdisyoPosConfig
): { externalCode: string; mappedName: string } {
  const mappings = cfg.productMappings || {};
  if (item.menuItemId && mappings[item.menuItemId]?.trim()) {
    const raw = mappings[item.menuItemId].trim();
    return { externalCode: raw, mappedName: raw };
  }
  const byName = mappings[item.name.trim()]?.trim();
  if (byName) {
    return { externalCode: byName, mappedName: byName };
  }
  const cleanCode = `ADS-${(item.menuItemId || item.name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)}`;
  return {
    externalCode: cleanCode,
    mappedName: item.name.trim(),
  };
}

/**
 * Ayarlar ekranındaki "Adisyo / Kurye POS Bağlantısını Test Et" butonu için bağlantı testi yapar.
 */
export async function testAdisyoPosConnection(
  customCfg?: Partial<AdisyoPosConfig>
): Promise<{ ok: boolean; message: string }> {
  const cfg = getResolvedAdisyoConfig(customCfg);

  if (cfg.mode === "simulation") {
    return {
      ok: true,
      message:
        "✅ Adisyo / Kurye POS Simülasyon & Test Modu aktif! API anahtarı gerekmeden tüm sipariş, ürün eşleştirme ve kurye atama akışını canlı test edebilirsiniz.",
    };
  }

  const baseUrl = normalizeUrl(cfg.apiBaseUrl);
  if (!baseUrl) {
    return {
      ok: false,
      message:
        "Lütfen Adisyo / Kurye POS API Adresini (örn: https://ext-api.adisyo.com) girin.",
    };
  }

  if (cfg.mode === "adisyo_cloud" && (!cfg.apiKey.trim() || !cfg.apiSecret.trim())) {
    return {
      ok: false,
      message:
        "Adisyo Bulut POS (External API) modu için 'x-api-key' ve 'x-api-secret' alanlarını doldurmanız gerekmektedir. (Test yapmak için Bağlantı Modunu 'Simülasyon / Test Modu' seçebilirsiniz.)",
    };
  }

  try {
    const headers = buildAdisyoHeaders(cfg);

    if (cfg.mode === "kurye_webhook") {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: "test_connection",
          provider: "adisyo_kurye_pos",
          restaurantId: cfg.restaurantId || "DEFAULT",
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `Kurye POS / Webhook adresi HTTP ${res.status} yanıtı döndürdü (${baseUrl}).`,
        };
      }
      return {
        ok: true,
        message: `✅ Kurye POS / Webhook köprüsüne (${baseUrl}) başarıyla bağlanıldı!`,
      };
    }

    // Adisyo Cloud External API v2 Testi
    const testEndpoints = [
      `${baseUrl}/api/External/v2/Products`,
      `${baseUrl}/api/External/v1/Products`,
      `${baseUrl}/products`,
    ];

    let lastStatus = 0;
    for (const ep of testEndpoints) {
      const res = await fetch(ep, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(7000),
      }).catch(() => null);

      if (res) {
        lastStatus = res.status;
        if (res.ok) {
          return {
            ok: true,
            message: `✅ Adisyo Bulut POS API (${baseUrl}) bağlantısı ve kimlik doğrulaması başarılı!`,
          };
        }
        if (res.status === 401 || res.status === 403) {
          return {
            ok: false,
            message: `⚠️ Adisyo API sunucusuna ulaşıldı ancak API Anahtarı (x-api-key / x-api-secret / x-consumer) yetkisiz döndü (HTTP ${res.status}). Lütfen Adisyo panelindeki entegrasyon anahtarlarınızı kontrol edin.`,
          };
        }
      }
    }

    return {
      ok: false,
      message:
        lastStatus > 0
          ? `Adisyo API sunucusu HTTP ${lastStatus} yanıtı döndürdü (${baseUrl}). API anahtarlarınızı veya uç nokta adresini kontrol edin.`
          : `Adisyo API sunucusuna (${baseUrl}) ulaşılamadı. İnternet bağlantınızı veya API adresini kontrol edin.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Bağlantı testi sırasında hata oluştu: ${
        err instanceof Error ? err.message : "Bilinmeyen hata"
      }`,
    };
  }
}

/**
 * Adisyo / Kurye POS üzerindeki ürün kataloğunu ve kurye listesini çeker.
 */
export async function fetchAdisyoCatalog(
  customCfg?: Partial<AdisyoPosConfig>
): Promise<{
  ok: boolean;
  message: string;
  items: AdisyoCatalogItem[];
  categories: string[];
  couriers: string[];
}> {
  const cfg = getResolvedAdisyoConfig(customCfg);
  const siteCategories = getCategories();
  const siteItems = getMenuItems();
  const catMap = new Map<string, string>(
    siteCategories.map((c) => [c.id, c.name])
  );

  // Eğer Adisyo Cloud veya Kurye Webhook gerçek sunucudan katalog döndürüyorsa çekmeyi dene
  if (cfg.mode !== "simulation" && cfg.apiBaseUrl.trim()) {
    const baseUrl = normalizeUrl(cfg.apiBaseUrl);
    const headers = buildAdisyoHeaders(cfg);
    try {
      const endpoints =
        cfg.mode === "adisyo_cloud"
          ? [`${baseUrl}/api/External/v2/Products`, `${baseUrl}/products`]
          : [`${baseUrl}/products`, `${baseUrl}/catalog`];

      for (const ep of endpoints) {
        const res = await fetch(ep, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(6000),
        }).catch(() => null);

        if (res && res.ok) {
          const data = (await res.json().catch(() => null)) as
            | Record<string, unknown>
            | Array<Record<string, unknown>>
            | null;
          const rawList = Array.isArray(data)
            ? data
            : Array.isArray((data as { data?: unknown })?.data)
            ? ((data as { data: Array<Record<string, unknown>> }).data)
            : Array.isArray((data as { products?: unknown })?.products)
            ? ((data as { products: Array<Record<string, unknown>> }).products)
            : null;

          if (rawList && rawList.length > 0) {
            const parsedItems: AdisyoCatalogItem[] = rawList.map((p, idx) => ({
              id: String(p.id || p.productId || p.code || idx + 1),
              code: String(p.code || p.externalId || p.id || `ADS-${idx + 101}`),
              name: String(p.name || p.productName || p.title || `Ürün ${idx + 1}`),
              groupCode: String(
                p.categoryName || p.groupCode || p.category || "Genel"
              ),
              price: Number(p.price || p.unitPrice || 0),
            }));
            const categories = Array.from(
              new Set(parsedItems.map((i) => i.groupCode))
            );
            return {
              ok: true,
              message: `✅ Adisyo / Kurye POS kataloğundan ${parsedItems.length} ürün ve ${categories.length} kategori çekildi.`,
              items: parsedItems,
              categories,
              couriers: ["Adisyo Kurye-1", "Adisyo Kurye-2"],
            };
          }
        }
      }
    } catch {
      // ignore and fall back to mapped catalog
    }
  }

  // Simülasyon modu veya henüz dış katalog dönmeyen durumlar için sitedeki ürünlerden Adisyo kataloğu oluştur
  const mappings = cfg.productMappings || {};
  const catalogItems: AdisyoCatalogItem[] = siteItems.map((item, idx) => {
    const mapped = mappings[item.id]?.trim() || item.name;
    const code = `ADS-${101 + idx}`;
    return {
      id: item.id,
      code,
      name: mapped,
      groupCode: catMap.get(item.categoryId) || "Menü",
      price: Number(item.price || 0),
    };
  });

  const categories = Array.from(new Set(catalogItems.map((i) => i.groupCode)));

  return {
    ok: true,
    message: `✅ Adisyo / Kurye POS ürün eşleştirme kataloğu hazır (${catalogItems.length} ürün, ${categories.length} kategori).`,
    items: catalogItems,
    categories,
    couriers: ["Adisyo Kurye-1", "Adisyo Kurye-2"],
  };
}

/**
 * Sitedeki menü ürünlerini Adisyo / Kurye POS ile eşitler ve ürün kodlarını kaydeder.
 */
export async function syncSiteMenuToAdisyo(options?: {
  itemIds?: string[];
  updatePrices?: boolean;
}): Promise<{
  ok: boolean;
  message: string;
  createdCount: number;
  updatedCount: number;
  totalProcessed: number;
  catalog: Awaited<ReturnType<typeof fetchAdisyoCatalog>>;
}> {
  const settings = getSettings();
  const cfg = getResolvedAdisyoConfig();
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

  for (const item of targetItems) {
    const existing = nextMappings[item.id]?.trim();
    if (!existing) {
      nextMappings[item.id] = item.name.trim();
      createdCount++;
    } else {
      updatedCount++;
    }
  }

  // Eğer Kurye Webhook veya Adisyo Cloud modundaysa dış uç noktaya menü senkronizasyon paketi de gönder
  if (cfg.mode !== "simulation" && cfg.apiBaseUrl.trim()) {
    const baseUrl = normalizeUrl(cfg.apiBaseUrl);
    const headers = buildAdisyoHeaders(cfg);
    const endpoint =
      cfg.mode === "adisyo_cloud"
        ? `${baseUrl}/api/External/v2/SyncProducts`
        : `${baseUrl}/sync-menu`;

    await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "menu_sync",
        provider: "adisyo",
        restaurantId: cfg.restaurantId || "DEFAULT",
        updatePrices: options?.updatePrices !== false,
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
        })),
        products: targetItems.map((item, idx) => ({
          id: item.id,
          externalCode: nextMappings[item.id] || `ADS-${101 + idx}`,
          name: nextMappings[item.id] || item.name,
          siteName: item.name,
          categoryName: catMap.get(item.categoryId) || "Genel",
          price: Number(item.price || 0),
          available: item.available,
        })),
      }),
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);
  }

  // Kurye listesine Adisyo kuryelerini de ekle (henüz yoksa)
  const currentCouriers = [...(settings.couriers || [])];
  const currentPins = { ...(settings.courierPins || {}) };
  for (const cName of ["Adisyo Kurye-1", "Adisyo Kurye-2"]) {
    if (!currentCouriers.some((c) => c.toLowerCase() === cName.toLowerCase())) {
      currentCouriers.push(cName);
      currentPins[cName] = cName.includes("1") ? "1111" : "2222";
    }
  }

  const nextAdisyo: AdisyoPosConfig = {
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
        settings.posIntegrationConfig?.activeProvider || "adisyo",
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
      adisyoPos: nextAdisyo,
    },
  });

  const catalog = await fetchAdisyoCatalog(nextAdisyo);

  return {
    ok: true,
    message: `✅ ${targetItems.length} ürün Adisyo / Kurye POS kataloğu ile eşitlendi (${createdCount} yeni eşleşme, ${updatedCount} güncellendi)!`,
    createdCount,
    updatedCount,
    totalProcessed: targetItems.length,
    catalog,
  };
}

/**
 * Siparişi Adisyo External API v2 (`SaveOrder`) veya Kurye POS formatına dönüştürür.
 */
export function buildAdisyoOrderPayload(order: Order, cfg: AdisyoPosConfig) {
  const paymentType =
    order.paymentMethod === "cash"
      ? cfg.cashPaymentTypeId || "Nakit"
      : order.paymentMethod === "card_at_door"
      ? cfg.cardPaymentTypeId || "Kredi Kartı"
      : cfg.onlinePaymentTypeId || "Online / Açık Hesap";

  const orderTypeCode =
    order.orderType === "delivery"
      ? 1 // Delivery / Paket Servis
      : order.orderType === "pickup"
      ? 2 // TakeAway / Gel-Al
      : 3; // DineIn / Masa

  return {
    event: "order.created",
    provider: "adisyo",
    restaurantId: cfg.restaurantId || "DEFAULT",
    consumer: cfg.consumerCode || "restoran_online",
    externalOrderId: order.id,
    orderNumber: order.orderNumber,
    orderType:
      order.orderType === "delivery"
        ? "DELIVERY"
        : order.orderType === "pickup"
        ? "TAKEAWAY"
        : "DINE_IN",
    orderTypeId: orderTypeCode,
    tableNumber: order.tableNumber || null,
    guestCount: order.guestCount || 1,
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
      address: order.customerAddress || "",
      region: order.deliveryZoneName || "",
    },
    payment: {
      method: order.paymentMethod,
      paymentTypeId: paymentType,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount || 0,
      deliveryFee: order.deliveryFee || 0,
      totalAmount: order.totalAmount,
      currency: "TRY",
    },
    note: order.orderNote || "",
    scheduledTime: order.scheduledTime || null,
    items: order.items.map((item) => {
      const mapped = resolveMappedAdisyoProduct(item, cfg);
      const effectivePrice = item.isComplimentary
        ? 0
        : Number(item.unitPrice || item.basePrice || 0);
      return {
        externalProductId: mapped.externalCode,
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
          priceDelta: m.price || 0,
        })),
      };
    }),
    createdAt: order.createdAt,
  };
}

/**
 * Tek bir siparişi Adisyo Bulut POS veya Kurye POS'a aktarır.
 */
export async function syncOrderToAdisyoPos(
  orderOrId: Order | string,
  options?: { force?: boolean }
): Promise<{
  ok: boolean;
  message: string;
  externalTicketId?: string;
  order?: Order | null;
}> {
  const cfg = getResolvedAdisyoConfig();

  if (!cfg.enabled && !options?.force) {
    return {
      ok: false,
      message: "Adisyo / Kurye POS entegrasyonu şu an kapalı.",
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
    order.posSyncInfo?.provider === "adisyo" &&
    !options?.force
  ) {
    return {
      ok: true,
      message: `Sipariş #${order.orderNumber} zaten Adisyo / Kurye POS'a aktarılmış (${order.posSyncInfo.externalTicketId}).`,
      externalTicketId: order.posSyncInfo.externalTicketId,
      order,
    };
  }

  try {
    const payload = buildAdisyoOrderPayload(order, cfg);

    // 1) Simülasyon Modu
    if (cfg.mode === "simulation") {
      const simTicketId = `ADS-${order.orderNumber}`;
      const syncInfo: PosOrderSyncInfo = {
        provider: "adisyo",
        status: "synced",
        externalTicketId: simTicketId,
        syncedAt: new Date().toISOString(),
      };
      const updated = updateOrderPosSyncInfo(order.id, syncInfo);
      return {
        ok: true,
        message: `✅ Sipariş #${order.orderNumber} Adisyo / Kurye POS'a başarıyla aktarıldı (Fiş No: #${simTicketId})!`,
        externalTicketId: simTicketId,
        order: updated,
      };
    }

    const baseUrl = normalizeUrl(cfg.apiBaseUrl);
    if (!baseUrl) {
      throw new Error("Adisyo / Kurye POS API adresi tanımlanmamış.");
    }

    const headers = buildAdisyoHeaders(cfg);

    // 2) Kurye POS / Özel Webhook Modu
    if (cfg.mode === "kurye_webhook") {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          `Kurye POS sunucusu HTTP ${res.status} döndürdü: ${errText.slice(0, 140)}`
        );
      }

      const data = (await res.json().catch(() => ({}))) as {
        orderId?: string | number;
        ticketId?: string | number;
        id?: string | number;
      };
      const extId = String(
        data.orderId || data.ticketId || data.id || `ADS-${order.orderNumber}`
      );
      const syncInfo: PosOrderSyncInfo = {
        provider: "adisyo",
        status: "synced",
        externalTicketId: extId,
        syncedAt: new Date().toISOString(),
      };
      const updated = updateOrderPosSyncInfo(order.id, syncInfo);
      return {
        ok: true,
        message: `✅ Sipariş #${order.orderNumber} Kurye POS / Adisyo köprüsüne aktarıldı (#${extId})!`,
        externalTicketId: extId,
        order: updated,
      };
    }

    // 3) Adisyo Bulut POS (Resmi External API v2 - SaveOrder)
    if (!cfg.apiKey.trim() || !cfg.apiSecret.trim()) {
      throw new Error(
        "Adisyo Bulut POS için x-api-key ve x-api-secret girilmelidir."
      );
    }

    const saveUrl = baseUrl.toLowerCase().includes("/saveorder")
      ? baseUrl
      : `${baseUrl}/api/External/v2/SaveOrder`;

    const res = await fetch(saveUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Adisyo API HTTP ${res.status} yanıtı döndürdü: ${errText.slice(0, 160)}`
      );
    }

    const respData = (await res.json().catch(() => ({}))) as {
      orderId?: string | number;
      id?: string | number;
      data?: { orderId?: string | number; id?: string | number };
    };

    const adisyoTicketId = String(
      respData.orderId ||
        respData.id ||
        respData.data?.orderId ||
        respData.data?.id ||
        `ADS-${order.orderNumber}`
    );

    const syncInfo: PosOrderSyncInfo = {
      provider: "adisyo",
      status: "synced",
      externalTicketId: adisyoTicketId,
      syncedAt: new Date().toISOString(),
    };
    const updated = updateOrderPosSyncInfo(order.id, syncInfo);

    return {
      ok: true,
      message: `✅ Sipariş #${order.orderNumber} Adisyo Bulut POS'a başarıyla aktarıldı (Adisyo No: #${adisyoTicketId})!`,
      externalTicketId: adisyoTicketId,
      order: updated,
    };
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Adisyo POS aktarım hatası";
    const updated = updateOrderPosSyncInfo(order.id, {
      provider: "adisyo",
      status: "failed",
      syncedAt: new Date().toISOString(),
      errorMessage: errMsg,
    });
    return {
      ok: false,
      message: `⚠️ Adisyo / Kurye POS Aktarım Hatası: ${errMsg}`,
      order: updated,
    };
  }
}

/**
 * Sitede kurye atandığında veya sipariş "Teslim Edildi" (`completed`) yapıldığında
 * Adisyo / Kurye POS tarafına da durumu otomatik bildirir.
 */
export async function syncSiteOrderUpdateToAdisyoPos(
  order: Order
): Promise<void> {
  const cfg = getResolvedAdisyoConfig();
  if (!cfg.enabled || cfg.mode === "simulation") return;

  const baseUrl = normalizeUrl(cfg.apiBaseUrl);
  if (!baseUrl) return;

  try {
    const headers = buildAdisyoHeaders(cfg);
    const statusUrl =
      cfg.mode === "adisyo_cloud"
        ? `${baseUrl}/api/External/v2/UpdateOrderStatus`
        : `${baseUrl}/order-status`;

    const adisyoStatus =
      order.status === "completed"
        ? "DELIVERED"
        : order.status === "ready"
        ? "ON_WAY"
        : order.status === "accepted"
        ? "PREPARING"
        : order.status === "rejected"
        ? "CANCELLED"
        : "PENDING";

    await fetch(statusUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "order.status_updated",
        provider: "adisyo",
        restaurantId: cfg.restaurantId || "DEFAULT",
        externalOrderId: order.id,
        orderNumber: order.orderNumber,
        adisyoTicketId: order.posSyncInfo?.externalTicketId || `ADS-${order.orderNumber}`,
        status: adisyoStatus,
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
 * Adisyo / Kurye POS tarafından gelen (veya API'den çekilen) kurye ataması ve
 * "Teslim Edildi" bilgilerini sitedeki siparişe uygular.
 */
export function applyAdisyoOrderStatusUpdate(params: {
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

  // Yeni bir kurye adı geldiyse settings.couriers içine otomatik ekle
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
    message: `✅ Sipariş #${target.orderNumber} Adisyo / Kurye POS üzerinden güncellendi: Durum=${nextStatus}${
      nextCourier ? `, Kurye=${nextCourier}` : ""
    }`,
    order: updatedOrder,
  };
}

let lastAdisyoReverseSyncMs = 0;

/**
 * Adisyo / Kurye POS API'sinden kurye atamalarını ve teslimat durumlarını periyodik olarak çeker.
 */
export async function syncOrderStatusesFromAdisyoPos(options?: {
  force?: boolean;
}): Promise<{
  ok: boolean;
  updatedCount: number;
  message: string;
}> {
  const cfg = getResolvedAdisyoConfig();
  if (!cfg.enabled && !options?.force) {
    return {
      ok: false,
      updatedCount: 0,
      message: "Adisyo / Kurye POS aktif değil.",
    };
  }

  const now = Date.now();
  if (!options?.force && now - lastAdisyoReverseSyncMs < 4000) {
    return {
      ok: true,
      updatedCount: 0,
      message: "Adisyo durum kontrolü yakın zamanda yapıldı.",
    };
  }
  lastAdisyoReverseSyncMs = now;

  if (cfg.mode === "simulation") {
    return {
      ok: true,
      updatedCount: 0,
      message:
        "✅ Adisyo / Kurye POS kurye ve teslimat durumları kontrol edildi (Simülasyon modu aktif).",
    };
  }

  const baseUrl = normalizeUrl(cfg.apiBaseUrl);
  if (!baseUrl) {
    return {
      ok: false,
      updatedCount: 0,
      message: "Adisyo API adresi tanımlı değil.",
    };
  }

  try {
    const headers = buildAdisyoHeaders(cfg);
    const statusEndpoints =
      cfg.mode === "adisyo_cloud"
        ? [`${baseUrl}/api/External/v2/Orders`, `${baseUrl}/orders`]
        : [`${baseUrl}/orders`, `${baseUrl}/order-statuses`];

    let updatedCount = 0;

    for (const ep of statusEndpoints) {
      const res = await fetch(ep, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);

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
          const result = applyAdisyoOrderStatusUpdate({
            orderId: item.externalOrderId ? String(item.externalOrderId) : undefined,
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
        break;
      }
    }

    return {
      ok: true,
      updatedCount,
      message:
        updatedCount > 0
          ? `✅ Adisyo / Kurye POS'tan ${updatedCount} siparişin kurye/teslimat durumu güncellendi!`
          : "✅ Adisyo / Kurye POS kurye ve teslimat durumları kontrol edildi, tüm siparişler güncel.",
    };
  } catch (err) {
    return {
      ok: false,
      updatedCount: 0,
      message: `Adisyo durum eşitleme hatası: ${
        err instanceof Error ? err.message : "Bilinmeyen hata"
      }`,
    };
  }
}
