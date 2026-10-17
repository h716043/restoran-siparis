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
  updateOrderStatus,
  updateSettings,
} from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { syncActivityWithCloud } from "@/lib/cloud-sync";
import {
  getResolvedAdisyoConfig,
  syncOrderStatusesFromAdisyoPos,
  syncOrderToAdisyoPos,
  syncSiteOrderUpdateToAdisyoPos,
} from "@/lib/adisyo";
import {
  getResolvedCustomPosConfig,
  syncOrderStatusesFromCustomPos,
  syncOrderToCustomPos,
  syncSiteOrderUpdateToCustomPos,
} from "@/lib/custom-pos";

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
  const resolvedAdisyo = getResolvedAdisyoConfig(saved?.adisyoPos);
  const resolvedCustom = getResolvedCustomPosConfig(saved?.customPos);
  return {
    activeProvider:
      saved?.activeProvider ||
      (saved?.sambaPos?.enabled
        ? "sambapos"
        : resolvedAdisyo.enabled
        ? "adisyo"
        : resolvedCustom.enabled
        ? "custom_pos"
        : "none"),
    sambaPos: {
      ...DEFAULT_SAMBAPOS_CONFIG,
      ...(saved?.sambaPos || {}),
      productMappings: {
        ...(DEFAULT_SAMBAPOS_CONFIG.productMappings || {}),
        ...(saved?.sambaPos?.productMappings || {}),
      },
    },
    adisyoPos: resolvedAdisyo,
    customPos: resolvedCustom,
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
        // Masalar içinde yoksa yeni masa varlığı olarak ekle (özel masa ismini koru, sadece rakamsa önek ekle)
        const newTableName = /^\d+$/.test(rawNum)
          ? prefix && !rawNum.startsWith(prefix)
            ? `${prefix}${rawNum}`
            : `Masa ${rawNum}`
          : rawNum;
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
      resolvedTableName = /^\d+$/.test(rawNum)
        ? `${prefix || "Masa "}${rawNum}`
        : rawNum;
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
 * Kasa PC üzerindeki SambaPOS V5 yerel SQL Server bağlantı bilgilerini (`SambaSettings.txt`) okur.
 */
function getLocalSambaSqlConnectionInfo(): {
  server: string;
  database: string;
  userId?: string;
  password?: string;
} {
  const settingsPath =
    "C:\\ProgramData\\SambaPOS\\SambaPOS5\\SambaSettings.txt";
  let server = "localhost";
  let database = "YILDIZHANPOS5";
  let userId: string | undefined;
  let password: string | undefined;

  try {
    if (fs.existsSync(settingsPath)) {
      const xml = fs.readFileSync(settingsPath, "utf-8");
      const dsMatch = xml.match(/Data Source=([^;<]+)/i);
      const dbMatch = xml.match(/Database=([^;<]+)/i);
      const uidMatch = xml.match(/User Id=([^;<]+)/i);
      const pwdMatch = xml.match(/Password=([^;<]+)/i);
      if (dsMatch?.[1]?.trim()) server = dsMatch[1].trim();
      if (dbMatch?.[1]?.trim()) database = dbMatch[1].trim();
      if (uidMatch?.[1]?.trim()) userId = uidMatch[1].trim();
      if (pwdMatch?.[1]?.trim()) password = pwdMatch[1].trim();
    }
  } catch {
    // ignore
  }

  return { server, database, userId, password };
}

/**
 * Yerel SQL Server (`YILDIZHANPOS5`) üzerinde UTF-16LE kodlamasıyla `sqlcmd` çalıştırır ve çıktısını döndürür.
 * Bu sayede `SambaPOS-MessagingServer` (Port 9000) Windows servisi durmuş olsa bile tüm katalog, menü ve sipariş
 * işlemleri doğrudan SQL Server üzerinden %100 Türkçe karakter uyumuyla kesintisiz çalışır.
 */
function runLocalSambaSqlQuery(sqlScript: string): string {
  const { server, database, userId, password } =
    getLocalSambaSqlConnectionInfo();
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpIn = path.join(os.tmpdir(), `samba_q_in_${stamp}.sql`);
  const tmpOut = path.join(os.tmpdir(), `samba_q_out_${stamp}.txt`);

  fs.writeFileSync(
    tmpIn,
    "\uFEFF" + sqlScript + "\r\nGO\r\nEXIT\r\n",
    { encoding: "utf16le" }
  );

  try {
    try {
      execFileSync(
        "sqlcmd",
        [
          "-S",
          server,
          "-C",
          "-E",
          "-d",
          database,
          "-h",
          "-1",
          "-W",
          "-s",
          "|",
          "-u",
          "-i",
          tmpIn,
          "-o",
          tmpOut,
        ],
        { timeout: 10000, input: "" }
      );
    } catch (firstErr) {
      if (userId && password) {
        execFileSync(
          "sqlcmd",
          [
            "-S",
            server,
            "-C",
            "-U",
            userId,
            "-P",
            password,
            "-d",
            database,
            "-h",
            "-1",
            "-W",
            "-s",
            "|",
            "-u",
            "-i",
            tmpIn,
            "-o",
            tmpOut,
          ],
          { timeout: 10000, input: "" }
        );
      } else {
        throw firstErr;
      }
    }

    if (!fs.existsSync(tmpOut)) return "";
    return fs.readFileSync(tmpOut, "utf16le");
  } finally {
    try {
      if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn);
    } catch {
      // ignore
    }
    try {
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    } catch {
      // ignore
    }
  }
}

/**
 * Yerel SQL Server (`YILDIZHANPOS5`) üzerindeki `MenuItems`, `MenuItemPortions` ve `MenuItemPrices`
 * tablolarından tüm SambaPOS ürünlerini doğrudan okur.
 */
