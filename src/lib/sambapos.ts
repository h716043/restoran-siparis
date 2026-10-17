/**
 * SAMBAPOS V5 (MESSAGE SERVER GRAPHQL & WEBHOOK) ENTEGRASYON MODÜLÜ
 * -----------------------------------------------------------------
 * Bu modül ana sipariş sisteminden tamamen bağımsız (izole) çalışır.
 * - Müşteri / Restoran Ayarlardan SambaPOS'u aktif etmediği sürece hiçbir işlem yapmaz.
 * - İleride başka POS sistemleri (Adisyo, NarPOS, Simpra vb.) eklendiğinde
 *   aynı `PosIntegrationConfig` yapısı üzerinden genişletilebilir.
 */

import {
  Order,
  PosIntegrationConfig,
  PosOrderSyncInfo,
  SambaPosConfig,
} from "@/types";
import {
  getOrderById,
  getOrders,
  getSettings,
  updateOrderPosSyncInfo,
} from "@/lib/db";

export const DEFAULT_SAMBAPOS_CONFIG: SambaPosConfig = {
  enabled: false,
  mode: "graphql",
  serverUrl: "http://localhost:9000",
  clientId: "restoran_pos",
  username: "Admin",
  password: "1234",
  syncTrigger: "on_accepted",
  departmentName: "Restoran",
  ticketTypeName: "Paket Servis",
  terminalName: "Sunucu",
  userName: "Admin",
  customerEntityType: "Müşteriler",
  tableEntityType: "Masalar",
  tableEntityPrefix: "Masa ",
  defaultOrderTagName: "Default",
  fallbackMenuItemName: "",
  autoCreateCustomerEntity: false,
};

export function getResolvedPosConfig(): PosIntegrationConfig {
  const settings = getSettings();
  const saved = settings.posIntegrationConfig;
  return {
    activeProvider: saved?.activeProvider || (saved?.sambaPos?.enabled ? "sambapos" : "none"),
    sambaPos: {
      ...DEFAULT_SAMBAPOS_CONFIG,
      ...(saved?.sambaPos || {}),
    },
  };
}

function normalizeServerUrl(raw: string): string {
  return (raw || "http://localhost:9000").trim().replace(/\/+$/, "");
}

/**
 * SambaPOS V5 Message Server OAuth2 (/Token) üzerinden Access Token alır.
 */
async function authenticateSambaPos(cfg: SambaPosConfig): Promise<string> {
  const baseUrl = normalizeServerUrl(cfg.serverUrl);
  const body = new URLSearchParams();
  body.set("grant_type", "password");
  body.set("username", cfg.username || "Admin");
  body.set("password", cfg.password || "");
  body.set("client_id", cfg.clientId || "restoran_pos");

  const res = await fetch(`${baseUrl}/Token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `SambaPOS Token Hatası (HTTP ${res.status}): Kullanıcı adı, şifre veya Uygulama ID (client_id: ${cfg.clientId}) hatalı olabilir. Detay: ${errText.slice(0, 160)}`
    );
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data?.access_token) {
    throw new Error("SambaPOS /Token yanıtında access_token bulunamadı.");
  }
  return data.access_token;
}

/**
 * SambaPOS V5 /api/graphql uç noktasına GraphQL sorgusu/mutasyonu gönderir.
 */
async function executeSambaGraphQL(
  cfg: SambaPosConfig,
  accessToken: string,
  query: string
): Promise<{ data?: Record<string, unknown>; errors?: Array<{ message: string }> }> {
  const baseUrl = normalizeServerUrl(cfg.serverUrl);
  const res = await fetch(`${baseUrl}/api/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `SambaPOS GraphQL HTTP Hatası (${res.status}): ${errText.slice(0, 180)}`
    );
  }

  return (await res.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message: string }>;
  };
}

/**
 * Sipariş verisinden SambaPOS V5 `addTicket` GraphQL mutasyonu üretir.
 */
