/**
 * SAMBAPOS V5 (MESSAGE SERVER GRAPHQL & WEBHOOK) ENTEGRASYON MODÜLÜ
 * -----------------------------------------------------------------
 * Bu modül ana sipariş sisteminden tamamen bağımsız (izole) çalışır.
 * - Müşteri / Restoran Ayarlardan SambaPOS'u aktif etmediği sürece hiçbir işlem yapmaz.
 * - Aktif edildiğinde:
 *   1) OAuth2 (/Token) ile bağlantı kurar (restoran_pos, pda, gokiosk otomatik yedekli).
 *   2) Siparişteki ürünler SambaPOS menüsünde yoksa GraphQL `addProduct` ile otomatik oluşturur.
 *   3) Müşteri (Müşteriler) veya Masa (Masalar) varlığını otomatik eşleştirir / oluşturur.
 *   4) Paket Servis (`Paket=Bekliyor`), Gel-Al (`Paket=GelAl`) ve Masa (`Status=Yeni Siparişler`)
 *      durumlarını Türkçe SambaPOS V5 kurallarına uygun şekilde oluşturur ve ekranı canlı yeniler.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import {
  Order,
  OrderItem,
  PosIntegrationConfig,
  PosOrderSyncInfo,
  SambaPosConfig,
} from "@/types";
import {
  getCategories,
  getMenuItems,
  getOrderById,
  getOrders,
  getSettings,
  updateOrderPosSyncInfo,
  updateSettings,
} from "@/lib/db";

export const DEFAULT_SAMBAPOS_CONFIG: SambaPosConfig = {
  enabled: false,
  mode: "graphql",
  serverUrl: "http://localhost:9000",
  clientId: "pda",
  username: "Administrator",
  password: "1234",
  syncTrigger: "on_accepted",
  departmentName: "Paket Servis",
  ticketTypeName: "Paket Servis",
  terminalName: "Sunucu",
  userName: "Administrator",
  customerEntityType: "Müşteriler",
  tableEntityType: "Masalar",
  tableEntityPrefix: "B",
  defaultOrderTagName: "Default",
  fallbackMenuItemName: "Online Sipariş Ürünü",
  autoCreateCustomerEntity: true,
  productMappings: {},
  syncToScreenMenu: true,
};

export function resolveMappedSambaProductName(
  item: Pick<OrderItem, "menuItemId" | "name">,
  cfg: SambaPosConfig
): string {
  const mappings = cfg.productMappings || {};
  if (item.menuItemId && mappings[item.menuItemId]?.trim()) {
    return mappings[item.menuItemId].trim();
  }
  const cleanName = (item.name || "").trim();
  if (cleanName && mappings[cleanName]?.trim()) {
    return mappings[cleanName].trim();
  }
  return cleanName;
}

export function getResolvedPosConfig(): PosIntegrationConfig {
  const settings = getSettings();
  const saved = settings.posIntegrationConfig;
  return {
    activeProvider:
      saved?.activeProvider ||
      (saved?.sambaPos?.enabled ? "sambapos" : "none"),
    sambaPos: {
      ...DEFAULT_SAMBAPOS_CONFIG,
      ...(saved?.sambaPos || {}),
      productMappings: {
        ...(DEFAULT_SAMBAPOS_CONFIG.productMappings || {}),
        ...(saved?.sambaPos?.productMappings || {}),
      },
    },
  };
}

function normalizeServerUrl(raw: string): string {
  return (raw || "http://localhost:9000").trim().replace(/\/+$/, "");
}

/**
 * SambaPOS V5 Message Server OAuth2 (/Token) üzerinden Access Token alır.
 * Kullanıcının girdiği bilgileri önce dener; eğer client_id veya kullanıcı adı
 * standart SambaPOS kurulumlarından (pda / restoran_pos / Administrator / Admin) farklıysa
 * otomatik olarak yedek kombinasyonları dener.
 */