function fetchLocalSqlSambaProducts(): Array<{
  id: number;
  name: string;
  groupCode: string;
  portions: Array<{ id: number; name: string; price: number }>;
}> {
  const out = runLocalSambaSqlQuery(`
    SET NOCOUNT ON;
    SELECT
      m.Id,
      REPLACE(ISNULL(m.Name, N''), N'|', N'/'),
      REPLACE(ISNULL(m.GroupCode, N''), N'|', N'/'),
      ISNULL(p.Id, 0),
      REPLACE(ISNULL(p.Name, N'Normal'), N'|', N'/'),
      ISNULL(pr.Price, 0)
    FROM MenuItems m
    LEFT JOIN MenuItemPortions p ON p.MenuItemId = m.Id
    LEFT JOIN MenuItemPrices pr ON pr.MenuItemPortionId = p.Id AND (pr.PriceTag IS NULL OR pr.PriceTag = '')
    ORDER BY m.Id ASC, p.Id ASC;
  `);

  const map = new Map<
    number,
    {
      id: number;
      name: string;
      groupCode: string;
      portions: Array<{ id: number; name: string; price: number }>;
    }
  >();

  for (const rawLine of out.split(/\r?\n/)) {
    const line = rawLine.replace(/^\uFEFF/, "").trim();
    if (!line || !line.includes("|")) continue;
    const parts = line.split("|");
    if (parts.length < 6) continue;
    const id = Number(parts[0]);
    const name = (parts[1] || "").trim();
    const groupCode = (parts[2] || "").trim();
    const portionId = Number(parts[3] || 0);
    const portionName = (parts[4] || "Normal").trim() || "Normal";
    const price = Number(parts[5] || 0);

    if (!Number.isFinite(id) || id <= 0 || !name) continue;

    let entry = map.get(id);
    if (!entry) {
      entry = {
        id,
        name,
        groupCode,
        portions: [],
      };
      map.set(id, entry);
    }
    if (
      portionId > 0 &&
      !entry.portions.some((pt) => pt.id === portionId)
    ) {
      entry.portions.push({
        id: portionId,
        name: portionName,
        price: Number.isFinite(price) ? price : 0,
      });
    } else if (entry.portions.length === 0) {
      entry.portions.push({
        id: 1,
        name: portionName,
        price: Number.isFinite(price) ? price : 0,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * GraphQL Message Server (Port 9000) kapalı olduğunda siparişi doğrudan SambaPOS SQL Server
 * veritabanına (`YILDIZHANPOS5` -> `AccountTransactionDocuments`, `Tickets`, `Orders`, `TicketEntities`, `EntityStateValues`) yazar.
 */
function insertOrderDirectToLocalSqlSambaPos(
  order: Order,
  cfg: SambaPosConfig
): { ticketId: string; numericId: number } {
  const escSql = (s: string) => String(s ?? "").replace(/'/g, "''");

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
  const nowMs = Date.now();
  const sambaDateJson = `\\/Date(${nowMs}+0300)\\/`;

  const ticketStatesArr: Array<{ D: string; S: string; SN: string; SV?: string }> = [
    { D: sambaDateJson, S: "Ödenmedi", SN: "Durum", SV: "" },
    { D: sambaDateJson, S: "Yeni Siparişler", SN: "Status" },
  ];
  if (order.orderType === "delivery") {
    ticketStatesArr.push({ D: sambaDateJson, S: "Bekliyor", SN: "Paket", SV: "" });
  } else if (order.orderType === "pickup") {
    ticketStatesArr.push({ D: sambaDateJson, S: "GelAl", SN: "Paket", SV: "" });
  }
  const ticketStatesJson = JSON.stringify(ticketStatesArr).replace(
    /\\\\\/Date/g,
    "\\/Date"
  );

  const isDineIn = order.orderType === "dine_in";
  const isPickup = order.orderType === "pickup";
  const deptName = isDineIn
    ? "Restoran"
    : cfg.departmentName || "Paket Servis";
  const ticketTypeName = isDineIn
    ? "Adisyon"
    : isPickup
    ? "Gel Al"
    : cfg.ticketTypeName || "Paket Servis";

  const userName = cfg.userName || cfg.username || "pda";
  const totalAmount = Number(Number(order.totalAmount || 0).toFixed(2));
  const defaultTagGroup = cfg.defaultOrderTagName || "Default";

  const orderItemsSql: string[] = [];

  for (const item of order.items) {
    const targetItemName = resolveMappedSambaProductName(item, cfg);
    const effectiveUnitPrice = item.isComplimentary
      ? 0
      : Number(Number(item.unitPrice || item.basePrice || 0).toFixed(2));
    const qty = Number(Number(item.quantity || 1).toFixed(3));
    const calcBit = item.isComplimentary ? 0 : 1;

    const orderTagsList: Array<{
      OI: number;
      OK: string;
      Q: number;
      TN: string;
      TV: string;
      UI: number;
    }> = [];

    if (targetItemName.toLowerCase() !== item.name.trim().toLowerCase()) {
      orderTagsList.push({
        OI: 2,
        OK: "000000",
        Q: 1,
        TN: defaultTagGroup,
        TV: `Ürün: ${item.name}`,
        UI: 2,
      });
    }
    for (const mod of item.selectedModifiers || []) {
      const modLabel = mod.productTag
        ? `${mod.productTag}: ${mod.optionName}`
        : `${mod.groupName}: ${mod.optionName}`;
      orderTagsList.push({
        OI: 2,
        OK: "000000",
        Q: 1,
        TN: defaultTagGroup,
        TV: modLabel,
        UI: 2,
      });
    }
    if (item.itemNote) {
      orderTagsList.push({
        OI: 2,
        OK: "000000",
        Q: 1,
        TN: defaultTagGroup,
        TV: `Not: ${item.itemNote}`,
        UI: 2,
      });
    }

    const orderTagsJson =
      orderTagsList.length > 0 ? JSON.stringify(orderTagsList) : "";
    const orderStatesJson = `[{"D":"${sambaDateJson}","OK":"000000","S":"Gönderildi","SN":"Status","SV":null,"U":2}]`;

    orderItemsSql.push(`
      SET @prodId = (SELECT TOP 1 Id FROM MenuItems WHERE Name = N'${escSql(targetItemName)}');
      IF @prodId IS NULL BEGIN
        INSERT INTO MenuItems (GroupCode, Barcode, Tag, CustomTags, ItemType, Name)
        VALUES (N'Online Sipariş', NULL, NULL, NULL, 0, N'${escSql(targetItemName)}');
        SET @prodId = SCOPE_IDENTITY();
        INSERT INTO MenuItemPortions (Name, MenuItemId, Multiplier) VALUES (N'Normal', @prodId, 1);
        SET @portId = SCOPE_IDENTITY();
        INSERT INTO MenuItemPrices (MenuItemPortionId, PriceTag, Price) VALUES (@portId, NULL, ${effectiveUnitPrice});
      END

      INSERT INTO Orders (
        TicketId, WarehouseId, DepartmentId, TerminalId, MenuItemId, MenuItemName, PortionName,
        Price, Quantity, PortionCount, Locked, CalculatePrice, DecreaseInventory, IncreaseInventory,
        OrderNumber, CreatingUserName, CreatedDateTime, LastUpdateDateTime, AccountTransactionTypeId,
        ProductTimerValueId, GroupTagName, GroupTagFormat, Separator, PriceTag, Tag,
        DisablePortionSelection, OrderUid, Taxes, OrderTags, OrderStates
      ) VALUES (
        @ticketId, 1, @deptId, @termId, @prodId, N'${escSql(targetItemName)}', N'Normal',
        ${effectiveUnitPrice}, ${qty}, 1, 1, ${calcBit}, 1, 0,
        @ordNum, N'${escSql(userName)}', @now, @now, 3,
        NULL, NULL, NULL, NULL, NULL, NULL,
        0, REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''),
        N'[{"AC":false,"AT":14,"RN":0,"TN":"%10 KDV","TR":10.00,"TT":1}]',
        ${orderTagsJson ? `N'${escSql(orderTagsJson)}'` : "NULL"},
        N'${escSql(orderStatesJson)}'
      );
    `);
  }

  if (order.deliveryFee && order.deliveryFee > 0) {
    const delFee = Number(Number(order.deliveryFee).toFixed(2));
    const orderStatesJson = `[{"D":"${sambaDateJson}","OK":"000000","S":"Gönderildi","SN":"Status","SV":null,"U":2}]`;
    orderItemsSql.push(`
      SET @prodId = (SELECT TOP 1 Id FROM MenuItems WHERE Name = N'Paket Servis Ücreti');
      IF @prodId IS NULL BEGIN
        INSERT INTO MenuItems (GroupCode, Barcode, Tag, CustomTags, ItemType, Name)
        VALUES (N'Online Sipariş', NULL, NULL, NULL, 0, N'Paket Servis Ücreti');
        SET @prodId = SCOPE_IDENTITY();
        INSERT INTO MenuItemPortions (Name, MenuItemId, Multiplier) VALUES (N'Normal', @prodId, 1);
        SET @portId = SCOPE_IDENTITY();
        INSERT INTO MenuItemPrices (MenuItemPortionId, PriceTag, Price) VALUES (@portId, NULL, ${delFee});
      END

      INSERT INTO Orders (
        TicketId, WarehouseId, DepartmentId, TerminalId, MenuItemId, MenuItemName, PortionName,
        Price, Quantity, PortionCount, Locked, CalculatePrice, DecreaseInventory, IncreaseInventory,
        OrderNumber, CreatingUserName, CreatedDateTime, LastUpdateDateTime, AccountTransactionTypeId,
        ProductTimerValueId, GroupTagName, GroupTagFormat, Separator, PriceTag, Tag,
        DisablePortionSelection, OrderUid, Taxes, OrderTags, OrderStates
      ) VALUES (
        @ticketId, 1, @deptId, @termId, @prodId, N'Paket Servis Ücreti', N'Normal',
        ${delFee}, 1.000, 1, 1, 1, 1, 0,
        @ordNum, N'${escSql(userName)}', @now, @now, 3,
        NULL, NULL, NULL, NULL, NULL, NULL,
        0, REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''),
        N'[{"AC":false,"AT":14,"RN":0,"TN":"%10 KDV","TR":10.00,"TT":1}]',
        NULL,
        N'${escSql(orderStatesJson)}'
      );
    `);
  }

  const custName = (order.customerName || "Online Müşteri").trim();
  const custPhone = (order.customerPhone || "").replace(/\D/g, "");
  const custAddr = [
    order.deliveryZoneName ? `[${order.deliveryZoneName}]` : "",
    order.customerAddress || "",
  ]
    .filter(Boolean)
    .join(" ");
  const custDataJson = JSON.stringify([
    { Name: "Telefon", Value: custPhone },
    { Name: "Adres", Value: custAddr },
  ]);

  const rawTbl = String(order.tableNumber || "1").trim();
  const paddedTbl = /^\d+$/.test(rawTbl) ? rawTbl.padStart(2, "0") : rawTbl;

  const entitySql = isDineIn
    ? `
      DECLARE @tblEntId INT = (
        SELECT TOP 1 Id FROM Entities
        WHERE EntityTypeId = 2 AND (
          Name = N'Masa ${escSql(rawTbl)}' OR
          Name = N'Masa ${escSql(paddedTbl)}' OR
          Name = N'M${escSql(paddedTbl)}' OR
          Name = N'${escSql(rawTbl)}'
        )
      );
      DECLARE @tblEntName NVARCHAR(200) = (SELECT TOP 1 Name FROM Entities WHERE Id = @tblEntId);
      IF @tblEntId IS NOT NULL BEGIN
        INSERT INTO TicketEntities (EntityTypeId, EntityId, AccountId, AccountTypeId, EntityName, EntityCustomData, Notes, LatestEntityStates, Ticket_Id)
        VALUES (2, @tblEntId, 0, 0, @tblEntName, N'[]', NULL, N'[{"D":"${escSql(sambaDateJson)}","S":"Yeni Siparişler","SN":"Status"}]', @ticketId);

        UPDATE EntityStateValues
        SET EntityStates = N'[{"D":"${escSql(sambaDateJson)}","S":"Yeni Siparişler","SN":"Status"}]'
        WHERE EntityId = @tblEntId;
      END
    `
    : `
      DECLARE @custEntId INT = (SELECT TOP 1 Id FROM Entities WHERE EntityTypeId = 1 AND Name = N'${escSql(custName)}');
      IF @custEntId IS NULL BEGIN
        INSERT INTO Entities (EntityTypeId, LastUpdateTime, SearchString, CustomData, Notes, AccountId, WarehouseId, Name)
        VALUES (1, @now, N'${escSql(custName)}', N'${escSql(custDataJson)}', NULL, 0, 0, N'${escSql(custName)}');
        SET @custEntId = SCOPE_IDENTITY();
        INSERT INTO EntityStateValues (EntityId, EntityStates)
        VALUES (@custEntId, N'[{"D":"${escSql(sambaDateJson)}","S":"Yeni Müşteri","SN":"Status"}]');
      END ELSE BEGIN
        UPDATE Entities SET CustomData = N'${escSql(custDataJson)}', LastUpdateTime = @now WHERE Id = @custEntId;
      END

      INSERT INTO TicketEntities (EntityTypeId, EntityId, AccountId, AccountTypeId, EntityName, EntityCustomData, Notes, LatestEntityStates, Ticket_Id)
      VALUES (1, @custEntId, 0, 5, N'${escSql(custName)}', N'${escSql(custDataJson)}', NULL, N'[{"D":"${escSql(sambaDateJson)}","S":"Yeni Siparişler","SN":"Status"}]', @ticketId);
    `;

  const fullSql = `
    SET NOCOUNT ON;
    DECLARE @now DATETIME = GETDATE();
    DECLARE @deptId INT = ISNULL((SELECT TOP 1 Id FROM Departments WHERE Name = N'${escSql(deptName)}'), 1);
    DECLARE @ttId INT = ISNULL((SELECT TOP 1 Id FROM TicketTypes WHERE Name = N'${escSql(ticketTypeName)}'), 2);
    DECLARE @termId INT = ISNULL((SELECT TOP 1 Id FROM Terminals ORDER BY Id), 1);
    DECLARE @tNum INT = 1;
    DECLARE @ordNum INT = 1;

    UPDATE Numerators SET Number = Number + 1 WHERE Id = 1;
    SET @tNum = ISNULL((SELECT TOP 1 Number FROM Numerators WHERE Id = 1), ${order.orderNumber});

    UPDATE Numerators SET Number = Number + 1 WHERE Id = 2;
    SET @ordNum = ISNULL((SELECT TOP 1 Number FROM Numerators WHERE Id = 2), ${order.orderNumber});

    INSERT INTO AccountTransactionDocuments (Date, UserId, UserName, DocumentTypeId, Name)
    VALUES (@now, 1, N'${escSql(userName)}', 0, N'Ticket Transaction [' + CAST(@tNum AS NVARCHAR(20)) + N']');
    DECLARE @docId INT = SCOPE_IDENTITY();

    INSERT INTO Tickets (
      LastUpdateTime, TicketVersion, TicketUid, TicketNumber, Date, LastOrderDate, LastPaymentDate,
      PreOrder, IsClosed, IsLocked, IsOpened, EDocumentDetail, EDocumentSent, TicketData,
      RemainingAmount, TotalAmount, TotalAmountPreTax, DepartmentId, TerminalId, TicketTypeId,
      Note, LastModifiedUserName, CreatedUserName, TicketTags, TicketStates, TicketLogs,
      LineSeparators, ExchangeRate, TaxIncluded, Name, TransactionDocument_Id
    ) VALUES (
      @now, @now, REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''), CAST(@tNum AS NVARCHAR(50)), @now, @now, @now,
      0, 0, 0, 0, NULL, 0, NULL,
      ${totalAmount}, ${totalAmount}, ${totalAmount}, @deptId, @termId, @ttId,
      N'${escSql(ticketNote)}', N'${escSql(userName)}', N'${escSql(userName)}', NULL, N'${escSql(ticketStatesJson)}', NULL,
      N'[]', 1.0000000000, 1, NULL, @docId
    );
    DECLARE @ticketId INT = SCOPE_IDENTITY();
    DECLARE @prodId INT;
    DECLARE @portId INT;

    ${orderItemsSql.join("\n")}
    ${entitySql}

    SELECT N'TICKET_OK', @ticketId, @tNum;
  `;

  const out = runLocalSambaSqlQuery(fullSql);
  for (const rawLine of out.split(/\r?\n/)) {
    const line = rawLine.replace(/^\uFEFF/, "").trim();
    if (line.startsWith("TICKET_OK|")) {
      const parts = line.split("|");
      const numericId = Number(parts[1] || 0);
      const ticketNumber = (parts[2] || "").trim() || String(numericId);
      return { ticketId: ticketNumber, numericId };
    }
  }

  throw new Error("Yerel SQL üzerinden SambaPOS adisyonu oluşturulamadı.");
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
    // Port 9000 (Message Server) kapalıysa yerel SQL Server veritabanı (YILDIZHANPOS5) üzerinden kontrol et
    try {
      const localProds = fetchLocalSqlSambaProducts();
      if (localProds.length > 0) {
        const { database } = getLocalSambaSqlConnectionInfo();
        return {
          ok: true,
          message: `✅ SambaPOS V5 Yerel SQL Veritabanı (${database}) bağlantısı aktif! (${localProds.length} kayıtlı ürün bulundu — Doğrudan SQL Köprüsü devrede)`,
        };
      }
    } catch {
      // ignore fallback error
    }

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

    // GraphQL (SambaPOS V5 Message Server) Modu - Port 9000 kapalıysa otomatik yerel SQL Server'a düşer
    let ticketId = "SAMBA-OK";
    try {
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
      ticketId = String(
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
    } catch (gqlErr) {
      // Port 9000 kapalıysa doğrudan yerel SQL Server (YILDIZHANPOS5) üzerinden adisyonu ekle
      try {
        const sqlTicket = insertOrderDirectToLocalSqlSambaPos(order, cfg);
        ticketId = sqlTicket.ticketId;
      } catch {
        throw gqlErr;
      }
    }

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
let lastReverseSyncMs = 0;

/**
 * SambaPOS V5 içerisindeki fişlerde (Tickets) yapılan:
 * 1) Kurye / Paketçi atamasını (`Paketçiler` varlığı veya `Paketçi Adı` durumu ve `Paket = Yolda` durumu)
 * 2) Teslim Edildi / Ödendi işlemini (`Paket = Teslim Edildi`, `Durum = Ödendi` veya `isClosed && remainingAmount <= 0`)
 * canlı olarak okuyup sitedeki siparişin kuryesini (`courierName`) ve durumunu (`ready` / `completed`) otomatik günceller.
 */
export async function syncOrderStatusesFromSambaPos(options?: {
  customConfig?: Partial<SambaPosConfig>;
  force?: boolean;
}): Promise<{
  ok: boolean;
  updatedCount: number;
  message: string;
}> {
  if (
    process.env.NETLIFY === "true" ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NEXT_PUBLIC_CUSTOMER_ONLY === "true"
  ) {
    return {
      ok: false,
      updatedCount: 0,
      message: "SambaPOS ters yönlü senkronizasyon sadece Kasa PC'de çalışır.",
    };
  }

  const settings = getSettings();
  const cfg: SambaPosConfig = {
    ...getResolvedPosConfig().sambaPos,
    ...(options?.customConfig || {}),
  };

  if (cfg.mode !== "graphql") {
    return {
      ok: false,
      updatedCount: 0,
      message: "SambaPOS ters senkronizasyon GraphQL modunda çalışır.",
    };
  }

  const allOrders = getOrders();
  const cutoffMs = Date.now() - 48 * 60 * 60 * 1000;
  const recentOrders = allOrders.filter(
    (o) =>
      o.status !== "rejected" && new Date(o.createdAt).getTime() >= cutoffMs
  );

  // Henüz tamamlanmamış veya kuryesi atanmamış ya da SambaPOS'a aktarılmış sipariş var mı?
  const hasRelevantOrders = recentOrders.some(
    (o) =>
      o.status !== "completed" ||
      (o.orderType === "delivery" && !o.courierName) ||
      o.posSyncInfo?.status === "synced"
  );

  if (!options?.force && !hasRelevantOrders) {
    return {
      ok: true,
      updatedCount: 0,
      message: "Güncellenecek açık sipariş bulunmuyor.",
    };
  }

  try {
    let sambaCouriers: string[] = [];
    let tickets: Array<{
      id: number;
      number: string;
      isClosed: boolean;
      remainingAmount: number;
      totalAmount: number;
      note?: string;
      entities?: Array<{ name: string; type: string; typeId?: number }>;
      states?: Array<{ stateName: string; state: string }>;
    }> = [];

    try {
      const accessToken = await authenticateSambaPos(cfg);

      const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const gqlRes = await executeSambaGraphQL(
        cfg,
        accessToken,
        `query {
          getTickets(start: "${startDate}", end: "${endDate}") {
            id
            number
            isClosed
            remainingAmount
            totalAmount
            note
            entities {
              name
              type
              typeId
            }
            states {
              stateName
              state
            }
          }
          getEntities(type: "Paketçiler", take: 100) {
            name
          }
        }`
      );

      sambaCouriers = (
        (gqlRes.data?.getEntities as Array<{ name?: string }>) || []
      )
        .map((e) => (e?.name || "").trim())
        .filter(Boolean);

      tickets = (gqlRes.data?.getTickets || []) as typeof tickets;
    } catch {
      // Port 9000 kapalıysa yerel SQL Server (YILDIZHANPOS5) üzerinden Paketçiler, Tickets ve TicketEntities tablolarını oku
      const sqlOut = runLocalSambaSqlQuery(`
        SET NOCOUNT ON;
        SELECT N'COURIER', ISNULL(Name, N'') FROM Entities WHERE EntityTypeId = 3;
        SELECT
          N'TICKET',
          t.Id,
          ISNULL(t.TicketNumber, N''),
          CAST(ISNULL(t.IsClosed, 0) AS INT),
          ISNULL(t.RemainingAmount, 0),
          ISNULL(t.TotalAmount, 0),
          REPLACE(REPLACE(REPLACE(ISNULL(t.Note, N''), N'|', N'§'), CHAR(13), N' '), CHAR(10), N' '),
          REPLACE(ISNULL(t.TicketStates, N'[]'), N'|', N'§')
        FROM Tickets t
        WHERE t.Date >= DATEADD(DAY, -2, GETDATE())
        ORDER BY t.Id DESC;
        SELECT
          N'TENTITY',
          te.Ticket_Id,
          ISNULL(te.EntityTypeId, 0),
          REPLACE(ISNULL(te.EntityName, N''), N'|', N' ')
        FROM TicketEntities te
        INNER JOIN Tickets t ON t.Id = te.Ticket_Id
        WHERE t.Date >= DATEADD(DAY, -2, GETDATE());
      `);

      const ticketMap = new Map<number, (typeof tickets)[number]>();
      for (const rawLine of sqlOut.split(/\r?\n/)) {
        const line = rawLine.replace(/^\uFEFF/, "").trim();
        if (!line) continue;
        const parts = line.split("|");
        if (parts[0] === "COURIER" && parts[1]?.trim()) {
          sambaCouriers.push(parts[1].trim());
        } else if (parts[0] === "TICKET" && parts.length >= 8) {
          const id = Number(parts[1]);
          const number = (parts[2] || "").trim();
          const isClosed = Number(parts[3]) === 1;
          const remainingAmount = Number(parts[4] || 0);
          const totalAmount = Number(parts[5] || 0);
          const note = (parts[6] || "").replace(/§/g, "|").trim();
          const rawStatesJson = (parts[7] || "[]").replace(/§/g, "|").trim();
          const parsedStates: Array<{ stateName: string; state: string }> = [];
          try {
            const arr = JSON.parse(rawStatesJson) as Array<{
              SN?: string;
              S?: string;
            }>;
            if (Array.isArray(arr)) {
              for (const st of arr) {
                if (st?.SN && st?.S) {
                  parsedStates.push({ stateName: st.SN, state: st.S });
                }
              }
            }
          } catch {
            // ignore
          }
          const tObj = {
            id,
            number,
            isClosed,
            remainingAmount,
            totalAmount,
            note,
            entities: [] as Array<{ name: string; type: string; typeId?: number }>,
            states: parsedStates,
          };
          ticketMap.set(id, tObj);
          tickets.push(tObj);
        } else if (parts[0] === "TENTITY" && parts.length >= 4) {
          const tId = Number(parts[1]);
          const eTypeId = Number(parts[2]);
          const eName = (parts[3] || "").trim();
          const parent = ticketMap.get(tId);
          if (parent && eName) {
            parent.entities?.push({
              name: eName,
              type: eTypeId === 3 ? "Paketçiler" : eTypeId === 2 ? "Masalar" : "Müşteriler",
              typeId: eTypeId,
            });
          }
        }
      }
    }

    // 1) SambaPOS'taki "Paketçiler" listesini sitedeki kurye listesiyle (settings.couriers) eşitle
    let settingsChanged = false;
    const currentCouriers = [...(settings.couriers || [])];
    const currentCourierPins = { ...(settings.courierPins || {}) };

    for (const sc of sambaCouriers) {
      if (
        !currentCouriers.some((c) => c.toLowerCase() === sc.toLowerCase())
      ) {
        currentCouriers.push(sc);
        if (!currentCourierPins[sc]) {
          const digits = sc.replace(/\D/g, "");
          currentCourierPins[sc] = digits
            ? digits.repeat(4).slice(0, 4)
            : "1111";
        }
        settingsChanged = true;
      }
    }

    if (settingsChanged) {
      updateSettings({
        ...settings,
        couriers: currentCouriers,
        courierPins: currentCourierPins,
      });
    }

    // 2) SambaPOS Fişlerini (Tickets) Sitedeki Siparişlerle Eşleştir ve Durum / Kurye Güncelle

    // Sipariş eşleştirme haritaları
    const ticketByOrderNumber = new Map<number, (typeof tickets)[number]>();
    const ticketByNumber = new Map<string, (typeof tickets)[number]>();
    const ticketById = new Map<string, (typeof tickets)[number]>();

    for (const t of tickets) {
      if (!t) continue;
      if (t.number) ticketByNumber.set(String(t.number).trim(), t);
      if (t.id) ticketById.set(String(t.id).trim(), t);
      if (t.note) {
        const m = t.note.match(/Online Sipari[şs]\s*#(\d+)/i);
        if (m?.[1]) {
          ticketByOrderNumber.set(Number(m[1]), t);
        }
      }
    }

    let updatedCount = 0;

    for (const ord of recentOrders) {
      const extId = (ord.posSyncInfo?.externalTicketId || "").trim();
      const matchedTicket =
        ticketByOrderNumber.get(ord.orderNumber) ||
        (extId ? ticketByNumber.get(extId) || ticketById.get(extId) : undefined);

      if (!matchedTicket) continue;

      const entities = Array.isArray(matchedTicket.entities)
        ? matchedTicket.entities
        : [];
      const states = Array.isArray(matchedTicket.states)
        ? matchedTicket.states
        : [];

      // Fişteki Kuryeyi (Paketçiler varlığı veya Paketçi Adı durumu) bul
      const courierEntity = entities.find((e) => {
        const tName = (e.type || "").toLowerCase();
        return (
          Number(e.typeId) === 3 ||
          tName.includes("paket") ||
          tName.includes("kurye")
        );
      });
      const courierState = states.find((s) => {
        const sName = (s.stateName || "").toLowerCase();
        return sName.includes("paketçi") || sName.includes("kurye");
      });

      const sambaCourierName = (
        courierEntity?.name ||
        courierState?.state ||
        ""
      ).trim();

      // Fişteki Paket ve Ödeme Durumlarını oku
      const paketState = (
        states.find((s) => (s.stateName || "").toLowerCase() === "paket")
          ?.state || ""
      ).trim();
      const durumState = (
        states.find((s) => (s.stateName || "").toLowerCase() === "durum")
          ?.state || ""
      ).trim();
      const statusState = (
        states.find((s) => (s.stateName || "").toLowerCase() === "status")
          ?.state || ""
      ).trim();

      const isDeliveredInSamba =
        paketState.toLowerCase() === "teslim edildi" ||
        durumState.toLowerCase() === "ödendi" ||
        (Boolean(matchedTicket.isClosed) &&
          Number(matchedTicket.remainingAmount ?? 0) <= 0 &&
          Number(matchedTicket.totalAmount ?? 0) > 0);

      const isOutForDeliveryOrReadyInSamba =
        !isDeliveredInSamba &&
        (paketState.toLowerCase() === "yolda" ||
          Boolean(sambaCourierName) ||
          statusState.toLowerCase() === "hazır");

      let nextStatus = ord.status;
      if (isDeliveredInSamba) {
        nextStatus = "completed";
      } else if (
        isOutForDeliveryOrReadyInSamba &&
        ord.status !== "completed"
      ) {
        nextStatus = "ready";
      }

      const nextCourier = sambaCourierName || ord.courierName || undefined;
      const statusChanged = nextStatus !== ord.status;
      const courierChanged =
        Boolean(sambaCourierName) && sambaCourierName !== (ord.courierName || "");

      if (!statusChanged && !courierChanged) {
        continue;
      }

      const updatedOrder = updateOrderStatus(
        ord.id,
        nextStatus,
        undefined,
        undefined,
        nextCourier
      );

      if (updatedOrder) {
        updatedCount++;

        // Eğer posSyncInfo içinde henüz externalTicketId yoksa onu da kaydet
        if (ord.posSyncInfo?.status !== "synced") {
          updateOrderPosSyncInfo(ord.id, {
            provider: "sambapos",
            status: "synced",
            externalTicketId: String(
              matchedTicket.number || matchedTicket.id
            ),
            syncedAt: new Date().toISOString(),
          });
        }

        // Müşteriye otomatik WhatsApp bildirimi gönder (Durum değiştiyse)
        const digits = (updatedOrder.customerPhone || "").replace(/\D/g, "");
        if (
          statusChanged &&
          settings.whatsappConfig?.sendOrderUpdates !== false &&
          digits.length >= 10
        ) {
          if (updatedOrder.status === "ready") {
            const courierNote = updatedOrder.courierName
              ? `\n🛵 Kurye: *${updatedOrder.courierName}*`
              : "";
            const msg =
              updatedOrder.orderType === "delivery"
                ? `🛵 *${settings.name}*\n\nMerhaba *${updatedOrder.customerName}*, *#${updatedOrder.orderNumber}* numaralı siparişiniz kuryemize teslim edildi ve adresinize doğru yola çıktı!${courierNote}`
                : `🔔 *${settings.name}*\n\nMerhaba *${updatedOrder.customerName}*, *#${updatedOrder.orderNumber}* numaralı siparişiniz hazır!`;
            await sendWhatsAppMessage(
              updatedOrder.customerPhone,
              msg,
              "order_status"
            ).catch(() => {});
          } else if (updatedOrder.status === "completed") {
            const msg = `🎉 *${settings.name}*\n\n*#${updatedOrder.orderNumber}* numaralı siparişiniz teslim edildi. Bizi tercih ettiğiniz için teşekkür eder, afiyet olsun dileriz! ❤️`;
            await sendWhatsAppMessage(
              updatedOrder.customerPhone,
              msg,
              "order_status"
            ).catch(() => {});
          }
        }
      }
    }

    if (updatedCount > 0 || settingsChanged) {
      await syncActivityWithCloud().catch(() => {});
    }

    return {
      ok: true,
      updatedCount,
      message:
        updatedCount > 0
          ? `✅ SambaPOS'tan ${updatedCount} siparişin kurye / teslimat durumu siteye aktarıldı!`
          : "SambaPOS ile sitedeki tüm sipariş durumları güncel.",
    };
  } catch (err) {
    return {
      ok: false,
      updatedCount: 0,
      message:
        err instanceof Error
          ? err.message
          : "SambaPOS durum kontrolü sırasında hata oluştu.",
    };
  }
}

/**
 * Siteden (/kitchen, /admin veya /courier ekranından) bir siparişe kurye atandığında veya
 * "Teslim Edildi" yapıldığında, ilgili fişi SambaPOS tarafında da günceller.
 */
export async function syncSiteOrderUpdateToSambaPos(
  order: Order
): Promise<void> {
  if (
    process.env.NETLIFY === "true" ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NEXT_PUBLIC_CUSTOMER_ONLY === "true"
  ) {
    return;
  }

  const posCfg = getResolvedPosConfig();
  if (posCfg.adisyoPos?.enabled) {
    await syncSiteOrderUpdateToAdisyoPos(order).catch(() => {});
  }
  if (posCfg.customPos?.enabled) {
    await syncSiteOrderUpdateToCustomPos(order).catch(() => {});
  }

  const cfg = posCfg.sambaPos;
  if (!cfg.enabled || cfg.mode !== "graphql") return;
  if (order.posSyncInfo?.status !== "synced") return;

  try {
    const accessToken = await authenticateSambaPos(cfg);
    const gStr = (val: string) => JSON.stringify(String(val ?? ""));

    const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const gqlRes = await executeSambaGraphQL(
      cfg,
      accessToken,
      `query {
        getTickets(start: "${startDate}", end: "${endDate}") {
          id
          number
          note
        }
      }`
    );

    const tickets = (gqlRes.data?.getTickets || []) as Array<{
      id: number;
      number: string;
      note?: string;
    }>;

    const extId = (order.posSyncInfo?.externalTicketId || "").trim();
    const matched = tickets.find((t) => {
      if (t.note && t.note.includes(`Online Sipariş #${order.orderNumber}`)) {
        return true;
      }
      return (
        extId &&
        (String(t.number).trim() === extId || String(t.id).trim() === extId)
      );
    });

    if (!matched?.id) return;

    const ticketDbId = Number(matched.id);
    const userName = cfg.userName || cfg.username || "Administrator";

    if (order.status === "ready" && order.orderType === "delivery") {
      await executeSambaGraphQL(
        cfg,
        accessToken,
        `mutation {
          s1: updateStateOfTicket(
            ticketId: ${ticketDbId},
            stateName: "Paket",
            state: "Yolda",
            userName: ${gStr(userName)}
          )
          ${
            order.courierName
              ? `s2: updateStateOfTicket(
            ticketId: ${ticketDbId},
            stateName: "Paketçi Adı",
            state: ${gStr(order.courierName)},
            userName: ${gStr(userName)}
          )`
              : ""
          }
          r: postTicketRefreshMessage(id: ${ticketDbId}) { id }
        }`
      ).catch(() => {});
    } else if (order.status === "completed" && order.orderType === "delivery") {
      await executeSambaGraphQL(
        cfg,
        accessToken,
        `mutation {
          s1: updateStateOfTicket(
            ticketId: ${ticketDbId},
            stateName: "Paket",
            state: "Teslim Edildi",
            userName: ${gStr(userName)}
          )
          r: postTicketRefreshMessage(id: ${ticketDbId}) { id }
        }`
      ).catch(() => {});
    }
  } catch {
    // Port 9000 kapalıysa yerel SQL Server üzerinden de durum güncellemesini uygula
    try {
      const escSql = (s: string) => String(s ?? "").replace(/'/g, "''");
      const nowMs = Date.now();
      const sambaDateJson = `\\/Date(${nowMs}+0300)\\/`;
      const newPaketState =
        order.status === "completed"
          ? "Teslim Edildi"
          : order.status === "ready"
          ? "Yolda"
          : "Bekliyor";
      const statesArr: Array<{ D: string; S: string; SN: string; SV?: string }> = [
        {
          D: sambaDateJson,
          S: order.status === "completed" ? "Ödendi" : "Ödenmedi",
          SN: "Durum",
          SV: "",
        },
        { D: sambaDateJson, S: newPaketState, SN: "Paket", SV: "" },
        { D: sambaDateJson, S: "Yeni Siparişler", SN: "Status" },
      ];
      if (order.courierName) {
        statesArr.push({
          D: sambaDateJson,
          S: order.courierName,
          SN: "Paketçi Adı",
          SV: "",
        });
      }
      const statesJson = JSON.stringify(statesArr).replace(
        /\\\\\/Date/g,
        "\\/Date"
      );
      const extId = escSql((order.posSyncInfo?.externalTicketId || "").trim());

      runLocalSambaSqlQuery(`
        SET NOCOUNT ON;
        DECLARE @tId INT = (
          SELECT TOP 1 Id FROM Tickets
          WHERE Note LIKE N'%Online Sipariş #${order.orderNumber}%'
             OR (${extId ? `TicketNumber = N'${extId}'` : "1=0"})
          ORDER BY Id DESC
        );
        IF @tId IS NOT NULL BEGIN
          UPDATE Tickets
          SET TicketStates = N'${escSql(statesJson)}', LastUpdateTime = GETDATE()
          WHERE Id = @tId;
        END
      `);
    } catch {
      // ignore
    }
  }
}

/**
 * Kasa PC üzerinde (yerelde) çalışırken:
 * 1) Hem yerel hem de Netlify/Turso buluttan yeni gelen siparişleri `syncTrigger` ayarına göre otomatik SambaPOS, Adisyo veya NarPOS/Kerzz/Özel POS'a aktarır.
 * 2) POS sistemlerinde kurye ataması veya "Teslim Edildi / Ödendi" yapılan siparişleri otomatik olarak sitede de günceller.
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
  const adisyoCfg = posCfg.adisyoPos;
  const customCfg = posCfg.customPos;
  if (!sambaCfg.enabled && !adisyoCfg?.enabled && !customCfg?.enabled) {
    return;
  }

  isAutoSyncRunning = true;
  try {
    const allOrders = getOrders();
    const cutoffMs = Date.now() - 12 * 60 * 60 * 1000;

    // A1) Site -> SambaPOS (Yeni siparişleri SambaPOS'a gönder)
    if (sambaCfg.enabled && sambaCfg.syncTrigger !== "manual") {
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
    }

    // A2) Site -> Adisyo / Kurye POS (Yeni siparişleri Adisyo / Kurye POS'a gönder)
    if (adisyoCfg?.enabled && adisyoCfg.syncTrigger !== "manual") {
      const adisyoCandidates = allOrders.filter((o) => {
        if (o.posSyncInfo?.status === "synced") return false;
        if (o.posSyncInfo?.status === "failed") return false;
        const createdMs = new Date(o.createdAt).getTime();
        if (createdMs < cutoffMs) return false;

        if (adisyoCfg.syncTrigger === "on_created") {
          return o.status !== "rejected";
        }
        if (adisyoCfg.syncTrigger === "on_accepted") {
          return (
            o.status === "accepted" ||
            o.status === "ready" ||
            o.status === "completed"
          );
        }
        return false;
      });

      for (const ord of adisyoCandidates) {
        await syncOrderToAdisyoPos(ord);
      }
    }

    // A3) Site -> NarPOS / Kerzz / Özel API
    if (customCfg?.enabled && customCfg.syncTrigger !== "manual") {
      const customCandidates = allOrders.filter((o) => {
        if (o.posSyncInfo?.status === "synced") return false;
        if (o.posSyncInfo?.status === "failed") return false;
        const createdMs = new Date(o.createdAt).getTime();
        if (createdMs < cutoffMs) return false;

        if (customCfg.syncTrigger === "on_created") {
          return o.status !== "rejected";
        }
        if (customCfg.syncTrigger === "on_accepted") {
          return (
            o.status === "accepted" ||
            o.status === "ready" ||
            o.status === "completed"
          );
        }
        return false;
      });

      for (const ord of customCandidates) {
        await syncOrderToCustomPos(ord);
      }
    }

    // B) POS -> Site (SambaPOS, Adisyo veya NarPOS/Kerzz'de kurye atanan veya teslim edilen siparişleri sitede güncelle)
    const now = Date.now();
    if (now - lastReverseSyncMs >= 2500) {
      lastReverseSyncMs = now;
      if (sambaCfg.enabled) {
        await syncOrderStatusesFromSambaPos();
      }
      if (adisyoCfg?.enabled && adisyoCfg.autoAssignCourierFromAdisyo !== false) {
        await syncOrderStatusesFromAdisyoPos();
      }
      if (customCfg?.enabled && customCfg.autoSyncCourierAndStatus !== false) {
        await syncOrderStatusesFromCustomPos();
      }
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
 * SambaPOS'taki mevcut tüm ürünleri (`getProducts` veya yerel SQL Server `MenuItems`) çeker ve sitedeki
 * menü ürünleriyle birebir karşılaştırarak eşleşme / fiyat farkı / eksiklik durumunu döndürür.
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
    let rawProducts: Array<{
      id: number;
      name: string;
      groupCode?: string;
      portions?: Array<{ id: number; name: string; price: number }>;
    }> = [];

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
      rawProducts = (gqlRes.data?.getProducts || []) as typeof rawProducts;
    } catch (gqlErr) {
      // Port 9000 (Message Server) kapalıysa yerel SQL Server'dan (YILDIZHANPOS5) ürünleri doğrudan çek
      const sqlProds = fetchLocalSqlSambaProducts();
      if (sqlProds.length > 0) {
        rawProducts = sqlProds;
      } else {
        throw gqlErr;
      }
    }

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
    runLocalSambaSqlQuery(sqlLines.join("\r\n"));
    return entries.length;
  } catch {
    return 0;
  }
}

/**
 * Sitedeki ürünleri (tümünü veya seçilenleri) kategorileri ve fiyatlarıyla birlikte
 * SambaPOS V5'e aktarır / eşitler:
 * 1) SambaPOS'ta olmayan ürünleri GraphQL `addProduct` (veya doğrudan yerel SQL `MenuItems`) ile kendi kategorisi altında oluşturur.
 * 2) SambaPOS'ta zaten kayıtlı olan ürünlerin fiyatlarını `updateProductPrice` (veya yerel SQL `MenuItemPrices`) ile sitedeki fiyata günceller.
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

  try {
    let usedSqlFallback = false;

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

      await executeSambaGraphQL(
        cfg,
        accessToken,
        `mutation { postResetProductCacheMessage { id } }`
      ).catch(() => {});
    } catch {
      // Port 9000 kapalıysa ürünleri ve fiyatları doğrudan yerel SQL Server'a (YILDIZHANPOS5) yaz
      usedSqlFallback = true;
      const existingSqlList = fetchLocalSqlSambaProducts();
      const existingMap = new Map<
        string,
        {
          id: number;
          name: string;
          groupCode: string;
          portions: Array<{ id: number; name: string; price: number }>;
        }
      >();
      for (const p of existingSqlList) {
        existingMap.set(p.name.trim().toLowerCase(), p);
      }

      const escSql = (s: string) => String(s || "").replace(/'/g, "''");
      const sqlStatements: string[] = [
        "SET NOCOUNT ON;",
        "DECLARE @newProdId INT;",
        "DECLARE @newPortId INT;",
      ];

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
          sqlStatements.push(`
            INSERT INTO MenuItems (GroupCode, Barcode, Tag, CustomTags, ItemType, Name)
            VALUES (N'${escSql(categoryName)}', NULL, NULL, NULL, 0, N'${escSql(targetSambaName)}');
            SET @newProdId = SCOPE_IDENTITY();
            INSERT INTO MenuItemPortions (Name, MenuItemId, Multiplier)
            VALUES (N'Normal', @newProdId, 1);
            SET @newPortId = SCOPE_IDENTITY();
            INSERT INTO MenuItemPrices (MenuItemPortionId, PriceTag, Price)
            VALUES (@newPortId, NULL, ${price});
          `);
          createdCount++;
          screenMenuEntries.push({
            categoryName,
            productName: targetSambaName,
          });
        } else {
          if (options?.updatePrices !== false) {
            const portId = existing.portions[0]?.id || 0;
            if (portId > 0) {
              sqlStatements.push(`
                UPDATE MenuItemPrices
                SET Price = ${price}
                WHERE MenuItemPortionId = ${portId} AND (PriceTag IS NULL OR PriceTag = '');
                UPDATE MenuItems
                SET GroupCode = N'${escSql(categoryName)}'
                WHERE Id = ${existing.id} AND (GroupCode IS NULL OR GroupCode = '');
              `);
            }
            updatedCount++;
          }
          screenMenuEntries.push({
            categoryName,
            productName: existing.name,
          });
        }
      }

      if (!filterIds && !existingMap.has("paket servis ücreti")) {
        const delFee = Number(Number(settings.deliveryFee || 0).toFixed(2));
        sqlStatements.push(`
          IF NOT EXISTS (SELECT 1 FROM MenuItems WHERE Name = N'Paket Servis Ücreti') BEGIN
            INSERT INTO MenuItems (GroupCode, Barcode, Tag, CustomTags, ItemType, Name)
            VALUES (N'Online Sipariş', NULL, NULL, NULL, 0, N'Paket Servis Ücreti');
            SET @newProdId = SCOPE_IDENTITY();
            INSERT INTO MenuItemPortions (Name, MenuItemId, Multiplier)
            VALUES (N'Normal', @newProdId, 1);
            SET @newPortId = SCOPE_IDENTITY();
            INSERT INTO MenuItemPrices (MenuItemPortionId, PriceTag, Price)
            VALUES (@newPortId, NULL, ${delFee});
          END
        `);
      }

      if (sqlStatements.length > 3) {
        runLocalSambaSqlQuery(sqlStatements.join("\r\n"));
      }
    }

    // POS Dokunmatik Menü ekranına da (ScreenMenuCategories & ScreenMenuItems) ekle
    const shouldSyncScreenMenu =
      options?.syncScreenMenu ?? cfg.syncToScreenMenu !== false;
    if (shouldSyncScreenMenu && screenMenuEntries.length > 0) {
      syncLocalSambaScreenMenu(screenMenuEntries);
    }

    // Son menü senkronizasyon tarihini kaydet (diğer POS ayarlarını koruyarak)
    const nowIso = new Date().toISOString();
    const nextSamba: SambaPosConfig = {
      ...cfg,
      lastMenuSyncedAt: nowIso,
    };
    const prevPos = settings.posIntegrationConfig;
    updateSettings({
      ...settings,
      posIntegrationConfig: {
        ...prevPos,
        activeProvider: nextSamba.enabled
          ? "sambapos"
          : prevPos?.activeProvider || "none",
        sambaPos: nextSamba,
      },
    });

    const updatedCatalog = await fetchSambaPosCatalog(nextSamba);

    return {
      ok: true,
      message: `✅ Sitedeki ${targetItems.length} ürün SambaPOS'a başarıyla aktarıldı! (${createdCount} yeni ürün eklendi, ${updatedCount} ürünün fiyatı eşitlendi${usedSqlFallback ? " — Yerel SQL Köprüsü" : ""})`,
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

/**
 * SambaPOS V5 içerisindeki kayıtlı tüm masaları (`Masalar` / `EntityTypeId = 2`) okur.
 * `importToSite: true` verilirse okunan masaları doğrudan sitenin masa listesine (`settings.tables`) kaydeder.
 */
export async function fetchSambaPosTables(options?: {
  importToSite?: boolean;
  customConfig?: Partial<SambaPosConfig>;
}): Promise<{
  ok: boolean;
  tables: string[];
  message: string;
  settings?: ReturnType<typeof getSettings>;
}> {
  const cfg: SambaPosConfig = {
    ...getResolvedPosConfig().sambaPos,
    ...(options?.customConfig || {}),
  };

  try {
    let tables: string[] = [];

    // 1) Önce yerel SQL Server üzerinden EntityScreenItems sıralamasına göre oku
    try {
      const out = runLocalSambaSqlQuery(`
        SET NOCOUNT ON;
        SELECT
          N'TBL',
          REPLACE(ISNULL(e.Name, N''), N'|', N'/')
        FROM Entities e
        LEFT JOIN EntityScreenItems esi ON esi.EntityId = e.Id AND esi.EntityScreenId = 1
        WHERE e.EntityTypeId = (
          SELECT TOP 1 Id FROM EntityTypes WHERE Name = N'${(cfg.tableEntityType || "Masalar").replace(/'/g, "''")}' OR Id = 2 ORDER BY CASE WHEN Name = N'${(cfg.tableEntityType || "Masalar").replace(/'/g, "''")}' THEN 0 ELSE 1 END
        )
        ORDER BY CASE WHEN esi.Id IS NULL THEN 1 ELSE 0 END ASC, ISNULL(esi.SortOrder, 0) ASC, ISNULL(esi.Id, e.Id) ASC;
      `);

      const seen = new Set<string>();
      for (const rawLine of out.split(/\r?\n/)) {
        const line = rawLine.replace(/^\uFEFF/, "").trim();
        if (!line.startsWith("TBL|")) continue;
        const tName = (line.split("|")[1] || "").trim();
        if (tName && !seen.has(tName.toLowerCase())) {
          seen.add(tName.toLowerCase());
          tables.push(tName);
        }
      }
    } catch {
      // ignore SQL fallback error, try GraphQL
    }

    // 2) Yerel SQL'den gelmediyse GraphQL üzerinden dene
    if (tables.length === 0) {
      const accessToken = await authenticateSambaPos(cfg);
      const gStr = (val: string) => JSON.stringify(String(val ?? ""));
      const gqlRes = await executeSambaGraphQL(
        cfg,
        accessToken,
        `query {
          getEntities(type: ${gStr(cfg.tableEntityType || "Masalar")}, take: 500) {
            name
          }
        }`
      );
      const list = (gqlRes.data?.getEntities || []) as Array<{ name?: string }>;
      const seen = new Set<string>();
      for (const item of list) {
        const tName = (item?.name || "").trim();
        if (tName && !seen.has(tName.toLowerCase())) {
          seen.add(tName.toLowerCase());
          tables.push(tName);
        }
      }
    }

    if (tables.length === 0) {
      return {
        ok: false,
        tables: [],
        message: "SambaPOS üzerinde kayıtlı masa bulunamadı.",
      };
    }

    let updatedSettings = getSettings();
    if (options?.importToSite) {
      updatedSettings = updateSettings({
        ...updatedSettings,
        tables,
        tableCount: tables.length,
      });
      await syncActivityWithCloud().catch(() => {});
    }

    return {
      ok: true,
      tables,
      settings: updatedSettings,
      message: options?.importToSite
        ? `✅ SambaPOS'taki ${tables.length} masa (${tables.slice(0, 5).join(", ")}${tables.length > 5 ? "..." : ""}) siteye başarıyla aktarıldı!`
        : `✅ SambaPOS'ta ${tables.length} masa bulundu.`,
    };
  } catch (err) {
    return {
      ok: false,
      tables: [],
      message:
        err instanceof Error
          ? `⚠️ SambaPOS masaları okunamadı: ${err.message}`
          : "SambaPOS masaları okunamadı.",
    };
  }
}

/**
 * Sitede düzenlenen / eklenen / silinen masa listesini (`settings.tables`) hem siteye kaydeder
 * hem de SambaPOS V5 (`Entities`, `EntityStateValues` ve `EntityScreenItems` -> `Tüm Masalar`) ile birebir eşitler.
 */
export async function syncSiteTablesToSambaPos(options: {
  tables: string[];
  renameMap?: Record<string, string>;
  deleteRemoved?: boolean;
  syncToSamba?: boolean;
  customConfig?: Partial<SambaPosConfig>;
}): Promise<{
  ok: boolean;
  message: string;
  tables: string[];
  settings: ReturnType<typeof getSettings>;
}> {
  const seen = new Set<string>();
  const cleanedTables: string[] = [];
  for (const raw of options.tables || []) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleanedTables.push(t);
    }
  }

  if (cleanedTables.length === 0) {
    cleanedTables.push("Masa 1");
  }

  const currentSettings = getSettings();
  const renameMap = options.renameMap || {};

  // Rezervasyonlarda yeniden adlandırılan masa varsa güncelle
  const updatedReservations = (currentSettings.reservations || []).map((r) => {
    const curTbl = (r.assignedTable || r.tableNumber || "").trim();
    if (curTbl && renameMap[curTbl]) {
      return {
        ...r,
        assignedTable: renameMap[curTbl],
        tableNumber: renameMap[curTbl],
      };
    }
    return r;
  });

  const updatedSettings = updateSettings({
    ...currentSettings,
    tables: cleanedTables,
    tableCount: cleanedTables.length,
    reservations: updatedReservations,
  });

  await syncActivityWithCloud().catch(() => {});

  const cfg: SambaPosConfig = {
    ...getResolvedPosConfig().sambaPos,
    ...(options.customConfig || {}),
  };

  if (options.syncToSamba === false) {
    return {
      ok: true,
      tables: cleanedTables,
      settings: updatedSettings,
      message: `✅ Masa listesi (${cleanedTables.length} masa) sitede güncellendi!`,
    };
  }

  try {
    const escSql = (s: string) => String(s ?? "").replace(/'/g, "''");
    const nowMs = Date.now();
    const sambaDateJson = `\\/Date(${nowMs}+0300)\\/`;
    const tableTypeName = escSql(cfg.tableEntityType || "Masalar");

    const sqlLines: string[] = [
      "SET NOCOUNT ON;",
      "DECLARE @now DATETIME = GETDATE();",
      `DECLARE @entityTypeId INT = ISNULL((SELECT TOP 1 Id FROM EntityTypes WHERE Name = N'${tableTypeName}'), 2);`,
      "DECLARE @screenId INT = ISNULL((SELECT TOP 1 Id FROM EntityScreens WHERE EntityTypeId = @entityTypeId ORDER BY Id ASC), 1);",
      "DECLARE @entId INT;",
    ];

    // 1) Yeniden adlandırılan masaları (renameMap) SambaPOS'ta güncelle
    for (const [oldName, newName] of Object.entries(renameMap)) {
      const oTrim = oldName.trim();
      const nTrim = newName.trim();
      if (!oTrim || !nTrim || oTrim.toLowerCase() === nTrim.toLowerCase()) {
        continue;
      }
      sqlLines.push(`
        SET @entId = (SELECT TOP 1 Id FROM Entities WHERE EntityTypeId = @entityTypeId AND Name = N'${escSql(oTrim)}');
        IF @entId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Entities WHERE EntityTypeId = @entityTypeId AND Name = N'${escSql(nTrim)}') BEGIN
          UPDATE Entities SET Name = N'${escSql(nTrim)}', SearchString = N'${escSql(nTrim)}', LastUpdateTime = @now WHERE Id = @entId;
          UPDATE EntityScreenItems SET Name = N'${escSql(nTrim)}', LastUpdateTime = @now WHERE EntityId = @entId;
          UPDATE TicketEntities SET EntityName = N'${escSql(nTrim)}' WHERE EntityId = @entId AND EntityTypeId = @entityTypeId;
        END
      `);
    }

    // 2) Sitedeki tüm masaların SambaPOS'ta (Entities + EntityStateValues + EntityScreenItems) var olduğundan emin ol
    cleanedTables.forEach((tblName, idx) => {
      const escName = escSql(tblName);
      const sortOrder = (idx + 1) * 10;
      sqlLines.push(`
        SET @entId = (SELECT TOP 1 Id FROM Entities WHERE EntityTypeId = @entityTypeId AND Name = N'${escName}');
        IF @entId IS NULL BEGIN
          INSERT INTO Entities (EntityTypeId, LastUpdateTime, SearchString, CustomData, Notes, AccountId, WarehouseId, Name)
          VALUES (@entityTypeId, @now, N'${escName}', N'[]', NULL, 0, 0, N'${escName}');
          SET @entId = SCOPE_IDENTITY();

          INSERT INTO EntityStateValues (EntityId, EntityStates)
          VALUES (@entId, N'[{"D":"${sambaDateJson}","S":"Boş","SN":"Status"}]');
        END

        IF @screenId IS NOT NULL AND @entId IS NOT NULL BEGIN
          IF NOT EXISTS (SELECT 1 FROM EntityScreenItems WHERE EntityScreenId = @screenId AND EntityId = @entId) BEGIN
            INSERT INTO EntityScreenItems (EntityScreenId, Name, EntityId, EntityState, SortOrder, LastUpdateTime)
            VALUES (@screenId, N'${escName}', @entId, NULL, ${sortOrder}, @now);
          END ELSE BEGIN
            UPDATE EntityScreenItems
            SET Name = N'${escName}', SortOrder = ${sortOrder}, LastUpdateTime = @now
            WHERE EntityScreenId = @screenId AND EntityId = @entId;
          END
        END
      `);
    });

    // 3) Siteden silinen masaları SambaPOS ekranından ve Entities tablosundan kaldır (deleteRemoved !== false ise)
    if (options.deleteRemoved !== false && cleanedTables.length > 0) {
      const inListSql = cleanedTables
        .map((t) => `N'${escSql(t)}'`)
        .join(", ");
      sqlLines.push(`
        DELETE FROM EntityScreenItems
        WHERE EntityScreenId IN (SELECT Id FROM EntityScreens WHERE EntityTypeId = @entityTypeId)
          AND EntityId IN (
            SELECT Id FROM Entities
            WHERE EntityTypeId = @entityTypeId AND Name NOT IN (${inListSql})
          );

        DELETE FROM EntityStateLogs
        WHERE EntityId IN (
          SELECT Id FROM Entities
          WHERE EntityTypeId = @entityTypeId AND Name NOT IN (${inListSql})
        );

        DELETE FROM EntityStateValues
        WHERE EntityId IN (
          SELECT Id FROM Entities
          WHERE EntityTypeId = @entityTypeId AND Name NOT IN (${inListSql})
        );

        DELETE FROM Entities
        WHERE EntityTypeId = @entityTypeId AND Name NOT IN (${inListSql});
      `);
    }

    runLocalSambaSqlQuery(sqlLines.join("\r\n"));

    // GraphQL Message Server açıksa önbelleği sıfırla
    try {
      const accessToken = await authenticateSambaPos(cfg);
      await executeSambaGraphQL(
        cfg,
        accessToken,
        `mutation { postResetEntityCacheMessage { id } }`
      );
    } catch {
      // ignore if Message Server port 9000 is down
    }

    return {
      ok: true,
      tables: cleanedTables,
      settings: updatedSettings,
      message: `✅ ${cleanedTables.length} masa hem sitede hem de SambaPOS V5 "Tüm Masalar" ekranında birebir eşitlendi!`,
    };
  } catch {
    return {
      ok: true,
      tables: cleanedTables,
      settings: updatedSettings,
      message: `✅ ${cleanedTables.length} masa sitede güncellendi (SambaPOS yerel SQL erişilemediği için sadece siteye kaydedildi).`,
    };
  }
}