export function buildSambaPosAddTicketMutation(
  order: Order,
  cfg: SambaPosConfig,
  useFallbackItem = false
): string {
  const gStr = (val: string) => JSON.stringify(String(val ?? ""));

  const payLabel =
    order.paymentMethod === "cash"
      ? "Nakit"
      : order.paymentMethod === "card_at_door"
      ? "Kapida Kredi Karti (POS)"
      : order.paymentMethod === "credit"
      ? "Acik Hesap (Veresiye)"
      : "Masada Odeme";

  const typeLabel =
    order.orderType === "delivery"
      ? "Paket Servis"
      : order.orderType === "pickup"
      ? "Gel-Al"
      : `Masa ${order.tableNumber || ""}`;

  const noteParts = [
    `Online Siparis #${order.orderNumber} (${typeLabel})`,
    `Musteri: ${order.customerName} (${order.customerPhone})`,
    order.customerAddress ? `Adres: ${order.customerAddress}` : "",
    order.deliveryZoneName ? `Bolge: ${order.deliveryZoneName}` : "",
    `Odeme: ${payLabel}`,
    order.discountAmount ? `Indirim: -${order.discountAmount.toFixed(2)} TL` : "",
    order.deliveryFee ? `Kurye Ucreti: +${order.deliveryFee.toFixed(2)} TL` : "",
    order.orderNote ? `Not: ${order.orderNote}` : "",
  ].filter(Boolean);

  const ticketNote = noteParts.join(" | ");

  // Masa veya Müşteri Varlığı (Entities)
  const entitiesList: string[] = [];
  if (order.orderType === "dine_in" && order.tableNumber) {
    const tableEntityType = cfg.tableEntityType || "Masalar";
    const tableName = `${cfg.tableEntityPrefix ?? "Masa "}${order.tableNumber}`;
    entitiesList.push(
      `{ entityType: ${gStr(tableEntityType)}, name: ${gStr(tableName)} }`
    );
  } else if (cfg.autoCreateCustomerEntity && order.customerName) {
    const custEntityType = cfg.customerEntityType || "Müşteriler";
    const custName = `${order.customerName} (${order.customerPhone})`;
    entitiesList.push(
      `{ entityType: ${gStr(custEntityType)}, name: ${gStr(custName)} }`
    );
  }

  // Sipariş Kalemleri (Orders)
  const defaultTagGroup = cfg.defaultOrderTagName || "Default";
  const fallbackName = (cfg.fallbackMenuItemName || "").trim();

  const ordersGraphQL = order.items.map((item) => {
    const targetItemName =
      useFallbackItem && fallbackName ? fallbackName : item.name;

    const tagEntries: string[] = [];

    // Eğer yedek (fallback) ürün kullanıldıysa gerçek ürün adını ilk etiket olarak ekle
    if (useFallbackItem && fallbackName && item.name !== fallbackName) {
      tagEntries.push(
        `{ tagName: ${gStr(defaultTagGroup)}, tag: ${gStr(`Ürün: ${item.name}`)}, price: 0, quantity: 1 }`
      );
    }

    // Seçilen porsiyon / ekstra / çıkarılacak malzemeleri Order Tag olarak ekle
    for (const mod of item.selectedModifiers || []) {
      const modLabel = mod.productTag
        ? `${mod.productTag}: ${mod.optionName}`
        : `${mod.groupName}: ${mod.optionName}`;
      tagEntries.push(
        `{ tagName: ${gStr(defaultTagGroup)}, tag: ${gStr(modLabel)}, price: 0, quantity: 1 }`
      );
    }

    // Kalem notu varsa ekle
    if (item.itemNote) {
      tagEntries.push(
        `{ tagName: ${gStr(defaultTagGroup)}, tag: ${gStr(`Not: ${item.itemNote}`)}, price: 0, quantity: 1 }`
      );
    }

    const effectiveUnitPrice = item.isComplimentary
      ? 0
      : Number(item.unitPrice || item.basePrice || 0);

    return `{
      name: ${gStr(targetItemName)},
      menuItemName: ${gStr(targetItemName)},
      quantity: ${Number(item.quantity || 1)},
      price: ${Number(effectiveUnitPrice.toFixed(2))},
      portion: "Normal",
      states: [
        { stateName: "Status", state: "Submitted" }
      ],
      tags: [${tagEntries.join(", ")}]
    }`;
  });

  const ticketTags = [
    `{ tagName: "Online Siparis No", tag: ${gStr(`#${order.orderNumber}`)} }`,
    `{ tagName: "Odeme Tipi", tag: ${gStr(payLabel)} }`,
    `{ tagName: "Musteri", tag: ${gStr(`${order.customerName} (${order.customerPhone})`)} }`,
  ];
  if (order.customerAddress) {
    ticketTags.push(
      `{ tagName: "Adres", tag: ${gStr(order.customerAddress)} }`
    );
  }

  return `mutation {
    addTicket(
      ticket: {
        type: ${gStr(cfg.ticketTypeName || "Paket Servis")},
        department: ${gStr(cfg.departmentName || "Restoran")},
        user: ${gStr(cfg.userName || "Admin")},
        terminal: ${gStr(cfg.terminalName || "Sunucu")},
        note: ${gStr(ticketNote)},
        entities: [${entitiesList.join(", ")}],
        orders: [${ordersGraphQL.join(",\n")}],
        tags: [${ticketTags.join(", ")}]
      }
    ) {
      id
    }
  }`;
}

