"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  Printer,
  Truck,
  ShoppingBag,
  QrCode,
  Phone,
  MapPin,
  ChefHat,
  ArrowLeft,
  Settings,
  PlusCircle,
  Lock,
  HandPlatter,
  CreditCard,
  Banknote,
  Tag,
  MonitorCheck,
  CalendarDays,
  Clock,
  Users,
} from "lucide-react";
import {
  Category,
  MenuItem,
  Order,
  RestaurantSettings,
  TableCall,
  TableReservation,
} from "@/types";
import { soundAlert } from "@/lib/sound";

export default function KitchenTabletPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tableCalls, setTableCalls] = useState<TableCall[]>([]);
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrintOnAccept, setAutoPrintOnAccept] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] =
    useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<
    "active" | "stock" | "reservations" | "completed" | "rejected"
  >("active");
  const [prepMinutesChoice, setPrepMinutesChoice] = useState<
    Record<string, number>
  >({});
  const [courierChoice, setCourierChoice] = useState<Record<string, string>>(
    {}
  );
  const [tableAssignmentChoice, setTableAssignmentChoice] = useState<
    Record<string, string>
  >({});

  const knownPendingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const savedAutoPrint = localStorage.getItem("restoran_auto_print_receipt");
      if (savedAutoPrint === "1") {
        setAutoPrintOnAccept(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchOrders = async () => {
    try {
      const [ordRes, menuRes, callRes, resvRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/menu"),
        fetch("/api/table-calls"),
        fetch("/api/reservations"),
      ]);
      const ordData = await ordRes.json();
      const menuData = await menuRes.json();
      const callData = await callRes.json();
      const resvData = await resvRes.json();

      const list: Order[] = ordData.orders || [];
      const calls: TableCall[] = callData.calls || [];
      const resvs: TableReservation[] = resvData.reservations || [];

      setOrders(list);
      if (menuData.settings) setSettings(menuData.settings);
      if (menuData.items) setMenuItems(menuData.items);
      if (menuData.categories) setCategories(menuData.categories);
      setTableCalls(calls);
      setReservations(resvs);

      // Yeni bekleyen sipariş, masa çağrısı veya rezervasyon varsa zil çal
      const pendingOrders = list.filter((o) => o.status === "pending");
      const pendingCalls = calls.filter((c) => c.status === "pending");
      const pendingResvs = resvs.filter((r) => r.status === "pending");

      if (soundEnabled) {
        if (pendingOrders.length > 0) {
          soundAlert.playOrderRing();
        } else if (pendingCalls.length > 0 || pendingResvs.length > 0) {
          soundAlert.playTableCallRing();
        }
      }
      knownPendingIds.current = new Set(pendingOrders.map((o) => o.id));
    } catch (e) {
      console.error("Siparişler alınamadı:", e);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3500);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Ekran Uyku Kilidi (Screen Wake Lock API)
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
          setWakeLockActive(true);
          wakeLock.addEventListener("release", () => {
            setWakeLockActive(false);
          });
        }
      } catch {
        setWakeLockActive(false);
      }
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, []);

  const handlePrint = (order: Order) => {
    setSelectedOrderForPrint(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleStatusChange = async (
    orderId: string,
    status: Order["status"],
    estimatedMinutes?: number,
    rejectReason?: string,
    courierName?: string,
    orderToAutoPrint?: Order
  ) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          estimatedMinutes,
          rejectReason,
          courierName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchOrders();
        if (status === "accepted" && autoPrintOnAccept) {
          handlePrint(data.order || orderToAutoPrint);
        }
      }
    } catch (e) {
      console.error("Durum güncellenemedi:", e);
    }
  };

  const handleToggleStock = async (item: MenuItem) => {
    try {
      const updated = { ...item, available: !item.available };
      setMenuItems((prev) =>
        prev.map((m) => (m.id === item.id ? updated : m))
      );
      await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: updated }),
      });
      fetchOrders();
    } catch (e) {
      console.error("Stok güncellenemedi:", e);
    }
  };

  const handleResolveTableCall = async (id: string) => {
    try {
      await fetch("/api/table-calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchOrders();
    } catch (e) {
      console.error("Masa çağrısı kapatılamadı:", e);
    }
  };

  const handleReservationStatus = async (
    id: string,
    status: "confirmed" | "rejected",
    assignedTable?: string,
    rejectReason?: string
  ) => {
    try {
      await fetch("/api/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, assignedTable, rejectReason }),
      });
      fetchOrders();
    } catch (e) {
      console.error("Rezervasyon güncellenemedi:", e);
    }
  };

  const createTestOrder = async () => {
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderType: "dine_in",
        tableNumber: String(Math.floor(Math.random() * 10) + 1),
        customerName: "Test Masa Müşterisi",
        customerPhone: "0532 000 00 00",
        paymentMethod: "pos_at_table",
        orderNote: "Lütfen közlenmiş biber bol olsun.",
        subtotal: 595,
        deliveryFee: 0,
        discountAmount: 0,
        totalAmount: 595,
        items: [
          {
            id: `test-${Date.now()}`,
            menuItemId: "item-1",
            name: "Karışık Izgara Şef Tabağı",
            quantity: 1,
            basePrice: 540,
            unitPrice: 540,
            totalPrice: 540,
            selectedModifiers: [
              {
                groupName: "Porsiyon Seçimi",
                optionName: "1 Porsiyon (Standart)",
                price: 0,
              },
            ],
          },
          {
            id: `test-2-${Date.now()}`,
            menuItemId: "item-8",
            name: "Bol Köpüklü Yayık Ayranı",
            quantity: 1,
            basePrice: 55,
            unitPrice: 55,
            totalPrice: 55,
            selectedModifiers: [],
          },
        ],
      }),
    });
    fetchOrders();
  };

  const createTestTableCall = async () => {
    const types: TableCall["type"][] = ["waiter", "bill_cash", "bill_card"];
    const randomType = types[Math.floor(Math.random() * types.length)];
    await fetch("/api/table-calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber: String(Math.floor(Math.random() * 12) + 1),
        type: randomType,
      }),
    });
    fetchOrders();
  };

  const createTestReservation = async () => {
    await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Ahmet Yılmaz",
        customerPhone: "0532 111 22 33",
        guestCount: 4,
        reservationDate: new Date().toISOString().split("T")[0],
        reservationTime: "20:00",
        specialRequests: "Cam kenarı masa rica ediyoruz.",
      }),
    });
    fetchOrders();
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const preparingOrders = orders.filter(
    (o) => o.status === "accepted" || o.status === "ready"
  );
  const completedOrders = orders.filter((o) => o.status === "completed");
  const rejectedOrders = orders.filter((o) => o.status === "rejected");
  const pendingTableCalls = tableCalls.filter((c) => c.status === "pending");
  const pendingReservations = reservations.filter(
    (r) => r.status === "pending"
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Üst Tablet Kontrol Barı */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Müşteri Ekranı
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base sm:text-lg leading-tight">
                  Canlı Sipariş, Masa & Rezervasyon Paneli
                </h1>
                {wakeLockActive && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <MonitorCheck className="w-3 h-3" /> Ekran Uyku Kilidi Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Sesli Zil • Garson/Hesap Çağrısı • Masa Rezervasyonu • İleri Saat Siparişi
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Simülasyon: Masa Rezervasyonu */}
          <button
            onClick={createTestReservation}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-xl transition shadow-sm"
          >
            <CalendarDays className="w-4 h-4" />
            Test: Rezervasyon
          </button>

          {/* Simülasyon: Masa Çağrısı */}
          <button
            onClick={createTestTableCall}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-xl transition shadow-sm"
          >
            <HandPlatter className="w-4 h-4" />
            Test: Masa Çağrısı
          </button>

          {/* Hızlı Test Siparişi Butonu */}
          <button
            onClick={createTestOrder}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Test: Sipariş Gönder
          </button>

          {/* Onayda Otomatik Termal Fiş Yazdır Aç/Kapat */}
          <button
            onClick={() => {
              const next = !autoPrintOnAccept;
              setAutoPrintOnAccept(next);
              try {
                localStorage.setItem(
                  "restoran_auto_print_receipt",
                  next ? "1" : "0"
                );
              } catch {
                // ignore
              }
            }}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl transition cursor-pointer ${
              autoPrintOnAccept
                ? "bg-orange-600/20 text-orange-300 border border-orange-500/40"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
            title="Açık olduğunda, yeni siparişi kabul ettiğiniz anda 80mm adisyon fişi otomatik yazdırılır"
          >
            <Printer className="w-4 h-4" />
            {autoPrintOnAccept ? "Oto-Fiş: AÇIK" : "Oto-Fiş: KAPALI"}
          </button>

          {/* Ses Aç/Kapat */}
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) soundAlert.playOrderRing();
            }}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl transition ${
              soundEnabled
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                : "bg-red-600/20 text-red-400 border border-red-500/30"
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4" /> Sesli Zil: AÇIK
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" /> Sesli Zil: KAPALI
              </>
            )}
          </button>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl border border-slate-700"
          >
            <Settings className="w-4 h-4" />
            Yönetim Paneli
          </Link>

          <button
            onClick={async () => {
              await fetch("/api/staff-auth", { method: "DELETE" });
              window.location.href = "/staff-login?target=kitchen";
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-2 rounded-xl border border-red-500/30 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            Kilitle
          </button>
        </div>
      </header>

      {/* CANLI MASA ÇAĞRILARI (GARSON ÇAĞIR / HESAP İSTE) PANELİ */}
      {pendingTableCalls.length > 0 && (
        <div className="bg-purple-950/90 border-b-2 border-purple-500 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-purple-200 font-extrabold text-sm">
              <HandPlatter className="w-5 h-5 text-purple-400 animate-bounce" />
              <span>
                CANLI MASA ÇAĞRILARI ({pendingTableCalls.length} Masa Bekliyor)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {pendingTableCalls.map((call) => (
                <div
                  key={call.id}
                  className="bg-slate-900 border-2 border-purple-400 rounded-xl px-3.5 py-2 flex items-center gap-3 shadow-lg"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-sm text-white bg-purple-600 px-2 py-0.5 rounded-md">
                        MASA {call.tableNumber}
                      </span>
                      <span className="text-xs font-extrabold text-purple-200 flex items-center gap-1">
                        {call.type === "waiter" ? (
                          <>
                            <HandPlatter className="w-3.5 h-3.5 text-amber-400" />
                            Garson Çağırıyor
                          </>
                        ) : call.type === "bill_cash" ? (
                          <>
                            <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                            Hesap İstiyor (NAKİT)
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                            Hesap İstiyor (POS / KART)
                          </>
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Saat:{" "}
                      {new Date(call.createdAt).toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleResolveTableCall(call.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg transition"
                  >
                    İlgilenildi ✓
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ONAY BEKLEYEN MASA REZERVASYONLARI HIZLI BARI */}
      {pendingReservations.length > 0 && (
        <div className="bg-amber-950/90 border-b-2 border-amber-500 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-amber-200 font-extrabold text-sm">
              <CalendarDays className="w-5 h-5 text-amber-400 animate-bounce" />
              <span>
                ONAY BEKLEYEN MASA REZERVASYONU ({pendingReservations.length}{" "}
                Talep)
              </span>
            </div>
            <button
              onClick={() => setActiveTab("reservations")}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold px-4 py-2 rounded-xl transition self-start sm:self-auto"
            >
              Rezervasyonları Yönet & Masa Ata →
            </button>
          </div>
        </div>
      )}

      {/* Yeni Sipariş Geldiğinde Yanıp Sönen Uyarı Bandı */}
      {pendingOrders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 text-white px-6 py-3 flex items-center justify-between animate-pulse shadow-lg">
          <div className="flex items-center gap-3 font-extrabold text-sm sm:text-base">
            <Bell className="w-6 h-6 animate-bounce" />
            <span>
              DİKKAT! ONAY BEKLEYEN {pendingOrders.length} YENİ SİPARİŞ VAR!
            </span>
          </div>
          <button
            onClick={() => soundAlert.playOrderRing()}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-semibold"
          >
            Zili Tekrar Çal
          </button>
        </div>
      )}

      {/* Sekmeler */}
      <div className="px-4 pt-4 flex items-center justify-between border-b border-slate-800 overflow-x-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 whitespace-nowrap transition ${
              activeTab === "active"
                ? "border-orange-500 text-orange-400 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Aktif Siparişler ({pendingOrders.length + preparingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("stock")}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 whitespace-nowrap flex items-center gap-2 transition ${
              activeTab === "stock"
                ? "border-rose-500 text-rose-400 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🍲 Hızlı Stok / Tükendi</span>
            {menuItems.filter((m) => !m.available).length > 0 && (
              <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black px-2 py-0.5 rounded-full">
                {menuItems.filter((m) => !m.available).length} Tükendi
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("reservations")}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 whitespace-nowrap flex items-center gap-2 transition ${
              activeTab === "reservations"
                ? "border-amber-500 text-amber-400 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Masa Rezervasyonları ({reservations.length})</span>
            {pendingReservations.length > 0 && (
              <span className="bg-amber-500 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full">
                {pendingReservations.length} Yeni
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 whitespace-nowrap transition ${
              activeTab === "completed"
                ? "border-emerald-500 text-emerald-400 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Tamamlananlar ({completedOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 whitespace-nowrap transition ${
              activeTab === "rejected"
                ? "border-red-500 text-red-400 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            İptal / Red ({rejectedOrders.length})
          </button>
        </div>
      </div>

      {/* Ana Sipariş Alanı */}
      <main className="p-4 flex-1 max-w-7xl w-full mx-auto">
        {activeTab === "active" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sol Sütun: Onay Bekleyen Yeni Siparişler (GloriaFood Gelen Kutusu) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  Onay Bekleyen Yeni Siparişler ({pendingOrders.length})
                </h2>
              </div>

              {pendingOrders.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 space-y-2">
                  <Bell className="w-8 h-8 mx-auto opacity-40" />
                  <p className="font-semibold text-sm">
                    Şu an onay bekleyen yeni sipariş yok
                  </p>
                  <p className="text-xs">
                    Yeni sipariş veya masa çağrısı geldiğinde sesli uyarı otomatik
                    çalacaktır.
                  </p>
                </div>
              ) : (
                pendingOrders.map((order) => {
                  const chosenMins =
                    prepMinutesChoice[order.id] ||
                    settings?.estimatedPrepMinutes ||
                    25;

                  return (
                    <div
                      key={order.id}
                      className="bg-slate-900 border-2 border-amber-500 rounded-2xl p-5 shadow-xl space-y-4"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-black text-amber-400">
                              #{order.orderNumber}
                            </span>
                            {renderOrderTypeBadge(order)}
                            {order.scheduledTime && (
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full">
                                <Clock className="w-3.5 h-3.5" /> İLERİ SAAT:{" "}
                                {order.scheduledTime}
                              </span>
                            )}
                            {order.deliveryZoneName && (
                              <span className="text-[11px] font-bold bg-slate-800 text-orange-300 px-2 py-0.5 rounded-md border border-slate-700">
                                Bölge: {order.deliveryZoneName}
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              {new Date(order.createdAt).toLocaleTimeString(
                                "tr-TR",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </span>
                          </div>
                          <div className="font-bold text-base mt-1">
                            {order.customerName}
                          </div>
                          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />{" "}
                              {order.customerPhone}
                            </span>
                            {order.customerAddress && (
                              <span className="inline-flex items-center gap-1 text-slate-300">
                                <MapPin className="w-3.5 h-3.5 text-orange-400" />{" "}
                                {order.customerAddress}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-black text-emerald-400">
                            {order.totalAmount.toFixed(2)} {settings?.currency}
                          </div>
                          {order.discountAmount && order.discountAmount > 0 ? (
                            <div className="text-[11px] text-emerald-400 font-bold flex items-center justify-end gap-1">
                              <Tag className="w-3 h-3" />-
                              {order.discountAmount.toFixed(2)}{" "}
                              {settings?.currency}{" "}
                              {order.couponCode ? `(${order.couponCode})` : ""}
                            </div>
                          ) : null}
                          <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                            {order.paymentMethod === "cash"
                              ? "Nakit"
                              : order.paymentMethod === "card_at_door"
                              ? "Kapıda Kart"
                              : "Masada Ödeme"}
                          </span>
                        </div>
                      </div>

                      {/* Ürün Kalemleri */}
                      <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="border-b border-slate-800/60 last:border-none pb-2 last:pb-0"
                          >
                            <div className="flex justify-between font-bold text-sm">
                              <span>
                                <span className="text-orange-400">
                                  {item.quantity}x
                                </span>{" "}
                                {item.name}
                              </span>
                              <span>
                                {item.totalPrice.toFixed(2)} {settings?.currency}
                              </span>
                            </div>
                            {item.selectedModifiers.map((m, i) => (
                              <div
                                key={i}
                                className="text-xs text-slate-400 pl-4"
                              >
                                + {m.optionName}
                              </div>
                            ))}
                            {item.itemNote && (
                              <div className="text-xs text-amber-300 pl-4 italic">
                                Not: {item.itemNote}
                              </div>
                            )}
                          </div>
                        ))}
                        {order.orderNote && (
                          <div className="pt-2 text-xs text-amber-300 font-semibold border-t border-slate-800">
                            📌 Sipariş Notu: {order.orderNote}
                          </div>
                        )}
                      </div>

                      {/* GloriaFood Tarzı Tahmini Hazırlama Süresi Seçici */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold uppercase text-slate-400">
                          Tahmini Hazırlama / Teslim Süresi Seçin (Dakika):
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          {[15, 25, 35, 45, 60].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              onClick={() =>
                                setPrepMinutesChoice((prev) => ({
                                  ...prev,
                                  [order.id]: mins,
                                }))
                              }
                              className={`py-2 rounded-xl font-bold text-xs border transition ${
                                chosenMins === mins
                                  ? "bg-orange-600 border-orange-500 text-white"
                                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                              }`}
                            >
                              {mins} dk
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Onayla, Fiş Yazdır veya Reddet Butonları */}
                      <div className="flex items-center gap-2.5 pt-1">
                        <button
                          onClick={() =>
                            handleStatusChange(
                              order.id,
                              "accepted",
                              chosenMins,
                              undefined,
                              undefined,
                              order
                            )
                          }
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>
                            SİPARİŞİ KABUL ET ({chosenMins} dk)
                            {autoPrintOnAccept ? " + FİŞ" : ""}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(order)}
                          className="bg-slate-800 hover:bg-slate-700 text-orange-400 border border-slate-700 font-bold py-3.5 px-3.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                          title="80mm Termal Adisyon Yazdır"
                        >
                          <Printer className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            const reason =
                              prompt(
                                "Reddetme sebebi (Müşteriye gösterilecek):",
                                "Yoğunluk sebebiyle şu an hizmet veremiyoruz."
                              ) || "İptal edildi";
                            handleStatusChange(
                              order.id,
                              "rejected",
                              undefined,
                              reason
                            );
                          }}
                          className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 font-bold py-3.5 px-4 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <XCircle className="w-5 h-5" />
                          <span>Reddet</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sağ Sütun: Hazırlanan & Serviste Olan Siparişler */}
            <div className="lg:col-span-6 space-y-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                Hazırlanan & Servisteki Siparişler ({preparingOrders.length})
              </h2>

              {preparingOrders.length === 0 ? (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center text-slate-500">
                  <p className="text-sm font-semibold">
                    Hazırlanan sipariş bulunmuyor
                  </p>
                </div>
              ) : (
                preparingOrders.map((order) => {
                  const courierList = settings?.couriers?.length
                    ? settings.couriers
                    : [
                        "Kurye 1 (Motorlu)",
                        "Kurye 2 (Motorlu)",
                        "Hızlı Kurye",
                      ];
                  const chosenCourier =
                    courierChoice[order.id] ||
                    order.courierName ||
                    courierList[0];

                  return (
                    <div
                      key={order.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-black text-white">
                              #{order.orderNumber}
                            </span>
                            {renderOrderTypeBadge(order)}
                            {order.scheduledTime && (
                              <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2.5 py-0.5 rounded-full">
                                <Clock className="w-3.5 h-3.5" /> İLERİ SAAT:{" "}
                                {order.scheduledTime}
                              </span>
                            )}
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                order.status === "accepted"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-blue-500/20 text-blue-400"
                              }`}
                            >
                              {order.status === "accepted"
                                ? `Hazırlanıyor (${order.estimatedMinutes || 25} dk)`
                                : order.courierName
                                ? `🛵 Yolda (${order.courierName})`
                                : "Hazır / Yolda"}
                            </span>
                          </div>
                          <div className="font-bold text-base mt-1">
                            {order.customerName}
                          </div>
                          {order.customerAddress && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              📍{" "}
                              {order.deliveryZoneName
                                ? `[${order.deliveryZoneName}] `
                                : ""}
                              {order.customerAddress}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePrint(order)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl border border-slate-700 cursor-pointer"
                          >
                            <Printer className="w-4 h-4 text-orange-400" />
                            80mm Fiş Yazdır
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-sm">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between text-slate-200"
                          >
                            <span>
                              <strong className="text-orange-400">
                                {item.quantity}x
                              </strong>{" "}
                              {item.name}
                              {item.selectedModifiers.length > 0 && (
                                <span className="text-xs text-slate-400 ml-1">
                                  (
                                  {item.selectedModifiers
                                    .map((m) => m.optionName)
                                    .join(", ")}
                                  )
                                </span>
                              )}
                            </span>
                            <span className="font-semibold">
                              {item.totalPrice.toFixed(2)} {settings?.currency}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Paket Servis İçin Kurye Atama Seçicisi */}
                      {order.orderType === "delivery" &&
                        order.status === "accepted" && (
                          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <span className="text-xs font-bold text-orange-300 flex items-center gap-1.5">
                              <Truck className="w-4 h-4" />
                              Kurye Ata:
                            </span>
                            <select
                              value={chosenCourier}
                              onChange={(e) =>
                                setCourierChoice((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.value,
                                }))
                              }
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                            >
                              {courierList.map((c) => (
                                <option key={c} value={c}>
                                  🛵 {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                      <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-800 gap-3">
                        <div>
                          <span className="font-extrabold text-emerald-400">
                            Toplam: {order.totalAmount.toFixed(2)}{" "}
                            {settings?.currency}
                          </span>
                          {order.discountAmount && order.discountAmount > 0 ? (
                            <span className="ml-2 text-xs text-emerald-300">
                              (İndirim: -{order.discountAmount.toFixed(2)}{" "}
                              {settings?.currency})
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {order.status === "accepted" && (
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  order.id,
                                  "ready",
                                  undefined,
                                  undefined,
                                  order.orderType === "delivery"
                                    ? chosenCourier
                                    : undefined
                                )
                              }
                              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md"
                            >
                              {order.orderType === "delivery"
                                ? `🛵 Kuryeye Ver & WhatsApp Gönder`
                                : order.orderType === "dine_in"
                                ? "🍽️ Masaya Servis Edildi"
                                : "🛍️ Teslime Hazır (WhatsApp Gönder)"}
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleStatusChange(order.id, "completed")
                            }
                            className="bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
                          >
                            Tamamlandı ✓
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* HIZLI STOK & TÜKENDİ YÖNETİM SEKMESİ */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  🍲 Mutfak Hızlı Stok & &ldquo;Tükendi&rdquo; Kontrolü
                </h2>
                <p className="text-xs text-slate-400">
                  Biten bir yemeği tek dokunuşla &ldquo;Tükendi&rdquo; olarak işaretleyin; müşteri ekranında (Netlify dahil) anında kapanır ve sipariş alınamaz.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                  Stokta: {menuItems.filter((m) => m.available).length} Ürün
                </span>
                <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-xl">
                  Tükendi: {menuItems.filter((m) => !m.available).length} Ürün
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {menuItems.map((item) => {
                const catName =
                  categories.find((c) => c.id === item.categoryId)?.name ||
                  "Menü";
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      item.available
                        ? "bg-slate-900 border-slate-800"
                        : "bg-rose-950/30 border-rose-500/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase text-orange-400">
                        {catName}
                      </span>
                      <h3 className="font-bold text-sm text-white truncate">
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        {item.price.toFixed(2)} {settings?.currency}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStock(item)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                        item.available
                          ? "bg-emerald-600 hover:bg-rose-600 text-white"
                          : "bg-rose-600 hover:bg-emerald-600 text-white"
                      }`}
                    >
                      {item.available ? "🟢 Stokta (Kapat)" : "🔴 TÜKENDİ (Aç)"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MASA REZERVASYONLARI YÖNETİM SEKMESİ */}
        {activeTab === "reservations" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Online Masa Rezervasyon Talepleri ({reservations.length})
              </h2>
            </div>

            {reservations.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
                <CalendarDays className="w-10 h-10 mx-auto opacity-40" />
                <p className="font-bold text-sm">
                  Henüz masa rezervasyon talebi bulunmuyor
                </p>
                <p className="text-xs">
                  Üstteki &quot;Test: Rezervasyon&quot; butonuna tıklayarak örnek
                  rezervasyon oluşturabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reservations.map((resv) => {
                  const chosenTable =
                    tableAssignmentChoice[resv.id] ||
                    resv.assignedTable ||
                    "Masa 1";
                  return (
                    <div
                      key={resv.id}
                      className={`bg-slate-900 rounded-2xl p-5 border-2 space-y-4 ${
                        resv.status === "pending"
                          ? "border-amber-500 shadow-lg"
                          : resv.status === "confirmed"
                          ? "border-emerald-500/40"
                          : "border-red-500/30 opacity-75"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-base text-amber-400">
                              Rezervasyon #{resv.reservationNumber}
                            </span>
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                resv.status === "pending"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : resv.status === "confirmed"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-red-500/20 text-red-300"
                              }`}
                            >
                              {resv.status === "pending"
                                ? "Onay Bekliyor"
                                : resv.status === "confirmed"
                                ? `Onaylandı (${resv.assignedTable || "Masa Ayrıldı"})`
                                : "Reddedildi"}
                            </span>
                          </div>
                          <p className="font-bold text-base text-white mt-1">
                            {resv.customerName}
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <Phone className="w-3.5 h-3.5" /> {resv.customerPhone}
                          </p>
                        </div>

                        <div className="text-right bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                          <div className="text-xs font-extrabold text-orange-400 flex items-center justify-end gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />{" "}
                            {resv.reservationDate}
                          </div>
                          <div className="text-sm font-black text-white mt-0.5">
                            Saat: {resv.reservationTime}
                          </div>
                          <div className="text-xs text-emerald-400 font-bold flex items-center justify-end gap-1 mt-0.5">
                            <Users className="w-3.5 h-3.5" /> {resv.guestCount}{" "}
                            Kişi
                          </div>
                        </div>
                      </div>

                      {resv.specialRequests && (
                        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs text-amber-300">
                          📌 <strong>Özel İstek / Not:</strong>{" "}
                          {resv.specialRequests}
                        </div>
                      )}

                      {resv.status === "pending" && (
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-300 whitespace-nowrap">
                              Atanacak Masa:
                            </label>
                            <select
                              value={chosenTable}
                              onChange={(e) =>
                                setTableAssignmentChoice((prev) => ({
                                  ...prev,
                                  [resv.id]: e.target.value,
                                }))
                              }
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                            >
                              {Array.from(
                                { length: settings?.tableCount || 15 },
                                (_, i) => `Masa ${i + 1}`
                              ).map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                              <option value="VIP / Bahçe Masası">
                                VIP / Bahçe Masası
                              </option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleReservationStatus(
                                  resv.id,
                                  "confirmed",
                                  chosenTable
                                )
                              }
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 transition shadow-md"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Onayla & WhatsApp Gönder ({chosenTable})
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const reason =
                                  prompt(
                                    "Reddetme açıklaması:",
                                    "Belirtilen saatte uygun masamız bulunmamaktadır."
                                  ) || "Müsaitlik yok";
                                handleReservationStatus(
                                  resv.id,
                                  "rejected",
                                  undefined,
                                  reason
                                );
                              }}
                              className="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 font-bold text-xs py-3 px-3.5 rounded-xl transition"
                            >
                              Reddet
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tamamlanan veya Reddedilen Siparişler Listesi */}
        {(activeTab === "completed" || activeTab === "rejected") && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(activeTab === "completed" ? completedOrders : rejectedOrders).map(
              (order) => (
                <div
                  key={order.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">
                        #{order.orderNumber}
                      </span>
                      {renderOrderTypeBadge(order)}
                      {order.scheduledTime && (
                        <span className="text-[11px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                          ⏰ {order.scheduledTime}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold mt-1">
                      {order.customerName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {order.items
                        .map((i) => `${i.quantity}x ${i.name}`)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="font-bold text-emerald-400">
                      {order.totalAmount.toFixed(2)} {settings?.currency}
                    </div>
                    <button
                      onClick={() => handlePrint(order)}
                      className="text-xs inline-flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300"
                    >
                      <Printer className="w-3.5 h-3.5" /> Fiş
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </main>

      {/* 80mm Termal Yazıcı Fiş Şablonu */}
      {selectedOrderForPrint && (
        <div
          id="printable-receipt"
          className="hidden print:block text-xs font-mono leading-snug"
        >
          <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
            <h2 className="font-bold text-base uppercase">{settings?.name}</h2>
            <p className="text-[11px]">{settings?.address}</p>
            <p className="text-[11px]">Tel: {settings?.phone}</p>
            <div className="mt-1.5 py-1 border border-black font-black text-sm">
              SİPARİŞ NO: #{selectedOrderForPrint.orderNumber}
            </div>
            <p className="mt-1 font-bold text-xs">
              {selectedOrderForPrint.orderType === "dine_in"
                ? `🍽️ MASA SİPARİŞİ — MASA ${selectedOrderForPrint.tableNumber}`
                : selectedOrderForPrint.orderType === "pickup"
                ? "🛍️ GEL-AL (RESTORANDAN TESLİM)"
                : "🛵 ADRESE PAKET SERVİS"}
            </p>
            <p className="text-[10px]">
              Tarih:{" "}
              {new Date(selectedOrderForPrint.createdAt).toLocaleString(
                "tr-TR"
              )}
            </p>
            {selectedOrderForPrint.scheduledTime && (
              <p className="font-bold mt-0.5">
                ⏰ TESLİM ZAMANI: {selectedOrderForPrint.scheduledTime}
              </p>
            )}
          </div>

          <div className="mb-2 space-y-0.5 text-[11px]">
            <p>
              <strong>Müşteri:</strong> {selectedOrderForPrint.customerName}
            </p>
            <p>
              <strong>Telefon:</strong> {selectedOrderForPrint.customerPhone}
            </p>
            {selectedOrderForPrint.deliveryZoneName && (
              <p>
                <strong>Bölge:</strong> {selectedOrderForPrint.deliveryZoneName}
              </p>
            )}
            {selectedOrderForPrint.customerAddress && (
              <p>
                <strong>Adres:</strong> {selectedOrderForPrint.customerAddress}
              </p>
            )}
            {selectedOrderForPrint.courierName && (
              <p>
                <strong>Kurye:</strong> {selectedOrderForPrint.courierName}
              </p>
            )}
          </div>

          <div className="border-t-2 border-b-2 border-dashed border-black py-2 space-y-1.5">
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
                    + {m.groupName}: {m.optionName}
                  </div>
                ))}
                {item.itemNote && (
                  <div className="pl-2 text-[11px] font-bold">
                    * Not: {item.itemNote}
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedOrderForPrint.orderNote && (
            <div className="border-b border-dashed border-black py-1.5 text-[11px] font-bold">
              📌 SİPARİŞ NOTU: {selectedOrderForPrint.orderNote}
            </div>
          )}

          <div className="pt-1.5 space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span>ARA TOPLAM:</span>
              <span>
                {selectedOrderForPrint.subtotal.toFixed(2)} {settings?.currency}
              </span>
            </div>
            {selectedOrderForPrint.discountAmount &&
            selectedOrderForPrint.discountAmount > 0 ? (
              <div className="flex justify-between">
                <span>
                  İNDİRİM ({selectedOrderForPrint.couponCode || "Kampanya"}):
                </span>
                <span>
                  -{selectedOrderForPrint.discountAmount.toFixed(2)}{" "}
                  {settings?.currency}
                </span>
              </div>
            ) : null}
            {selectedOrderForPrint.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>GETİRME ÜCRETİ:</span>
                <span>
                  {selectedOrderForPrint.deliveryFee.toFixed(2)}{" "}
                  {settings?.currency}
                </span>
              </div>
            )}
          </div>

          <div className="mt-1.5 pt-1.5 border-t-2 border-black font-black flex justify-between text-sm">
            <span>GENEL TOPLAM:</span>
            <span>
              {selectedOrderForPrint.totalAmount.toFixed(2)}{" "}
              {settings?.currency}
            </span>
          </div>

          <div className="mt-1 text-[11px] font-bold flex justify-between border-b border-dashed border-black pb-2">
            <span>ÖDEME YÖNTEMİ:</span>
            <span>
              {selectedOrderForPrint.paymentMethod === "cash"
                ? "KAPIDA / KASADA NAKİT"
                : selectedOrderForPrint.paymentMethod === "card_at_door"
                ? "KAPIDA KREDİ KARTI (POS)"
                : "MASADA ÖDEME"}
            </span>
          </div>

          <div className="text-center pt-2 text-[10px]">
            <p className="font-bold">Afiyet Olsun! Teşekkür Ederiz.</p>
          </div>
        </div>
      )}
    </div>
  );

  function renderOrderTypeBadge(order: Order) {
    if (order.orderType === "dine_in") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
          <QrCode className="w-3.5 h-3.5" /> Masa {order.tableNumber}
        </span>
      );
    }
    if (order.orderType === "pickup") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
          <ShoppingBag className="w-3.5 h-3.5" /> Gel-Al
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2.5 py-0.5 rounded-full">
        <Truck className="w-3.5 h-3.5" /> Paket Servis
      </span>
    );
  }
}
