"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Settings,
  Utensils,
  QrCode,
  Code2,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Volume2,
  Edit3,
  Power,
  MessageCircle,
  Users,
  Terminal,
  Lock,
  BarChart3,
  Tag,
  MapPin,
  TrendingUp,
  ShoppingBag,
  Truck,
  Award,
  Sparkles,
  Clock,
  Cloud,
  RefreshCw,
  Globe,
  Copy,
  Printer,
  Download,
  FileSpreadsheet,
  Gift,
  Star,
  Send,
  Upload,
  Database,
  Navigation,
  Palette,
  Sun,
  Moon,
  Tv,
} from "lucide-react";
import {
  CashExpense,
  Category,
  Coupon,
  CreditAccount,
  CustomerUser,
  DeliveryZone,
  MenuItem,
  ModifierGroup,
  Order,
  OrderType,
  RestaurantSettings,
  WhatsAppLog,
  formatTableLabel,
  getEnabledOrderTypes,
  getRestaurantTables,
  isSameTableName,
} from "@/types";
import {
  STOREFRONT_THEMES,
  ThemeId,
  applyThemeToDocument,
  getThemeDefinition,
} from "@/lib/themes";

interface CrmCustomerItem {
  phone: string;
  name: string;
  userId: string | null;
  loyaltyPoints: number;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  address: string;
  isVip: boolean;
  isInactive15Days: boolean;
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<
    | "reports"
    | "menu"
    | "campaigns"
    | "crm"
    | "whatsapp"
    | "qr"
    | "widget"
    | "cloud"
    | "pos"
    | "settings"
  >("reports");
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [waLogs, setWaLogs] = useState<WhatsAppLog[]>([]);
  const [crmCustomers, setCrmCustomers] = useState<CrmCustomerItem[]>([]);
  const [crmSegment, setCrmSegment] = useState<"all" | "vip" | "inactive">(
    "all"
  );
  const [selectedCrmPhones, setSelectedCrmPhones] = useState<string[]>([]);
  const [campaignMessage, setCampaignMessage] = useState(
    "Merhaba {isim} 👋 Bugün size özel sıcacık ızgara ve kebaplarımızda %15 indirim fırsatımız var! Hemen sipariş vermek için menümüze göz atabilirsiniz 🍽️🔥"
  );
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [savingMsg, setSavingMsg] = useState("");
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<{
    ok?: boolean;
    message?: string;
  } | null>(null);
  const [selectedPosSubTab, setSelectedPosSubTab] = useState<
    "sambapos" | "adisyo" | "custom_pos"
  >("sambapos");
  const [posTesting, setPosTesting] = useState(false);
  const [posTestStatus, setPosTestStatus] = useState<{
    ok?: boolean;
    message?: string;
  } | null>(null);
  const [posSyncingOrderId, setPosSyncingOrderId] = useState<string | null>(
    null
  );
  const [posBulkSyncing, setPosBulkSyncing] = useState(false);
  const [posCatalogLoading, setPosCatalogLoading] = useState(false);
  const [posMenuSyncing, setPosMenuSyncing] = useState(false);
  const [posSyncingItemId, setPosSyncingItemId] = useState<string | null>(null);
  const [posMenuFilterCat, setPosMenuFilterCat] = useState<string>("all");
  const [posMenuFilterStatus, setPosMenuFilterStatus] = useState<
    "all" | "matched" | "price_diff" | "missing"
  >("all");
  const [posMenuSearch, setPosMenuSearch] = useState<string>("");
  const [sambaCatalog, setSambaCatalog] = useState<{
    ok: boolean;
    message?: string;
    sambaProducts: Array<{
      id: number;
      name: string;
      groupCode: string;
      price: number;
    }>;
    items: Array<{
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
    }>;
    stats: {
      totalSiteItems: number;
      matchedCount: number;
      priceDiffCount: number;
      missingCount: number;
      totalSambaProducts: number;
    };
  } | null>(null);

  // Rapor ve Z Raporu Filtreleri
  const [reportPeriod, setReportPeriod] = useState<
    "today" | "yesterday" | "week" | "month" | "all" | "custom"
  >("all");
  const [customStartDate, setCustomStartDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [customEndDate, setCustomEndDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [selectedOrderForPrint, setSelectedOrderForPrint] =
    useState<Order | null>(null);
  const [printingZReport, setPrintingZReport] = useState(false);

  // 💰 Günlük Gider & Kasa Avansı Formu State
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] =
    useState<CashExpense["category"]>("supplier");

  // 🧾 Veresiye / Cari Hesap Defteri State
  const [newCreditCustomerName, setNewCreditCustomerName] = useState("");
  const [newCreditCustomerPhone, setNewCreditCustomerPhone] = useState("");
  const [selectedCreditAccId, setSelectedCreditAccId] = useState("");
  const [creditTxAmount, setCreditTxAmount] = useState("");
  const [creditTxType, setCreditTxType] = useState<"debt" | "payment">(
    "payment"
  );
  const [creditTxNote, setCreditTxNote] = useState("");
  const [creditRegisteredSearch, setCreditRegisteredSearch] = useState("");
  const [creditTxSearch, setCreditTxSearch] = useState("");
  const [creditListSearch, setCreditListSearch] = useState("");
  const [creditListFilter, setCreditListFilter] = useState<
    "all" | "with_debt" | "zero"
  >("all");
  const [expandedCreditAccId, setExpandedCreditAccId] = useState<string | null>(
    null
  );

  // Menü Stok Filtresi
  const [menuStockFilter, setMenuStockFilter] = useState<
    "all" | "available" | "sold_out"
  >("all");

  // Yeni Kurye Adı ve Özel Şifresi
  const [newCourierName, setNewCourierName] = useState("");
  const [newCourierPin, setNewCourierPin] = useState("");

  // Yeni Garson Adı ve Özel Şifresi
  const [newWaiterName, setNewWaiterName] = useState("");
  const [newWaiterPin, setNewWaiterPin] = useState("");

  // Yeni Kategori Formu
  const [newCatName, setNewCatName] = useState("");

  // Ürün Ekleme / Düzenleme Modalı
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Yeni Kupon Formu
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponTitle, setNewCouponTitle] = useState("");
  const [newCouponType, setNewCouponType] = useState<"percentage" | "fixed">(
    "percentage"
  );
  const [newCouponValue, setNewCouponValue] = useState(15);
  const [newCouponMinOrder, setNewCouponMinOrder] = useState(250);