/**
 * Ayarlar ekranındaki "SambaPOS Bağlantısını Test Et" butonu için bağlantı testi yapar.
 */
export async function testSambaPosConnection(
  customCfg?: Partial<SambaPosConfig>
): Promise<{ ok: boolean; message: string }> {
  const resolved = {
    ...getResolvedPosConfig().sambaPos,
    ...(customCfg || {}),
  };

  const baseUrl = normalizeServerUrl(resolved.serverUrl);
  if (!baseUrl) {
    return {
      ok: false,
      message: "Lütfen SambaPOS Sunucu Adresini (örn: http://localhost:9000) girin.",
    };
  }

  try {
    if (resolved.mode === "webhook") {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test_connection",
          provider: "sambapos",
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `Webhook adresi HTTP ${res.status} yanıtı döndürdü (${baseUrl}).`,
        };
      }
      return {
        ok: true,
        message: `✅ Webhook köprüsüne (${baseUrl}) başarıyla bağlanıldı!`,
      };
    }

    // GraphQL (Message Server) Modu
    const token = await authenticateSambaPos(resolved);
    const gqlRes = await executeSambaGraphQL(
      resolved,
      token,
      `query { __typename }`
    );

    if (gqlRes.errors && gqlRes.errors.length > 0) {
      return {
        ok: false,
        message: `SambaPOS Token alındı fakat GraphQL hatası döndü: ${gqlRes.errors[0].message}`,
      };
    }

    return {
      ok: true,
      message: `✅ SambaPOS V5 Message Server (${baseUrl}) bağlantısı ve GraphQL yetkisi başarılı!`,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Bağlantı kurulamadı: ${err.message}`
          : "SambaPOS Message Server (Port 9000) erişilemiyor.",
    };
  }
}

/**
 * Tek bir siparişi SambaPOS'a aktarır ve sonucu siparişin `posSyncInfo` alanına kaydeder.
 * Ana sistemi asla bozmaz, hata oluşursa yakalar ve kaydeder.
 */
export async function sendOrderToSambaPos(
  orderOrId: Order | string,
  options?: { force?: boolean; customConfig?: SambaPosConfig }
): Promise<{
  ok: boolean;
  message: string;
  externalTicketId?: string;
  order?: Order | null;
}> {
  try {
    const order =
      typeof orderOrId === "string" ? getOrderById(orderOrId) : orderOrId;
    if (!order) {
      return { ok: false, message: "Sipariş bulunamadı." };
    }

    // Daha önce başarıyla aktarıldıysa ve manuel zorlama (force) yoksa tekrar gönderme
    if (!options?.force && order.posSyncInfo?.status === "synced") {
      return {
        ok: true,
        message: `Sipariş #${order.orderNumber} zaten SambaPOS'a aktarılmış.`,
        externalTicketId: order.posSyncInfo.externalTicketId,
        order,
      };
    }

    const cfg = options?.customConfig || getResolvedPosConfig().sambaPos;
    if (!cfg.enabled && !options?.force) {
      return {
        ok: false,
        message: "SambaPOS entegrasyonu şu anda pasif durumda.",
        order,
      };
    }

    const baseUrl = normalizeServerUrl(cfg.serverUrl);

    if (cfg.mode === "webhook") {
      const mutationPreview = buildSambaPosAddTicketMutation(order, cfg, false);
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "order.created",
          provider: "sambapos",
          order,
          graphqlMutation: mutationPreview,
          sentAt: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Webhook HTTP ${res.status}: ${errText.slice(0, 120)}`);
      }

      const respJson = (await res.json().catch(() => ({}))) as {
        ticketId?: string | number;
        id?: string | number;
      };
      const ticketId = String(respJson.ticketId || respJson.id || "WEBHOOK-OK");
      const syncInfo: PosOrderSyncInfo = {
        provider: "sambapos",
        status: "synced",
        externalTicketId: ticketId,
        syncedAt: new Date().toISOString(),
      };
      const updated = updateOrderPosSyncInfo(order.id, syncInfo);
      return {
        ok: true,
        message: `✅ Sipariş #${order.orderNumber} SambaPOS Webhook köprüsüne aktarıldı!`,
        externalTicketId: ticketId,
        order: updated,
      };
    }

    // GraphQL (SambaPOS V5 Message Server) Modu
    const accessToken = await authenticateSambaPos(cfg);
    const mutation = buildSambaPosAddTicketMutation(order, cfg, false);
    let gqlResult = await executeSambaGraphQL(cfg, accessToken, mutation);

    // Eğer ürün adı SambaPOS'ta bulunamadığı için hata döndüyse ve yedek ürün adı (fallbackMenuItemName) tanımlıysa otomatik yedek ürünle tekrar dene
    if (
      gqlResult.errors &&
      gqlResult.errors.length > 0 &&
      cfg.fallbackMenuItemName?.trim()
    ) {
      const fallbackMutation = buildSambaPosAddTicketMutation(order, cfg, true);
      gqlResult = await executeSambaGraphQL(cfg, accessToken, fallbackMutation);
    }

    if (gqlResult.errors && gqlResult.errors.length > 0) {
      throw new Error(gqlResult.errors.map((e) => e.message).join(" | "));
    }

    const addedTicket = gqlResult.data?.addTicket as
      | { id?: string | number }
      | undefined;
    const ticketId = String(addedTicket?.id || "SAMBA-OK");

    const syncInfo: PosOrderSyncInfo = {
      provider: "sambapos",
      status: "synced",
      externalTicketId: ticketId,
      syncedAt: new Date().toISOString(),
    };
    const updated = updateOrderPosSyncInfo(order.id, syncInfo);

    return {
      ok: true,
      message: `✅ Sipariş #${order.orderNumber} SambaPOS'a başarıyla aktarıldı (Adisyon ID: ${ticketId})!`,
      externalTicketId: ticketId,
      order: updated,
    };
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "SambaPOS aktarım hatası";
    const orderId =
      typeof orderOrId === "string" ? orderOrId : orderOrId?.id;
    let updated: Order | null = null;
    if (orderId) {
      updated = updateOrderPosSyncInfo(orderId, {
        provider: "sambapos",
        status: "failed",
        syncedAt: new Date().toISOString(),
        errorMessage: errMsg,
      });
    }
    return {
      ok: false,
      message: `⚠️ SambaPOS Aktarım Hatası: ${errMsg}`,
      order: updated,
    };
  }
}