async function authenticateSambaPos(cfg: SambaPosConfig): Promise<string> {
  const baseUrl = normalizeServerUrl(cfg.serverUrl);

  const candidateCredentials: Array<{
    clientId: string;
    username: string;
    password: string;
  }> = [
    {
      clientId: cfg.clientId || "pda",
      username: cfg.username || "Administrator",
      password: cfg.password || "1234",
    },
    {
      clientId: "pda",
      username: "Administrator",
      password: cfg.password || "1234",
    },
    {
      clientId: "pda",
      username: "pda",
      password: "2520634",
    },
    {
      clientId: "restoran_pos",
      username: "Administrator",
      password: cfg.password || "1234",
    },
    {
      clientId: "gokiosk",
      username: "gokiosk",
      password: "98989898",
    },
  ];

  let lastError = "";
  for (const cred of candidateCredentials) {
    try {
      const body = new URLSearchParams();
      body.set("grant_type", "password");
      body.set("username", cred.username);
      body.set("password", cred.password);
      body.set("client_id", cred.clientId);

      const res = await fetch(`${baseUrl}/Token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = (await res.json()) as { access_token?: string };
        if (data?.access_token) {
          return data.access_token;
        }
      } else {
        const errText = await res.text().catch(() => "");
        lastError = `HTTP ${res.status}: ${errText.slice(0, 140)}`;
      }
    } catch (err) {
      lastError =
        err instanceof Error ? err.message : "Message Server bağlantı hatası";
    }
  }

  throw new Error(
    `SambaPOS Token Hatası (${baseUrl}/Token): ${lastError}. Lütfen SambaPOS Message Server'ın (Port 9000) açık olduğundan emin olun.`
  );
}

/**
 * SambaPOS V5 /api/graphql uç noktasına GraphQL sorgusu/mutasyonu gönderir.
 */
async function executeSambaGraphQL(
  cfg: SambaPosConfig,
  accessToken: string,
  query: string
): Promise<{
  data?: Record<string, unknown>;
  errors?: Array<{ message: string }>;
}> {
  const baseUrl = normalizeServerUrl(cfg.serverUrl);
  const res = await fetch(`${baseUrl}/api/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(8000),
  });

  const rawText = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(rawText) as {
      data?: Record<string, unknown>;
      errors?: Array<{ message: string }>;
    };
    if (parsed && (parsed.data !== undefined || parsed.errors !== undefined)) {
      return parsed;
    }
  } catch {
    // not JSON
  }

  if (!res.ok) {
    throw new Error(
      `SambaPOS GraphQL HTTP Hatası (${res.status}): ${rawText.slice(0, 240)}`
    );
  }

  return {};
}

/**
 * Siparişteki ürünlerin SambaPOS `MenuItems` tablosunda var olduğundan emin olur.
 * Eğer online menüdeki bir ürün SambaPOS'ta yoksa, GraphQL `addProduct` mutasyonu ile
 * gerçek adı ve fiyatıyla otomatik olarak SambaPOS menüsüne ekler.
 */
async function ensureSambaProductsExist(
  cfg: SambaPosConfig,
  accessToken: string,
  order: Order
): Promise<void> {
  const gStr = (val: string) => JSON.stringify(String(val ?? ""));
  let createdAny = false;

  const categories = getCategories();
  const menuItems = getMenuItems();
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const itemGroupMap = new Map(
    menuItems.map((m) => [
      m.id,
      catMap.get(m.categoryId) || "Online Sipariş",
    ])
  );
  const itemNameGroupMap = new Map(
    menuItems.map((m) => [
      m.name.trim().toLowerCase(),
      catMap.get(m.categoryId) || "Online Sipariş",
    ])
  );

  const itemsToEnsure: Array<{
    name: string;
    price: number;
    groupCode: string;
  }> = [];
  for (const item of order.items) {
    const unitPrice = item.isComplimentary
      ? 0
      : Number(item.unitPrice || item.basePrice || 0);
    const resolvedName = resolveMappedSambaProductName(item, cfg);
    const groupCode =
      (item.menuItemId && itemGroupMap.get(item.menuItemId)) ||
      itemNameGroupMap.get(item.name.trim().toLowerCase()) ||
      "Online Sipariş";
    itemsToEnsure.push({
      name: resolvedName,
      price: Number(unitPrice.toFixed(2)),
      groupCode,
    });
  }

  if (order.deliveryFee && order.deliveryFee > 0) {
    itemsToEnsure.push({
      name: "Paket Servis Ücreti",
      price: Number(order.deliveryFee.toFixed(2)),
      groupCode: "Online Sipariş",
    });
  }

  if (cfg.fallbackMenuItemName?.trim()) {
    itemsToEnsure.push({
      name: cfg.fallbackMenuItemName.trim(),
      price: 0,
      groupCode: "Online Sipariş",
    });
  }

  const seenNames = new Set<string>();
  for (const prod of itemsToEnsure) {
    if (!prod.name || seenNames.has(prod.name)) continue;
    seenNames.add(prod.name);

    try {
      const checkRes = await executeSambaGraphQL(
        cfg,
        accessToken,
        `query { getProduct(name: ${gStr(prod.name)}) { id name } }`
      );
      const existing = checkRes.data?.getProduct as
        | { id?: number; name?: string }
        | undefined;

      if (!existing || !existing.id || existing.id === 0) {
        await executeSambaGraphQL(
          cfg,
          accessToken,
          `mutation {
            addProduct(
              name: ${gStr(prod.name)},
              groupCode: ${gStr(prod.groupCode || "Online Sipariş")},
              portions: [
                { name: "Normal", price: ${prod.price}, multiplier: 1 }
              ]
            ) {
              id
              name
            }
          }`
        );
        createdAny = true;
      }
    } catch {
      // ignore individual product check error
    }
  }

  if (createdAny) {
    await executeSambaGraphQL(
      cfg,
      accessToken,
      `mutation { postResetProductCacheMessage { id } }`
    ).catch(() => {});
  }
}

/**
 * SambaPOS içerisindeki mevcut Departman, Belge Tipi (TicketType), Masa ve Müşteri varlıklarını
 * kontrol ederek sipariş için en uygun eşleşmeyi hazırlar.
 */
async function prepareSambaTicketContext(
  cfg: SambaPosConfig,
  accessToken: string,
  order: Order
): Promise<{
  department: string;
  ticketType: string;
  resolvedTableName?: string;
  resolvedCustomerName?: string;
}> {
  const gStr = (val: string) => JSON.stringify(String(val ?? ""));

  let departments: string[] = [];
  let ticketTypes: string[] = [];

  try {
    const metaRes = await executeSambaGraphQL(
      cfg,
      accessToken,
      `query {
        getDepartments { name }
        getTicketTypes { name }
      }`
    );
    departments = (
      (metaRes.data?.getDepartments as Array<{ name: string }>) || []
    ).map((d) => d.name);
    ticketTypes = (
      (metaRes.data?.getTicketTypes as Array<{ name: string }>) || []
    ).map((t) => t.name);
  } catch {
    // ignore
  }

  // 1) Departman ve Belge Tipi (TicketType) Seçimi
  let department = cfg.departmentName || "Restoran";
  let ticketType = cfg.ticketTypeName || "Adisyon";

  if (order.orderType === "delivery") {
    if (departments.includes("Paket Servis")) department = "Paket Servis";
    if (ticketTypes.includes("Paket Servis")) ticketType = "Paket Servis";
  } else if (order.orderType === "pickup") {
    if (departments.includes("Paket Servis")) department = "Paket Servis";
    if (ticketTypes.includes("Gel Al")) {
      ticketType = "Gel Al";
    } else if (ticketTypes.includes("Paket Servis")) {
      ticketType = "Paket Servis";
    }
  } else if (order.orderType === "dine_in") {
    if (departments.includes("Restoran")) department = "Restoran";
    if (ticketTypes.includes("Adisyon")) ticketType = "Adisyon";
  }

  // 2) Masa Siparişi (dine_in) ise Masa Varlığını Eşleştir veya Oluştur
  let resolvedTableName: string | undefined;
  const tableEntityType = cfg.tableEntityType || "Masalar";

  if (order.orderType === "dine_in" && order.tableNumber) {
    const rawNum = String(order.tableNumber).trim();
    const prefix = cfg.tableEntityPrefix ?? "";
    const candidates = [
      rawNum,
      `${prefix}${rawNum}`,
      `B${rawNum}`,
      `M${rawNum}`,
      `Masa ${rawNum}`,
      `MASA ${rawNum}`,
    ];

    try {
      const entRes = await executeSambaGraphQL(
        cfg,
        accessToken,
        `query { getEntities(type: ${gStr(tableEntityType)}, take: 200) { name } }`
      );
      const existingTables = (
        (entRes.data?.getEntities as Array<{ name: string }>) || []
      ).map((e) => e.name);

      const found = candidates.find((c) =>
        existingTables.some((t) => t.toLowerCase() === c.toLowerCase())
      );

      if (found) {
        resolvedTableName =
          existingTables.find((t) => t.toLowerCase() === found.toLowerCase()) ||
          found;
      } else {
        // Masalar içinde yoksa yeni masa varlığı olarak ekle
        const newTableName =
          prefix && !rawNum.startsWith(prefix)
            ? `${prefix}${rawNum}`
            : `Masa ${rawNum}`;
        await executeSambaGraphQL(
          cfg,
          accessToken,
          `mutation {
            addEntity(
              entity: {
                entityType: ${gStr(tableEntityType)},
                name: ${gStr(newTableName)}
              }
            ) {
              id
              name
            }
          }`
        );
        resolvedTableName = newTableName;
      }
    } catch {
      resolvedTableName = `${prefix || "Masa "}${rawNum}`;
    }
  }

  // 3) Paket Servis veya Gel-Al ise Müşteri Varlığını (Müşteriler) Eşleştir veya Oluştur
  let resolvedCustomerName: string | undefined;
  const custEntityType = cfg.customerEntityType || "Müşteriler";

  if (
    order.orderType !== "dine_in" &&
    (cfg.autoCreateCustomerEntity !== false) &&
    order.customerName
  ) {
    const custName = order.customerName.trim();
    const phoneStr = (order.customerPhone || "").trim();
    const addrStr = [
      order.customerAddress || "",
      order.deliveryZoneName ? `(${order.deliveryZoneName})` : "",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const existsRes = await executeSambaGraphQL(
        cfg,
        accessToken,
        `query { isEntityExists(type: ${gStr(custEntityType)}, name: ${gStr(custName)}) }`
      );
      const exists = Boolean(existsRes.data?.isEntityExists);

      if (!exists) {
        await executeSambaGraphQL(
          cfg,
          accessToken,
          `mutation {
            addEntity(
              entity: {
                entityType: ${gStr(custEntityType)},
                name: ${gStr(custName)},
                customData: [
                  { name: "Telefon", value: ${gStr(phoneStr)} },
                  { name: "Adres", value: ${gStr(addrStr)} }
                ]
              }
            ) {
              id
              name
            }
          }`
        );
      } else {
        if (phoneStr) {
          await executeSambaGraphQL(
            cfg,
            accessToken,
            `mutation {
              updateEntityCustomData(
                entityTypeName: ${gStr(custEntityType)},
                entityName: ${gStr(custName)},
                name: "Telefon",
                value: ${gStr(phoneStr)}
              )
            }`
          ).catch(() => {});
        }
        if (addrStr) {
          await executeSambaGraphQL(
            cfg,
            accessToken,
            `mutation {
              updateEntityCustomData(
                entityTypeName: ${gStr(custEntityType)},
                entityName: ${gStr(custName)},
                name: "Adres",
                value: ${gStr(addrStr)}
              )
            }`
          ).catch(() => {});
        }
      }
      resolvedCustomerName = custName;
    } catch {
      // ignore customer entity error
    }
  }

  return {
    department,
    ticketType,
    resolvedTableName,
    resolvedCustomerName,
  };
}

/**
 * Sipariş verisinden SambaPOS V5 `addTicket` GraphQL mutasyonu üretir.
 */
export function buildSambaPosAddTicketMutation(
  order: Order,
  cfg: SambaPosConfig,
  useFallbackItem = false,
  context?: {
    department?: string;
    ticketType?: string;
    resolvedTableName?: string;
    resolvedCustomerName?: string;
  }
): string {
  const gStr = (val: string) => JSON.stringify(String(val ?? ""));

  const payLabel =
    order.paymentMethod === "cash"
      ? "Nakit"
      : order.paymentMethod === "card_at_door"
      ? "Kapıda Kredi Kartı (POS)"
      : order.paymentMethod === "credit"
      ? "Açık Hesap (Veresiye)"
      : "Masada Ödeme";

  const typeLabel =
    order.orderType === "delivery"
      ? "Paket Servis"
      : order.orderType === "pickup"
      ? "Gel-Al"
      : `Masa ${order.tableNumber || ""}`;

  const noteParts = [
    `Online Sipariş #${order.orderNumber} (${typeLabel})`,
    `Müşteri: ${order.customerName} | Tel: ${order.customerPhone}`,
    order.customerAddress ? `Adres: ${order.customerAddress}` : "",
    order.deliveryZoneName ? `Bölge: ${order.deliveryZoneName}` : "",
    `Ödeme: ${payLabel}`,
    order.discountAmount
      ? `İndirim: -${order.discountAmount.toFixed(2)} TL`
      : "",
    order.orderNote ? `Not: ${order.orderNote}` : "",
  ].filter(Boolean);

  const ticketNote = noteParts.join(" | ");

  // Masa veya Müşteri Varlığı (Entities)
  const entitiesList: string[] = [];
  if (order.orderType === "dine_in" && (context?.resolvedTableName || order.tableNumber)) {
    const tableEntityType = cfg.tableEntityType || "Masalar";
    const tableName =
      context?.resolvedTableName ||
      `${cfg.tableEntityPrefix ?? "Masa "}${order.tableNumber}`;
    entitiesList.push(
      `{ entityType: ${gStr(tableEntityType)}, name: ${gStr(tableName)} }`
    );
  } else if (context?.resolvedCustomerName) {
    const custEntityType = cfg.customerEntityType || "Müşteriler";
    entitiesList.push(
      `{ entityType: ${gStr(custEntityType)}, name: ${gStr(context.resolvedCustomerName)} }`
    );
  }

  // Sipariş Kalemleri (Orders)
  const defaultTagGroup = cfg.defaultOrderTagName || "Default";
  const fallbackName = (cfg.fallbackMenuItemName || "").trim();

  const ordersGraphQL = order.items.map((item) => {
    const mappedItemName = resolveMappedSambaProductName(item, cfg);
    const targetItemName =
      useFallbackItem && fallbackName ? fallbackName : mappedItemName;

    const tagEntries: string[] = [];

    if (targetItemName.toLowerCase() !== item.name.trim().toLowerCase()) {
      tagEntries.push(
        `{ tagName: ${gStr(defaultTagGroup)}, tag: ${gStr(`Ürün: ${item.name}`)}, price: 0, quantity: 1 }`
      );
    }

    for (const mod of item.selectedModifiers || []) {
      const modLabel = mod.productTag
        ? `${mod.productTag}: ${mod.optionName}`
        : `${mod.groupName}: ${mod.optionName}`;
      tagEntries.push(
        `{ tagName: ${gStr(defaultTagGroup)}, tag: ${gStr(modLabel)}, price: 0, quantity: 1 }`
      );
    }

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
      calculatePrice: ${item.isComplimentary ? "false" : "true"},
      decreaseInventory: true,
      states: [
        { stateName: "Status", state: "Gönderildi" }
      ],
      tags: [${tagEntries.join(", ")}]
    }`;
  });

  // Paket servis ücreti varsa kalem olarak ekle
  if (order.deliveryFee && order.deliveryFee > 0 && !useFallbackItem) {
    ordersGraphQL.push(`{
      name: "Paket Servis Ücreti",
      menuItemName: "Paket Servis Ücreti",
      quantity: 1,
      price: ${Number(order.deliveryFee.toFixed(2))},
      portion: "Normal",
      calculatePrice: true,
      states: [
        { stateName: "Status", state: "Gönderildi" }
      ],
      tags: []
    }`);
  }

  // Türkçe SambaPOS V5 Adisyon Durumları (Paket Servis, Gel-Al ve Masa ekranlarında görünmesi için)
  const ticketStates: string[] = [
    `{ stateName: "Durum", state: "Ödenmedi" }`,
    `{ stateName: "Status", state: "Yeni Siparişler" }`,
  ];
  if (order.orderType === "delivery") {
    ticketStates.push(`{ stateName: "Paket", state: "Bekliyor" }`);
  } else if (order.orderType === "pickup") {
    ticketStates.push(`{ stateName: "Paket", state: "GelAl" }`);
  }

  const finalTicketType =
    context?.ticketType || cfg.ticketTypeName || "Paket Servis";
  const finalDepartment =
    context?.department || cfg.departmentName || "Restoran";

  return `mutation {
    addTicket(
      ticket: {
        type: ${gStr(finalTicketType)},
        department: ${gStr(finalDepartment)},
        user: ${gStr(cfg.userName || cfg.username || "Administrator")},
        terminal: ${gStr(cfg.terminalName || "Sunucu")},
        note: ${gStr(ticketNote)},
        entities: [${entitiesList.join(", ")}],
        states: [${ticketStates.join(", ")}],
        orders: [${ordersGraphQL.join(",\n")}],
        tags: []
      }
    ) {
      id
      number
      totalAmount
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
      message:
        "Lütfen SambaPOS Sunucu Adresini (örn: http://localhost:9000) girin.",
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
      `query { getDepartments { name } getTicketTypes { name } }`
    );

    if (gqlRes.errors && gqlRes.errors.length > 0) {
      return {
        ok: false,
        message: `SambaPOS Token alındı fakat GraphQL hatası döndü: ${gqlRes.errors[0].message}`,
      };
    }

    const depts = (
      (gqlRes.data?.getDepartments as Array<{ name: string }>) || []
    )
      .map((d) => d.name)
      .join(", ");

    return {
      ok: true,
      message: `✅ SambaPOS V5 Message Server (${baseUrl}) bağlantısı başarılı! Bulunan Departmanlar: ${depts || "Restoran"}`,
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

    // 1) Ürünlerin SambaPOS'ta var olduğundan emin ol (yoksa otomatik ekle)
    await ensureSambaProductsExist(cfg, accessToken, order);

    // 2) Departman, Belge Tipi, Masa ve Müşteri varlıklarını hazırla
    const ticketContext = await prepareSambaTicketContext(
      cfg,
      accessToken,
      order
    );

    // 3) Adisyonu oluştur
    const mutation = buildSambaPosAddTicketMutation(
      order,
      cfg,
      false,
      ticketContext
    );
    let gqlResult = await executeSambaGraphQL(cfg, accessToken, mutation);

    if (
      gqlResult.errors &&
      gqlResult.errors.length > 0 &&
      cfg.fallbackMenuItemName?.trim()
    ) {
      const fallbackMutation = buildSambaPosAddTicketMutation(
        order,
        cfg,
        true,
        ticketContext
      );
      gqlResult = await executeSambaGraphQL(cfg, accessToken, fallbackMutation);
    }

    if (gqlResult.errors && gqlResult.errors.length > 0) {
      throw new Error(gqlResult.errors.map((e) => e.message).join(" | "));
    }

    const addedTicket = gqlResult.data?.addTicket as
      | { id?: string | number; number?: string }
      | undefined;
    const numericId = Number(addedTicket?.id || 0);
    const ticketId = String(
      addedTicket?.number || addedTicket?.id || "SAMBA-OK"
    );

    // 4) Masa siparişi ise masanın rengini "Yeni Siparişler" yap ve SambaPOS ekranını yenile
    if (order.orderType === "dine_in" && ticketContext.resolvedTableName) {
      const gStr = (val: string) => JSON.stringify(String(val ?? ""));
      await executeSambaGraphQL(
        cfg,
        accessToken,
        `mutation {
          updateEntityState(
            entityTypeName: ${gStr(cfg.tableEntityType || "Masalar")},
            entityName: ${gStr(ticketContext.resolvedTableName)},
            stateName: "Status",
            state: "Yeni Siparişler"
          )
        }`
      ).catch(() => {});
    }

    await executeSambaGraphQL(
      cfg,
      accessToken,
      `mutation {
        postTicketRefreshMessage(id: ${numericId}) { id }
        postResetEntityCacheMessage { id }
      }`
    ).catch(() => {});

    const syncInfo: PosOrderSyncInfo = {
      provider: "sambapos",
      status: "synced",
      externalTicketId: ticketId,
      syncedAt: new Date().toISOString(),
    };
    const updated = updateOrderPosSyncInfo(order.id, syncInfo);

    return {
      ok: true,
      message: `✅ Sipariş #${order.orderNumber} SambaPOS'a başarıyla aktarıldı (SambaPOS Fiş No: #${ticketId})!`,
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
    const cutoffMs = Date.now() - 12 * 60 * 60 * 1000;
    const candidates = allOrders.filter((o) => {
      if (o.posSyncInfo?.status === "synced") return false;
      if (o.posSyncInfo?.status === "failed") return false;
      const createdMs = new Date(o.createdAt).getTime();
      if (createdMs < cutoffMs) return false;

      if (sambaCfg.syncTrigger === "on_created") {
        return o.status !== "rejected";
      }
      if (sambaCfg.syncTrigger === "on_accepted") {
        return (
          o.status === "accepted" ||
          o.status === "ready" ||
          o.status === "completed"
        );
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

export interface SambaProductSummary {
  id: number;
  name: string;
  groupCode: string;
  price: number;
  portions: Array<{ id: number; name: string; price: number }>;
}

export interface SiteSambaMenuComparisonItem {
  siteItemId: string;
  siteItemName: string;
  categoryId: string;
  categoryName: string;
  sitePrice: number;
  available: boolean;
  mappedSambaName: string;
  targetSambaName: string;
  status: "matched" | "price_diff" | "missing";
  sambaProductId: number | null;
  sambaGroupCode: string | null;
  sambaPrice: number | null;
}

export interface SambaPosCatalogResponse {
  ok: boolean;
  message?: string;
  sambaProducts: SambaProductSummary[];
  items: SiteSambaMenuComparisonItem[];
  stats: {
    totalSiteItems: number;
    matchedCount: number;
    priceDiffCount: number;
    missingCount: number;
    totalSambaProducts: number;
  };
}

/**
 * SambaPOS'taki mevcut tüm ürünleri (`getProducts`) çeker ve sitedeki menü ürünleriyle
 * birebir karşılaştırarak eşleşme / fiyat farkı / eksiklik durumunu döndürür.
 */
export async function fetchSambaPosCatalog(
  customCfg?: Partial<SambaPosConfig>
): Promise<SambaPosCatalogResponse> {
  const cfg: SambaPosConfig = {
    ...getResolvedPosConfig().sambaPos,
    ...(customCfg || {}),
  };

  const categories = getCategories();
  const menuItems = getMenuItems();
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  try {
    const accessToken = await authenticateSambaPos(cfg);
    const gqlRes = await executeSambaGraphQL(
      cfg,
      accessToken,
      `query {
        getProducts {
          id
          name
          groupCode
          portions {
            id
            name
            price
          }
        }
      }`
    );

    const rawProducts = (gqlRes.data?.getProducts || []) as Array<{
      id: number;
      name: string;
      groupCode?: string;
      portions?: Array<{ id: number; name: string; price: number }>;
    }>;

    const sambaProducts: SambaProductSummary[] = rawProducts
      .filter((p) => p && p.name)
      .map((p) => {
        const portions = Array.isArray(p.portions) ? p.portions : [];
        const normalPortion =
          portions.find((pt) => pt.name?.toLowerCase() === "normal") ||
          portions[0];
        return {
          id: Number(p.id || 0),
          name: String(p.name).trim(),
          groupCode: String(p.groupCode || "").trim(),
          price: Number(normalPortion?.price ?? 0),
          portions,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    const sambaByLowerName = new Map<string, SambaProductSummary>();
    for (const sp of sambaProducts) {
      sambaByLowerName.set(sp.name.toLowerCase(), sp);
    }

    let matchedCount = 0;
    let priceDiffCount = 0;
    let missingCount = 0;

    const items: SiteSambaMenuComparisonItem[] = menuItems.map((item) => {
      const categoryName = catMap.get(item.categoryId) || "Online Sipariş";
      const customMapped = (
        cfg.productMappings?.[item.id] ||
        cfg.productMappings?.[item.name.trim()] ||
        ""
      ).trim();
      const targetSambaName = customMapped || item.name.trim();
      const found = sambaByLowerName.get(targetSambaName.toLowerCase());

      if (!found) {
        missingCount++;
        return {
          siteItemId: item.id,
          siteItemName: item.name,
          categoryId: item.categoryId,
          categoryName,
          sitePrice: Number(item.price || 0),
          available: Boolean(item.available),
          mappedSambaName: customMapped,
          targetSambaName,
          status: "missing",
          sambaProductId: null,
          sambaGroupCode: null,
          sambaPrice: null,
        };
      }

      const sitePrice = Number(Number(item.price || 0).toFixed(2));
      const sambaPrice = Number(Number(found.price || 0).toFixed(2));
      const isPriceEqual = Math.abs(sitePrice - sambaPrice) < 0.01;

      if (isPriceEqual) {
        matchedCount++;
      } else {
        priceDiffCount++;
      }

      return {
        siteItemId: item.id,
        siteItemName: item.name,
        categoryId: item.categoryId,
        categoryName,
        sitePrice,
        available: Boolean(item.available),
        mappedSambaName: customMapped,
        targetSambaName: found.name,
        status: isPriceEqual ? "matched" : "price_diff",
        sambaProductId: found.id,
        sambaGroupCode: found.groupCode || null,
        sambaPrice,
      };
    });

    return {
      ok: true,
      message: `✅ SambaPOS'ta ${sambaProducts.length} kayıtlı ürün bulundu. Sitedeki ${menuItems.length} üründen ${matchedCount + priceDiffCount} tanesi eşleşiyor.`,
      sambaProducts,
      items,
      stats: {
        totalSiteItems: menuItems.length,
        matchedCount,
        priceDiffCount,
        missingCount,
        totalSambaProducts: sambaProducts.length,
      },
    };
  } catch (err) {
    const fallbackItems: SiteSambaMenuComparisonItem[] = menuItems.map(
      (item) => {
        const customMapped = (
          cfg.productMappings?.[item.id] ||
          cfg.productMappings?.[item.name.trim()] ||
          ""
        ).trim();
        return {
          siteItemId: item.id,
          siteItemName: item.name,
          categoryId: item.categoryId,
          categoryName: catMap.get(item.categoryId) || "Online Sipariş",
          sitePrice: Number(item.price || 0),
          available: Boolean(item.available),
          mappedSambaName: customMapped,
          targetSambaName: customMapped || item.name.trim(),
          status: "missing",
          sambaProductId: null,
          sambaGroupCode: null,
          sambaPrice: null,
        };
      }
    );

    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "SambaPOS ürün listesi çekilemedi.",
      sambaProducts: [],
      items: fallbackItems,
      stats: {
        totalSiteItems: menuItems.length,
        matchedCount: 0,
        priceDiffCount: 0,
        missingCount: menuItems.length,
        totalSambaProducts: 0,
      },
    };
  }
}

/**
 * Kasa PC üzerinde yerel SambaPOS SQL Server veritabanı (`SambaSettings.txt`) erişilebilir ise,
 * aktarılan kategorileri ve ürünleri SambaPOS'un dokunmatik POS Menü ekranına da (`ScreenMenuCategories`
 * ve `ScreenMenuItems`) otomatik olarak ekler.
 */
function syncLocalSambaScreenMenu(
  entries: Array<{ categoryName: string; productName: string }>
): number {
  if (entries.length === 0) return 0;
  try {
    const settingsPath =
      "C:\\ProgramData\\SambaPOS\\SambaPOS5\\SambaSettings.txt";
    let server = "localhost";
    let database = "YILDIZHANPOS5";

    if (fs.existsSync(settingsPath)) {
      const xml = fs.readFileSync(settingsPath, "utf-8");
      const dsMatch = xml.match(/Data Source=([^;<]+)/i);
      const dbMatch = xml.match(/Database=([^;<]+)/i);
      if (dsMatch?.[1]?.trim()) server = dsMatch[1].trim();
      if (dbMatch?.[1]?.trim()) database = dbMatch[1].trim();
    }

    const escSql = (s: string) => String(s || "").replace(/'/g, "''");
    const sqlLines: string[] = [
      "SET NOCOUNT ON;",
      "DECLARE @menuId INT = (SELECT TOP 1 Id FROM ScreenMenus ORDER BY Id);",
      "DECLARE @catId INT;",
      "DECLARE @prodId INT;",
      "IF @menuId IS NOT NULL BEGIN",
    ];

    for (const entry of entries) {
      const cat = escSql(entry.categoryName || "Online Sipariş");
      const prod = escSql(entry.productName);
      sqlLines.push(`
        SET @catId = (SELECT TOP 1 Id FROM ScreenMenuCategories WHERE ScreenMenuId = @menuId AND Name = N'${cat}');
        IF @catId IS NULL BEGIN
          INSERT INTO ScreenMenuCategories (
            Name, Header, Appearance, SortOrder, ScreenMenuId, MostUsedItemsCategory,
            ColumnCount, MenuItemButtonHeight, MenuItemButtonColor, MenuItemFontSize,
            WrapText, PageCount, SortAlphabetically, MainButtonHeight, MainButtonColor,
            MainFontSize, SubButtonHeight, SubButtonRows, SubButtonColorDef,
            NumeratorType, NumeratorValues, AlphaButtonValues, ImagePath, NumberPadPercent, MaxItems
          ) VALUES (
            N'${cat}', NULL, 0, 0, @menuId, 0,
            0, 0, N'Green', 24.0,
            1, 1, 0, 0, N'Orange',
            26.0, 75, 1, N'',
            2, NULL, NULL, NULL, 45, 0
          );
          SET @catId = SCOPE_IDENTITY();
        END
        SET @prodId = (SELECT TOP 1 Id FROM MenuItems WHERE Name = N'${prod}');
        IF @prodId IS NOT NULL AND @catId IS NOT NULL BEGIN
          IF NOT EXISTS (SELECT 1 FROM ScreenMenuItems WHERE ScreenMenuCategoryId = @catId AND MenuItemId = @prodId) BEGIN
            INSERT INTO ScreenMenuItems (
              Name, Header, Appearance, ScreenMenuCategoryId, MenuItemId, SortOrder,
              AutoSelect, ButtonColor, Quantity, ImagePath, FontSize, SubMenuTag,
              ItemPortion, OrderTags, OrderStates, AutomationCommand, AutomationCommandValue,
              DisablePortionSelection, GroupTag
            ) VALUES (
              N'${prod}', NULL, 0, @catId, @prodId, 0,
              0, NULL, 1, NULL, 1.0, N'',
              NULL, NULL, NULL, NULL, NULL,
              0, NULL
            );
          END
        END
      `);
    }

    sqlLines.push("END");

    const tmpSqlFile = path.join(
      os.tmpdir(),
      `sambapos_menu_sync_${Date.now()}.sql`
    );
    // Write with UTF-16LE BOM so sqlcmd preserves all Turkish Unicode characters natively
    const utf16Content = "\uFEFF" + sqlLines.join("\r\n");
    fs.writeFileSync(tmpSqlFile, utf16Content, { encoding: "utf16le" });

    try {
      execFileSync(
        "sqlcmd",
        ["-S", server, "-C", "-E", "-d", database, "-i", tmpSqlFile],
        { timeout: 10000, stdio: "ignore" }
      );
      return entries.length;
    } finally {
      try {
        fs.unlinkSync(tmpSqlFile);
      } catch {
        // ignore
      }
    }
  } catch {
    return 0;
  }
}

/**
 * Sitedeki ürünleri (tümünü veya seçilenleri) kategorileri ve fiyatlarıyla birlikte
 * SambaPOS V5'e aktarır / eşitler:
 * 1) SambaPOS'ta olmayan ürünleri GraphQL `addProduct` ile kendi kategorisi altında oluşturur.
 * 2) SambaPOS'ta zaten kayıtlı olan ürünlerin fiyatlarını `updateProductPrice` ile sitedeki fiyata günceller.
 * 3) İsteğe bağlı olarak SambaPOS dokunmatik POS menü ekranına (`ScreenMenuCategories` / `ScreenMenuItems`) da ekler.
 * 4) `postResetProductCacheMessage` ile SambaPOS ekran önbelleğini anında yeniler.
 */
export async function syncSiteMenuToSambaPos(options?: {
  itemIds?: string[];
  updatePrices?: boolean;
  syncScreenMenu?: boolean;
  customConfig?: Partial<SambaPosConfig>;
}): Promise<{
  ok: boolean;
  message: string;
  createdCount: number;
  updatedCount: number;
  totalProcessed: number;
  catalog?: SambaPosCatalogResponse;
}> {
  const settings = getSettings();
  const cfg: SambaPosConfig = {
    ...getResolvedPosConfig().sambaPos,
    ...(options?.customConfig || {}),
  };

  try {
    const accessToken = await authenticateSambaPos(cfg);
    const gStr = (val: string) => JSON.stringify(String(val ?? ""));

    // Mevcut SambaPOS ürünlerini çek
    const prodRes = await executeSambaGraphQL(
      cfg,
      accessToken,
      `query {
        getProducts {
          id
          name
          groupCode
          portions {
            id
            name
            price
          }
        }
      }`
    );

    const existingList = (prodRes.data?.getProducts || []) as Array<{
      id: number;
      name: string;
      groupCode?: string;
      portions?: Array<{ id: number; name: string; price: number }>;
    }>;

    const existingMap = new Map<
      string,
      {
        id: number;
        name: string;
        groupCode: string;
        portions: Array<{ id: number; name: string; price: number }>;
      }
    >();
    for (const p of existingList) {
      if (p?.name) {
        existingMap.set(p.name.trim().toLowerCase(), {
          id: Number(p.id || 0),
          name: p.name.trim(),
          groupCode: String(p.groupCode || "").trim(),
          portions: Array.isArray(p.portions) ? p.portions : [],
        });
      }
    }

    const categories = getCategories();
    const allSiteItems = getMenuItems();
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const filterIds =
      Array.isArray(options?.itemIds) && options.itemIds.length > 0
        ? new Set(options.itemIds)
        : null;

    const targetItems = filterIds
      ? allSiteItems.filter((m) => filterIds.has(m.id))
      : allSiteItems;

    let createdCount = 0;
    let updatedCount = 0;
    const screenMenuEntries: Array<{
      categoryName: string;
      productName: string;
    }> = [];

    for (const item of targetItems) {
      const categoryName = catMap.get(item.categoryId) || "Online Sipariş";
      const customMapped = (
        cfg.productMappings?.[item.id] ||
        cfg.productMappings?.[item.name.trim()] ||
        ""
      ).trim();
      const targetSambaName = customMapped || item.name.trim();
      const price = Number(Number(item.price || 0).toFixed(2));

      if (!targetSambaName) continue;

      const existing = existingMap.get(targetSambaName.toLowerCase());

      if (!existing || !existing.id) {
        // Ürün SambaPOS'ta yok -> Yeni ürün olarak ekle
        const addRes = await executeSambaGraphQL(
          cfg,
          accessToken,
          `mutation {
            addProduct(
              name: ${gStr(targetSambaName)},
              groupCode: ${gStr(categoryName)},
              portions: [
                { name: "Normal", price: ${price}, multiplier: 1 }
              ]
            ) {
              id
              name
            }
          }`
        );
        if (!addRes.errors || addRes.errors.length === 0) {
          createdCount++;
          existingMap.set(targetSambaName.toLowerCase(), {
            id: Number(
              (addRes.data?.addProduct as { id?: number })?.id || 99999
            ),
            name: targetSambaName,
            groupCode: categoryName,
            portions: [{ id: 1, name: "Normal", price }],
          });
          screenMenuEntries.push({
            categoryName,
            productName: targetSambaName,
          });
        }
      } else {
        // Ürün SambaPOS'ta zaten var -> Fiyatını güncelle
        const portionName =
          existing.portions.find((pt) => pt.name?.toLowerCase() === "normal")
            ?.name ||
          existing.portions[0]?.name ||
          "Normal";

        if (options?.updatePrices !== false) {
          await executeSambaGraphQL(
            cfg,
            accessToken,
            `mutation {
              updateProductPrice(
                name: ${gStr(existing.name)},
                portion: ${gStr(portionName)},
                price: ${price},
                priceTag: "",
                notifyClients: false
              )
            }`
          );
          updatedCount++;
        }
        screenMenuEntries.push({
          categoryName,
          productName: existing.name,
        });
      }
    }

    // Paket Servis Ücreti kalemini de kontrol et ve yoksa ekle
    if (!filterIds && !existingMap.has("paket servis ücreti")) {
      const delFee = Number(Number(settings.deliveryFee || 0).toFixed(2));
      await executeSambaGraphQL(
        cfg,
        accessToken,
        `mutation {
          addProduct(
            name: "Paket Servis Ücreti",
            groupCode: "Online Sipariş",
            portions: [
              { name: "Normal", price: ${delFee}, multiplier: 1 }
            ]
          ) {
            id
            name
          }
        }`
      ).catch(() => {});
    }

    // POS Dokunmatik Menü ekranına da (ScreenMenuCategories & ScreenMenuItems) ekle
    const shouldSyncScreenMenu =
      options?.syncScreenMenu ?? cfg.syncToScreenMenu !== false;
    if (shouldSyncScreenMenu && screenMenuEntries.length > 0) {
      syncLocalSambaScreenMenu(screenMenuEntries);
    }

    // SambaPOS Ürün Önbelleğini (Product Cache) yenile
    await executeSambaGraphQL(
      cfg,
      accessToken,
      `mutation { postResetProductCacheMessage { id } }`
    ).catch(() => {});

    // Son menü senkronizasyon tarihini kaydet
    const nowIso = new Date().toISOString();
    const nextSamba: SambaPosConfig = {
      ...cfg,
      lastMenuSyncedAt: nowIso,
    };
    updateSettings({
      ...settings,
      posIntegrationConfig: {
        activeProvider: nextSamba.enabled ? "sambapos" : "none",
        sambaPos: nextSamba,
      },
    });

    const updatedCatalog = await fetchSambaPosCatalog(nextSamba);

    return {
      ok: true,
      message: `✅ Sitedeki ${targetItems.length} ürün SambaPOS'a başarıyla aktarıldı! (${createdCount} yeni ürün eklendi, ${updatedCount} ürünün fiyatı eşitlendi)`,
      createdCount,
      updatedCount,
      totalProcessed: targetItems.length,
      catalog: updatedCatalog,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `⚠️ Menü Aktarım Hatası: ${err.message}`
          : "Sitedeki ürünler SambaPOS'a aktarılırken hata oluştu.",
      createdCount: 0,
      updatedCount: 0,
      totalProcessed: 0,
    };
  }
}

