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
} from "lucide-react";
import {
  Category,
  Coupon,
  CustomerUser,
  DeliveryZone,
  MenuItem,
  ModifierGroup,
  Order,
  RestaurantSettings,
  WhatsAppLog,
} from "@/types";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<
    | "reports"
    | "menu"
    | "campaigns"
    | "whatsapp"
    | "qr"
    | "widget"
    | "cloud"
    | "settings"
  >("reports");
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [waLogs, setWaLogs] = useState<WhatsAppLog[]>([]);
  const [savingMsg, setSavingMsg] = useState("");
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<{
    ok?: boolean;
    message?: string;
  } | null>(null);

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

  const loadData = async () => {
    const [menuRes, profRes, ordRes] = await Promise.all([
      fetch("/api/menu"),
      fetch("/api/auth/profile"),
      fetch("/api/orders"),
    ]);
    const data = await menuRes.json();
    const profData = await profRes.json();
    const ordData = await ordRes.json();
    setSettings(data.settings);
    setCategories(data.categories || []);
    setItems(data.items || []);
    setUsers(profData.users || []);
    setWaLogs(profData.whatsappLogs || []);
    setOrders(ordData.orders || []);
  };

  useEffect(() => {
    loadData();
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

  const handleToggleItemAvailability = async (item: MenuItem) => {
    const updated = { ...item, available: !item.available };
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

  // Ciro & İstatistik Hesaplamaları
  const validOrders = orders.filter((o) => o.status !== "rejected");
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = validOrders.filter((o) =>
    o.createdAt.startsWith(todayStr)
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

  // En Çok Satan Ürünler
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
              Ciro Raporları • Menü • Bölgeler & Kuponlar • WhatsApp OTP • QR
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

          <Link
            href="/kitchen"
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl transition"
          >
            <Volume2 className="w-4 h-4" />
            Canlı Mutfak Ekranı
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
            Üst Bar, Bölgeler & Kuponlar
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
            Masa QR Kodları ({settings?.tableCount || 15})
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
        {/* 0. CİRO & SATIŞ RAPORLARI SEKMESİ */}
        {activeTab === "reports" && (
          <div className="space-y-6">
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

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
                  <span>Toplam Ciro</span>
                  <BarChart3 className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {totalRevenue.toFixed(2)} {settings?.currency || "₺"}
                </div>
                <p className="text-xs text-slate-500">
                  Toplam {validOrders.length} sipariş üzerinden
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
                  <span>Ortalama Sepet Tutarı</span>
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {avgOrderValue.toFixed(2)} {settings?.currency || "₺"}
                </div>
                <p className="text-xs text-slate-500">
                  Kayıtlı WhatsApp Üyesi: {users.length} kişi
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-500">
                  <span>Uygulanan Kupon İndirimi</span>
                  <Tag className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  {totalDiscountGiven.toFixed(2)} {settings?.currency || "₺"}
                </div>
                <p className="text-xs text-slate-500">
                  Aktif kupon sayısı:{" "}
                  {(settings?.coupons || []).filter((c) => c.active).length}
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
                    <div className="flex justify-between py-2">
                      <span className="text-slate-600 font-medium">
                        Masada Ödeme (Nakit / POS)
                      </span>
                      <span className="font-bold text-slate-900">
                        {tablePosTotal.toFixed(2)} {settings?.currency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sağ: En Çok Satan Ürünler */}
              <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-orange-600" />
                    <h3 className="font-bold text-base text-slate-900">
                      En Çok Satan Ürünler
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    Satış Adedine Göre Sıralı
                  </span>
                </div>

                {topSellingProducts.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    Henüz sipariş verisi bulunmuyor. Müşteri ekranından veya
                    mutfak ekranından örnek sipariş oluşturduğunuzda burada
                    listelenecektir.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {topSellingProducts.slice(0, 8).map((prod, idx) => (
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
              </div>
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
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
                <div>
                  <h2 className="font-bold text-base text-slate-900">
                    Ürünler ({items.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ürün ekleyebilir, fiyat değiştirebilir veya tek tıkla
                    &ldquo;Tükendi&rdquo; olarak işaretleyebilirsiniz.
                  </p>
                </div>
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
                  className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition"
                >
                  <Plus className="w-4 h-4" /> Yeni Ürün Ekle
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item) => {
                  const catName =
                    categories.find((c) => c.id === item.categoryId)?.name ||
                    "Kategori";
                  return (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                          <div className="text-sm font-extrabold text-slate-900 mt-1">
                            {item.price.toFixed(2)} {settings?.currency} •{" "}
                            <span className="text-xs font-normal text-slate-500">
                              {item.modifierGroups.length} Opsiyon Grubu
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleToggleItemAvailability(item)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                            item.available
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {item.available ? "Stokta (Aktif)" : "Tükendi"}
                        </button>
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
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

        {/* 3. MASA QR KOD ÜRETİCİ */}
        {activeTab === "qr" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Masadan Sipariş & Garson Çağrı QR Kodları
                </h2>
                <p className="text-sm text-slate-500">
                  Müşteriler telefon kamerasıyla bu QR kodları okuttuğunda masa
                  numarası otomatik seçili açılır; sipariş verebilir veya tek
                  tıkla Garson / Hesap çağırabilirler.
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-4 py-2.5 rounded-xl"
              >
                Tüm QR Kartlarını Yazdır
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from(
                { length: settings?.tableCount || 15 },
                (_, i) => i + 1
              ).map((tableNum) => {
                const tableUrl = `${originUrl}/?table=${tableNum}`;
                const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  tableUrl
                )}`;

                return (
                  <div
                    key={tableNum}
                    className="bg-white border border-slate-200 rounded-2xl p-4 text-center space-y-3 shadow-xs"
                  >
                    <div className="inline-block bg-orange-100 text-orange-800 font-extrabold text-xs px-3 py-1 rounded-full">
                      MASA {tableNum}
                    </div>
                    <div className="w-36 h-36 mx-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <img
                        src={qrImgUrl}
                        alt={`Masa ${tableNum} QR`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Sipariş Ver • Garson Çağır • Hesap İste
                    </p>
                    <Link
                      href={`/?table=${tableNum}`}
                      target="_blank"
                      className="inline-flex items-center justify-center gap-1 text-xs font-bold text-orange-600 hover:underline"
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
                  Toplam Masa Sayısı
                </label>
                <input
                  type="number"
                  value={settings.tableCount}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tableCount: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
                />
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

            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-xl transition"
            >
              <Save className="w-4 h-4" />
              Ayarları Kaydet
            </button>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fiyat ({settings?.currency}) *
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

            {/* Opsiyon Grupları */}
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase text-slate-600">
                  Opsiyon & Ekstra Grupları ({editingItem.modifierGroups.length})
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
                  className="text-xs font-bold text-orange-600 hover:underline"
                >
                  + Opsiyon Grubu Ekle
                </button>
              </div>

              {editingItem.modifierGroups.map((group, gIdx) => (
                <div
                  key={group.id}
                  className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2"
                >
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
                      className="text-red-500 text-xs"
                    >
                      Sil
                    </button>
                  </div>

                  <div className="space-y-1.5 pl-2">
                    {group.options.map((opt, oIdx) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Seçenek adı"
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
                          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded bg-white"
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
                      className="text-[11px] font-semibold text-orange-600 hover:underline"
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
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