let isAutoSyncRunning = false;

/**
 * Kasa PC üzerinde (yerelde) çalışırken, hem yerel hem de Netlify/Turso buluttan
 * yeni gelen siparişleri `syncTrigger` ayarına göre otomatik SambaPOS'a aktarır.
 * (Netlify sunucusunda çalışmaz, sadece Kasa PC'de çalışır.)
 */
export async function autoSyncOrdersWithPosIfNeeded(): Promise<void> {
  if (
    process.env.NETLIFY === "true" ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NEXT_PUBLIC_CUSTOMER_ONLY === "true"
  ) {
    return;
  }
  if (isAutoSyncRunning) return;

  const posCfg = getResolvedPosConfig();
  const sambaCfg = posCfg.sambaPos;
  if (!sambaCfg.enabled || sambaCfg.syncTrigger === "manual") {
    return;
  }

  isAutoSyncRunning = true;
  try {
    const allOrders = getOrders();
    // Son 12 saat içinde oluşturulmuş ve henüz SambaPOS'a aktarılmamış siparişleri kontrol et
    const cutoffMs = Date.now() - 12 * 60 * 60 * 1000;
    const candidates = allOrders.filter((o) => {
      if (o.posSyncInfo?.status === "synced") return false;
      // Daha önce denendi ve hata aldıysa otomatik döngüde sürekli tekrar denememek için (manuel butona basınca tekrar dener)
      if (o.posSyncInfo?.status === "failed") return false;
      const createdMs = new Date(o.createdAt).getTime();
      if (createdMs < cutoffMs) return false;

      if (sambaCfg.syncTrigger === "on_created") {
        return o.status === "pending" || o.status === "accepted";
      }
      if (sambaCfg.syncTrigger === "on_accepted") {
        return o.status === "accepted";
      }
      return false;
    });

    for (const ord of candidates) {
      await sendOrderToSambaPos(ord);
    }
  } catch (e) {
    console.warn("autoSyncOrdersWithPosIfNeeded warning:", e);
  } finally {
    isAutoSyncRunning = false;
  }
}
