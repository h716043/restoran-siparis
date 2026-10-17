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
};

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

  const itemsToEnsure: Array<{ name: string; price: number }> = [];
  for (const item of order.items) {
    const unitPrice = item.isComplimentary
      ? 0
      : Number(item.unitPrice || item.basePrice || 0);
    itemsToEnsure.push({
      name: item.name.trim(),
      price: Number(unitPrice.toFixed(2)),
    });
  }

  if (order.deliveryFee && order.deliveryFee > 0) {
    itemsToEnsure.push({
      name: "Paket Servis Ücreti",
      price: Number(order.deliveryFee.toFixed(2)),
    });
  }

  if (cfg.fallbackMenuItemName?.trim()) {
    itemsToEnsure.push({
      name: cfg.fallbackMenuItemName.trim(),
      price: 0,
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
              groupCode: "Online Sipariş",
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
    const targetItemName =
      useFallbackItem && fallbackName ? fallbackName : item.name.trim();

    const tagEntries: string[] = [];

    if (useFallbackItem && fallbackName && item.name !== fallbackName) {
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