  // Yeni Teslimat Bölgesi (Mahalle) Formu
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneMinAmount, setNewZoneMinAmount] = useState(250);
  const [newZoneFee, setNewZoneFee] = useState(0);
  const [newZoneMinutes, setNewZoneMinutes] = useState("25-35 dk");

  // 🏷️ Toplu Fiyat Güncelleme Aracı State'leri
  const [bulkCategoryId, setBulkCategoryId] = useState("all");
  const [bulkMode, setBulkMode] = useState<"percent" | "fixed">("percent");
  const [bulkValue, setBulkValue] = useState<number>(10);
  const [bulkRounding, setBulkRounding] = useState<"none" | "nearest_5" | "nearest_10">("nearest_5");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // 🪑 Masa Yönetimi (Ekleme / İsim Düzenleme / Silme / SambaPOS Eşitleme) State'leri
  const [newTableName, setNewTableName] = useState("");
  const [bulkTablePrefix, setBulkTablePrefix] = useState("B");
  const [bulkTableStart, setBulkTableStart] = useState<number>(10);
  const [bulkTableEnd, setBulkTableEnd] = useState<number>(30);
  const [editingTableOldName, setEditingTableOldName] = useState<string | null>(null);
  const [editingTableNewName, setEditingTableNewName] = useState("");
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [tableSyncLoading, setTableSyncLoading] = useState(false);
  const [tableSyncStatus, setTableSyncStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const loadData = async () => {
    const [menuRes, profRes, ordRes, crmRes] = await Promise.all([
      fetch("/api/menu"),
      fetch("/api/auth/profile"),
      fetch("/api/orders"),
      fetch("/api/customers"),
    ]);
    const data = await menuRes.json();
    const profData = await profRes.json();
    const ordData = await ordRes.json();
    const crmData = crmRes.ok ? await crmRes.json() : { customers: [] };
    setSettings(data.settings);
    if (data.settings?.storefrontTheme) {
      applyThemeToDocument(data.settings.storefrontTheme);
    }
    setCategories(data.categories || []);
    setItems(data.items || []);
    setUsers(profData.users || []);
    setWaLogs(profData.whatsappLogs || []);
    setOrders(ordData.orders || []);
    setCrmCustomers(crmData.customers || []);
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(async () => {
      try {
        const ordRes = await fetch("/api/orders");
        if (ordRes.ok) {
          const ordData = await ordRes.json();
          if (Array.isArray(ordData.orders)) {
            setOrders(ordData.orders);
          }
        }
      } catch {
        // ignore background poll error
      }
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg: string) => {
    setSavingMsg(msg);
    setTimeout(() => setSavingMsg(""), 3000);
  };

  const persistSettings = async (
    nextSettings: RestaurantSettings,
    toastMessage = "Ayarlar kaydedildi!"
  ) => {
    setSettings(nextSettings);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSettings),
    });
    if (res.ok) {
      showToast(toastMessage);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    await persistSettings(settings, "Ayarlar başarıyla kaydedildi!");
  };

  // Masaları hem site ayarlarına kaydeder hem de SambaPOS aktifse SambaPOS'a aktarır/eşitler
  const handleSaveTablesAndSync = async (
    nextTablesRaw: string[],
    toastMsg: string,
    renameMap?: Record<string, string>,
    forceSyncToSamba = false
  ) => {
    if (!settings) return;
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const raw of nextTablesRaw) {
      const t = String(raw || "").trim();
      if (!t) continue;
      const key = t.toLocaleLowerCase("tr-TR");
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(t);
    }
    if (cleaned.length === 0) {
      alert("En az 1 masa bulunmalıdır.");
      return;
    }

    const nextSettings: RestaurantSettings = {
      ...settings,
      tables: cleaned,
      tableCount: cleaned.length,
    };
    setSettings(nextSettings);
    await persistSettings(nextSettings, toastMsg);

    if (forceSyncToSamba || settings.posIntegrationConfig?.sambaPos?.enabled) {
      setTableSyncLoading(true);
      try {
        const res = await fetch("/api/pos-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync_tables_to_samba",
            tables: cleaned,
            renameMap,
          }),
        });
        const data = await res.json();
        setTableSyncStatus({
          ok: Boolean(data.ok),
          message:
            data.message ||
            (data.ok
              ? "Masalar SambaPOS ile eşitlendi."
              : "SambaPOS masa eşitlemesi yapılamadı."),
        });
        if (data.ok) {
          showToast(data.message || toastMsg);
        }
        await loadData();
      } catch {
        setTableSyncStatus({
          ok: false,
          message: "SambaPOS masa eşitleme sırasında bağlantı hatası oluştu.",
        });
      } finally {
        setTableSyncLoading(false);
      }
    }
  };

  // SambaPOS'taki mevcut masaları (B10..B30, M10..M30 vb.) çekip siteye kaydeder
  const handleImportTablesFromSamba = async () => {
    setTableSyncLoading(true);
    setTableSyncStatus(null);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_samba_tables",
          importToSite: true,
        }),
      });
      const data = await res.json();
      setTableSyncStatus({
        ok: Boolean(data.ok),
        message:
          data.message ||
          (data.ok
            ? "SambaPOS masaları siteye aktarıldı!"
            : "SambaPOS masaları okunamadı."),
      });
      if (data.ok) {
        showToast(data.message || "SambaPOS masaları siteye aktarıldı!");
        await loadData();
      }
    } catch {
      setTableSyncStatus({
        ok: false,
        message: "SambaPOS masaları çekilirken hata oluştu.",
      });
    } finally {
      setTableSyncLoading(false);
    }
  };

  const handleToggleItemAvailability = async (item: MenuItem) => {
    const nextAvailable = !item.available;
    const nextDailyStock =
      nextAvailable && item.dailyStock === 0 ? 15 : item.dailyStock;
    const updated = {
      ...item,
      available: nextAvailable,
      dailyStock: nextDailyStock,
    };
    await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: updated }),
    });
    loadData();
    showToast(`"${item.name}" stok durumu güncellendi.`);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: editingItem }),
    });
    setEditingItem(null);
    loadData();
    showToast("Ürün başarıyla kaydedildi!");
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/menu?id=${id}&type=item`, { method: "DELETE" });
    loadData();
    showToast("Ürün silindi.");
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await fetch("/api/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "category",
        name: newCatName.trim(),
        sortOrder: categories.length + 1,
      }),
    });
    setNewCatName("");
    loadData();
    showToast("Yeni kategori eklendi!");
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/menu?id=${id}&type=category`, { method: "DELETE" });
    loadData();
  };

  // Kupon Ekle
  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !newCouponCode.trim()) return;
    const newCoupon: Coupon = {
      id: `cp-${Date.now()}`,
      code: newCouponCode.trim().toUpperCase(),
      title:
        newCouponTitle.trim() ||
        `${newCouponCode.toUpperCase()} İndirim Kuponu`,
      discountType: newCouponType,
      discountValue: Number(newCouponValue),
      minOrderAmount: Number(newCouponMinOrder),
      active: true,
    };
    const nextSettings: RestaurantSettings = {
      ...settings,
      coupons: [...(settings.coupons || []), newCoupon],
    };
    setNewCouponCode("");
    setNewCouponTitle("");
    await persistSettings(nextSettings, "Yeni indirim kuponu eklendi!");
  };

  // Teslimat Bölgesi Ekle
  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !newZoneName.trim()) return;
    const newZone: DeliveryZone = {
      id: `zone-${Date.now()}`,
      name: newZoneName.trim(),
      minAmount: Number(newZoneMinAmount),
      deliveryFee: Number(newZoneFee),
      estimatedMinutes: newZoneMinutes.trim() || "30-40 dk",
      active: true,
    };
    const nextSettings: RestaurantSettings = {
      ...settings,
      deliveryZones: [...(settings.deliveryZones || []), newZone],
    };
    setNewZoneName("");
    await persistSettings(nextSettings, "Yeni teslimat bölgesi eklendi!");
  };

  const originUrl =
    settings?.cloudSyncConfig?.publicStorefrontUrl?.trim()
      ? settings.cloudSyncConfig.publicStorefrontUrl.trim().replace(/\/+$/, "")
      : typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:5439";

  const waConfig = settings?.whatsappConfig || {
    provider: "simulation",
    gatewayUrl: "http://localhost:3001/send-message",
    gatewayApiKey: "",
    metaPhoneNumberId: "",
    metaAccessToken: "",
    sendOrderUpdates: true,
    requireAuthForDeliveryAndPickup: true,
  };

  const sambaConfig = settings?.posIntegrationConfig?.sambaPos || {
    enabled: false,
    mode: "graphql" as const,
    syncTrigger: "on_accepted" as const,
    serverUrl: "http://localhost:9000",
    clientId: "restoran_pos",
    username: "Admin",
    password: "1234",
    departmentName: "Restoran",
    ticketTypeName: "Adisyon",
    terminalName: "Sunucu",
    userName: "Admin",
    tableEntityType: "Masalar",
    tableEntityPrefix: "Masa ",
    customerEntityType: "Müşteriler",
    defaultOrderTagName: "Default",
    fallbackMenuItemName: "Online Sipariş Ürünü",
    autoCreateCustomerEntity: true,
  };

  const adisyoConfig = settings?.posIntegrationConfig?.adisyoPos || {
    enabled: false,
    mode: "simulation" as "adisyo_cloud" | "kurye_webhook" | "simulation",
    apiBaseUrl: "https://ext-api.adisyo.com",
    apiKey: "",
    apiSecret: "",
    consumerCode: "restoran_online",
    restaurantId: "",
    syncTrigger: "on_accepted" as const,
    cashPaymentTypeId: "Nakit",
    cardPaymentTypeId: "Kredi Kartı",
    onlinePaymentTypeId: "Online / Açık Hesap",
    autoAssignCourierFromAdisyo: true,
    webhookSecret: "adisyo_kurye_2026",
    fallbackExternalProductId: "ONLINE-URUN",
    productMappings: {} as Record<string, string>,
  };

  const customPosConfig = settings?.posIntegrationConfig?.customPos || {
    enabled: false,
    systemPreset: "simulation" as
      | "narpos"
      | "kerzz"
      | "posentegra"
      | "custom_webhook"
      | "simulation",
    apiBaseUrl: "https://api.narpos.com.tr/api/v1",
    ordersEndpointPath: "/orders",
    statusEndpointPath: "/orders/status",
    menuEndpointPath: "/products",
    authType: "bearer" as "bearer" | "api_key_header" | "basic",
    apiKey: "",
    apiSecret: "",
    branchId: "SUBE-01",
    syncTrigger: "on_accepted" as const,
    autoSyncCourierAndStatus: true,
    webhookSecret: "pos_webhook_2026",
    productMappings: {} as Record<string, string>,
  };

  const updateSambaConfigField = (patch: Partial<typeof sambaConfig>) => {
    if (!settings) return;
    const nextSamba = { ...sambaConfig, ...patch };
    setSettings({
      ...settings,
      posIntegrationConfig: {
        activeProvider: nextSamba.enabled
          ? "sambapos"
          : adisyoConfig.enabled
          ? "adisyo"
          : customPosConfig.enabled
          ? "custom_pos"
          : "none",
        sambaPos: nextSamba,
        adisyoPos: adisyoConfig,
        customPos: customPosConfig,
      },
    });
  };

  const updateAdisyoConfigField = (patch: Partial<typeof adisyoConfig>) => {
    if (!settings) return;
    const nextAdisyo = { ...adisyoConfig, ...patch };
    setSettings({
      ...settings,
      posIntegrationConfig: {
        activeProvider: nextAdisyo.enabled
          ? "adisyo"
          : sambaConfig.enabled
          ? "sambapos"
          : customPosConfig.enabled
          ? "custom_pos"
          : "none",
        sambaPos: sambaConfig,
        adisyoPos: nextAdisyo,
        customPos: customPosConfig,
      },
    });
  };

  const updateCustomPosConfigField = (
    patch: Partial<typeof customPosConfig>
  ) => {
    if (!settings) return;
    const nextCustomPos = { ...customPosConfig, ...patch };
    setSettings({
      ...settings,
      posIntegrationConfig: {
        activeProvider: nextCustomPos.enabled
          ? "custom_pos"
          : adisyoConfig.enabled
          ? "adisyo"
          : sambaConfig.enabled
          ? "sambapos"
          : "none",
        sambaPos: sambaConfig,
        adisyoPos: adisyoConfig,
        customPos: nextCustomPos,
      },
    });
  };

  const handleSavePosConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settings) return;
    const nextActiveProvider =
      selectedPosSubTab === "custom_pos" && customPosConfig.enabled
        ? ("custom_pos" as const)
        : selectedPosSubTab === "adisyo" && adisyoConfig.enabled
        ? ("adisyo" as const)
        : sambaConfig.enabled
        ? ("sambapos" as const)
        : adisyoConfig.enabled
        ? ("adisyo" as const)
        : customPosConfig.enabled
        ? ("custom_pos" as const)
        : ("none" as const);

    const nextConfig = {
      activeProvider: nextActiveProvider,
      sambaPos: sambaConfig,
      adisyoPos: adisyoConfig,
      customPos: customPosConfig,
    };
    const nextSettings: RestaurantSettings = {
      ...settings,
      posIntegrationConfig: nextConfig,
    };
    await persistSettings(
      nextSettings,
      selectedPosSubTab === "custom_pos"
        ? customPosConfig.enabled
          ? "NarPOS / Kerzz / Özel API entegrasyon ayarları kaydedildi ve aktif edildi!"
          : "NarPOS / Kerzz / Özel API ayarları kaydedildi (Şu an pasif)."
        : selectedPosSubTab === "adisyo"
        ? adisyoConfig.enabled
          ? "Adisyo / Kurye POS entegrasyon ayarları kaydedildi ve aktif edildi!"
          : "Adisyo / Kurye POS ayarları kaydedildi (Şu an pasif)."
        : sambaConfig.enabled
        ? "SambaPOS entegrasyon ayarları kaydedildi ve aktif edildi!"
        : "SambaPOS entegrasyon ayarları kaydedildi (Şu an pasif)."
    );
  };

  const handleTestPosConnection = async () => {
    setPosTesting(true);
    setPosTestStatus(null);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          selectedPosSubTab === "custom_pos"
            ? {
                action: "test_custom_pos_connection",
                customPos: customPosConfig,
              }
            : selectedPosSubTab === "adisyo"
            ? {
                action: "test_adisyo_connection",
                adisyoPos: adisyoConfig,
              }
            : {
                action: "test_connection",
                sambaPos: sambaConfig,
              }
        ),
      });
      const data = await res.json();
      setPosTestStatus({
        ok: Boolean(data.ok),
        message: data.message || (data.ok ? "Bağlantı başarılı!" : "Hata oluştu"),
      });
    } catch (err: unknown) {
      setPosTestStatus({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "POS bağlantı testi sırasında hata oluştu.",
      });
    } finally {
      setPosTesting(false);
    }
  };

  const handleSyncMenuToAdisyo = async () => {
    setPosMenuSyncing(true);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_menu_to_adisyo",
          updatePrices: true,
        }),
      });
      const data = await res.json();
      setPosTestStatus({
        ok: Boolean(data.ok),
        message: data.message,
      });
      if (data.ok) {
        showToast(data.message || "Ürünler Adisyo / Kurye POS ile eşitlendi!");
        await loadData();
      }
    } catch {
      setPosTestStatus({
        ok: false,
        message: "Adisyo ürün eşitleme sırasında hata oluştu.",
      });
    } finally {
      setPosMenuSyncing(false);
    }
  };

  const handleSyncMenuToCustomPos = async () => {
    setPosMenuSyncing(true);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_menu_to_custom_pos",
          updatePrices: true,
        }),
      });
      const data = await res.json();
      setPosTestStatus({
        ok: Boolean(data.ok),
        message: data.message,
      });
      if (data.ok) {
        showToast(
          data.message || "Ürünler NarPOS / Kerzz / Özel API ile eşitlendi!"
        );
        await loadData();
      }
    } catch {
      setPosTestStatus({
        ok: false,
        message: "NarPOS / Kerzz / Özel API ürün eşitleme sırasında hata oluştu.",
      });
    } finally {
      setPosMenuSyncing(false);
    }
  };

  const handleSaveAdisyoProductMapping = async (
    siteItemId: string,
    adisyoProductName: string
  ) => {
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_adisyo_product_mapping",
          siteItemId,
          adisyoProductName,
        }),
      });
      const data = await res.json();
      if (data.posIntegrationConfig && settings) {
        setSettings({
          ...settings,
          posIntegrationConfig: data.posIntegrationConfig,
        });
      }
      showToast("✅ Adisyo / Kurye POS ürün eşleştirmesi kaydedildi!");
    } catch {
      // ignore
    }
  };

  const handleSaveCustomPosProductMapping = async (
    siteItemId: string,
    customPosProductName: string
  ) => {
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_custom_pos_product_mapping",
          siteItemId,
          customPosProductName,
        }),
      });
      const data = await res.json();
      if (data.posIntegrationConfig && settings) {
        setSettings({
          ...settings,
          posIntegrationConfig: data.posIntegrationConfig,
        });
      }
      showToast("✅ NarPOS / Kerzz / Özel API PLU eşleştirmesi kaydedildi!");
    } catch {
      // ignore
    }
  };

  const handleSimulateAdisyoEvent = async (
    orderId: string,
    status: string,
    courierName?: string
  ) => {
    setPosSyncingOrderId(orderId);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_adisyo_event",
          orderId,
          status,
          courierName,
        }),
      });
      const data = await res.json();
      setPosTestStatus({
        ok: Boolean(data.ok),
        message: data.message,
      });
      await loadData();
    } catch {
      setPosTestStatus({
        ok: false,
        message: "Adisyo / Kurye POS durum güncellemesi sırasında hata oluştu.",
      });
    } finally {
      setPosSyncingOrderId(null);
    }
  };

  const handleSimulateCustomPosEvent = async (
    orderId: string,
    status: string,
    courierName?: string
  ) => {
    setPosSyncingOrderId(orderId);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_custom_pos_event",
          orderId,
          status,
          courierName,
        }),
      });
      const data = await res.json();
      setPosTestStatus({
        ok: Boolean(data.ok),
        message: data.message,
      });
      await loadData();
    } catch {
      setPosTestStatus({
        ok: false,
        message:
          "NarPOS / Kerzz / Özel API durum güncellemesi sırasında hata oluştu.",
      });
    } finally {
      setPosSyncingOrderId(null);
    }
  };

  const handleManualSyncOrderToPos = async (
    orderId: string,
    providerOverride?: "sambapos" | "adisyo" | "custom_pos"
  ) => {
    setPosSyncingOrderId(orderId);
    const targetProvider = providerOverride || selectedPosSubTab;
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_order",
          orderId,
          provider: targetProvider,
        }),
      });
      const data = await res.json();
      setPosTestStatus({
        ok: Boolean(data.ok),
        message: data.message,
      });
      await loadData();
    } catch {
      setPosTestStatus({
        ok: false,
        message: "Sipariş POS sistemine aktarılırken hata oluştu.",
      });
    } finally {
      setPosSyncingOrderId(null);
    }
  };

  const handleBulkSyncPendingToPos = async () => {
    setPosBulkSyncing(true);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_all_pending",
          provider: selectedPosSubTab,
        }),
      });
      const data = await res.json();
      setPosTestStatus({
        ok: Boolean(data.ok),
        message: data.message,
      });
      await loadData();
    } catch {
      setPosTestStatus({
        ok: false,
        message: "Toplu POS aktarımı sırasında hata oluştu.",
      });
    } finally {
      setPosBulkSyncing(false);
    }
  };

  const handleSyncStatusesFromSambaPos = async () => {
    setPosBulkSyncing(true);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_from_samba",
        }),
      });
      const data = await res.json();
      setPosTestStatus({
        ok: Boolean(data.ok),
        message: data.message,
      });
      await loadData();
    } catch {
      setPosTestStatus({
        ok: false,
        message: "SambaPOS kurye ve teslimat durumları eşitlenirken hata oluştu.",
      });
    } finally {
      setPosBulkSyncing(false);
    }
  };

  const handleFetchSambaCatalog = async (showBanner = false) => {
    setPosCatalogLoading(true);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_samba_catalog",
          sambaPos: sambaConfig,
        }),
      });
      const data = await res.json();
      if (data && Array.isArray(data.items)) {
        setSambaCatalog(data);
        if (showBanner && data.message) {
          setPosTestStatus({
            ok: Boolean(data.ok),
            message: data.message,
          });
        }
      }
    } catch {
      // ignore background fetch error
    } finally {
      setPosCatalogLoading(false);
    }
  };

  const handleSyncMenuToSamba = async (options?: {
    itemIds?: string[];
    updatePrices?: boolean;
  }) => {
    const singleId =
      options?.itemIds && options.itemIds.length === 1
        ? options.itemIds[0]
        : null;
    if (singleId) {
      setPosSyncingItemId(singleId);
    } else {
      setPosMenuSyncing(true);
    }
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_menu_to_samba",
          itemIds: options?.itemIds,
          updatePrices: options?.updatePrices !== false,
          syncScreenMenu: sambaConfig.syncToScreenMenu !== false,
          sambaPos: sambaConfig,
        }),
      });
      const data = await res.json();
      setPosTestStatus({
        ok: Boolean(data.ok),
        message: data.message,
      });
      if (data.catalog) {
        setSambaCatalog(data.catalog);
      } else {
        await handleFetchSambaCatalog(false);
      }
      if (data.ok) {
        showToast(data.message || "Ürünler SambaPOS'a aktarıldı!");
        await loadData();
      }
    } catch {
      setPosTestStatus({
        ok: false,
        message: "Ürünler SambaPOS'a aktarılırken hata oluştu.",
      });
    } finally {
      setPosSyncingItemId(null);
      setPosMenuSyncing(false);
    }
  };

  const handleSaveProductMapping = async (
    siteItemId: string,
    sambaProductName: string
  ) => {
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_product_mapping",
          siteItemId,
          sambaProductName,
        }),
      });
      const data = await res.json();
      if (data.posIntegrationConfig && settings) {
        setSettings({
          ...settings,
          posIntegrationConfig: data.posIntegrationConfig,
        });
      }
      if (data.catalog) {
        setSambaCatalog(data.catalog);
      }
      showToast("✅ SambaPOS ürün eşleştirmesi kaydedildi!");
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (activeTab === "pos") {
      handleFetchSambaCatalog(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Tarih Aralığına Göre Sipariş Filtreleme (Z Raporu ve İstatistikler)
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const weekAgoStr = weekAgoDate.toISOString().slice(0, 10);

  const monthPrefix = todayStr.slice(0, 7); // YYYY-MM

  const periodFilteredAllOrders = orders.filter((o) => {
    const dStr = o.createdAt.slice(0, 10);
    if (reportPeriod === "today") return dStr === todayStr;
    if (reportPeriod === "yesterday") return dStr === yesterdayStr;
    if (reportPeriod === "week") return dStr >= weekAgoStr;
    if (reportPeriod === "month") return dStr.startsWith(monthPrefix);
    if (reportPeriod === "custom") {
      return dStr >= customStartDate && dStr <= customEndDate;
    }
    return true;
  });

  const validOrders = periodFilteredAllOrders.filter(
    (o) => o.status !== "rejected"
  );
  const rejectedPeriodOrders = periodFilteredAllOrders.filter(
    (o) => o.status === "rejected"
  );
  const todayOrders = orders.filter(
    (o) => o.status !== "rejected" && o.createdAt.startsWith(todayStr)
  );

  const totalRevenue = validOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  const todayRevenue = todayOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  const totalDiscountGiven = validOrders.reduce(
    (acc, o) => acc + (o.discountAmount || 0),
    0
  );
  const avgOrderValue =
    validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

  const deliveryCount = validOrders.filter(
    (o) => o.orderType === "delivery"
  ).length;
  const pickupCount = validOrders.filter(
    (o) => o.orderType === "pickup"
  ).length;
  const dineInCount = validOrders.filter(
    (o) => o.orderType === "dine_in"
  ).length;

  const cashTotal = validOrders
    .filter((o) => o.paymentMethod === "cash")
    .reduce((s, o) => s + o.totalAmount, 0);
  const cardTotal = validOrders
    .filter((o) => o.paymentMethod === "card_at_door")
    .reduce((s, o) => s + o.totalAmount, 0);
  const tablePosTotal = validOrders
    .filter((o) => o.paymentMethod === "pos_at_table")
    .reduce((s, o) => s + o.totalAmount, 0);
  const creditTotal = validOrders
    .filter((o) => o.paymentMethod === "credit")
    .reduce((s, o) => s + o.totalAmount, 0);

  // 💰 Giderler, Kasa Avansı & Net Kâr Hesaplaması
  const allExpenses = settings?.cashExpenses || [];
  const periodExpenses = allExpenses.filter((exp) => {
    const dStr = exp.createdAt.slice(0, 10);
    if (reportPeriod === "today") return dStr === todayStr;
    if (reportPeriod === "yesterday") return dStr === yesterdayStr;
    if (reportPeriod === "week") return dStr >= weekAgoStr;
    if (reportPeriod === "month") return dStr.startsWith(monthPrefix);
    if (reportPeriod === "custom") {
      return dStr >= customStartDate && dStr <= customEndDate;
    }
    return true;
  });
  const totalCashFloat = periodExpenses
    .filter((e) => e.category === "cash_float")
    .reduce((s, e) => s + e.amount, 0);
  const totalExpensesAmount = periodExpenses
    .filter((e) => e.category !== "cash_float")
    .reduce((s, e) => s + e.amount, 0);

  // 📦 Satılan Ürünlerin Toplam Maliyet Hesabı (costPrice bazlı)
  const totalProductCost = validOrders.reduce((orderSum, ord) => {
    const itemsCost = ord.items.reduce((itemSum, oi) => {
      const matchedMenu = items.find(
        (m) => m.id === oi.menuItemId || m.name === oi.name
      );
      const unitCost = matchedMenu?.costPrice
        ? Number(matchedMenu.costPrice)
        : 0;
      return itemSum + unitCost * (oi.quantity || 1);
    }, 0);
    return orderSum + itemsCost;
  }, 0);

  const netProfit = totalRevenue - totalProductCost - totalExpensesAmount;
  const netCashInDrawer = totalCashFloat + cashTotal - totalExpensesAmount;

  // 🛵 Kurye Tahsilat & Gün Sonu Hesaplaşma Özeti
  const courierSettlementList = (settings?.couriers || []).map((cName) => {
    const cOrders = validOrders.filter((o) => o.courierName === cName);
    const unsettledOrders = cOrders.filter(
      (o) => !o.splitPaymentInfo?.courierSettled
    );
    const cashUnsettled = unsettledOrders
      .filter((o) => o.paymentMethod === "cash")
      .reduce((s, o) => s + o.totalAmount, 0);
    const cardUnsettled = unsettledOrders
      .filter((o) => o.paymentMethod === "card_at_door")
      .reduce((s, o) => s + o.totalAmount, 0);
    return {
      courierName: cName,
      totalCount: cOrders.length,
      unsettledCount: unsettledOrders.length,
      cashUnsettled,
      cardUnsettled,
      totalUnsettled: cashUnsettled + cardUnsettled,
    };
  });

  // 📊 Saatlik Yoğunluk Isı Haritası (08:00 - 23:00) & Popüler Ekstralar
  const hourlyStats = Array.from({ length: 16 }, (_, idx) => {
    const hour = idx + 8; // 08..23
    const matched = validOrders.filter(
      (o) => new Date(o.createdAt).getHours() === hour
    );
    return {
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      count: matched.length,
      revenue: matched.reduce((s, o) => s + o.totalAmount, 0),
    };
  });
  const maxHourlyCount = Math.max(1, ...hourlyStats.map((h) => h.count));

  const modifierSalesMap: Record<string, number> = {};
  for (const ord of validOrders) {
    for (const it of ord.items) {
      for (const mod of it.selectedModifiers || []) {
        const key = mod.optionName;
        modifierSalesMap[key] = (modifierSalesMap[key] || 0) + it.quantity;
      }
    }
  }
  const topModifiers = Object.entries(modifierSalesMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const handleAddCashExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !expenseTitle.trim() || !expenseAmount) return;
    const amt = Math.max(0, Number(expenseAmount));
    if (amt <= 0) return;
    const newExp: CashExpense = {
      id: `exp-${Date.now()}`,
      title: expenseTitle.trim(),
      amount: amt,
      category: expenseCategory,
      paymentMethod: "cash",
      createdAt: new Date().toISOString(),
    };
    const nextSettings: RestaurantSettings = {
      ...settings,
      cashExpenses: [newExp, ...(settings.cashExpenses || [])],
    };
    setExpenseTitle("");
    setExpenseAmount("");
    await persistSettings(nextSettings, "Kasa gider/avans kaydı eklendi!");
  };

  const handleDeleteCashExpense = async (expId: string) => {
    if (!settings) return;
    const nextSettings: RestaurantSettings = {
      ...settings,
      cashExpenses: (settings.cashExpenses || []).filter((e) => e.id !== expId),
    };
    await persistSettings(nextSettings, "Gider kaydı silindi.");
  };

  const handleSettleCourier = async (courierName: string) => {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "settle_courier",
        courierName,
      }),
    });
    if (res.ok) {
      showToast(`✅ ${courierName} kurye hesabı teslim alındı olarak işaretlendi!`);
      loadData();
    }
  };

  const handleCreateNewCreditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCreditCustomerName.trim()) return;
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "credit_transaction",
        customerName: newCreditCustomerName.trim(),
        customerPhone: newCreditCustomerPhone.trim(),
        amount: 0,
        type: "debt",
        txType: "debt",
        description: "Cari hesap açılışı",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const createdAcc = (data.settings?.creditAccounts || []).find(
        (a: CreditAccount) =>
          a.customerName.trim().toLocaleLowerCase("tr-TR") ===
          newCreditCustomerName.trim().toLocaleLowerCase("tr-TR")
      );
      if (createdAcc) {
        setSelectedCreditAccId(createdAcc.id);
      }
      setNewCreditCustomerName("");
      setNewCreditCustomerPhone("");
      setCreditRegisteredSearch("");
      showToast("Yeni cari/veresiye hesabı açıldı!");
      loadData();
    }
  };

  const handleAddCreditTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditAccId || !creditTxAmount) return;
    const amt = Math.max(0, Number(creditTxAmount));
    if (amt <= 0) return;

    let accId: string | undefined;
    let custName = "";
    let custPhone = "";

    if (selectedCreditAccId.startsWith("reg::")) {
      const parts = selectedCreditAccId.split("::");
      custName = (parts[1] || "").trim();
      custPhone = (parts[2] || "").trim();
    } else {
      const acc = (settings?.creditAccounts || []).find(
        (a) => a.id === selectedCreditAccId
      );
      if (!acc) return;
      accId = acc.id;
      custName = acc.customerName;
      custPhone = acc.customerPhone || "";
    }

    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "credit_transaction",
        accountId: accId,
        customerName: custName,
        customerPhone: custPhone,
        amount: amt,
        type: creditTxType,
        txType: creditTxType,
        description:
          creditTxNote.trim() ||
          (creditTxType === "payment" ? "Borç Tahsilatı" : "Veresiye Borç"),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (selectedCreditAccId.startsWith("reg::") && data.settings?.creditAccounts) {
        const matched = (data.settings.creditAccounts as CreditAccount[]).find(
          (a) =>
            a.customerName.trim().toLocaleLowerCase("tr-TR") ===
            custName.toLocaleLowerCase("tr-TR")
        );
        if (matched) setSelectedCreditAccId(matched.id);
      }
      setCreditTxAmount("");
      setCreditTxNote("");
      showToast(
        creditTxType === "payment"
          ? `✅ ${custName} hesabından tahsilat düşüldü!`
          : `🧾 ${custName} hesabına borç eklendi!`
      );
      loadData();
    }
  };

  const [sambaCustomerExporting, setSambaCustomerExporting] = useState(false);

  const handleExportCustomersToSambaPos = async () => {
    setSambaCustomerExporting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export_to_sambapos" }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(
          data.message ||
            "Sitedeki kayıtlı müşteriler SambaPOS V5'e başarıyla aktarıldı!"
        );
      } else {
        alert(data.message || "Müşteriler SambaPOS'a aktarılamadı.");
      }
    } catch {
      alert("Müşteriler SambaPOS'a aktarılırken bağlantı hatası oluştu.");
    } finally {
      setSambaCustomerExporting(false);
    }
  };

  const handleDeleteCreditAccount = async (acc: CreditAccount) => {
    if (!settings) return;
    if (
      !confirm(
        `"${acc.customerName}" cari hesabını (Bakiye: ${acc.balance.toFixed(
          2
        )} ${settings.currency}) silmek istediğinize emin misiniz?`
      )
    )
      return;
    const nextAccounts = (settings.creditAccounts || []).filter(
      (a) => a.id !== acc.id
    );
    if (selectedCreditAccId === acc.id) {
      setSelectedCreditAccId("");
    }
    await persistSettings(
      {
        ...settings,
        creditAccounts: nextAccounts,
      },
      `"${acc.customerName}" cari hesabı silindi.`
    );
  };

  const handleSendCreditWhatsApp = (acc: CreditAccount) => {
    const cleanPhone = (acc.customerPhone || "").replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("0")
      ? `9${cleanPhone}`
      : cleanPhone.startsWith("90")
      ? cleanPhone
      : `90${cleanPhone}`;
    const lastTxLines = (acc.transactions || [])
      .slice(0, 5)
      .map(
        (t) =>
          `• ${new Date(t.createdAt).toLocaleDateString("tr-TR")}: ${
            t.type === "debt" ? "+" : "-"
          }${t.amount.toFixed(2)} ${settings?.currency} (${t.description})`
      )
      .join("\n");
    const msg = `Merhaba *${acc.customerName}*,\n*${
      settings?.name || "Restoran"
    }* Cari / Açık Hesap Güncel Bakiye Özeti:\n\n💰 *Güncel Kalan Borç Bakiyesi:* *${acc.balance.toFixed(
      2
    )} ${settings?.currency}*\n\n📋 *Son Hareketler:*\n${
      lastTxLines || "Hareket yok"
    }\n\nTeşekkür eder, iyi günler dileriz.`;
    window.open(
      `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  };

  // En Çok Satan Ürünler (Seçili Dönem)
  const productSalesMap: Record<
    string,
    { name: string; qty: number; revenue: number }
  > = {};
  for (const ord of validOrders) {
    for (const it of ord.items) {
      if (!productSalesMap[it.name]) {
        productSalesMap[it.name] = { name: it.name, qty: 0, revenue: 0 };
      }
      productSalesMap[it.name].qty += it.quantity;
      productSalesMap[it.name].revenue += it.totalPrice;
    }
  }
  const topSellingProducts = Object.values(productSalesMap).sort(
    (a, b) => b.qty - a.qty
  );

  const reportPeriodLabel =
    reportPeriod === "today"
      ? `Bugün (${todayStr}) — Gün Sonu Z Raporu`
      : reportPeriod === "yesterday"
      ? `Dün (${yesterdayStr})`
      : reportPeriod === "week"
      ? "Son 7 Gün"
      : reportPeriod === "month"
      ? `Bu Ay (${monthPrefix})`
      : reportPeriod === "custom"
      ? `${customStartDate} / ${customEndDate}`
      : "Tüm Zamanlar";

  const handlePrintZReport = () => {
    setSelectedOrderForPrint(null);
    setPrintingZReport(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintingZReport(false), 500);
    }, 150);
  };

  const handlePrintOrderFromAdmin = (order: Order) => {
    setPrintingZReport(false);
    setSelectedOrderForPrint(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleExportExcelCsv = () => {
    const headers = [
      "Siparis No",
      "Tarih Saat",
      "Kanal",
      "Masa / Bolge",
      "Musteri Adi",
      "Telefon",
      "Odeme Yontemi",
      "Kurye",
      "Durum",
      "Urunler",
      "Indirim",
      "Getirme Ucreti",
      "Toplam Tutar",
    ];
    const rows = periodFilteredAllOrders.map((o) => {
      const channel =
        o.orderType === "delivery"
          ? "Paket Servis"
          : o.orderType === "pickup"
          ? "Gel-Al"
          : "Masa QR";
      const loc =
        o.orderType === "dine_in"
          ? `Masa ${o.tableNumber || "-"}`
          : o.deliveryZoneName || "-";
      const pay =
        o.paymentMethod === "cash"
          ? "Nakit"
          : o.paymentMethod === "card_at_door"
          ? "Kapida Kart"
          : "Masada Odeme";
      const itemsSummary = o.items
        .map((i) => `${i.quantity}x ${i.name}`)
        .join(" | ");
      return [
        `#${o.orderNumber}`,
        new Date(o.createdAt).toLocaleString("tr-TR"),
        channel,
        loc,
        o.customerName,
        o.customerPhone,
        pay,
        o.courierName || "-",
        o.status,
        itemsSummary,
        (o.discountAmount || 0).toFixed(2),
        o.deliveryFee.toFixed(2),
        o.totalAmount.toFixed(2),
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`);
    });

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Z-Raporu-Satislar-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Excel (CSV) satış raporu indirildi!");
  };

  // CRM Segment Filtreleme
  const filteredCrmCustomers = crmCustomers.filter((c) => {
    if (crmSegment === "vip") return c.isVip;
    if (crmSegment === "inactive") return c.isInactive15Days;
    return true;
  });

  const handleSendBulkCampaign = async (targetList?: CrmCustomerItem[]) => {
    const recipients = (
      targetList ||
      filteredCrmCustomers.filter((c) =>
        selectedCrmPhones.length > 0
          ? selectedCrmPhones.includes(c.phone)
          : true
      )
    ).map((c) => ({ phone: c.phone, name: c.name }));

    if (recipients.length === 0) {
      alert("Gönderilecek müşteri bulunamadı.");
      return;
    }
    if (!campaignMessage.trim()) {
      alert("Lütfen kampanya mesajını yazın.");
      return;
    }

    setSendingCampaign(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_campaign",
          recipients,
          messageTemplate: campaignMessage,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kampanya mesajları gönderildi!");
        loadData();
      } else {
        alert(data.error || "Kampanya gönderilemedi.");
      }
    } finally {
      setSendingCampaign(false);
    }
  };

  const handleAdjustCustomerPoints = async (
    phone: string,
    deltaPoints: number
  ) => {
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "adjust_points",
        phone,
        deltaPoints,
      }),
    });
    if (res.ok) {
      showToast(
        `${deltaPoints > 0 ? `+${deltaPoints}` : deltaPoints} TL Para Puan güncellendi!`
      );
      loadData();
    }
  };

  const handleDownloadFullBackup = async () => {
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) {
        alert("Yedek alınırken hata oluştu.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `restoran-tam-yedek-${todayStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Tam veritabanı yedeği (.json) indirildi!");
    } catch {
      alert("Yedek indirilemedi.");
    }
  };

  const handleRestoreFullBackup = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !confirm(
        `"${file.name}" dosyasındaki yedek geri yüklenecek. Mevcut menü, ayarlar ve siparişler bu yedekle güncellenecektir. Onaylıyor musunuz?`
      )
    ) {
      e.target.value = "";
      return;
    }

    setRestoringBackup(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Yedek başarıyla geri yüklendi!");
        loadData();
      } else {
        alert(data.error || "Geri yükleme başarısız oldu.");
      }
    } catch {
      alert("Geçersiz JSON yedek dosyası.");
    } finally {
      setRestoringBackup(false);
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Üst Yönetim Barı */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Müşteri Menüsü
          </Link>
          <div>
            <h1 className="text-lg font-bold">
              Restoran Yönetim & Kurulum Paneli
            </h1>
            <p className="text-xs text-slate-400">
              Ciro Raporları • Menü • Bölgeler & Kuponlar • Sadakat Cüzdanı • WhatsApp CRM • QR
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {settings && (
            <>
              <button
                onClick={async () => {
                  const next = { ...settings, isOpen: !settings.isOpen };
                  await persistSettings(
                    next,
                    next.isOpen
                      ? "Restoran sipariş alımına AÇILDI"
                      : "Restoran sipariş alımına KAPATILDI"
                  );
                }}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer ${
                  settings.isOpen
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-red-600 hover:bg-red-500 text-white"
                }`}
              >
                <Power className="w-4 h-4" />
                {settings.isOpen ? "Dükkan: AÇIK" : "Dükkan: KAPALI"}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 px-3.5 py-2 rounded-xl border border-slate-700 transition cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                <span>
                  Saatler: {settings.openTime || "11:00"} -{" "}
                  {settings.closeTime || "23:30"} (Düzenle)
                </span>
              </button>
            </>
          )}

          {settings && (
            <div className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
              <Palette className="w-3.5 h-3.5 text-orange-400" />
              <select
                value={settings.storefrontTheme || "light-classic"}
                onChange={(e) => {
                  const nextTheme = e.target.value as ThemeId;
                  applyThemeToDocument(nextTheme);
                  try {
                    localStorage.setItem("restoran_selected_theme", nextTheme);
                  } catch {
                    // ignore
                  }
                  persistSettings(
                    {
                      ...settings,
                      storefrontTheme: nextTheme,
                    },
                    `Tema "${getThemeDefinition(nextTheme).name}" olarak güncellendi!`
                  );
                }}
                className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
              >
                <optgroup label="☀️ Açık Temalar (3)" className="text-slate-900 bg-white">
                  {STOREFRONT_THEMES.filter((t) => t.mode === "light").map((t) => (
                    <option key={t.id} value={t.id} className="text-slate-900 bg-white">
                      ☀️ {t.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🌙 Kapalı / Koyu Temalar (3)" className="text-slate-900 bg-white">
                  {STOREFRONT_THEMES.filter((t) => t.mode === "dark").map((t) => (
                    <option key={t.id} value={t.id} className="text-slate-900 bg-white">
                      🌙 {t.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          <Link
            href="/kitchen"
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl transition"
          >
            <Volume2 className="w-4 h-4" />
            Canlı Mutfak & POS
          </Link>

          <Link
            href="/waiter"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 px-3.5 py-2 rounded-xl border border-slate-700 transition"
          >
            📱 Garson Ekranı
          </Link>

          <Link
            href="/courier"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 px-3.5 py-2 rounded-xl border border-slate-700 transition"
          >
            <Navigation className="w-3.5 h-3.5" />
            🛵 Kurye Ekranı
          </Link>

          <Link
            href="/tv"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 px-3.5 py-2 rounded-xl border border-slate-700 transition"
          >
            📺 TV Sıra Ekranı
          </Link>

          <button
            onClick={async () => {
              await fetch("/api/staff-auth", { method: "DELETE" });
              window.location.href = "/staff-login?target=admin";
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3.5 py-2 rounded-xl border border-red-500/30 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            Kilitle / Çıkış
          </button>
        </div>
      </header>

      {/* Bildirim Toast */}
      {savingMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {savingMsg}
        </div>
      )}

      {/* Sekmeler */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2">
          <button
            onClick={() => {
              setActiveTab("reports");
              loadData();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "reports"
                ? "bg-orange-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Ciro & Satış Raporu
          </button>
          <button
            onClick={() => setActiveTab("menu")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "menu"
                ? "bg-orange-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Utensils className="w-4 h-4" />
            Menü & Ürünler
          </button>
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "campaigns"
                ? "bg-orange-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Tag className="w-4 h-4" />
            Kuponlar, Bölgeler & Sadakat
          </button>
          <button
            onClick={() => {
              setActiveTab("crm");
              loadData();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "crm"
                ? "bg-emerald-700 text-white"
                : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Müşteriler & WhatsApp Kampanya ({crmCustomers.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("whatsapp");
              loadData();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "whatsapp"
                ? "bg-[#075E54] text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            WhatsApp OTP & Üyeler ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("qr")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "qr"
                ? "bg-orange-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <QrCode className="w-4 h-4" />
            🪑 Masalar & QR Kodlar ({getRestaurantTables(settings).length})
          </button>
          <button
            onClick={() => setActiveTab("widget")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "widget"
                ? "bg-orange-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Code2 className="w-4 h-4" />
            Web Sitesi Widget
          </button>
          <button
            onClick={() => setActiveTab("cloud")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "cloud"
                ? "bg-teal-600 text-white"
                : "text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200"
            }`}
          >
            <Cloud className="w-4 h-4" />
            Netlify & Bulut Senkronizasyon
          </button>
          <button
            onClick={() => setActiveTab("pos")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "pos"
                ? "bg-indigo-600 text-white"
                : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            🔌 POS Entegrasyonu (SambaPOS)
            {sambaConfig.enabled && (
              <span className="bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                AKTİF
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-orange-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Clock className="w-4 h-4" />
            Dükkan Saatleri & Genel Ayarlar
          </button>
        </div>
      </div>

      {/* İçerik */}
      <main className="max-w-7xl w-full mx-auto p-6 flex-1">
        {/* 0. CİRO & SATIŞ RAPORLARI (GÜN SONU Z RAPORU) SEKMESİ */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            {/* Üst Tarih Filtresi & Z Raporu / Excel Çıktı Barı */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-orange-600" />
                  <h2 className="font-extrabold text-base text-slate-900">
                    Gün Sonu (Z Raporu) & Tarih Aralıklı Ciro Analizi
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "today", label: "Bugün (Z Raporu)" },
                    { id: "yesterday", label: "Dün" },
                    { id: "week", label: "Son 7 Gün" },
                    { id: "month", label: "Bu Ay" },
                    { id: "all", label: "Tüm Zamanlar" },
                    { id: "custom", label: "Özel Tarih" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setReportPeriod(
                          p.id as
                            | "today"
                            | "yesterday"
                            | "week"
                            | "month"
                            | "all"
                            | "custom"
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        reportPeriod === p.id
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {reportPeriod === "custom" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg"
                    />
                    <span className="text-xs text-slate-400 font-bold">—</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePrintZReport}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4 text-orange-400" />
                  <span>🧾 Z Raporu Yazdır (80mm / PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcelCsv}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>📊 Excel (CSV) İndir</span>
                </button>
              </div>
            </div>

            {/* Üst Özet Kartları */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
                  <span>Bugünkü Ciro</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {todayRevenue.toFixed(2)} {settings?.currency || "₺"}
                </div>
                <p className="text-xs text-slate-500">
                  Bugün {todayOrders.length} başarılı sipariş
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-orange-200 bg-orange-50/20 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-orange-700">
                  <span>Seçili Dönem Brüt Ciro</span>
                  <BarChart3 className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {totalRevenue.toFixed(2)} {settings?.currency || "₺"}
                </div>
                <p className="text-xs text-slate-500">
                  {validOrders.length} başarılı • {rejectedPeriodOrders.length}{" "}
                  iptal ({reportPeriodLabel})
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-emerald-700">
                  <span>Seçili Dönem GERÇEK NET KÂR</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  {netProfit.toFixed(2)} {settings?.currency || "₺"}
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Ürün Maliyeti: -{totalProductCost.toFixed(2)}{" "}
                  {settings?.currency || "₺"} • Giderler: -
                  {totalExpensesAmount.toFixed(2)} {settings?.currency || "₺"}
                </p>
                <p className="text-[11px] font-bold text-emerald-800">
                  Kasadaki Net Nakit: {netCashInDrawer.toFixed(2)}{" "}
                  {settings?.currency || "₺"}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
                  <span>Ortalama Sepet & İndirim</span>
                  <Tag className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {avgOrderValue.toFixed(2)} {settings?.currency || "₺"}
                </div>
                <p className="text-xs text-slate-500">
                  Toplam İndirim: {totalDiscountGiven.toFixed(2)}{" "}
                  {settings?.currency || "₺"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Sol: Kanal & Ödeme Dağılımı */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                  <h3 className="font-bold text-base text-slate-900">
                    Sipariş Kanalı Dağılımı
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50/70 border border-orange-100">
                      <span className="font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-orange-600" />
                        Adrese Paket Servis
                      </span>
                      <span className="font-black text-orange-700">
                        {deliveryCount} Sipariş
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 border border-blue-100">
                      <span className="font-bold text-slate-800 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-blue-600" />
                        Gel-Al (Restorandan Teslim)
                      </span>
                      <span className="font-black text-blue-700">
                        {pickupCount} Sipariş
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/70 border border-purple-100">
                      <span className="font-bold text-slate-800 flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-purple-600" />
                        Masada QR Sipariş
                      </span>
                      <span className="font-black text-purple-700">
                        {dineInCount} Sipariş
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                  <h3 className="font-bold text-base text-slate-900">
                    Ödeme Yöntemi Kırılımı
                  </h3>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">
                        Kapıda / Kasada Nakit
                      </span>
                      <span className="font-bold text-slate-900">
                        {cashTotal.toFixed(2)} {settings?.currency}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">
                        Kapıda Kredi Kartı (POS)
                      </span>
                      <span className="font-bold text-slate-900">
                        {cardTotal.toFixed(2)} {settings?.currency}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600 font-medium">
                        Masada Ödeme (Nakit / POS)
                      </span>
                      <span className="font-bold text-slate-900">
                        {tablePosTotal.toFixed(2)} {settings?.currency}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-amber-700 font-bold">
                        🧾 Cari / Veresiye Defterine Yazılan
                      </span>
                      <span className="font-black text-amber-700">
                        {creditTotal.toFixed(2)} {settings?.currency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sağ: En Çok Satan Ürünler & Saatlik Yoğunluk Isı Haritası */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-orange-600" />
                      <h3 className="font-bold text-base text-slate-900">
                        En Çok Satan Ürünler ({reportPeriodLabel})
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      Satış Adedine Göre Sıralı
                    </span>
                  </div>

                  {topSellingProducts.length === 0 ? (
                    <p className="text-xs text-slate-500 py-8 text-center">
                      Seçili tarih aralığında sipariş verisi bulunmuyor.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {topSellingProducts.slice(0, 10).map((prod, idx) => (
                        <div
                          key={prod.name}
                          className="py-3 flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-black text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-900">
                              {prod.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                              {prod.qty} Adet
                            </span>
                            <span className="font-extrabold text-emerald-700 w-24 text-right">
                              {prod.revenue.toFixed(2)} {settings?.currency}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {topModifiers.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <div className="text-xs font-extrabold text-slate-700">
                        🍽️ En Çok Tercih Edilen Porsiyon & Ekstralar:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {topModifiers.map((m) => (
                          <span
                            key={m.name}
                            className="text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200 px-2.5 py-1 rounded-lg"
                          >
                            {m.name} ({m.count}x)
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 📊 SAATLİK SİPARİŞ YOĞUNLUK ISI HARİTASI (08:00 - 23:00) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">
                        📊 Saatlik Sipariş Yoğunluk Isı Haritası (08:00 - 23:00)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Restoranın en yoğun olduğu saat aralıklarını ve saatlik ciro dağılımını izleyin
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {hourlyStats.map((h) => {
                      const ratio = h.count / maxHourlyCount;
                      const bgClass =
                        h.count === 0
                          ? "bg-slate-50 border-slate-200 text-slate-400"
                          : ratio >= 0.75
                          ? "bg-orange-600 border-orange-700 text-white"
                          : ratio >= 0.4
                          ? "bg-orange-100 border-orange-300 text-orange-900"
                          : "bg-amber-50 border-amber-200 text-amber-900";
                      return (
                        <div
                          key={h.hourLabel}
                          className={`p-2.5 rounded-xl border text-center space-y-0.5 ${bgClass}`}
                        >
                          <div className="text-[11px] font-bold">
                            {h.hourLabel}
                          </div>
                          <div className="text-sm font-black">
                            {h.count} Sipariş
                          </div>
                          <div className="text-[10px] opacity-85 font-semibold">
                            {h.revenue.toFixed(0)} {settings?.currency}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 💰 1. GİDER KAYDI, KASA AVANSI & NET KÂR + 🛵 6. KURYE TAHSİLAT HESAPLAŞMA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Sol: Gider Kaydı & Kasa Avansı */}
              <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      💰 Kasa Gider Kaydı, Başlangıç Avansı & Net Kâr
                    </h3>
                    <p className="text-xs text-slate-500">
                      Günlük manav, kasap, kurye yakıtı veya kasa başlangıç bozuk para avansını kaydedin
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleAddCashExpense}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200"
                >
                  <select
                    value={expenseCategory}
                    onChange={(e) =>
                      setExpenseCategory(
                        e.target.value as CashExpense["category"]
                      )
                    }
                    className="sm:col-span-4 px-2.5 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="supplier">🥩 Toptancı / Mutfak Alımı</option>
                    <option value="fuel">⛽ Kurye Yakıt / Motor</option>
                    <option value="staff">👨‍🍳 Personel Yevmiye / Avans</option>
                    <option value="utility">💡 Fatura / Kira / Ambalaj</option>
                    <option value="other">📌 Diğer Gider</option>
                    <option value="cash_float">💵 Kasa Başlangıç Avansı (+)</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="Açıklama (Örn: Kasap kıyma alımı)"
                    className="sm:col-span-5 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  />
                  <div className="sm:col-span-3 flex gap-1.5">
                    <input
                      type="number"
                      min={1}
                      required
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="Tutar"
                      className="w-full px-2.5 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-lg cursor-pointer shrink-0"
                    >
                      + Ekle
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">
                      Kasa Avansı (+)
                    </div>
                    <div className="text-sm font-black text-emerald-900">
                      {totalCashFloat.toFixed(2)} {settings?.currency}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                    <div className="text-[10px] font-bold text-rose-700 uppercase">
                      Toplam Gider (-)
                    </div>
                    <div className="text-sm font-black text-rose-900">
                      {totalExpensesAmount.toFixed(2)} {settings?.currency}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900 text-white">
                    <div className="text-[10px] font-bold text-amber-300 uppercase">
                      Kasadaki Net Nakit
                    </div>
                    <div className="text-sm font-black text-white">
                      {netCashInDrawer.toFixed(2)} {settings?.currency}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {periodExpenses.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">
                      Bu dönemde kayıtlı gider veya kasa avansı yok.
                    </p>
                  ) : (
                    periodExpenses.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">
                            {exp.title}
                          </span>
                          <span className="ml-2 text-[10px] text-slate-400">
                            {new Date(exp.createdAt).toLocaleString("tr-TR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-black ${
                              exp.category === "cash_float"
                                ? "text-emerald-700"
                                : "text-rose-600"
                            }`}
                          >
                            {exp.category === "cash_float" ? "+" : "-"}
                            {exp.amount.toFixed(2)} {settings?.currency}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCashExpense(exp.id)}
                            className="text-slate-400 hover:text-red-600 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sağ: Kurye Tahsilat & Gün Sonu Hesaplaşma Özeti */}
              <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      🛵 Kurye Tahsilat & Gün Sonu Hesaplaşma Özeti
                    </h3>
                    <p className="text-xs text-slate-500">
                      Hangi kuryenin üzerinde ne kadar Nakit ve POS fişi biriktiğini görün ve tek tıkla teslim alın
                    </p>
                  </div>
                </div>

                {courierSettlementList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    Kayıtlı kurye bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {courierSettlementList.map((c) => (
                      <div
                        key={c.courierName}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                            <span>🛵 {c.courierName}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              Toplam {c.totalCount} Paket
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-3">
                            <span>
                              💵 Teslim Edilecek Nakit:{" "}
                              <strong className="text-emerald-700">
                                {c.cashUnsettled.toFixed(2)} {settings?.currency}
                              </strong>
                            </span>
                            <span>
                              💳 POS / KartSLİP:{" "}
                              <strong className="text-blue-700">
                                {c.cardUnsettled.toFixed(2)} {settings?.currency}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {c.unsettledCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleSettleCourier(c.courierName)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition cursor-pointer whitespace-nowrap"
                            >
                              ✅ Hesabı Teslim Al ({c.unsettledCount} Paket)
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold">
                              ✓ Hesap Teslim Alındı
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 🧾 3. MÜŞTERİ VERESİYE / CARİ HESAP (AÇIK HESAP) DEFTERİ */}
            {(() => {
              const allCreditAccounts = settings?.creditAccounts || [];
              // Tüm kayıtlı müşterileri (CRM + Üyeler + SambaPOS) tek listede birleştir
              const regMap = new Map<
                string,
                { name: string; phone: string; address?: string }
              >();
              for (const c of crmCustomers) {
                const key = `${(c.name || "").trim().toLocaleLowerCase("tr-TR")}__${(
                  c.phone || ""
                ).replace(/\D/g, "")}`;
                if (c.name || c.phone) {
                  regMap.set(key, {
                    name: c.name || c.phone,
                    phone: c.phone || "",
                    address: c.address,
                  });
                }
              }
              for (const u of users) {
                const key = `${(u.name || "").trim().toLocaleLowerCase("tr-TR")}__${(
                  u.phone || ""
                ).replace(/\D/g, "")}`;
                if (!regMap.has(key) && (u.name || u.phone)) {
                  regMap.set(key, {
                    name: u.name || u.phone,
                    phone: u.phone || "",
                    address: u.addresses?.[0]?.fullAddress,
                  });
                }
              }
              const allRegisteredCustomers = Array.from(regMap.values());

              // 1) Sol üst form için kayıtlı müşteri arama sonuçları
              const regSearchQ = creditRegisteredSearch
                .trim()
                .toLocaleLowerCase("tr-TR");
              const matchingRegisteredForNew = allRegisteredCustomers
                .filter((rc) => {
                  if (!regSearchQ) return true;
                  return (
                    rc.name.toLocaleLowerCase("tr-TR").includes(regSearchQ) ||
                    rc.phone.toLocaleLowerCase("tr-TR").includes(regSearchQ)
                  );
                })
                .slice(0, 30);

              // 2) Sol alt form (Tahsilat / Borç Ekle) için arama filtresi
              const txSearchQ = creditTxSearch.trim().toLocaleLowerCase("tr-TR");
              const filteredTxCreditAccounts = allCreditAccounts.filter((acc) => {
                if (!txSearchQ) return true;
                return (
                  acc.customerName
                    .toLocaleLowerCase("tr-TR")
                    .includes(txSearchQ) ||
                  (acc.customerPhone || "")
                    .toLocaleLowerCase("tr-TR")
                    .includes(txSearchQ)
                );
              });
              const registeredNotYetInCredit = allRegisteredCustomers.filter(
                (rc) =>
                  !allCreditAccounts.some(
                    (acc) =>
                      acc.customerName.trim().toLocaleLowerCase("tr-TR") ===
                        rc.name.trim().toLocaleLowerCase("tr-TR") ||
                      (rc.phone &&
                        acc.customerPhone &&
                        rc.phone.replace(/\D/g, "").slice(-10) ===
                          acc.customerPhone.replace(/\D/g, "").slice(-10))
                  )
              );
              const filteredTxRegistered = registeredNotYetInCredit
                .filter((rc) => {
                  if (!txSearchQ) return true;
                  return (
                    rc.name.toLocaleLowerCase("tr-TR").includes(txSearchQ) ||
                    rc.phone.toLocaleLowerCase("tr-TR").includes(txSearchQ)
                  );
                })
                .slice(0, 50);

              // 3) Sağ taraf (Cari Hesap Listesi) için arama ve durum filtresi
              const listSearchQ = creditListSearch
                .trim()
                .toLocaleLowerCase("tr-TR");
              const filteredRightCreditAccounts = allCreditAccounts.filter(
                (acc) => {
                  if (creditListFilter === "with_debt" && acc.balance <= 0)
                    return false;
                  if (creditListFilter === "zero" && acc.balance > 0)
                    return false;
                  if (!listSearchQ) return true;
                  return (
                    acc.customerName
                      .toLocaleLowerCase("tr-TR")
                      .includes(listSearchQ) ||
                    (acc.customerPhone || "")
                      .toLocaleLowerCase("tr-TR")
                      .includes(listSearchQ)
                  );
                }
              );

              return (
                <div className="bg-white p-6 rounded-2xl border border-amber-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-base text-slate-900">
                        🧾 Müşteri Veresiye / Cari Hesap (Açık Hesap) Defteri
                      </h3>
                      <p className="text-xs text-slate-500">
                        Sitedeki kayıtlı müşterilerden seçerek cari hesap açın, arama yapın, tahsilat düşün ve müşterileri SambaPOS V5&apos;e aktarın
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={sambaCustomerExporting}
                        onClick={handleExportCustomersToSambaPos}
                        className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm transition cursor-pointer"
                      >
                        {sambaCustomerExporting
                          ? "⏳ SambaPOS'a Aktarılıyor..."
                          : "📤 Sitedeki Müşterileri SambaPOS'a Aktar"}
                      </button>
                      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                        Kayıtlı Cari: {allCreditAccounts.length} Müşteri
                      </span>
                      <span className="text-xs font-black bg-amber-100 text-amber-900 px-3 py-1 rounded-full">
                        Toplam Alacak Bakiyesi:{" "}
                        {allCreditAccounts
                          .reduce((s, a) => s + a.balance, 0)
                          .toFixed(2)}{" "}
                        {settings?.currency}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Sol: Yeni Cari Aç & Borç/Tahsilat İşle */}
                    <div className="lg:col-span-5 space-y-4">
                      <form
                        onSubmit={handleCreateNewCreditAccount}
                        className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-extrabold text-slate-800">
                            + Yeni Cari / Veresiye Müşteri Kartı Aç
                          </div>
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                            {allRegisteredCustomers.length} Kayıtlı Müşteri
                          </span>
                        </div>

                        {/* Kayıtlı Müşterilerden Arama ve Seçme Kutusu */}
                        {allRegisteredCustomers.length > 0 && (
                          <div className="bg-white p-2.5 rounded-lg border border-indigo-200 space-y-2">
                            <label className="block text-[11px] font-extrabold text-indigo-900">
                              👤 Kayıtlı Müşterilerden Ara & Otomatik Doldur:
                            </label>
                            <input
                              type="text"
                              value={creditRegisteredSearch}
                              onChange={(e) =>
                                setCreditRegisteredSearch(e.target.value)
                              }
                              placeholder="🔍 Kayıtlı müşteri adı veya telefon ara..."
                              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none"
                            />
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const [cName, cPhone] = val.split("::");
                                setNewCreditCustomerName(cName || "");
                                setNewCreditCustomerPhone(cPhone || "");
                              }}
                              className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white text-slate-800"
                            >
                              <option value="">
                                📋 Kayıtlı Müşteri Listesinden Seç ({matchingRegisteredForNew.length} sonuç)...
                              </option>
                              {matchingRegisteredForNew.map((rc, i) => (
                                <option
                                  key={`${rc.name}-${rc.phone}-${i}`}
                                  value={`${rc.name}::${rc.phone}`}
                                >
                                  {rc.name} {rc.phone ? `(${rc.phone})` : ""}
                                </option>
                              ))}
                            </select>
                            {creditRegisteredSearch.trim().length > 0 &&
                              matchingRegisteredForNew.length > 0 && (
                                <div className="max-h-28 overflow-y-auto space-y-1 pt-0.5">
                                  {matchingRegisteredForNew
                                    .slice(0, 6)
                                    .map((rc, i) => (
                                      <button
                                        key={`quick-reg-${i}`}
                                        type="button"
                                        onClick={() => {
                                          setNewCreditCustomerName(rc.name);
                                          setNewCreditCustomerPhone(
                                            rc.phone || ""
                                          );
                                          setCreditRegisteredSearch("");
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 rounded-md bg-indigo-50/70 hover:bg-indigo-100 text-[11px] font-bold text-indigo-950 flex items-center justify-between cursor-pointer"
                                      >
                                        <span className="truncate">
                                          👤 {rc.name}
                                        </span>
                                        <span className="text-[10px] text-indigo-700 shrink-0 ml-2">
                                          {rc.phone || "Seç →"}
                                        </span>
                                      </button>
                                    ))}
                                </div>
                              )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            value={newCreditCustomerName}
                            onChange={(e) =>
                              setNewCreditCustomerName(e.target.value)
                            }
                            placeholder="Müşteri / Esnaf Adı"
                            className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white"
                          />
                          <input
                            type="text"
                            value={newCreditCustomerPhone}
                            onChange={(e) =>
                              setNewCreditCustomerPhone(e.target.value)
                            }
                            placeholder="WhatsApp Tel (0532...)"
                            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-lg cursor-pointer"
                        >
                          + Cari Hesap Oluştur
                        </button>
                      </form>

                      <form
                        onSubmit={handleAddCreditTransaction}
                        className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-2.5"
                      >
                        <div className="text-xs font-extrabold text-amber-900">
                          💳 Cari Hesaptan Tahsilat Düş / Borç Ekle
                        </div>

                        {/* Çok Müşteri Olduğunda Hızlı Arama Kutusu */}
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={creditTxSearch}
                            onChange={(e) => setCreditTxSearch(e.target.value)}
                            placeholder="🔍 Müşteri veya cari hesap ara (İsim / Telefon)..."
                            className="w-full px-3 py-1.5 text-xs border border-amber-300 rounded-lg bg-white focus:border-amber-600 outline-none"
                          />

                          {/* Arama yapıldığında hızlı tıklanabilir sonuçlar */}
                          {creditTxSearch.trim().length > 0 && (
                            <div className="max-h-32 overflow-y-auto bg-white border border-amber-200 rounded-lg p-1.5 space-y-1">
                              {filteredTxCreditAccounts.length === 0 &&
                              filteredTxRegistered.length === 0 ? (
                                <div className="text-[11px] text-slate-400 text-center py-1.5">
                                  Aramaya uygun müşteri bulunamadı.
                                </div>
                              ) : (
                                <>
                                  {filteredTxCreditAccounts
                                    .slice(0, 8)
                                    .map((acc) => (
                                      <button
                                        key={`q-acc-${acc.id}`}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCreditAccId(acc.id);
                                          setCreditTxSearch("");
                                        }}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center justify-between cursor-pointer ${
                                          selectedCreditAccId === acc.id
                                            ? "bg-amber-600 text-white"
                                            : "hover:bg-amber-50 text-slate-900"
                                        }`}
                                      >
                                        <span className="truncate">
                                          🧾 {acc.customerName}{" "}
                                          {acc.customerPhone
                                            ? `(${acc.customerPhone})`
                                            : ""}
                                        </span>
                                        <span className="font-black shrink-0 ml-2">
                                          {acc.balance.toFixed(2)}{" "}
                                          {settings?.currency}
                                        </span>
                                      </button>
                                    ))}
                                  {filteredTxRegistered
                                    .slice(0, 6)
                                    .map((rc, idx) => {
                                      const regVal = `reg::${rc.name}::${rc.phone}`;
                                      return (
                                        <button
                                          key={`q-reg-${idx}`}
                                          type="button"
                                          onClick={() => {
                                            setSelectedCreditAccId(regVal);
                                            setCreditTxSearch("");
                                          }}
                                          className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center justify-between cursor-pointer ${
                                            selectedCreditAccId === regVal
                                              ? "bg-indigo-600 text-white"
                                              : "hover:bg-indigo-50 text-indigo-950"
                                          }`}
                                        >
                                          <span className="truncate">
                                            👤 {rc.name}{" "}
                                            {rc.phone ? `(${rc.phone})` : ""}
                                          </span>
                                          <span className="text-[10px] font-extrabold text-indigo-600 shrink-0 ml-2">
                                            Kayıtlı Müşteri (Cari Aç & İşle)
                                          </span>
                                        </button>
                                      );
                                    })}
                                </>
                              )}
                            </div>
                          )}

                          <select
                            required
                            value={selectedCreditAccId}
                            onChange={(e) =>
                              setSelectedCreditAccId(e.target.value)
                            }
                            className="w-full px-3 py-2 text-xs font-bold border border-amber-300 rounded-lg bg-white"
                          >
                            <option value="">
                              Müşteri Seçin ({filteredTxCreditAccounts.length} Cari
                              {filteredTxRegistered.length > 0
                                ? ` + ${filteredTxRegistered.length} Kayıtlı Müşteri`
                                : ""}
                              )...
                            </option>
                            {filteredTxCreditAccounts.length > 0 && (
                              <optgroup label="🧾 Açık Cari / Veresiye Hesapları">
                                {filteredTxCreditAccounts.map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.customerName}
                                    {acc.customerPhone
                                      ? ` (${acc.customerPhone})`
                                      : ""}{" "}
                                    — Bakiye: {acc.balance.toFixed(2)}{" "}
                                    {settings?.currency}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {filteredTxRegistered.length > 0 && (
                              <optgroup label="👤 Kayıtlı Müşteriler (Seçildiğinde Otomatik Cari Açılır)">
                                {filteredTxRegistered.map((rc, i) => (
                                  <option
                                    key={`reg-opt-${i}`}
                                    value={`reg::${rc.name}::${rc.phone}`}
                                  >
                                    👤 {rc.name}{" "}
                                    {rc.phone ? `(${rc.phone})` : ""} — [Yeni Cari]
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={creditTxType}
                            onChange={(e) =>
                              setCreditTxType(
                                e.target.value as "debt" | "payment"
                              )
                            }
                            className="px-2.5 py-2 text-xs font-bold border border-amber-300 rounded-lg bg-white"
                          >
                            <option value="payment">💵 Tahsilat Al (-)</option>
                            <option value="debt">🧾 Borç Yaz (+)</option>
                          </select>
                          <input
                            type="number"
                            min={1}
                            required
                            value={creditTxAmount}
                            onChange={(e) => setCreditTxAmount(e.target.value)}
                            placeholder="Tutar (₺)"
                            className="px-3 py-2 text-xs font-bold border border-amber-300 rounded-lg bg-white"
                          />
                        </div>
                        <input
                          type="text"
                          value={creditTxNote}
                          onChange={(e) => setCreditTxNote(e.target.value)}
                          placeholder="Açıklama (Örn: Nakit tahsilat / Öğle yemeği)"
                          className="w-full px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white"
                        />
                        <button
                          type="submit"
                          className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-lg cursor-pointer"
                        >
                          İşlemi Kaydet
                        </button>
                      </form>
                    </div>

                    {/* Sağ: Cari Hesap Listesi (Arama ve Filtreli) */}
                    <div className="lg:col-span-7 space-y-3">
                      {/* Sağ Üst Arama ve Bakiye Filtre Çubuğu */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <input
                          type="text"
                          value={creditListSearch}
                          onChange={(e) => setCreditListSearch(e.target.value)}
                          placeholder="🔍 Cari hesaplarda isim veya telefon ile ara..."
                          className="flex-1 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-lg bg-white focus:border-amber-500 outline-none"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setCreditListFilter("all")}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                              creditListFilter === "all"
                                ? "bg-slate-900 text-white"
                                : "bg-white text-slate-600 border border-slate-200"
                            }`}
                          >
                            Tümü ({allCreditAccounts.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreditListFilter("with_debt")}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                              creditListFilter === "with_debt"
                                ? "bg-amber-600 text-white"
                                : "bg-white text-amber-800 border border-amber-200"
                            }`}
                          >
                            Borçlu (
                            {
                              allCreditAccounts.filter((a) => a.balance > 0)
                                .length
                            }
                            )
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreditListFilter("zero")}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                              creditListFilter === "zero"
                                ? "bg-emerald-600 text-white"
                                : "bg-white text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            Borcu Yok (
                            {
                              allCreditAccounts.filter((a) => a.balance <= 0)
                                .length
                            }
                            )
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                        {filteredRightCreditAccounts.length === 0 ? (
                          <p className="text-xs text-slate-400 py-10 text-center">
                            {allCreditAccounts.length === 0
                              ? 'Henüz açılmış bir veresiye / cari müşteri hesabı bulunmuyor. Masa hesabı kapatırken "Cari / Veresiye" seçtiğinizde de otomatik oluşur.'
                              : "Arama kriterine uygun cari hesap bulunamadı."}
                          </p>
                        ) : (
                          filteredRightCreditAccounts.map((acc) => {
                            const isSelected = selectedCreditAccId === acc.id;
                            const isExpanded = expandedCreditAccId === acc.id;
                            return (
                              <div
                                key={acc.id}
                                className={`p-3.5 rounded-xl border transition space-y-2.5 ${
                                  isSelected
                                    ? "bg-amber-50/70 border-amber-400 shadow-xs"
                                    : "bg-slate-50 border-slate-200"
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-sm text-slate-900">
                                        {acc.customerName}
                                      </span>
                                      {acc.customerPhone && (
                                        <span className="text-xs text-slate-500">
                                          ({acc.customerPhone})
                                        </span>
                                      )}
                                    </div>
                                    {acc.transactions &&
                                      acc.transactions.length > 0 && (
                                        <div className="text-[11px] text-slate-500">
                                          Son İşlem:{" "}
                                          {acc.transactions[0].type === "debt"
                                            ? "+"
                                            : "-"}
                                          {acc.transactions[0].amount.toFixed(
                                            2
                                          )}{" "}
                                          {settings?.currency} —{" "}
                                          {acc.transactions[0].description}
                                        </div>
                                      )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`text-sm font-black ${
                                        acc.balance > 0
                                          ? "text-amber-700"
                                          : "text-emerald-700"
                                      }`}
                                    >
                                      {acc.balance.toFixed(2)}{" "}
                                      {settings?.currency}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCreditAccId(acc.id);
                                        setCreditTxType(
                                          acc.balance > 0 ? "payment" : "debt"
                                        );
                                      }}
                                      className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer border ${
                                        isSelected
                                          ? "bg-amber-600 text-white border-amber-600"
                                          : "bg-white hover:bg-amber-50 text-amber-800 border-amber-300"
                                      }`}
                                      title="Soldaki tahsilat/borç formunda bu müşteriyi seç"
                                    >
                                      💳 {isSelected ? "Seçili" : "İşlem Yap"}
                                    </button>
                                    {acc.transactions &&
                                      acc.transactions.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedCreditAccId(
                                              isExpanded ? null : acc.id
                                            )
                                          }
                                          className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold cursor-pointer"
                                        >
                                          📋 {isExpanded ? "Gizle" : "Hareketler"}
                                        </button>
                                      )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSendCreditWhatsApp(acc)
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe57] text-slate-950 text-xs font-extrabold cursor-pointer"
                                    >
                                      💬 WhatsApp Ekstre
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteCreditAccount(acc)
                                      }
                                      className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 cursor-pointer"
                                      title="Cari Hesabı Sil"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {isExpanded &&
                                  acc.transactions &&
                                  acc.transactions.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1 text-xs">
                                      <div className="text-[10px] font-extrabold uppercase text-slate-400 pb-1 border-b border-slate-100">
                                        Son Hesap Hareketleri ({acc.transactions.length})
                                      </div>
                                      <div className="max-h-36 overflow-y-auto space-y-1">
                                        {acc.transactions
                                          .slice(0, 15)
                                          .map((tx) => (
                                            <div
                                              key={tx.id}
                                              className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0 text-[11px]"
                                            >
                                              <div>
                                                <span className="font-semibold text-slate-800">
                                                  {tx.description}
                                                </span>
                                                <span className="ml-2 text-[10px] text-slate-400">
                                                  {new Date(
                                                    tx.createdAt
                                                  ).toLocaleString("tr-TR", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                  })}
                                                </span>
                                              </div>
                                              <span
                                                className={`font-black ${
                                                  tx.type === "debt"
                                                    ? "text-amber-700"
                                                    : "text-emerald-700"
                                                }`}
                                              >
                                                {tx.type === "debt" ? "+" : "-"}
                                                {tx.amount.toFixed(2)}{" "}
                                                {settings?.currency}
                                              </span>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 👨‍💼 4. GARSON & KURYE PERFORMANS RAPORU + 📅 5. MASA REZERVASYON TALEPLERİ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Sol: Garson & Kurye Performans Analizi */}
              <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-base text-slate-900">
                    👨‍💼 Personel Performans Raporu (Garson & Kurye Analizi)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Seçili dönemde ({reportPeriodLabel}) garsonların açtığı masa cirosu ve kuryelerin teslimat performansı
                  </p>
                </div>

                {/* Garson Satış Tablosu */}
                <div className="space-y-2">
                  <div className="text-xs font-extrabold uppercase text-orange-600">
                    🍽️ Salon & Garson Masa Satış Performansı
                  </div>
                  {(() => {
                    const waiterMap = new Map<
                      string,
                      { count: number; itemsQty: number; revenue: number }
                    >();
                    validOrders
                      .filter((o) => o.orderType === "dine_in")
                      .forEach((o) => {
                        let waiterName = "QR Müşteri (Self-Servis)";
                        const match = (o.orderNote || "").match(
                          /Garson:\s*([^|•\n]+)/i
                        );
                        if (match && match[1]) {
                          waiterName = `👨‍💼 ${match[1].trim()}`;
                        } else if (o.customerPhone === "Garson Siparişi") {
                          waiterName = "👨‍💼 Garson Terminali";
                        } else if (o.customerPhone === "Kasa Siparişi") {
                          waiterName = "🖥️ Kasa POS";
                        }
                        const prev = waiterMap.get(waiterName) || {
                          count: 0,
                          itemsQty: 0,
                          revenue: 0,
                        };
                        const qty = o.items.reduce(
                          (s, it) => s + it.quantity,
                          0
                        );
                        waiterMap.set(waiterName, {
                          count: prev.count + 1,
                          itemsQty: prev.itemsQty + qty,
                          revenue: prev.revenue + o.totalAmount,
                        });
                      });
                    const rows = Array.from(waiterMap.entries()).sort(
                      (a, b) => b[1].revenue - a[1].revenue
                    );

                    if (rows.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 py-3">
                          Seçili dönemde masa siparişi bulunmuyor.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-1.5">
                        {rows.map(([wName, st]) => (
                          <div
                            key={wName}
                            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                          >
                            <div>
                              <span className="font-extrabold text-slate-900">
                                {wName}
                              </span>
                              <span className="ml-2 text-slate-500">
                                ({st.count} Adisyon • {st.itemsQty} Ürün)
                              </span>
                            </div>
                            <span className="font-black text-emerald-700">
                              {st.revenue.toFixed(2)} {settings?.currency}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Kurye Teslimat Performans Tablosu */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-xs font-extrabold uppercase text-emerald-700">
                    🛵 Kurye Paket Teslimat Performansı
                  </div>
                  {(() => {
                    const cMap = new Map<
                      string,
                      { count: number; revenue: number }
                    >();
                    validOrders
                      .filter((o) => o.orderType === "delivery")
                      .forEach((o) => {
                        const cName = o.courierName || "Atanmamış / Genel Kurye";
                        const prev = cMap.get(cName) || {
                          count: 0,
                          revenue: 0,
                        };
                        cMap.set(cName, {
                          count: prev.count + 1,
                          revenue: prev.revenue + o.totalAmount,
                        });
                      });
                    const rows = Array.from(cMap.entries()).sort(
                      (a, b) => b[1].count - a[1].count
                    );
                    if (rows.length === 0) {
                      return (
                        <p className="text-xs text-slate-400 py-3">
                          Seçili dönemde paket servis siparişi bulunmuyor.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-1.5">
                        {rows.map(([cName, st]) => (
                          <div
                            key={cName}
                            className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50/50 border border-emerald-200/70 text-xs"
                          >
                            <div>
                              <span className="font-extrabold text-slate-900">
                                🛵 {cName}
                              </span>
                              <span className="ml-2 text-slate-600 font-bold">
                                ({st.count} Paket Teslimat)
                              </span>
                            </div>
                            <span className="font-black text-emerald-800">
                              {st.revenue.toFixed(2)} {settings?.currency}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Sağ: Masa Rezervasyon Talepleri & Masa Atama */}
              <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-purple-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      📅 Online Masa Rezervasyon Talepleri
                    </h3>
                    <p className="text-xs text-slate-500">
                      Müşterilerin vitrinden gönderdiği rezervasyonlara masa atayın ve tek tıkla WhatsApp onayı gönderin
                    </p>
                  </div>
                  <span className="text-xs font-black bg-purple-100 text-purple-800 px-3 py-1 rounded-full">
                    {(settings?.reservations || []).length} Kayıt
                  </span>
                </div>

                {(settings?.reservations || []).length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center">
                    Henüz masa rezervasyon talebi bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {(settings?.reservations || []).map((res) => (
                      <div
                        key={res.id}
                        className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-extrabold text-slate-900 flex items-center gap-2">
                            <span>{res.customerName}</span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                res.status === "confirmed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : res.status === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {res.status === "confirmed"
                                ? "✓ Onaylandı"
                                : res.status === "pending"
                                ? "⏳ Onay Bekliyor"
                                : res.status === "seated"
                                ? "🪑 Masaya Oturdu"
                                : "İptal"}
                            </span>
                          </div>
                          <span className="font-bold text-purple-700">
                            📅 {res.date || res.reservationDate} • ⏰{" "}
                            {res.time || res.reservationTime} • 👥{" "}
                            {res.guests || res.guestCount} Kişi
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-slate-500">
                            📞 {res.customerPhone}
                            {res.notes || res.specialRequests
                              ? ` • 📝 ${res.notes || res.specialRequests}`
                              : ""}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <select
                              value={res.tableNumber || res.assignedTable || ""}
                              onChange={async (e) => {
                                const r = await fetch("/api/menu", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    type: "update_reservation",
                                    reservationId: res.id,
                                    status: res.status,
                                    tableNumber: e.target.value,
                                  }),
                                });
                                if (r.ok) {
                                  const d = await r.json();
                                  if (d.settings) setSettings(d.settings);
                                }
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-800"
                            >
                              <option value="">Masa Ata...</option>
                              {getRestaurantTables(settings).map((t) => (
                                <option key={t} value={t}>
                                  {formatTableLabel(t)}
                                </option>
                              ))}
                            </select>
                            {res.status === "pending" && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const r = await fetch("/api/menu", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      type: "update_reservation",
                                      reservationId: res.id,
                                      status: "confirmed",
                                      tableNumber:
                                        res.tableNumber || res.assignedTable,
                                    }),
                                  });
                                  if (r.ok) {
                                    const d = await r.json();
                                    if (d.settings) setSettings(d.settings);
                                    setSavingMsg(
                                      "Rezervasyon onaylandı ve WhatsApp bildirimi gönderildi!"
                                    );
                                    setTimeout(() => setSavingMsg(""), 3000);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold cursor-pointer"
                              >
                                ✓ Onayla + WhatsApp
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Alt Tablo: Seçili Dönem Sipariş Geçmişi & Tek Tık 80mm Fiş Yazdır */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Sipariş Detay Listesi & Tek Tıkla Adisyon Fişi ({periodFilteredAllOrders.length} Sipariş)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Geçmiş veya aktif herhangi bir siparişin 80mm kasa/kurye fişini buradan tekrar yazdırabilirsiniz.
                  </p>
                </div>
              </div>

              {periodFilteredAllOrders.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Bu dönemde kayıtlı sipariş bulunamadı.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase">
                        <th className="py-2.5 px-3">Sipariş</th>
                        <th className="py-2.5 px-3">Tarih / Saat</th>
                        <th className="py-2.5 px-3">Kanal / Konum</th>
                        <th className="py-2.5 px-3">Müşteri</th>
                        <th className="py-2.5 px-3">Ürünler</th>
                        <th className="py-2.5 px-3">Kurye / Durum</th>
                        <th className="py-2.5 px-3 text-right">Tutar</th>
                        <th className="py-2.5 px-3 text-right">Fiş</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {periodFilteredAllOrders.slice(0, 40).map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-black text-slate-900">
                            #{ord.orderNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(ord.createdAt).toLocaleString("tr-TR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            {ord.orderType === "dine_in"
                              ? `🍽️ Masa ${ord.tableNumber}`
                              : ord.orderType === "pickup"
                              ? "🛍️ Gel-Al"
                              : `🛵 Paket (${ord.deliveryZoneName || "Genel"})`}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">
                              {ord.customerName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {ord.customerPhone}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 max-w-xs truncate text-slate-600">
                            {ord.items
                              .map((i) => `${i.quantity}x ${i.name}`)
                              .join(", ")}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                ord.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : ord.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {ord.status === "rejected"
                                ? "İptal"
                                : ord.status === "completed"
                                ? "Tamamlandı"
                                : ord.status === "ready"
                                ? "Yolda / Hazır"
                                : "Hazırlanıyor"}
                            </span>
                            {ord.courierName && (
                              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                                🛵 {ord.courierName}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 whitespace-nowrap">
                            {ord.totalAmount.toFixed(2)} {settings?.currency}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handlePrintOrderFromAdmin(ord)}
                              className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 text-orange-600" />
                              <span>Yazdır</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ⭐ Müşteri Puanlama ve Yorumları Özeti */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Müşteri Puanlama & Sipariş Yorumları (
                      {orders.filter((o) => o.rating && o.rating > 0).length}{" "}
                      Değerlendirme)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tamamlanan siparişlerden sonra müşterilerin verdiği yıldız
                      puanları ve lezzet yorumları (4 ve 5 yıldızlı yorumlar
                      vitrinde otomatik sergilenir)
                    </p>
                  </div>
                </div>
              </div>

              {orders.filter((o) => o.rating && o.rating > 0).length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Henüz değerlendirilmiş sipariş bulunmuyor. Müşteriler
                  tamamlanan siparişlerine 1-5 yıldız ve yorum bırakabilir.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {orders
                    .filter((o) => o.rating && o.rating > 0)
                    .slice(0, 12)
                    .map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/80 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-slate-900">
                            {ord.customerName} (#{ord.orderNumber})
                          </span>
                          <span className="text-xs font-black text-amber-600">
                            {"★".repeat(ord.rating || 5)}
                            {"☆".repeat(5 - (ord.rating || 5))}
                          </span>
                        </div>
                        {ord.reviewText && (
                          <p className="text-xs text-slate-700 italic">
                            &ldquo;{ord.reviewText}&rdquo;
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400 flex justify-between pt-1">
                          <span>
                            {ord.items.map((i) => i.name).join(", ")}
                          </span>
                          <span>
                            {new Date(
                              ord.reviewedAt || ord.createdAt
                            ).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 1. MENÜ & ÜRÜN YÖNETİMİ */}
        {activeTab === "menu" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 space-y-4 self-start">
              <h2 className="font-bold text-base text-slate-900">
                Menü Kategorileri
              </h2>
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Yeni kategori adı..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl text-sm font-bold"
                >
                  Ekle
                </button>
              </form>

              <div className="divide-y divide-slate-100">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="py-2.5 flex items-center justify-between text-sm"
                  >
                    <span className="font-semibold text-slate-800">
                      {cat.name}
                    </span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                <div className="space-y-1.5">
                  <h2 className="font-bold text-base text-slate-900">
                    Ürünler ({items.length})
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMenuStockFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        menuStockFilter === "all"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      Tümü ({items.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuStockFilter("available")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        menuStockFilter === "available"
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      Stokta ({items.filter((i) => i.available).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuStockFilter("sold_out")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        menuStockFilter === "sold_out"
                          ? "bg-rose-600 text-white"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      Tükenenler ({items.filter((i) => !i.available).length})
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch("/api/menu", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ type: "reset_daily_stocks" }),
                      });
                      if (res.ok) {
                        loadData();
                        showToast(
                          "🔄 Tüm ürünlerin günlük stokları yenilendi ve tükenenler satışa açıldı!"
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    🔄 Günlük Stokları Yenile (Tükenenleri Aç)
                  </button>
                  <button
                    onClick={() =>
                      setEditingItem({
                        id: "",
                        categoryId: categories[0]?.id || "cat-1",
                        name: "",
                        description: "",
                        price: 200,
                        imageUrl:
                          "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
                        available: true,
                        popular: false,
                        modifierGroups: [],
                      })
                    }
                    className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Yeni Ürün Ekle
                  </button>
                </div>
              </div>

              {/* 🏷️ Toplu Fiyat Güncelleme (Zam / İndirim) Aracı */}
              <div className="bg-gradient-to-r from-orange-50/70 via-amber-50/50 to-white p-4 rounded-2xl border border-orange-200 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      🏷️ Toplu Fiyat Güncelleme (Tek Tıkla Zam / İndirim)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tüm menüye veya seçili kategoriye yüzdelik (%) ya da sabit tutar (₺) bazında toplu fiyat güncellemesi uygulayın.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Hedef Kategori
                    </label>
                    <select
                      value={bulkCategoryId}
                      onChange={(e) => setBulkCategoryId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="all">Tüm Kategoriler ({items.length} Ürün)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({items.filter((i) => i.categoryId === c.id).length})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      İşlem Türü
                    </label>
                    <select
                      value={bulkMode}
                      onChange={(e) =>
                        setBulkMode(e.target.value as "percent" | "fixed")
                      }
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="percent">Yüzde Oranı (%)</option>
                      <option value="fixed">Sabit Tutar ({settings?.currency || "₺"})</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Değer (+ Zam / - İndirim)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={bulkValue}
                      onChange={(e) => setBulkValue(Number(e.target.value))}
                      placeholder="Örn: 10 veya -10"
                      className="w-full px-3 py-2 text-xs font-extrabold border border-slate-300 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Fiyat Yuvarlama
                    </label>
                    <select
                      value={bulkRounding}
                      onChange={(e) =>
                        setBulkRounding(
                          e.target.value as "none" | "nearest_5" | "nearest_10"
                        )
                      }
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white"
                    >
                      <option value="nearest_5">En Yakın 5 ₺&apos;ye Yuvarla</option>
                      <option value="nearest_10">En Yakın 10 ₺&apos;ye Yuvarla</option>
                      <option value="none">Yuvarlama Yapma (Tam Kuruş)</option>
                    </select>
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={bulkUpdating || !bulkValue}
                      onClick={async () => {
                        if (!bulkValue) return;
                        setBulkUpdating(true);
                        try {
                          const res = await fetch("/api/menu", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              type: "bulk_update_prices",
                              categoryId: bulkCategoryId,
                              mode: bulkMode,
                              value: Number(bulkValue),
                              rounding: bulkRounding,
                            }),
                          });
                          if (res.ok) {
                            const d = await res.json();
                            await loadData();
                            showToast(
                              `🏷️ ${d.updatedCount || 0} ürünün fiyatı başarıyla güncellendi!`
                            );
                          }
                        } finally {
                          setBulkUpdating(false);
                        }
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-black transition cursor-pointer shadow-xs"
                    >
                      {bulkUpdating ? "Uygulanıyor..." : "⚡ Fiyatları Güncelle"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {items
                  .filter((it) =>
                    menuStockFilter === "available"
                      ? it.available
                      : menuStockFilter === "sold_out"
                      ? !it.available
                      : true
                  )
                  .map((item) => {
                    const catName =
                      categories.find((c) => c.id === item.categoryId)?.name ||
                      "Kategori";
                    return (
                      <div
                        key={item.id}
                        className={`bg-white p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          item.available
                            ? "border-slate-200"
                            : "border-rose-300 bg-rose-50/20"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-16 h-16 rounded-xl object-cover bg-slate-100"
                            />
                          )}
                          <div>
                            <span className="text-[11px] font-bold uppercase text-orange-600">
                              {catName}
                            </span>
                            <h3 className="font-bold text-slate-900">
                              {item.name}
                            </h3>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {item.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-slate-900 mt-1">
                              <span>
                                {item.price.toFixed(2)} {settings?.currency}
                              </span>
                              {item.costPrice !== undefined &&
                                item.costPrice > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Maliyet: {item.costPrice.toFixed(2)}{" "}
                                    {settings?.currency} • Kâr:{" "}
                                    {(item.price - item.costPrice).toFixed(2)}{" "}
                                    {settings?.currency} (%
                                    {item.price > 0
                                      ? Math.round(
                                          ((item.price - item.costPrice) /
                                            item.price) *
                                            100
                                        )
                                      : 0}
                                    )
                                  </span>
                                )}
                              <span>•</span>
                              <span className="text-xs font-normal text-slate-500">
                                {item.modifierGroups.length} Opsiyon Grubu
                              </span>
                              {item.dailyStock !== null &&
                              item.dailyStock !== undefined ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
                                    item.dailyStock <= 0
                                      ? "bg-rose-100 text-rose-800 border-rose-300"
                                      : item.dailyStock <= 5
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : "bg-indigo-50 text-indigo-800 border-indigo-200"
                                  }`}
                                >
                                  📦 Günlük Stok: {item.dailyStock} Porsiyon
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  📦 Stok: Sınırsız
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                          {item.dailyStock !== null &&
                            item.dailyStock !== undefined && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextStock =
                                    Number(item.dailyStock || 0) + 10;
                                  const updatedItem: MenuItem = {
                                    ...item,
                                    dailyStock: nextStock,
                                    available: true,
                                  };
                                  await fetch("/api/menu", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      item: updatedItem,
                                    }),
                                  });
                                  loadData();
                                  showToast(
                                    `"${item.name}" stokuna +10 porsiyon eklendi (${nextStock} porsiyon).`
                                  );
                                }}
                                className="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 transition cursor-pointer"
                                title="Günlük porsiyon stokuna hızlıca +10 porsiyon ekle"
                              >
                                +10 Porsiyon
                              </button>
                            )}
                          <button
                            onClick={() => handleToggleItemAvailability(item)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                              item.available
                                ? "bg-emerald-100 hover:bg-rose-100 text-emerald-800 hover:text-rose-800"
                                : "bg-rose-600 hover:bg-emerald-600 text-white"
                            }`}
                          >
                            {item.available
                              ? "🟢 Stokta (Aktif)"
                              : "🔴 TÜKENDİ (Aç)"}
                          </button>
                          <button
                            onClick={() => setEditingItem(item)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                            title="Düzenle & Porsiyon/Opsiyon Ekle"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* 1.5 TESLİMAT BÖLGELERİ (MAHALLELER), KUPONLAR & ÜST DUYURU BARI */}
        {activeTab === "campaigns" && settings && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Üst Tam Genişlik: Müşteri Sayfası Üst Duyuru & Kampanya Barı Yönetimi */}
            <div className="lg:col-span-12 bg-white p-6 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-slate-900">
                      Müşteri Ekranı Üst Duyuru & Kampanya Barı
                    </h2>
                    <p className="text-xs text-slate-500">
                      Sitenin en üstündeki barı dilediğiniz gibi özelleştirin, kupon bağlayın veya tek tıkla kapatın
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const current = settings.announcementBar || {
                      enabled: true,
                      badgeText: "🔥 GÜNÜN FIRSATI",
                      text: "Tüm ızgara menülerde ücretsiz Yayık Ayran!",
                      couponCodeToApply: "MERHABA50",
                      theme: "orange" as const,
                    };
                    persistSettings(
                      {
                        ...settings,
                        announcementBar: {
                          ...current,
                          enabled: !current.enabled,
                        },
                      },
                      !current.enabled
                        ? "Üst duyuru barı aktif edildi!"
                        : "Üst duyuru barı gizlendi!"
                    );
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
                    settings.announcementBar?.enabled ?? true
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {settings.announcementBar?.enabled ?? true
                    ? "✓ Üst Bar: AKTİF (Görünüyor)"
                    : "Üst Bar: KAPALI (Gizli)"}
                </button>
              </div>

              {/* Canlı Önizleme */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Canlı Önizleme (Müşteri Sayfasının En Üstünde Böyle Görünür):
                </span>
                <div
                  className={`text-xs py-2.5 px-4 rounded-xl border transition ${
                    (settings.announcementBar?.theme || "orange") === "orange"
                      ? "bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 text-white border-orange-700"
                      : settings.announcementBar?.theme === "emerald"
                      ? "bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-700 text-white border-emerald-800"
                      : settings.announcementBar?.theme === "indigo"
                      ? "bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-700 text-white border-indigo-800"
                      : "bg-slate-900 text-slate-100 border-slate-800"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {settings.announcementBar?.badgeText && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white font-extrabold text-[11px]">
                          <Sparkles className="w-3 h-3" />
                          {settings.announcementBar.badgeText}
                        </span>
                      )}
                      <span className="font-medium text-xs sm:text-[13px]">
                        {settings.announcementBar?.text ||
                          "Duyuru metniniz burada yer alacak..."}
                      </span>
                    </div>
                    {settings.announcementBar?.couponCodeToApply && (
                      <span className="inline-flex items-center gap-1 bg-white text-slate-900 px-2.5 py-1 rounded-lg font-extrabold text-[11px]">
                        🎟️ {settings.announcementBar.couponCodeToApply} Kodunu Kullan
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Düzenleme Alanları */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sol Etiket (Rozet)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 🔥 GÜNÜN FIRSATI"
                    value={settings.announcementBar?.badgeText ?? ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        announcementBar: {
                          enabled: settings.announcementBar?.enabled ?? true,
                          badgeText: e.target.value,
                          text: settings.announcementBar?.text ?? "",
                          couponCodeToApply:
                            settings.announcementBar?.couponCodeToApply ?? "",
                          theme: settings.announcementBar?.theme ?? "orange",
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="md:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Duyuru / Kampanya Metni
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Tüm ızgara menülerde ücretsiz Yayık Ayran!"
                    value={settings.announcementBar?.text ?? ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        announcementBar: {
                          enabled: settings.announcementBar?.enabled ?? true,
                          badgeText: settings.announcementBar?.badgeText ?? "",
                          text: e.target.value,
                          couponCodeToApply:
                            settings.announcementBar?.couponCodeToApply ?? "",
                          theme: settings.announcementBar?.theme ?? "orange",
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tıklanabilir Kupon (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: MERHABA50"
                    value={settings.announcementBar?.couponCodeToApply ?? ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        announcementBar: {
                          enabled: settings.announcementBar?.enabled ?? true,
                          badgeText: settings.announcementBar?.badgeText ?? "",
                          text: settings.announcementBar?.text ?? "",
                          couponCodeToApply: e.target.value.toUpperCase(),
                          theme: settings.announcementBar?.theme ?? "orange",
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-bold uppercase border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bar Renk Teması
                  </label>
                  <select
                    value={settings.announcementBar?.theme ?? "orange"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        announcementBar: {
                          enabled: settings.announcementBar?.enabled ?? true,
                          badgeText: settings.announcementBar?.badgeText ?? "",
                          text: settings.announcementBar?.text ?? "",
                          couponCodeToApply:
                            settings.announcementBar?.couponCodeToApply ?? "",
                          theme: e.target.value as
                            | "dark"
                            | "orange"
                            | "emerald"
                            | "indigo",
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="orange">Turuncu / Kırmızı Alev</option>
                    <option value="emerald">Zümrüt Yeşili</option>
                    <option value="indigo">İndigo / Mor</option>
                    <option value="dark">Gece Siyahı (Koyu)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    persistSettings(
                      settings,
                      "Üst duyuru barı kaydedildi ve müşteri ekranında güncellendi!"
                    )
                  }
                  className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  Üst Bar Ayarlarını Kaydet
                </button>
              </div>
            </div>

            {/* ⏱️ 5. SAATLİK "HAPPY HOUR" / ÖĞLE MENÜSÜ OTOMATİK İNDİRİM KURALI */}
            <div className="lg:col-span-12 bg-white p-6 rounded-2xl border-2 border-amber-300 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                    ⏱️
                  </div>
                  <div>
                    <h2 className="font-extrabold text-base text-slate-900">
                      Saatlik &quot;Happy Hour&quot; / Öğle Menüsü Otomatik İndirim Kuralı
                    </h2>
                    <p className="text-xs text-slate-500">
                      Restoranın sakin saatlerinde (Örn: 14:00 - 17:00) kupon koduna gerek kalmadan sepette otomatik yüzdelik indirim uygular
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const cur = settings.happyHourConfig || {
                      enabled: false,
                      title: "Öğle Saatleri Happy Hour İndirimi",
                      startTime: "14:00",
                      endTime: "17:00",
                      discountPercent: 15,
                    };
                    persistSettings(
                      {
                        ...settings,
                        happyHourConfig: {
                          ...cur,
                          enabled: !cur.enabled,
                        },
                      },
                      !cur.enabled
                        ? "⏱️ Saatlik Happy Hour indirimi AKTİF edildi!"
                        : "Saatlik Happy Hour indirimi kapatıldı."
                    );
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    settings.happyHourConfig?.enabled
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {settings.happyHourConfig?.enabled
                    ? "✓ Happy Hour: AKTİF"
                    : "Happy Hour: KAPALI (Aktif Et)"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kampanya Başlığı
                  </label>
                  <input
                    type="text"
                    value={
                      settings.happyHourConfig?.title ??
                      "Öğle Saatleri Happy Hour İndirimi"
                    }
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        happyHourConfig: {
                          enabled: settings.happyHourConfig?.enabled ?? false,
                          title: e.target.value,
                          startTime:
                            settings.happyHourConfig?.startTime ?? "14:00",
                          endTime: settings.happyHourConfig?.endTime ?? "17:00",
                          discountPercent:
                            settings.happyHourConfig?.discountPercent ?? 15,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Başlangıç Saati
                  </label>
                  <input
                    type="time"
                    value={settings.happyHourConfig?.startTime ?? "14:00"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        happyHourConfig: {
                          enabled: settings.happyHourConfig?.enabled ?? false,
                          title:
                            settings.happyHourConfig?.title ??
                            "Öğle Saatleri Happy Hour İndirimi",
                          startTime: e.target.value,
                          endTime: settings.happyHourConfig?.endTime ?? "17:00",
                          discountPercent:
                            settings.happyHourConfig?.discountPercent ?? 15,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bitiş Saati
                  </label>
                  <input
                    type="time"
                    value={settings.happyHourConfig?.endTime ?? "17:00"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        happyHourConfig: {
                          enabled: settings.happyHourConfig?.enabled ?? false,
                          title:
                            settings.happyHourConfig?.title ??
                            "Öğle Saatleri Happy Hour İndirimi",
                          startTime:
                            settings.happyHourConfig?.startTime ?? "14:00",
                          endTime: e.target.value,
                          discountPercent:
                            settings.happyHourConfig?.discountPercent ?? 15,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="md:col-span-3 flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      İndirim (%)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={80}
                      value={settings.happyHourConfig?.discountPercent ?? 15}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          happyHourConfig: {
                            enabled: settings.happyHourConfig?.enabled ?? false,
                            title:
                              settings.happyHourConfig?.title ??
                              "Öğle Saatleri Happy Hour İndirimi",
                            startTime:
                              settings.happyHourConfig?.startTime ?? "14:00",
                            endTime:
                              settings.happyHourConfig?.endTime ?? "17:00",
                            discountPercent: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3 py-2 text-xs font-black border border-slate-200 rounded-xl"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      persistSettings(
                        settings,
                        "⏱️ Happy Hour saatlik indirim ayarları kaydedildi!"
                      )
                    }
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl cursor-pointer shrink-0"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            </div>

            {/* Sol: İndirim Kuponları & İlk Sipariş İndirimi */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-slate-900">
                      İndirim Kuponları & İlk Sipariş İndirimi
                    </h2>
                    <p className="text-xs text-slate-500">
                      GloriaFood tarzı otomatik ilk sipariş indirimi ve kupon
                      kodları
                    </p>
                  </div>
                </div>

                {/* İlk Sipariş Otomatik İndirim Oranı */}
                <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-extrabold text-emerald-900">
                      İlk Siparişe Özel Otomatik İndirim (%)
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      WhatsApp ile yeni üye olan müşterinin ilk siparişinde
                      otomatik düşülür (0 yaparsanız kapanır).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={settings.firstOrderDiscountPercent ?? 10}
                      onChange={(e) => {
                        const next = {
                          ...settings,
                          firstOrderDiscountPercent: Number(e.target.value),
                        };
                        persistSettings(
                          next,
                          "İlk sipariş indirim oranı güncellendi!"
                        );
                      }}
                      className="w-20 px-3 py-1.5 text-sm font-bold border border-emerald-300 rounded-xl bg-white text-center"
                    />
                    <span className="font-bold text-sm text-emerald-900">%</span>
                  </div>
                </div>

                {/* Yeni Kupon Ekleme Formu */}
                <form
                  onSubmit={handleAddCoupon}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
                >
                  <div className="text-xs font-bold text-slate-700">
                    + Yeni İndirim Kuponu Oluştur
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      placeholder="Kupon Kodu (Örn: YAZ20)"
                      value={newCouponCode}
                      onChange={(e) =>
                        setNewCouponCode(e.target.value.toUpperCase())
                      }
                      className="px-3 py-2 text-xs font-bold uppercase border border-slate-200 rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Açıklama (Örn: %20 Yaz İndirimi)"
                      value={newCouponTitle}
                      onChange={(e) => setNewCouponTitle(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <select
                      value={newCouponType}
                      onChange={(e) =>
                        setNewCouponType(
                          e.target.value as "percentage" | "fixed"
                        )
                      }
                      className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white font-semibold"
                    >
                      <option value="percentage">Yüzde (%)</option>
                      <option value="fixed">Sabit Tutar (₺)</option>
                    </select>
                    <input
                      type="number"
                      required
                      placeholder="Değer"
                      value={newCouponValue}
                      onChange={(e) =>
                        setNewCouponValue(Number(e.target.value))
                      }
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                    <input
                      type="number"
                      required
                      placeholder="Min. Sepet"
                      value={newCouponMinOrder}
                      onChange={(e) =>
                        setNewCouponMinOrder(Number(e.target.value))
                      }
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs transition"
                  >
                    Kuponu Ekle
                  </button>
                </form>

                {/* Mevcut Kuponlar Listesi */}
                <div className="divide-y divide-slate-100">
                  {(settings.coupons || []).map((cp) => (
                    <div
                      key={cp.id}
                      className="py-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md">
                            {cp.code}
                          </span>
                          <span className="font-bold text-sm text-slate-800">
                            {cp.discountType === "percentage" ||
                            (cp.discountType as string) === "percent"
                              ? `%${cp.discountValue} İndirim`
                              : `${cp.discountValue} ${settings.currency} İndirim`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {cp.title} • Min. Sepet: {cp.minOrderAmount}{" "}
                          {settings.currency}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const updated = (settings.coupons || []).map((c) =>
                              c.id === cp.id ? { ...c, active: !c.active } : c
                            );
                            persistSettings({ ...settings, coupons: updated });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            cp.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {cp.active ? "Aktif" : "Pasif"}
                        </button>
                        <button
                          onClick={() => {
                            const updated = (settings.coupons || []).filter(
                              (c) => c.id !== cp.id
                            );
                            persistSettings(
                              { ...settings, coupons: updated },
                              "Kupon silindi."
                            );
                          }}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sağ: Mahalle / Teslimat Bölgeleri Yönetimi */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-slate-900">
                      Mahalle / Teslimat Bölgeleri Yönetimi
                    </h2>
                    <p className="text-xs text-slate-500">
                      Her mahalle için farklı minimum paket tutarı ve getirme
                      ücreti belirleyin
                    </p>
                  </div>
                </div>

                {/* Yeni Bölge Ekleme Formu */}
                <form
                  onSubmit={handleAddZone}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3"
                >
                  <div className="text-xs font-bold text-slate-700">
                    + Yeni Mahalle / Teslimat Bölgesi Ekle
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      placeholder="Mahalle / Bölge Adı (Örn: Cumhuriyet Mah.)"
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Tahmini Süre (Örn: 25-35 dk)"
                      value={newZoneMinutes}
                      onChange={(e) => setNewZoneMinutes(e.target.value)}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        Min. Paket Tutarı ({settings.currency})
                      </label>
                      <input
                        type="number"
                        required
                        value={newZoneMinAmount}
                        onChange={(e) =>
                          setNewZoneMinAmount(Number(e.target.value))
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        Getirme Ücreti ({settings.currency})
                      </label>
                      <input
                        type="number"
                        required
                        value={newZoneFee}
                        onChange={(e) => setNewZoneFee(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg text-xs transition"
                  >
                    Teslimat Bölgesini Ekle
                  </button>
                </form>

                {/* Mevcut Bölgeler Listesi */}
                <div className="divide-y divide-slate-100">
                  {(settings.deliveryZones || []).map((z) => (
                    <div
                      key={z.id}
                      className="py-3 flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-900">
                          {z.name}
                        </div>
                        <p className="text-xs text-slate-500">
                          Min. Sepet:{" "}
                          <strong className="text-slate-700">
                            {z.minAmount} {settings.currency}
                          </strong>{" "}
                          • Getirme Ücreti:{" "}
                          <strong className="text-slate-700">
                            {z.deliveryFee === 0
                              ? "Ücretsiz"
                              : `${z.deliveryFee} ${settings.currency}`}
                          </strong>{" "}
                          • {z.estimatedMinutes}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const updated = (settings.deliveryZones || []).map(
                              (item) =>
                                item.id === z.id
                                  ? { ...item, active: !item.active }
                                  : item
                            );
                            persistSettings({
                              ...settings,
                              deliveryZones: updated,
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            z.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {z.active ? "Aktif" : "Pasif"}
                        </button>
                        <button
                          onClick={() => {
                            const updated = (
                              settings.deliveryZones || []
                            ).filter((item) => item.id !== z.id);
                            persistSettings(
                              { ...settings, deliveryZones: updated },
                              "Bölge silindi."
                            );
                          }}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 🎁 İSTEĞE BAĞLI MÜŞTERİ SADAKAT & PARA PUAN (CÜZDAN) SİSTEMİ */}
            <div className="lg:col-span-12 bg-white p-6 rounded-2xl border border-amber-200 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-extrabold text-base text-slate-900">
                        🎁 Müşteri Sadakat & Para Puan (Cüzdan) Sistemi
                      </h2>
                      <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        İsteğe Bağlı Modül
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      İsterseniz tek tıkla açıp kapatabilirsiniz. Açık olduğunda müşteriler her siparişte belirlediğiniz oranda (Örn: %5) TL Para Puan kazanır ve sonraki siparişlerinde isterlerse cüzdanlarından harcayabilirler.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const current = settings.loyaltyConfig || {
                      enabled: false,
                      earnPercent: 5,
                      minRedeemPoints: 20,
                    };
                    persistSettings(
                      {
                        ...settings,
                        loyaltyConfig: {
                          ...current,
                          enabled: !current.enabled,
                        },
                      },
                      !current.enabled
                        ? "🎁 Sadakat & Para Puan Sistemi AKTİF EDİLDİ!"
                        : "Sadakat & Para Puan Sistemi KAPATILDI (Devre Dışı)"
                    );
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    settings.loyaltyConfig?.enabled
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                  }`}
                >
                  {settings.loyaltyConfig?.enabled
                    ? "🟢 Para Puan Sistemi: AÇIK (Aktif)"
                    : "⚪ Para Puan Sistemi: KAPALI (İsteğe Bağlı Aç)"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Siparişten Kazanılacak Para Puan Oranı (%)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.loyaltyConfig?.earnPercent ?? 5}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        loyaltyConfig: {
                          enabled: Boolean(settings.loyaltyConfig?.enabled),
                          earnPercent: Number(e.target.value),
                          minRedeemPoints:
                            settings.loyaltyConfig?.minRedeemPoints ?? 20,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-bold border border-slate-200 rounded-xl bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Örn: %5 seçilirse 400 TL siparişte müşterinin cüzdanına 20 TL Para Puan yüklenir.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimum Harcanabilir Puan Alt Limiti ({settings.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={settings.loyaltyConfig?.minRedeemPoints ?? 20}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        loyaltyConfig: {
                          enabled: Boolean(settings.loyaltyConfig?.enabled),
                          earnPercent:
                            settings.loyaltyConfig?.earnPercent ?? 5,
                          minRedeemPoints: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-bold border border-slate-200 rounded-xl bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Müşterinin biriken puanını sepette kullanabilmesi için gereken minimum bakiye.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      persistSettings(
                        settings,
                        "Sadakat & Para Puan ayarları kaydedildi!"
                      )
                    }
                    className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Para Puan Ayarlarını Kaydet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1.8. MÜŞTERİLER & WHATSAPP TOPLU KAMPANYA / GERİ KAZANIM (CRM) SEKMESİ */}
        {activeTab === "crm" && settings && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sol: Toplu WhatsApp Kampanya Gönderici */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 space-y-4 self-start">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-slate-900">
                    WhatsApp Toplu Kampanya & Geri Kazanım
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kayıtlı müşterilerinize isme özel ({`{isim}`}) toplu veya tekil WhatsApp mesajı gönderin
                  </p>
                </div>
              </div>

              {/* Hazır Kampanya Şablonları */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-500">
                  Tek Tıkla Hazır Mesaj Şablonu Seç:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCampaignMessage(
                        "Merhaba {isim} 👋 Sizi özledik! Bugün vereceğiniz siparişte geçerli %15 indirim kuponunuz: MERHABA50 🎁 Sıcak lezzetlerimiz için hemen sipariş verebilirsiniz!"
                      )
                    }
                    className="text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    💌 Özledik (%15 Kupon)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCampaignMessage(
                        "Merhaba {isim} 🔥 Öğle & Akşam servisimiz başladı! Tüm ızgara ve kebap menülerimizde bugün ücretsiz Yayık Ayran ikramımız var. Afiyet olsun!"
                      )
                    }
                    className="text-[11px] font-bold bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    🔥 Günün Menüsü / İkram
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCampaignMessage(
                        "Değerli müşterimiz {isim} 🌟 VIP müşterilerimize özel cüzdanınıza hediye Para Puan tanımlanmıştır. İlk siparişinizde keyifle kullanabilirsiniz!"
                      )
                    }
                    className="text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    🎁 VIP Para Puan Müjdesi
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kampanya Mesajı ({`{isim}`} otomatik müşteri adıyla değişir)
                </label>
                <textarea
                  rows={4}
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50"
                />
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>Seçili Hedef Kitle:</span>
                  <span className="text-emerald-700">
                    {selectedCrmPhones.length > 0
                      ? `Özel Seçilen (${selectedCrmPhones.length} Kişi)`
                      : crmSegment === "vip"
                      ? `VIP Müşteriler (${filteredCrmCustomers.length} Kişi)`
                      : crmSegment === "inactive"
                      ? `15+ Gündür Sipariş Vermeyen (${filteredCrmCustomers.length} Kişi)`
                      : `Tüm Müşteriler (${filteredCrmCustomers.length} Kişi)`}
                  </span>
                </div>
                {selectedCrmPhones.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCrmPhones([])}
                    className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer"
                  >
                    Seçimi Temizle (Tüm Segmente Dön)
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={sendingCampaign || filteredCrmCustomers.length === 0}
                onClick={() => handleSendBulkCampaign()}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#075E54] hover:bg-[#064e46] disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-xs transition cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>
                  {sendingCampaign
                    ? "WhatsApp Mesajları Gönderiliyor..."
                    : "Seçili Müşterilere WhatsApp Kampanyasını Gönder"}
                </span>
              </button>
            </div>

            {/* Sağ: Müşteri Segmentleri, Sipariş Özeti ve Cüzdan Puan Yönetimi */}
            <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Müşteri Veritabanı & Sadakat Cüzdanı ({filteredCrmCustomers.length} Kişi)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sipariş sıklığına göre filtreleyin, tek tıkla WhatsApp gönderin veya hediye Para Puan ekleyin
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCrmSegment("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      crmSegment === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    Tümü ({crmCustomers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrmSegment("vip")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      crmSegment === "vip"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    ⭐ VIP ({crmCustomers.filter((c) => c.isVip).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrmSegment("inactive")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      crmSegment === "inactive"
                        ? "bg-rose-600 text-white"
                        : "bg-rose-50 text-rose-800"
                    }`}
                  >
                    ⏰ Özledik 15+ Gün (
                    {crmCustomers.filter((c) => c.isInactive15Days).length})
                  </button>
                </div>
              </div>

              {filteredCrmCustomers.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  Bu segmentte müşteri bulunmuyor.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto pr-1">
                  {filteredCrmCustomers.map((cust) => {
                    const isChecked = selectedCrmPhones.includes(cust.phone);
                    return (
                      <div
                        key={cust.phone}
                        className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCrmPhones([
                                  ...selectedCrmPhones,
                                  cust.phone,
                                ]);
                              } else {
                                setSelectedCrmPhones(
                                  selectedCrmPhones.filter(
                                    (p) => p !== cust.phone
                                  )
                                );
                              }
                            }}
                            className="mt-1 w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-sm text-slate-900">
                                {cust.name}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-500">
                                +{cust.phone}
                              </span>
                              {cust.isVip && (
                                <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                  ⭐ VIP
                                </span>
                              )}
                              {cust.isInactive15Days && (
                                <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                                  {cust.daysSinceLastOrder} gündür yok
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Toplam{" "}
                              <strong className="text-slate-800">
                                {cust.orderCount} sipariş
                              </strong>{" "}
                              • Harcama:{" "}
                              <strong className="text-emerald-700">
                                {cust.totalSpent.toFixed(2)} {settings.currency}
                              </strong>{" "}
                              • Cüzdan Puanı:{" "}
                              <strong className="text-amber-700">
                                {cust.loyaltyPoints.toFixed(2)}{" "}
                                {settings.currency}
                              </strong>
                            </div>
                            {cust.address && (
                              <div className="text-[11px] text-slate-400 truncate max-w-md">
                                📍 {cust.address}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleAdjustCustomerPoints(cust.phone, 25)
                            }
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer"
                            title="Müşteriye +25 TL Hediye Para Puan Ekle"
                          >
                            +25₺ Puan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendBulkCampaign([cust])}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>Tekil Gönder</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. WHATSAPP OTP & ÜYELİK YÖNETİMİ */}
        {activeTab === "whatsapp" && settings && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sol: WhatsApp Bağlantı & Doğrulama Ayarları */}
            <div className="lg:col-span-6 space-y-6">
              <form
                onSubmit={handleSaveSettings}
                className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#25D366] text-slate-950 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-slate-900">
                      WhatsApp Doğrulama Kodu (OTP) Ayarları
                    </h2>
                    <p className="text-xs text-slate-500">
                      Ücretsiz kendi numaranızla veya Meta Cloud API ile gönderim
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Gönderim Yöntemi (Provider)
                  </label>
                  <select
                    value={waConfig.provider}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        whatsappConfig: {
                          ...waConfig,
                          provider: e.target.value as
                            | "simulation"
                            | "custom_gateway"
                            | "meta_cloud",
                        },
                      })
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white font-semibold"
                  >
                    <option value="simulation">
                      Simülasyon / Ekranda Canlı Test Modu (Anında Test İçin)
                    </option>
                    <option value="custom_gateway">
                      Kendi WhatsApp Numaramla Ücretsiz Gönderim (QR Köprü Servisi)
                    </option>
                    <option value="meta_cloud">
                      Resmi Meta WhatsApp Business Cloud API
                    </option>
                  </select>
                </div>

                {waConfig.provider === "custom_gateway" && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#075E54]">
                      <Terminal className="w-4 h-4" />
                      <span>
                        Kendi Numaranızı QR Kod İle Ücretsiz Bağlama Rehberi
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Proje klasörünüzde hazır bulunan{" "}
                      <code className="bg-white px-1.5 py-0.5 rounded border">
                        whatsapp-bridge.mjs
                      </code>{" "}
                      dosyasını çalıştırarak kendi telefonunuzdaki WhatsApp
                      uygulamasından QR kodu okutabilirsiniz:
                    </p>
                    <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-[11px] overflow-x-auto">
                      {`npm install @whiskeysockets/baileys qrcode-terminal pino\nnode whatsapp-bridge.mjs`}
                    </pre>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Yerel veya Uzak QR Köprü URL&apos;si
                      </label>
                      <input
                        type="text"
                        value={waConfig.gatewayUrl}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            whatsappConfig: {
                              ...waConfig,
                              gatewayUrl: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                )}

                {waConfig.provider === "meta_cloud" && (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Meta Phone Number ID
                      </label>
                      <input
                        type="text"
                        placeholder="Örn: 10492839102938"
                        value={waConfig.metaPhoneNumberId}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            whatsappConfig: {
                              ...waConfig,
                              metaPhoneNumberId: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Meta Permanent Access Token
                      </label>
                      <input
                        type="password"
                        placeholder="EAAG..."
                        value={waConfig.metaAccessToken}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            whatsappConfig: {
                              ...waConfig,
                              metaAccessToken: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2.5 pt-2">
                  <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waConfig.requireAuthForDeliveryAndPickup}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsappConfig: {
                            ...waConfig,
                            requireAuthForDeliveryAndPickup: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-[#075E54]"
                    />
                    <span>
                      Paket Servis ve Gel-Al siparişlerinde WhatsApp üyelik
                      doğrulaması zorunlu olsun (Masada QR siparişte isteğe bağlı)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waConfig.sendOrderUpdates}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          whatsappConfig: {
                            ...waConfig,
                            sendOrderUpdates: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-[#075E54]"
                    />
                    <span>
                      Sipariş mutfakta onaylandığında ve yola çıktığında
                      müşteriye otomatik WhatsApp durum mesajı gönder
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-[#075E54] hover:bg-[#064e46] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition"
                >
                  <Save className="w-4 h-4" />
                  WhatsApp Ayarlarını Kaydet
                </button>
              </form>

              {/* Kayıtlı Üyeler Listesi */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-600" />
                    WhatsApp Doğrulamalı Kayıtlı Üyeler ({users.length})
                  </h3>
                </div>

                {users.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Henüz WhatsApp ile kayıt olmuş müşteri bulunmuyor. Müşteri
                    ekranından ilk girişi yaparak test edebilirsiniz.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {users.map((u) => (
                      <div key={u.id} className="py-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900">
                            {u.name}
                          </span>
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                            +{u.phone}
                          </span>
                        </div>
                        {u.addresses.length > 0 && (
                          <p className="text-xs text-slate-500">
                            📍 {u.addresses[0].fullAddress}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sağ: Gönderilen WhatsApp Mesaj Logları */}
            <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 space-y-4 self-start">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Gönderilen WhatsApp Mesaj Geçmişi
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gönderilen 6 haneli doğrulama kodları ve sipariş durumu
                    mesajları
                  </p>
                </div>
                <button
                  onClick={loadData}
                  className="text-xs font-bold text-orange-600 hover:underline"
                >
                  Yenile
                </button>
              </div>

              {waLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  Henüz gönderilmiş WhatsApp mesajı yok.
                </p>
              ) : (
                <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                  {waLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          Alıcı: +{log.phone}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.type === "otp"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {log.type === "otp"
                              ? "Doğrulama Kodu"
                              : "Sipariş Bildirimi"}
                          </span>
                          <span className="text-slate-400">
                            {new Date(log.createdAt).toLocaleTimeString(
                              "tr-TR",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="bg-[#DCF8C6] text-slate-900 p-2.5 rounded-lg text-xs whitespace-pre-line font-medium">
                        {log.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. MASA YÖNETİMİ, İSİM DÜZENLEME, SAMBAPOS EŞİTLEME & QR KOD ÜRETİCİ */}
        {activeTab === "qr" && (
          <div className="space-y-6">
            {/* Üst Başlık ve SambaPOS / Yazdırma Hızlı İşlemler */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 print:hidden">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="bg-orange-600 text-white font-black text-xs px-3 py-1 rounded-xl">
                    {getRestaurantTables(settings).length} MASA AKTİF
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    🪑 Masa Yönetimi, İsim Düzenleme & QR Kodlar
                  </h2>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Masaları tek tek veya seri halinde ekleyin, masa isimlerini (Örn:{" "}
                  <strong className="text-slate-700">B10, M10, Bahçe 1, Teras 2, Masa 1</strong>
                  ) düzenleyin veya silin. Değişiklikler Müşteri Ekranı, Garson El Terminali, Canlı Mutfak/Kasa ve{" "}
                  <strong className="text-indigo-600">SambaPOS</strong> ile anında eşitlenir.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={tableSyncLoading}
                  onClick={handleImportTablesFromSamba}
                  className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                  title="SambaPOS'taki mevcut masaları (B10..B30, M10..M30 vb.) çekip siteye kaydeder"
                >
                  <RefreshCw className={`w-4 h-4 text-indigo-600 ${tableSyncLoading ? "animate-spin" : ""}`} />
                  📥 SambaPOS&apos;taki Masaları Siteye Çek
                </button>
                <button
                  type="button"
                  disabled={tableSyncLoading}
                  onClick={() =>
                    handleSaveTablesAndSync(
                      getRestaurantTables(settings),
                      "Sitedeki masalar SambaPOS'a aktarıldı ve eşitlendi!",
                      undefined,
                      true
                    )
                  }
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                  title="Sitedeki masa listesini SambaPOS'a gönderir; yeni masaları açar, silinenleri kaldırır"
                >
                  <Upload className="w-4 h-4" />
                  📤 Sitedeki Masaları SambaPOS&apos;a Aktar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintingZReport(false);
                    setSelectedOrderForPrint(null);
                    setTimeout(() => window.print(), 100);
                  }}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-orange-400" />
                  Tüm QR Kartlarını Yazdır
                </button>
              </div>
            </div>

            {tableSyncStatus && (
              <div
                className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 print:hidden ${
                  tableSyncStatus.ok
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-red-50 border-red-200 text-red-900"
                }`}
              >
                <span>
                  {tableSyncStatus.ok ? "✅ " : "⚠️ "}
                  {tableSyncStatus.message}
                </span>
                <button
                  type="button"
                  onClick={() => setTableSyncStatus(null)}
                  className="text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded font-extrabold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Masa Ekleme, Toplu Seri Oluşturma ve Hazır Şablonlar Paneli */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:hidden">
              {/* 1. Tek Masa Ekle */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    ➕ Tek Masa Ekle
                  </h3>
                  <span className="text-[10px] font-bold bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
                    Özel İsim Desteği
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  İstediğiniz isimde masa ekleyebilirsiniz (Örn:{" "}
                  <strong>Bahçe 1, B10, M15, Teras 3, VIP 1, Köşe Masa</strong>).
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const clean = newTableName.trim();
                    if (!clean) return;
                    const current = getRestaurantTables(settings);
                    if (current.some((t) => isSameTableName(t, clean))) {
                      alert(`"${clean}" isimli masa zaten listede mevcut!`);
                      return;
                    }
                    setNewTableName("");
                    await handleSaveTablesAndSync(
                      [...current, clean],
                      `"${formatTableLabel(clean)}" masası eklendi!`
                    );
                  }}
                  className="flex items-center gap-2 pt-1"
                >
                  <input
                    type="text"
                    placeholder="Örn: Bahçe 1, B10, Teras 2..."
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-orange-500 outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Masa Ekle
                  </button>
                </form>
              </div>

              {/* 2. Toplu / Seri Masa Oluşturucu */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    ⚡ Toplu / Seri Masa Ekle
                  </h3>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                    B10..B30 / Masa 1..20
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Ön Ek (B, M, Bahçe...)
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: B veya Masa "
                      value={bulkTablePrefix}
                      onChange={(e) => setBulkTablePrefix(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Başlangıç No
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={bulkTableStart}
                      onChange={(e) => setBulkTableStart(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">
                      Bitiş No
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={bulkTableEnd}
                      onChange={(e) => setBulkTableEnd(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const start = Math.min(bulkTableStart, bulkTableEnd);
                      const end = Math.max(bulkTableStart, bulkTableEnd);
                      if (end - start > 200) {
                        alert("Tek seferde en fazla 200 masa oluşturabilirsiniz.");
                        return;
                      }
                      const generated: string[] = [];
                      for (let i = start; i <= end; i++) {
                        generated.push(`${bulkTablePrefix}${i}`.trim());
                      }
                      const current = getRestaurantTables(settings);
                      await handleSaveTablesAndSync(
                        [...current, ...generated],
                        `${generated.length} adet masa (${generated[0]}..${generated[generated.length - 1]}) listeye eklendi!`
                      );
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold py-2 px-3 rounded-xl transition cursor-pointer"
                  >
                    + Mevcut Masalara Ekle ({bulkTablePrefix}
                    {bulkTableStart}..{bulkTablePrefix}
                    {bulkTableEnd})
                  </button>
                </div>
              </div>

              {/* 3. Hızlı Şablonlar & Arama */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    🔍 Masa Ara & Hızlı Şablonlar
                  </h3>
                  <input
                    type="text"
                    placeholder="Masa ara... (Örn: B10, M20, Bahçe)"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-900 focus:border-orange-500 outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Mevcut masa listesi sıfırlanıp B10..B30 ve M10..M30 (42 Masa) şablonu yüklensin mi?"
                        )
                      )
                        return;
                      const bSeries = Array.from(
                        { length: 21 },
                        (_, i) => `B${10 + i}`
                      );
                      const mSeries = Array.from(
                        { length: 21 },
                        (_, i) => `M${10 + i}`
                      );
                      await handleSaveTablesAndSync(
                        [...bSeries, ...mSeries],
                        "B10..B30 ve M10..M30 masa düzeni kaydedildi!"
                      );
                    }}
                    className="text-[11px] font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    ⚡ Şablon: B10..B30 + M10..M30
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Mevcut masa listesi sıfırlanıp standart Masa 1..15 düzenine dönülsün mü?"
                        )
                      )
                        return;
                      const std = Array.from({ length: 15 }, (_, i) =>
                        String(i + 1)
                      );
                      await handleSaveTablesAndSync(
                        std,
                        "Masa 1..15 standart düzeni kaydedildi!"
                      );
                    }}
                    className="text-[11px] font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    ⚡ Şablon: Masa 1..15
                  </button>
                </div>
              </div>
            </div>

            {/* Masa Listesi ve QR Kartları Grid */}
            <div
              id="printable-qr-grid"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
            >
              {getRestaurantTables(settings)
                .filter((tableNum) => {
                  if (!tableSearchQuery.trim()) return true;
                  const q = tableSearchQuery.trim().toLocaleLowerCase("tr-TR");
                  return (
                    tableNum.toLocaleLowerCase("tr-TR").includes(q) ||
                    formatTableLabel(tableNum)
                      .toLocaleLowerCase("tr-TR")
                      .includes(q)
                  );
                })
                .map((tableNum) => {
                  const allTables = getRestaurantTables(settings);
                  const realIdx = allTables.indexOf(tableNum);
                  const isEditingThis = editingTableOldName === tableNum;
                  const tableUrl = `${originUrl}/?masa=${encodeURIComponent(
                    tableNum
                  )}`;
                  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                    tableUrl
                  )}`;

                  return (
                    <div
                      key={tableNum}
                      className="bg-white border border-slate-200 hover:border-orange-300 rounded-2xl p-4 text-center space-y-2.5 shadow-xs transition flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        {/* Üst Sıra No & Sıralama / Düzenleme / Silme Butonları */}
                        <div className="flex items-center justify-between gap-1 print:hidden">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={realIdx <= 0}
                              onClick={async () => {
                                if (realIdx <= 0) return;
                                const next = [...allTables];
                                const tmp = next[realIdx - 1];
                                next[realIdx - 1] = next[realIdx];
                                next[realIdx] = tmp;
                                await handleSaveTablesAndSync(
                                  next,
                                  `"${formatTableLabel(tableNum)}" sırası taşındı.`
                                );
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded disabled:opacity-30 cursor-pointer"
                              title="Sola / Öne Taşı"
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              disabled={
                                realIdx === -1 || realIdx >= allTables.length - 1
                              }
                              onClick={async () => {
                                if (
                                  realIdx === -1 ||
                                  realIdx >= allTables.length - 1
                                )
                                  return;
                                const next = [...allTables];
                                const tmp = next[realIdx + 1];
                                next[realIdx + 1] = next[realIdx];
                                next[realIdx] = tmp;
                                await handleSaveTablesAndSync(
                                  next,
                                  `"${formatTableLabel(tableNum)}" sırası taşındı.`
                                );
                              }}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded disabled:opacity-30 cursor-pointer"
                              title="Sağa / Arkaya Taşı"
                            >
                              ▶
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTableOldName(tableNum);
                                setEditingTableNewName(tableNum);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-extrabold border border-blue-200 cursor-pointer"
                              title="Masa Adını Düzenle"
                            >
                              <Edit3 className="w-3 h-3" />
                              Düzenle
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (allTables.length <= 1) {
                                  alert("En az 1 masa kalmalıdır.");
                                  return;
                                }
                                if (
                                  !confirm(
                                    `"${formatTableLabel(
                                      tableNum
                                    )}" masasını silmek istediğinize emin misiniz?`
                                  )
                                )
                                  return;
                                const next = allTables.filter(
                                  (t) => t !== tableNum
                                );
                                await handleSaveTablesAndSync(
                                  next,
                                  `"${formatTableLabel(tableNum)}" masası silindi.`
                                );
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-[10px] font-extrabold border border-red-200 cursor-pointer"
                              title="Masayı Sil"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Masa İsmi Gösterimi veya Düzenleme Kutusu */}
                        {isEditingThis ? (
                          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2 space-y-2 print:hidden">
                            <input
                              type="text"
                              autoFocus
                              value={editingTableNewName}
                              onChange={(e) =>
                                setEditingTableNewName(e.target.value)
                              }
                              placeholder="Yeni masa adı..."
                              className="w-full px-2.5 py-1.5 text-xs font-extrabold text-slate-900 bg-white border border-blue-300 rounded-lg text-center outline-none"
                            />
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  const cleanNew = editingTableNewName.trim();
                                  if (!cleanNew) return;
                                  if (cleanNew === tableNum) {
                                    setEditingTableOldName(null);
                                    return;
                                  }
                                  if (
                                    allTables.some(
                                      (t) =>
                                        t !== tableNum &&
                                        isSameTableName(t, cleanNew)
                                    )
                                  ) {
                                    alert(
                                      `"${cleanNew}" isimli bir masa zaten var!`
                                    );
                                    return;
                                  }
                                  const next = allTables.map((t) =>
                                    t === tableNum ? cleanNew : t
                                  );
                                  setEditingTableOldName(null);
                                  await handleSaveTablesAndSync(
                                    next,
                                    `Masa adı "${tableNum}" -> "${cleanNew}" olarak güncellendi!`,
                                    { [tableNum]: cleanNew }
                                  );
                                }}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-extrabold py-1 px-2 rounded-lg cursor-pointer"
                              >
                                Kaydet
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTableOldName(null)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-extrabold py-1 px-2 rounded-lg cursor-pointer"
                              >
                                İptal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="inline-block bg-orange-100 text-orange-800 font-extrabold text-xs px-3 py-1 rounded-full">
                            {formatTableLabel(tableNum).toLocaleUpperCase("tr-TR")}
                          </div>
                        )}

                        <div className="w-36 h-36 mx-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <img
                            src={qrImgUrl}
                            alt={`${formatTableLabel(tableNum)} QR`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 truncate">
                          ?masa={tableNum}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Sipariş Ver • Garson Çağır • Hesap İste
                        </p>
                      </div>

                      <Link
                        href={`/?masa=${encodeURIComponent(tableNum)}`}
                        target="_blank"
                        className="inline-flex items-center justify-center gap-1 text-xs font-bold text-orange-600 hover:underline print:hidden pt-1"
                      >
                        <span>Simüle Et</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 4. WEB SİTESİNE GÖMME (GLORIAFOOD WIDGET KODU) */}
        {activeTab === "widget" && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">
                Mevcut Web Sitenize &ldquo;Online Sipariş Ver&rdquo; Butonu Ekleyin
              </h2>
              <p className="text-sm text-slate-600">
                GloriaFood&apos;da olduğu gibi, kendi tanıtım sitenize (WordPress,
                Wix veya özel HTML) aşağıdaki kodu yapıştırarak müşterilerinizin
                sitenizden ayrılmadan sipariş vermesini sağlayabilirsiniz.
              </p>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-slate-500">
                  1. Doğrudan Iframe Gömme Kodu (Tam Sayfa Menü)
                </label>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs overflow-x-auto">
                  {`<iframe 
  src="${originUrl}/?embed=1" 
  width="100%" 
  height="850" 
  style="border:none; border-radius: 16px;"
  title="Online Menü ve Sipariş"
></iframe>`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 4.5. NETLIFY MÜŞTERİ VİTRİNİ & TURSO BULUT SENKRONİZASYON */}
        {activeTab === "cloud" && settings && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold">
                      Müşteri Kısmı Netlify&apos;da (7/24 Yayında) • Admin & Mutfak Yerelde
                    </h2>
                    <p className="text-xs text-teal-200">
                      Netlify&apos;da yalnızca müşteri sipariş ekranı çalışır (/admin ve /kitchen otomatik gizlenir ve kilitlenir). Siparişler bulut veritabanı üzerinden anında yerel bilgisayarınıza düşer.
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                    settings.cloudSyncConfig?.enabled
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-400/30"
                  }`}
                >
                  {settings.cloudSyncConfig?.enabled
                    ? "🟢 Bulut Senkronizasyon AKTİF"
                    : "⚪ Bulut Senkronizasyon KAPALI (Sadece Yerel)"}
                </span>
              </div>
            </div>

            {/* Turso Bulut Veritabanı ve Netlify URL Ayar Formu */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    1. Bulut Veritabanı (Turso SQLite) & Netlify Bağlantı Ayarları
                  </h3>
                  <p className="text-xs text-slate-500">
                    Yerel bilgisayarınızdaki Admin/Mutfak ile Netlify&apos;daki müşteri sayfasının aynı sipariş ve menü verilerini paylaşmasını sağlar.
                  </p>
                </div>

                <label className="inline-flex items-center gap-2.5 bg-slate-100 px-3.5 py-2 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.cloudSyncConfig?.enabled)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cloudSyncConfig: {
                          enabled: e.target.checked,
                          tursoUrl: settings.cloudSyncConfig?.tursoUrl || "",
                          tursoAuthToken:
                            settings.cloudSyncConfig?.tursoAuthToken || "",
                          publicStorefrontUrl:
                            settings.cloudSyncConfig?.publicStorefrontUrl || "",
                          lastSyncedAt: settings.cloudSyncConfig?.lastSyncedAt,
                        },
                      })
                    }
                    className="w-4 h-4 accent-teal-600 rounded"
                  />
                  <span className="text-xs font-extrabold text-slate-800">
                    Bulut Senkronizasyonu Etkinleştir
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Canlı Müşteri Sipariş Adresi (Netlify URL) — Masa QR ve Widget İçin
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                    <input
                      type="url"
                      placeholder="Örn: https://meshur-kebapci.netlify.app"
                      value={
                        settings.cloudSyncConfig?.publicStorefrontUrl || ""
                      }
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          cloudSyncConfig: {
                            enabled: Boolean(settings.cloudSyncConfig?.enabled),
                            tursoUrl: settings.cloudSyncConfig?.tursoUrl || "",
                            tursoAuthToken:
                              settings.cloudSyncConfig?.tursoAuthToken || "",
                            publicStorefrontUrl: e.target.value,
                            lastSyncedAt:
                              settings.cloudSyncConfig?.lastSyncedAt,
                          },
                        })
                      }
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Buraya Netlify sitenizin adresini yazdığınızda &ldquo;Masa QR Kodları&rdquo; ve &ldquo;Web Sitesi Widget&rdquo; sekmelerindeki bağlantılar otomatik olarak bu canlı adresi kullanır.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Turso Veritabanı URL (TURSO_DATABASE_URL) *
                  </label>
                  <input
                    type="text"
                    placeholder="libsql://restoran-siparis-kullanici.turso.io"
                    value={settings.cloudSyncConfig?.tursoUrl || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cloudSyncConfig: {
                          enabled: Boolean(settings.cloudSyncConfig?.enabled),
                          tursoUrl: e.target.value,
                          tursoAuthToken:
                            settings.cloudSyncConfig?.tursoAuthToken || "",
                          publicStorefrontUrl:
                            settings.cloudSyncConfig?.publicStorefrontUrl || "",
                          lastSyncedAt: settings.cloudSyncConfig?.lastSyncedAt,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Turso Yetki Anahtarı (TURSO_AUTH_TOKEN) *
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJFZERTQSI..."
                    value={settings.cloudSyncConfig?.tursoAuthToken || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cloudSyncConfig: {
                          enabled: Boolean(settings.cloudSyncConfig?.enabled),
                          tursoUrl: settings.cloudSyncConfig?.tursoUrl || "",
                          tursoAuthToken: e.target.value,
                          publicStorefrontUrl:
                            settings.cloudSyncConfig?.publicStorefrontUrl || "",
                          lastSyncedAt: settings.cloudSyncConfig?.lastSyncedAt,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              {cloudSyncStatus && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-bold border ${
                    cloudSyncStatus.ok
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  {cloudSyncStatus.message}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={cloudSyncing}
                    onClick={async () => {
                      if (!settings) return;
                      setCloudSyncing(true);
                      setCloudSyncStatus(null);
                      try {
                        await persistSettings(
                          settings,
                          "Bulut ayarları kaydedildi!"
                        );
                        const res = await fetch("/api/cloud-sync", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            cloudSyncConfig: settings.cloudSyncConfig,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setCloudSyncStatus({
                            ok: false,
                            message:
                              data.error || "Bulut bağlantısı başarısız oldu.",
                          });
                        } else {
                          setSettings(data.settings);
                          setCloudSyncStatus({
                            ok: true,
                            message:
                              data.message ||
                              "Turso Bulut bağlantısı başarılı ve tüm veriler senkronize edildi!",
                          });
                          loadData();
                        }
                      } catch {
                        setCloudSyncStatus({
                          ok: false,
                          message: "Sunucu ile bağlantı kurulamadı.",
                        });
                      } finally {
                        setCloudSyncing(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-3 rounded-xl transition cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${cloudSyncing ? "animate-spin" : ""}`}
                    />
                    <span>
                      {cloudSyncing
                        ? "Bulut İle Senkronize Ediliyor..."
                        : "Kaydet & Şimdi Bulutla Senkronize Et"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      persistSettings(settings, "Ayarlar kaydedildi!")
                    }
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-3 rounded-xl transition cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Sadece Kaydet</span>
                  </button>
                </div>

                {settings.cloudSyncConfig?.lastSyncedAt && (
                  <span className="text-[11px] text-slate-500">
                    Son Senkronizasyon:{" "}
                    <strong>
                      {new Date(
                        settings.cloudSyncConfig.lastSyncedAt
                      ).toLocaleString("tr-TR")}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {/* Adım Adım Kurulum Rehberi (Turso + GitHub + Netlify) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-5">
              <h3 className="text-base font-bold text-slate-900">
                2. Adım Adım Kurulum Rehberi (GitHub + Turso + Netlify)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="inline-block bg-teal-100 text-teal-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                    ADIM 1 • ÜCRETSİZ BULUT DB
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">
                    Turso.tech Hesabı Açın
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>turso.tech</strong> adresinden ücretsiz giriş yapın,{" "}
                    <strong>Create Database</strong> ile bir veritabanı oluşturun ve{" "}
                    <strong>Generate Token</strong> butonuna basarak{" "}
                    <code>libsql://...</code> adresini ve Token&apos;ı yukarıdaki kutulara yapıştırıp <strong>Kaydet & Senkronize Et</strong>&apos;e tıklayın.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="inline-block bg-orange-100 text-orange-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                    ADIM 2 • GITHUB YÜKLEME
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">
                    Projeyi GitHub&apos;a Gönderin
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    GitHub&apos;da yeni bir repo açın (Örn: <code>restoran-siparis</code>). Aşağıdaki hazır komutlarla projeyi GitHub&apos;a gönderin. <code>netlify.toml</code> dosyası içinde hazırdır.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <span className="inline-block bg-indigo-100 text-indigo-800 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                    ADIM 3 • NETLIFY YAYINLAMA
                  </span>
                  <h4 className="font-bold text-sm text-slate-900">
                    Netlify&apos;da Environment Ekleyin
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Netlify&apos;da <strong>Import from GitHub</strong> ile reponuzu seçin.{" "}
                    <strong>Environment Variables</strong> kısmına{" "}
                    <code>TURSO_DATABASE_URL</code>,{" "}
                    <code>TURSO_AUTH_TOKEN</code> ve{" "}
                    <code>NEXT_PUBLIC_CUSTOMER_ONLY=true</code> ekleyin.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-500">
                    GitHub&apos;a Yüklemek İçin Terminal Komutları
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `git init\ngit add .\ngit commit -m "Restoran siparis sistemi hazir"\ngit branch -M main\ngit remote add origin https://github.com/h716043/restoran-siparis.git\ngit push -u origin main`
                      );
                      showToast("GitHub komutları panoya kopyalandı!");
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:underline cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Komutları Kopyala
                  </button>
                </div>
                <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs overflow-x-auto font-mono">
                  {`git init
git add .
git commit -m "Restoran siparis sistemi hazir"
git branch -M main
git remote add origin https://github.com/h716043/restoran-siparis.git
git push -u origin main`}
                </pre>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-slate-500">
                  Netlify &rarr; Site Configuration &rarr; Environment Variables İçine Girilecek Değerler
                </label>
                <pre className="bg-slate-900 text-amber-300 p-4 rounded-xl text-xs overflow-x-auto font-mono">
                  {`NEXT_PUBLIC_CUSTOMER_ONLY=true
TURSO_DATABASE_URL=${settings.cloudSyncConfig?.tursoUrl || "libsql://veritabani-adiniz.turso.io"}
TURSO_AUTH_TOKEN=${settings.cloudSyncConfig?.tursoAuthToken ? "************************" : "eyJhbGciOi..."}`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 5. RESTORAN AYARLARI */}
        {activeTab === "settings" && settings && (
          <form
            onSubmit={handleSaveSettings}
            className="max-w-3xl bg-white p-6 rounded-2xl border border-slate-200 space-y-5"
          >
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Dükkan Saatleri, Genel Restoran & Güvenlik Ayarları
            </h2>

            {/* DÜKKAN AÇIK / KAPALI DURUMU & AÇILIŞ-KAPANIŞ SAATLERİ */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Dükkan Açık / Kapalı Durumu & Çalışma Saatleri
                    </h3>
                    <p className="text-xs text-slate-500">
                      Açılış ve kapanış saatlerini belirleyin veya dükkanı tek tıkla açıp kapatın
                    </p>
                  </div>
                </div>

                {/* Hızlı Açık / Kapalı Seçici */}
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, isOpen: true })}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      settings.isOpen
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🟢 Dükkan AÇIK
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, isOpen: false })}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      !settings.isOpen
                        ? "bg-red-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🔴 Dükkan KAPALI
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Açılış Saati
                  </label>
                  <input
                    type="time"
                    value={settings.openTime || "11:00"}
                    onChange={(e) => {
                      const nextOpen = e.target.value;
                      const nextClose = settings.closeTime || "23:30";
                      setSettings({
                        ...settings,
                        openTime: nextOpen,
                        openingHours: `${nextOpen} - ${nextClose}`,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm font-bold border border-slate-200 rounded-xl bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kapanış Saati
                  </label>
                  <input
                    type="time"
                    value={settings.closeTime || "23:30"}
                    onChange={(e) => {
                      const nextClose = e.target.value;
                      const nextOpen = settings.openTime || "11:00";
                      setSettings({
                        ...settings,
                        closeTime: nextClose,
                        openingHours: `${nextOpen} - ${nextClose}`,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm font-bold border border-slate-200 rounded-xl bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ekranda Görünecek Saat Metni
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 11:00 - 23:30"
                    value={settings.openingHours || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, openingHours: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 bg-white p-3 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.autoOpenCloseByHours)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      autoOpenCloseByHours: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-orange-600 rounded"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900">
                    Çalışma saatlerine göre otomatik Açık / Kapalı kontrolü yap
                  </span>
                  <span className="block text-slate-500">
                    İşaretlenirse belirlediğiniz açılış ({settings.openTime || "11:00"}) ve kapanış ({settings.closeTime || "23:30"}) saatleri dışında dükkan müşteri ekranında otomatik olarak &quot;Kapalı&quot; görünür.
                  </span>
                </div>
              </label>
            </div>

            {/* 🛵🛍️🪑 SİTEDE AKTİF SİPARİŞ TÜRLERİ SEÇİMİ (TEK MASA, TEK PAKET, TEK GEL-AL, İKİLİ VEYA TÜMÜ) */}
            {(() => {
              const currentTypes = getEnabledOrderTypes(settings);
              const applyOrderTypes = (
                nextTypes: OrderType[],
                toastLabel: string
              ) => {
                if (nextTypes.length === 0) {
                  alert("En az 1 sipariş türü aktif olmalıdır!");
                  return;
                }
                const nextSettings: RestaurantSettings = {
                  ...settings,
                  enabledOrderTypes: nextTypes,
                };
                setSettings(nextSettings);
                persistSettings(
                  nextSettings,
                  `✅ Sipariş Türü Güncellendi: ${toastLabel}`
                );
              };

              const toggleSingleType = (t: OrderType, label: string) => {
                const exists = currentTypes.includes(t);
                if (exists && currentTypes.length === 1) {
                  alert("En az 1 sipariş türü seçili kalmalıdır!");
                  return;
                }
                const next = exists
                  ? currentTypes.filter((x) => x !== t)
                  : [...currentTypes, t];
                applyOrderTypes(next, label);
              };

              const isExactMatch = (arr: OrderType[]) =>
                currentTypes.length === arr.length &&
                arr.every((x) => currentTypes.includes(x));

              const presets: Array<{
                label: string;
                types: OrderType[];
                desc: string;
              }> = [
                {
                  label: "🪑 Tek Masa (Sadece QR)",
                  types: ["dine_in"],
                  desc: "Sadece Masada Sipariş",
                },
                {
                  label: "🛵 Tek Paket Servis",
                  types: ["delivery"],
                  desc: "Sadece Adrese Paket",
                },
                {
                  label: "🛍️ Tek Gel-Al",
                  types: ["pickup"],
                  desc: "Sadece Gel-Al",
                },
                {
                  label: "🪑🛍️ Masa + Gel-Al",
                  types: ["dine_in", "pickup"],
                  desc: "Masada ve Gel-Al",
                },
                {
                  label: "🛵🛍️ Paket + Gel-Al",
                  types: ["delivery", "pickup"],
                  desc: "Paket ve Gel-Al",
                },
                {
                  label: "🪑🛵 Masa + Paket",
                  types: ["dine_in", "delivery"],
                  desc: "Masada ve Paket",
                },
                {
                  label: "✨ Tümü (Masa + Paket + Gel-Al)",
                  types: ["delivery", "pickup", "dine_in"],
                  desc: "3 Sipariş Türü Birden Aktif",
                },
              ];

              return (
                <div className="bg-orange-50/60 border-2 border-orange-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-200/70 pb-3">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <span>🛵🛍️🪑 Sitede Aktif Sipariş Türleri Seçimi</span>
                        <span className="text-[10px] font-black uppercase bg-orange-600 text-white px-2.5 py-0.5 rounded-full">
                          Anında Uygulanır
                        </span>
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Müşteri sipariş ekranında hangi sipariş türlerinin açık olacağını seçin (İster tek Masa, ister tek Paket, ister tek Gel-Al, ister ikili veya üçlü kombinasyon)
                      </p>
                    </div>
                  </div>

                  {/* 1) Tek Tıkla Hazır Kombinasyon Butonları */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-extrabold uppercase text-orange-900">
                      ⚡ Hızlı Kombinasyon Seçimi (Tek Tıkla Seç):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {presets.map((p) => {
                        const active = isExactMatch(p.types);
                        return (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => applyOrderTypes(p.types, p.label)}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              active
                                ? "bg-orange-600 border-orange-600 text-white shadow-sm"
                                : "bg-white border-slate-200 hover:border-orange-400 text-slate-800"
                            }`}
                          >
                            <div className="text-xs font-extrabold flex items-center justify-between gap-1">
                              <span>{p.label}</span>
                              {active && <span className="text-[10px]">✓</span>}
                            </div>
                            <div
                              className={`text-[10px] mt-0.5 ${
                                active ? "text-orange-100" : "text-slate-500"
                              }`}
                            >
                              {p.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2) Tek Tek Aç / Kapat Kutuları */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-extrabold uppercase text-slate-600">
                      🔧 Veya Sipariş Türlerini Tek Tek Açıp Kapatın:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        {
                          id: "dine_in" as OrderType,
                          icon: "🪑",
                          title: "Masa (Masada QR Sipariş)",
                          sub: "Müşteri masadan QR okutup veya masa seçip sipariş verir",
                        },
                        {
                          id: "delivery" as OrderType,
                          icon: "🛵",
                          title: "Paket Servis (Adrese Teslim)",
                          sub: "Müşteri mahalle ve açık adres seçerek eve/işe sipariş verir",
                        },
                        {
                          id: "pickup" as OrderType,
                          icon: "🛍️",
                          title: "Gel-Al (Restorandan Teslim)",
                          sub: "Müşteri siparişini verir, hazır olunca gelip teslim alır",
                        },
                      ].map((opt) => {
                        const isChecked = currentTypes.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => toggleSingleType(opt.id, opt.title)}
                            className={`p-3 rounded-xl border-2 text-left transition cursor-pointer flex items-start gap-2.5 ${
                              isChecked
                                ? "bg-emerald-50/90 border-emerald-500 text-emerald-950 shadow-2xs"
                                : "bg-white/80 border-slate-200 text-slate-400 hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              readOnly
                              checked={isChecked}
                              className="mt-0.5 w-4 h-4 accent-emerald-600 rounded pointer-events-none"
                            />
                            <div>
                              <div className="text-xs font-extrabold flex items-center gap-1">
                                <span>{opt.icon}</span>
                                <span>{opt.title}</span>
                              </div>
                              <div className="text-[10px] opacity-80 mt-0.5 leading-snug">
                                {opt.sub}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Restoran Adı
                </label>
                <input
                  type="text"
                  value={settings.name}
                  onChange={(e) =>
                    setSettings({ ...settings, name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Telefon Numarası
                </label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) =>
                    setSettings({ ...settings, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alt Başlık / Slogan
                </label>
                <input
                  type="text"
                  value={settings.slogan}
                  onChange={(e) =>
                    setSettings({ ...settings, slogan: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Restoran Açık Adresi
                </label>
                <input
                  type="text"
                  value={settings.address || ""}
                  onChange={(e) =>
                    setSettings({ ...settings, address: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Varsayılan Min. Paket ({settings.currency})
                </label>
                <input
                  type="number"
                  value={settings.minDeliveryAmount}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      minDeliveryAmount: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Varsayılan Getirme ({settings.currency})
                </label>
                <input
                  type="number"
                  value={settings.deliveryFee}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      deliveryFee: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hazırlama Süresi (Dk)
                </label>
                <input
                  type="number"
                  value={settings.estimatedPrepMinutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      estimatedPrepMinutes: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Toplam Masa Sayısı & İsim Yönetimi
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={getRestaurantTables(settings).length}
                    onChange={(e) => {
                      const nextCount = Math.max(
                        1,
                        Math.min(300, Number(e.target.value) || 1)
                      );
                      const cur = getRestaurantTables(settings);
                      let nextTables = [...cur];
                      if (nextCount > cur.length) {
                        for (let i = cur.length + 1; i <= nextCount; i++) {
                          nextTables.push(String(i));
                        }
                      } else if (nextCount < cur.length) {
                        nextTables = cur.slice(0, nextCount);
                      }
                      setSettings({
                        ...settings,
                        tableCount: nextCount,
                        tables: nextTables,
                      });
                    }}
                    className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-xl font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveTab("qr")}
                    className="flex-1 px-3 py-2 text-xs font-extrabold bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-xl transition cursor-pointer"
                  >
                    🪑 Masa İsimlerini Düzenle / Ekle / Sil →
                  </button>
                </div>
              </div>
            </div>

            {/* 🎨 Vitrin & Sistem Görünüm Teması (3 Açık + 3 Kapalı Tema) */}
            <div className="border-t border-slate-200 pt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Palette className="w-4 h-4 text-orange-600" />
                  <span>
                    🎨 Vitrin & Menü Görünüm Teması (3 Açık • 3 Kapalı Tema)
                  </span>
                </div>

                <label className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowCustomerThemeSwitch !== false}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        allowCustomerThemeSwitch: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-orange-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Müşteriler vitrinde temayı değiştirebilsin
                  </span>
                </label>
              </div>

              <p className="text-xs text-slate-500">
                Restoranınızın konseptine uygun varsayılan açık veya koyu temayı seçin. Seçtiğiniz tema anında önizlenir ve kaydedildiğinde tüm müşteri ekranlarına uygulanır.
              </p>

              {/* 3 Açık Tema */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>☀️ Açık Temalar (3 Seçenek)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STOREFRONT_THEMES.filter((t) => t.mode === "light").map(
                    (theme) => {
                      const isSelected =
                        (settings.storefrontTheme || "light-classic") ===
                        theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            applyThemeToDocument(theme.id);
                            try {
                              localStorage.setItem(
                                "restoran_selected_theme",
                                theme.id
                              );
                            } catch {
                              // ignore
                            }
                            setSettings({
                              ...settings,
                              storefrontTheme: theme.id,
                            });
                          }}
                          className={`text-left p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                            isSelected
                              ? "border-orange-500 ring-2 ring-orange-500/20 shadow-md"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                          style={{ backgroundColor: theme.previewBg }}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: theme.previewAccent }}
                              >
                                {theme.badge}
                              </span>
                              {isSelected && (
                                <CheckCircle2
                                  className="w-4 h-4"
                                  style={{ color: theme.previewAccent }}
                                />
                              )}
                            </div>
                            <div
                              className="font-extrabold text-xs sm:text-sm"
                              style={{ color: theme.previewText }}
                            >
                              {theme.name}
                            </div>
                            <p
                              className="text-[11px] leading-snug opacity-80"
                              style={{ color: theme.previewText }}
                            >
                              {theme.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/15"
                                style={{ backgroundColor: theme.previewBg }}
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/15"
                                style={{ backgroundColor: theme.previewCard }}
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full"
                                style={{ backgroundColor: theme.previewAccent }}
                              />
                            </div>
                            <span
                              className="text-[10px] font-extrabold"
                              style={{ color: theme.previewAccent }}
                            >
                              {isSelected ? "✓ Seçili" : "Seç"}
                            </span>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 3 Kapalı (Koyu) Tema */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>🌙 Kapalı / Koyu Temalar (3 Seçenek)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STOREFRONT_THEMES.filter((t) => t.mode === "dark").map(
                    (theme) => {
                      const isSelected =
                        (settings.storefrontTheme || "light-classic") ===
                        theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            applyThemeToDocument(theme.id);
                            try {
                              localStorage.setItem(
                                "restoran_selected_theme",
                                theme.id
                              );
                            } catch {
                              // ignore
                            }
                            setSettings({
                              ...settings,
                              storefrontTheme: theme.id,
                            });
                          }}
                          className={`text-left p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                            isSelected
                              ? "border-orange-500 ring-2 ring-orange-500/30 shadow-md"
                              : "border-slate-700 hover:border-slate-500"
                          }`}
                          style={{ backgroundColor: theme.previewBg }}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: theme.previewAccent }}
                              >
                                {theme.badge}
                              </span>
                              {isSelected && (
                                <CheckCircle2
                                  className="w-4 h-4"
                                  style={{ color: theme.previewAccent }}
                                />
                              )}
                            </div>
                            <div
                              className="font-extrabold text-xs sm:text-sm"
                              style={{ color: theme.previewText }}
                            >
                              {theme.name}
                            </div>
                            <p
                              className="text-[11px] leading-snug opacity-80"
                              style={{ color: theme.previewText }}
                            >
                              {theme.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20"
                                style={{ backgroundColor: theme.previewBg }}
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20"
                                style={{ backgroundColor: theme.previewCard }}
                              />
                              <span
                                className="w-3.5 h-3.5 rounded-full"
                                style={{ backgroundColor: theme.previewAccent }}
                              />
                            </div>
                            <span
                              className="text-[10px] font-extrabold"
                              style={{ color: theme.previewAccent }}
                            >
                              {isSelected ? "✓ Seçili" : "Seç"}
                            </span>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 🖼️ Müşteri Vitrini Menü Görünüm Modu & Vitrin Bandı Ayarları */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 mt-3">
                <div className="text-xs font-extrabold text-slate-900">
                  🖼️ Müşteri Vitrini Menü Kart Düzeni & Görsel Bantlar
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: "showcase" as const,
                      title: "📸 Büyük Fotoğraflı Vitrin",
                      desc: "Yemek fotoğrafı üstte büyük ve geniş, açıklama altta",
                    },
                    {
                      id: "grid" as const,
                      title: "🍱 Klasik Yan Yana Kart",
                      desc: "Sol tarafta açıklama ve fiyat, sağda kare yemek fotoğrafı",
                    },
                    {
                      id: "compact" as const,
                      title: "📋 Kompakt Hızlı Liste",
                      desc: "Çok ürünlü menüler için hızlı kaydırılabilir kompakt görünüm",
                    },
                  ].map((ly) => {
                    const active =
                      (settings.defaultMenuLayout || "grid") === ly.id;
                    return (
                      <button
                        key={ly.id}
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            defaultMenuLayout: ly.id,
                          })
                        }
                        className={`text-left p-3 rounded-xl border-2 transition cursor-pointer ${
                          active
                            ? "border-orange-500 bg-orange-50/70 shadow-2xs"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="text-xs font-extrabold text-slate-900">
                          {ly.title}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {ly.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showFeaturedCarousel !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          showFeaturedCarousel: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 accent-orange-600 rounded"
                    />
                    <div className="text-xs">
                      <span className="font-extrabold text-slate-900 block">
                        🔥 &ldquo;Şefin Tavsiyeleri & Günün Fırsatları&rdquo; Vitrin Karuseli
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Menünün üstünde popüler ve indirimli ürünleri büyük kaydırılabilir vitrin olarak gösterir.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showRestaurantInfoBar !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          showRestaurantInfoBar: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 accent-orange-600 rounded"
                    />
                    <div className="text-xs">
                      <span className="font-extrabold text-slate-900 block">
                        ✨ Hızlı Restoran Bilgi & Canlı WhatsApp Destek Bandı
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Teslimat süresi, ödeme türleri, ortalama müşteri puanı ve WhatsApp canlı destek butonunu gösterir.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* 📺 Müşteri Sıra Çağrı Ekranı (/tv) Gösterilecek Sipariş Türleri */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Tv className="w-4 h-4 text-orange-600" />
                  <span>
                    📺 TV Müşteri Sıra Çağrı Ekranında (/tv) Gösterilecek Sipariş Türleri
                  </span>
                </div>
                <Link
                  href="/tv"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition"
                >
                  <Tv className="w-3.5 h-3.5 text-orange-400" />
                  <span>TV Ekranını Aç ↗</span>
                </Link>
              </div>
              <p className="text-xs text-slate-500">
                Salondaki TV ekranında hangi sipariş türlerinin (Paket Servis, Gel-Al, Masa Siparişi) listeleneceğini ve sesli anons edileceğini buradan seçebilirsiniz.
              </p>

              {/* Hızlı Ön Ayar Butonları */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1">
                  Hızlı Seçim:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      tvDisplayOrderTypes: ["pickup"],
                    })
                  }
                  className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-100 hover:bg-orange-600 hover:text-white text-slate-700 border border-slate-200 transition cursor-pointer"
                >
                  Sadece Gel-Al
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      tvDisplayOrderTypes: ["pickup", "dine_in"],
                    })
                  }
                  className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-100 hover:bg-orange-600 hover:text-white text-slate-700 border border-slate-200 transition cursor-pointer"
                >
                  Gel-Al + Masa
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      tvDisplayOrderTypes: ["pickup", "dine_in", "delivery"],
                    })
                  }
                  className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-100 hover:bg-orange-600 hover:text-white text-slate-700 border border-slate-200 transition cursor-pointer"
                >
                  Tümü (Paket + Gel-Al + Masa)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: "pickup" as const,
                    title: "🛍️ Gel-Al Siparişler",
                    desc: "Kasadan / tezgahtan paket teslim alacak müşteriler",
                  },
                  {
                    id: "dine_in" as const,
                    title: "🪑 Masa / Salon Siparişleri",
                    desc: "Salonda masada oturan veya self-servis masa siparişleri",
                  },
                  {
                    id: "delivery" as const,
                    title: "🛵 Paket Servis Siparişleri",
                    desc: "Adrese kurye ile gidecek paket siparişler",
                  },
                ].map((opt) => {
                  const currentTypes: OrderType[] = Array.isArray(
                    settings.tvDisplayOrderTypes
                  )
                    ? settings.tvDisplayOrderTypes
                    : ["pickup", "dine_in", "delivery"];
                  const isChecked = currentTypes.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer flex items-start gap-3 transition ${
                        isChecked
                          ? "border-orange-500 bg-orange-50/50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...currentTypes, opt.id]))
                            : currentTypes.filter((t) => t !== opt.id);
                          setSettings({
                            ...settings,
                            tvDisplayOrderTypes: next,
                          });
                        }}
                        className="mt-0.5 w-4 h-4 accent-orange-600 rounded"
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          {opt.title}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {opt.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    TV Alt Kayan Yazı Hızı
                  </label>
                  <select
                    value={settings.tvTickerSpeed || "normal"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        tvTickerSpeed: e.target.value as
                          | "slow"
                          | "normal"
                          | "fast",
                      })
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white font-semibold"
                  >
                    <option value="slow">🐢 Yavaş (135 Saniye - Çok Rahat Okuma)</option>
                    <option value="normal">🚶 Normal (85 Saniye - İdeal Hız)</option>
                    <option value="fast">⚡ Hızlı (50 Saniye - Dinamik Akış)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    TV Özel Alt Duyuru / Wi-Fi / Kampanya Yazısı (İsteğe Bağlı)
                  </label>
                  <input
                    type="text"
                    value={settings.tvCustomNote || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        tvCustomNote: e.target.value,
                      })
                    }
                    placeholder="Örn: Ücretsiz Wi-Fi Şifremiz: Lezzet2026 • Afiyet Olsun!"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Kurye Listesi & Her Kuryeye Özel Şifre Yönetimi */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Truck className="w-4 h-4 text-orange-600" />
                <span>Paket Servis Kurye Listesi & Kurye Özel Şifreleri (PIN)</span>
              </div>
              <p className="text-xs text-slate-500">
                Her kuryeye kendine özel giriş şifresi (PIN) atayabilirsiniz. Kurye{" "}
                <strong>/courier</strong> ekranından kendi şifresiyle giriş yaptığında
                otomatik olarak kendi profili seçilir ve yalnızca kendi paketlerini yönetir.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  placeholder="Kurye Adı (Örn: Ahmet - Motorlu Kurye)"
                  value={newCourierName}
                  onChange={(e) => setNewCourierName(e.target.value)}
                  className="sm:col-span-6 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  placeholder="Özel Şifre / PIN (Örn: 4444)"
                  value={newCourierPin}
                  onChange={(e) => setNewCourierPin(e.target.value)}
                  className="sm:col-span-3 px-3 py-2 text-xs border border-slate-200 rounded-xl font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const cleanName = newCourierName.trim();
                    if (!cleanName) return;
                    const list = settings.couriers || [
                      "Kurye 1 (Motorlu)",
                      "Kurye 2 (Motorlu)",
                      "Hızlı Kurye",
                    ];
                    const cleanPin =
                      newCourierPin.trim() ||
                      String((list.length + 1) * 1111).slice(0, 4);
                    const nextCouriers = list.includes(cleanName)
                      ? list
                      : [...list, cleanName];
                    const nextPins = {
                      ...(settings.courierPins || {}),
                      [cleanName]: cleanPin,
                    };
                    const nextSettings: RestaurantSettings = {
                      ...settings,
                      couriers: nextCouriers,
                      courierPins: nextPins,
                    };
                    persistSettings(
                      nextSettings,
                      `🛵 ${cleanName} kurye listesine özel şifresiyle eklendi!`
                    );
                    setNewCourierName("");
                    setNewCourierPin("");
                  }}
                  className="sm:col-span-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  + Kurye & Şifre Ekle
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  settings.couriers || [
                    "Kurye 1 (Motorlu)",
                    "Kurye 2 (Motorlu)",
                    "Hızlı Kurye",
                  ]
                ).map((cName, idx) => {
                  const currentPin =
                    settings.courierPins?.[cName] ||
                    String((idx + 1) * 1111).slice(0, 4);
                  return (
                    <div
                      key={`${cName}-${idx}`}
                      className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">🛵 {cName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400">
                          Şifre:
                        </span>
                        <input
                          type="text"
                          value={currentPin}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSettings({
                              ...settings,
                              courierPins: {
                                ...(settings.courierPins || {}),
                                [cName]: val,
                              },
                            });
                          }}
                          onBlur={(e) => {
                            const val = e.target.value.trim() || "1111";
                            const nextSettings: RestaurantSettings = {
                              ...settings,
                              courierPins: {
                                ...(settings.courierPins || {}),
                                [cName]: val,
                              },
                            };
                            persistSettings(
                              nextSettings,
                              `🔑 ${cName} şifresi güncellendi!`
                            );
                          }}
                          className="w-20 px-2 py-1 text-xs font-mono font-extrabold text-center bg-white border border-slate-300 rounded-lg text-orange-700 focus:outline-none focus:border-orange-500"
                          title="Kuryenin kendine özel giriş şifresi (PIN)"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const list = settings.couriers || [];
                            const nextPins = { ...(settings.courierPins || {}) };
                            delete nextPins[cName];
                            const nextSettings: RestaurantSettings = {
                              ...settings,
                              couriers: list.filter((_, i) => i !== idx),
                              courierPins: nextPins,
                            };
                            persistSettings(
                              nextSettings,
                              `🗑️ ${cName} kurye listesinden kaldırıldı.`
                            );
                          }}
                          className="text-red-500 hover:text-red-700 font-black px-1.5 py-0.5 rounded hover:bg-red-50 cursor-pointer"
                          title="Kuryeyi Sil"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 👨‍💼 Garson Listesi & Her Garsona Özel Giriş Şifresi (PIN) Yönetimi */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  👨‍💼 Salon Garsonları & Her Garsona Özel Giriş Şifresi (PIN)
                </h3>
                <p className="text-xs text-slate-500">
                  Her garsona kendine özel bir şifre (PIN) atayabilirsiniz. Garsonlar /waiter ekranına kendi şifreleriyle giriş yaptığında açtıkları tüm masa siparişleri otomatik olarak kendi adlarına yazılır.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Yeni garson adı (Örn: Ahmet - Salon)"
                  value={newWaiterName}
                  onChange={(e) => setNewWaiterName(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl"
                />
                <input
                  type="text"
                  placeholder="Özel Şifre / PIN (Örn: 4040)"
                  value={newWaiterPin}
                  onChange={(e) => setNewWaiterPin(e.target.value)}
                  className="sm:w-48 px-3 py-2 text-xs font-mono font-bold border border-slate-200 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newWaiterName.trim();
                    if (!name) return;
                    const list = settings.waiters || [
                      "Garson 1 (Salon)",
                      "Garson 2 (Bahçe)",
                      "Şef Garson",
                    ];
                    const pin =
                      newWaiterPin.trim() ||
                      String(Math.floor(1000 + Math.random() * 9000));
                    const nextSettings: RestaurantSettings = {
                      ...settings,
                      waiters: [...list, name],
                      waiterPins: {
                        ...(settings.waiterPins || {}),
                        [name]: pin,
                      },
                    };
                    setNewWaiterName("");
                    setNewWaiterPin("");
                    persistSettings(
                      nextSettings,
                      `✅ "${name}" garson listesine eklendi (Şifre: ${pin})`
                    );
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  + Garson Ekle
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  settings.waiters || [
                    "Garson 1 (Salon)",
                    "Garson 2 (Bahçe)",
                    "Şef Garson",
                  ]
                ).map((wName, idx) => {
                  const currentPin =
                    settings.waiterPins?.[wName] ||
                    String((idx + 1) * 1010).slice(0, 4);
                  return (
                    <div
                      key={`${wName}-${idx}`}
                      className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">👨‍💼 {wName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400">
                          Şifre:
                        </span>
                        <input
                          type="text"
                          value={currentPin}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSettings({
                              ...settings,
                              waiterPins: {
                                ...(settings.waiterPins || {}),
                                [wName]: val,
                              },
                            });
                          }}
                          onBlur={(e) => {
                            const val = e.target.value.trim() || "1010";
                            const nextSettings: RestaurantSettings = {
                              ...settings,
                              waiterPins: {
                                ...(settings.waiterPins || {}),
                                [wName]: val,
                              },
                            };
                            persistSettings(
                              nextSettings,
                              `🔑 ${wName} şifresi güncellendi!`
                            );
                          }}
                          className="w-20 px-2 py-1 text-xs font-mono font-extrabold text-center bg-white border border-slate-300 rounded-lg text-orange-700 focus:outline-none focus:border-orange-500"
                          title="Garsonun kendine özel giriş şifresi (PIN)"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const list = settings.waiters || [];
                            const nextPins = { ...(settings.waiterPins || {}) };
                            delete nextPins[wName];
                            const nextSettings: RestaurantSettings = {
                              ...settings,
                              waiters: list.filter((_, i) => i !== idx),
                              waiterPins: nextPins,
                            };
                            persistSettings(
                              nextSettings,
                              `🗑️ ${wName} garson listesinden kaldırıldı.`
                            );
                          }}
                          className="text-red-500 hover:text-red-700 font-black px-1.5 py-0.5 rounded hover:bg-red-50 cursor-pointer"
                          title="Garsonu Sil"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Yönetici & Mutfak Giriş Şifreleri */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Lock className="w-4 h-4 text-orange-600" />
                <span>Güvenlik: Admin & Mutfak Giriş Şifreleri</span>
              </div>
              <p className="text-xs text-slate-500">
                Yönetim paneline ve mutfak/kasa ekranına yetkisiz kişilerin
                girmemesi için kullanılan şifreleri buradan değiştirebilirsiniz.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Yönetici (Admin) Şifresi
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.securityConfig?.adminPassword || "admin1234"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        securityConfig: {
                          adminPassword: e.target.value,
                          kitchenPassword:
                            settings.securityConfig?.kitchenPassword || "1234",
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mutfak / Kasa Ekranı Şifresi (PIN)
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.securityConfig?.kitchenPassword || "1234"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        securityConfig: {
                          adminPassword:
                            settings.securityConfig?.adminPassword || "admin1234",
                          kitchenPassword: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 🎁 İsteğe Bağlı Müşteri Sadakat & Para Puan (Cüzdan) Sistemi Ayarı */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Gift className="w-4 h-4 text-amber-600" />
                  <span>
                    🎁 Müşteri Sadakat & Para Puan (Cüzdan) Sistemi (İsteğe Bağlı)
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.loyaltyConfig?.enabled)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        loyaltyConfig: {
                          enabled: e.target.checked,
                          earnPercent:
                            settings.loyaltyConfig?.earnPercent ?? 5,
                          minRedeemPoints:
                            settings.loyaltyConfig?.minRedeemPoints ?? 20,
                        },
                      })
                    }
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <span className="text-xs font-extrabold text-amber-900">
                    {settings.loyaltyConfig?.enabled
                      ? "🟢 Para Puan Sistemi AÇIK"
                      : "⚪ Para Puan Sistemi KAPALI"}
                  </span>
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Açık olduğunda müşteriler her siparişte belirlediğiniz yüzdede Para Puan kazanır ve ödeme adımında isterlerse cüzdan bakiyelerini harcayabilirler.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Siparişten Kazanılacak Para Puan Oranı (%)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.loyaltyConfig?.earnPercent ?? 5}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        loyaltyConfig: {
                          enabled: Boolean(settings.loyaltyConfig?.enabled),
                          earnPercent: Number(e.target.value),
                          minRedeemPoints:
                            settings.loyaltyConfig?.minRedeemPoints ?? 20,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Minimum Harcanabilir Puan Alt Limiti ({settings.currency})
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={settings.loyaltyConfig?.minRedeemPoints ?? 20}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        loyaltyConfig: {
                          enabled: Boolean(settings.loyaltyConfig?.enabled),
                          earnPercent:
                            settings.loyaltyConfig?.earnPercent ?? 5,
                          minRedeemPoints: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* 💾 Tek Tıkla Tam Veritabanı Yedeği İndir (.json) ve Geri Yükle (Restore) */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Database className="w-4 h-4 text-teal-600" />
                <span>
                  💾 Tam Veritabanı Yedeği İndir (.json) & Yedekten Geri Yükle
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Tüm menülerinizi, kategorilerinizi, ayarlarınızı, müşteri listesini ve sipariş geçmişinizi tek tıkla bilgisayarınıza yedekleyebilir veya başka bir bilgisayara aktarabilirsiniz.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadFullBackup}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>📥 Tam Yedeği İndir (.json)</span>
                </button>

                <label className="inline-flex items-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer">
                  <Upload className="w-4 h-4 text-teal-700" />
                  <span>
                    {restoringBackup
                      ? "Yedek Yükleniyor..."
                      : "📤 Yedek Dosyasından Geri Yükle (.json)"}
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreFullBackup}
                    disabled={restoringBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* 🍽️ SambaPOS Menü Eşleştirme & Ürünleri SambaPOS'a Aktar (Hızlı Erişim) */}
            <div className="border-t border-slate-200 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <RefreshCw className="w-4 h-4 text-indigo-600" />
                  <span>
                    🍽️ SambaPOS Menü Eşleştirme & Sitedeki Ürünleri SambaPOS&apos;a Aktar
                  </span>
                </div>
                {sambaConfig.lastMenuSyncedAt && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Son Aktarım:{" "}
                    {new Date(sambaConfig.lastMenuSyncedAt).toLocaleString(
                      "tr-TR"
                    )}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Web sitenizdeki tüm ürünleri ({items.length} ürün ve{" "}
                {categories.length} kategori) tek tıkla SambaPOS V5 ürün
                listesine ve dokunmatik POS menü ekranına aktarabilir veya
                birebir ürün eşleştirmesi yapabilirsiniz.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={posMenuSyncing}
                  onClick={() => handleSyncMenuToSamba({ updatePrices: true })}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${posMenuSyncing ? "animate-spin" : ""}`}
                  />
                  <span>
                    {posMenuSyncing
                      ? "Sitedeki Ürünler SambaPOS'a Aktarılıyor..."
                      : `🚀 Sitedeki Tüm Ürünleri Şimdi SambaPOS'a Aktar (${items.length} Ürün)`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("pos")}
                  className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer"
                >
                  <span>🔄 Detaylı Menü Eşleştirme Tablosunu Aç &rarr;</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-xl transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Ayarları Kaydet
            </button>
          </form>
        )}

        {/* 8. POS ENTEGRASYONU (SAMBAPOS & DİĞER POS SİSTEMLERİ) SEKMESİ */}
        {activeTab === "pos" && settings && (
          <form
            onSubmit={handleSavePosConfig}
            className="max-w-5xl space-y-6"
          >
            {/* Üst Bilgi & İsteğe Bağlı Aç/Kapat Kartı */}
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-6 rounded-2xl border border-indigo-500/30 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-extrabold px-3 py-1 rounded-full">
                    🔌 İsteğe Bağlı &amp; Tamamen Bağımsız Çoklu POS Köprüsü
                  </div>
                  <h2 className="text-xl font-black text-white">
                    {selectedPosSubTab === "custom_pos"
                      ? "🖥️ NarPOS / Kerzz POS / Özel REST API Entegrasyonu"
                      : selectedPosSubTab === "adisyo"
                      ? "🏪 Adisyo Bulut POS & Kurye POS Entegrasyonu"
                      : "🍽️ SambaPOS V5 Sipariş Aktarım Entegrasyonu"}
                  </h2>
                  <p className="text-xs text-indigo-200/90 max-w-2xl leading-relaxed">
                    {selectedPosSubTab === "custom_pos" ? (
                      <>
                        Müşterilerinizin web sitesinden (Netlify), QR masadan veya kasadan verdiği siparişleri otomatik veya tek tıkla <strong>NarPOS</strong>, <strong>Kerzz POS</strong>, <strong>PosEntegra</strong> veya kendi <strong>Özel HTTP REST API &amp; Webhook</strong> sisteminize aktarabilir, PLU kodlarını eşleştirebilir ve kurye ataması ile teslimat durumlarını çift yönlü senkronize edebilirsiniz.
                      </>
                    ) : selectedPosSubTab === "adisyo" ? (
                      <>
                        Müşterilerinizin web sitesinden (Netlify), QR masadan veya kasadan verdiği siparişleri otomatik veya tek tıkla <strong>Adisyo Bulut POS (External API v2)</strong> veya <strong>Kurye POS</strong> sistemine aktarabilir, Adisyo&apos;dan yapılan kurye ataması ve teslimat durumlarını sitede otomatik güncelleyebilirsiniz.
                      </>
                    ) : (
                      <>
                        Müşterilerinizin web sitesinden (Netlify), QR masadan veya kasadan verdiği siparişleri mevcut sistemi hiç bozmadan otomatik veya tek tıkla <strong>SambaPOS V5</strong> adisyonuna aktarabilirsiniz. Kullanmak istemeyen işletmelerde kapalı kalır ve sistemi hiçbir şekilde etkilemez.
                      </>
                    )}
                  </p>
                </div>

                {selectedPosSubTab === "custom_pos" ? (
                  <label className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 px-4 py-3 rounded-2xl cursor-pointer shrink-0 transition">
                    <input
                      type="checkbox"
                      checked={Boolean(customPosConfig.enabled)}
                      onChange={(e) =>
                        updateCustomPosConfigField({
                          enabled: e.target.checked,
                        })
                      }
                      className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                    />
                    <div>
                      <div className="text-sm font-black text-white">
                        {customPosConfig.enabled
                          ? "✅ NarPOS / Kerzz / API AÇIK"
                          : "⏸️ NarPOS / Kerzz / API KAPALI"}
                      </div>
                      <div className="text-[11px] text-indigo-200">
                        İsteğe bağlı açıp kapatabilirsiniz
                      </div>
                    </div>
                  </label>
                ) : selectedPosSubTab === "adisyo" ? (
                  <label className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 px-4 py-3 rounded-2xl cursor-pointer shrink-0 transition">
                    <input
                      type="checkbox"
                      checked={Boolean(adisyoConfig.enabled)}
                      onChange={(e) =>
                        updateAdisyoConfigField({ enabled: e.target.checked })
                      }
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                    <div>
                      <div className="text-sm font-black text-white">
                        {adisyoConfig.enabled
                          ? "✅ Adisyo / Kurye POS AÇIK"
                          : "⏸️ Adisyo / Kurye POS KAPALI"}
                      </div>
                      <div className="text-[11px] text-indigo-200">
                        İsteğe bağlı açıp kapatabilirsiniz
                      </div>
                    </div>
                  </label>
                ) : (
                  <label className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/20 px-4 py-3 rounded-2xl cursor-pointer shrink-0 transition">
                    <input
                      type="checkbox"
                      checked={Boolean(sambaConfig.enabled)}
                      onChange={(e) =>
                        updateSambaConfigField({ enabled: e.target.checked })
                      }
                      className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                    />
                    <div>
                      <div className="text-sm font-black text-white">
                        {sambaConfig.enabled
                          ? "✅ SambaPOS Aktarımı AÇIK"
                          : "⏸️ SambaPOS Aktarımı KAPALI"}
                      </div>
                      <div className="text-[11px] text-indigo-200">
                        İsteğe bağlı açıp kapatabilirsiniz
                      </div>
                    </div>
                  </label>
                )}
              </div>

              {/* POS Sağlayıcı Seçimi (SambaPOS V5, Adisyo / Kurye POS & NarPOS / Kerzz / Özel API Aktif Modüller) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPosSubTab("sambapos");
                    setPosTestStatus(null);
                  }}
                  className={`text-left rounded-xl p-3 flex items-center justify-between transition cursor-pointer ${
                    selectedPosSubTab === "sambapos"
                      ? "bg-indigo-600/40 border-2 border-indigo-400 shadow-md"
                      : "bg-white/10 hover:bg-white/15 border border-white/20"
                  }`}
                >
                  <div>
                    <div className="text-xs font-black text-white">
                      🍽️ SambaPOS V5 (GraphQL / Webhook)
                    </div>
                    <div className="text-[11px] text-indigo-200">
                      Masa, Paket, Menü &amp; Kurye Senkronizasyonu
                    </div>
                  </div>
                  <span
                    className={`${
                      sambaConfig.enabled
                        ? "bg-emerald-500 text-white"
                        : "bg-indigo-500/40 text-indigo-100"
                    } text-[10px] font-black px-2 py-0.5 rounded-full shrink-0`}
                  >
                    {sambaConfig.enabled ? "AÇIK" : "AKTİF MODÜL"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPosSubTab("adisyo");
                    setPosTestStatus(null);
                  }}
                  className={`text-left rounded-xl p-3 flex items-center justify-between transition cursor-pointer ${
                    selectedPosSubTab === "adisyo"
                      ? "bg-emerald-600/40 border-2 border-emerald-400 shadow-md"
                      : "bg-white/10 hover:bg-white/15 border border-white/20"
                  }`}
                >
                  <div>
                    <div className="text-xs font-black text-white">
                      🏪 Adisyo / Kurye POS
                    </div>
                    <div className="text-[11px] text-emerald-200">
                      Bulut API v2, Menü &amp; Çift Yönlü Kurye POS
                    </div>
                  </div>
                  <span
                    className={`${
                      adisyoConfig.enabled
                        ? "bg-emerald-500 text-white"
                        : "bg-emerald-500/30 text-emerald-100"
                    } text-[10px] font-black px-2 py-0.5 rounded-full shrink-0`}
                  >
                    {adisyoConfig.enabled ? "AÇIK" : "AKTİF MODÜL"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPosSubTab("custom_pos");
                    setPosTestStatus(null);
                  }}
                  className={`text-left rounded-xl p-3 flex items-center justify-between transition cursor-pointer ${
                    selectedPosSubTab === "custom_pos"
                      ? "bg-amber-600/40 border-2 border-amber-400 shadow-md"
                      : "bg-white/10 hover:bg-white/15 border border-white/20"
                  }`}
                >
                  <div>
                    <div className="text-xs font-black text-white">
                      🖥️ NarPOS / Kerzz / Özel API
                    </div>
                    <div className="text-[11px] text-amber-200">
                      PLU Eşleştirme, REST API &amp; Çift Yönlü Webhook
                    </div>
                  </div>
                  <span
                    className={`${
                      customPosConfig.enabled
                        ? "bg-emerald-500 text-white"
                        : "bg-amber-500/30 text-amber-100"
                    } text-[10px] font-black px-2 py-0.5 rounded-full shrink-0`}
                  >
                    {customPosConfig.enabled ? "AÇIK" : "AKTİF MODÜL"}
                  </span>
                </button>
              </div>
            </div>

            {posTestStatus && (
              <div
                className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
                  posTestStatus.ok
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                }`}
              >
                <span>
                  {posTestStatus.ok ? "✅ " : "⚠️ "}
                  {posTestStatus.message}
                </span>
                <button
                  type="button"
                  onClick={() => setPosTestStatus(null)}
                  className="text-slate-500 hover:text-slate-800 font-black px-2"
                >
                  ✕
                </button>
              </div>
            )}

            {selectedPosSubTab === "custom_pos" ? (
              <div className="space-y-6">
                {/* 1. NarPOS / Kerzz / Özel API Aktarım Zamanı & Sistem Seçimi */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">
                        1. NarPOS / Kerzz POS / Özel REST API Bağlantı &amp; Aktarım Ayarları
                      </h3>
                      <p className="text-xs text-slate-500">
                        Kullandığınız POS sistemini (NarPOS, Kerzz POS, PosEntegra veya Özel Webhook) ve sipariş aktarım zamanını seçin.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestPosConnection}
                        disabled={posTesting}
                        className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-extrabold px-3.5 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${posTesting ? "animate-spin" : ""}`}
                        />
                        {posTesting
                          ? "Test Ediliyor..."
                          : "🔌 NarPOS / Kerzz / API Bağlantısını Test Et"}
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Ayarları Kaydet
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kullandığınız POS Sistemi (Preset)
                      </label>
                      <select
                        value={customPosConfig.systemPreset}
                        onChange={(e) =>
                          updateCustomPosConfigField({
                            systemPreset: e.target.value as
                              | "narpos"
                              | "kerzz"
                              | "posentegra"
                              | "custom_webhook"
                              | "simulation",
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                      >
                        <option value="narpos">
                          🖥️ NarPOS (Bulut &amp; Yerel Kasa REST API)
                        </option>
                        <option value="kerzz">
                          🏢 Kerzz POS (REST API &amp; Sipariş Köprüsü)
                        </option>
                        <option value="posentegra">
                          🔗 PosEntegra / Genel Restoran POS Köprüsü
                        </option>
                        <option value="custom_webhook">
                          🌐 Özel HTTP REST API &amp; JSON Webhook (Herhangi Bir Yazılım)
                        </option>
                        <option value="simulation">
                          🧪 Simülasyon &amp; Canlı Test Modu (Sunucu Kurmadan Test Et)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sipariş Ne Zaman POS Sistemine Aktarılsın?
                      </label>
                      <select
                        value={customPosConfig.syncTrigger}
                        onChange={(e) =>
                          updateCustomPosConfigField({
                            syncTrigger: e.target.value as
                              | "on_accepted"
                              | "on_created"
                              | "manual",
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                      >
                        <option value="on_accepted">
                          ✅ Mutfak / Kasa Siparişi &quot;Kabul Et&quot; Dediğinde Otomatik Aktar (Önerilen)
                        </option>
                        <option value="on_created">
                          ⚡ Sipariş Geldiği Anda (Onay Beklemeden) Anında Otomatik Aktar
                        </option>
                        <option value="manual">
                          🖐️ Sadece Manuel (Mutfak/Yönetim Ekranında Butona Basınca Aktar)
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* 2. API Adresi, Şube Kodu & Endpoint Ayarları */}
                  <div className="space-y-4 pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
                      2. Sunucu Adresi, API Anahtarları &amp; Endpoint Yolları
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          POS API / Webhook Sunucu Adresi
                        </label>
                        <input
                          type="text"
                          value={customPosConfig.apiBaseUrl}
                          onChange={(e) =>
                            updateCustomPosConfigField({
                              apiBaseUrl: e.target.value,
                            })
                          }
                          placeholder="https://api.narpos.com.tr/api/v1"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          API Key / Bearer Token (x-api-key)
                        </label>
                        <input
                          type="text"
                          value={customPosConfig.apiKey}
                          onChange={(e) =>
                            updateCustomPosConfigField({
                              apiKey: e.target.value,
                            })
                          }
                          placeholder="POS API Anahtarı"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          API Secret / Gizli Anahtar
                        </label>
                        <input
                          type="password"
                          value={customPosConfig.apiSecret}
                          onChange={(e) =>
                            updateCustomPosConfigField({
                              apiSecret: e.target.value,
                            })
                          }
                          placeholder="Gizli Anahtar"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Şube ID (Branch ID) &amp; Webhook Secret
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customPosConfig.branchId}
                            onChange={(e) =>
                              updateCustomPosConfigField({
                                branchId: e.target.value,
                              })
                            }
                            placeholder="SUBE-01"
                            className="w-1/2 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                          />
                          <input
                            type="text"
                            value={customPosConfig.webhookSecret || ""}
                            onChange={(e) =>
                              updateCustomPosConfigField({
                                webhookSecret: e.target.value,
                              })
                            }
                            placeholder="pos_webhook_2026"
                            className="w-1/2 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Kimlik Doğrulama Tipi
                        </label>
                        <select
                          value={customPosConfig.authType}
                          onChange={(e) =>
                            updateCustomPosConfigField({
                              authType: e.target.value as
                                | "bearer"
                                | "api_key_header"
                                | "basic",
                            })
                          }
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                        >
                          <option value="bearer">Bearer Token</option>
                          <option value="api_key_header">X-Api-Key Header</option>
                          <option value="basic">Basic Auth</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Sipariş Gönderim Endpoint Yolu
                        </label>
                        <input
                          type="text"
                          value={customPosConfig.ordersEndpointPath}
                          onChange={(e) =>
                            updateCustomPosConfigField({
                              ordersEndpointPath: e.target.value,
                            })
                          }
                          placeholder="/orders"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Durum &amp; Kurye Endpoint Yolu
                        </label>
                        <input
                          type="text"
                          value={customPosConfig.statusEndpointPath}
                          onChange={(e) =>
                            updateCustomPosConfigField({
                              statusEndpointPath: e.target.value,
                            })
                          }
                          placeholder="/orders/status"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Menü &amp; PLU Endpoint Yolu
                        </label>
                        <input
                          type="text"
                          value={customPosConfig.menuEndpointPath}
                          onChange={(e) =>
                            updateCustomPosConfigField({
                              menuEndpointPath: e.target.value,
                            })
                          }
                          placeholder="/products"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
                    </div>

                    {/* Çift Yönlü Push & Pull Endpoint Bilgisi */}
                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-xs font-extrabold text-amber-950">
                          📡 NarPOS / Kerzz / Özel POS Çift Yönlü Sipariş Çekme (Pull) &amp; Kurye Bildirim (Push) Adresleri
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-950 shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              customPosConfig.autoSyncCourierAndStatus !== false
                            }
                            onChange={(e) =>
                              updateCustomPosConfigField({
                                autoSyncCourierAndStatus: e.target.checked,
                              })
                            }
                            className="w-4 h-4 accent-amber-600 rounded"
                          />
                          Kurye &amp; Teslimat Durumunu Otomatik Eşitle
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-amber-900">
                        <div className="bg-white border border-amber-200 rounded-lg p-2.5 space-y-1">
                          <div className="font-bold text-slate-700">
                            📥 1. POS Kasa Programının Siparişleri Çekeceği Adres (GET Pull):
                          </div>
                          <code className="block font-mono text-amber-900 break-all">
                            GET {originUrl}/api/pos-sync/custom-webhook?status=pending
                          </code>
                        </div>
                        <div className="bg-white border border-amber-200 rounded-lg p-2.5 space-y-1">
                          <div className="font-bold text-slate-700">
                            📤 2. POS&apos;tan Kurye Ataması &amp; Teslimat Bildirimi Adresi (POST Webhook):
                          </div>
                          <code className="block font-mono text-amber-900 break-all">
                            POST {originUrl}/api/pos-sync/custom-webhook
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. NarPOS / Kerzz / Özel API PLU & Ürün Eşleştirme Tablosu */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">
                        3. 🔄 NarPOS / Kerzz POS / Özel API Menü &amp; PLU Kodu Eşleştirme
                      </h3>
                      <p className="text-xs text-slate-500">
                        Sitedeki ürünlerinizin NarPOS / Kerzz POS üzerindeki PLU kodlarını otomatik oluşturun veya özel PLU kodu girin.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncMenuToCustomPos}
                      disabled={posMenuSyncing}
                      className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${posMenuSyncing ? "animate-spin" : ""}`}
                      />
                      {posMenuSyncing
                        ? "Eşitleniyor..."
                        : `🚀 Tüm Site Ürünlerini NarPOS / Kerzz PLU Kodlarıyla Eşitle (${items.length} Ürün)`}
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-96">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                        <tr>
                          <th className="py-2.5 px-3">Site Ürünü</th>
                          <th className="py-2.5 px-3">Kategori</th>
                          <th className="py-2.5 px-3">Fiyat</th>
                          <th className="py-2.5 px-3">POS PLU Kodu / Ürün Kodu Eşleştirmesi</th>
                          <th className="py-2.5 px-3 text-right">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => {
                          const catName =
                            categories.find((c) => c.id === item.categoryId)
                              ?.name || "Genel";
                          const defaultPlu = `PLU-${1001 + idx}`;
                          const mappedVal =
                            customPosConfig.productMappings?.[item.id] || "";
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80">
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {item.name}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {catName}
                              </td>
                              <td className="py-2 px-3 font-extrabold text-amber-700">
                                {item.price.toFixed(2)} {settings.currency}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  defaultValue={mappedVal || defaultPlu}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val !== (mappedVal || defaultPlu)) {
                                      handleSaveCustomPosProductMapping(
                                        item.id,
                                        val
                                      );
                                    }
                                  }}
                                  placeholder={defaultPlu}
                                  className="w-full max-w-xs px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-mono font-semibold"
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                                  ✅ Eşleşti ({mappedVal || defaultPlu})
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Son Siparişlerin NarPOS / Kerzz / Özel API Aktarım & Canlı Kurye/Teslimat Tablosu */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">
                        4. 📋 Son Siparişlerin NarPOS / Kerzz / Özel API Aktarım &amp; Kurye Durumu
                      </h3>
                      <p className="text-xs text-slate-500">
                        Siparişleri NarPOS / Kerzz POS&apos;a gönderebilir veya POS üzerinden kurye ataması ve teslimat durumunu tek tıkla test edebilirsiniz.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBulkSyncPendingToPos}
                      disabled={posBulkSyncing}
                      className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${posBulkSyncing ? "animate-spin" : ""}`}
                      />
                      {posBulkSyncing
                        ? "Aktarılıyor..."
                        : "🔄 Aktarılmamış Siparişleri NarPOS / Kerzz'e Gönder"}
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                          <th className="py-2.5 px-3">Sipariş</th>
                          <th className="py-2.5 px-3">Müşteri / Masa</th>
                          <th className="py-2.5 px-3">Tutar</th>
                          <th className="py-2.5 px-3">Durum &amp; Kurye</th>
                          <th className="py-2.5 px-3">POS Aktarım Durumu</th>
                          <th className="py-2.5 px-3 text-right">NarPOS / Kerzz / API İşlemleri</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.slice(0, 15).map((ord) => {
                          const sync = ord.posSyncInfo;
                          return (
                            <tr key={ord.id} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3 font-black text-slate-900">
                                #{ord.orderNumber}
                                <div className="text-[10px] font-normal text-slate-400">
                                  {new Date(ord.createdAt).toLocaleTimeString(
                                    "tr-TR",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">
                                  {ord.orderType === "dine_in"
                                    ? `🪑 Masa ${ord.tableNumber || "?"}`
                                    : ord.customerName}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {ord.orderType === "delivery"
                                    ? "🛵 Paket Servis"
                                    : ord.orderType === "pickup"
                                    ? "🛍️ Gel-Al"
                                    : "🍽️ Masada"}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-amber-700">
                                {ord.totalAmount.toFixed(2)} {settings.currency}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-col gap-1 items-start">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                      ord.status === "completed"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : ord.status === "ready"
                                        ? "bg-indigo-100 text-indigo-800"
                                        : ord.status === "accepted"
                                        ? "bg-amber-100 text-amber-800"
                                        : ord.status === "rejected"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {ord.status === "completed"
                                      ? "🎉 Teslim Edildi"
                                      : ord.status === "ready"
                                      ? "🛵 Kuryede / Hazır"
                                      : ord.status === "accepted"
                                      ? "🔥 Hazırlanıyor"
                                      : ord.status === "rejected"
                                      ? "❌ İptal"
                                      : "⏳ Bekliyor"}
                                  </span>
                                  {ord.courierName && (
                                    <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded-md text-[10px]">
                                      🛵 {ord.courierName}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                {sync?.status === "synced" ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
                                    ✅ Aktarıldı
                                    {sync.externalTicketId
                                      ? ` (#${sync.externalTicketId})`
                                      : ""}
                                  </span>
                                ) : sync?.errorMessage ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
                                      ⚠️ Hata
                                    </span>
                                    <div
                                      className="text-[10px] text-rose-600 max-w-xs truncate"
                                      title={sync.errorMessage}
                                    >
                                      {sync.errorMessage}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-semibold px-2.5 py-0.5 rounded-full text-[11px]">
                                    ⏳ Bekliyor
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex flex-wrap justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleManualSyncOrderToPos(
                                        ord.id,
                                        "custom_pos"
                                      )
                                    }
                                    disabled={posSyncingOrderId === ord.id}
                                    className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                                  >
                                    📤 POS&apos;a Aktar
                                  </button>
                                  {ord.orderType === "delivery" &&
                                    ord.status !== "completed" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSimulateCustomPosEvent(
                                            ord.id,
                                            "ON_WAY",
                                            "NarPOS Kurye-1"
                                          )
                                        }
                                        disabled={posSyncingOrderId === ord.id}
                                        className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                                        title="NarPOS / Kerzz POS'tan Kurye Atamasını Siteye Yansıt"
                                      >
                                        🛵 Kurye Ata
                                      </button>
                                    )}
                                  {ord.status !== "completed" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSimulateCustomPosEvent(
                                          ord.id,
                                          "DELIVERED"
                                        )
                                      }
                                      disabled={posSyncingOrderId === ord.id}
                                      className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                                      title="NarPOS / Kerzz POS'tan Teslim Edildi Durumunu Siteye Yansıt"
                                    >
                                      🎉 Teslim Edildi
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : selectedPosSubTab === "adisyo" ? (
              <div className="space-y-6">
                {/* 1. Adisyo / Kurye POS Aktarım Zamanı & Bağlantı Modu */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">
                        1. Adisyo / Kurye POS Aktarım Zamanı &amp; Bağlantı Modu
                      </h3>
                      <p className="text-xs text-slate-500">
                        Siparişlerin Adisyo Bulut POS veya Kurye POS&apos;a ne zaman ve hangi yöntemle gönderileceğini seçin.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestPosConnection}
                        disabled={posTesting}
                        className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold px-3.5 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${posTesting ? "animate-spin" : ""}`}
                        />
                        {posTesting
                          ? "Test Ediliyor..."
                          : "🔌 Adisyo / Kurye POS Bağlantısını Test Et"}
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Ayarları Kaydet
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sipariş Ne Zaman Adisyo / Kurye POS&apos;a Aktarılsın?
                      </label>
                      <select
                        value={adisyoConfig.syncTrigger}
                        onChange={(e) =>
                          updateAdisyoConfigField({
                            syncTrigger: e.target.value as
                              | "on_accepted"
                              | "on_created"
                              | "manual",
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                      >
                        <option value="on_accepted">
                          ✅ Mutfak / Kasa Siparişi &quot;Kabul Et&quot; Dediğinde Otomatik Aktar (Önerilen)
                        </option>
                        <option value="on_created">
                          ⚡ Sipariş Geldiği Anda (Onay Beklemeden) Anında Otomatik Aktar
                        </option>
                        <option value="manual">
                          🖐️ Sadece Manuel (Mutfak/Yönetim Ekranında Butona Basınca Aktar)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Adisyo / Kurye POS Çalışma Modu
                      </label>
                      <select
                        value={adisyoConfig.mode}
                        onChange={(e) =>
                          updateAdisyoConfigField({
                            mode: e.target.value as
                              | "adisyo_cloud"
                              | "kurye_webhook"
                              | "simulation",
                          })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                      >
                        <option value="adisyo_cloud">
                          ☁️ Adisyo Bulut POS (Resmi External API v2 - ext-api.adisyo.com)
                        </option>
                        <option value="kurye_webhook">
                          🛵 Kurye POS / Özel HTTP Webhook Köprüsü
                        </option>
                        <option value="simulation">
                          🧪 Simülasyon &amp; Canlı Test Modu (API Anahtarı Olmadan Test Et)
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* 2. Adisyo API & Kimlik Bilgileri */}
                  <div className="space-y-4 pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                      2. Adisyo API Anahtarları, Şube &amp; Ödeme Tipi Eşleştirmesi
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          API / Webhook Sunucu Adresi
                        </label>
                        <input
                          type="text"
                          value={adisyoConfig.apiBaseUrl}
                          onChange={(e) =>
                            updateAdisyoConfigField({
                              apiBaseUrl: e.target.value,
                            })
                          }
                          placeholder="https://ext-api.adisyo.com"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Adisyo API Key (x-api-key)
                        </label>
                        <input
                          type="text"
                          value={adisyoConfig.apiKey}
                          onChange={(e) =>
                            updateAdisyoConfigField({ apiKey: e.target.value })
                          }
                          placeholder="Adisyo panelinden alınan x-api-key"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Adisyo API Secret (x-api-secret)
                        </label>
                        <input
                          type="password"
                          value={adisyoConfig.apiSecret}
                          onChange={(e) =>
                            updateAdisyoConfigField({
                              apiSecret: e.target.value,
                            })
                          }
                          placeholder="x-api-secret"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Consumer Kodu (x-consumer) &amp; Şube ID
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={adisyoConfig.consumerCode}
                            onChange={(e) =>
                              updateAdisyoConfigField({
                                consumerCode: e.target.value,
                              })
                            }
                            placeholder="restoran_online"
                            className="w-1/2 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                          />
                          <input
                            type="text"
                            value={adisyoConfig.restaurantId || ""}
                            onChange={(e) =>
                              updateAdisyoConfigField({
                                restaurantId: e.target.value,
                              })
                            }
                            placeholder="Şube Kodu"
                            className="w-1/2 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nakit Ödeme Tipi Kodu / Adı
                        </label>
                        <input
                          type="text"
                          value={adisyoConfig.cashPaymentTypeId}
                          onChange={(e) =>
                            updateAdisyoConfigField({
                              cashPaymentTypeId: e.target.value,
                            })
                          }
                          placeholder="Nakit"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Kredi Kartı Ödeme Tipi Kodu / Adı
                        </label>
                        <input
                          type="text"
                          value={adisyoConfig.cardPaymentTypeId}
                          onChange={(e) =>
                            updateAdisyoConfigField({
                              cardPaymentTypeId: e.target.value,
                            })
                          }
                          placeholder="Kredi Kartı"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Online / Açık Hesap Ödeme Tipi
                        </label>
                        <input
                          type="text"
                          value={adisyoConfig.onlinePaymentTypeId}
                          onChange={(e) =>
                            updateAdisyoConfigField({
                              onlinePaymentTypeId: e.target.value,
                            })
                          }
                          placeholder="Online / Açık Hesap"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                        />
                      </div>
                    </div>

                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-extrabold text-emerald-950">
                          📡 Adisyo / Kurye POS &rarr; Site Canlı Kurye &amp; Teslimat Webhook Adresi
                        </div>
                        <div className="text-[11px] text-emerald-800">
                          Adisyo veya Kurye POS üzerinde kurye atandığında (<code>ON_WAY</code>) veya sipariş teslim edildiğinde (<code>DELIVERED</code>) bu adrese bildirim geldiği anda sitede otomatik güncellenir:
                        </div>
                        <code className="inline-block bg-white border border-emerald-200 text-emerald-900 font-mono text-xs px-2.5 py-1 rounded-lg">
                          POST {originUrl}/api/pos-sync/adisyo-webhook
                        </code>
                      </div>
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-emerald-950 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={adisyoConfig.autoAssignCourierFromAdisyo !== false}
                          onChange={(e) =>
                            updateAdisyoConfigField({
                              autoAssignCourierFromAdisyo: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        Kurye &amp; Teslimat Durumunu Otomatik Eşitle
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3. Adisyo / Kurye POS Ürün & Katalog Eşleştirme Tablosu */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">
                        3. 🔄 Adisyo / Kurye POS Menü &amp; Ürün Eşleştirme
                      </h3>
                      <p className="text-xs text-slate-500">
                        Sitedeki ürünlerinizin Adisyo / Kurye POS karşılıklarını eşitleyin veya özel Adisyo ürün kodu tanımlayın.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncMenuToAdisyo}
                      disabled={posMenuSyncing}
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${posMenuSyncing ? "animate-spin" : ""}`}
                      />
                      {posMenuSyncing
                        ? "Eşitleniyor..."
                        : `🚀 Tüm Site Ürünlerini Adisyo / Kurye POS ile Eşitle (${items.length} Ürün)`}
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-96">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                        <tr>
                          <th className="py-2.5 px-3">Site Ürünü</th>
                          <th className="py-2.5 px-3">Kategori</th>
                          <th className="py-2.5 px-3">Fiyat</th>
                          <th className="py-2.5 px-3">Adisyo Ürün Kodu / Adı Eşleştirmesi</th>
                          <th className="py-2.5 px-3 text-right">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => {
                          const catName =
                            categories.find((c) => c.id === item.categoryId)
                              ?.name || "Genel";
                          const mappedVal =
                            adisyoConfig.productMappings?.[item.id] || "";
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80">
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {item.name}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {catName}
                              </td>
                              <td className="py-2 px-3 font-extrabold text-emerald-700">
                                {item.price.toFixed(2)} {settings.currency}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  defaultValue={mappedVal || item.name}
                                  onBlur={(e) => {
                                    const val = e.target.value.trim();
                                    if (val !== (mappedVal || item.name)) {
                                      handleSaveAdisyoProductMapping(
                                        item.id,
                                        val
                                      );
                                    }
                                  }}
                                  placeholder={`ADS-${101 + idx} veya ${item.name}`}
                                  className="w-full max-w-xs px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-medium"
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                                  ✅ Eşleşti (ADS-{101 + idx})
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Son Siparişlerin Adisyo / Kurye POS Aktarım & Canlı Kurye/Teslimat Tablosu */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">
                        4. 📋 Son Siparişlerin Adisyo / Kurye POS Aktarım &amp; Kurye Durumu
                      </h3>
                      <p className="text-xs text-slate-500">
                        Siparişleri Adisyo / Kurye POS&apos;a gönderebilir veya Adisyo üzerinden kurye ataması ve teslimat durumunu tek tıkla test edebilirsiniz.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBulkSyncPendingToPos}
                      disabled={posBulkSyncing}
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${posBulkSyncing ? "animate-spin" : ""}`}
                      />
                      {posBulkSyncing
                        ? "Aktarılıyor..."
                        : "🔄 Aktarılmamış Siparişleri Adisyo'ya Gönder"}
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                          <th className="py-2.5 px-3">Sipariş</th>
                          <th className="py-2.5 px-3">Müşteri / Masa</th>
                          <th className="py-2.5 px-3">Tutar</th>
                          <th className="py-2.5 px-3">Durum &amp; Kurye</th>
                          <th className="py-2.5 px-3">POS Aktarım Durumu</th>
                          <th className="py-2.5 px-3 text-right">Adisyo / Kurye POS İşlemleri</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.slice(0, 15).map((ord) => {
                          const sync = ord.posSyncInfo;
                          return (
                            <tr key={ord.id} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3 font-black text-slate-900">
                                #{ord.orderNumber}
                                <div className="text-[10px] font-normal text-slate-400">
                                  {new Date(ord.createdAt).toLocaleTimeString(
                                    "tr-TR",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-800">
                                  {ord.orderType === "dine_in"
                                    ? `🪑 Masa ${ord.tableNumber || "?"}`
                                    : ord.customerName}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {ord.orderType === "delivery"
                                    ? "🛵 Paket Servis"
                                    : ord.orderType === "pickup"
                                    ? "🛍️ Gel-Al"
                                    : "🍽️ Masada"}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-emerald-700">
                                {ord.totalAmount.toFixed(2)} {settings.currency}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-col gap-1 items-start">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                      ord.status === "completed"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : ord.status === "ready"
                                        ? "bg-indigo-100 text-indigo-800"
                                        : ord.status === "accepted"
                                        ? "bg-amber-100 text-amber-800"
                                        : ord.status === "rejected"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {ord.status === "completed"
                                      ? "🎉 Teslim Edildi"
                                      : ord.status === "ready"
                                      ? "🛵 Kuryede / Hazır"
                                      : ord.status === "accepted"
                                      ? "🔥 Hazırlanıyor"
                                      : ord.status === "rejected"
                                      ? "❌ İptal"
                                      : "⏳ Bekliyor"}
                                  </span>
                                  {ord.courierName && (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md text-[10px]">
                                      🛵 {ord.courierName}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                {sync?.status === "synced" ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
                                    ✅ Aktarıldı
                                    {sync.externalTicketId
                                      ? ` (#${sync.externalTicketId})`
                                      : ""}
                                  </span>
                                ) : sync?.errorMessage ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
                                      ⚠️ Hata
                                    </span>
                                    <div
                                      className="text-[10px] text-rose-600 max-w-xs truncate"
                                      title={sync.errorMessage}
                                    >
                                      {sync.errorMessage}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-semibold px-2.5 py-0.5 rounded-full text-[11px]">
                                    ⏳ Bekliyor
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex flex-wrap justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleManualSyncOrderToPos(
                                        ord.id,
                                        "adisyo"
                                      )
                                    }
                                    disabled={posSyncingOrderId === ord.id}
                                    className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                                  >
                                    📤 Adisyo&apos;ya Aktar
                                  </button>
                                  {ord.orderType === "delivery" &&
                                    ord.status !== "completed" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSimulateAdisyoEvent(
                                            ord.id,
                                            "ON_WAY",
                                            "Adisyo Kurye-1"
                                          )
                                        }
                                        disabled={posSyncingOrderId === ord.id}
                                        className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                                        title="Adisyo / Kurye POS'tan Kurye Atamasını Siteye Yansıt"
                                      >
                                        🛵 Kurye Ata
                                      </button>
                                    )}
                                  {ord.status !== "completed" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSimulateAdisyoEvent(
                                          ord.id,
                                          "DELIVERED"
                                        )
                                      }
                                      disabled={posSyncingOrderId === ord.id}
                                      className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                                      title="Adisyo / Kurye POS'tan Teslim Edildi Durumunu Siteye Yansıt"
                                    >
                                      🎉 Teslim Edildi
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <>
            {/* Bağlantı Modu ve Tetikleme Zamanı */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    1. Aktarım Zamanı & Bağlantı Yöntemi
                  </h3>
                  <p className="text-xs text-slate-500">
                    Siparişlerin SambaPOS&apos;a ne zaman ve hangi protokolle gönderileceğini seçin.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestPosConnection}
                    disabled={posTesting}
                    className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-extrabold px-3.5 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${posTesting ? "animate-spin" : ""}`}
                    />
                    {posTesting
                      ? "SambaPOS Test Ediliyor..."
                      : "🔌 SambaPOS Bağlantısını Test Et"}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Ayarları Kaydet
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sipariş Ne Zaman SambaPOS&apos;a Aktarılsın?
                  </label>
                  <select
                    value={sambaConfig.syncTrigger}
                    onChange={(e) =>
                      updateSambaConfigField({
                        syncTrigger: e.target.value as
                          | "on_accepted"
                          | "on_created"
                          | "manual",
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                  >
                    <option value="on_accepted">
                      ✅ Mutfak / Kasa Siparişi &quot;Kabul Et&quot; Dediğinde Otomatik Aktar (Önerilen)
                    </option>
                    <option value="on_created">
                      ⚡ Sipariş Geldiği Anda (Onay Beklemeden) Anında Otomatik Aktar
                    </option>
                    <option value="manual">
                      🖐️ Sadece Manuel (Mutfak/Yönetim Ekranında Butona Basınca Aktar)
                    </option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Netlify bulut sitesinden gelen siparişler de Kasa PC tarafından çekildiği anda bu kurala göre otomatik SambaPOS&apos;a düşer.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bağlantı Türü (Protokol)
                  </label>
                  <select
                    value={sambaConfig.mode}
                    onChange={(e) =>
                      updateSambaConfigField({
                        mode: e.target.value as "graphql" | "webhook",
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                  >
                    <option value="graphql">
                      🍽️ SambaPOS V5 Message Server (GraphQL API - Port 9000)
                    </option>
                    <option value="webhook">
                      🌐 Özel HTTP Webhook / JSON Köprüsü (Herhangi Bir POS İçin)
                    </option>
                  </select>
                </div>
              </div>

              {sambaConfig.mode === "graphql" ? (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                    2. SambaPOS V5 Message Server & Eşleştirme Ayarları
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Message Server Adresi (Port 9000)
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.serverUrl}
                        onChange={(e) =>
                          updateSambaConfigField({ serverUrl: e.target.value })
                        }
                        placeholder="http://localhost:9000"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Uygulama (Application) Client ID
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.clientId}
                        onChange={(e) =>
                          updateSambaConfigField({ clientId: e.target.value })
                        }
                        placeholder="restoran_pos"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        SambaPOS Kullanıcı Şifresi / PIN
                      </label>
                      <input
                        type="password"
                        value={sambaConfig.password}
                        onChange={(e) =>
                          updateSambaConfigField({ password: e.target.value })
                        }
                        placeholder="1234"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        SambaPOS Kullanıcı Adı
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.username}
                        onChange={(e) =>
                          updateSambaConfigField({
                            username: e.target.value,
                            userName: e.target.value,
                          })
                        }
                        placeholder="Admin"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Departman Adı (Department)
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.departmentName}
                        onChange={(e) =>
                          updateSambaConfigField({
                            departmentName: e.target.value,
                          })
                        }
                        placeholder="Restoran"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Fiş / Adisyon Tipi (Ticket Type)
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.ticketTypeName}
                        onChange={(e) =>
                          updateSambaConfigField({
                            ticketTypeName: e.target.value,
                          })
                        }
                        placeholder="Adisyon"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Terminal Adı
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.terminalName}
                        onChange={(e) =>
                          updateSambaConfigField({
                            terminalName: e.target.value,
                          })
                        }
                        placeholder="Sunucu"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Masa Varlık Tipi (Entity Type)
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.tableEntityType}
                        onChange={(e) =>
                          updateSambaConfigField({
                            tableEntityType: e.target.value,
                          })
                        }
                        placeholder="Masalar"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Müşteri Varlık Tipi (Entity Type)
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.customerEntityType}
                        onChange={(e) =>
                          updateSambaConfigField({
                            customerEntityType: e.target.value,
                          })
                        }
                        placeholder="Müşteriler"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Sipariş Etiketi Grubu (Order Tag)
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.defaultOrderTagName}
                        onChange={(e) =>
                          updateSambaConfigField({
                            defaultOrderTagName: e.target.value,
                          })
                        }
                        placeholder="Default"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
                      <label className="block text-xs font-extrabold text-amber-900 mb-1">
                        🛡️ Yedek (Fallback) Ürün Adı (Ürün İsmi Eşleşmezse)
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.fallbackMenuItemName || ""}
                        onChange={(e) =>
                          updateSambaConfigField({
                            fallbackMenuItemName: e.target.value,
                          })
                        }
                        placeholder="Online Sipariş Ürünü"
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm"
                      />
                      <p className="text-[11px] text-amber-800 mt-1">
                        Web sitesindeki bir ürün adı SambaPOS menüsünde birebir yoksa, siparişin hata vermemesi için SambaPOS&apos;ta açacağınız bu genel ürün adıyla (gerçek fiyat ve ürün adı notta yazarak) adisyon oluşturulur.
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                      <label className="flex items-center gap-2 text-xs font-extrabold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(sambaConfig.autoCreateCustomerEntity)}
                          onChange={(e) =>
                            updateSambaConfigField({
                              autoCreateCustomerEntity: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-indigo-600 rounded"
                        />
                        Paket Serviste Müşteri Varlığını Eşleştir & Masa Ön Eki
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.tableEntityPrefix}
                        onChange={(e) =>
                          updateSambaConfigField({
                            tableEntityPrefix: e.target.value,
                          })
                        }
                        placeholder="Masa "
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                      <p className="text-[11px] text-slate-500">
                        Örn: QR Masadan &quot;5&quot; geldiğinde SambaPOS&apos;ta <code>Masa 5</code> varlığına bağlar.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                    2. Özel HTTP Webhook / JSON Köprüsü Ayarları
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Webhook Hedef URL (POST)
                      </label>
                      <input
                        type="text"
                        value={sambaConfig.serverUrl}
                        onChange={(e) =>
                          updateSambaConfigField({ serverUrl: e.target.value })
                        }
                        placeholder="http://localhost:9005/sambapos-bridge"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Gizli Anahtar / API Şifresi (İsteğe Bağlı)
                      </label>
                      <input
                        type="password"
                        value={sambaConfig.password}
                        onChange={(e) =>
                          updateSambaConfigField({
                            password: e.target.value,
                          })
                        }
                        placeholder="İsteğe bağlı güvenlik anahtarı"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. MENÜ EŞLEŞTİRME & SİTEDEKİ ÜRÜNLERİ SAMBAPOS'A AKTARMA */}
            <div className="bg-white p-6 rounded-2xl border-2 border-indigo-200 shadow-xs space-y-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                    🔄 Otomatik Ürün &amp; Kategori Eşitleme
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    3. Menü Eşleştirme &amp; Sitedeki Ürünleri SambaPOS&apos;a Aktarma
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sitedeki tüm ürünleri kategorileri ve fiyatlarıyla birlikte tek tıkla <strong>SambaPOS Ürün Listesine</strong> ve <strong>POS Dokunmatik Menü Ekranına</strong> aktarabilir veya mevcut SambaPOS ürünleriyle birebir eşleştirebilirsiniz.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleFetchSambaCatalog(true)}
                    disabled={posCatalogLoading || posMenuSyncing}
                    className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${posCatalogLoading ? "animate-spin" : ""}`}
                    />
                    {posCatalogLoading
                      ? "Sorgulanıyor..."
                      : "🔍 SambaPOS Ürünlerini Sorgula"}
                  </button>

                  {sambaCatalog && sambaCatalog.stats.missingCount > 0 && (
                    <button
                      type="button"
                      disabled={posMenuSyncing}
                      onClick={() => {
                        const missingIds = sambaCatalog.items
                          .filter((x) => x.status === "missing")
                          .map((x) => x.siteItemId);
                        handleSyncMenuToSamba({
                          itemIds: missingIds,
                          updatePrices: false,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      ➕ Sadece Eksik ({sambaCatalog.stats.missingCount}) Ürünü Ekle
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={posMenuSyncing}
                    onClick={() =>
                      handleSyncMenuToSamba({ updatePrices: true })
                    }
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${posMenuSyncing ? "animate-spin" : ""}`}
                    />
                    {posMenuSyncing
                      ? "SambaPOS'a Aktarılıyor..."
                      : `🚀 Sitedeki Tüm Ürünleri SambaPOS'a Aktar & Eşitle (${items.length})`}
                  </button>
                </div>
              </div>

              {/* Canlı Eşleşme İstatistik Kutuları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-slate-500">
                    📦 Sitedeki Menü Ürünleri
                  </div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {items.length} Ürün
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {categories.length} Kategori • SambaPOS Toplam:{" "}
                    {sambaCatalog?.stats.totalSambaProducts ?? "..."}
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-emerald-700">
                    ✅ Tam Eşleşen (İsim + Fiyat)
                  </div>
                  <div className="text-lg font-black text-emerald-900 mt-0.5">
                    {sambaCatalog?.stats.matchedCount ?? 0} Ürün
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    SambaPOS&apos;ta hazır ve güncel
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-amber-800">
                    🔄 Fiyatı Farklı Olan
                  </div>
                  <div className="text-lg font-black text-amber-900 mt-0.5">
                    {sambaCatalog?.stats.priceDiffCount ?? 0} Ürün
                  </div>
                  <div className="text-[10px] text-amber-700">
                    Tek tıkla site fiyatına eşitlenir
                  </div>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-rose-700">
                    ⚠️ SambaPOS&apos;ta Eksik Olan
                  </div>
                  <div className="text-lg font-black text-rose-900 mt-0.5">
                    {sambaCatalog?.stats.missingCount ?? 0} Ürün
                  </div>
                  <div className="text-[10px] text-rose-700">
                    Aktar butonuna basınca otomatik açılır
                  </div>
                </div>
              </div>

              {/* Seçenek: POS Dokunmatik Menü Ekranına da Ekle */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/60 border border-indigo-200/80 rounded-xl px-4 py-3">
                <label className="flex items-center gap-2.5 text-xs font-extrabold text-indigo-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sambaConfig.syncToScreenMenu !== false}
                    onChange={(e) =>
                      updateSambaConfigField({
                        syncToScreenMenu: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <span>
                    🖥️ Aktarılan ürünleri ve kategorileri SambaPOS&apos;un dokunmatik <strong>POS Menü Ekranına da (Buton Olarak)</strong> otomatik ekle
                  </span>
                </label>

                {sambaConfig.lastMenuSyncedAt && (
                  <span className="text-[11px] font-bold text-indigo-700">
                    Son Menü Aktarımı:{" "}
                    {new Date(sambaConfig.lastMenuSyncedAt).toLocaleString(
                      "tr-TR"
                    )}
                  </span>
                )}
              </div>

              {/* Filtre ve Arama Çubuğu */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={posMenuSearch}
                  onChange={(e) => setPosMenuSearch(e.target.value)}
                  placeholder="🔎 Ürün veya kategori ara..."
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                />

                <select
                  value={posMenuFilterCat}
                  onChange={(e) => setPosMenuFilterCat(e.target.value)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                >
                  <option value="all">📂 Tüm Kategoriler ({categories.length})</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>

                <select
                  value={posMenuFilterStatus}
                  onChange={(e) =>
                    setPosMenuFilterStatus(
                      e.target.value as
                        | "all"
                        | "matched"
                        | "price_diff"
                        | "missing"
                    )
                  }
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                >
                  <option value="all">📊 Tüm Durumlar ({items.length})</option>
                  <option value="matched">
                    ✅ Tam Eşleşenler ({sambaCatalog?.stats.matchedCount ?? 0})
                  </option>
                  <option value="price_diff">
                    🔄 Fiyatı Farklı Olanlar ({sambaCatalog?.stats.priceDiffCount ?? 0})
                  </option>
                  <option value="missing">
                    ⚠️ SambaPOS&apos;ta Eksik Olanlar ({sambaCatalog?.stats.missingCount ?? 0})
                  </option>
                </select>
              </div>

              {/* SambaPOS Mevcut Ürünler Datalist (Özel Eşleştirme İçin Otomatik Tamamlama) */}
              <datalist id="sambapos-existing-products-list">
                {(sambaCatalog?.sambaProducts || []).map((sp) => (
                  <option key={sp.id} value={sp.name}>
                    {sp.groupCode} • {sp.price.toFixed(2)} {settings.currency}
                  </option>
                ))}
              </datalist>

              {/* Birebir Ürün Eşleştirme ve Aktarım Tablosu */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[480px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700 font-extrabold">
                    <tr>
                      <th className="py-2.5 px-3">Sitedeki Ürün & Kategori</th>
                      <th className="py-2.5 px-3">Site Fiyatı</th>
                      <th className="py-2.5 px-3">
                        SambaPOS Ürün Karşılığı (Boş = Kendi Adıyla Aktarır)
                      </th>
                      <th className="py-2.5 px-3">SambaPOS Durumu & Fiyatı</th>
                      <th className="py-2.5 px-3 text-right">Tekil İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(
                      sambaCatalog?.items ||
                      items.map((it) => {
                        const catName =
                          categories.find((c) => c.id === it.categoryId)
                            ?.name || "Online Sipariş";
                        const mapped =
                          sambaConfig.productMappings?.[it.id] || "";
                        return {
                          siteItemId: it.id,
                          siteItemName: it.name,
                          categoryId: it.categoryId,
                          categoryName: catName,
                          sitePrice: it.price,
                          available: it.available,
                          mappedSambaName: mapped,
                          targetSambaName: mapped || it.name,
                          status: "missing" as const,
                          sambaProductId: null,
                          sambaGroupCode: null,
                          sambaPrice: null,
                        };
                      })
                    )
                      .filter((row) => {
                        if (
                          posMenuFilterCat !== "all" &&
                          row.categoryId !== posMenuFilterCat
                        ) {
                          return false;
                        }
                        if (
                          posMenuFilterStatus !== "all" &&
                          row.status !== posMenuFilterStatus
                        ) {
                          return false;
                        }
                        if (posMenuSearch.trim()) {
                          const q = posMenuSearch.trim().toLowerCase();
                          return (
                            row.siteItemName.toLowerCase().includes(q) ||
                            row.categoryName.toLowerCase().includes(q) ||
                            row.targetSambaName.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      })
                      .map((row) => {
                        const currentMapping =
                          sambaConfig.productMappings?.[row.siteItemId] ??
                          row.mappedSambaName ??
                          "";
                        return (
                          <tr
                            key={row.siteItemId}
                            className="hover:bg-slate-50/90"
                          >
                            <td className="py-2.5 px-3">
                              <div className="font-extrabold text-slate-900">
                                {row.siteItemName}
                              </div>
                              <div className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md mt-0.5">
                                {row.categoryName}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 font-black text-slate-900 whitespace-nowrap">
                              {row.sitePrice.toFixed(2)} {settings.currency}
                            </td>

                            <td className="py-2.5 px-3 min-w-[230px]">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  list="sambapos-existing-products-list"
                                  value={currentMapping}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateSambaConfigField({
                                      productMappings: {
                                        ...(sambaConfig.productMappings || {}),
                                        [row.siteItemId]: val,
                                      },
                                    });
                                  }}
                                  onBlur={(e) =>
                                    handleSaveProductMapping(
                                      row.siteItemId,
                                      e.target.value
                                    )
                                  }
                                  placeholder={`Otomatik: ${row.siteItemName}`}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:border-indigo-500 focus:outline-none"
                                />
                                {currentMapping && (
                                  <button
                                    type="button"
                                    title="Özel eşleştirmeyi sıfırla (Kendi adını kullan)"
                                    onClick={() =>
                                      handleSaveProductMapping(
                                        row.siteItemId,
                                        ""
                                      )
                                    }
                                    className="text-slate-400 hover:text-rose-600 font-bold px-1.5 py-1 rounded cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-3">
                              {row.status === "matched" ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
                                    ✅ SambaPOS&apos;ta Kayıtlı
                                  </span>
                                  <div className="text-[10px] text-slate-500">
                                    Grup: <strong>{row.sambaGroupCode || "-"}</strong> • Fiyat:{" "}
                                    <strong>
                                      {(row.sambaPrice ?? 0).toFixed(2)}{" "}
                                      {settings.currency}
                                    </strong>
                                  </div>
                                </div>
                              ) : row.status === "price_diff" ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
                                    🔄 Fiyat Farklı
                                  </span>
                                  <div className="text-[10px] text-amber-800">
                                    SambaPOS:{" "}
                                    <strong>
                                      {(row.sambaPrice ?? 0).toFixed(2)}{" "}
                                      {settings.currency}
                                    </strong>{" "}
                                    &rarr; Site:{" "}
                                    <strong>
                                      {row.sitePrice.toFixed(2)}{" "}
                                      {settings.currency}
                                    </strong>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
                                    ⚠️ SambaPOS&apos;ta Yok
                                  </span>
                                  <div className="text-[10px] text-slate-500">
                                    Aktarılınca <strong>{row.categoryName}</strong> grubuna eklenecek
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                disabled={
                                  posSyncingItemId === row.siteItemId ||
                                  posMenuSyncing
                                }
                                onClick={() =>
                                  handleSyncMenuToSamba({
                                    itemIds: [row.siteItemId],
                                    updatePrices: true,
                                  })
                                }
                                className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-50 ${
                                  row.status === "matched"
                                    ? "bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700"
                                    : row.status === "price_diff"
                                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                }`}
                              >
                                <RefreshCw
                                  className={`w-3 h-3 ${
                                    posSyncingItemId === row.siteItemId
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                                {posSyncingItemId === row.siteItemId
                                  ? "Aktarılıyor..."
                                  : row.status === "matched"
                                  ? "🔄 Tekrar Eşitle"
                                  : row.status === "price_diff"
                                  ? "💰 Fiyatı Eşitle"
                                  : "📤 SambaPOS'a Aktar"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Canlı Sipariş Aktarım Tablosu & Tek Tıkla Manuel Aktarım */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    4. 📋 Son Siparişlerin SambaPOS Aktarım &amp; Kurye/Teslimat Durumu
                  </h3>
                  <p className="text-xs text-slate-500">
                    SambaPOS&apos;ta kurye ataması veya &quot;Teslim Edildi / Ödendi&quot; yapıldığında sitede otomatik güncellenir.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncStatusesFromSambaPos}
                    disabled={posBulkSyncing}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${posBulkSyncing ? "animate-spin" : ""}`}
                    />
                    📥 SambaPOS&apos;tan Kurye &amp; Teslimat Durumlarını Eşitle
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkSyncPendingToPos}
                    disabled={posBulkSyncing}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${posBulkSyncing ? "animate-spin" : ""}`}
                    />
                    {posBulkSyncing
                      ? "Aktarılıyor..."
                      : "🔄 Aktarılmamış Siparişleri Gönder"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                      <th className="py-2.5 px-3">Sipariş</th>
                      <th className="py-2.5 px-3">Müşteri / Masa</th>
                      <th className="py-2.5 px-3">Tutar</th>
                      <th className="py-2.5 px-3">Durum &amp; Kurye</th>
                      <th className="py-2.5 px-3">SambaPOS Aktarım Durumu</th>
                      <th className="py-2.5 px-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 15).map((ord) => {
                      const sync = ord.posSyncInfo;
                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-black text-slate-900">
                            #{ord.orderNumber}
                            <div className="text-[10px] font-normal text-slate-400">
                              {new Date(ord.createdAt).toLocaleTimeString(
                                "tr-TR",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">
                              {ord.orderType === "dine_in"
                                ? `🪑 Masa ${ord.tableNumber || "?"}`
                                : ord.customerName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {ord.orderType === "delivery"
                                ? "🛵 Paket Servis"
                                : ord.orderType === "pickup"
                                ? "🛍️ Gel-Al"
                                : "🍽️ Masada"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-extrabold text-emerald-700">
                            {ord.totalAmount.toFixed(2)} {settings.currency}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  ord.status === "completed"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : ord.status === "ready"
                                    ? "bg-indigo-100 text-indigo-800"
                                    : ord.status === "accepted"
                                    ? "bg-amber-100 text-amber-800"
                                    : ord.status === "rejected"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {ord.status === "completed"
                                  ? "🎉 Teslim Edildi"
                                  : ord.status === "ready"
                                  ? "🛵 Kuryede / Hazır"
                                  : ord.status === "accepted"
                                  ? "🔥 Hazırlanıyor"
                                  : ord.status === "rejected"
                                  ? "❌ İptal"
                                  : "⏳ Bekliyor"}
                              </span>
                              {ord.courierName && (
                                <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-800 font-extrabold px-2 py-0.5 rounded-md text-[10px]">
                                  🛵 {ord.courierName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {sync?.status === "synced" ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
                                  ✅ SambaPOS&apos;a Aktarıldı
                                  {sync.externalTicketId
                                    ? ` (Fiş #${sync.externalTicketId})`
                                    : ""}
                                </span>
                                {sync.errorMessage && (
                                  <div className="text-[10px] text-amber-700">
                                    ℹ️ {sync.errorMessage}
                                  </div>
                                )}
                              </div>
                            ) : sync?.errorMessage ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-extrabold px-2.5 py-0.5 rounded-full text-[11px]">
                                  ⚠️ Hata Oluştu
                                </span>
                                <div className="text-[10px] text-rose-600 max-w-xs truncate" title={sync.errorMessage}>
                                  {sync.errorMessage}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-semibold px-2.5 py-0.5 rounded-full text-[11px]">
                                ⏳ Henüz Aktarılmadı
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleManualSyncOrderToPos(ord.id)}
                              disabled={posSyncingOrderId === ord.id}
                              className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${
                                  posSyncingOrderId === ord.id
                                    ? "animate-spin"
                                    : ""
                                }`}
                              />
                              {sync?.status === "synced"
                                ? "Tekrar Gönder"
                                : "SambaPOS'a Aktar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3 Adımda SambaPOS V5 Hazırlık Rehberi */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-5 space-y-3">
              <h4 className="font-extrabold text-sm text-indigo-950 flex items-center gap-2">
                📖 SambaPOS V5 Tarafında Yapılması Gereken 3 Kısa Ayar (1 Dakika)
              </h4>
              <ol className="list-decimal list-inside space-y-2 text-xs text-indigo-900 leading-relaxed">
                <li>
                  <strong>SambaPOS Message Server&apos;ı Açın:</strong> Kasa bilgisayarında SambaPOS kurulum klasöründeki <code>Samba.MessagingServerServiceTool.exe</code> (veya Message Server) aracında portun <strong>9000</strong> olduğundan ve servisin çalıştığından emin olun.
                </li>
                <li>
                  <strong>Uygulama (Application) Tanımlayın:</strong> SambaPOS içinde <strong>Yönetim (Manage) → Kullanıcılar (Users) → Uygulamalar (Applications) → Uygulama Ekle</strong> menüsüne girin. Uygulama Adı (Identifier / Client ID) kısmına <code>restoran_pos</code>, İzin Türü (Permission) kısmına <code>Password</code> yazıp kaydedin.
                </li>
                <li>
                  <strong>Yedek Ürün Oluşturun (Önerilen):</strong> Online menüdeki bir ürünün ismi SambaPOS menüsüyle birebir tutmazsa bile siparişin eksiksiz düşmesi için SambaPOS Ürün Listesine <strong><code>Online Sipariş Ürünü</code></strong> adında (fiyatı 1 TL veya 0 TL olan) bir ürün ekleyin. Sistem gerçek ürün adını ve gerçek fiyatını otomatik olarak adisyona basacaktır!
                </li>
              </ol>
            </div>
              </>
            )}
          </form>
        )}
      </main>

      {/* Ürün Ekleme / Düzenleme Modalı */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveItem}
            className="bg-white w-full max-w-xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold text-slate-900">
              {editingItem.id ? "Ürünü Düzenle" : "Yeni Ürün Ekle"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ürün Adı *
                </label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kategori *
                </label>
                <select
                  value={editingItem.categoryId}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      categoryId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Açıklama / İçindekiler
              </label>
              <textarea
                rows={2}
                value={editingItem.description}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    description: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Satış Fiyatı ({settings?.currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editingItem.price}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      price: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-rose-700 mb-1">
                  Eski Fiyat (Üstü Çizili - Opsiyonel)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editingItem.originalPrice ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      originalPrice:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  placeholder="Örn: 320"
                  className="w-full px-3 py-2 text-sm border border-rose-200 bg-rose-50/30 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-700 mb-1">
                  Birim Maliyet ({settings?.currency} - Opsiyonel)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={editingItem.costPrice ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      costPrice:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                  placeholder="Örn: 85"
                  className="w-full px-3 py-2 text-sm border border-emerald-200 bg-emerald-50/30 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Görsel URL
                </label>
                <input
                  type="text"
                  value={editingItem.imageUrl}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      imageUrl: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* 🌶️ Görsel Lezzet & İçerik Rozetleri (Müşteri Vitrininde Gösterilir) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="text-xs font-extrabold text-slate-800">
                🌶️ Müşteri Vitrininde Görünecek Lezzet & İçerik Rozetleri (İsteğe Bağlı)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "spicy", label: "🌶️ Acılı" },
                  { id: "chef", label: "👨‍🍳 Şefin Spesiyali" },
                  { id: "new", label: "🆕 Yeni Lezzet" },
                  { id: "wood_fire", label: "🔥 Odun Ateşinde" },
                  { id: "meat_100", label: "🥩 %100 Yaprak Et" },
                  { id: "veg", label: "🥗 Vejetaryen" },
                  { id: "fast", label: "⏱️ Hızlı Servis" },
                ].map((b) => {
                  const currentBadges = editingItem.badges || [];
                  const isSel = currentBadges.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        const next = isSel
                          ? currentBadges.filter((x) => x !== b.id)
                          : [...currentBadges, b.id];
                        setEditingItem({
                          ...editingItem,
                          badges: next,
                        });
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        isSel
                          ? "bg-orange-600 text-white border-orange-600 shadow-2xs"
                          : "bg-white text-slate-700 border-slate-200 hover:border-orange-300"
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Popüler & Stokta Durumu */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editingItem.popular)}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      popular: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-orange-600"
                />
                <span>🔥 Popüler Ürün Olarak İşaretle</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(editingItem.available)}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      available: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
                <span>🟢 Stokta Mevcut (Satışa Açık)</span>
              </label>
            </div>

            {/* Günlük Porsiyon / Kritik Stok Sayacı */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-extrabold text-amber-900">
                    📦 Günlük Porsiyon / Kritik Stok Sayacı (İsteğe Bağlı)
                  </span>
                  <p className="text-[11px] text-amber-800/80">
                    Boş bırakırsanız sınırsız satılır. Sayı girerseniz her siparişte otomatik düşer, 5 ve altında &quot;🔥 Son X Porsiyon!&quot; uyarısı çıkar, 0 olduğunda otomatik &quot;Tükendi&quot; olur.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Sınırsız"
                    value={
                      editingItem.dailyStock === null ||
                      editingItem.dailyStock === undefined
                        ? ""
                        : editingItem.dailyStock
                    }
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (val === "") {
                        setEditingItem({
                          ...editingItem,
                          dailyStock: null,
                        });
                      } else {
                        const num = Math.max(0, Number(val));
                        setEditingItem({
                          ...editingItem,
                          dailyStock: num,
                          available: num > 0 ? true : editingItem.available,
                        });
                      }
                    }}
                    className="w-28 px-3 py-1.5 text-sm font-black text-slate-900 bg-white border border-amber-300 rounded-xl"
                  />
                  {editingItem.dailyStock !== null &&
                    editingItem.dailyStock !== undefined && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingItem({
                            ...editingItem,
                            dailyStock: null,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                      >
                        Sınırsız Yap
                      </button>
                    )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[5, 10, 20, 30, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setEditingItem({
                        ...editingItem,
                        dailyStock: preset,
                        available: true,
                      })
                    }
                    className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-white hover:bg-amber-600 text-amber-900 hover:text-white border border-amber-200 transition cursor-pointer"
                  >
                    {preset} Porsiyon
                  </button>
                ))}
              </div>
            </div>

            {/* Opsiyon Grupları & Hazır Şablonlar */}
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold uppercase text-slate-600">
                  Porsiyon, Opsiyon & Ekstra Malzeme Grupları ({editingItem.modifierGroups.length})
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const nextGroup: ModifierGroup = {
                      id: `mod-${Date.now()}`,
                      name: "Porsiyon / Ekstra Seçimi",
                      required: false,
                      multiSelect: true,
                      options: [
                        { id: `opt-${Date.now()}-1`, name: "Standart", price: 0 },
                      ],
                    };
                    setEditingItem({
                      ...editingItem,
                      modifierGroups: [
                        ...editingItem.modifierGroups,
                        nextGroup,
                      ],
                    });
                  }}
                  className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
                >
                  + Boş Opsiyon Grubu Ekle
                </button>
              </div>

              {/* Tek Tıkla Hazır Şablon Butonları */}
              <div className="flex flex-wrap items-center gap-1.5 bg-orange-50/70 p-2.5 rounded-xl border border-orange-100">
                <span className="text-[11px] font-bold text-orange-800 mr-1">
                  Hazır Şablon Ekle:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const tpl: ModifierGroup = {
                      id: `mod-por-${Date.now()}`,
                      name: "Porsiyon Seçimi",
                      required: true,
                      multiSelect: false,
                      options: [
                        { id: `o-${Date.now()}-1`, name: "1 Porsiyon (Standart)", price: 0 },
                        { id: `o-${Date.now()}-2`, name: "1.5 Porsiyon (Doyuran)", price: Math.round(editingItem.price * 0.45) },
                        { id: `o-${Date.now()}-3`, name: "Duble Porsiyon", price: Math.round(editingItem.price * 0.85) },
                      ],
                    };
                    setEditingItem({
                      ...editingItem,
                      modifierGroups: [...editingItem.modifierGroups, tpl],
                    });
                  }}
                  className="text-[11px] font-bold bg-white hover:bg-orange-600 hover:text-white text-slate-800 border border-orange-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  + Porsiyon Seçimi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tpl: ModifierGroup = {
                      id: `mod-aci-${Date.now()}`,
                      name: "Acı / Pişirme Tercihi",
                      required: true,
                      multiSelect: false,
                      options: [
                        { id: `o-${Date.now()}-1`, name: "Acısız", price: 0 },
                        { id: `o-${Date.now()}-2`, name: "Az Acılı", price: 0 },
                        { id: `o-${Date.now()}-3`, name: "Bol Acılı", price: 0 },
                      ],
                    };
                    setEditingItem({
                      ...editingItem,
                      modifierGroups: [...editingItem.modifierGroups, tpl],
                    });
                  }}
                  className="text-[11px] font-bold bg-white hover:bg-orange-600 hover:text-white text-slate-800 border border-orange-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  + Acı Tercihi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tpl: ModifierGroup = {
                      id: `mod-cikar-${Date.now()}`,
                      name: "Çıkarılacak Malzemeler",
                      required: false,
                      multiSelect: true,
                      options: [
                        { id: `o-${Date.now()}-1`, name: "Soğansız Olsun", price: 0 },
                        { id: `o-${Date.now()}-2`, name: "Domatessiz Olsun", price: 0 },
                        { id: `o-${Date.now()}-3`, name: "Maydanozsuz Olsun", price: 0 },
                        { id: `o-${Date.now()}-4`, name: "Baharatsız Olsun", price: 0 },
                      ],
                    };
                    setEditingItem({
                      ...editingItem,
                      modifierGroups: [...editingItem.modifierGroups, tpl],
                    });
                  }}
                  className="text-[11px] font-bold bg-white hover:bg-orange-600 hover:text-white text-slate-800 border border-orange-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  + Çıkarılacak Malzeme
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tpl: ModifierGroup = {
                      id: `mod-ekstra-${Date.now()}`,
                      name: "Ekstra Yan Lezzetler",
                      required: false,
                      multiSelect: true,
                      options: [
                        { id: `o-${Date.now()}-1`, name: "Ekstra Sıcak Lavaş", price: 20 },
                        { id: `o-${Date.now()}-2`, name: "Közlenmiş Biber & Domates", price: 35 },
                        { id: `o-${Date.now()}-3`, name: "Ekstra Kaşar / Sos", price: 30 },
                      ],
                    };
                    setEditingItem({
                      ...editingItem,
                      modifierGroups: [...editingItem.modifierGroups, tpl],
                    });
                  }}
                  className="text-[11px] font-bold bg-white hover:bg-orange-600 hover:text-white text-slate-800 border border-orange-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                >
                  + Ekstra Malzemeler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const count =
                      editingItem.modifierGroups.filter((g) =>
                        Boolean(g.productTag)
                      ).length + 1;
                    const now = Date.now();
                    const tpl: ModifierGroup = {
                      id: `mod-kamp-urun-${now}`,
                      productTag: `🍖 ${count}. ÜRÜN: Ana Yemek / Kampanya Ürünü`,
                      name: `${count}. Ürün & Porsiyon Seçimi`,
                      required: true,
                      multiSelect: false,
                      options: [
                        {
                          id: `o-${now}-1`,
                          name: "1 Porsiyon (Standart)",
                          price: 0,
                          subOptions: [
                            {
                              id: `so-${now}-1`,
                              name: "Ekstra Sıcak Lavaş",
                              price: 20,
                            },
                            {
                              id: `so-${now}-2`,
                              name: "Ekstra Kaşar / Sos",
                              price: 35,
                            },
                            {
                              id: `so-${now}-3`,
                              name: "Soğansız Olsun",
                              price: 0,
                            },
                          ],
                        },
                        {
                          id: `o-${now}-2`,
                          name: "1.5 Porsiyon (Doyuran)",
                          price: 120,
                          subOptions: [
                            {
                              id: `so-${now}-4`,
                              name: "Duble Lavaş & Köz Paket",
                              price: 35,
                            },
                            {
                              id: `so-${now}-5`,
                              name: "Süzme Yoğurt & Tereyağ Sos",
                              price: 50,
                            },
                            {
                              id: `so-${now}-6`,
                              name: "Soğansız Olsun",
                              price: 0,
                            },
                          ],
                        },
                      ],
                    };
                    setEditingItem({
                      ...editingItem,
                      modifierGroups: [...editingItem.modifierGroups, tpl],
                    });
                  }}
                  className="text-[11px] font-extrabold bg-orange-600 hover:bg-orange-700 text-white px-2.5 py-1 rounded-lg transition cursor-pointer shadow-2xs"
                >
                  + 🎁 Kampanya Alt Ürünü (Porsiyon + Ekstralı)
                </button>
              </div>

              {editingItem.modifierGroups.map((group, gIdx) => (
                <div
                  key={group.id}
                  className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5"
                >
                  <div>
                    <input
                      type="text"
                      placeholder="Kampanya Alt Ürün Başlığı (İsteğe Bağlı - Örn: 🍖 1. ÜRÜN: Kebap Seçimi)"
                      value={group.productTag || ""}
                      onChange={(e) => {
                        const updated = [...editingItem.modifierGroups];
                        updated[gIdx] = {
                          ...group,
                          productTag: e.target.value || undefined,
                        };
                        setEditingItem({
                          ...editingItem,
                          modifierGroups: updated,
                        });
                      }}
                      className="w-full px-2.5 py-1 text-xs font-extrabold text-orange-800 bg-orange-50/70 border border-orange-200 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={group.name}
                      onChange={(e) => {
                        const updated = [...editingItem.modifierGroups];
                        updated[gIdx] = { ...group, name: e.target.value };
                        setEditingItem({
                          ...editingItem,
                          modifierGroups: updated,
                        });
                      }}
                      className="px-2.5 py-1 text-xs font-bold border border-slate-200 rounded-lg flex-1 bg-white"
                    />
                    <label className="text-xs flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={group.required}
                        onChange={(e) => {
                          const updated = [...editingItem.modifierGroups];
                          updated[gIdx] = {
                            ...group,
                            required: e.target.checked,
                          };
                          setEditingItem({
                            ...editingItem,
                            modifierGroups: updated,
                          });
                        }}
                      />
                      Zorunlu
                    </label>
                    <label className="text-xs flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={group.multiSelect}
                        onChange={(e) => {
                          const updated = [...editingItem.modifierGroups];
                          updated[gIdx] = {
                            ...group,
                            multiSelect: e.target.checked,
                          };
                          setEditingItem({
                            ...editingItem,
                            modifierGroups: updated,
                          });
                        }}
                      />
                      Çoklu Seçim
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = editingItem.modifierGroups.filter(
                          (_, i) => i !== gIdx
                        );
                        setEditingItem({
                          ...editingItem,
                          modifierGroups: updated,
                        });
                      }}
                      className="text-red-500 text-xs font-bold cursor-pointer"
                    >
                      Grubu Sil
                    </button>
                  </div>

                  <div className="space-y-2 pl-2">
                    {group.options.map((opt, oIdx) => (
                      <div
                        key={opt.id}
                        className="bg-white p-2 rounded-lg border border-slate-200/80 space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Porsiyon / Seçenek adı"
                            value={opt.name}
                            onChange={(e) => {
                              const updated = [...editingItem.modifierGroups];
                              const opts = [...group.options];
                              opts[oIdx] = { ...opt, name: e.target.value };
                              updated[gIdx] = { ...group, options: opts };
                              setEditingItem({
                                ...editingItem,
                                modifierGroups: updated,
                              });
                            }}
                            className="flex-1 px-2 py-1 text-xs font-semibold border border-slate-200 rounded bg-white"
                          />
                          <input
                            type="number"
                            placeholder="+Fiyat"
                            value={opt.price}
                            onChange={(e) => {
                              const updated = [...editingItem.modifierGroups];
                              const opts = [...group.options];
                              opts[oIdx] = {
                                ...opt,
                                price: Number(e.target.value),
                              };
                              updated[gIdx] = { ...group, options: opts };
                              setEditingItem({
                                ...editingItem,
                                modifierGroups: updated,
                              });
                            }}
                            className="w-20 px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editingItem.modifierGroups];
                              const opts = [...group.options];
                              const currentSubs = opt.subOptions || [];
                              opts[oIdx] = {
                                ...opt,
                                subOptions: [
                                  ...currentSubs,
                                  {
                                    id: `sub-${Date.now()}`,
                                    name: "Porsiyon Ekstrası",
                                    price: 25,
                                  },
                                ],
                              };
                              updated[gIdx] = { ...group, options: opts };
                              setEditingItem({
                                ...editingItem,
                                modifierGroups: updated,
                              });
                            }}
                            className="text-[10px] font-bold bg-orange-50 hover:bg-orange-600 hover:text-white text-orange-700 border border-orange-200 px-2 py-1 rounded whitespace-nowrap cursor-pointer"
                            title="Bu porsiyona özel ekstra malzeme ekle"
                          >
                            + Porsiyon Ekstrası
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editingItem.modifierGroups];
                              const opts = group.options.filter(
                                (_, idx) => idx !== oIdx
                              );
                              updated[gIdx] = { ...group, options: opts };
                              setEditingItem({
                                ...editingItem,
                                modifierGroups: updated,
                              });
                            }}
                            className="text-red-500 hover:text-red-700 font-black px-1.5 cursor-pointer"
                            title="Seçeneği Sil"
                          >
                            ×
                          </button>
                        </div>

                        {/* Bu Porsiyona Özel Ekstralar (subOptions) */}
                        {opt.subOptions && opt.subOptions.length > 0 && (
                          <div className="pl-3 ml-2 border-l-2 border-orange-300 space-y-1 pt-1">
                            <div className="text-[10px] font-extrabold text-orange-700">
                              ↳ &ldquo;{opt.name}&rdquo; Porsiyonunun Ekstraları:
                            </div>
                            {opt.subOptions.map((subOpt, sIdx) => (
                              <div
                                key={subOpt.id}
                                className="flex items-center gap-1.5"
                              >
                                <input
                                  type="text"
                                  placeholder="Ekstra adı (örn: Ekstra Kaşar / Soğansız)"
                                  value={subOpt.name}
                                  onChange={(e) => {
                                    const updated = [
                                      ...editingItem.modifierGroups,
                                    ];
                                    const opts = [...group.options];
                                    const subs = [...(opt.subOptions || [])];
                                    subs[sIdx] = {
                                      ...subOpt,
                                      name: e.target.value,
                                    };
                                    opts[oIdx] = { ...opt, subOptions: subs };
                                    updated[gIdx] = {
                                      ...group,
                                      options: opts,
                                    };
                                    setEditingItem({
                                      ...editingItem,
                                      modifierGroups: updated,
                                    });
                                  }}
                                  className="flex-1 px-2 py-0.5 text-[11px] border border-slate-200 rounded bg-slate-50"
                                />
                                <input
                                  type="number"
                                  placeholder="+Fiyat"
                                  value={subOpt.price}
                                  onChange={(e) => {
                                    const updated = [
                                      ...editingItem.modifierGroups,
                                    ];
                                    const opts = [...group.options];
                                    const subs = [...(opt.subOptions || [])];
                                    subs[sIdx] = {
                                      ...subOpt,
                                      price: Number(e.target.value),
                                    };
                                    opts[oIdx] = { ...opt, subOptions: subs };
                                    updated[gIdx] = {
                                      ...group,
                                      options: opts,
                                    };
                                    setEditingItem({
                                      ...editingItem,
                                      modifierGroups: updated,
                                    });
                                  }}
                                  className="w-16 px-2 py-0.5 text-[11px] border border-slate-200 rounded bg-slate-50"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [
                                      ...editingItem.modifierGroups,
                                    ];
                                    const opts = [...group.options];
                                    const subs = (opt.subOptions || []).filter(
                                      (_, idx) => idx !== sIdx
                                    );
                                    opts[oIdx] = { ...opt, subOptions: subs };
                                    updated[gIdx] = {
                                      ...group,
                                      options: opts,
                                    };
                                    setEditingItem({
                                      ...editingItem,
                                      modifierGroups: updated,
                                    });
                                  }}
                                  className="text-red-500 text-xs font-bold px-1 cursor-pointer"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...editingItem.modifierGroups];
                        updated[gIdx] = {
                          ...group,
                          options: [
                            ...group.options,
                            {
                              id: `opt-${Date.now()}`,
                              name: "Yeni Seçenek",
                              price: 0,
                            },
                          ],
                        };
                        setEditingItem({
                          ...editingItem,
                          modifierGroups: updated,
                        });
                      }}
                      className="text-[11px] font-semibold text-orange-600 hover:underline cursor-pointer"
                    >
                      + Seçenek Ekle
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 80mm GÜN SONU Z RAPORU YAZDIRMA ŞABLONU */}
      {printingZReport && (
        <div
          id="printable-z-report"
          className="hidden print:block text-xs font-mono leading-snug"
        >
          <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
            <h2 className="font-bold text-base uppercase">{settings?.name}</h2>
            <p className="text-[11px]">{settings?.phone}</p>
            <div className="mt-1.5 py-1 border border-black font-black text-sm">
              GÜN SONU (Z RAPORU)
            </div>
            <p className="mt-1 text-[11px] font-bold">
              Dönem: {reportPeriodLabel}
            </p>
            <p className="text-[10px]">
              Rapor Tarihi: {new Date().toLocaleString("tr-TR")}
            </p>
          </div>

          <div className="space-y-1 border-b border-dashed border-black pb-2 mb-2 text-[11px]">
            <div className="flex justify-between font-bold">
              <span>BAŞARILI SİPARİŞ:</span>
              <span>{validOrders.length} Adet</span>
            </div>
            <div className="flex justify-between">
              <span>İPTAL / RED SİPARİŞ:</span>
              <span>{rejectedPeriodOrders.length} Adet</span>
            </div>
            <div className="flex justify-between">
              <span>Adrese Paket Servis:</span>
              <span>{deliveryCount} Adet</span>
            </div>
            <div className="flex justify-between">
              <span>Gel-Al Sipariş:</span>
              <span>{pickupCount} Adet</span>
            </div>
            <div className="flex justify-between">
              <span>Masada QR Sipariş:</span>
              <span>{dineInCount} Adet</span>
            </div>
          </div>

          <div className="space-y-1 border-b border-dashed border-black pb-2 mb-2 text-[11px]">
            <p className="font-bold underline">ÖDEME YÖNTEMİ KIRILIMI:</p>
            <div className="flex justify-between">
              <span>Nakit Tahsilat:</span>
              <span>
                {cashTotal.toFixed(2)} {settings?.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Kapıda Kredi Kartı (POS):</span>
              <span>
                {cardTotal.toFixed(2)} {settings?.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Masada Ödeme (Nakit/POS):</span>
              <span>
                {tablePosTotal.toFixed(2)} {settings?.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Toplam Kupon İndirimi:</span>
              <span>
                -{totalDiscountGiven.toFixed(2)} {settings?.currency}
              </span>
            </div>
          </div>

          {topSellingProducts.length > 0 && (
            <div className="space-y-1 border-b border-dashed border-black pb-2 mb-2 text-[11px]">
              <p className="font-bold underline">ÜRÜN SATIŞ ADETLERİ:</p>
              {topSellingProducts.slice(0, 15).map((p) => (
                <div key={p.name} className="flex justify-between">
                  <span>
                    {p.qty}x {p.name}
                  </span>
                  <span>
                    {p.revenue.toFixed(2)} {settings?.currency}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 space-y-1 text-xs border-b border-dashed border-black pb-2 mb-2">
            <div className="flex justify-between font-bold">
              <span>BRÜT CİRO:</span>
              <span>
                {totalRevenue.toFixed(2)} {settings?.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Satılan Ürün Maliyeti:</span>
              <span>
                -{totalProductCost.toFixed(2)} {settings?.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Günlük Kasa Giderleri:</span>
              <span>
                -{totalExpensesAmount.toFixed(2)} {settings?.currency}
              </span>
            </div>
          </div>
          <div className="pt-1 font-black flex justify-between text-sm">
            <span>GERÇEK NET KÂR:</span>
            <span>
              {netProfit.toFixed(2)} {settings?.currency}
            </span>
          </div>
          <div className="text-center pt-3 text-[10px]">
            <p>*** Z RAPORU SONU ***</p>
          </div>
        </div>
      )}

      {/* 80mm SİPARİŞ ADİSYON FİŞİ YAZDIRMA ŞABLONU (ADMIN) */}
      {selectedOrderForPrint && !printingZReport && (
        <div
          id="printable-receipt"
          className="hidden print:block text-xs font-mono leading-snug"
        >
          <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
            <h2 className="font-bold text-base uppercase">{settings?.name}</h2>
            <p className="text-[11px]">Tel: {settings?.phone}</p>
            <div className="mt-1 py-1 border border-black font-black text-sm">
              SİPARİŞ NO: #{selectedOrderForPrint.orderNumber}
            </div>
            <p className="mt-1 font-bold">
              {selectedOrderForPrint.orderType === "dine_in"
                ? `MASA: ${selectedOrderForPrint.tableNumber}`
                : selectedOrderForPrint.orderType === "pickup"
                ? "GEL-AL SİPARİŞ"
                : "PAKET SERVİS"}
            </p>
            <p className="text-[10px]">
              {new Date(selectedOrderForPrint.createdAt).toLocaleString(
                "tr-TR"
              )}
            </p>
          </div>
          <div className="mb-2 text-[11px]">
            <p>Müşteri: {selectedOrderForPrint.customerName}</p>
            <p>Tel: {selectedOrderForPrint.customerPhone}</p>
            {selectedOrderForPrint.customerAddress && (
              <p>Adres: {selectedOrderForPrint.customerAddress}</p>
            )}
            {selectedOrderForPrint.courierName && (
              <p>Kurye: {selectedOrderForPrint.courierName}</p>
            )}
          </div>
          <div className="border-t border-b border-dashed border-black py-2 space-y-1">
            {selectedOrderForPrint.items.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between font-bold">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span>
                    {item.totalPrice.toFixed(2)} {settings?.currency}
                  </span>
                </div>
                {item.selectedModifiers.map((m, i) => (
                  <div key={i} className="pl-2 text-[11px]">
                    + {m.optionName}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="pt-2 font-black flex justify-between text-sm">
            <span>TOPLAM:</span>
            <span>
              {selectedOrderForPrint.totalAmount.toFixed(2)}{" "}
              {settings?.currency}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
