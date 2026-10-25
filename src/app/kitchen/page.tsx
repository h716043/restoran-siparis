"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
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
  Plus,
  Minus,
  Trash2,
  X,
  Utensils,
} from "lucide-react";
import {
  CallerIdIncomingEvent,
  Category,
  CourierLiveLocation,
  MenuItem,
  Order,
  OrderItem,
  OrderType,
  PaymentMethod,
  PosTableLiveState,
  RestaurantSettings,
  SelectedModifier,
  TableCall,
  TableReservation,
  formatTableLabel,
  getRestaurantTables,
  isSameTableName,
} from "@/types";
import { soundAlert } from "@/lib/sound";
import {
  extractSubProductHeader,
  parseStructuredModifiers,
  splitOptionNameAndPortion,
} from "@/lib/modifierFormat";

export default function KitchenTabletPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [posLiveTablesEnabled, setPosLiveTablesEnabled] = useState(false);
  const [posTableStates, setPosTableStates] = useState<PosTableLiveState[]>([]);
  const [tableCalls, setTableCalls] = useState<TableCall[]>([]);
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [callerEvents, setCallerEvents] = useState<CallerIdIncomingEvent[]>([]);
  const [courierLocations, setCourierLocations] = useState<
    Array<
      CourierLiveLocation & {
        assignedOrders?: Array<{
          id: string;
          orderNumber: number;
          customerName: string;
          customerAddress?: string;
          deliveryZoneName?: string;
          status: string;
          totalAmount: number;
        }>;
      }
    >
  >([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrintOnAccept, setAutoPrintOnAccept] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] =
    useState<Order | null>(null);
  const [printTicketMode, setPrintTicketMode] = useState<
    "full" | "kitchen_only" | "bar_only"
  >("full");
  const [sendingZReport, setSendingZReport] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "active"
    | "tables"
    | "couriers_map"
    | "stock"
    | "reservations"
    | "completed"
    | "rejected"
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
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Kasa POS / Telefon Siparişi Modalı State
  const [posModalOpen, setPosModalOpen] = useState(false);
  const [posOrderType, setPosOrderType] = useState<OrderType>("delivery");
  const [posTableNumber, setPosTableNumber] = useState<string>("1");
  const [posGuestCount, setPosGuestCount] = useState<number>(2);
  const [posPhone, setPosPhone] = useState<string>("");
  const [posName, setPosName] = useState<string>("");
  const [posAddress, setPosAddress] = useState<string>("");
  const [posNote, setPosNote] = useState<string>("");
  const [posPaymentMethod, setPosPaymentMethod] =
    useState<PaymentMethod>("cash");
  const [posCategory, setPosCategory] = useState<string>("all");
  const [posCart, setPosCart] = useState<OrderItem[]>([]);
  const [posCustomizingItem, setPosCustomizingItem] =
    useState<MenuItem | null>(null);
  const [posChosenModifiers, setPosChosenModifiers] = useState<
    Record<string, string[]>
  >({});
  const [posChosenSubOptions, setPosChosenSubOptions] = useState<
    Record<string, string[]>
  >({});
  const [posCustomerInfo, setPosCustomerInfo] = useState<{
    orderCount: number;
    loyaltyPoints: number;
  } | null>(null);
  const [posSubmitting, setPosSubmitting] = useState(false);

  // Masa Detay, Masa Taşıma/Birleştirme & Parçalı Tahsilat Modalı State
  const [selectedTableModal, setSelectedTableModal] = useState<string | null>(
    null
  );
  const [transferTargetTable, setTransferTargetTable] = useState<string>("1");
  const [tablePaymentMode, setTablePaymentMode] = useState<
    "cash" | "card" | "split" | "credit"
  >("cash");
  const [splitCashAmount, setSplitCashAmount] = useState<string>("");
  const [splitCardAmount, setSplitCardAmount] = useState<string>("");
  const [tableExtraDiscount, setTableExtraDiscount] = useState<string>("0");
  const [tableCreditAccountId, setTableCreditAccountId] = useState<string>("");
  const [tableCreditCustomerName, setTableCreditCustomerName] =
    useState<string>("");
  const [tableCreditSearch, setTableCreditSearch] = useState<string>("");
  const [posCustomerSearch, setPosCustomerSearch] = useState<string>("");
  const [registeredCustomers, setRegisteredCustomers] = useState<
    Array<{
      id: string;
      name: string;
      phone: string;
      address: string;
      orderCount: number;
      loyaltyPoints: number;
    }>
  >([]);
  const [tableActionLoading, setTableActionLoading] = useState(false);
  const [checkedModalItemKeys, setCheckedModalItemKeys] = useState<string[]>(
    []
  );
  const [stationFilter, setStationFilter] = useState<
    "all" | "grill" | "cold" | "drink_dessert" | "late"
  >("all");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [voiceTtsEnabled, setVoiceTtsEnabled] = useState(true);
  const [showBatchSummaryOpen, setShowBatchSummaryOpen] = useState(false);

  const knownPendingIds = useRef<Set<string>>(new Set());
  const knownCallIds = useRef<Set<string>>(new Set());
  const knownCallerEventIds = useRef<Set<string>>(new Set());
  const [kdsFontScale, setKdsFontScale] = useState<"normal" | "large" | "xlarge">("normal");

  const speakKitchenTurkish = (text: string) => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = "tr-TR";
        utt.rate = 0.98;
        window.speechSynthesis.speak(utt);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      const savedAutoPrint = localStorage.getItem("restoran_auto_print_receipt");
      if (savedAutoPrint === "1") {
        setAutoPrintOnAccept(true);
      }
      const savedTts = localStorage.getItem("restoran_kitchen_tts");
      if (savedTts === "0") {
        setVoiceTtsEnabled(false);
      }
    } catch {
      // ignore
    }
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.customers)) setRegisteredCustomers(d.customers);
      })
      .catch(() => {});
    const clock = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(clock);
  }, []);

  const lastMenuFetchMsRef = useRef<number>(0);
  const isFetchingOrdersRef = useRef<boolean>(false);

  const fetchOrders = async (forceAll = false) => {
    if (isFetchingOrdersRef.current && !forceAll) return;
    isFetchingOrdersRef.current = true;
    try {
      const now = Date.now();
      const shouldFetchMenu =
        forceAll || now - lastMenuFetchMsRef.current > 20000;

      const [ordRes, menuRes, callRes, resvRes, cidRes, courRes] =
        await Promise.all([
          fetch("/api/orders"),
          shouldFetchMenu ? fetch("/api/menu") : Promise.resolve(null),
          fetch("/api/table-calls"),
          shouldFetchMenu ? fetch("/api/reservations") : Promise.resolve(null),
          fetch("/api/caller-id"),
          shouldFetchMenu
            ? fetch("/api/courier-locations")
            : Promise.resolve(null),
        ]);
      const ordData = await ordRes.json();
      const menuData = menuRes && menuRes.ok ? await menuRes.json() : null;
      const callData = await callRes.json();
      const resvData = resvRes && resvRes.ok ? await resvRes.json() : null;
      const cidData = cidRes.ok ? await cidRes.json() : { activeCalls: [] };
      const courData =
        courRes && courRes.ok ? await courRes.json() : null;

      if (shouldFetchMenu) {
        lastMenuFetchMsRef.current = now;
      }

      const list: Order[] = ordData.orders || [];
      const calls: TableCall[] = callData.calls || [];
      const resvs: TableReservation[] = resvData
        ? resvData.reservations || []
        : reservations;
      const activeCid: CallerIdIncomingEvent[] = cidData.activeCalls || [];

      setOrders(list);
      setCallerEvents(activeCid);
      if (courData && Array.isArray(courData.locations)) {
        setCourierLocations(courData.locations);
      }
      setPosLiveTablesEnabled(Boolean(ordData.posLiveTablesEnabled));
      setPosTableStates(
        Array.isArray(ordData.posTableStates)
          ? ordData.posTableStates
          : ordData.posTableStates && typeof ordData.posTableStates === "object"
          ? (Object.values(ordData.posTableStates) as PosTableLiveState[])
          : []
      );
      if (menuData) {
        if (menuData.settings) setSettings(menuData.settings);
        if (menuData.items) setMenuItems(menuData.items);
        if (menuData.categories) setCategories(menuData.categories);
      }
      setTableCalls(calls);
      if (resvData) {
        setReservations(resvs);
      }

      // Yeni bekleyen sipariş, masa çağrısı, rezervasyon veya gelen telefon araması varsa zil çal
      const pendingOrders = list.filter((o) => o.status === "pending");
      const pendingCalls = calls.filter((c) => c.status === "pending");
      const pendingResvs = resvs.filter((r) => r.status === "pending");
      const hasNewCallerId = activeCid.some(
        (c) => !knownCallerEventIds.current.has(c.id)
      );

      if (soundEnabled) {
        const newlyArrivedOrders = pendingOrders.filter(
          (o) => !knownPendingIds.current.has(o.id)
        );
        const newlyArrivedCalls = pendingCalls.filter(
          (c) => !knownCallIds.current.has(c.id)
        );
        if (pendingOrders.length > 0) {
          soundAlert.playOrderRing();
          if (voiceTtsEnabled && newlyArrivedOrders.length > 0) {
            const firstNew = newlyArrivedOrders[0];
            const speechMsg =
              firstNew.orderType === "dine_in" && firstNew.tableNumber
                ? `Yeni masa siparişi geldi. Masa ${firstNew.tableNumber}.`
                : firstNew.orderType === "pickup"
                ? `Yeni gel al siparişi geldi. Numara ${firstNew.orderNumber}.`
                : `Yeni paket sipariş geldi. Numara ${firstNew.orderNumber}.`;
            speakKitchenTurkish(speechMsg);
          }
        } else if (
          pendingCalls.length > 0 ||
          pendingResvs.length > 0 ||
          hasNewCallerId
        ) {
          soundAlert.playTableCallRing();
          if (voiceTtsEnabled && newlyArrivedCalls.length > 0) {
            const firstCall = newlyArrivedCalls[0];
            const callSpeech =
              firstCall.type === "bill_cash"
                ? `Masa ${firstCall.tableNumber} nakit hesap istiyor.`
                : firstCall.type === "bill_card"
                ? `Masa ${firstCall.tableNumber} pos cihazı ile hesap istiyor.`
                : `Masa ${firstCall.tableNumber} garson çağırıyor.`;
            speakKitchenTurkish(callSpeech);
          }
        }
      }
      knownPendingIds.current = new Set(pendingOrders.map((o) => o.id));
      knownCallIds.current = new Set(pendingCalls.map((c) => c.id));
      knownCallerEventIds.current = new Set(activeCid.map((c) => c.id));
    } catch (e) {
      console.error("Siparişler alınamadı:", e);
    } finally {
      isFetchingOrdersRef.current = false;
    }
  };

  // POS modülü aktifken belirli bir masanın SambaPOS canlı durumunu döndürür
  const getPosStateForTable = (tableNum: string): PosTableLiveState | undefined => {
    if (!posLiveTablesEnabled) return undefined;
    return posTableStates.find((st) => isSameTableName(st.tableName, tableNum));
  };

  // POS modülü aktifse masadaki açık POS adisyonunu + henüz onaylanmamış pending web siparişlerini birleştirir;
  // POS modülü kapalıysa standart site siparişlerini döndürür
  const getEffectiveTableOrders = (tableNum: string): Order[] => {
    if (!posLiveTablesEnabled) {
      return orders.filter(
        (o) =>
          o.orderType === "dine_in" &&
          isSameTableName(o.tableNumber, tableNum) &&
          ["pending", "accepted", "ready"].includes(o.status)
      );
    }

    const posState = getPosStateForTable(tableNum);
    const pendingSiteOrders = orders.filter(
      (o) =>
        o.orderType === "dine_in" &&
        isSameTableName(o.tableNumber, tableNum) &&
        o.status === "pending"
    );

    const result: Order[] = [];
    if (posState && posState.isOccupied && posState.items.length > 0) {
      const posOrder: Order = {
        id: `pos-ticket-${posState.ticketId || tableNum}`,
        orderNumber: Number(posState.ticketNumber || posState.ticketId || 100),
        orderType: "dine_in",
        tableNumber: tableNum,
        customerName: `${formatTableLabel(tableNum)} (POS #${posState.ticketNumber || posState.ticketId || "-"})`,
        customerPhone: "SambaPOS Adisyonu",
        paymentMethod: "pos_at_table",
        status: "accepted",
        subtotal: posState.totalAmount,
        discountAmount: 0,
        deliveryFee: 0,
        totalAmount: posState.totalAmount,
        createdAt:
          posState.updatedAt || posState.createdAt || new Date().toISOString(),
        updatedAt:
          posState.updatedAt || posState.createdAt || new Date().toISOString(),
        items: posState.items.map((it) => ({
          id: it.id,
          menuItemId: it.id,
          name:
            it.portionName && it.portionName !== "Normal"
              ? `${it.name} (${it.portionName})`
              : it.name,
          quantity: it.quantity,
          basePrice: it.unitPrice,
          unitPrice: it.unitPrice,
          selectedModifiers: [],
          totalPrice: it.totalPrice,
          prepared: it.prepared ?? true,
          isComplimentary: it.isComplimentary,
        })),
      };
      result.push(posOrder);
    }

    return [...result, ...pendingSiteOrders];
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

  const [posSyncingOrderId, setPosSyncingOrderId] = useState<string | null>(
    null
  );

  const handleManualSambaSync = async (orderId: string) => {
    setPosSyncingOrderId(orderId);
    try {
      const res = await fetch("/api/pos-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_order", orderId }),
      });
      const data = await res.json();
      await fetchOrders();
      if (!data.ok && data.message) {
        alert(`SambaPOS Aktarım Uyarısı:\n${data.message}`);
      }
    } catch {
      alert("SambaPOS bağlantı hatası.");
    } finally {
      setPosSyncingOrderId(null);
    }
  };

  const renderSambaPosBadge = (order: Order) => {
    if (!settings?.posIntegrationConfig?.sambaPos?.enabled) return null;
    const sync = order.posSyncInfo;
    const isSyncing = posSyncingOrderId === order.id;

    if (sync?.status === "synced") {
      return (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-lg"
          title={
            sync.externalTicketId
              ? `SambaPOS Fiş #${sync.externalTicketId}`
              : "SambaPOS'a Aktarıldı"
          }
        >
          ✅ SambaPOS{sync.externalTicketId ? ` #${sync.externalTicketId}` : ""}
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleManualSambaSync(order.id)}
        disabled={isSyncing}
        className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-lg border transition cursor-pointer disabled:opacity-50 ${
          sync?.errorMessage
            ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40"
            : "bg-indigo-600/25 hover:bg-indigo-600 text-indigo-200 hover:text-white border-indigo-500/40"
        }`}
        title={
          sync?.errorMessage
            ? `Son Hata: ${sync.errorMessage} (Tekrar göndermek için tıklayın)`
            : "Bu siparişi şimdi SambaPOS'a aktar"
        }
      >
        {isSyncing
          ? "⏳ SambaPOS..."
          : sync?.errorMessage
          ? "⚠️ SambaPOS Tekrar Dene"
          : "🔌 SambaPOS'a Aktar"}
      </button>
    );
  };

  const isBarItem = (it: OrderItem) => {
    const mItem = menuItems.find((m) => m.id === it.menuItemId);
    const catId = mItem?.categoryId || "";
    const catName = (
      categories.find((c) => c.id === catId)?.name ||
      it.name ||
      ""
    ).toLowerCase();
    return (
      catId === "cat-5" ||
      catId === "cat-6" ||
      catName.includes("tatlı") ||
      catName.includes("içecek") ||
      catName.includes("ayran") ||
      catName.includes("kola") ||
      catName.includes("şalgam") ||
      catName.includes("su") ||
      catName.includes("künefe") ||
      catName.includes("baklava") ||
      catName.includes("sütlaç")
    );
  };

  const handlePrint = (
    order: Order,
    mode: "full" | "kitchen_only" | "bar_only" = "full"
  ) => {
    setPrintTicketMode(mode);
    setSelectedOrderForPrint(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDismissCallerEvent = async (callId: string | "all") => {
    try {
      await fetch("/api/caller-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          callId === "all" ? { dismissAll: true } : { id: callId }
        ),
      });
      fetchOrders();
    } catch {
      // ignore
    }
  };

  const handleOpenPosFromCallerId = (
    call: CallerIdIncomingEvent,
    loadLastOrder: boolean
  ) => {
    setPosOrderType("delivery");
    setPosPhone(call.phone || "");
    setPosName(call.customerName || "");
    setPosAddress(call.customerAddress || "");
    if (call.isRegistered) {
      setPosCustomerInfo({
        orderCount: call.orderCount || 0,
        loyaltyPoints: call.loyaltyPoints || 0,
      });
    } else {
      setPosCustomerInfo(null);
    }

    if (loadLastOrder && call.lastOrder?.items?.length) {
      const clonedItems: OrderItem[] = call.lastOrder.items.map((it, idx) => ({
        ...it,
        id: `pos-repeat-${Date.now()}-${idx}`,
        prepared: false,
      }));
      setPosCart(clonedItems);
    }

    setPosModalOpen(true);
    handleDismissCallerEvent(call.id);
  };

  const handleSimulateCallerId = async () => {
    try {
      await fetch("/api/caller-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulateRandomRegistered: true,
          line: "Hat 1 (USB Caller ID)",
        }),
      });
      fetchOrders();
    } catch {
      // ignore
    }
  };

  const handleSendWhatsAppZReport = async () => {
    setSendingZReport(true);
    try {
      const res = await fetch("/api/reports/whatsapp-z-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        alert(
          `✅ Gün Sonu (Z) Raporu WhatsApp ile (${data.targetPhone}) numarasına gönderildi!\n\nToplam Ciro: ${Number(data.summary?.totalRevenue || 0).toFixed(2)} TL (${data.summary?.orderCount || 0} Sipariş)`
        );
      } else {
        alert(`⚠️ Z Raporu Gönderilemedi:\n${data.error || "Bilinmeyen hata"}`);
      }
    } catch {
      alert("WhatsApp Z Raporu gönderilirken bağlantı hatası oluştu.");
    } finally {
      setSendingZReport(false);
    }
  };

  const handleSimulateCourierGps = async () => {
    const courierList = settings?.couriers?.length
      ? settings.couriers
      : ["Kurye 1 (Motorlu)", "Kurye 2 (Motorlu)"];
    const baseLat = 41.0082;
    const baseLng = 28.9784;
    for (let i = 0; i < courierList.length; i++) {
      await fetch("/api/courier-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courierName: courierList[i],
          lat: baseLat + (Math.random() - 0.5) * 0.015,
          lng: baseLng + (Math.random() - 0.5) * 0.015,
          speedKmh: Math.floor(Math.random() * 35) + 18,
          accuracyMeters: 10,
          status: "on_delivery",
        }),
      });
    }
    fetchOrders();
  };

  const [updatingOrderStatus, setUpdatingOrderStatus] = useState<
    Record<string, Order["status"] | undefined>
  >({});
  const updatingOrderIdsRef = useRef<Set<string>>(new Set());

  const handleStatusChange = async (
    orderId: string,
    status: Order["status"],
    estimatedMinutes?: number,
    rejectReason?: string,
    courierName?: string,
    orderToAutoPrint?: Order
  ) => {
    if (updatingOrderIdsRef.current.has(orderId)) {
      return;
    }
    updatingOrderIdsRef.current.add(orderId);
    setUpdatingOrderStatus((prev) => ({ ...prev, [orderId]: status }));
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
        if (data.order) {
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? data.order : o))
          );
        }
        if (status === "accepted" && autoPrintOnAccept && !data.alreadyUpdated) {
          handlePrint(data.order || orderToAutoPrint);
        }
        await fetchOrders();
      }
    } catch (e) {
      console.error("Durum güncellenemedi:", e);
    } finally {
      updatingOrderIdsRef.current.delete(orderId);
      setUpdatingOrderStatus((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };

  // Kasa POS Telefon Sorgulama (Müşteri numarası girildiğinde otomatik ad/adres doldurur)
  const handlePosPhoneLookup = async (rawPhone: string) => {
    setPosPhone(rawPhone);
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPosCustomerInfo(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/customers?phone=${encodeURIComponent(rawPhone)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setPosName(data.user.name || "");
          if (data.user.addresses && data.user.addresses.length > 0) {
            setPosAddress(data.user.addresses[0].fullAddress);
          }
          setPosCustomerInfo({
            orderCount: data.orderCount || 0,
            loyaltyPoints: Number(data.user.loyaltyPoints || 0),
          });
        } else if (data.lastOrder) {
          setPosName(data.lastOrder.customerName || "");
          if (data.lastOrder.customerAddress) {
            setPosAddress(data.lastOrder.customerAddress);
          }
          setPosCustomerInfo({
            orderCount: data.orderCount || 1,
            loyaltyPoints: 0,
          });
        }
      }
    } catch {
      // ignore
    }
  };

  const handlePosAddItem = (item: MenuItem) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      const defaults: Record<string, string[]> = {};
      for (const g of item.modifierGroups) {
        if (g.required && g.options.length > 0) {
          defaults[g.id] = [g.options[0].id];
        } else {
          defaults[g.id] = [];
        }
      }
      setPosChosenModifiers(defaults);
      setPosChosenSubOptions({});
      setPosCustomizingItem(item);
      return;
    }

    setPosCart((prev) => [
      ...prev,
      {
        id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: item.id,
        name: item.name,
        quantity: 1,
        basePrice: item.price,
        unitPrice: item.price,
        totalPrice: item.price,
        selectedModifiers: [],
      },
    ]);
  };

  const handleConfirmPosCustomizedItem = () => {
    if (!posCustomizingItem) return;
    let extra = 0;
    const selectedMods: SelectedModifier[] = [];

    for (const group of posCustomizingItem.modifierGroups || []) {
      const chosenIds = posChosenModifiers[group.id] || [];
      const baseGroupName = group.productTag
        ? `${group.productTag} (${group.name})`
        : group.name;
      const gLower = group.name.toLowerCase();
      const mainRole: SelectedModifier["modifierRole"] = gLower.includes(
        "çıkarılacak"
      )
        ? "removal"
        : gLower.includes("porsiyon") ||
          gLower.includes("çeşit") ||
          Boolean(group.productTag)
        ? "portion"
        : "extra";

      for (const opt of group.options) {
        if (chosenIds.includes(opt.id)) {
          extra += opt.price;
          selectedMods.push({
            groupName: baseGroupName,
            optionName: opt.name,
            price: opt.price,
            productTag: group.productTag,
            modifierRole: mainRole,
          });
          const subKey = `${group.id}__${opt.id}`;
          const chosenSubIds = posChosenSubOptions[subKey] || [];
          for (const subOpt of opt.subOptions || []) {
            if (chosenSubIds.includes(subOpt.id)) {
              extra += subOpt.price;
              const subLower = subOpt.name.toLowerCase();
              const isRemoval =
                subLower.startsWith("soğansız") ||
                subLower.startsWith("domatessiz") ||
                subLower.startsWith("turşusuz");
              selectedMods.push({
                groupName: `${group.productTag || opt.name} • Porsiyon Ekstrası`,
                optionName: subOpt.name,
                price: subOpt.price,
                productTag: group.productTag,
                modifierRole: isRemoval ? "removal" : "sub_extra",
                parentOptionName: opt.name,
              });
            }
          }
        }
      }
    }

    const unit = posCustomizingItem.price + extra;
    setPosCart((prev) => [
      ...prev,
      {
        id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: posCustomizingItem.id,
        name: posCustomizingItem.name,
        quantity: 1,
        basePrice: posCustomizingItem.price,
        unitPrice: unit,
        totalPrice: unit,
        selectedModifiers: selectedMods,
      },
    ]);
    setPosCustomizingItem(null);
  };

  // Mutfak Usta Checklist: Ürün Bazlı "Hazırlandı ✓" Tikleme
  const handleToggleItemPrepared = async (orderId: string, itemId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              items: o.items.map((it) =>
                it.id === itemId ? { ...it, prepared: !it.prepared } : it
              ),
            }
          : o
      )
    );
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_item_prepared",
          itemId,
        }),
      });
      fetchOrders();
    } catch (e) {
      console.error("Ürün tikleme hatası:", e);
    }
  };

  // Mutfak Ekranında Siparişi "Acil / Öncelikli (VIP)" Olarak En Üste Sabitleme
  const handleToggleOrderPriority = async (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, isPriority: !o.isPriority } : o
      )
    );
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_priority" }),
      });
      fetchOrders();
    } catch (e) {
      console.error("Öncelik değiştirilemedi:", e);
    }
  };

  // Mutfaktan Garsona Tek Tuşla "Tezgaha Gel / Yemek Soğuyor" Çağrı Zili
  const handleCallWaiterToKitchen = async (label: string) => {
    try {
      await fetch("/api/table-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableNumber: label,
          type: "kitchen_pickup",
        }),
      });
      fetchOrders();
    } catch (e) {
      console.error("Garson tezgaha çağrılamadı:", e);
    }
  };

  const handlePosSubmitOrder = async (andPrint: boolean) => {
    if (posCart.length === 0) return;
    setPosSubmitting(true);
    try {
      // Eğer Masada (dine_in) seçiliyse ve bu masada zaten açık bir adisyon varsa, doğrudan o adisyona ekle
      const existingOpenTableOrder =
        posOrderType === "dine_in"
          ? orders.find(
              (o) =>
                o.orderType === "dine_in" &&
                isSameTableName(o.tableNumber, posTableNumber) &&
                ["pending", "accepted", "ready"].includes(o.status)
            )
          : undefined;

      if (existingOpenTableOrder) {
        const res = await fetch(`/api/orders/${existingOpenTableOrder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "append_items",
            items: posCart,
            extraNote: posNote.trim() || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setPosCart([]);
          setPosNote("");
          setPosModalOpen(false);
          await fetchOrders();
          if (andPrint && data.order) {
            handlePrint(data.order);
          }
        }
        return;
      }

      const subtotal = posCart.reduce((s, i) => s + i.totalPrice, 0);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isStaffPosOrder: true,
          orderType: posOrderType,
          tableNumber: posOrderType === "dine_in" ? posTableNumber : undefined,
          guestCount:
            posOrderType === "dine_in" && posGuestCount > 0
              ? posGuestCount
              : undefined,
          customerName:
            posName.trim() ||
            (posOrderType === "dine_in"
              ? formatTableLabel(posTableNumber)
              : "Kasa / Telefon Müşterisi"),
          customerPhone: posPhone.trim() || "Kasa Siparişi",
          customerAddress:
            posOrderType === "delivery" ? posAddress.trim() : undefined,
          orderNote: posNote.trim() || undefined,
          paymentMethod:
            posOrderType === "dine_in" ? "pos_at_table" : posPaymentMethod,
          subtotal,
          discountAmount: 0,
          deliveryFee: 0,
          totalAmount: subtotal,
          items: posCart,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPosCart([]);
        setPosNote("");
        setPosModalOpen(false);
        await fetchOrders();
        if (andPrint && data.order) {
          handlePrint(data.order);
        }
      }
    } finally {
      setPosSubmitting(false);
    }
  };

  // Masa Detay & Parçalı Ödeme Modalını Açma
  const openTableManagementModal = (tableNum: string, tableOrders: Order[]) => {
    const total = tableOrders.reduce((s, o) => s + o.totalAmount, 0);
    setSelectedTableModal(tableNum);
    setCheckedModalItemKeys([]);
    const allTables = getRestaurantTables(settings);
    const nextTarget =
      allTables.find((t) => !isSameTableName(t, tableNum)) ||
      (tableNum === "1" ? "2" : "1");
    setTransferTargetTable(nextTarget);
    setTablePaymentMode("cash");
    setTableExtraDiscount("0");
    setSplitCashAmount(String(Math.round(total / 2)));
    setSplitCardAmount(String(Math.max(0, total - Math.round(total / 2))));
  };

  // Masadan erken kalkan kişinin seçilen ürünlerini kısmi tahsil edip adisyondan düşme
  const handlePartialTablePaymentModal = async (
    tableNum: string,
    method: "cash" | "pos_at_table"
  ) => {
    if (!tableNum || checkedModalItemKeys.length === 0) return;
    setTableActionLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "partial_table_payment",
          tableNumber: tableNum,
          selectedItemKeys: checkedModalItemKeys,
          paymentMethod: method,
        }),
      });
      if (res.ok) {
        setCheckedModalItemKeys([]);
        await fetchOrders();
      }
    } finally {
      setTableActionLoading(false);
    }
  };

  // Masa Taşıma / Birleştirme
  const handleTransferTable = async (fromTable: string, toTable: string) => {
    if (!fromTable || !toTable || fromTable === toTable) return;
    setTableActionLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer_table",
          fromTable,
          toTable,
        }),
      });
      if (res.ok) {
        setSelectedTableModal(toTable);
        await fetchOrders();
      }
    } finally {
      setTableActionLoading(false);
    }
  };

  // Parçalı / Nakit / Kart / Cari Tahsilat ile Masa Hesabını Kapatma
  const handleCloseTableWithPaymentModal = async (
    tableNum: string,
    tableOrders: Order[],
    andPrint: boolean
  ) => {
    const isRegPick = tableCreditAccountId.startsWith("reg::");
    const regParts = isRegPick ? tableCreditAccountId.slice(5).split("::") : [];
    const selectedAcc = !isRegPick
      ? (settings?.creditAccounts || []).find(
          (a) => a.id === tableCreditAccountId
        )
      : undefined;
    const creditName =
      selectedAcc?.customerName ||
      (isRegPick ? regParts[0] : "") ||
      tableCreditCustomerName.trim();
    const creditPhone =
      selectedAcc?.customerPhone || (isRegPick ? regParts[1] : "") || undefined;
    if (tablePaymentMode === "credit" && !creditName) {
      alert("Lütfen veresiye/cari yazılacak müşteri adını seçin veya yazın.");
      return;
    }

    setTableActionLoading(true);
    try {
      const rawTotal = tableOrders.reduce((s, o) => s + o.totalAmount, 0);
      const extraDisc = Math.max(0, Number(tableExtraDiscount || 0));
      const finalPayable = Math.max(0, rawTotal - extraDisc);
      const cashVal =
        tablePaymentMode === "cash"
          ? finalPayable
          : tablePaymentMode === "card" || tablePaymentMode === "credit"
          ? 0
          : Math.max(0, Number(splitCashAmount || 0));
      const cardVal =
        tablePaymentMode === "card"
          ? finalPayable
          : tablePaymentMode === "cash" || tablePaymentMode === "credit"
          ? 0
          : Math.max(0, Number(splitCardAmount || 0));

      if (andPrint) {
        handlePrintCombinedTableBill(tableNum, tableOrders);
      }

      await Promise.all([
        fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "close_table_payment",
            tableNumber: tableNum,
            paymentMethod:
              tablePaymentMode === "cash"
                ? "cash"
                : tablePaymentMode === "card"
                ? "card_at_door"
                : tablePaymentMode === "credit"
                ? "credit"
                : "pos_at_table",
            cashAmount: cashVal,
            cardAmount: cardVal,
            discountAmount: extraDisc,
            creditAccountId: selectedAcc?.id || undefined,
            creditAccountName: creditName || undefined,
            creditAccountPhone: creditPhone,
          }),
        }),
        ...tableCalls
          .filter(
            (c) =>
              isSameTableName(c.tableNumber, tableNum) &&
              c.status === "pending"
          )
          .map((c) =>
            fetch("/api/table-calls", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: c.id }),
            })
          ),
      ]);

      setSelectedTableModal(null);
      await fetchOrders();
    } finally {
      setTableActionLoading(false);
    }
  };

  // Canlı Masa Adisyonu Tek Tıkla Hesap Kapatma
  const handleCloseTableBill = async (tableNum: string, tableOrders: Order[]) => {
    openTableManagementModal(tableNum, tableOrders);
  };

  // Masa Adisyonu Birleştirilmiş Fiş Yazdırma
  const handlePrintCombinedTableBill = (
    tableNum: string,
    tableOrders: Order[]
  ) => {
    if (tableOrders.length === 0) return;
    const combinedItems: OrderItem[] = [];
    for (const ord of tableOrders) {
      for (const item of ord.items) {
        combinedItems.push(item);
      }
    }
    const total = tableOrders.reduce((s, o) => s + o.totalAmount, 0);
    const subtotal = tableOrders.reduce((s, o) => s + o.subtotal, 0);
    const discount = tableOrders.reduce(
      (s, o) => s + (o.discountAmount || 0),
      0
    );
    const loyaltyUsed = tableOrders.reduce(
      (s, o) => s + (o.loyaltyPointsUsed || 0),
      0
    );
    const combinedOrder: Order = {
      ...tableOrders[0],
      orderNumber: tableOrders[0].orderNumber,
      tableNumber: tableNum,
      customerName: `${formatTableLabel(tableNum)} Birleşik Adisyon (${tableOrders.length} Sipariş)`,
      subtotal,
      discountAmount: discount,
      loyaltyPointsUsed: loyaltyUsed,
      totalAmount: total,
      items: combinedItems,
    };
    handlePrint(combinedOrder);
  };

  const handleToggleStock = async (item: MenuItem) => {
    try {
      const nextAvailable = !item.available;
      const nextDailyStock =
        nextAvailable && item.dailyStock === 0 ? 15 : item.dailyStock;
      const updated = {
        ...item,
        available: nextAvailable,
        dailyStock: nextDailyStock,
      };
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
      // Tıklanır tıklanmaz ekrandan anında kaldır (Optimistic UI)
      const target = tableCalls.find((c) => c.id === id);
      setTableCalls((prev) =>
        id === "all"
          ? []
          : prev.filter(
              (c) =>
                c.id !== id &&
                !(
                  target &&
                  c.tableNumber === target.tableNumber &&
                  c.type === target.type
                )
            )
      );

      const res = await fetch("/api/table-calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.calls)) {
          setTableCalls(data.calls);
        }
      }
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

  const matchesStationFilter = (ord: Order) => {
    if (stationFilter === "all") return true;
    if (stationFilter === "late") {
      const elapsed = Math.floor(
        (nowMs - new Date(ord.createdAt).getTime()) / 60000
      );
      return elapsed >= 20;
    }
    return ord.items.some((it) => {
      const mItem = menuItems.find((m) => m.id === it.menuItemId);
      const catId = mItem?.categoryId || "";
      const catName = (
        categories.find((c) => c.id === catId)?.name ||
        it.name ||
        ""
      ).toLowerCase();
      if (stationFilter === "grill") {
        return (
          catId === "cat-1" ||
          catId === "cat-2" ||
          catId === "cat-3" ||
          catName.includes("kebap") ||
          catName.includes("ızgara") ||
          catName.includes("pide") ||
          catName.includes("döner") ||
          catName.includes("menü")
        );
      }
      if (stationFilter === "cold") {
        return (
          catId === "cat-4" ||
          catName.includes("salata") ||
          catName.includes("meze") ||
          catName.includes("çorba") ||
          catName.includes("başlangıç")
        );
      }
      if (stationFilter === "drink_dessert") {
        return (
          catId === "cat-5" ||
          catId === "cat-6" ||
          catName.includes("tatlı") ||
          catName.includes("içecek") ||
          catName.includes("ayran")
        );
      }
      return true;
    });
  };

  const getOrderElapsedMins = (ord: Order) =>
    Math.max(
      0,
      Math.floor((nowMs - new Date(ord.createdAt).getTime()) / 60000)
    );

  const overdueOrdersCount = orders.filter(
    (o) =>
      (o.status === "pending" || o.status === "accepted") &&
      getOrderElapsedMins(o) >= 20
  ).length;

  const sortByPriorityAndSla = (a: Order, b: Order) => {
    const prioDiff = Number(Boolean(b.isPriority)) - Number(Boolean(a.isPriority));
    if (prioDiff !== 0) return prioDiff;
    const aElapsed = getOrderElapsedMins(a);
    const bElapsed = getOrderElapsedMins(b);
    const aOverdue = aElapsed >= 20 ? 1 : 0;
    const bOverdue = bElapsed >= 20 ? 1 : 0;
    if (bOverdue !== aOverdue) return bOverdue - aOverdue;
    if (aOverdue && bOverdue) return bElapsed - aElapsed;
    return 0;
  };

  const pendingOrders = orders
    .filter((o) => o.status === "pending" && matchesStationFilter(o))
    .sort(sortByPriorityAndSla);
  const preparingOrders = orders
    .filter(
      (o) =>
        (o.status === "accepted" || o.status === "ready") &&
        matchesStationFilter(o)
    )
    .sort(sortByPriorityAndSla);
  const completedOrders = orders.filter((o) => o.status === "completed");
  const rejectedOrders = orders.filter((o) => o.status === "rejected");
  const pendingTableCalls = tableCalls.filter((c) => c.status === "pending");
  const pendingReservations = reservations.filter(
    (r) => r.status === "pending"
  );

  // 👨‍🍳 Müşteri Sipariş Geçmişi & VIP Rozeti Hesaplaması (Telefon Numarasına Göre)
  const customerStatsByPhone = useMemo(() => {
    const map = new Map<string, { orderCount: number; totalSpent: number }>();
    for (const o of orders) {
      if (o.status === "rejected") continue;
      const digits = (o.customerPhone || "").replace(/\D/g, "");
      if (digits.length < 10) continue;
      const norm = digits.slice(-10);
      const prev = map.get(norm) || { orderCount: 0, totalSpent: 0 };
      prev.orderCount += 1;
      prev.totalSpent += o.totalAmount || 0;
      map.set(norm, prev);
    }
    return map;
  }, [orders]);

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

        <div className="relative flex items-center gap-2">
          {/* Mutfaktan Garsona Tek Tuşla Tezgah Çağrı Zili */}
          <button
            type="button"
            onClick={() => handleCallWaiterToKitchen("Mutfak Tezgahı")}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2.5 rounded-xl transition shadow-lg cursor-pointer"
            title="Garsonların ekranında sesli/titreşimli 'Şef Tezgaha Çağırıyor' uyarısı çalar"
          >
            <Bell className="w-4 h-4" />
            <span>🔔 Garsonu Tezgaha Çağır</span>
          </button>

          {/* TEK BUTON ALTINDA TOPLANMIŞ HIZLI İŞLEMLER & MENÜ */}
          <button
            type="button"
            onClick={() => setHeaderMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 text-xs font-extrabold bg-orange-600 hover:bg-orange-500 text-white px-4 py-2.5 rounded-xl transition shadow-lg cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>⚡ Hızlı İşlemler & Menü</span>
            <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded-md">
              {headerMenuOpen ? "▲" : "▾"}
            </span>
          </button>

          {headerMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setHeaderMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 space-y-3">
                {/* 1. Kasa POS Sipariş Girişi */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setPosOrderType("delivery");
                      setPosModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 text-xs font-extrabold bg-orange-600 hover:bg-orange-500 text-white px-3.5 py-2.5 rounded-xl transition shadow-md cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    ➕ Kasa POS / Telefon Siparişi
                  </button>
                </div>

                {/* 2. Ekranlar & Paneller */}
                <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                    Ekranlar & Paneller
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Link
                      href="/waiter"
                      target="_blank"
                      onClick={() => setHeaderMenuOpen(false)}
                      className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 px-2.5 py-2 rounded-xl transition"
                    >
                      <span>📱 Garson Ekranı</span>
                    </Link>
                    <Link
                      href="/courier"
                      target="_blank"
                      onClick={() => setHeaderMenuOpen(false)}
                      className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-orange-300 border border-slate-700 px-2.5 py-2 rounded-xl transition"
                    >
                      <Truck className="w-3.5 h-3.5 shrink-0" />
                      <span>Kurye Ekranı</span>
                    </Link>
                    <Link
                      href="/tv"
                      target="_blank"
                      onClick={() => setHeaderMenuOpen(false)}
                      className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 px-2.5 py-2 rounded-xl transition"
                    >
                      <span>📺 TV Ekranı</span>
                    </Link>
                    <Link
                      href="/admin"
                      onClick={() => setHeaderMenuOpen(false)}
                      className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-2 rounded-xl transition"
                    >
                      <Settings className="w-3.5 h-3.5 shrink-0" />
                      <span>Yönetim Paneli</span>
                    </Link>
                  </div>
                </div>

                {/* 3. Ses & Yazıcı Ayarları */}
                <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                    Tablet Ses & Yazıcı Ayarları
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !soundEnabled;
                        setSoundEnabled(next);
                        if (next) soundAlert.playOrderRing();
                      }}
                      className={`flex items-center justify-center gap-1.5 text-xs font-bold px-2.5 py-2 rounded-xl border transition cursor-pointer ${
                        soundEnabled
                          ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                          : "bg-red-600/20 text-red-400 border-red-500/30"
                      }`}
                    >
                      {soundEnabled ? (
                        <>
                          <Volume2 className="w-3.5 h-3.5" /> Zil: AÇIK
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3.5 h-3.5" /> Zil: KAPALI
                        </>
                      )}
                    </button>

                    <button
                      type="button"
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
                      className={`flex items-center justify-center gap-1.5 text-xs font-bold px-2.5 py-2 rounded-xl border transition cursor-pointer ${
                        autoPrintOnAccept
                          ? "bg-orange-600/20 text-orange-300 border-orange-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {autoPrintOnAccept ? "Oto-Fiş: AÇIK" : "Oto-Fiş: KAPALI"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const next = !voiceTtsEnabled;
                        setVoiceTtsEnabled(next);
                        try {
                          localStorage.setItem(
                            "restoran_kitchen_tts",
                            next ? "1" : "0"
                          );
                        } catch {
                          // ignore
                        }
                        if (next) {
                          speakKitchenTurkish(
                            "Türkçe sesli sipariş anonsu aktif edildi."
                          );
                        }
                      }}
                      className={`col-span-2 flex items-center justify-center gap-1.5 text-xs font-bold px-2.5 py-2 rounded-xl border transition cursor-pointer ${
                        voiceTtsEnabled
                          ? "bg-sky-600/20 text-sky-300 border-sky-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      <span>🗣️</span>
                      <span>
                        {voiceTtsEnabled
                          ? "Türkçe Sesli Sipariş Okuma: AÇIK"
                          : "Türkçe Sesli Sipariş Okuma: KAPALI"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 4. Gün Sonu Raporu & Hızlı Test Araçları */}
                <div className="space-y-1.5 border-t border-slate-800 pt-2.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                    Raporlama, Caller ID & Test Araçları
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      disabled={sendingZReport}
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        handleSendWhatsAppZReport();
                      }}
                      className="flex items-center justify-center gap-1.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2.5 rounded-xl shadow transition cursor-pointer"
                    >
                      <span>
                        {sendingZReport
                          ? "⏳ Z Raporu Gönderiliyor..."
                          : "📲 Patrona Gün Sonu (Z) Raporu Gönder"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        handleSimulateCallerId();
                      }}
                      className="flex items-center justify-center gap-1.5 text-xs font-bold bg-cyan-600/25 hover:bg-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/40 px-3 py-2 rounded-xl transition cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      📞 Test: Caller ID Gelen Arama Simüle Et
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        createTestOrder();
                      }}
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-indigo-600/25 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/30 px-3 py-2 rounded-xl transition cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Test: Örnek Sipariş Gönder
                    </button>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          createTestTableCall();
                        }}
                        className="flex items-center justify-center gap-1 text-[11px] font-semibold bg-purple-600/25 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/30 px-2.5 py-2 rounded-xl transition cursor-pointer"
                      >
                        <HandPlatter className="w-3.5 h-3.5" />
                        Test: Masa Çağrısı
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          createTestReservation();
                        }}
                        className="flex items-center justify-center gap-1 text-[11px] font-semibold bg-amber-600/25 hover:bg-amber-600 text-amber-200 hover:text-white border border-amber-500/30 px-2.5 py-2 rounded-xl transition cursor-pointer"
                      >
                        <CalendarDays className="w-3.5 h-3.5" />
                        Test: Rezervasyon
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. Güvenlik / Çıkış */}
                <div className="border-t border-slate-800 pt-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/staff-auth", { method: "DELETE" });
                      window.location.href = "/staff-login?target=kitchen";
                    }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-bold bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white px-3 py-2 rounded-xl border border-red-500/30 transition cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Ekranı Kilitle / Çıkış Yap
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* 📞 CANLI CALLER ID (GELEN TELEFON ARAMASI) OTOMATİK POPUP PANELİ */}
      {callerEvents.length > 0 && (
        <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-emerald-950 border-b-2 border-cyan-400 px-4 py-3.5 shadow-xl">
          <div className="max-w-7xl mx-auto space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-300 font-black text-xs sm:text-sm uppercase tracking-wider">
                <Phone className="w-5 h-5 text-cyan-400 animate-bounce" />
                <span>
                  📞 CANLI CALLER ID — GELEN TELEFON ÇAĞRISI ({callerEvents.length})
                </span>
              </div>
              {callerEvents.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDismissCallerEvent("all")}
                  className="text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer"
                >
                  Tüm Çağrıları Kapat ✕
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {callerEvents.map((call) => (
                <div
                  key={call.id}
                  className="bg-slate-950/90 border-2 border-cyan-500/60 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-lg"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-cyan-500 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-lg">
                        📞 {call.phone}
                      </span>
                      {call.line && (
                        <span className="text-[11px] font-bold bg-slate-800 text-cyan-300 px-2 py-0.5 rounded border border-slate-700">
                          {call.line}
                        </span>
                      )}
                      {call.isRegistered ? (
                        <span className="text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                          ✅ Kayıtlı Müşteri ({call.orderCount || 0}. Sipariş • ⭐{" "}
                          {call.loyaltyPoints || 0} Puan)
                        </span>
                      ) : (
                        <span className="text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                          🆕 Yeni Numara (İlk Siparişte Kaydedilir)
                        </span>
                      )}
                    </div>
                    <div className="font-black text-base text-white">
                      {call.customerName || "İsimsiz Arayan Müşteri"}
                    </div>
                    {call.customerAddress && (
                      <div className="text-xs text-slate-300 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        <span>{call.customerAddress}</span>
                      </div>
                    )}
                    {call.lastOrder && (
                      <div className="text-xs bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-amber-200 mt-1">
                        <strong className="text-amber-400">
                          🕒 Son Siparişi (#{call.lastOrder.orderNumber} •{" "}
                          {call.lastOrder.totalAmount.toFixed(0)}{" "}
                          {settings?.currency}):
                        </strong>{" "}
                        {call.lastOrder.items
                          .map((i) => `${i.quantity}x ${i.name}`)
                          .join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenPosFromCallerId(call, false)}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs px-3.5 py-2.5 rounded-xl transition shadow cursor-pointer"
                    >
                      ➕ Sipariş Ekranını Aç (Bilgileri Doldur)
                    </button>
                    {call.lastOrder && call.lastOrder.items.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenPosFromCallerId(call, true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-3.5 py-2.5 rounded-xl transition shadow cursor-pointer"
                      >
                        🔄 Son Siparişini Tek Tıkla Sepete Yükle
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDismissCallerEvent(call.id)}
                      className="bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white font-bold text-xs px-3 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
                    >
                      ✕ Kapat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CANLI MASA ÇAĞRILARI (GARSON ÇAĞIR / HESAP İSTE) PANELİ */}
      {pendingTableCalls.length > 0 && (
        <div className="bg-purple-950/90 border-b-2 border-purple-500 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-purple-200 font-extrabold text-sm">
              <HandPlatter className="w-5 h-5 text-purple-400 animate-bounce" />
              <span>
                CANLI MASA ÇAĞRILARI ({pendingTableCalls.length} Masa Bekliyor)
              </span>
              {pendingTableCalls.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleResolveTableCall("all")}
                  className="ml-2 bg-purple-800 hover:bg-emerald-600 text-purple-100 hover:text-white text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-purple-400/50 transition cursor-pointer"
                >
                  Tümünü Temizle ✓
                </button>
              )}
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
                    type="button"
                    onClick={() => handleResolveTableCall(call.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg transition cursor-pointer"
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
            onClick={() => setActiveTab("tables")}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 whitespace-nowrap flex items-center gap-2 transition ${
              activeTab === "tables"
                ? "border-purple-500 text-purple-300 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>🪑 Canlı Masalar</span>
            <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-black px-2 py-0.5 rounded-full">
              {
                getRestaurantTables(settings).filter(
                  (t) =>
                    getEffectiveTableOrders(t).length > 0 ||
                    Boolean(getPosStateForTable(t)?.isOccupied)
                ).length
              }{" "}
              Dolu
            </span>
          </button>
          <button
            onClick={() => setActiveTab("couriers_map")}
            className={`px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 whitespace-nowrap flex items-center gap-2 transition ${
              activeTab === "couriers_map"
                ? "border-cyan-500 text-cyan-300 bg-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>🛵 Canlı Kurye Haritası</span>
            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-black px-2 py-0.5 rounded-full">
              {courierLocations.length} GPS
            </span>
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
          <div className="space-y-4">
            {/* 👨‍🍳 4. ÖZELLİK: CANLI MUTFAK HIZ & PERFORMANS (SLA) KOKPİTİ */}
            {(() => {
              const activeKdsList = [...pendingOrders, ...preparingOrders];
              const totalPortionsOnFire = activeKdsList.reduce(
                (sum, o) =>
                  sum +
                  o.items.reduce(
                    (s, it) => s + (!it.prepared ? it.quantity : 0),
                    0
                  ),
                0
              );
              const todayStr = new Date().toLocaleDateString("tr-TR");
              const todayDone = completedOrders.filter(
                (o) =>
                  new Date(o.createdAt).toLocaleDateString("tr-TR") === todayStr
              );
              const avgPrepMins =
                todayDone.length > 0
                  ? Math.max(
                      5,
                      Math.round(
                        todayDone.reduce((acc, o) => {
                          const diff =
                            (new Date(o.updatedAt || o.createdAt).getTime() -
                              new Date(o.createdAt).getTime()) /
                            60000;
                          return acc + Math.min(45, Math.max(4, diff));
                        }, 0) / todayDone.length
                      )
                    )
                  : settings?.estimatedPrepMinutes || 18;
              const onTimeCount = activeKdsList.filter((o) => {
                const el = Math.floor(
                  (nowMs - new Date(o.createdAt).getTime()) / 60000
                );
                return el < 20;
              }).length;
              const slaPct =
                activeKdsList.length > 0
                  ? Math.round((onTimeCount / activeKdsList.length) * 100)
                  : 100;

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-slate-400">
                        Ort. Hazırlık Hızı
                      </div>
                      <div className="text-lg font-black text-amber-400 mt-0.5">
                        ⚡ ~{avgPrepMins} dk
                      </div>
                    </div>
                    <span className="text-xl bg-amber-500/15 border border-amber-500/30 w-9 h-9 rounded-xl flex items-center justify-center">
                      ⏱️
                    </span>
                  </div>
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-slate-400">
                        Zamanında Çıkış (SLA)
                      </div>
                      <div
                        className={`text-lg font-black mt-0.5 ${
                          slaPct >= 85 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        🎯 %{slaPct} Başarı
                      </div>
                    </div>
                    <span className="text-xl bg-emerald-500/15 border border-emerald-500/30 w-9 h-9 rounded-xl flex items-center justify-center">
                      📈
                    </span>
                  </div>
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-slate-400">
                        Ocaktaki Porsiyon
                      </div>
                      <div className="text-lg font-black text-orange-400 mt-0.5">
                        🔥 {totalPortionsOnFire} Adet
                      </div>
                    </div>
                    <span className="text-xl bg-orange-500/15 border border-orange-500/30 w-9 h-9 rounded-xl flex items-center justify-center">
                      🍳
                    </span>
                  </div>
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-extrabold uppercase text-slate-400">
                        Bugün Tamamlanan
                      </div>
                      <div className="text-lg font-black text-sky-400 mt-0.5">
                        ✅ {todayDone.length} Sipariş
                      </div>
                    </div>
                    <span className="text-xl bg-sky-500/15 border border-sky-500/30 w-9 h-9 rounded-xl flex items-center justify-center">
                      🏆
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Mutfak İstasyon Filtresi & Gecikme Alarmı (KDS) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-extrabold uppercase text-slate-400 mr-1">
                  👨‍🍳 İstasyon Filtresi:
                </span>
                {[
                  { id: "all", label: "📋 Tüm İstasyonlar" },
                  { id: "grill", label: "🍖 Ana Yemek / Izgara / Fırın" },
                  { id: "cold", label: "🥗 Başlangıç / Salata / Çorba" },
                  { id: "drink_dessert", label: "🥤 İçecek & Tatlı" },
                  {
                    id: "late",
                    label:
                      overdueOrdersCount > 0
                        ? `🚨 Gecikenler (${overdueOrdersCount} ACİL)`
                        : "🚨 Gecikenler (20+ dk)",
                  },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      setStationFilter(st.id as typeof stationFilter)
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      stationFilter === st.id
                        ? st.id === "late"
                          ? "bg-red-600 text-white shadow"
                          : "bg-orange-600 text-white shadow"
                        : st.id === "late" && overdueOrdersCount > 0
                        ? "bg-red-950/90 text-red-200 border border-red-500 animate-pulse"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                {(() => {
                  const activeKitchenOrders = [
                    ...pendingOrders,
                    ...preparingOrders,
                  ];
                  const totalUnpreparedCount = activeKitchenOrders.reduce(
                    (sum, ord) =>
                      sum +
                      ord.items.reduce(
                        (iSum, it) => iSum + (!it.prepared ? it.quantity : 0),
                        0
                      ),
                    0
                  );
                  return (
                    <button
                      type="button"
                      onClick={() => setShowBatchSummaryOpen((v) => !v)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition flex items-center gap-1.5 cursor-pointer ${
                        showBatchSummaryOpen
                          ? "bg-orange-600 text-white border-orange-500 shadow"
                          : "bg-slate-950 hover:bg-slate-800 text-orange-300 border-orange-500/40"
                      }`}
                    >
                      <span>🔥</span>
                      <span>
                        Ocak / Tezgah Toplamları ({totalUnpreparedCount} Adet)
                      </span>
                      <span>{showBatchSummaryOpen ? "▲" : "▼"}</span>
                    </button>
                  );
                })()}
                <span className="text-emerald-400">🟢 0-15 dk Normal</span>
                <span>•</span>
                <span className="text-amber-300">🟡 15-20 dk Uyarı</span>
                <span>•</span>
                <span className="text-red-400">🔴 20+ dk SLA Gecikme</span>
                {/* 🔍 12. ÖZELLİK: UZAKTAN OKUMA İÇİN YAZI BOYUTU (A / A+ / A++) & TAM EKRAN KDS */}
                <div className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-0.5 ml-1">
                  {(
                    [
                      { id: "normal", label: "A Normal" },
                      { id: "large", label: "A+ Büyük" },
                      { id: "xlarge", label: "A++ Dev" },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setKdsFontScale(sc.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                        kdsFontScale === sc.id
                          ? "bg-orange-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                      title="Mutfak fiş yazı boyutunu büyüt / küçült"
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof document !== "undefined") {
                      if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen?.().catch(() => {});
                      } else {
                        document.exitFullscreen?.().catch(() => {});
                      }
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-extrabold cursor-pointer"
                  title="Tam Ekran Mutfak Odak Modu"
                >
                  🖥️ Tam Ekran
                </button>
              </div>
            </div>

            {/* 🔥 4. ÖNERİ: BUTONA TIKLAYINCA AÇILAN/KAPANAN OCAK / TEZGAH TOPLU ÜRETİM ÖZETİ PANELİ */}
            {showBatchSummaryOpen &&
              (() => {
                const batchMap: Record<string, number> = {};
                const activeKitchenOrders = [
                  ...pendingOrders,
                  ...preparingOrders,
                ];
                activeKitchenOrders.forEach((ord) => {
                  ord.items.forEach((it) => {
                    if (!it.prepared) {
                      batchMap[it.name] =
                        (batchMap[it.name] || 0) + it.quantity;
                    }
                  });
                });
                const batchList = Object.entries(batchMap).sort(
                  (a, b) => b[1] - a[1]
                );
                return (
                  <div className="bg-gradient-to-r from-slate-900 via-orange-950/40 to-slate-900 border border-orange-500/50 rounded-2xl p-3.5 space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                        <span className="animate-pulse">🔥</span>
                        Şu An Ocakta / Tezgahta Bekleyen Toplamlar:
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowBatchSummaryOpen(false)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer"
                      >
                        ✕ Kapat
                      </button>
                    </div>
                    {batchList.length === 0 ? (
                      <p className="text-xs text-slate-400 font-semibold">
                        Şu an ocakta veya tezgahta bekleyen açık ürün bulunmuyor.
                      </p>
                    ) : (
                      <div className="flex flex-col space-y-1.5 max-w-lg">
                        {batchList.map(([itemName, totalQty]) => (
                          <div
                            key={itemName}
                            className="flex items-center justify-between gap-3 bg-slate-950 border border-orange-500/40 px-3.5 py-2 rounded-xl text-xs font-extrabold text-white shadow-2xs"
                          >
                            <span className="truncate">{itemName}</span>
                            <strong className="bg-orange-500/20 text-orange-300 border border-orange-500/40 px-2.5 py-0.5 rounded-lg font-black shrink-0">
                              {totalQty} Adet
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

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

                  const channelStripeClass =
                    order.orderType === "delivery"
                      ? "border-l-8 border-l-orange-500"
                      : order.orderType === "pickup"
                      ? "border-l-8 border-l-sky-400"
                      : "border-l-8 border-l-purple-500";

                  return (
                    <div
                      key={order.id}
                      className={`bg-slate-900 border-2 ${channelStripeClass} rounded-2xl p-5 shadow-xl space-y-4 ${
                        order.isPriority
                          ? "border-rose-500 ring-2 ring-rose-500/40"
                          : "border-amber-500"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xl font-black text-amber-300 bg-amber-500/15 border border-amber-400/40 px-2.5 py-0.5 rounded-xl tracking-tight shadow-2xs">
                              #{order.orderNumber}
                            </span>
                            {order.isPriority && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full animate-pulse">
                                🚨 ACİL / ÖNCELİKLİ
                              </span>
                            )}
                            {renderOrderTypeBadge(order)}
                            {renderSlaTimerBadge(order.createdAt)}
                            {renderSambaPosBadge(order)}
                            <button
                              type="button"
                              onClick={() => handleToggleOrderPriority(order.id)}
                              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                order.isPriority
                                  ? "bg-rose-600 text-white border-rose-400"
                                  : "bg-slate-800 hover:bg-rose-600/30 text-slate-300 border-slate-700"
                              }`}
                              title="Siparişi Acil/VIP Olarak En Üste Sabitle"
                            >
                              {order.isPriority ? "🚨 Acil ✓" : "🚨 Acil Sabitle"}
                            </button>
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
                          <div className="font-bold text-base mt-1 flex flex-wrap items-center gap-2">
                            <span>{order.customerName}</span>
                            {(() => {
                              const digits = (order.customerPhone || "").replace(
                                /\D/g,
                                ""
                              );
                              if (digits.length < 10) return null;
                              const st = customerStatsByPhone.get(
                                digits.slice(-10)
                              );
                              if (!st) return null;
                              if (st.orderCount === 1) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full">
                                    🌟 İlk Siparişi!
                                  </span>
                                );
                              }
                              if (st.orderCount >= 5) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-purple-500/25 text-purple-200 border border-purple-400/50 px-2.5 py-0.5 rounded-full shadow-2xs">
                                    👑 VIP Müşteri ({st.orderCount}. Sipariş •{" "}
                                    {st.totalSpent.toFixed(0)}{" "}
                                    {settings?.currency || "₺"})
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">
                                  🔄 {st.orderCount}. Siparişi
                                </span>
                              );
                            })()}
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
                          ) : order.discountAmount && order.discountAmount < 0 ? (
                            <div className="text-[11px] text-rose-400 font-bold flex items-center justify-end gap-1">
                              <Tag className="w-3 h-3" />+
                              {Math.abs(order.discountAmount).toFixed(2)}{" "}
                              {settings?.currency}{" "}
                              {order.couponCode
                                ? `(${order.couponCode})`
                                : "(Fiyat Farkı)"}
                            </div>
                          ) : null}
                          {(order.loyaltyPointsUsed || 0) > 0 && (
                            <div className="text-[11px] text-amber-400 font-bold flex items-center justify-end gap-1">
                              🎁 Para Puan: -
                              {Number(order.loyaltyPointsUsed).toFixed(2)}{" "}
                              {settings?.currency}
                            </div>
                          )}
                          <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                            {order.paymentMethod === "cash"
                              ? "Nakit"
                              : order.paymentMethod === "card_at_door"
                              ? "Kapıda Kart"
                              : "Masada Ödeme"}
                          </span>
                        </div>
                      </div>

                      {/* Ürün Kalemleri (1/2/3 Alt Ürün + Porsiyon + Ekstra Ayrımlı + Usta Checklist) */}
                      <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 border-b border-slate-800 pb-1.5">
                          <span>👨‍🍳 Usta Hazırlık Kontrolü (Ürüne Tıklayıp Tikleyin)</span>
                          <span className="text-emerald-400">
                            {order.items.filter((i) => i.prepared).length} /{" "}
                            {order.items.length} Hazır
                          </span>
                        </div>
                        {order.items.map((item) => {
                          const structuredBlocks = parseStructuredModifiers(
                            item.selectedModifiers
                          );
                          return (
                            <div
                              key={item.id}
                              className={`border-b border-slate-800/60 last:border-none pb-2.5 last:pb-0 space-y-2 rounded-xl p-2 transition ${
                                item.prepared
                                  ? "bg-emerald-950/30 border border-emerald-500/40"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 font-bold text-sm">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleItemPrepared(order.id, item.id)
                                  }
                                  className="flex items-center gap-2 text-left cursor-pointer group"
                                >
                                  <span
                                    className={`inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[11px] font-black border transition ${
                                      item.prepared
                                        ? "bg-emerald-600 text-white border-emerald-400"
                                        : "bg-slate-800 group-hover:bg-emerald-600/30 text-slate-300 border-slate-700"
                                    }`}
                                  >
                                    {item.prepared ? "✓ Hazır" : "⬜ Tikle"}
                                  </span>
                                  <span
                                    className={
                                      item.prepared
                                        ? "line-through text-emerald-300/80"
                                        : "text-white"
                                    }
                                  >
                                    <span className="text-orange-400">
                                      {item.quantity}x
                                    </span>{" "}
                                    {item.name}
                                  </span>
                                </button>
                                <span>
                                  {item.totalPrice.toFixed(2)}{" "}
                                  {settings?.currency}
                                </span>
                              </div>

                              {structuredBlocks.length > 0 && (
                                <div className="space-y-2 pl-2">
                                  {structuredBlocks.map((block, bIdx) => (
                                    <div
                                      key={bIdx}
                                      className={`rounded-xl p-2.5 text-xs space-y-1.5 border ${
                                        block.stepBadge
                                          ? "bg-slate-900 border-orange-500/40"
                                          : "bg-slate-900/70 border-slate-800"
                                      }`}
                                    >
                                      {(block.stepBadge ||
                                        block.productTitle) && (
                                        <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                                          {block.stepBadge && (
                                            <span className="bg-orange-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                                              {block.stepBadge}
                                            </span>
                                          )}
                                          {block.productTitle && (
                                            <span className="font-extrabold text-orange-300 text-xs">
                                              {block.productTitle}
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {block.chosenDishName && (
                                        <div className="flex items-center gap-1.5 text-slate-100">
                                          <span className="font-black text-[10px] uppercase bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                                            ÜRÜN:
                                          </span>
                                          <span className="font-bold text-white">
                                            {block.chosenDishName}
                                          </span>
                                        </div>
                                      )}

                                      {block.portionLabel && (
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-black text-[10px] uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 rounded">
                                              🍽️ PORSİYON:
                                            </span>
                                            <span className="font-extrabold text-indigo-200">
                                              {block.portionLabel}
                                            </span>
                                          </div>
                                          {block.portionPrice > 0 && (
                                            <span className="text-[11px] font-bold text-orange-400">
                                              +{block.portionPrice}{" "}
                                              {settings?.currency}
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {block.extras.length > 0 && (
                                        <div className="pt-1 border-t border-slate-800/80 space-y-1">
                                          <div className="text-[10px] font-black uppercase text-emerald-400">
                                            ✨ EKSTRALAR & TERCİHLER:
                                          </div>
                                          <div className="space-y-0.5 pl-1.5">
                                            {block.extras.map((ex, eIdx) => (
                                              <div
                                                key={eIdx}
                                                className="flex items-center justify-between text-xs text-slate-200"
                                              >
                                                <span>+ {ex.name}</span>
                                                {ex.price > 0 && (
                                                  <span className="text-[11px] font-bold text-emerald-400">
                                                    +{ex.price}{" "}
                                                    {settings?.currency}
                                                  </span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {block.removals.length > 0 && (
                                        <div className="pt-1 border-t border-slate-800/80 space-y-0.5">
                                          {block.removals.map((rem, rIdx) => (
                                            <div
                                              key={rIdx}
                                              className="text-xs font-bold text-rose-400"
                                            >
                                              🚫 Çıkarılacak: {rem.name}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {item.itemNote && (
                                <div className="text-xs text-amber-300 pl-2 italic">
                                  Not: {item.itemNote}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
                          type="button"
                          disabled={Boolean(updatingOrderStatus[order.id])}
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
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>
                            {updatingOrderStatus[order.id] === "accepted"
                              ? "⏳ ONAYLANIYOR..."
                              : `SİPARİŞİ KABUL ET (${chosenMins} dk)${
                                  autoPrintOnAccept ? " + FİŞ" : ""
                                }`}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(order, "full")}
                          className="bg-slate-800 hover:bg-slate-700 text-orange-400 border border-slate-700 font-bold py-3.5 px-3 rounded-xl flex items-center gap-1 transition cursor-pointer text-xs"
                          title="80mm Fiyatlı Kasa Adisyonu Yazdır"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Kasa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(order, "kitchen_only")}
                          className="bg-slate-800 hover:bg-orange-600/30 text-amber-300 border border-slate-700 font-bold py-3.5 px-2.5 rounded-xl flex items-center gap-1 transition cursor-pointer text-xs"
                          title="80mm Fiyatsız Sadece Mutfak/Izgara Üretim Fişi Yazdır"
                        >
                          <span>🍖 Mutfak</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(order, "bar_only")}
                          className="bg-slate-800 hover:bg-cyan-600/30 text-cyan-300 border border-slate-700 font-bold py-3.5 px-2.5 rounded-xl flex items-center gap-1 transition cursor-pointer text-xs"
                          title="80mm Fiyatsız Sadece Bar (İçecek & Tatlı) Fişi Yazdır"
                        >
                          <span>🥤 Bar</span>
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(updatingOrderStatus[order.id])}
                          onClick={() => {
                            if (updatingOrderIdsRef.current.has(order.id)) return;
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
                          className="bg-red-600/20 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 hover:text-white border border-red-500/30 font-bold py-3.5 px-4 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <XCircle className="w-5 h-5" />
                          <span>
                            {updatingOrderStatus[order.id] === "rejected"
                              ? "⏳..."
                              : "Reddet"}
                          </span>
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
                  const elapsedMins = Math.max(
                    0,
                    Math.floor(
                      (nowMs - new Date(order.createdAt).getTime()) / 60000
                    )
                  );
                  const isLate = elapsedMins >= 20;
                  const isWarn = elapsedMins >= 10 && elapsedMins < 20;
                  const prepChannelStripeClass =
                    order.orderType === "delivery"
                      ? "border-l-8 border-l-orange-500"
                      : order.orderType === "pickup"
                      ? "border-l-8 border-l-sky-400"
                      : "border-l-8 border-l-purple-500";

                  return (
                    <div
                      key={order.id}
                      className={`bg-slate-900/95 backdrop-blur-md rounded-2xl p-5 space-y-4 border ${prepChannelStripeClass} transition-all ${
                        order.isPriority
                          ? "border-2 border-rose-500 ring-2 ring-rose-500/40 shadow-lg shadow-rose-950/30"
                          : isLate
                          ? "border-2 border-red-500 ring-2 ring-red-500/30 shadow-lg shadow-red-950/40 animate-pulse"
                          : isWarn
                          ? "border-2 border-amber-500/80 shadow-md shadow-amber-950/25"
                          : "border-emerald-500/40 shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xl font-black text-white bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-xl tracking-tight shadow-2xs">
                              #{order.orderNumber}
                            </span>
                            {order.isPriority && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black bg-rose-600 text-white px-2.5 py-0.5 rounded-full animate-pulse">
                                🚨 ACİL / ÖNCELİKLİ
                              </span>
                            )}
                            {renderOrderTypeBadge(order)}
                            {renderSlaTimerBadge(order.createdAt)}
                            {renderSambaPosBadge(order)}
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
                              {order.deliveryZoneName &&
                              !order.customerAddress.includes(
                                order.deliveryZoneName
                              )
                                ? `[${order.deliveryZoneName}] `
                                : ""}
                              {order.customerAddress}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleOrderPriority(order.id)}
                            className={`text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl border transition cursor-pointer ${
                              order.isPriority
                                ? "bg-rose-600 text-white border-rose-400"
                                : "bg-slate-800 hover:bg-rose-600/30 text-slate-300 border-slate-700"
                            }`}
                            title="Siparişi Acil/VIP Olarak En Üste Sabitle"
                          >
                            {order.isPriority ? "🚨 Acil ✓" : "🚨 Acil"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleCallWaiterToKitchen(
                                order.orderType === "dine_in" && order.tableNumber
                                  ? `Masa ${order.tableNumber} (#${order.orderNumber})`
                                  : `Sipariş #${order.orderNumber}`
                              )
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 px-2.5 py-1.5 rounded-xl border border-amber-500/40 transition cursor-pointer"
                            title="Garsonu bu siparişi tezgahtan alması için çağır"
                          >
                            🔔 Garson Çağır
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrint(order, "full")}
                            className="inline-flex items-center gap-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer"
                            title="Fiyatlı Kasa Adisyonu Yazdır"
                          >
                            <Printer className="w-3.5 h-3.5 text-orange-400" />
                            Kasa Fişi
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrint(order, "kitchen_only")}
                            className="inline-flex items-center gap-1 text-xs font-bold bg-slate-800 hover:bg-orange-600/30 text-amber-300 px-2.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer"
                            title="Fiyatsız Sadece Mutfak/Izgara Üretim Fişi Yazdır"
                          >
                            🍖 Mutfak
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrint(order, "bar_only")}
                            className="inline-flex items-center gap-1 text-xs font-bold bg-slate-800 hover:bg-cyan-600/30 text-cyan-300 px-2.5 py-1.5 rounded-xl border border-slate-700 cursor-pointer"
                            title="Fiyatsız Sadece Bar (İçecek & Tatlı) Fişi Yazdır"
                          >
                            🥤 Bar
                          </button>
                        </div>
                      </div>

                      <div
                        className={`space-y-2.5 ${
                          kdsFontScale === "xlarge"
                            ? "text-lg"
                            : kdsFontScale === "large"
                            ? "text-base"
                            : "text-sm"
                        }`}
                      >
                        {(() => {
                          const doneCnt = order.items.filter(
                            (i) => i.prepared
                          ).length;
                          const totalCnt = Math.max(1, order.items.length);
                          const donePct = Math.round(
                            (doneCnt / totalCnt) * 100
                          );
                          return (
                            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-300">
                                <span>
                                  👨‍🍳 Usta Hazırlık Kontrolü (Ürüne Tıklayıp Tikleyin)
                                </span>
                                <span
                                  className={
                                    donePct === 100
                                      ? "text-emerald-400 font-black"
                                      : "text-amber-300 font-black"
                                  }
                                >
                                  🍽️ {doneCnt} / {order.items.length} Kalem Hazır (%{donePct})
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    donePct === 100
                                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                      : "bg-gradient-to-r from-amber-500 to-emerald-500"
                                  }`}
                                  style={{ width: `${donePct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                        {order.items.map((item) => {
                          const structuredBlocks = parseStructuredModifiers(
                            item.selectedModifiers
                          );
                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-xl border space-y-2 transition ${
                                item.prepared
                                  ? "bg-emerald-950/35 border-emerald-500/50"
                                  : "bg-slate-950/60 border-slate-800/80"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-slate-100 font-bold">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleItemPrepared(order.id, item.id)
                                  }
                                  className="flex items-center gap-2 text-left cursor-pointer group"
                                >
                                  <span
                                    className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black border transition ${
                                      item.prepared
                                        ? "bg-emerald-600 text-white border-emerald-400 shadow-sm"
                                        : "bg-slate-800 group-hover:bg-emerald-600/30 text-slate-200 border-slate-700"
                                    }`}
                                  >
                                    {item.prepared ? "✓ Hazırlandı" : "⬜ Hazırla"}
                                  </span>
                                  <span
                                    className={
                                      item.prepared
                                        ? "line-through text-emerald-300/80"
                                        : "text-white"
                                    }
                                  >
                                    <strong className="text-orange-400">
                                      {item.quantity}x
                                    </strong>{" "}
                                    {item.name}
                                  </span>
                                </button>
                                <span className="font-semibold">
                                  {item.totalPrice.toFixed(2)}{" "}
                                  {settings?.currency}
                                </span>
                              </div>

                              {structuredBlocks.length > 0 && (
                                <div className="space-y-1.5 pl-2">
                                  {structuredBlocks.map((block, bIdx) => (
                                    <div
                                      key={bIdx}
                                      className="rounded-lg p-2 text-xs space-y-1 bg-slate-900 border border-slate-800"
                                    >
                                      {(block.stepBadge ||
                                        block.productTitle) && (
                                        <div className="flex items-center gap-1.5">
                                          {block.stepBadge && (
                                            <span className="bg-orange-600 text-white font-black text-[10px] px-1.5 py-0.5 rounded">
                                              {block.stepBadge}
                                            </span>
                                          )}
                                          {block.productTitle && (
                                            <span className="font-bold text-orange-300">
                                              {block.productTitle}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {block.chosenDishName && (
                                        <div className="text-slate-200">
                                          <strong className="text-slate-400">
                                            Ürün:
                                          </strong>{" "}
                                          {block.chosenDishName}
                                        </div>
                                      )}
                                      {block.portionLabel && (
                                        <div className="text-indigo-300 font-bold">
                                          🍽️ Porsiyon: {block.portionLabel}
                                        </div>
                                      )}
                                      {block.extras.length > 0 && (
                                        <div className="text-emerald-300 space-y-0.5">
                                          <div className="text-[10px] font-black uppercase">
                                            ✨ Ekstralar:
                                          </div>
                                          {block.extras.map((ex, eIdx) => (
                                            <div
                                              key={eIdx}
                                              className="pl-2 text-slate-300"
                                            >
                                              + {ex.name}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {block.removals.length > 0 && (
                                        <div className="text-rose-400 font-bold">
                                          🚫 Çıkarılacak:{" "}
                                          {block.removals
                                            .map((r) => r.name)
                                            .join(", ")}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {order.orderNote && (
                          <div className="pt-2 border-t border-slate-800 space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {Array.from(
                                order.orderNote.matchAll(/\[([^\]]+)\]/g)
                              ).map((m, idx) => (
                                <span
                                  key={idx}
                                  className="text-[11px] font-extrabold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/40"
                                >
                                  {m[1]}
                                </span>
                              ))}
                            </div>
                            {order.orderNote.replace(/\[[^\]]+\]/g, "").trim() && (
                              <div className="text-xs text-amber-300 font-semibold">
                                📌 Sipariş Notu:{" "}
                                {order.orderNote.replace(/\[[^\]]+\]/g, "").trim()}
                              </div>
                            )}
                          </div>
                        )}
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
                              type="button"
                              disabled={Boolean(updatingOrderStatus[order.id])}
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
                              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md"
                            >
                              {updatingOrderStatus[order.id] === "ready"
                                ? "⏳ İşleniyor..."
                                : order.orderType === "delivery"
                                ? `🛵 Kuryeye Ver & WhatsApp Gönder`
                                : order.orderType === "dine_in"
                                ? "🍽️ Masaya Servis Edildi"
                                : "🛍️ Teslime Hazır (WhatsApp Gönder)"}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={Boolean(updatingOrderStatus[order.id])}
                            onClick={() =>
                              handleStatusChange(order.id, "completed")
                            }
                            className="bg-slate-800 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-slate-200 hover:text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
                          >
                            {updatingOrderStatus[order.id] === "completed"
                              ? "⏳..."
                              : "Tamamlandı ✓"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          </div>
        )}

        {/* CANLI MASA HARİTASI & AÇIK MASA ADİSYON TAKİBİ SEKMESİ */}
        {activeTab === "tables" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold text-white">
                    🪑 Canlı Salon Masa Haritası, Açık Adisyon & Parçalı Ödeme
                  </h2>
                  {posLiveTablesEnabled ? (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-[11px] font-black">
                      🔌 POS Modülü Canlı Masa Durumu Aktif
                    </span>
                  ) : (
                    <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                      🌐 Standart Site Masa Durumu Aktif
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {posLiveTablesEnabled
                    ? "POS modülü açık olduğu için masa durumları (Hazır / Yeni Siparişler / Adisyon İstendi) ve açık masa adisyonları doğrudan SambaPOS'tan canlı çekilmektedir."
                    : "Dolu masaların tüm siparişlerini tek adisyonda görün, açık adisyona yeni ürün ekleyin, masa taşıyın/birleştirin veya Nakit / Kart / Parçalı (Alman Usulü) hesap kapatın."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                  🟢 {posLiveTablesEnabled ? "Hazır (Boş)" : "Boş Masa"}
                </span>
                <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-3 py-1.5 rounded-xl">
                  🟠 {posLiveTablesEnabled ? "Yeni Siparişler (Dolu)" : "Dolu / Açık Adisyon"}
                </span>
                {posLiveTablesEnabled && (
                  <span className="bg-rose-950/80 text-rose-200 border border-rose-500/50 px-3 py-1.5 rounded-xl">
                    🧾 Adisyon İstendi
                  </span>
                )}
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl">
                  🟣 Garson / Hesap Çağrısı
                </span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-xl">
                  🔵 Rezerve Masa
                </span>
              </div>
            </div>

            {/* 👨‍🍳 5. CANLI SALON DOLULUK ORANI & AÇIK ADİSYON ÖZET ÇUBUĞU */}
            {(() => {
              const allTbls = getRestaurantTables(settings);
              let occCount = 0;
              let totalOpenSalon = 0;
              for (const t of allTbls) {
                const ps = getPosStateForTable(t);
                const tOrds = getEffectiveTableOrders(t);
                const occ = posLiveTablesEnabled
                  ? Boolean(ps?.isOccupied) || tOrds.length > 0
                  : tOrds.length > 0;
                if (occ) occCount++;
                totalOpenSalon += tOrds.reduce((s, o) => s + o.totalAmount, 0);
              }
              const occPct =
                allTbls.length > 0
                  ? Math.round((occCount / allTbls.length) * 100)
                  : 0;
              return (
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-extrabold text-slate-300">
                      📊 Salon Doluluk Durumu:
                    </span>
                    <span className="bg-orange-500/20 text-orange-300 border border-orange-500/40 px-2.5 py-1 rounded-lg font-black">
                      {occCount} / {allTbls.length} Masa Dolu (%{occPct})
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-black">
                      {allTbls.length - occCount} Masa Müsait
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-1 max-w-md">
                    <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500 transition-all duration-500"
                        style={{ width: `${occPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-emerald-400 whitespace-nowrap">
                      Açık Salon Toplamı: {totalOpenSalon.toFixed(2)}{" "}
                      {settings?.currency || "₺"}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {getRestaurantTables(settings).map((tableNum) => {
                const posState = getPosStateForTable(tableNum);
                const tableActiveOrders = getEffectiveTableOrders(tableNum);
                const activeCall = pendingTableCalls.find((c) =>
                  isSameTableName(c.tableNumber, tableNum)
                );
                const activeResv = reservations.find(
                  (r) =>
                    r.status === "confirmed" &&
                    isSameTableName(r.assignedTable, tableNum)
                );
                const totalTableBill = tableActiveOrders.reduce(
                  (s, o) => s + o.totalAmount,
                  0
                );
                const isOccupied = posLiveTablesEnabled
                  ? Boolean(posState?.isOccupied) || tableActiveOrders.length > 0
                  : tableActiveOrders.length > 0;
                const isBillRequested = Boolean(
                  posLiveTablesEnabled && posState?.isBillRequested
                );
                const latestTableOrderMs = tableActiveOrders.reduce(
                  (max, o) => Math.max(max, new Date(o.createdAt).getTime()),
                  0
                );
                const idleMins =
                  isOccupied && latestTableOrderMs > 0
                    ? Math.max(0, Math.floor((nowMs - latestTableOrderMs) / 60000))
                    : 0;
                const isIdleLong = isOccupied && idleMins >= 20;

                return (
                  <div
                    key={tableNum}
                    className={`rounded-2xl border-2 p-4 flex flex-col justify-between gap-3 transition ${
                      activeCall
                        ? "bg-purple-950/40 border-purple-400 shadow-lg shadow-purple-950/40 animate-pulse"
                        : isBillRequested
                        ? "bg-rose-950/40 border-rose-500 shadow-lg shadow-rose-950/30"
                        : isOccupied
                        ? "bg-slate-900 border-orange-500 shadow-lg"
                        : activeResv
                        ? "bg-blue-950/30 border-blue-500/60"
                        : "bg-slate-900/60 border-emerald-500/30 hover:border-emerald-500/60"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-black text-base px-3 py-1 rounded-xl ${
                              activeCall
                                ? "bg-purple-600 text-white"
                                : isBillRequested
                                ? "bg-rose-800 text-white"
                                : isOccupied
                                ? "bg-orange-600 text-white"
                                : activeResv
                                ? "bg-blue-600 text-white"
                                : "bg-emerald-600/20 text-emerald-300"
                            }`}
                          >
                            {formatTableLabel(tableNum).toLocaleUpperCase("tr-TR")}
                          </span>
                          {posLiveTablesEnabled && isOccupied && (
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                                isBillRequested
                                  ? "bg-rose-900/80 text-rose-200 border-rose-400/50"
                                  : "bg-orange-500/20 text-orange-300 border-orange-500/40"
                              }`}
                            >
                              {isBillRequested
                                ? "🧾 Adisyon İstendi"
                                : posState?.stateName || "Yeni Siparişler"}
                            </span>
                          )}
                        </div>
                        {isOccupied ? (
                          <span className="text-lg font-black text-emerald-400">
                            {totalTableBill.toFixed(2)} {settings?.currency}
                          </span>
                        ) : activeResv ? (
                          <span className="text-xs font-bold text-blue-300">
                            🔵 Rezerve ({activeResv.reservationTime})
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-emerald-400">
                            🟢 {posLiveTablesEnabled ? posState?.stateName || "Hazır" : "Boş"}
                          </span>
                        )}
                      </div>

                      {isIdleLong && (
                        <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold text-amber-300 flex items-center justify-between">
                          <span>☕ {idleMins} dk işlem yok</span>
                          <span className="underline">Çay / Tatlı Sor</span>
                        </div>
                      )}

                      {activeResv && !isOccupied && (
                        <div className="bg-blue-950/60 border border-blue-500/40 rounded-xl p-2 text-xs text-blue-200">
                          📅 <strong>{activeResv.customerName}</strong> (
                          {activeResv.guestCount} Kişi • Saat{" "}
                          {activeResv.reservationTime})
                        </div>
                      )}

                      {activeCall && (
                        <div className="bg-purple-900/60 border border-purple-400/50 rounded-xl p-2 text-xs font-bold text-purple-100 flex items-center justify-between">
                          <span>
                            {activeCall.type === "waiter"
                              ? "🔔 Garson Çağırıyor"
                              : activeCall.type === "bill_cash"
                              ? "💵 Nakit Hesap İstiyor"
                              : "💳 POS Hesap İstiyor"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResolveTableCall(activeCall.id)}
                            className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px]"
                          >
                            Kapat
                          </button>
                        </div>
                      )}

                      {isOccupied ? (
                        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-1 max-h-40 overflow-y-auto text-xs">
                          {tableActiveOrders.map((ord) =>
                            ord.items.map((item) => (
                              <div
                                key={`${ord.id}-${item.id}`}
                                className="flex justify-between items-center text-slate-200"
                              >
                                <span
                                  className={
                                    item.prepared ? "text-emerald-300" : ""
                                  }
                                >
                                  {item.prepared ? "✓ " : "⏳ "}
                                  <strong className="text-orange-400">
                                    {item.quantity}x
                                  </strong>{" "}
                                  {item.name}
                                  {item.isComplimentary && (
                                    <span className="ml-1 text-[10px] font-black text-amber-300">
                                      (🎁 İkram)
                                    </span>
                                  )}
                                </span>
                                <span className="text-slate-400">
                                  {item.isComplimentary
                                    ? `0 ${settings?.currency}`
                                    : `${item.totalPrice.toFixed(0)} ${settings?.currency}`}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          Bu masada açık sipariş bulunmuyor.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPosOrderType("dine_in");
                            setPosTableNumber(tableNum);
                            setPosName(formatTableLabel(tableNum));
                            setPosModalOpen(true);
                          }}
                          className="flex-1 bg-slate-800 hover:bg-orange-600 text-slate-200 hover:text-white text-xs font-extrabold py-2 px-2.5 rounded-xl transition cursor-pointer"
                        >
                          {isOccupied
                            ? "+ Açık Adisyona Ürün Ekle"
                            : "+ Yeni Adisyon Aç"}
                        </button>
                        {isOccupied && (
                          <button
                            type="button"
                            onClick={() =>
                              handlePrintCombinedTableBill(
                                tableNum,
                                tableActiveOrders
                              )
                            }
                            className="bg-slate-800 hover:bg-slate-700 text-orange-400 p-2 rounded-xl border border-slate-700 cursor-pointer"
                            title="Birleşik Masa Adisyonu Yazdır"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {isOccupied && (
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              openTableManagementModal(
                                tableNum,
                                tableActiveOrders
                              )
                            }
                            className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-[11px] font-extrabold py-2 px-2 rounded-xl transition cursor-pointer"
                          >
                            🔄 Masa Taşı / Böl
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openTableManagementModal(
                                tableNum,
                                tableActiveOrders
                              )
                            }
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold py-2 px-2 rounded-xl transition cursor-pointer shadow"
                          >
                            💳 Hesabı Kapat ({totalTableBill.toFixed(0)}{" "}
                            {settings?.currency})
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MASA DETAY, MASA TAŞIMA/BİRLEŞTİRME & PARÇALI ÖDEME (ALMAN USULÜ) MODALI */}
            {selectedTableModal &&
              (() => {
                const modalTableOrders =
                  getEffectiveTableOrders(selectedTableModal);
                const rawTableTotal = modalTableOrders.reduce(
                  (s, o) => s + o.totalAmount,
                  0
                );
                const extraDiscNum = Math.max(
                  0,
                  Number(tableExtraDiscount || 0)
                );
                const netPayable = Math.max(0, rawTableTotal - extraDiscNum);

                return (
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
                    <div className="bg-slate-900 border-2 border-orange-500/60 w-full max-w-2xl rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
                      <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-600 text-white font-black text-sm px-3 py-1 rounded-xl">
                              {formatTableLabel(selectedTableModal).toLocaleUpperCase("tr-TR")}
                            </span>
                            <h3 className="font-extrabold text-base text-white">
                              Açık Adisyon, Masa Taşıma & Tahsilat
                            </h3>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Masadaki ürünleri inceleyin, başka masaya aktarın veya Nakit / Kart / Parçalı (Alman Usulü) ödeme alın.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedTableModal(null)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* Açık Adisyon Kalemleri */}
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="text-xs font-extrabold uppercase text-orange-400">
                              📋 Masadaki Açık Sipariş Kalemleri
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const t = selectedTableModal;
                                setSelectedTableModal(null);
                                setPosOrderType("dine_in");
                                setPosTableNumber(t);
                                setPosName(formatTableLabel(t));
                                setPosModalOpen(true);
                              }}
                              className="text-xs font-extrabold bg-orange-600 hover:bg-orange-500 text-white px-3 py-1 rounded-lg cursor-pointer"
                            >
                              + Adisyona Ürün Ekle
                            </button>
                          </div>

                          {modalTableOrders.length === 0 ? (
                            <p className="text-xs text-slate-500 py-3 text-center">
                              Bu masada açık sipariş kalmadı.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-[11px] text-slate-400">
                                💡 Masadan erken kalkan kişinin ödeyeceği ürünleri işaretleyip adisyondan düşebilirsiniz:
                              </div>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {modalTableOrders.map((ord) =>
                                  ord.items.map((item) => {
                                    const compKey = `${ord.id}__${item.id}`;
                                    const isChecked =
                                      checkedModalItemKeys.includes(compKey);
                                    return (
                                      <div
                                        key={`${ord.id}-${item.id}`}
                                        onClick={() =>
                                          setCheckedModalItemKeys((prev) =>
                                            prev.includes(compKey)
                                              ? prev.filter((k) => k !== compKey)
                                              : [...prev, compKey]
                                          )
                                        }
                                        className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl border cursor-pointer transition ${
                                          isChecked
                                            ? "bg-orange-950/40 border-orange-500"
                                            : "bg-slate-900 border-slate-800 hover:border-slate-700"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {}}
                                            className="w-3.5 h-3.5 accent-orange-500"
                                          />
                                          <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                              item.prepared
                                                ? "bg-emerald-600/20 text-emerald-300"
                                                : "bg-slate-800 text-slate-400"
                                            }`}
                                          >
                                            {item.prepared
                                              ? "✓ Hazır"
                                              : "⏳ Mutfak"}
                                          </span>
                                          <span className="font-bold text-white">
                                            <strong className="text-orange-400">
                                              {item.quantity}x
                                            </strong>{" "}
                                            {item.name}
                                          </span>
                                          {item.isComplimentary && (
                                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                              🎁 İKRAM (0 ₺)
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              await fetch(
                                                `/api/orders/${ord.id}`,
                                                {
                                                  method: "PATCH",
                                                  headers: {
                                                    "Content-Type":
                                                      "application/json",
                                                    "x-kitchen-pin":
                                                      sessionStorage.getItem(
                                                        "kitchen_auth_pin"
                                                      ) || "",
                                                  },
                                                  body: JSON.stringify({
                                                    action:
                                                      "toggle_item_complimentary",
                                                    itemId: item.id,
                                                  }),
                                                }
                                              );
                                              fetchOrders();
                                            }}
                                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold border transition cursor-pointer ${
                                              item.isComplimentary
                                                ? "bg-amber-600 text-white border-amber-400"
                                                : "bg-slate-800 hover:bg-amber-600/30 text-amber-300 border-amber-500/30"
                                            }`}
                                            title="Müessese İkramı (0 ₺) Yap / Geri Al"
                                          >
                                            {item.isComplimentary
                                              ? "🎁 İkramı Geri Al"
                                              : "🎁 İkram Yap"}
                                          </button>
                                          <span
                                            className={`font-bold ${
                                              item.isComplimentary
                                                ? "line-through text-slate-500"
                                                : "text-emerald-400"
                                            }`}
                                          >
                                            {item.isComplimentary
                                              ? `0.00 ${settings?.currency}`
                                              : `${item.totalPrice.toFixed(2)} ${settings?.currency}`}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              {checkedModalItemKeys.length > 0 && (
                                <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-extrabold text-emerald-300">
                                    Seçilen ({checkedModalItemKeys.length} Kalem) Kısmi Tahsilat:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={tableActionLoading}
                                      onClick={() =>
                                        handlePartialTablePaymentModal(
                                          selectedTableModal,
                                          "cash"
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer"
                                    >
                                      💵 Seçilenleri Nakit Al & Düş
                                    </button>
                                    <button
                                      type="button"
                                      disabled={tableActionLoading}
                                      onClick={() =>
                                        handlePartialTablePaymentModal(
                                          selectedTableModal,
                                          "pos_at_table"
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-xs cursor-pointer"
                                    >
                                      💳 Seçilenleri Kartla Al & Düş
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Masa Taşıma / Birleştirme Alanı */}
                        <div className="bg-indigo-950/30 border border-indigo-500/40 rounded-2xl p-4 space-y-2.5">
                          <div className="text-xs font-extrabold text-indigo-300">
                            🔄 Masa Taşı veya Başka Masayla Birleştir
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <select
                              value={transferTargetTable}
                              onChange={(e) =>
                                setTransferTargetTable(e.target.value)
                              }
                              className="flex-1 bg-slate-900 border border-indigo-500/40 rounded-xl px-3 py-2.5 text-xs font-bold text-white"
                            >
                              {getRestaurantTables(settings)
                                .filter((n) => !isSameTableName(n, selectedTableModal))
                                .map((n) => {
                                  const targetHasOrder = orders.some(
                                    (o) =>
                                      o.orderType === "dine_in" &&
                                      isSameTableName(o.tableNumber, n) &&
                                      ["pending", "accepted", "ready"].includes(
                                        o.status
                                      )
                                  );
                                  return (
                                    <option key={n} value={n}>
                                      {formatTableLabel(n)}{" "}
                                      {targetHasOrder
                                        ? "(Dolu — Adisyonları Birleştir)"
                                        : "(Boş — Masayı Taşı)"}
                                    </option>
                                  );
                                })}
                            </select>
                            <button
                              type="button"
                              disabled={tableActionLoading}
                              onClick={() =>
                                handleTransferTable(
                                  selectedTableModal,
                                  transferTargetTable
                                )
                              }
                              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer whitespace-nowrap"
                            >
                              🔄 Masa {transferTargetTable}&apos;e Aktar / Birleştir
                            </button>
                          </div>
                        </div>

                        {/* Tahsilat & Parçalı Ödeme (Alman Usulü) Alanı */}
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold uppercase text-emerald-400">
                              💳 Tahsilat Yöntemi & Parçalı Hesap (Alman Usulü)
                            </span>
                            <span className="text-sm font-black text-white">
                              Adisyon: {rawTableTotal.toFixed(2)}{" "}
                              {settings?.currency}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button
                              type="button"
                              onClick={() => setTablePaymentMode("cash")}
                              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                                tablePaymentMode === "cash"
                                  ? "bg-emerald-600 border-emerald-400 text-white"
                                  : "bg-slate-900 border-slate-800 text-slate-300"
                              }`}
                            >
                              💵 Tamamı Nakit
                            </button>
                            <button
                              type="button"
                              onClick={() => setTablePaymentMode("card")}
                              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                                tablePaymentMode === "card"
                                  ? "bg-blue-600 border-blue-400 text-white"
                                  : "bg-slate-900 border-slate-800 text-slate-300"
                              }`}
                            >
                              💳 Tamamı Kart
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTablePaymentMode("split");
                                const half = Math.round(netPayable / 2);
                                setSplitCashAmount(String(half));
                                setSplitCardAmount(
                                  String(Math.max(0, netPayable - half))
                                );
                              }}
                              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                                tablePaymentMode === "split"
                                  ? "bg-purple-600 border-purple-400 text-white"
                                  : "bg-slate-900 border-slate-800 text-slate-300"
                              }`}
                            >
                              ⚖️ Parçalı Hesap
                            </button>
                            <button
                              type="button"
                              onClick={() => setTablePaymentMode("credit")}
                              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                                tablePaymentMode === "credit"
                                  ? "bg-amber-600 border-amber-400 text-white"
                                  : "bg-slate-900 border-slate-800 text-slate-300"
                              }`}
                            >
                              🧾 Cari / Veresiye
                            </button>
                          </div>

                          {/* Cariye / Veresiyeye Yaz Detay Kutusu */}
                          {tablePaymentMode === "credit" && (
                            <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 space-y-2.5">
                              <div className="text-xs font-extrabold text-amber-300">
                                🧾 Cari / Veresiye Defterine Yazılacak Müşteri:
                              </div>
                              <input
                                type="text"
                                value={tableCreditSearch}
                                onChange={(e) =>
                                  setTableCreditSearch(e.target.value)
                                }
                                placeholder="🔍 Çok müşteri içinden isim veya telefon ile ara..."
                                className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs font-bold text-white"
                              />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <select
                                  value={tableCreditAccountId}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setTableCreditAccountId(val);
                                    if (val.startsWith("reg::")) {
                                      const [rName] = val.slice(5).split("::");
                                      if (rName) setTableCreditCustomerName(rName);
                                    } else {
                                      const found = (
                                        settings?.creditAccounts || []
                                      ).find((a) => a.id === val);
                                      if (found) {
                                        setTableCreditCustomerName(
                                          found.customerName
                                        );
                                      }
                                    }
                                  }}
                                  className="bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                >
                                  <option value="">
                                    + Yeni Müşteri Yaz veya Kayıtlı Seç...
                                  </option>
                                  <optgroup label="🧾 Açık Cari / Veresiye Hesapları">
                                    {(settings?.creditAccounts || [])
                                      .filter((acc) => {
                                        const q = tableCreditSearch
                                          .trim()
                                          .toLocaleLowerCase("tr-TR");
                                        if (!q) return true;
                                        return (
                                          acc.customerName
                                            .toLocaleLowerCase("tr-TR")
                                            .includes(q) ||
                                          (acc.customerPhone || "")
                                            .toLocaleLowerCase("tr-TR")
                                            .includes(q)
                                        );
                                      })
                                      .map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                          {acc.customerName} (Bakiye:{" "}
                                          {acc.balance.toFixed(0)}{" "}
                                          {settings?.currency})
                                        </option>
                                      ))}
                                  </optgroup>
                                  <optgroup label="👤 Sitedeki Kayıtlı Müşteriler">
                                    {registeredCustomers
                                      .filter((rc) => {
                                        const q = tableCreditSearch
                                          .trim()
                                          .toLocaleLowerCase("tr-TR");
                                        if (!q) return true;
                                        return (
                                          rc.name
                                            .toLocaleLowerCase("tr-TR")
                                            .includes(q) ||
                                          (rc.phone || "")
                                            .toLocaleLowerCase("tr-TR")
                                            .includes(q)
                                        );
                                      })
                                      .slice(0, 50)
                                      .map((rc) => (
                                        <option
                                          key={`reg-${rc.id}`}
                                          value={`reg::${rc.name}::${rc.phone || ""}`}
                                        >
                                          👤 {rc.name}{" "}
                                          {rc.phone ? `(${rc.phone})` : ""}
                                        </option>
                                      ))}
                                  </optgroup>
                                </select>
                                <input
                                  type="text"
                                  value={tableCreditCustomerName}
                                  onChange={(e) =>
                                    setTableCreditCustomerName(e.target.value)
                                  }
                                  placeholder="Müşteri / Firma Adı Soyadı..."
                                  className="bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-white"
                                />
                              </div>
                            </div>
                          )}

                          {/* Masa İskontosu */}
                          <div className="flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                            <span className="text-xs font-bold text-slate-300">
                              🏷️ Masa İndirimi / İkram İskontosu ({settings?.currency}):
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={tableExtraDiscount}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTableExtraDiscount(val);
                                const nextNet = Math.max(
                                  0,
                                  rawTableTotal - Number(val || 0)
                                );
                                if (tablePaymentMode === "split") {
                                  const half = Math.round(nextNet / 2);
                                  setSplitCashAmount(String(half));
                                  setSplitCardAmount(
                                    String(Math.max(0, nextNet - half))
                                  );
                                }
                              }}
                              className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-black text-emerald-400 text-right"
                            />
                          </div>

                          {/* Parçalı Ödeme (Alman Usulü) Detay Kutusu */}
                          {tablePaymentMode === "split" && (
                            <div className="bg-purple-950/30 border border-purple-500/40 rounded-xl p-3.5 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-purple-200">
                                  ⚖️ Kişi Sayısına Göre Hızlı Böl:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {[2, 3, 4, 5].map((people) => (
                                    <button
                                      key={people}
                                      type="button"
                                      onClick={() => {
                                        const perPerson = Math.round(
                                          netPayable / people
                                        );
                                        setSplitCashAmount(String(perPerson));
                                        setSplitCardAmount(
                                          String(
                                            Math.max(0, netPayable - perPerson)
                                          )
                                        );
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-purple-900/70 hover:bg-purple-600 text-purple-100 text-[11px] font-bold border border-purple-500/40 cursor-pointer"
                                    >
                                      {people} Kişi ({Math.round(netPayable / people)}{" "}
                                      {settings?.currency}/kişi)
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-emerald-300 mb-1">
                                    💵 Nakit Tahsil Edilen ({settings?.currency})
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={splitCashAmount}
                                    onChange={(e) => {
                                      const cVal = Math.max(
                                        0,
                                        Number(e.target.value || 0)
                                      );
                                      setSplitCashAmount(e.target.value);
                                      setSplitCardAmount(
                                        String(
                                          Math.max(
                                            0,
                                            Number(
                                              (netPayable - cVal).toFixed(2)
                                            )
                                          )
                                        )
                                      );
                                    }}
                                    className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-sm font-black text-emerald-400"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-blue-300 mb-1">
                                    💳 POS / Karttan Çekilen ({settings?.currency})
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={splitCardAmount}
                                    onChange={(e) => {
                                      const kVal = Math.max(
                                        0,
                                        Number(e.target.value || 0)
                                      );
                                      setSplitCardAmount(e.target.value);
                                      setSplitCashAmount(
                                        String(
                                          Math.max(
                                            0,
                                            Number(
                                              (netPayable - kVal).toFixed(2)
                                            )
                                          )
                                        )
                                      );
                                    }}
                                    className="w-full bg-slate-900 border border-blue-500/40 rounded-xl px-3 py-2 text-sm font-black text-blue-400"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                            <span className="text-sm font-extrabold text-slate-300">
                              NET TAHSİL EDİLECEK TUTAR:
                            </span>
                            <span className="text-xl font-black text-emerald-400">
                              {netPayable.toFixed(2)} {settings?.currency}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            <button
                              type="button"
                              disabled={
                                tableActionLoading ||
                                modalTableOrders.length === 0
                              }
                              onClick={() =>
                                handleCloseTableWithPaymentModal(
                                  selectedTableModal,
                                  modalTableOrders,
                                  false
                                )
                              }
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl transition cursor-pointer shadow-lg"
                            >
                              ✅ Tahsilatı Tamamla & Masayı Kapat
                            </button>
                            <button
                              type="button"
                              disabled={
                                tableActionLoading ||
                                modalTableOrders.length === 0
                              }
                              onClick={() =>
                                handleCloseTableWithPaymentModal(
                                  selectedTableModal,
                                  modalTableOrders,
                                  true
                                )
                              }
                              className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-extrabold text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg"
                            >
                              <Printer className="w-4 h-4" />
                              Birleşik Fiş Yazdır + Masayı Kapat
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        )}

        {/* HIZLI STOK & TÜKENDİ YÖNETİM SEKMESİ */}
        {activeTab === "stock" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  🍲 Mutfak Hızlı Stok, Günlük Porsiyon Sayacı & &ldquo;Tükendi&rdquo; Kontrolü
                </h2>
                <p className="text-xs text-slate-400">
                  Biten bir yemeği tek dokunuşla &ldquo;Tükendi&rdquo; olarak işaretleyin veya günlük kalan porsiyon adedini güncelleyin; müşteri ekranında anında senkronize olur.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch("/api/menu", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "reset_daily_stocks" }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      if (data.items) setMenuItems(data.items);
                      fetchOrders();
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-3.5 py-2 rounded-xl transition cursor-pointer shadow"
                >
                  🔄 Sabah Stoklarını Yenile (Tükenenleri Aç)
                </button>
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
                    className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition ${
                      item.available
                        ? "bg-slate-900 border-slate-800"
                        : "bg-rose-950/30 border-rose-500/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
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
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap ${
                          item.dailyStock === null ||
                          item.dailyStock === undefined
                            ? "bg-slate-800 text-slate-400"
                            : item.dailyStock <= 5
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {item.dailyStock === null ||
                        item.dailyStock === undefined
                          ? "♾️ Sınırsız"
                          : `📦 Kalan: ${item.dailyStock} Porsiyon`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={async () => {
                          const nextStock = Number(item.dailyStock || 0) + 10;
                          const updated: MenuItem = {
                            ...item,
                            dailyStock: nextStock,
                            available: true,
                          };
                          setMenuItems((prev) =>
                            prev.map((m) => (m.id === item.id ? updated : m))
                          );
                          await fetch("/api/menu", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ item: updated }),
                          });
                          fetchOrders();
                        }}
                        className="px-3 py-2 rounded-xl text-[11px] font-extrabold bg-slate-800 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-slate-700 transition cursor-pointer"
                      >
                        +10 Porsiyon
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStock(item)}
                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                          item.available
                            ? "bg-emerald-600 hover:bg-rose-600 text-white"
                            : "bg-rose-600 hover:bg-emerald-600 text-white"
                        }`}
                      >
                        {item.available
                          ? "🟢 Stokta (Kapat)"
                          : "🔴 TÜKENDİ (Aç)"}
                      </button>
                    </div>
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
                              {getRestaurantTables(settings).map((t) => {
                                const lbl = formatTableLabel(t);
                                return (
                                  <option key={t} value={lbl}>
                                    {lbl}
                                  </option>
                                );
                              })}
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
                      onClick={() => handlePrint(order, "full")}
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

        {/* 🛵 CANLI KURYE GPS HARİTA TAKİP PANELİ */}
        {activeTab === "couriers_map" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-base text-cyan-300 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-cyan-400" />
                  <span>🛵 Canlı Kurye GPS Haritası & Paket Dağıtım Takibi</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kuryeler mobil ekranlarından (`/courier`) &ldquo;📍 GPS Açık&rdquo;
                  yaptığında anlık konumları, hızları ve üzerlerindeki paketler burada
                  canlı güncellenir.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSimulateCourierGps}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold px-3.5 py-2.5 rounded-xl transition shadow cursor-pointer"
                >
                  📍 Test: Kurye GPS Konumu Simüle Et
                </button>
                <Link
                  href="/courier"
                  target="_blank"
                  className="bg-slate-800 hover:bg-slate-700 text-orange-300 border border-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl transition"
                >
                  🛵 Kurye Mobil Ekranını Aç ↗
                </Link>
              </div>
            </div>

            {courierLocations.length === 0 ? (
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
                <MapPin className="w-10 h-10 text-cyan-400 mx-auto opacity-60" />
                <div className="font-bold text-slate-200 text-base">
                  Şu an aktif GPS konumu paylaşan kurye görünmüyor
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Kuryeler telefonlarından <strong>/courier</strong> sayfasına girip
                  sağ üstteki <strong>&ldquo;📍 GPS Açık&rdquo;</strong> butonuna
                  dokunduğunda veya yukarıdaki simülasyon butonuna tıkladığınızda
                  harita anında açılır.
                </p>
                <button
                  type="button"
                  onClick={handleSimulateCourierGps}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition shadow cursor-pointer"
                >
                  📍 Örnek Kurye GPS Konumlarını Başlat
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Sol: Canlı OpenStreetMap Harita Görünümü */}
                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                  {(() => {
                    const primary = courierLocations[0];
                    const lat = primary.lat;
                    const lng = primary.lng;
                    const delta = 0.012;
                    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
                    return (
                      <>
                        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                          <span className="font-bold text-cyan-300">
                            🗺️ Odaklanan Kurye: {primary.courierName} (
                            {lat.toFixed(5)}, {lng.toFixed(5)})
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-orange-400 hover:underline font-bold"
                          >
                            Google Haritalar&apos;da Aç ↗
                          </a>
                        </div>
                        <iframe
                          title="Canlı Kurye GPS Haritası"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
                            bbox
                          )}&layer=mapnik&marker=${lat},${lng}`}
                          className="w-full h-[420px] border-0"
                        />
                      </>
                    );
                  })()}
                </div>

                {/* Sağ: Kurye Kartları & Üzerlerindeki Paketler */}
                <div className="lg:col-span-5 space-y-3">
                  {courierLocations.map((cLoc) => {
                    const secsAgo = Math.max(
                      0,
                      Math.floor(
                        (nowMs - new Date(cLoc.updatedAt).getTime()) / 1000
                      )
                    );
                    return (
                      <div
                        key={cLoc.courierName}
                        className="bg-slate-900 border-2 border-cyan-500/40 rounded-2xl p-4 space-y-3 shadow-lg"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                              <span className="font-black text-base text-white">
                                🛵 {cLoc.courierName}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Son Sinyal:{" "}
                              {secsAgo < 60
                                ? `${secsAgo} sn önce`
                                : `${Math.floor(secsAgo / 60)} dk önce`}{" "}
                              • Koordinat: {cLoc.lat.toFixed(4)},{" "}
                              {cLoc.lng.toFixed(4)}
                            </div>
                          </div>
                          <div className="text-right">
                            {typeof cLoc.speedKmh === "number" && (
                              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-black px-2.5 py-1 rounded-xl">
                                🚀 {cLoc.speedKmh} km/s
                              </span>
                            )}
                          </div>
                        </div>

                        {cLoc.assignedOrders && cLoc.assignedOrders.length > 0 ? (
                          <div className="space-y-1.5 pt-2 border-t border-slate-800">
                            <div className="text-[11px] font-black uppercase text-orange-300">
                              📦 Üzerindeki Aktif Paketler (
                              {cLoc.assignedOrders.length})
                            </div>
                            {cLoc.assignedOrders.map((ord) => (
                              <div
                                key={ord.id}
                                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs flex items-center justify-between gap-2"
                              >
                                <div>
                                  <div className="font-bold text-white">
                                    #{ord.orderNumber} — {ord.customerName}
                                  </div>
                                  {ord.customerAddress && (
                                    <div className="text-[11px] text-slate-400">
                                      📍 {ord.customerAddress}
                                    </div>
                                  )}
                                </div>
                                <span className="font-black text-emerald-400 shrink-0">
                                  {ord.totalAmount.toFixed(0)} {settings?.currency}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-500/30 rounded-xl px-3 py-2">
                            ✓ Kurye şu an müsait / dönüş yolunda (Üzerinde açık
                            paket yok)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* KASA POS / TELEFON SİPARİŞİ MODALI */}
      {posModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">
                    Kasa POS & Telefon Siparişi Giriş Ekranı
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Telefon numarasını yazdığınızda kayıtlı müşteri adı ve adresi otomatik doldurulur
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPosModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Sol: Hızlı Ürün Seçim Grid */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setPosCategory("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                      posCategory === "all"
                        ? "bg-orange-600 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    Tümü ({menuItems.filter((m) => m.available).length})
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setPosCategory(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                        posCategory === c.id
                          ? "bg-orange-600 text-white"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                {posCustomizingItem ? (
                  <div className="bg-slate-950 border border-orange-500/60 rounded-2xl p-4 space-y-3 max-h-[55vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div>
                        <div className="text-xs font-extrabold text-orange-400">
                          Porsiyon & Ekstra Seçimi
                        </div>
                        <h4 className="font-bold text-sm text-white">
                          {posCustomizingItem.name}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPosCustomizingItem(null)}
                        className="text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800"
                      >
                        ← Ürünlere Dön
                      </button>
                    </div>

                    {(posCustomizingItem.modifierGroups || []).map((group) => {
                      const subHeader = extractSubProductHeader(
                        group.productTag || group.name
                      );
                      return (
                        <div
                          key={group.id}
                          className={`bg-slate-900 p-3 rounded-xl border space-y-2 ${
                            subHeader.stepBadge
                              ? "border-orange-500/60"
                              : "border-slate-800"
                          }`}
                        >
                          {subHeader.stepBadge ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-orange-500/30">
                              <div className="flex items-center gap-1.5">
                                <span className="bg-orange-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-md">
                                  📦 {subHeader.stepBadge}
                                </span>
                                <span className="text-xs font-extrabold text-orange-300">
                                  {subHeader.cleanTitle || group.name}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                🍽️ Porsiyon & Ekstra Seçimi
                              </span>
                            </div>
                          ) : (
                            <div className="text-xs font-bold text-slate-200">
                              {group.name}
                            </div>
                          )}
                          <div className="space-y-1.5">
                            {group.options.map((opt) => {
                              const isChecked = (
                                posChosenModifiers[group.id] || []
                              ).includes(opt.id);
                              const subKey = `${group.id}__${opt.id}`;
                              const chosenSubIds =
                                posChosenSubOptions[subKey] || [];
                              const parsedOpt = splitOptionNameAndPortion(
                                opt.name
                              );
                              return (
                                <div key={opt.id} className="space-y-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPosChosenModifiers((prev) => {
                                        const cur = prev[group.id] || [];
                                        if (!group.multiSelect) {
                                          return {
                                            ...prev,
                                            [group.id]: [opt.id],
                                          };
                                        }
                                        return {
                                          ...prev,
                                          [group.id]: cur.includes(opt.id)
                                            ? cur.filter((x) => x !== opt.id)
                                            : [...cur, opt.id],
                                        };
                                      });
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                                      isChecked
                                        ? "bg-orange-600/20 border-orange-500 text-white"
                                        : "bg-slate-950 border-slate-800 text-slate-300"
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center gap-1.5 text-left">
                                      <span>
                                        {isChecked ? "✓ " : ""}
                                        {parsedOpt.dishName ||
                                          parsedOpt.portionLabel ||
                                          opt.name}
                                      </span>
                                      {parsedOpt.dishName &&
                                        parsedOpt.portionLabel && (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                            🍽️ Porsiyon:{" "}
                                            {parsedOpt.portionLabel}
                                          </span>
                                        )}
                                    </div>
                                    <span>
                                      {opt.price > 0
                                        ? `+${opt.price} ${settings?.currency}`
                                        : "Dahil"}
                                    </span>
                                  </button>

                                  {isChecked &&
                                    opt.subOptions &&
                                    opt.subOptions.length > 0 && (
                                      <div className="ml-3 pl-2.5 py-2 pr-2 rounded-lg bg-emerald-950/30 border-l-4 border-emerald-500 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white">
                                            ✨ EKSTRALAR (
                                            {parsedOpt.portionLabel ||
                                              parsedOpt.dishName ||
                                              opt.name}
                                            )
                                          </span>
                                          <span className="text-[10px] font-bold text-emerald-300">
                                            İsteğe Bağlı
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {opt.subOptions.map((subOpt) => {
                                            const subChecked =
                                              chosenSubIds.includes(subOpt.id);
                                            return (
                                              <button
                                                key={subOpt.id}
                                                type="button"
                                                onClick={() => {
                                                  setPosChosenSubOptions(
                                                    (prev) => {
                                                      const cur =
                                                        prev[subKey] || [];
                                                      return {
                                                        ...prev,
                                                        [subKey]: cur.includes(
                                                          subOpt.id
                                                        )
                                                          ? cur.filter(
                                                              (x) =>
                                                                x !== subOpt.id
                                                            )
                                                          : [...cur, subOpt.id],
                                                      };
                                                    }
                                                  );
                                                }}
                                                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                                                  subChecked
                                                    ? "bg-emerald-600 text-white border-emerald-400"
                                                    : "bg-slate-950 text-slate-300 border-slate-700"
                                                }`}
                                              >
                                                {subChecked
                                                  ? "✓ EKSTRA: "
                                                  : "+ EKSTRA: "}
                                                {subOpt.name}
                                                {subOpt.price > 0
                                                  ? ` (+${subOpt.price} ${settings?.currency})`
                                                  : " (Ücretsiz)"}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleConfirmPosCustomizedItem}
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs py-3 rounded-xl transition cursor-pointer"
                    >
                      ✓ Seçilen Porsiyon & Ekstralarla Adisyona Ekle
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
                    {menuItems
                      .filter(
                        (m) =>
                          m.available &&
                          (posCategory === "all" || m.categoryId === posCategory)
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handlePosAddItem(item)}
                          className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-orange-500 rounded-2xl p-3 text-left flex flex-col justify-between gap-2 transition cursor-pointer"
                        >
                          <div className="font-bold text-xs text-white line-clamp-2">
                            {item.name}
                          </div>
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-black text-orange-400">
                              {item.price.toFixed(0)} {settings?.currency}
                            </span>
                            <span className="bg-orange-600/20 text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                              + Seç/Ekle
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Sağ: Müşteri Bilgileri & Adisyon Sepeti */}
              <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  {/* Sipariş Tipi */}
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPosOrderType("delivery")}
                      className={`py-2 rounded-lg text-xs font-bold ${
                        posOrderType === "delivery"
                          ? "bg-orange-600 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      🛵 Paket
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosOrderType("dine_in")}
                      className={`py-2 rounded-lg text-xs font-bold ${
                        posOrderType === "dine_in"
                          ? "bg-purple-600 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      🪑 Masada
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosOrderType("pickup")}
                      className={`py-2 rounded-lg text-xs font-bold ${
                        posOrderType === "pickup"
                          ? "bg-blue-600 text-white"
                          : "text-slate-400"
                      }`}
                    >
                      🛍️ Gel-Al
                    </button>
                  </div>

                  {posOrderType === "dine_in" ? (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Masa Seçin
                        </label>
                        <select
                          value={posTableNumber}
                          onChange={(e) => setPosTableNumber(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                        >
                          {getRestaurantTables(settings).map((n) => (
                            <option key={n} value={n}>
                              {formatTableLabel(n)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          👥 Masadaki Kişi Sayısı (Kuver)
                        </label>
                        <div className="grid grid-cols-6 gap-1.5">
                          {[1, 2, 3, 4, 5, 6].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => setPosGuestCount(cnt)}
                              className={`py-1.5 rounded-lg text-xs font-black border transition cursor-pointer ${
                                posGuestCount === cnt
                                  ? "bg-purple-600 border-purple-400 text-white"
                                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                              }`}
                            >
                              {cnt === 6 ? "6+" : `${cnt} Kişi`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Müşteri Telefonu (Yazınca Ad/Adres Otomatik Gelir)
                        </label>
                        <input
                          type="tel"
                          placeholder="0532..."
                          value={posPhone}
                          onChange={(e) => handlePosPhoneLookup(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                        />
                        {posCustomerInfo && (
                          <div className="mt-1 text-[11px] text-emerald-400 font-bold">
                            ✓ Kayıtlı Müşteri ({posCustomerInfo.orderCount} geçmiş
                            sipariş • {posCustomerInfo.loyaltyPoints} ₺ Para Puan)
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Müşteri Adı Soyadı
                        </label>
                        <input
                          type="text"
                          placeholder="Ad Soyad"
                          value={posName}
                          onChange={(e) => setPosName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      {posOrderType === "delivery" && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-400 mb-1">
                            Teslimat Adresi
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Mahalle, Sokak, Bina, Daire..."
                            value={posAddress}
                            onChange={(e) => setPosAddress(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Ödeme Yöntemi
                        </label>
                        <select
                          value={posPaymentMethod}
                          onChange={(e) =>
                            setPosPaymentMethod(e.target.value as PaymentMethod)
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                        >
                          <option value="cash">Nakit</option>
                          <option value="card_at_door">
                            Kredi Kartı (POS)
                          </option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Adisyon Sepet Kalemleri */}
                  <div className="border-t border-slate-800 pt-2 space-y-1.5 max-h-44 overflow-y-auto">
                    {posCart.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">
                        Soldaki ürünlere tıklayarak adisyona ekleyin.
                      </p>
                    ) : (
                      posCart.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-xl text-xs"
                        >
                          <span className="font-bold text-white truncate max-w-[160px]">
                            {c.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setPosCart((prev) =>
                                  prev
                                    .map((item) =>
                                      item.id === c.id
                                        ? {
                                            ...item,
                                            quantity: item.quantity - 1,
                                            totalPrice:
                                              (item.quantity - 1) *
                                              item.unitPrice,
                                          }
                                        : item
                                    )
                                    .filter((item) => item.quantity > 0)
                                )
                              }
                              className="p-1 bg-slate-800 rounded text-slate-300"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-black text-orange-400 w-5 text-center">
                              {c.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPosCart((prev) =>
                                  prev.map((item) =>
                                    item.id === c.id
                                      ? {
                                          ...item,
                                          quantity: item.quantity + 1,
                                          totalPrice:
                                            (item.quantity + 1) *
                                            item.unitPrice,
                                        }
                                      : item
                                  )
                                )
                              }
                              className="p-1 bg-slate-800 rounded text-slate-300"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="font-bold text-emerald-400 w-14 text-right">
                              {c.totalPrice.toFixed(0)} {settings?.currency}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPosCart((prev) =>
                                  prev.filter((item) => item.id !== c.id)
                                )
                              }
                              className="text-slate-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Sipariş Notu (Opsiyonel)"
                    value={posNote}
                    onChange={(e) => setPosNote(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <div className="flex items-center justify-between font-black text-base text-white">
                    <span>TOPLAM:</span>
                    <span className="text-emerald-400">
                      {posCart
                        .reduce((s, i) => s + i.totalPrice, 0)
                        .toFixed(2)}{" "}
                      {settings?.currency}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={posSubmitting || posCart.length === 0}
                      onClick={() => handlePosSubmitOrder(false)}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs py-3 rounded-xl transition cursor-pointer"
                    >
                      ✅ Siparişi Kaydet
                    </button>
                    <button
                      type="button"
                      disabled={posSubmitting || posCart.length === 0}
                      onClick={() => handlePosSubmitOrder(true)}
                      className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-extrabold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      Kaydet + Fiş Yazdır
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 80mm Termal Yazıcı Fiş Şablonu (Kasa / Mutfak / Bar İstasyon Modu Destekli) */}
      {selectedOrderForPrint && (
        <div
          id="printable-receipt"
          className="hidden print:block text-xs font-mono leading-snug"
        >
          <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
            <h2 className="font-bold text-base uppercase">{settings?.name}</h2>
            {printTicketMode === "full" ? (
              <>
                <p className="text-[11px]">{settings?.address}</p>
                <p className="text-[11px]">Tel: {settings?.phone}</p>
              </>
            ) : (
              <div className="mt-1 py-1 bg-black text-white font-black text-sm uppercase">
                {printTicketMode === "kitchen_only"
                  ? "🍖 MUTFAK / IZGARA ÜRETİM FİŞİ"
                  : "🥤 BAR / İÇECEK & TATLI FİŞİ"}
              </div>
            )}
            <div className="mt-1.5 py-1 border border-black font-black text-sm">
              SİPARİŞ NO: #{selectedOrderForPrint.orderNumber}
            </div>
            <p className="mt-1 font-bold text-xs">
              {selectedOrderForPrint.orderType === "dine_in"
                ? `🍽️ MASA SİPARİŞİ — MASA ${selectedOrderForPrint.tableNumber}${
                    selectedOrderForPrint.guestCount
                      ? ` (${selectedOrderForPrint.guestCount} KİŞİ / KUVER)`
                      : ""
                  }`
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
            {printTicketMode === "full" && (
              <>
                {(() => {
                  const digits = (
                    selectedOrderForPrint.customerPhone || ""
                  ).replace(/\D/g, "");
                  if (digits.length < 10) return null;
                  const st = customerStatsByPhone.get(digits.slice(-10));
                  if (!st) return null;
                  return (
                    <p className="font-bold">
                      <strong>Müşteri Notu:</strong>{" "}
                      {st.orderCount === 1
                        ? "🌟 İLK SİPARİŞİ (Hoş Geldiniz!)"
                        : st.orderCount >= 5
                        ? `👑 VIP MÜŞTERİ (${st.orderCount}. Siparişi)`
                        : `🔄 ${st.orderCount}. Siparişi`}
                    </p>
                  );
                })()}
                <p>
                  <strong>Telefon:</strong>{" "}
                  {selectedOrderForPrint.customerPhone}
                </p>
                {selectedOrderForPrint.deliveryZoneName && (
                  <p>
                    <strong>Bölge:</strong>{" "}
                    {selectedOrderForPrint.deliveryZoneName}
                  </p>
                )}
                {selectedOrderForPrint.customerAddress && (
                  <p>
                    <strong>Adres:</strong>{" "}
                    {selectedOrderForPrint.customerAddress}
                  </p>
                )}
                {selectedOrderForPrint.courierName && (
                  <p>
                    <strong>Kurye:</strong> {selectedOrderForPrint.courierName}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="border-t-2 border-b-2 border-dashed border-black py-2 space-y-1.5">
            {(() => {
              const filteredItems =
                printTicketMode === "kitchen_only"
                  ? selectedOrderForPrint.items.filter((i) => !isBarItem(i))
                  : printTicketMode === "bar_only"
                  ? selectedOrderForPrint.items.filter((i) => isBarItem(i))
                  : selectedOrderForPrint.items;
              const itemsToRender =
                filteredItems.length > 0
                  ? filteredItems
                  : selectedOrderForPrint.items;

              return itemsToRender.map((item) => {
                const structuredBlocks = parseStructuredModifiers(
                  item.selectedModifiers
                );
                return (
                  <div key={item.id} className="space-y-0.5">
                    <div
                      className={`flex justify-between font-bold ${
                        printTicketMode !== "full" ? "text-sm font-black" : ""
                      }`}
                    >
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      {printTicketMode === "full" && (
                        <span>
                          {item.totalPrice.toFixed(2)} {settings?.currency}
                        </span>
                      )}
                    </div>
                    {structuredBlocks.map((block, bIdx) => (
                      <div
                        key={bIdx}
                        className="pl-2 text-[11px] border-l border-black ml-1 space-y-0.5"
                      >
                        {(block.stepBadge || block.productTitle) && (
                          <div className="font-bold">
                            {block.stepBadge ? `[${block.stepBadge}] ` : ""}
                            {block.productTitle || ""}
                          </div>
                        )}
                        {block.chosenDishName && (
                          <div className="pl-1 font-bold">
                            • Ürün: {block.chosenDishName}
                          </div>
                        )}
                        {block.portionLabel && (
                          <div className="pl-1">
                            • Porsiyon: {block.portionLabel}
                          </div>
                        )}
                        {block.extras.length > 0 && (
                          <div className="pl-1">
                            + Ekstra:{" "}
                            {block.extras.map((e) => e.name).join(", ")}
                          </div>
                        )}
                        {block.removals.length > 0 && (
                          <div className="pl-1 font-bold">
                            - Çıkarılacak:{" "}
                            {block.removals.map((r) => r.name).join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                    {item.itemNote && (
                      <div className="pl-2 text-[11px] font-bold">
                        * Not: {item.itemNote}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {selectedOrderForPrint.orderNote && (
            <div className="border-b border-dashed border-black py-1.5 text-[11px] font-bold">
              📌 SİPARİŞ NOTU: {selectedOrderForPrint.orderNote}
            </div>
          )}

          {printTicketMode === "full" ? (
            <>
              <div className="pt-1.5 space-y-0.5 text-[11px]">
                <div className="flex justify-between">
                  <span>ARA TOPLAM:</span>
                  <span>
                    {selectedOrderForPrint.subtotal.toFixed(2)}{" "}
                    {settings?.currency}
                  </span>
                </div>
                {selectedOrderForPrint.discountAmount &&
                selectedOrderForPrint.discountAmount > 0 ? (
                  <div className="flex justify-between font-bold">
                    <span>
                      İNDİRİM ({selectedOrderForPrint.couponCode || "Kampanya"}
                      ):
                    </span>
                    <span>
                      -{selectedOrderForPrint.discountAmount.toFixed(2)}{" "}
                      {settings?.currency}
                    </span>
                  </div>
                ) : selectedOrderForPrint.discountAmount &&
                  selectedOrderForPrint.discountAmount < 0 ? (
                  <div className="flex justify-between font-bold">
                    <span>
                      FİYAT FARKI (
                      {selectedOrderForPrint.couponCode || "Happy Hour"}):
                    </span>
                    <span>
                      +
                      {Math.abs(selectedOrderForPrint.discountAmount).toFixed(
                        2
                      )}{" "}
                      {settings?.currency}
                    </span>
                  </div>
                ) : null}
                {(selectedOrderForPrint.loyaltyPointsUsed || 0) > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>🎁 PARA PUAN İNDİRİMİ:</span>
                    <span>
                      -
                      {Number(
                        selectedOrderForPrint.loyaltyPointsUsed
                      ).toFixed(2)}{" "}
                      {settings?.currency}
                    </span>
                  </div>
                )}
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

              {selectedOrderForPrint.orderType === "delivery" &&
                selectedOrderForPrint.customerAddress && (
                  <div className="mt-2 pt-2 border-b border-dashed border-black pb-2 text-center space-y-1">
                    <p className="text-[10px] font-black uppercase">
                      🛵 KURYE YOL TARİFİ QR (GOOGLE HARİTALAR)
                    </p>
                    {(() => {
                      const rawAddr = selectedOrderForPrint.customerAddress;
                      const gpsMatch = rawAddr.match(
                        /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/
                      );
                      const queryTarget = gpsMatch
                        ? `${gpsMatch[1]},${gpsMatch[2]}`
                        : `${rawAddr} ${
                            selectedOrderForPrint.deliveryZoneName || ""
                          }`.trim();
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        queryTarget
                      )}`;
                      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&margin=2&data=${encodeURIComponent(
                        mapsUrl
                      )}`;
                      return (
                        <div className="flex flex-col items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qrSrc}
                            alt="Kurye Harita QR"
                            className="w-24 h-24 mx-auto border border-black p-0.5 bg-white"
                          />
                          <span className="text-[9px] leading-tight mt-0.5">
                            Telefon kamerasıyla okutarak navigasyonu başlatın
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

              <div className="text-center pt-2 text-[10px]">
                <p className="font-bold">Afiyet Olsun! Teşekkür Ederiz.</p>
              </div>
            </>
          ) : (
            <div className="text-center pt-2 text-[11px] font-bold">
              *** İSTASYON ÜRETİM FİŞİ (FİYATSIZ) ***
            </div>
          )}
        </div>
      )}
    </div>
  );

  function renderSlaTimerBadge(createdAt: string) {
    const mins = Math.max(
      0,
      Math.floor((nowMs - new Date(createdAt).getTime()) / 60000)
    );
    if (mins >= 25) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-black bg-red-600 text-white px-2.5 py-0.5 rounded-full animate-pulse">
          🚨 {mins} dk (GECİKTİ!)
        </span>
      );
    }
    if (mins >= 15) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-amber-500/25 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
          ⏳ {mins} dk
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
        ⏱️ {mins} dk
      </span>
    );
  }

  function renderOrderTypeBadge(order: Order) {
    if (order.orderType === "dine_in") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
          <QrCode className="w-3.5 h-3.5" /> Masa {order.tableNumber}
          {order.guestCount ? ` • 👥 ${order.guestCount} Kişi` : ""}
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

