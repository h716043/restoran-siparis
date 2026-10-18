"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  Suspense,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Utensils,
  ShoppingBag,
  Truck,
  QrCode,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  Settings,
  X,
  AlertCircle,
  Sparkles,
  Flame,
  ArrowRight,
  MessageCircle,
  UserCheck,
  LogOut,
  ShieldCheck,
  KeyRound,
  History,
  RotateCcw,
  Home,
  PackageCheck,
  BellRing,
  CreditCard,
  Banknote,
  Tag,
  Ticket,
  Gift,
  Search,
  CalendarDays,
  Users,
  Star,
  Palette,
  Sun,
  Moon,
} from "lucide-react";
import {
  Category,
  Coupon,
  CustomerUser,
  DeliveryZone,
  MenuItem,
  Order,
  OrderItem,
  OrderType,
  PaymentMethod,
  RestaurantSettings,
  SavedAddress,
  SelectedModifier,
  TableReservation,
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
import {
  extractSubProductHeader,
  parseStructuredModifiers,
  splitOptionNameAndPortion,
} from "@/lib/modifierFormat";

interface PublicReviewItem {
  id: string;
  customerName: string;
  rating: number;
  reviewText?: string;
  reviewedAt: string;
  itemsSummary: string;
}

const TIME_SLOTS = [
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
];

function CustomerMenuContent() {
  const searchParams = useSearchParams();
  const rawTableParam = searchParams.get("masa") || searchParams.get("table");
  const tableParam = rawTableParam ? rawTableParam.trim() : null;
  const isEmbed = searchParams.get("embed") === "1";

  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [publicReviews, setPublicReviews] = useState<PublicReviewItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Sipariş tipi (QR ile gelindiyse otomatik dine_in)
  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [tableNumber, setTableNumber] = useState<string>("");

  // Müşteri Üyelik & WhatsApp OTP State
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "otp">("phone");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authOtpCode, setAuthOtpCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isExistingAccount, setIsExistingAccount] = useState(false);

  // Müşteri Hesabım Modalı & Gelişmiş Adres Formu
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<
    "active_orders" | "past_orders" | "addresses"
  >("active_orders");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [newAddressTitle, setNewAddressTitle] = useState("Evim");
  const [newAddressZoneId, setNewAddressZoneId] = useState("");
  const [newAddressFull, setNewAddressFull] = useState("");
  const [newAddressBuildingNo, setNewAddressBuildingNo] = useState("");
  const [newAddressFloor, setNewAddressFloor] = useState("");
  const [newAddressApartmentNo, setNewAddressApartmentNo] = useState("");
  const [newAddressDirections, setNewAddressDirections] = useState("");
  const [newAddressCoords, setNewAddressCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [newAddressIsDefault, setNewAddressIsDefault] = useState(false);
  const [locatingGpsTarget, setLocatingGpsTarget] = useState<
    "modal" | "checkout" | null
  >(null);
  const [gpsFeedback, setGpsFeedback] = useState("");
  const [autoMatchedZoneHint, setAutoMatchedZoneHint] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const profileMutationLockUntilRef = useRef<number>(0);

  // Simülasyon modunda ekranda beliren gerçekçi WhatsApp mesaj bildirimi
  const [simulatedWaPopup, setSimulatedWaPopup] = useState<{
    code: string;
    message: string;
    phone: string;
  } | null>(null);

  // Ürün detay & opsiyon seçimi modalı
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemNote, setItemNote] = useState<string>("");
  const [chosenModifiers, setChosenModifiers] = useState<
    Record<string, string[]>
  >({});
  // Her porsiyonun kendi ekstra seçimleri (anahtar: `${groupId}__${optionId}`)
  const [chosenSubOptions, setChosenSubOptions] = useState<
    Record<string, string[]>
  >({});

  // Sepet & Checkout
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "form">("cart");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [checkoutBuildingNo, setCheckoutBuildingNo] = useState("");
  const [checkoutFloor, setCheckoutFloor] = useState("");
  const [checkoutApartmentNo, setCheckoutApartmentNo] = useState("");
  const [checkoutDirections, setCheckoutDirections] = useState("");
  const [checkoutCoords, setCheckoutCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [saveCheckoutAddressToBook, setSaveCheckoutAddressToBook] =
    useState(true);
  const [checkoutAddressTitle, setCheckoutAddressTitle] = useState("Evim");
  const [orderNote, setOrderNote] = useState("");
  const [selectedQuickPrefs, setSelectedQuickPrefs] = useState<string[]>([]);
  const [selectedTipPreset, setSelectedTipPreset] = useState<
    "none" | "20" | "30" | "50" | "pct5" | "pct10"
  >("none");
  const [splitPeopleCount, setSplitPeopleCount] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Sipariş Sonrası Puanlama & Yorum State
  const [reviewingOrderId, setReviewingOrderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // İleri Saatli Sipariş (Ön Sipariş) State
  const [deliveryTiming, setDeliveryTiming] = useState<"asap" | "scheduled">(
    "asap"
  );
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState<string>("19:30");

  // Masa Rezervasyonu Modalı & State
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [myReservations, setMyReservations] = useState<TableReservation[]>([]);
  const [resDate, setResDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [resTime, setResTime] = useState<string>("19:30");
  const [resGuests, setResGuests] = useState<number>(2);
  const [resName, setResName] = useState<string>("");
  const [resPhone, setResPhone] = useState<string>("");
  const [resNotes, setResNotes] = useState<string>("");
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resSuccessMsg, setResSuccessMsg] = useState("");

  // Üye olmayan (Masadan QR) misafir siparişi için son sipariş takibi
  const [guestActiveOrder, setGuestActiveOrder] = useState<Order | null>(null);

  // Teslimat Bölgesi (Mahalle) Seçimi
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  // Kupon Kodu & İndirim
  const [couponInput, setCouponInput] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponMessage, setCouponMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Masa Garson Çağır / Hesap İste Bildirimi & Canlı Masa Adisyonu
  const [tableCallSending, setTableCallSending] = useState(false);
  const [tableCallToast, setTableCallToast] = useState<string>("");
  const [liveTableOrders, setLiveTableOrders] = useState<Order[]>([]);
  const [tableBillExpanded, setTableBillExpanded] = useState(false);

  // 3 Açık + 3 Kapalı Tema Yönetimi
  const [activeTheme, setActiveTheme] = useState<ThemeId>("light-classic");
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  // ❤️ Müşteri Favori Ürünleri (localStorage)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // 🖼️ Müşteri Menü Görünüm Modu (showcase = Büyük Fotoğraflı Vitrin, grid = Klasik Kart, compact = Hızlı Liste)
  const [menuLayout, setMenuLayout] = useState<"showcase" | "grid" | "compact">(
    "grid"
  );

  // 📸 Tam Ekran Ürün Fotoğrafı Büyütme (Lightbox Zoom)
  const [zoomImage, setZoomImage] = useState<{
    url: string;
    title: string;
    price?: number;
    originalPrice?: number;
    description?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem("restoran_favorite_items");
      if (savedFavs) {
        const parsed = JSON.parse(savedFavs);
        if (Array.isArray(parsed)) setFavoriteIds(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectMenuLayout = (
    nextLayout: "showcase" | "grid" | "compact"
  ) => {
    setMenuLayout(nextLayout);
    try {
      localStorage.setItem("restoran_menu_layout", nextLayout);
    } catch {
      // ignore
    }
  };

  const toggleFavoriteItem = (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavoriteIds((prev) => {
      const next = prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId];
      try {
        localStorage.setItem("restoran_favorite_items", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSelectTheme = (themeId: ThemeId) => {
    setActiveTheme(themeId);
    applyThemeToDocument(themeId);
    try {
      localStorage.setItem("restoran_selected_theme", themeId);
    } catch {
      // ignore
    }
  };

  const enabledOrderTypes = getEnabledOrderTypes(settings);

  useEffect(() => {
    const allowed = getEnabledOrderTypes(settings);
    if (tableParam && allowed.includes("dine_in")) {
      setOrderType("dine_in");
      const list = getRestaurantTables(settings);
      const matched = list.find((t) => isSameTableName(t, tableParam));
      setTableNumber(matched || tableParam);
      setPaymentMethod("pos_at_table");
      return;
    }
    if (settings && !allowed.includes(orderType)) {
      const fallbackType = allowed[0];
      setOrderType(fallbackType);
      if (fallbackType === "dine_in") {
        setPaymentMethod("pos_at_table");
      } else {
        setPaymentMethod("card_at_door");
      }
    }
  }, [tableParam, settings, orderType]);

  const fetchUserProfileAndOrders = useCallback(
    async (phone: string, force = false) => {
      if (!phone) return;
      const reqStartTime = Date.now();
      try {
        const [profRes, resvRes] = await Promise.all([
          fetch(`/api/auth/profile?phone=${encodeURIComponent(phone)}`),
          fetch(`/api/reservations?phone=${encodeURIComponent(phone)}`),
        ]);
        if (profRes.ok) {
          const data = await profRes.json();
          if (
            data.user &&
            (force ||
              (Date.now() > profileMutationLockUntilRef.current &&
                reqStartTime > profileMutationLockUntilRef.current))
          ) {
            setCurrentUser(data.user);
            localStorage.setItem(
              "restoran_customer_user",
              JSON.stringify(data.user)
            );
          }
          if (data.orders) {
            setCustomerOrders(data.orders);
          }
        }
        if (resvRes.ok) {
          const rData = await resvRes.json();
          setMyReservations(rData.reservations || []);
        }
      } catch {
        // ignore
      }
    },
    []
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("restoran_customer_user");
      if (saved) {
        const parsed: CustomerUser = JSON.parse(saved);
        setCurrentUser(parsed);
        setCustomerName(parsed.name);
        setCustomerPhone(parsed.phone);
        setResName(parsed.name);
        setResPhone(parsed.phone);
        if (parsed.addresses && parsed.addresses.length > 0) {
          const preferred =
            parsed.addresses.find((a) => a.isDefault) || parsed.addresses[0];
          setCustomerAddress(preferred.fullAddress);
          if (preferred.zoneId) {
            setSelectedZoneId(preferred.zoneId);
          }
          if (
            typeof preferred.lat === "number" &&
            typeof preferred.lng === "number"
          ) {
            setCheckoutCoords({ lat: preferred.lat, lng: preferred.lng });
          }
        }
        fetchUserProfileAndOrders(parsed.phone);
      }
    } catch {
      // ignore
    }
  }, [fetchUserProfileAndOrders]);

  useEffect(() => {
    async function loadMenu() {
      try {
        const res = await fetch("/api/menu");
        const data = await res.json();
        setSettings(data.settings);
        setCategories(data.categories || []);
        setItems(data.items || []);
        setPublicReviews(data.publicReviews || []);

        const adminDefaultLayout =
          data.settings?.defaultMenuLayout || "grid";
        try {
          const savedLayout = localStorage.getItem("restoran_menu_layout") as
            | "showcase"
            | "grid"
            | "compact"
            | null;
          if (
            savedLayout === "showcase" ||
            savedLayout === "grid" ||
            savedLayout === "compact"
          ) {
            setMenuLayout(savedLayout);
          } else {
            setMenuLayout(adminDefaultLayout);
          }
        } catch {
          setMenuLayout(adminDefaultLayout);
        }

        const defaultTheme: ThemeId =
          data.settings?.storefrontTheme || "light-classic";
        let resolvedTheme: ThemeId = defaultTheme;
        if (data.settings?.allowCustomerThemeSwitch !== false) {
          try {
            const savedTheme = localStorage.getItem(
              "restoran_selected_theme"
            ) as ThemeId | null;
            if (
              savedTheme &&
              STOREFRONT_THEMES.some((t) => t.id === savedTheme)
            ) {
              resolvedTheme = savedTheme;
            }
          } catch {
            // ignore
          }
        }
        setActiveTheme(resolvedTheme);
        applyThemeToDocument(resolvedTheme);

        const zones: DeliveryZone[] = (
          data.settings?.deliveryZones || []
        ).filter((z: DeliveryZone) => z.active);
        if (zones.length > 0) {
          setSelectedZoneId((prev) => prev || zones[0].id);
          setNewAddressZoneId(zones[0].id);
        }
      } catch (e) {
        console.error("Menü yüklenemedi:", e);
      } finally {
        setLoading(false);
      }
    }
    loadMenu();
  }, []);

  // Eğer seçili kategori geçersizse otomatik "all" yap
  useEffect(() => {
    if (
      activeCategory !== "all" &&
      activeCategory !== "favorites" &&
      categories.length > 0 &&
      !categories.some((c) => c.id === activeCategory)
    ) {
      setActiveCategory("all");
    }
  }, [activeCategory, categories]);

  const fetchPublicTableOrders = useCallback(async (tNum: string) => {
    if (!tNum) {
      setLiveTableOrders([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/orders?publicTable=${encodeURIComponent(tNum)}`
      );
      if (res.ok) {
        const data = await res.json();
        setLiveTableOrders(data.orders || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (orderType === "dine_in" && tableNumber) {
      fetchPublicTableOrders(tableNumber);
    } else {
      setLiveTableOrders([]);
    }
  }, [orderType, tableNumber, fetchPublicTableOrders]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (currentUser?.phone) {
        fetchUserProfileAndOrders(currentUser.phone);
      } else if (resPhone && reservationModalOpen) {
        const r = await fetch(
          `/api/reservations?phone=${encodeURIComponent(resPhone)}`
        );
        if (r.ok) {
          const d = await r.json();
          setMyReservations(d.reservations || []);
        }
      }
      if (orderType === "dine_in" && tableNumber) {
        fetchPublicTableOrders(tableNumber);
      }
      if (guestActiveOrder) {
        try {
          const res = await fetch(`/api/orders/${guestActiveOrder.id}`);
          if (res.ok) {
            const data = await res.json();
            setGuestActiveOrder(data.order);
          }
        } catch {
          // ignore
        }
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [
    currentUser?.phone,
    guestActiveOrder,
    fetchUserProfileAndOrders,
    fetchPublicTableOrders,
    orderType,
    tableNumber,
    resPhone,
    reservationModalOpen,
  ]);

  const activeZones = useMemo(() => {
    return (settings?.deliveryZones || []).filter((z) => z.active);
  }, [settings]);

  const selectedZone = useMemo(() => {
    return (
      activeZones.find((z) => z.id === selectedZoneId) || activeZones[0] || null
    );
  }, [activeZones, selectedZoneId]);

  const activeCoupons = useMemo(() => {
    return (settings?.coupons || []).filter((c) => c.active);
  }, [settings]);

  const activeUserOrders = useMemo(() => {
    return customerOrders.filter((o) =>
      ["pending", "accepted", "ready"].includes(o.status)
    );
  }, [customerOrders]);

  const pastUserOrders = useMemo(() => {
    return customerOrders.filter((o) =>
      ["completed", "rejected"].includes(o.status)
    );
  }, [customerOrders]);

  // Masa Rezervasyonu Gönderimi
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setResSubmitting(true);
    setResSuccessMsg("");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: resName.trim(),
          customerPhone: resPhone.trim(),
          guestCount: resGuests,
          reservationDate: resDate,
          reservationTime: resTime,
          specialRequests: resNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.reservation) {
        setMyReservations((prev) => [data.reservation, ...prev]);
        setResNotes("");
        setResSuccessMsg(
          `Rezervasyon talebiniz (#${data.reservation.reservationNumber}) restorana iletildi! Onaylandığında WhatsApp üzerinden bilgilendirileceksiniz.`
        );
      }
    } finally {
      setResSubmitting(false);
    }
  };

  // Masa Garson Çağır veya Hesap İste Gönderimi
  const handleSendTableCall = async (
    type: "waiter" | "bill_cash" | "bill_card"
  ) => {
    if (!tableNumber) {
      alert("Lütfen önce masa numaranızı seçin.");
      return;
    }
    setTableCallSending(true);
    try {
      const res = await fetch("/api/table-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber, type }),
      });
      if (res.ok) {
        const label =
          type === "waiter"
            ? `Masa ${tableNumber} için Garson Çağrınız mutfak/kasa ekranına iletildi!`
            : type === "bill_cash"
            ? `Masa ${tableNumber} için Nakit Hesap isteğiniz iletildi!`
            : `Masa ${tableNumber} için Kredi Kartı (POS) Hesap isteğiniz iletildi!`;
        setTableCallToast(label);
        setTimeout(() => setTableCallToast(""), 4500);
      }
    } finally {
      setTableCallSending(false);
    }
  };

  // WhatsApp OTP Gönder
  const handleSendWhatsAppOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: authPhone, name: authName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Kod gönderilemedi.");
      } else {
        setIsExistingAccount(Boolean(data.isExistingUser));
        if (data.existingUserName && !authName) {
          setAuthName(data.existingUserName);
        }
        setAuthStep("otp");
        if (data.simulatedCode) {
          setSimulatedWaPopup({
            code: data.simulatedCode,
            message: data.previewMessage,
            phone: data.phone,
          });
        }
      }
    } catch {
      setAuthError("Bağlantı hatası oluştu.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyWhatsAppOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!isExistingAccount && !authName.trim()) {
      setAuthError("Lütfen adınızı ve soyadınızı girin.");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: authPhone,
          code: authOtpCode,
          name: authName.trim() || "Müşteri",
          address: customerAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Kod doğrulanamadı.");
      } else {
        const user: CustomerUser = data.user;
        setCurrentUser(user);
        localStorage.setItem("restoran_customer_user", JSON.stringify(user));
        setCustomerName(user.name);
        setCustomerPhone(user.phone);
        setResName(user.name);
        setResPhone(user.phone);
        if (user.addresses && user.addresses.length > 0 && !customerAddress) {
          const preferred =
            user.addresses.find((a) => a.isDefault) || user.addresses[0];
          setCustomerAddress(preferred.fullAddress);
          if (preferred.zoneId) {
            setSelectedZoneId(preferred.zoneId);
          }
          if (
            typeof preferred.lat === "number" &&
            typeof preferred.lng === "number"
          ) {
            setCheckoutCoords({ lat: preferred.lat, lng: preferred.lng });
          }
        }
        fetchUserProfileAndOrders(user.phone);
        setAuthModalOpen(false);
        setSimulatedWaPopup(null);
        setAuthOtpCode("");
        if (cart.length > 0) {
          setCheckoutStep("form");
        }
      }
    } catch {
      setAuthError("Doğrulama sırasında hata oluştu.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCustomerOrders([]);
    localStorage.removeItem("restoran_customer_user");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setCheckoutCoords(null);
    setAccountModalOpen(false);
  };

  const composeStructuredAddressString = useCallback(
    (
      streetRaw: string,
      buildingNo?: string,
      floor?: string,
      apartmentNo?: string,
      directions?: string
    ) => {
      const base = streetRaw.trim();
      if (!base) return "";
      const detailParts: string[] = [];
      if (buildingNo?.trim() && !base.includes(`Bina: ${buildingNo.trim()}`)) {
        detailParts.push(`Bina: ${buildingNo.trim()}`);
      }
      if (floor?.trim() && !base.includes(`Kat: ${floor.trim()}`)) {
        detailParts.push(`Kat: ${floor.trim()}`);
      }
      if (apartmentNo?.trim() && !base.includes(`Daire: ${apartmentNo.trim()}`)) {
        detailParts.push(`Daire: ${apartmentNo.trim()}`);
      }
      const detailsStr =
        detailParts.length > 0 ? ` (${detailParts.join(", ")})` : "";
      const dirStr =
        directions?.trim() && !base.includes(directions.trim())
          ? ` • Tarif: ${directions.trim()}`
          : "";
      return `${base}${detailsStr}${dirStr}`;
    },
    []
  );

  // 4. ÖZELLİK: Yazılan veya GPS'ten gelen adresten Mahalle / Teslimat Bölgesini Otomatik Algılama
  const autoMatchDeliveryZoneFromText = useCallback(
    (rawText: string, target: "modal" | "checkout") => {
      if (!rawText || activeZones.length === 0) return null;
      const normalizedText = rawText
        .toLocaleLowerCase("tr-TR")
        .replace(/[^a-z0-9çğıöşü\s]/gi, " ");
      for (const z of activeZones) {
        const keywords = z.name
          .toLocaleLowerCase("tr-TR")
          .split(/[^a-z0-9çğıöşü]+/i)
          .map((w) => w.trim())
          .filter((w) => w.length >= 3 && w !== "ve" && w !== "mah" && w !== "mahallesi");
        if (keywords.some((kw) => normalizedText.includes(kw))) {
          if (target === "modal") {
            setNewAddressZoneId(z.id);
          } else {
            setSelectedZoneId(z.id);
          }
          setAutoMatchedZoneHint(
            `✨ Teslimat bölgesi adresinizden otomatik seçildi: ${z.name}`
          );
          setTimeout(() => setAutoMatchedZoneHint(""), 5500);
          return z;
        }
      }
      return null;
    },
    [activeZones]
  );

  // 1. ÖZELLİK: 📍 Mevcut Konumumu Kullan (GPS + OpenStreetMap Nominatim Ters-Geocoding)
  const handleDetectGpsLocation = useCallback(
    (target: "modal" | "checkout") => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        setGpsFeedback("Tarayıcınız GPS konum özelliğini desteklemiyor.");
        return;
      }
      setLocatingGpsTarget(target);
      setGpsFeedback("📍 GPS uydusundan konumunuz alınıyor...");

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          if (target === "modal") {
            setNewAddressCoords({ lat, lng });
          } else {
            setCheckoutCoords({ lat, lng });
          }

          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=tr`,
              { headers: { Accept: "application/json" } }
            );
            if (res.ok) {
              const data = await res.json();
              const addr = data?.address || {};
              const neighbourhood =
                addr.neighbourhood ||
                addr.suburb ||
                addr.quarter ||
                addr.village ||
                "";
              const road =
                addr.road || addr.pedestrian || addr.residential || "";
              const houseNum = addr.house_number || "";
              const district =
                addr.town || addr.city_district || addr.county || "";
              const city = addr.city || addr.province || "";

              const parts = [
                neighbourhood,
                road,
                houseNum ? `No:${houseNum}` : "",
                district,
                city,
              ].filter(Boolean);
              const resolvedStreet =
                parts.length > 0
                  ? parts.join(", ")
                  : data?.display_name || `GPS Konumu (${lat}, ${lng})`;

              if (target === "modal") {
                setNewAddressFull(resolvedStreet);
                if (houseNum && !newAddressBuildingNo) {
                  setNewAddressBuildingNo(String(houseNum));
                }
              } else {
                setCustomerAddress(resolvedStreet);
                if (houseNum && !checkoutBuildingNo) {
                  setCheckoutBuildingNo(String(houseNum));
                }
              }

              autoMatchDeliveryZoneFromText(
                `${resolvedStreet} ${data?.display_name || ""}`,
                target
              );
              setGpsFeedback(
                "🎯 Konumunuz ve harita pininiz başarıyla eklendi! Bina/Kat/Daire bilgilerinizi kontrol edin."
              );
            } else {
              setGpsFeedback(
                `🎯 GPS koordinatınız (${lat}, ${lng}) kaydedildi! Lütfen sokak ve bina bilginizi yazın.`
              );
            }
          } catch {
            setGpsFeedback(
              `🎯 GPS koordinatınız (${lat}, ${lng}) kaydedildi! Lütfen açık adresinizi tamamlayın.`
            );
          } finally {
            setLocatingGpsTarget(null);
            setTimeout(() => setGpsFeedback(""), 6500);
          }
        },
        (err) => {
          setLocatingGpsTarget(null);
          if (err.code === 1) {
            setGpsFeedback(
              "⚠️ Konum izni reddedildi. Tarayıcı adres çubuğundan konum izni vererek tekrar deneyebilirsiniz."
            );
          } else {
            setGpsFeedback(
              "⚠️ GPS konumu alınamadı, lütfen adresinizi kutucuğa yazın."
            );
          }
          setTimeout(() => setGpsFeedback(""), 5500);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    },
    [autoMatchDeliveryZoneFromText, checkoutBuildingNo, newAddressBuildingNo]
  );

  const handleSelectSavedAddress = (addr: SavedAddress) => {
    setCustomerAddress(addr.fullAddress);
    if (addr.zoneId) setSelectedZoneId(addr.zoneId);
    if (typeof addr.lat === "number" && typeof addr.lng === "number") {
      setCheckoutCoords({ lat: addr.lat, lng: addr.lng });
    } else {
      setCheckoutCoords(null);
    }
    setCheckoutBuildingNo("");
    setCheckoutFloor("");
    setCheckoutApartmentNo("");
    setCheckoutDirections("");
  };

  const handleStartEditAddress = (addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setNewAddressTitle(addr.title || "Evim");
    if (addr.zoneId && activeZones.some((z) => z.id === addr.zoneId)) {
      setNewAddressZoneId(addr.zoneId);
    } else if (activeZones.length > 0 && !newAddressZoneId) {
      setNewAddressZoneId(activeZones[0].id);
    }
    setNewAddressFull(addr.streetAddress || addr.fullAddress || "");
    setNewAddressBuildingNo(addr.buildingNo || "");
    setNewAddressFloor(addr.floor || "");
    setNewAddressApartmentNo(addr.apartmentNo || "");
    setNewAddressDirections(addr.directions || "");
    setNewAddressCoords(
      typeof addr.lat === "number" && typeof addr.lng === "number"
        ? { lat: addr.lat, lng: addr.lng }
        : null
    );
    setNewAddressIsDefault(Boolean(addr.isDefault));
  };

  const handleCancelEditAddress = () => {
    setEditingAddressId(null);
    setNewAddressTitle("Evim");
    setNewAddressFull("");
    setNewAddressBuildingNo("");
    setNewAddressFloor("");
    setNewAddressApartmentNo("");
    setNewAddressDirections("");
    setNewAddressCoords(null);
    setNewAddressIsDefault(false);
  };

  // 3. ÖZELLİK: ⭐ Varsayılan Adres Yapma
  const handleSetDefaultAddress = async (addrId: string) => {
    if (!currentUser) return;
    profileMutationLockUntilRef.current = Date.now() + 6000;
    const existingList = currentUser.addresses || [];
    const targetAddr = existingList.find((a) => a.id === addrId);
    if (!targetAddr) return;

    const updatedAddresses = [
      { ...targetAddr, isDefault: true },
      ...existingList
        .filter((a) => a.id !== addrId)
        .map((a) => ({ ...a, isDefault: false })),
    ];

    const optimisticUser: CustomerUser = {
      ...currentUser,
      addresses: updatedAddresses,
      lastLoginAt: new Date().toISOString(),
    };
    setCurrentUser(optimisticUser);
    localStorage.setItem(
      "restoran_customer_user",
      JSON.stringify(optimisticUser)
    );
    handleSelectSavedAddress({ ...targetAddr, isDefault: true });

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: currentUser.phone,
          name: currentUser.name,
          addresses: updatedAddresses,
        }),
      });
      profileMutationLockUntilRef.current = Date.now() + 4000;
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem(
            "restoran_customer_user",
            JSON.stringify(data.user)
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newAddressFull.trim()) return;
    setSavingAddress(true);
    profileMutationLockUntilRef.current = Date.now() + 6000;

    const matchedZone =
      autoMatchDeliveryZoneFromText(newAddressFull, "modal") ||
      activeZones.find((z) => z.id === newAddressZoneId);
    const zoneObj =
      activeZones.find((z) => z.id === newAddressZoneId) || matchedZone;
    const targetId = editingAddressId || `addr-${Date.now()}`;
    const composedFull = composeStructuredAddressString(
      newAddressFull,
      newAddressBuildingNo,
      newAddressFloor,
      newAddressApartmentNo,
      newAddressDirections
    );

    const existingList = currentUser.addresses || [];
    const shouldBeDefault =
      newAddressIsDefault || existingList.length === 0;

    const savedAddr: SavedAddress = {
      id: targetId,
      title: newAddressTitle.trim() || "Evim",
      zoneId: zoneObj?.id,
      zoneName: zoneObj?.name,
      fullAddress: composedFull,
      streetAddress: newAddressFull.trim(),
      buildingNo: newAddressBuildingNo.trim() || undefined,
      floor: newAddressFloor.trim() || undefined,
      apartmentNo: newAddressApartmentNo.trim() || undefined,
      directions: newAddressDirections.trim() || undefined,
      lat: newAddressCoords?.lat,
      lng: newAddressCoords?.lng,
      isDefault: shouldBeDefault,
    };

    let updatedAddresses = editingAddressId
      ? existingList.map((a) =>
          a.id === editingAddressId
            ? savedAddr
            : shouldBeDefault
            ? { ...a, isDefault: false }
            : a
        )
      : [
          savedAddr,
          ...existingList.map((a) =>
            shouldBeDefault ? { ...a, isDefault: false } : a
          ),
        ];

    if (shouldBeDefault) {
      updatedAddresses = [
        savedAddr,
        ...updatedAddresses.filter((a) => a.id !== savedAddr.id),
      ];
    }

    const optimisticUser: CustomerUser = {
      ...currentUser,
      addresses: updatedAddresses,
      lastLoginAt: new Date().toISOString(),
    };
    setCurrentUser(optimisticUser);
    localStorage.setItem(
      "restoran_customer_user",
      JSON.stringify(optimisticUser)
    );
    handleSelectSavedAddress(savedAddr);
    handleCancelEditAddress();

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: currentUser.phone,
          name: currentUser.name,
          addresses: updatedAddresses,
        }),
      });
      profileMutationLockUntilRef.current = Date.now() + 4000;
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem(
            "restoran_customer_user",
            JSON.stringify(data.user)
          );
        }
      }
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!currentUser) return;
    profileMutationLockUntilRef.current = Date.now() + 6000;
    const deletedAddr = (currentUser.addresses || []).find(
      (a) => a.id === addrId
    );
    const updatedAddresses = (currentUser.addresses || []).filter(
      (a) => a.id !== addrId
    );
    if (editingAddressId === addrId) {
      handleCancelEditAddress();
    }

    const optimisticUser: CustomerUser = {
      ...currentUser,
      addresses: updatedAddresses,
      lastLoginAt: new Date().toISOString(),
    };
    setCurrentUser(optimisticUser);
    localStorage.setItem(
      "restoran_customer_user",
      JSON.stringify(optimisticUser)
    );
    if (updatedAddresses.length > 0) {
      const nextPreferred =
        updatedAddresses.find((a) => a.isDefault) || updatedAddresses[0];
      if (!customerAddress || customerAddress === deletedAddr?.fullAddress) {
        handleSelectSavedAddress(nextPreferred);
      }
    } else if (customerAddress === deletedAddr?.fullAddress) {
      setCustomerAddress("");
      setCheckoutCoords(null);
    }

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: currentUser.phone,
          name: currentUser.name,
          addresses: updatedAddresses,
        }),
      });
      profileMutationLockUntilRef.current = Date.now() + 4000;
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem(
            "restoran_customer_user",
            JSON.stringify(data.user)
          );
        }
      }
    } catch {
      // ignore
    }
  };

  const handleReorderPastOrder = (order: Order) => {
    const clonedItems: OrderItem[] = order.items.map((item) => ({
      ...item,
      id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }));
    setCart((prev) => [...prev, ...clonedItems]);
    setAccountModalOpen(false);
    setCheckoutStep("cart");
  };

  const openItemModal = (item: MenuItem) => {
    if (!item.available) return;
    setSelectedItem(item);
    setItemQuantity(1);
    setItemNote("");
    const defaults: Record<string, string[]> = {};
    for (const group of item.modifierGroups || []) {
      if (group.required && group.options.length > 0) {
        defaults[group.id] = [group.options[0].id];
      } else {
        defaults[group.id] = [];
      }
    }
    setChosenModifiers(defaults);
    setChosenSubOptions({});
  };

  const toggleModifierOption = (
    groupId: string,
    optionId: string,
    multiSelect: boolean
  ) => {
    setChosenModifiers((prev) => {
      const current = prev[groupId] || [];
      if (!multiSelect) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      } else {
        return { ...prev, [groupId]: [...current, optionId] };
      }
    });
  };

  const toggleSubOption = (
    groupId: string,
    optionId: string,
    subOptionId: string
  ) => {
    const key = `${groupId}__${optionId}`;
    setChosenSubOptions((prev) => {
      const current = prev[key] || [];
      if (current.includes(subOptionId)) {
        return { ...prev, [key]: current.filter((id) => id !== subOptionId) };
      }
      return { ...prev, [key]: [...current, subOptionId] };
    });
  };

  const modalUnitPrice = useMemo(() => {
    if (!selectedItem) return 0;
    let extra = 0;
    for (const group of selectedItem.modifierGroups || []) {
      const chosenIds = chosenModifiers[group.id] || [];
      for (const opt of group.options) {
        if (chosenIds.includes(opt.id)) {
          extra += opt.price;
          const subKey = `${group.id}__${opt.id}`;
          const chosenSubIds = chosenSubOptions[subKey] || [];
          for (const subOpt of opt.subOptions || []) {
            if (chosenSubIds.includes(subOpt.id)) {
              extra += subOpt.price;
            }
          }
        }
      }
    }
    return selectedItem.price + extra;
  }, [selectedItem, chosenModifiers, chosenSubOptions]);

  const handleAddToCart = () => {
    if (!selectedItem) return;

    for (const group of selectedItem.modifierGroups || []) {
      if (
        group.required &&
        (!chosenModifiers[group.id] || chosenModifiers[group.id].length === 0)
      ) {
        alert(
          `Lütfen "${
            group.productTag ? `${group.productTag} - ${group.name}` : group.name
          }" seçimi yapınız.`
        );
        return;
      }
    }

    const selectedMods: SelectedModifier[] = [];
    for (const group of selectedItem.modifierGroups || []) {
      const chosenIds = chosenModifiers[group.id] || [];
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
          selectedMods.push({
            groupName: baseGroupName,
            optionName: opt.name,
            price: opt.price,
            productTag: group.productTag,
            modifierRole: mainRole,
          });

          const subKey = `${group.id}__${opt.id}`;
          const chosenSubIds = chosenSubOptions[subKey] || [];
          for (const subOpt of opt.subOptions || []) {
            if (chosenSubIds.includes(subOpt.id)) {
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

    const newItem: OrderItem = {
      id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: selectedItem.id,
      name: selectedItem.name,
      quantity: itemQuantity,
      basePrice: selectedItem.price,
      unitPrice: modalUnitPrice,
      totalPrice: modalUnitPrice * itemQuantity,
      selectedModifiers: selectedMods,
      itemNote: itemNote.trim() || undefined,
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedItem(null);
  };

  // Sepette "Yanına İyi Gider" tek tıkla hızlı ürün ekleme
  const handleQuickAddUpsell = (item: MenuItem) => {
    const selectedMods: SelectedModifier[] = [];
    for (const g of item.modifierGroups || []) {
      if (g.required && g.options.length > 0) {
        selectedMods.push({
          groupName: g.name,
          optionName: g.options[0].name,
          price: g.options[0].price,
        });
      }
    }
    const unit =
      item.price + selectedMods.reduce((s, m) => s + m.price, 0);
    setCart((prev) => [
      ...prev,
      {
        id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        menuItemId: item.id,
        name: item.name,
        quantity: 1,
        basePrice: item.price,
        unitPrice: unit,
        totalPrice: unit,
        selectedModifiers: selectedMods,
      },
    ]);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== cartItemId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return {
            ...item,
            quantity: nextQty,
            totalPrice: item.unitPrice * nextQty,
          };
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  // ⚡ Menü kartı üzerinden doğrudan [- X +] ile sepetteki adedi değiştirme
  const handleDirectMenuItemDelta = (
    menuItem: MenuItem,
    delta: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const matchingCartItems = cart.filter((c) => c.menuItemId === menuItem.id);
    if (matchingCartItems.length > 0) {
      const targetCartItem = matchingCartItems[matchingCartItems.length - 1];
      updateCartQuantity(targetCartItem.id, delta);
    } else if (delta > 0) {
      openItemModal(menuItem);
    }
  };

  const BADGE_META: Record<string, { label: string; cls: string }> = {
    spicy: {
      label: "🌶️ Acılı",
      cls: "bg-red-50 text-red-700 border-red-200",
    },
    chef: {
      label: "👨‍🍳 Şefin Spesiyali",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
    new: {
      label: "🆕 Yeni Lezzet",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    wood_fire: {
      label: "🔥 Odun Ateşinde",
      cls: "bg-orange-50 text-orange-800 border-orange-200",
    },
    meat_100: {
      label: "🥩 %100 Yaprak Et",
      cls: "bg-rose-50 text-rose-800 border-rose-200",
    },
    veg: {
      label: "🥗 Vejetaryen",
      cls: "bg-green-50 text-green-700 border-green-200",
    },
    fast: {
      label: "⏱️ Hızlı Servis",
      cls: "bg-sky-50 text-sky-700 border-sky-200",
    },
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.totalPrice, 0),
    [cart]
  );

  // Paket serviste seçili mahallenin minimum paket tutarı ve getirme ücreti
  const currentMinDeliveryAmount = useMemo(() => {
    if (orderType !== "delivery") return 0;
    if (selectedZone) return selectedZone.minAmount;
    return settings?.minDeliveryAmount || 0;
  }, [orderType, selectedZone, settings]);

  const deliveryFee = useMemo(() => {
    if (orderType !== "delivery" || cart.length === 0) return 0;
    if (selectedZone) return selectedZone.deliveryFee;
    return settings?.deliveryFee || 0;
  }, [orderType, selectedZone, settings, cart.length]);

  // ⏱️ Saatlik Happy Hour / Öğle Menüsü Otomatik İndirim Kontrolü
  const isHappyHourActive = useMemo(() => {
    const hh = settings?.happyHourConfig;
    if (!hh || !hh.enabled || !hh.startTime || !hh.endTime || hh.discountPercent <= 0) {
      return false;
    }
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [sH, sM] = hh.startTime.split(":").map(Number);
    const [eH, eM] = hh.endTime.split(":").map(Number);
    const startTotal = (sH || 0) * 60 + (sM || 0);
    const endTotal = (eH || 0) * 60 + (eM || 0);
    if (endTotal >= startTotal) {
      return cur >= startTotal && cur <= endTotal;
    }
    return cur >= startTotal || cur <= endTotal;
  }, [settings?.happyHourConfig]);

  // Kupon, İlk Sipariş veya Happy Hour İndirimi / Bindirimi Hesaplama (Yuvarlamasız, Kuruşu Kuruşuna Tam Hesap)
  const isFirstOrderEligible = useMemo(() => {
    return (
      Boolean(currentUser) &&
      customerOrders.length === 0 &&
      (settings?.firstOrderDiscountPercent || 0) > 0
    );
  }, [currentUser, customerOrders.length, settings?.firstOrderDiscountPercent]);

  const activePriceAdjustment = useMemo<{
    type: "discount" | "surcharge" | null;
    amount: number;
    label: string;
    codeTag?: string;
  }>(() => {
    if (cart.length === 0) {
      return { type: null, amount: 0, label: "" };
    }
    if (appliedCoupon) {
      if (subtotal < appliedCoupon.minOrderAmount) {
        return { type: null, amount: 0, label: "" };
      }
      const isPct =
        appliedCoupon.discountType === "percentage" ||
        (appliedCoupon.discountType as string) === "percent";
      const rawAmt = isPct
        ? Number(((subtotal * appliedCoupon.discountValue) / 100).toFixed(2))
        : Number(Math.min(subtotal, appliedCoupon.discountValue).toFixed(2));
      if (rawAmt > 0) {
        return {
          type: "discount",
          amount: rawAmt,
          label: isPct
            ? `İndirim (${appliedCoupon.code} %${appliedCoupon.discountValue})`
            : `İndirim (${appliedCoupon.code})`,
          codeTag: appliedCoupon.code,
        };
      }
    }
    if (isHappyHourActive && settings?.happyHourConfig) {
      const hh = settings.happyHourConfig;
      const eligibleSubtotal =
        hh.categoryIds && hh.categoryIds.length > 0
          ? cart.reduce((sum, ci) => {
              const foundMenu = items.find((m) => m.id === ci.menuItemId);
              if (foundMenu && hh.categoryIds!.includes(foundMenu.categoryId)) {
                return sum + ci.totalPrice;
              }
              return sum;
            }, 0)
          : subtotal;
      const hhAmt = Number(
        ((eligibleSubtotal * hh.discountPercent) / 100).toFixed(2)
      );
      if (hhAmt > 0) {
        const hhTitle = (hh.title || "Happy Hour").trim();
        if (hh.mode === "surcharge") {
          return {
            type: "surcharge",
            amount: hhAmt,
            label: `Bindirim (${hhTitle} +%${hh.discountPercent})`,
            codeTag: `BINDIRIM+%${hh.discountPercent}`,
          };
        }
        return {
          type: "discount",
          amount: hhAmt,
          label: `İndirim (${hhTitle} %${hh.discountPercent})`,
          codeTag: `HAPPYHOUR-%${hh.discountPercent}`,
        };
      }
    }
    if (isFirstOrderEligible) {
      const pct = settings?.firstOrderDiscountPercent || 0;
      const firstAmt = Number(((subtotal * pct) / 100).toFixed(2));
      if (firstAmt > 0) {
        return {
          type: "discount",
          amount: firstAmt,
          label: `İndirim (İlk Sipariş %${pct})`,
          codeTag: `ILKSIPARIS%${pct}`,
        };
      }
    }
    return { type: null, amount: 0, label: "" };
  }, [
    cart,
    items,
    appliedCoupon,
    subtotal,
    isHappyHourActive,
    settings?.happyHourConfig,
    isFirstOrderEligible,
    settings?.firstOrderDiscountPercent,
  ]);

  const discountAmount =
    activePriceAdjustment.type === "discount" ? activePriceAdjustment.amount : 0;
  const surchargeAmount =
    activePriceAdjustment.type === "surcharge" ? activePriceAdjustment.amount : 0;

  const calculatedTipAmount = useMemo(() => {
    if (cart.length === 0 || selectedTipPreset === "none") return 0;
    if (selectedTipPreset === "20") return 20;
    if (selectedTipPreset === "30") return 30;
    if (selectedTipPreset === "50") return 50;
    if (selectedTipPreset === "pct5") {
      return Number(((subtotal * 5) / 100).toFixed(2));
    }
    if (selectedTipPreset === "pct10") {
      return Number(((subtotal * 10) / 100).toFixed(2));
    }
    return 0;
  }, [cart.length, selectedTipPreset, subtotal]);

  const baseTotalBeforeLoyalty = Number(
    (
      Math.max(0, subtotal - discountAmount + surchargeAmount) +
      deliveryFee +
      calculatedTipAmount
    ).toFixed(2)
  );

  // İsteğe Bağlı Müşteri Sadakat & Para Puan Hesaplaması
  const isLoyaltyEnabled = Boolean(settings?.loyaltyConfig?.enabled);
  const availableUserPoints = Number(currentUser?.loyaltyPoints || 0);
  const minRedeemPoints = Number(settings?.loyaltyConfig?.minRedeemPoints ?? 20);
  const canRedeemPoints =
    isLoyaltyEnabled &&
    Boolean(currentUser) &&
    availableUserPoints >= minRedeemPoints &&
    baseTotalBeforeLoyalty > 0;

  const loyaltyPointsToUse = useMemo(() => {
    if (!canRedeemPoints || !useLoyaltyPoints) return 0;
    return Number(Math.min(availableUserPoints, baseTotalBeforeLoyalty).toFixed(2));
  }, [canRedeemPoints, useLoyaltyPoints, availableUserPoints, baseTotalBeforeLoyalty]);

  const totalAmount = Number(
    Math.max(0, baseTotalBeforeLoyalty - loyaltyPointsToUse).toFixed(2)
  );

  const estimatedPointsToEarn = useMemo(() => {
    if (!isLoyaltyEnabled || loyaltyPointsToUse > 0) return 0;
    const pct = Number(settings?.loyaltyConfig?.earnPercent || 0);
    if (pct <= 0) return 0;
    return Math.round(((totalAmount * pct) / 100) * 100) / 100;
  }, [isLoyaltyEnabled, loyaltyPointsToUse, settings?.loyaltyConfig?.earnPercent, totalAmount]);

  const handleSubmitOrderReview = async (orderId: string) => {
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          rating: reviewRating,
          reviewText: reviewText.trim() || undefined,
        }),
      });
      if (res.ok) {
        setReviewingOrderId(null);
        setReviewText("");
        if (currentUser?.phone) {
          await fetchUserProfileAndOrders(currentUser.phone);
        }
        // Yeniden menü yorumlarını çek
        const mRes = await fetch("/api/menu");
        if (mRes.ok) {
          const mData = await mRes.json();
          setPublicReviews(mData.publicReviews || []);
        }
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleApplyCouponCode = (codeToApply?: string) => {
    const raw = (codeToApply ?? couponInput).trim().toUpperCase();
    if (!raw) return;
    const found = activeCoupons.find((c) => c.code.toUpperCase() === raw);
    if (!found) {
      setCouponMessage({
        type: "error",
        text: "Geçersiz veya süresi dolmuş kupon kodu.",
      });
      return;
    }
    setAppliedCoupon(found);
    setCouponInput(found.code);
    if (subtotal < found.minOrderAmount) {
      setCouponMessage({
        type: "success",
        text: `"${found.code}" seçildi! Sepetiniz ${found.minOrderAmount} ${settings?.currency} olduğunda otomatik düşülecektir.`,
      });
    } else {
      setCouponMessage({
        type: "success",
        text: `"${found.title}" başarıyla uygulandı!`,
      });
    }
  };

  // Sepette olmayan tatlı ve içecekleri "Yanına İyi Gider" olarak öner
  const upsellSuggestions = useMemo(() => {
    const inCartIds = new Set(cart.map((c) => c.menuItemId));
    return items
      .filter(
        (i) =>
          i.available &&
          !inCartIds.has(i.id) &&
          (i.categoryId === "cat-5" ||
            i.categoryId === "cat-6" ||
            i.categoryId === "cat-4")
      )
      .slice(0, 3);
  }, [items, cart]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCat =
        activeCategory === "all" ||
        (activeCategory === "favorites"
          ? favoriteIds.includes(item.id)
          : item.categoryId === activeCategory);
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [items, activeCategory, searchQuery, favoriteIds]);

  const isCurrentlyOpen = useMemo(() => {
    if (!settings) return true;
    if (!settings.isOpen) return false;
    if (settings.autoOpenCloseByHours && settings.openTime && settings.closeTime) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [openH, openM] = settings.openTime.split(":").map(Number);
      const [closeH, closeM] = settings.closeTime.split(":").map(Number);
      const openTotal = (openH || 0) * 60 + (openM || 0);
      const closeTotal = (closeH || 0) * 60 + (closeM || 0);
      if (closeTotal >= openTotal) {
        return currentMinutes >= openTotal && currentMinutes <= closeTotal;
      } else {
        // Gece yarısını geçen kapanış saati (örn: 11:00 - 02:00)
        return currentMinutes >= openTotal || currentMinutes <= closeTotal;
      }
    }
    return true;
  }, [settings]);

  const isAuthRequiredForCurrentOrder = useMemo(() => {
    const reqSetting =
      settings?.whatsappConfig?.requireAuthForDeliveryAndPickup !== false;
    return reqSetting && (orderType === "delivery" || orderType === "pickup");
  }, [settings, orderType]);

  const handleProceedToCheckout = () => {
    if (isAuthRequiredForCurrentOrder && !currentUser) {
      setAuthStep("phone");
      setAuthError("");
      setAuthModalOpen(true);
      return;
    }
    setCheckoutStep("form");
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!isCurrentlyOpen && deliveryTiming === "asap") {
      setFormError(
        `Restoranımız şu anda kapalıdır (Çalışma Saatlerimiz: ${
          settings?.openingHours || "11:00 - 23:30"
        }). Dilerseniz "İleri Saat Seç" ile çalışma saatlerimiz için ön sipariş verebilirsiniz.`
      );
      return;
    }

    if (isAuthRequiredForCurrentOrder && !currentUser) {
      setAuthModalOpen(true);
      return;
    }

    if (orderType === "delivery" && subtotal < currentMinDeliveryAmount) {
      setFormError(
        `Seçtiğiniz bölge (${
          selectedZone?.name || "Paket Servis"
        }) için minimum sepet tutarı ${currentMinDeliveryAmount} ${
          settings?.currency
        } olmalıdır.`
      );
      return;
    }

    if (orderType === "dine_in" && !tableNumber.trim()) {
      setFormError("Lütfen masa numaranızı seçin veya girin.");
      return;
    }

    if (!customerName.trim()) {
      setFormError("Lütfen adınızı ve soyadınızı girin.");
      return;
    }

    if (orderType !== "dine_in" && !customerPhone.trim()) {
      setFormError("Lütfen iletişim telefon numaranızı girin.");
      return;
    }

    if (orderType === "delivery" && !customerAddress.trim()) {
      setFormError("Lütfen açık teslimat adresinizi girin.");
      return;
    }

    const composedCheckoutAddress =
      orderType === "delivery"
        ? composeStructuredAddressString(
            customerAddress,
            checkoutBuildingNo,
            checkoutFloor,
            checkoutApartmentNo,
            checkoutDirections
          )
        : "";

    setSubmitting(true);
    try {
      // 5. ÖZELLİK: Sepet onay ekranında girilen yeni adresi (bina/kat/daire/GPS pini ile birlikte) Adres Defterine kaydet
      if (
        orderType === "delivery" &&
        currentUser &&
        composedCheckoutAddress &&
        saveCheckoutAddressToBook
      ) {
        const existingList = currentUser.addresses || [];
        const alreadyExists = existingList.some(
          (a) => a.fullAddress === composedCheckoutAddress
        );
        if (!alreadyExists) {
          profileMutationLockUntilRef.current = Date.now() + 6000;
          const newBookEntry: SavedAddress = {
            id: `addr-${Date.now()}`,
            title: checkoutAddressTitle.trim() || "Evim",
            zoneId: selectedZone?.id,
            zoneName: selectedZone?.name,
            fullAddress: composedCheckoutAddress,
            streetAddress: customerAddress.trim(),
            buildingNo: checkoutBuildingNo.trim() || undefined,
            floor: checkoutFloor.trim() || undefined,
            apartmentNo: checkoutApartmentNo.trim() || undefined,
            directions: checkoutDirections.trim() || undefined,
            lat: checkoutCoords?.lat,
            lng: checkoutCoords?.lng,
            isDefault: existingList.length === 0,
          };
          const nextAddresses = [newBookEntry, ...existingList];
          const optUser: CustomerUser = {
            ...currentUser,
            addresses: nextAddresses,
            lastLoginAt: new Date().toISOString(),
          };
          setCurrentUser(optUser);
          localStorage.setItem(
            "restoran_customer_user",
            JSON.stringify(optUser)
          );
          await fetch("/api/auth/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: currentUser.phone,
              name: currentUser.name,
              addresses: nextAddresses,
            }),
          }).catch(() => {});
        }
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          tableNumber: orderType === "dine_in" ? tableNumber : undefined,
          appendToActiveTableOrder: orderType === "dine_in",
          userId: currentUser?.id,
          customerName,
          customerPhone:
            currentUser?.phone || customerPhone || "Masadan Sipariş",
          customerAddress:
            orderType === "delivery"
              ? `${selectedZone ? `[${selectedZone.name}] ` : ""}${composedCheckoutAddress}`
              : undefined,
          customerCoords:
            orderType === "delivery" && checkoutCoords
              ? checkoutCoords
              : undefined,
          skipAutoAddressInsert: true,
          deliveryZoneId:
            orderType === "delivery" ? selectedZone?.id : undefined,
          deliveryZoneName:
            orderType === "delivery" ? selectedZone?.name : undefined,
          scheduledTime:
            deliveryTiming === "scheduled"
              ? `Bugün ${scheduledTimeSlot}`
              : undefined,
          orderNote: [
            ...selectedQuickPrefs.map((pref) => `[${pref}]`),
            calculatedTipAmount > 0
              ? `[💚 Bahşiş: +${calculatedTipAmount.toFixed(2)} ${settings?.currency || "₺"}]`
              : "",
            orderNote.trim(),
          ]
            .filter(Boolean)
            .join(" "),
          paymentMethod,
          subtotal,
          discountAmount,
          couponCode: activePriceAdjustment.codeTag,
          useLoyaltyPoints: Boolean(useLoyaltyPoints && canRedeemPoints),
          loyaltyPointsUsed: loyaltyPointsToUse,
          baseTotalBeforeLoyalty,
          deliveryFee,
          totalAmount,
          items: cart,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requireWhatsAppAuth) {
          setAuthModalOpen(true);
        }
        setFormError(data.error || "Sipariş gönderilemedi.");
      } else {
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem(
            "restoran_customer_user",
            JSON.stringify(data.user)
          );
        }
        setCart([]);
        setAppliedCoupon(null);
        setCouponInput("");
        setCouponMessage(null);
        setUseLoyaltyPoints(false);
        setSelectedQuickPrefs([]);
        setSelectedTipPreset("none");
        setSplitPeopleCount(1);
        setOrderNote("");
        setDeliveryTiming("asap");
        setCheckoutBuildingNo("");
        setCheckoutFloor("");
        setCheckoutApartmentNo("");
        setCheckoutDirections("");
        setCheckoutStep("cart");
        setMobileCartOpen(false);
        if (orderType === "dine_in" && tableNumber) {
          fetchPublicTableOrders(tableNumber);
        }
        if (currentUser?.phone) {
          await fetchUserProfileAndOrders(currentUser.phone, true);
          setAccountTab("active_orders");
          setAccountModalOpen(true);
        } else {
          setGuestActiveOrder(data.order);
        }
      }
    } catch {
      setFormError("Bağlantı hatası oluştu, lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-medium">Menü Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const bannerActiveOrder =
    activeUserOrders.length > 0 ? activeUserOrders[0] : guestActiveOrder;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-28 lg:pb-0">
      {/* Masa Çağrı / Hesap İste Bildirim Toast */}
      {tableCallToast && (
        <div className="fixed top-16 sm:top-auto sm:bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-2.5 text-xs sm:text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{tableCallToast}</span>
        </div>
      )}

      {/* Simülasyon Modu: Gerçekçi Gelen WhatsApp Mesajı Bildirim Balonu */}
      {simulatedWaPopup && (
        <div className="fixed top-4 right-4 z-[70] max-w-sm w-full bg-[#075E54] text-white rounded-2xl shadow-2xl border border-emerald-400/40 p-4 space-y-3 animate-bounce">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold shadow">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#25D366]">
                  WhatsApp Mesajı Geldi (Simülasyon)
                </div>
                <div className="text-xs text-emerald-100">
                  Alıcı: +{simulatedWaPopup.phone}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSimulatedWaPopup(null)}
              className="text-emerald-200 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#DCF8C6] text-slate-900 p-3 rounded-xl text-xs whitespace-pre-line font-medium shadow-inner">
            {simulatedWaPopup.message}
          </div>

          <button
            type="button"
            onClick={() => {
              setAuthOtpCode(simulatedWaPopup.code);
            }}
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-extrabold text-xs py-2.5 px-3 rounded-xl transition shadow"
          >
            Kodu Otomatik Doldur: {simulatedWaPopup.code}
          </button>
        </div>
      )}

      {/* Admin Panelinden Yönetilen Üst Duyuru / Kampanya Barı */}
      {!isEmbed && settings?.announcementBar?.enabled && (
        <div
          className={`text-xs py-2 px-4 border-b transition ${
            settings.announcementBar.theme === "orange"
              ? "bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 text-white border-orange-700"
              : settings.announcementBar.theme === "emerald"
              ? "bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-700 text-white border-emerald-800"
              : settings.announcementBar.theme === "indigo"
              ? "bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-700 text-white border-indigo-800"
              : "bg-slate-900 text-slate-100 border-slate-800"
          }`}
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {settings.announcementBar.badgeText && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 text-white font-extrabold tracking-wide text-[11px]">
                  <Sparkles className="w-3 h-3" />
                  {settings.announcementBar.badgeText}
                </span>
              )}
              <span className="font-medium text-xs sm:text-[13px]">
                {settings.announcementBar.text}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {settings.announcementBar.couponCodeToApply && (
                <button
                  type="button"
                  onClick={() =>
                    handleApplyCouponCode(
                      settings.announcementBar!.couponCodeToApply!
                    )
                  }
                  className="inline-flex items-center gap-1 bg-white text-slate-900 hover:bg-orange-50 px-2.5 py-1 rounded-lg font-extrabold text-[11px] shadow-xs transition cursor-pointer"
                >
                  <Ticket className="w-3.5 h-3.5 text-orange-600" />
                  {appliedCoupon?.code ===
                  settings.announcementBar.couponCodeToApply
                    ? `✓ ${settings.announcementBar.couponCodeToApply} Uygulandı`
                    : `${settings.announcementBar.couponCodeToApply} Kodunu Kullan`}
                </button>
              )}
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] opacity-85">
                <Clock className="w-3 h-3" /> {settings.openingHours}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Restoran Üst Başlık (Header - Sabit kalmaz, tek buton altında toplanmış kompakt görünüm) */}
      <header className="bg-white border-b border-slate-200 relative z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-sm sm:text-lg font-bold text-slate-900 truncate">
                  {settings?.name}
                </h1>
                {isCurrentlyOpen ? (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Açık
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    Kapalı ({settings?.openingHours || "11:00 - 23:30"})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate hidden sm:block">
                {settings?.slogan}
              </p>
            </div>
          </div>

          {/* Tek Buton Altında Toplanmış Sipariş Türü, Hesabım, Rezervasyon & Tema Menüsü */}
          <div className="relative flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setHeaderMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition shadow-sm cursor-pointer"
            >
              <span className="inline-flex items-center gap-1 text-orange-400">
                {orderType === "delivery" ? (
                  <>
                    <Truck className="w-3.5 h-3.5" />
                    <span>Paket</span>
                  </>
                ) : orderType === "pickup" ? (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Gel-Al</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-3.5 h-3.5" />
                    <span>
                      {tableNumber ? `Masa ${tableNumber}` : "Masada"}
                    </span>
                  </>
                )}
              </span>
              <span className="text-slate-500">•</span>
              <span>☰ Menü & Hesabım</span>
              {currentUser && isLoyaltyEnabled && (
                <span className="hidden sm:inline-flex bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  🎁 {(currentUser.loyaltyPoints || 0).toFixed(0)}{" "}
                  {settings?.currency}
                </span>
              )}
              <span className="text-[10px] opacity-80">
                {headerMenuOpen ? "▲" : "▾"}
              </span>
            </button>

            {headerMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setHeaderMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3.5 z-50 space-y-3 text-slate-800">
                  {/* 1. Sipariş Tipi Seçici */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                      {enabledOrderTypes.length > 1
                        ? "Sipariş Türü Seçin"
                        : "Aktif Sipariş Türü"}
                    </div>
                    <div
                      className={`grid gap-1 bg-slate-100 p-1 rounded-xl ${
                        enabledOrderTypes.length === 1
                          ? "grid-cols-1"
                          : enabledOrderTypes.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-3"
                      }`}
                    >
                      {enabledOrderTypes.includes("delivery") && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderType("delivery");
                            setHeaderMenuOpen(false);
                          }}
                          className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            orderType === "delivery"
                              ? "bg-white text-orange-600 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Truck className="w-4 h-4" />
                          <span>Paket Servis</span>
                        </button>
                      )}
                      {enabledOrderTypes.includes("pickup") && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderType("pickup");
                            setHeaderMenuOpen(false);
                          }}
                          className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            orderType === "pickup"
                              ? "bg-white text-orange-600 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <ShoppingBag className="w-4 h-4" />
                          <span>Gel-Al</span>
                        </button>
                      )}
                      {enabledOrderTypes.includes("dine_in") && (
                        <button
                          type="button"
                          onClick={() => {
                            setOrderType("dine_in");
                            setPaymentMethod("pos_at_table");
                            setHeaderMenuOpen(false);
                          }}
                          className={`flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            orderType === "dine_in"
                              ? "bg-white text-orange-600 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <QrCode className="w-4 h-4" />
                          <span>
                            {tableNumber
                              ? formatTableLabel(tableNumber)
                              : "Masada (QR)"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. Müşteri Hesabım / Siparişlerim & Adreslerim */}
                  <div
                    className="space-y-1.5 border-t border-slate-100 pt-2.5"
                    onClick={() => setHeaderMenuOpen(false)}
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                      Müşteri Hesabım & Siparişlerim
                    </div>
                    <div className="[&>button]:w-full [&>button]:justify-between">
                      {renderUserAuthBadge()}
                    </div>
                  </div>

                  {/* 3. Masa Rezervasyonu & Tema Seçimi */}
                  <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                      Rezervasyon & Görünüm
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setResSuccessMsg("");
                          if (currentUser?.phone) {
                            fetchUserProfileAndOrders(currentUser.phone);
                          }
                          setReservationModalOpen(true);
                        }}
                        className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-orange-400" />
                          <span>Masa Rezervasyonu Yap</span>
                        </span>
                        {myReservations.filter((r) => r.status === "pending")
                          .length > 0 && (
                          <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                            {
                              myReservations.filter(
                                (r) => r.status === "pending"
                              ).length
                            }{" "}
                            Talep
                          </span>
                        )}
                      </button>

                      {settings?.allowCustomerThemeSwitch !== false && (
                        <button
                          type="button"
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            setThemeModalOpen(true);
                          }}
                          className="w-full flex items-center justify-between bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs px-3.5 py-2.5 rounded-xl transition cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            {getThemeDefinition(activeTheme).mode === "dark" ? (
                              <Moon className="w-4 h-4 text-orange-500" />
                            ) : (
                              <Sun className="w-4 h-4 text-orange-500" />
                            )}
                            <span>
                              Tema: {getThemeDefinition(activeTheme).shortName}
                            </span>
                          </span>
                          <span className="text-[11px] text-orange-600 font-extrabold">
                            Değiştir →
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 📌 AŞAĞI KAYDIRIRKEN ÜSTTE SABİT KALAN (STICKY) KATEGORİ, ARAMA & GÖRÜNÜM BARI */}
      <div
        id="sticky-category-bar"
        className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-2xs"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
                activeCategory === "all"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Tüm Menü ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("favorites")}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
                activeCategory === "favorites"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
              }`}
            >
              <span>❤️ Favoriler ({favoriteIds.length})</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="mobile-menu-search-input"
                type="search"
                placeholder="Menüde lezzet ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 🖼️ 3 Farklı Menü Görünüm Modu Seçici */}
            <div
              className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0"
              title="Menü Görünüm Düzeni Seçin"
            >
              {[
                { id: "showcase" as const, label: "📸 Vitrin" },
                { id: "grid" as const, label: "🍱 Kart" },
                { id: "compact" as const, label: "📋 Liste" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectMenuLayout(opt.id)}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                    menuLayout === opt.id
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ✨ VİTRİN ÜSTÜ HIZLI RESTORAN BİLGİ & CANLI WHATSAPP DESTEK BANDI */}
      {settings?.showRestaurantInfoBar !== false && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-2.5">
          <div className="bg-white border border-slate-200/90 rounded-2xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3.5 text-slate-700 font-semibold">
              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-800 border border-orange-200 px-2.5 py-0.5 rounded-full font-extrabold">
                🛵 Ort. Teslimat: ~
                {orderType === "delivery" && selectedZone
                  ? selectedZone.estimatedMinutes
                  : settings?.estimatedPrepMinutes || 25}{" "}
                dk
              </span>
              <span className="inline-flex items-center gap-1">
                💳 Kapıda Nakit &amp; Kredi Kartı (POS)
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 font-extrabold">
                ⭐{" "}
                {publicReviews.length > 0
                  ? (
                      publicReviews.reduce((s, r) => s + r.rating, 0) /
                      publicReviews.length
                    ).toFixed(1)
                  : "4.9"}{" "}
                / 5.0 Müşteri Puanı
              </span>
              {settings?.address && (
                <span className="hidden md:inline-flex items-center gap-1 text-slate-500 truncate max-w-xs">
                  📍 {settings.address}
                </span>
              )}
            </div>

            {settings?.phone && (
              <a
                href={`https://wa.me/${settings.phone.replace(/\D/g, "").replace(/^0/, "90")}?text=${encodeURIComponent(
                  `Merhaba ${settings.name}, menü / sipariş hakkında bilgi almak istiyorum.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-[#25D366]/15 hover:bg-[#25D366] text-emerald-900 hover:text-slate-950 border border-[#25D366]/50 font-extrabold px-3 py-1 rounded-full transition"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp Hızlı Destek</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* 📍 MOBİLDE EN ÜSTTE KOMPAKT "SİPARİŞ TÜRÜ, MAHALLE (BÖLGE) SEÇİMİ & TEK TIKLA KUPON BARI" */}
      <div
        id="mobile-zone-coupons-bar"
        className="lg:hidden max-w-7xl mx-auto w-full px-4 mt-2.5 space-y-2"
      >
        {enabledOrderTypes.length > 1 && (
          <div
            className={`grid gap-1 bg-white border border-slate-200 p-1 rounded-2xl shadow-2xs ${
              enabledOrderTypes.length === 2 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {enabledOrderTypes.includes("delivery") && (
              <button
                type="button"
                onClick={() => setOrderType("delivery")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  orderType === "delivery"
                    ? "bg-orange-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Paket Servis</span>
              </button>
            )}
            {enabledOrderTypes.includes("pickup") && (
              <button
                type="button"
                onClick={() => setOrderType("pickup")}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  orderType === "pickup"
                    ? "bg-orange-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Gel-Al</span>
              </button>
            )}
            {enabledOrderTypes.includes("dine_in") && (
              <button
                type="button"
                onClick={() => {
                  setOrderType("dine_in");
                  setPaymentMethod("pos_at_table");
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  orderType === "dine_in"
                    ? "bg-orange-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>
                  {tableNumber ? formatTableLabel(tableNumber) : "Masa (QR)"}
                </span>
              </button>
            )}
          </div>
        )}

        {orderType === "delivery" && activeZones.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xs flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-800">
                <MapPin className="w-3.5 h-3.5 text-orange-600" />
                Teslimat Mahalleniz:
              </span>
              {selectedZone && (
                <span className="text-[10px] font-bold text-slate-500">
                  Min: <strong className="text-slate-800">{selectedZone.minAmount} {settings?.currency}</strong> • Kurye:{" "}
                  <strong className="text-emerald-700">
                    {selectedZone.deliveryFee === 0
                      ? "Ücretsiz"
                      : `${selectedZone.deliveryFee} ${settings?.currency}`}
                  </strong>
                </span>
              )}
            </div>
            <select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              {activeZones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  📍 {zone.name} (Min: {zone.minAmount} {settings?.currency} • ~{zone.estimatedMinutes} dk)
                </option>
              ))}
            </select>
          </div>
        )}

        {activeCoupons.length > 0 && (
          <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-orange-900 whitespace-nowrap shrink-0">
              <Ticket className="w-3.5 h-3.5 text-orange-600" />
              Kuponlar:
            </span>
            {activeCoupons.map((cp) => {
              const isApplied = appliedCoupon?.code === cp.code;
              return (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => handleApplyCouponCode(cp.code)}
                  className={`px-2.5 py-1 rounded-xl border text-[11px] font-extrabold whitespace-nowrap transition shrink-0 cursor-pointer ${
                    isApplied
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                      : "bg-white text-slate-800 border-orange-300 hover:border-orange-500"
                  }`}
                >
                  {isApplied ? `✓ ${cp.code}` : `🏷️ ${cp.code}`}{" "}
                  <span className="opacity-85 font-semibold">
                    (
                    {cp.discountType === "percentage"
                      ? `%${cp.discountValue}`
                      : `${cp.discountValue} ${settings?.currency}`}
                    )
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ⏱️ SAATLİK HAPPY HOUR / TARİFE BARI */}
      {settings?.happyHourConfig?.enabled && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-3">
          <div
            className={`rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs border shadow-xs ${
              isHappyHourActive
                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white border-orange-600"
                : "bg-amber-50 text-amber-900 border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-black/20 font-black text-[11px]">
                ⏱️{" "}
                {isHappyHourActive
                  ? "ŞU AN AKTİF"
                  : settings.happyHourConfig.mode === "surcharge"
                  ? "SAATLİK TARİFE"
                  : "SAATLİK FIRSAT"}
              </span>
              <span className="font-extrabold">
                {settings.happyHourConfig.title} (
                {settings.happyHourConfig.startTime} -{" "}
                {settings.happyHourConfig.endTime})
              </span>
              <span>
                •{" "}
                {settings.happyHourConfig.mode === "surcharge"
                  ? isHappyHourActive
                    ? `Sepetinizde +%${settings.happyHourConfig.discountPercent} saatlik tarife farkı otomatik uygulanıyor.`
                    : `Belirtilen saatlerde siparişlerde +%${settings.happyHourConfig.discountPercent} saatlik tarife uygulanır.`
                  : isHappyHourActive
                  ? `Sepetinizde %${settings.happyHourConfig.discountPercent} Happy Hour indirimi otomatik uygulanıyor!`
                  : `Belirtilen saatlerde tüm siparişlerde otomatik %${settings.happyHourConfig.discountPercent} indirim!`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* QR MASALAR İÇİN "GARSON ÇAĞIR", "HESAP İSTE" & "CANLI MASA ADİSYONUM" BARI */}
      {orderType === "dine_in" && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-3 space-y-2.5">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-3.5 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 flex items-center justify-center font-bold">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400">
                  Masadan Hızlı Servis:
                </span>
                <select
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg"
                >
                  <option value="">Masa Seçin...</option>
                  {getRestaurantTables(settings).map((t) => (
                    <option key={t} value={t}>
                      {formatTableLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={tableCallSending}
                onClick={() => handleSendTableCall("waiter")}
                className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-3 py-2 rounded-xl transition shadow"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Garson Çağır</span>
              </button>
              <button
                type="button"
                disabled={tableCallSending}
                onClick={() => handleSendTableCall("bill_cash")}
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-xl transition shadow"
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Hesap (Nakit)</span>
              </button>
              <button
                type="button"
                disabled={tableCallSending}
                onClick={() => handleSendTableCall("bill_card")}
                className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-2 rounded-xl transition shadow"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Hesap (Kart)</span>
              </button>
            </div>
          </div>

          {/* 2. ÖZELLİK: Masanın Canlı Açık Adisyonunu Gör & Ek Sipariş Ver */}
          {tableNumber && liveTableOrders.length > 0 && (
            <div className="bg-white border-2 border-amber-400 rounded-2xl p-3.5 shadow-sm space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">
                    🪑 Masa {tableNumber} Açık Adisyonunuz
                  </span>
                  <span className="text-xs font-bold text-slate-600">
                    {liveTableOrders.reduce(
                      (acc, o) =>
                        acc + o.items.reduce((s, it) => s + it.quantity, 0),
                      0
                    )}{" "}
                    Ürün • Yeni vereceğiniz siparişler bu adisyona otomatik eklenir
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-orange-600">
                    Toplam:{" "}
                    {liveTableOrders
                      .reduce((s, o) => s + o.totalAmount, 0)
                      .toFixed(0)}{" "}
                    {settings?.currency || "₺"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTableBillExpanded((prev) => !prev)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                  >
                    {tableBillExpanded
                      ? "Adisyonu Gizle ▲"
                      : "Adisyon Detayı Gör ▾"}
                  </button>
                </div>
              </div>

              {tableBillExpanded && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  {liveTableOrders.flatMap((ord) =>
                    ord.items.map((it) => (
                      <div
                        key={`${ord.id}-${it.id}`}
                        className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-black text-orange-600">
                            {it.quantity}x
                          </span>
                          <span className="font-bold text-slate-800">
                            {it.name}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              it.prepared || ord.status === "ready"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {it.prepared || ord.status === "ready"
                              ? "🍽️ Hazır / Servis"
                              : "👨‍🍳 Hazırlanıyor"}
                          </span>
                        </div>
                        <span className="font-extrabold text-slate-900">
                          {it.totalPrice.toFixed(0)} {settings?.currency || "₺"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Canlı Sipariş Takip & Kurye Zaman Çizelgesi Kartı */}
      {bannerActiveOrder && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-3">
          <div className="bg-gradient-to-r from-orange-50 via-amber-50/70 to-white border-2 border-orange-300 rounded-2xl p-3.5 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-orange-600 text-white font-black px-2.5 py-1 rounded-lg">
                  CANLI TAKİP • #{bannerActiveOrder.orderNumber}
                </span>
                {bannerActiveOrder.scheduledTime && (
                  <span className="bg-indigo-600 text-white font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {bannerActiveOrder.scheduledTime}
                  </span>
                )}
                {bannerActiveOrder.courierName && (
                  <span className="bg-emerald-600 text-white font-extrabold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 shadow-2xs">
                    🛵 Kuryeniz: {bannerActiveOrder.courierName}
                  </span>
                )}
                <span className="font-extrabold text-slate-900">
                  {bannerActiveOrder.status === "pending" &&
                    "⏳ Siparişiniz restorana iletildi, onay bekleniyor..."}
                  {bannerActiveOrder.status === "accepted" &&
                    `👨‍🍳 Mutfakta özenle hazırlanıyor (~${
                      bannerActiveOrder.estimatedMinutes ||
                      settings?.estimatedPrepMinutes
                    } dk)`}
                  {bannerActiveOrder.status === "ready" &&
                    (bannerActiveOrder.orderType === "delivery"
                      ? `🛵 Siparişiniz yola çıktı! ${
                          bannerActiveOrder.courierName
                            ? `Kuryemiz ${bannerActiveOrder.courierName} adresinize geliyor.`
                            : "Kuryemiz adresinize geliyor."
                        }`
                      : "🍽️ Siparişiniz servise / teslime hazır!")}
                </span>
              </div>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setAccountTab("active_orders");
                    setAccountModalOpen(true);
                  }}
                  className="font-extrabold text-xs bg-white hover:bg-orange-100 text-orange-700 border border-orange-300 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  Sipariş Detayı →
                </button>
              )}
            </div>

            {/* 4 Adımlı Canlı Sipariş Zaman Çizelgesi */}
            {(() => {
              const stepIdx =
                bannerActiveOrder.status === "pending"
                  ? 1
                  : bannerActiveOrder.status === "accepted"
                  ? 2
                  : bannerActiveOrder.status === "ready"
                  ? 3
                  : 4;
              const steps = [
                { id: 1, label: "1. Sipariş Alındı", icon: "📝" },
                { id: 2, label: "2. Mutfakta Hazırlanıyor", icon: "👨‍🍳" },
                {
                  id: 3,
                  label:
                    bannerActiveOrder.orderType === "delivery"
                      ? bannerActiveOrder.courierName
                        ? `3. Kurye Yolda (${bannerActiveOrder.courierName})`
                        : "3. Kurye Yolda"
                      : "3. Teslime Hazır",
                  icon: bannerActiveOrder.orderType === "delivery" ? "🛵" : "🍽️",
                },
                { id: 4, label: "4. Teslim Edildi", icon: "✅" },
              ];
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {steps.map((st) => {
                    const active = stepIdx >= st.id;
                    const isCurrent = stepIdx === st.id;
                    return (
                      <div
                        key={st.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition ${
                          isCurrent
                            ? "bg-orange-600 text-white border-orange-600 shadow-xs"
                            : active
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : "bg-white/70 text-slate-400 border-slate-200"
                        }`}
                      >
                        <span>{st.icon}</span>
                        <span className="truncate">{st.label}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Ana İçerik: Sol Doğrudan Yemek Menüsü + Sağ Sütun (Bölge, Fırsatlar & Sepet) */}
      <main className="max-w-7xl mx-auto w-full px-4 py-5 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SOL SÜTUN: DOĞRUDAN YEMEK MENÜSÜ */}
        <div className="lg:col-span-8 space-y-6">
          {/* 🔥 EN ÜSTTE KAYDIRILABİLİR "ŞEFİN TAVSİYELERİ & GÜNÜN FIRSATLARI" VİTRİN KARUSELİ */}
          {settings?.showFeaturedCarousel !== false &&
            activeCategory === "all" &&
            !searchQuery.trim() &&
            items.some(
              (i) =>
                i.available &&
                (i.popular ||
                  i.categoryId === "cat-kampanya" ||
                  (i.originalPrice && i.originalPrice > i.price))
            ) && (
              <section className="bg-gradient-to-r from-orange-50 via-amber-50/60 to-white p-4 rounded-2xl border border-orange-200/90 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-orange-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                      🔥 VİTRİN
                    </span>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Şefin Tavsiyeleri &amp; Günün Fırsatları
                    </h2>
                  </div>
                  <span className="text-[11px] font-bold text-orange-700 hidden sm:inline">
                    Kaydırarak İnceleyin →
                  </span>
                </div>

                <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-1">
                  {items
                    .filter(
                      (i) =>
                        i.available &&
                        (i.popular ||
                          i.categoryId === "cat-kampanya" ||
                          (i.originalPrice && i.originalPrice > i.price))
                    )
                    .slice(0, 8)
                    .map((feat) => {
                      const hasDisc =
                        feat.originalPrice && feat.originalPrice > feat.price;
                      const discPct = hasDisc
                        ? Math.round(
                            ((feat.originalPrice! - feat.price) /
                              feat.originalPrice!) *
                              100
                          )
                        : 0;
                      const inCartQty = cart
                        .filter((c) => c.menuItemId === feat.id)
                        .reduce((s, c) => s + c.quantity, 0);
                      return (
                        <div
                          key={`feat-${feat.id}`}
                          onClick={() => openItemModal(feat)}
                          className={`w-56 sm:w-64 flex-shrink-0 bg-white rounded-2xl border overflow-hidden cursor-pointer transition flex flex-col justify-between group ${
                            inCartQty > 0
                              ? "border-orange-500 ring-2 ring-orange-500/30 shadow-md"
                              : "border-slate-200 hover:border-orange-400 hover:shadow-md"
                          }`}
                        >
                          <div>
                            <div className="relative h-32 bg-slate-100 overflow-hidden">
                              {feat.imageUrl && (
                                <img
                                  src={feat.imageUrl}
                                  alt={feat.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />
                              )}
                              {hasDisc && (
                                <span className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow">
                                  -%{discPct} İNDİRİM
                                </span>
                              )}
                              {inCartQty > 0 && (
                                <span className="absolute top-2 right-2 bg-orange-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow">
                                  🛒 Sepette: {inCartQty}
                                </span>
                              )}
                            </div>
                            <div className="p-3 space-y-1">
                              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate group-hover:text-orange-600">
                                {feat.name}
                              </h3>
                              <p className="text-[11px] text-slate-500 line-clamp-1">
                                {feat.description}
                              </p>
                            </div>
                          </div>
                          <div className="px-3 pb-3 pt-1 flex items-center justify-between border-t border-slate-100">
                            <div className="flex items-baseline gap-1.5">
                              {hasDisc && (
                                <span className="text-[11px] text-slate-400 line-through font-semibold">
                                  {feat.originalPrice!.toFixed(0)}{" "}
                                  {settings?.currency}
                                </span>
                              )}
                              <span className="font-black text-sm text-orange-600">
                                {feat.price.toFixed(0)} {settings?.currency}
                              </span>
                            </div>
                            <span className="text-[11px] font-extrabold bg-orange-50 group-hover:bg-orange-600 text-orange-700 group-hover:text-white px-2.5 py-1 rounded-lg transition">
                              + İncele
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <Utensils className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-800 text-sm">
                {activeCategory === "favorites"
                  ? "Henüz favorilerinize eklediğiniz bir ürün bulunmuyor. Ürün kartlarındaki ❤️ kalp ikonuna dokunarak favori lezzetlerinizi kaydedebilirsiniz."
                  : "Aradığınız kriterlere uygun ürün bulunamadı."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setSearchQuery("");
                }}
                className="inline-flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Tüm Menüyü Göster ({items.length} Ürün)
              </button>
            </div>
          ) : (
            categories
              .filter(
                (cat) =>
                  activeCategory === "all" ||
                  activeCategory === "favorites" ||
                  cat.id === activeCategory
              )
              .map((cat) => {
                const catItems = filteredItems.filter(
                  (i) => i.categoryId === cat.id
                );
                if (catItems.length === 0) return null;

                const isCampaignCat = cat.id === "cat-kampanya";
                return (
                  <section
                    key={cat.id}
                    className={`space-y-3 ${
                      isCampaignCat
                        ? "bg-orange-50/40 p-4 rounded-2xl border-2 border-orange-200"
                        : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        {cat.name}
                        <span className="text-xs font-normal text-slate-400">
                          ({catItems.length})
                        </span>
                      </h2>
                      {isCampaignCat && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-orange-600 text-white px-2.5 py-1 rounded-full shadow-xs">
                          <Sparkles className="w-3 h-3" />
                          Çoklu Ürün • Her Ürünün Porsiyonu &amp; Ekstrası Seçilebilir
                        </span>
                      )}
                    </div>

                    <div
                      className={
                        menuLayout === "compact"
                          ? "grid grid-cols-1 gap-2.5"
                          : "grid grid-cols-1 md:grid-cols-2 gap-3.5"
                      }
                    >
                      {catItems.map((item) => {
                        const subProductCount = (
                          item.modifierGroups || []
                        ).filter((g) => Boolean(g.productTag)).length;
                        const isFav = favoriteIds.includes(item.id);
                        const inCartQty = cart
                          .filter((c) => c.menuItemId === item.id)
                          .reduce((s, c) => s + c.quantity, 0);
                        const hasDiscount =
                          item.originalPrice !== undefined &&
                          item.originalPrice > item.price;
                        const discountPercent = hasDiscount
                          ? Math.round(
                              ((item.originalPrice! - item.price) /
                                item.originalPrice!) *
                                100
                            )
                          : 0;
                        const itemBadges = (item.badges || []).filter(
                          (b) => BADGE_META[b]
                        );

                        // 📸 1. MOD: BÜYÜK FOTOĞRAFLI VİTRİN KARTI (SHOWCASE)
                        if (menuLayout === "showcase") {
                          return (
                            <div
                              key={item.id}
                              onClick={() => openItemModal(item)}
                              className={`group bg-white rounded-2xl border overflow-hidden flex flex-col justify-between transition shadow-sm relative ${
                                !item.available
                                  ? "border-red-200 bg-slate-50/80 opacity-65 cursor-not-allowed"
                                  : inCartQty > 0
                                  ? "border-orange-500 ring-2 ring-orange-500/30 shadow-md cursor-pointer"
                                  : "border-slate-200/80 hover:border-orange-400 hover:shadow-md cursor-pointer"
                              }`}
                            >
                              <div>
                                {item.imageUrl && (
                                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className={`w-full h-full object-cover transition duration-300 ${
                                        item.available
                                          ? "group-hover:scale-105"
                                          : "grayscale"
                                      }`}
                                    />
                                    <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5">
                                      {hasDiscount && (
                                        <span className="bg-rose-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow">
                                          -%{discountPercent} İNDİRİM
                                        </span>
                                      )}
                                      {subProductCount > 0 && (
                                        <span className="bg-orange-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-lg shadow">
                                          🎁 {subProductCount} Ürünlü Kampanya
                                        </span>
                                      )}
                                    </div>
                                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(e) =>
                                          toggleFavoriteItem(item.id, e)
                                        }
                                        className="px-2 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-[11px] font-extrabold shadow"
                                      >
                                        {isFav ? "❤️" : "🤍"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setZoomImage({
                                            url: item.imageUrl,
                                            title: item.name,
                                            price: item.price,
                                            originalPrice: item.originalPrice,
                                            description: item.description,
                                          });
                                        }}
                                        title="Fotoğrafı Büyüt"
                                        className="px-2 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[11px] font-bold shadow"
                                      >
                                        🔍 Büyüt
                                      </button>
                                    </div>
                                    {!item.available && (
                                      <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                        <span className="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-lg shadow">
                                          TÜKENDİ
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="p-3.5 space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-1">
                                    {item.popular && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                                        <Flame className="w-3 h-3" /> Çok Satan
                                      </span>
                                    )}
                                    {itemBadges.map((bKey) => (
                                      <span
                                        key={bKey}
                                        className={`inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded border ${BADGE_META[bKey].cls}`}
                                      >
                                        {BADGE_META[bKey].label}
                                      </span>
                                    ))}
                                    {item.available &&
                                      item.dailyStock !== null &&
                                      item.dailyStock !== undefined &&
                                      item.dailyStock > 0 && (
                                        <span
                                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                            item.dailyStock <= 5
                                              ? "bg-rose-600 text-white animate-pulse"
                                              : "bg-amber-100 text-amber-800 border border-amber-300"
                                          }`}
                                        >
                                          {item.dailyStock <= 5
                                            ? `🔥 Son ${item.dailyStock} Porsiyon!`
                                            : `📦 Kalan: ${item.dailyStock}`}
                                        </span>
                                      )}
                                  </div>

                                  <h3 className="font-extrabold text-slate-900 group-hover:text-orange-600 transition text-base truncate">
                                    {item.name}
                                  </h3>
                                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                    {item.description}
                                  </p>
                                </div>
                              </div>

                              <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                <div className="flex items-baseline gap-1.5">
                                  {hasDiscount && (
                                    <span className="text-xs text-slate-400 line-through font-semibold">
                                      {item.originalPrice!.toFixed(2)}{" "}
                                      {settings?.currency}
                                    </span>
                                  )}
                                  <span className="font-black text-slate-900 text-base">
                                    {item.price.toFixed(2)} {settings?.currency}
                                  </span>
                                </div>

                                {!item.available ? (
                                  <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                                    Stokta Yok
                                  </span>
                                ) : inCartQty > 0 ? (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 bg-orange-600 text-white rounded-xl px-2 py-1 shadow-xs"
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) =>
                                        handleDirectMenuItemDelta(item, -1, e)
                                      }
                                      className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center font-black"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-black px-1">
                                      {inCartQty} Sepette
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openItemModal(item)}
                                      className="w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center font-black"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-orange-600 bg-orange-50 group-hover:bg-orange-600 group-hover:text-white px-3 py-1.5 rounded-xl transition">
                                    <Plus className="w-3.5 h-3.5" /> Sepete Ekle
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // 📋 2. MOD: KOMPAKT HIZLI LİSTE GÖRÜNÜMÜ (COMPACT)
                        if (menuLayout === "compact") {
                          return (
                            <div
                              key={item.id}
                              onClick={() => openItemModal(item)}
                              className={`group bg-white rounded-xl border p-2.5 flex items-center justify-between gap-3 transition ${
                                !item.available
                                  ? "border-red-200 bg-slate-50/80 opacity-65 cursor-not-allowed"
                                  : inCartQty > 0
                                  ? "border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/15 cursor-pointer"
                                  : "border-slate-200/80 hover:border-orange-400 cursor-pointer"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {item.imageUrl && (
                                  <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                    {hasDiscount && (
                                      <span className="absolute bottom-0 inset-x-0 bg-rose-600 text-white text-[9px] font-black text-center">
                                        -%{discountPercent}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <h3 className="font-bold text-slate-900 text-sm truncate group-hover:text-orange-600">
                                      {item.name}
                                    </h3>
                                    {itemBadges.map((bKey) => (
                                      <span
                                        key={bKey}
                                        className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border ${BADGE_META[bKey].cls}`}
                                      >
                                        {BADGE_META[bKey].label}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-xs text-slate-500 truncate mt-0.5">
                                    {item.description}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <div className="text-right">
                                  {hasDiscount && (
                                    <span className="text-[11px] text-slate-400 line-through block">
                                      {item.originalPrice!.toFixed(0)}{" "}
                                      {settings?.currency}
                                    </span>
                                  )}
                                  <span className="font-black text-sm text-slate-900">
                                    {item.price.toFixed(2)} {settings?.currency}
                                  </span>
                                </div>

                                {!item.available ? (
                                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                                    Tükendi
                                  </span>
                                ) : inCartQty > 0 ? (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 bg-orange-600 text-white rounded-xl px-2 py-1"
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) =>
                                        handleDirectMenuItemDelta(item, -1, e)
                                      }
                                      className="w-5 h-5 rounded bg-white/20 font-black text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="text-xs font-black px-1">
                                      {inCartQty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openItemModal(item)}
                                      className="w-5 h-5 rounded bg-white/20 font-black text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 group-hover:bg-orange-600 group-hover:text-white px-2.5 py-1.5 rounded-lg transition">
                                    <Plus className="w-3.5 h-3.5" /> Ekle
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // 🍱 3. MOD: KLASİK YAN YANA KART GÖRÜNÜMÜ (GRID - VARSAYILAN)
                        return (
                          <div
                            key={item.id}
                            onClick={() => openItemModal(item)}
                            className={`group bg-white rounded-2xl border p-3.5 flex gap-3.5 transition shadow-sm relative ${
                              !item.available
                                ? "border-red-200 bg-slate-50/80 opacity-65 cursor-not-allowed"
                                : inCartQty > 0
                                ? "border-orange-500 ring-2 ring-orange-500/30 bg-orange-50/10 shadow-md cursor-pointer"
                                : "border-slate-200/80 hover:border-orange-400 hover:shadow-md cursor-pointer"
                            }`}
                          >
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      toggleFavoriteItem(item.id, e)
                                    }
                                    title={
                                      isFav
                                        ? "Favorilerden Çıkar"
                                        : "Favorilerime Ekle"
                                    }
                                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                                      isFav
                                        ? "bg-rose-50 text-rose-600 border-rose-300"
                                        : "bg-slate-50 text-slate-500 border-slate-200 hover:text-rose-600"
                                    }`}
                                  >
                                    <span>
                                      {isFav ? "❤️ Favorim" : "🤍 Favori"}
                                    </span>
                                  </button>
                                  {hasDiscount && (
                                    <span className="inline-flex items-center text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-md shadow-2xs">
                                      -%{discountPercent} İNDİRİM
                                    </span>
                                  )}
                                  {subProductCount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide bg-orange-600 text-white px-2 py-0.5 rounded-md">
                                      🎁 {subProductCount} Ürünlü Kampanya
                                    </span>
                                  )}
                                  {item.popular && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                                      <Flame className="w-3 h-3" /> Çok Satan
                                    </span>
                                  )}
                                  {itemBadges.map((bKey) => (
                                    <span
                                      key={bKey}
                                      className={`inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${BADGE_META[bKey].cls}`}
                                    >
                                      {BADGE_META[bKey].label}
                                    </span>
                                  ))}
                                  {!item.available && (
                                    <span className="inline-flex text-[10px] font-extrabold uppercase bg-red-600 text-white px-2 py-0.5 rounded">
                                      Tükendi
                                    </span>
                                  )}
                                  {item.available &&
                                    item.dailyStock !== null &&
                                    item.dailyStock !== undefined &&
                                    item.dailyStock > 0 && (
                                      <span
                                        className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                          item.dailyStock <= 5
                                            ? "bg-rose-600 text-white animate-pulse"
                                            : "bg-amber-100 text-amber-800 border border-amber-300"
                                        }`}
                                      >
                                        {item.dailyStock <= 5
                                          ? `🔥 Son ${item.dailyStock} Porsiyon!`
                                          : `📦 Kalan: ${item.dailyStock} Porsiyon`}
                                      </span>
                                    )}
                                  {item.modifierGroups &&
                                    item.modifierGroups.length > 0 && (
                                      <span className="inline-flex text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                        Porsiyon &amp; Ekstralı
                                      </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-slate-900 group-hover:text-orange-600 transition text-sm sm:text-base mt-1 truncate">
                                  {item.name}
                                </h3>
                                <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                                  {item.description}
                                </p>
                                {subProductCount > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {(item.modifierGroups || [])
                                      .filter((g) => Boolean(g.productTag))
                                      .map((g) => (
                                        <span
                                          key={g.id}
                                          className="text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200 px-1.5 py-0.5 rounded"
                                        >
                                          {g.productTag}
                                        </span>
                                      ))}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 gap-2">
                                <div className="flex items-baseline gap-1.5">
                                  {hasDiscount && (
                                    <span className="text-xs text-slate-400 line-through font-semibold">
                                      {item.originalPrice!.toFixed(2)}{" "}
                                      {settings?.currency}
                                    </span>
                                  )}
                                  <span className="font-extrabold text-slate-900 text-base">
                                    {item.price.toFixed(2)} {settings?.currency}
                                  </span>
                                </div>
                                {!item.available ? (
                                  <span className="inline-flex items-center text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                                    Stokta Yok
                                  </span>
                                ) : inCartQty > 0 ? (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 bg-orange-600 text-white rounded-xl px-2 py-1 shadow-2xs"
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) =>
                                        handleDirectMenuItemDelta(item, -1, e)
                                      }
                                      className="w-5 h-5 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center font-black text-xs"
                                    >
                                      -
                                    </button>
                                    <span className="text-[11px] font-black px-1">
                                      {inCartQty} Sepette
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openItemModal(item)}
                                      className="w-5 h-5 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center font-black text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 group-hover:bg-orange-600 group-hover:text-white px-2.5 py-1 rounded-lg transition">
                                    <Plus className="w-3.5 h-3.5" /> Ekle
                                  </span>
                                )}
                              </div>
                            </div>

                            {item.imageUrl && (
                              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className={`w-full h-full object-cover transition duration-300 ${
                                    item.available
                                      ? "group-hover:scale-105"
                                      : "grayscale"
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomImage({
                                      url: item.imageUrl,
                                      title: item.name,
                                      price: item.price,
                                      originalPrice: item.originalPrice,
                                      description: item.description,
                                    });
                                  }}
                                  title="Fotoğrafı Büyüt"
                                  className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[11px] flex items-center justify-center shadow"
                                >
                                  🔍
                                </button>
                                {!item.available && (
                                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow">
                                      TÜKENDİ
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
          )}

          {/* ⭐ VİTRİN MÜŞTERİ DEĞERLENDİRMELERİ & YORUMLARI */}
          {publicReviews.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                  <h2 className="font-extrabold text-base text-slate-900">
                    Müşteri Değerlendirmeleri ({publicReviews.length})
                  </h2>
                </div>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  ★ Doğrulanmış Sipariş Yorumları
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {publicReviews.slice(0, 6).map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">
                        {rev.customerName}
                      </span>
                      <span className="text-xs font-black text-amber-500">
                        {"★".repeat(rev.rating)}
                        {"☆".repeat(5 - rev.rating)}
                      </span>
                    </div>
                    {rev.reviewText && (
                      <p className="text-xs text-slate-700 italic">
                        &ldquo;{rev.reviewText}&rdquo;
                      </p>
                    )}
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                      <span className="truncate max-w-[200px]">
                        🍽️ {rev.itemsSummary}
                      </span>
                      <span>
                        {new Date(rev.reviewedAt).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* SAĞ SÜTUN: TESLİMAT BÖLGESİ, FIRSATLAR/KUPONLAR & SİPARİŞ SEPETİ */}
        <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-32">
          {/* Teslimat Bölgesi & Kampanya Kuponları Kartı */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            {enabledOrderTypes.length > 1 && (
              <div
                className={`grid gap-1 bg-slate-100 p-1 rounded-xl ${
                  enabledOrderTypes.length === 2 ? "grid-cols-2" : "grid-cols-3"
                }`}
              >
                {enabledOrderTypes.includes("delivery") && (
                  <button
                    type="button"
                    onClick={() => setOrderType("delivery")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      orderType === "delivery"
                        ? "bg-orange-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Paket</span>
                  </button>
                )}
                {enabledOrderTypes.includes("pickup") && (
                  <button
                    type="button"
                    onClick={() => setOrderType("pickup")}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      orderType === "pickup"
                        ? "bg-orange-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Gel-Al</span>
                  </button>
                )}
                {enabledOrderTypes.includes("dine_in") && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrderType("dine_in");
                      setPaymentMethod("pos_at_table");
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      orderType === "dine_in"
                        ? "bg-orange-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Masa</span>
                  </button>
                )}
              </div>
            )}
            {orderType === "delivery" && activeZones.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-orange-600" />
                    Teslimat Bölgesi:
                  </span>
                  {selectedZone && (
                    <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                      <Clock className="w-3 h-3 text-orange-500" />~
                      {selectedZone.estimatedMinutes} dk
                    </span>
                  )}
                </div>
                <select
                  value={selectedZone?.id || ""}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-orange-200 bg-orange-50/50 text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {activeZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} (Min: {z.minAmount} {settings?.currency} •{" "}
                      {z.deliveryFee === 0
                        ? "Ücretsiz Servis"
                        : `+${z.deliveryFee} ${settings?.currency}`}
                      )
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold text-slate-800">
                  {orderType === "pickup"
                    ? "Restorandan Gel-Al"
                    : `Masada Servis ${tableNumber ? `(Masa ${tableNumber})` : ""}`}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />~
                  {settings?.estimatedPrepMinutes} dk
                </span>
              </div>
            )}

            {(activeCoupons.length > 0 ||
              (settings?.firstOrderDiscountPercent || 0) > 0) && (
              <div className="pt-2.5 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-bold text-orange-600">
                    <Gift className="w-3.5 h-3.5" /> Fırsatlar & Kuponlar:
                  </span>
                  {appliedCoupon && (
                    <span className="text-[11px] font-bold text-emerald-600">
                      ✓ {appliedCoupon.code} Seçili
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(settings?.firstOrderDiscountPercent || 0) > 0 && (
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold">
                      🎁 İlk Siparişe Otomatik %
                      {settings?.firstOrderDiscountPercent} İndirim
                    </span>
                  )}
                  {activeCoupons.map((cpn) => {
                    const isSelected = appliedCoupon?.code === cpn.code;
                    return (
                      <button
                        key={cpn.id}
                        type="button"
                        onClick={() => handleApplyCouponCode(cpn.code)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition text-left ${
                          isSelected
                            ? "bg-orange-600 text-white border-orange-600"
                            : "bg-orange-50 hover:bg-orange-100 text-orange-800 border-orange-200"
                        }`}
                      >
                        🏷️ <strong>{cpn.code}</strong> ({cpn.title})
                      </button>
                    );
                  })}
                </div>
                {couponMessage && cart.length === 0 && (
                  <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                    {couponMessage.text}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Masaüstü Sepet Kutusu */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-400" />
                <h2 className="font-bold text-base">Sipariş Sepetiniz</h2>
              </div>
              <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-medium">
                {cart.reduce((s, i) => s + i.quantity, 0)} Ürün
              </span>
            </div>

            {renderCartAndCheckout()}
          </div>
        </aside>
      </main>

      {/* Alt Bilgi (Footer) & Personel Giriş Bağlantıları */}
      {!isEmbed && (
        <footer className="max-w-7xl mx-auto px-4 pt-8 pb-6 border-t border-slate-200/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700">{settings?.name}</span>
            <span>•</span>
            <span>{settings?.address}</span>
            <span>•</span>
            <span>Tel: {settings?.phone}</span>
          </div>
          {process.env.NEXT_PUBLIC_CUSTOMER_ONLY !== "true" &&
            (typeof window === "undefined" ||
              !window.location.hostname.endsWith(".netlify.app")) && (
              <div className="flex items-center gap-3">
                <Link
                  href="/tv"
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 font-semibold transition"
                >
                  📺 TV Sıra Ekranı
                </Link>
                <span>•</span>
                <Link
                  href="/kitchen"
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 font-semibold transition"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Mutfak Ekranı
                </Link>
                <span>•</span>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 font-semibold transition"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Yönetici Paneli
                </Link>
              </div>
            )}
        </footer>
      )}

      {/* 📱 MOBİL ALT SABİT UYGULAMA MENÜSÜ (BOTTOM NAVIGATION BAR + QR GARSON ÇUBUĞU + SEPET ONAY BARI) */}
      {!isEmbed && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] pb-safe">
          {/* 🔔 QR Masa Müşterileri İçin Yüzen Hızlı Garson & Hesap Çubuğu */}
          {orderType === "dine_in" && (
            <div className="px-3 pt-2 pb-1.5 bg-slate-900 text-white flex items-center justify-between gap-1.5 border-b border-slate-800">
              <span className="text-[11px] font-extrabold text-orange-400 truncate">
                🍽️ {tableNumber ? `Masa ${tableNumber}` : "Masa Seçin"}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={tableCallSending}
                  onClick={() => handleSendTableCall("waiter")}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <BellRing className="w-3 h-3" />
                  <span>Garson</span>
                </button>
                <button
                  type="button"
                  disabled={tableCallSending}
                  onClick={() => handleSendTableCall("bill_cash")}
                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Banknote className="w-3 h-3" />
                  <span>Nakit Hesap</span>
                </button>
                <button
                  type="button"
                  disabled={tableCallSending}
                  onClick={() => handleSendTableCall("bill_card")}
                  className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Kart Hesap</span>
                </button>
              </div>
            </div>
          )}

          {/* 🛒 Sepet Doluysa Üstte Çıkan Canlı Sepeti Onayla Çubuğu */}
          {cart.length > 0 && (
            <div className="px-3 pt-2 pb-1">
              <button
                type="button"
                onClick={() => setMobileCartOpen(true)}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-between shadow-md shadow-orange-600/25 cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="bg-white/20 px-2 py-0.5 rounded-lg font-black">
                    {cart.reduce((s, i) => s + i.quantity, 0)} Ürün
                  </span>
                  <span>Sepeti Görüntüle &amp; Onayla →</span>
                </div>
                <span className="text-sm sm:text-base font-black">
                  {totalAmount.toFixed(2)} {settings?.currency}
                </span>
              </button>
            </div>
          )}

          {/* 📱 5 Sekmeli Mobil Uygulama Alt Menüsü */}
          <nav className="grid grid-cols-5 px-1.5 pt-1 pb-1 text-[10px] font-extrabold text-slate-600">
            <button
              type="button"
              onClick={() => {
                setActiveCategory("all");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
                activeCategory === "all" && !mobileCartOpen && !accountModalOpen
                  ? "text-orange-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Utensils className="w-4 h-4 mb-0.5" />
              <span>Menü</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("mobile-menu-search-input");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  setTimeout(() => (el as HTMLInputElement).focus(), 250);
                }
              }}
              className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-600 hover:text-orange-600 transition cursor-pointer"
            >
              <Search className="w-4 h-4 mb-0.5" />
              <span>Ara</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("mobile-zone-coupons-bar");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className="relative flex flex-col items-center justify-center py-1 rounded-xl text-slate-600 hover:text-orange-600 transition cursor-pointer"
            >
              <Ticket className="w-4 h-4 mb-0.5 text-orange-500" />
              <span>Fırsatlar</span>
              {activeCoupons.length > 0 && (
                <span className="absolute top-0.5 right-3 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
                  {activeCoupons.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (currentUser) {
                  setAccountTab("active_orders");
                  setAccountModalOpen(true);
                } else if (guestActiveOrder) {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else {
                  setAuthStep("phone");
                  setAuthError("");
                  setAuthModalOpen(true);
                }
              }}
              className="relative flex flex-col items-center justify-center py-1 rounded-xl text-slate-600 hover:text-orange-600 transition cursor-pointer"
            >
              <PackageCheck className="w-4 h-4 mb-0.5" />
              <span>{currentUser ? "Siparişim" : "Takip/Üye"}</span>
              {(activeUserOrders.length > 0 || guestActiveOrder) && (
                <span className="absolute top-0.5 right-2.5 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileCartOpen(true)}
              className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition cursor-pointer ${
                cart.length > 0
                  ? "text-orange-600 font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShoppingBag className="w-4 h-4 mb-0.5" />
              <span>Sepetim</span>
              {cart.length > 0 && (
                <span className="absolute top-0 right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-600 text-white text-[9px] font-black flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </nav>
        </div>
      )}

      {/* Mobil Sepet Drawer Modal */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <div className="bg-white w-full max-h-[90dvh] rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-slate-900 pt-2.5 px-4 pb-3.5 text-white">
              <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-2.5" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-400" />
                  <h2 className="font-bold">Sipariş Sepetiniz</h2>
                </div>
                <button
                  onClick={() => setMobileCartOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 pb-safe">
              {renderCartAndCheckout()}
            </div>
          </div>
        </div>
      )}

      {/* ONLINE MASA REZERVASYONU MODALI (GLORIAFOOD TARZI) */}
      {reservationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-slate-900 text-white pt-2.5 sm:pt-5 px-5 pb-4">
              <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-orange-600 flex items-center justify-center text-white font-bold shadow">
                    <CalendarDays className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg">
                      Online Masa Rezervasyonu
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tarih, saat ve kişi sayısı seçin • WhatsApp ile anında onay
                      alın
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReservationModalOpen(false)}
                  className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              {resSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>{resSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleCreateReservation} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Rezervasyon Tarihi *
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={resDate}
                      onChange={(e) => setResDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Saat Seçimi *
                    </label>
                    <select
                      value={resTime}
                      onChange={(e) => setResTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          Saat {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kişi Sayısı *
                    </label>
                    <select
                      value={resGuests}
                      onChange={(e) => setResGuests(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15].map((n) => (
                        <option key={n} value={n}>
                          {n} Kişi
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Adınız Soyadınız *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Ahmet Yılmaz"
                      value={resName}
                      onChange={(e) => setResName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WhatsApp Telefon Numaranız *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="0532 123 45 67"
                      value={resPhone}
                      onChange={(e) => setResPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Özel İstek / Notunuz (İsteğe Bağlı)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Cam kenarı masa, doğum günü kutlaması, bebek koltuğu..."
                    value={resNotes}
                    onChange={(e) => setResNotes(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resSubmitting}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs sm:text-sm transition shadow-md flex items-center justify-center gap-2"
                >
                  <CalendarDays className="w-4 h-4" />
                  <span>
                    {resSubmitting
                      ? "Rezervasyon Gönderiliyor..."
                      : "Masa Rezervasyon Talebi Gönder"}
                  </span>
                </button>
              </form>

              {/* Müşterinin Mevcut Rezervasyon Talepleri */}
              {myReservations.length > 0 && (
                <div className="pt-4 border-t border-slate-200 space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                    Rezervasyon Talepleriniz ({myReservations.length})
                  </h4>
                  <div className="space-y-2">
                    {myReservations.map((r) => (
                      <div
                        key={r.id}
                        className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2 font-bold text-slate-900">
                            <span>#{r.reservationNumber}</span>
                            <span>•</span>
                            <span>
                              {r.reservationDate} Saat {r.reservationTime}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-orange-700">
                              <Users className="w-3.5 h-3.5" /> {r.guestCount}{" "}
                              Kişi
                            </span>
                          </div>
                          {r.specialRequests && (
                            <p className="text-slate-500 mt-0.5">
                              Not: {r.specialRequests}
                            </p>
                          )}
                          {r.rejectReason && (
                            <p className="text-red-600 font-semibold mt-0.5">
                              Sebep: {r.rejectReason}
                            </p>
                          )}
                        </div>
                        <div>
                          {r.status === "pending" && (
                            <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-full">
                              ⏳ Onay Bekliyor
                            </span>
                          )}
                          {r.status === "confirmed" && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">
                              ✅ Onaylandı{" "}
                              {r.assignedTable ? `(Masa ${r.assignedTable})` : ""}
                            </span>
                          )}
                          {r.status === "rejected" && (
                            <span className="bg-red-100 text-red-800 font-bold px-2.5 py-1 rounded-full">
                              ❌ Reddedildi
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MÜŞTERİ HESABIM MODALI */}
      {accountModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-slate-900 text-white pt-2.5 sm:pt-5 px-5 pb-4">
              <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-2.5 sm:hidden" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-bold">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-base sm:text-lg">
                        {currentUser.name}
                      </h3>
                      {isLoyaltyEnabled && (
                        <span className="inline-flex items-center gap-1 bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                          🎁 Cüzdan: {(currentUser.loyaltyPoints || 0).toFixed(2)}{" "}
                          {settings?.currency}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-400 font-medium">
                      WhatsApp Onaylı Üye • +{currentUser.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-xl font-semibold transition"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Çıkış
                  </button>
                  <button
                    onClick={() => setAccountModalOpen(false)}
                    className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 bg-slate-100 p-1.5 gap-1.5 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setAccountTab("active_orders")}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                  accountTab === "active_orders"
                    ? "bg-white text-orange-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                <span>Aktif Siparişler ({activeUserOrders.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountTab("past_orders")}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                  accountTab === "past_orders"
                    ? "bg-white text-orange-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <History className="w-4 h-4" />
                <span>Geçmiş Siparişler ({pastUserOrders.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountTab("addresses")}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                  accountTab === "addresses"
                    ? "bg-white text-orange-600 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Adreslerim ({currentUser.addresses.length})</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {accountTab === "active_orders" && (
                <>
                  {activeUserOrders.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <PackageCheck className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-700 text-sm">
                        Şu anda aktif bir siparişiniz bulunmuyor
                      </p>
                    </div>
                  ) : (
                    activeUserOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="border-2 border-orange-500/80 bg-orange-50/20 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-600 text-white font-black text-xs px-2.5 py-1 rounded-lg">
                              #{ord.orderNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {ord.orderType === "delivery"
                                ? "Paket Servis"
                                : ord.orderType === "pickup"
                                ? "Gel-Al"
                                : `Masa ${ord.tableNumber}`}
                            </span>
                            {ord.scheduledTime && (
                              <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {ord.scheduledTime}
                              </span>
                            )}
                          </div>
                          <span className="font-extrabold text-base text-orange-600">
                            {ord.totalAmount.toFixed(2)} {settings?.currency}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-slate-900 flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {ord.status === "pending" &&
                              "⏳ Restoran onayı bekleniyor..."}
                            {ord.status === "accepted" &&
                              `👨‍🍳 Hazırlanıyor (Tahmini Süre: ${
                                ord.estimatedMinutes ||
                                settings?.estimatedPrepMinutes
                              } dk)`}
                            {ord.status === "ready" &&
                              (ord.orderType === "delivery"
                                ? `🛵 Kuryemiz${
                                    ord.courierName ? ` (${ord.courierName})` : ""
                                  } yola çıktı, adresinize geliyor!`
                                : "🍽️ Siparişiniz servise / teslime hazır!")}
                          </span>
                          {ord.courierName && (
                            <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-emerald-600 text-white px-2.5 py-1 rounded-lg">
                              🛵 Atanan Kurye: {ord.courierName}
                            </span>
                          )}
                        </div>

                        {/* 4 Adımlı Görsel Sipariş Durum Çubuğu */}
                        <div className="grid grid-cols-4 gap-1.5 text-[11px] font-bold">
                          {[
                            { s: 1, t: "1. Alındı" },
                            { s: 2, t: "2. Mutfakta" },
                            {
                              s: 3,
                              t:
                                ord.orderType === "delivery"
                                  ? "3. Yolda"
                                  : "3. Hazır",
                            },
                            { s: 4, t: "4. Teslim" },
                          ].map((st) => {
                            const curStep =
                              ord.status === "pending"
                                ? 1
                                : ord.status === "accepted"
                                ? 2
                                : ord.status === "ready"
                                ? 3
                                : 4;
                            return (
                              <div
                                key={st.s}
                                className={`text-center py-1.5 px-2 rounded-lg border ${
                                  curStep === st.s
                                    ? "bg-orange-600 text-white border-orange-600"
                                    : curStep > st.s
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : "bg-white text-slate-400 border-slate-200"
                                }`}
                              >
                                {st.t}
                              </div>
                            );
                          })}
                        </div>

                        <div className="bg-white rounded-xl p-3 border border-slate-200/80 space-y-1 text-xs">
                          {ord.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between text-slate-700"
                            >
                              <span>
                                <strong>{item.quantity}x</strong> {item.name}
                              </span>
                              <span className="font-semibold">
                                {item.totalPrice.toFixed(2)}{" "}
                                {settings?.currency}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {accountTab === "past_orders" && (
                <>
                  {pastUserOrders.length === 0 ? (
                    <div className="text-center py-10 space-y-2">
                      <History className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-700 text-sm">
                        Henüz tamamlanmış geçmiş siparişiniz yok
                      </p>
                    </div>
                  ) : (
                    pastUserOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">
                              Sipariş #{ord.orderNumber}
                            </span>
                            <span
                              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                ord.status === "completed"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {ord.status === "completed"
                                ? "Tamamlandı"
                                : "İptal / Reddedildi"}
                            </span>
                            {isLoyaltyEnabled &&
                              (ord.loyaltyPointsEarned || 0) > 0 && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                  +{ord.loyaltyPointsEarned?.toFixed(2)}{" "}
                                  {settings?.currency} Puan Kazanıldı
                                </span>
                              )}
                          </div>
                          <span className="font-extrabold text-sm text-slate-900">
                            {ord.totalAmount.toFixed(2)} {settings?.currency}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 space-y-1 bg-white p-3 rounded-xl border border-slate-200/60">
                          {ord.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between"
                            >
                              <span>
                                <strong>{item.quantity}x</strong> {item.name}
                              </span>
                              <span>
                                {item.totalPrice.toFixed(2)}{" "}
                                {settings?.currency}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* ⭐ Sipariş Sonrası Puanlama & Yorum Alanı */}
                        {ord.status === "completed" && (
                          <div className="pt-1">
                            {ord.rating && ord.rating > 0 ? (
                              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-amber-600">
                                    {"★".repeat(ord.rating)}
                                    {"☆".repeat(5 - ord.rating)}
                                  </span>
                                  {ord.reviewText && (
                                    <span className="text-slate-700 italic">
                                      &ldquo;{ord.reviewText}&rdquo;
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold text-emerald-700">
                                  ✓ Değerlendirildi
                                </span>
                              </div>
                            ) : reviewingOrderId === ord.id ? (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-800">
                                    Siparişinizi Puanlayın:
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => setReviewRating(star)}
                                        className={`text-lg leading-none cursor-pointer ${
                                          star <= reviewRating
                                            ? "text-amber-500"
                                            : "text-slate-300"
                                        }`}
                                      >
                                        ★
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Lezzet ve hız hakkında yorumunuz (İsteğe bağlı)..."
                                  value={reviewText}
                                  onChange={(e) => setReviewText(e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs bg-white border border-amber-200 rounded-lg"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setReviewingOrderId(null)}
                                    className="px-2.5 py-1 text-xs font-semibold text-slate-600"
                                  >
                                    Vazgeç
                                  </button>
                                  <button
                                    type="button"
                                    disabled={submittingReview}
                                    onClick={() =>
                                      handleSubmitOrderReview(ord.id)
                                    }
                                    className="px-3 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                                  >
                                    {submittingReview
                                      ? "Kaydediliyor..."
                                      : "Puanı Gönder"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewingOrderId(ord.id);
                                  setReviewRating(5);
                                  setReviewText("");
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                              >
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                                <span>Siparişi Puanla & Yorum Yaz</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-slate-500 truncate max-w-xs">
                            {ord.customerAddress || "Restoran Siparişi"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleReorderPastOrder(ord)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 rounded-xl transition shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Tekrar Sipariş Ver
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {accountTab === "addresses" && (
                <div className="space-y-5">
                  <form
                    onSubmit={handleAddNewAddress}
                    className={`p-4 rounded-2xl border space-y-3.5 transition ${
                      editingAddressId
                        ? "bg-orange-50/70 border-orange-300"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <Plus className="w-4 h-4 text-orange-600" />
                        {editingAddressId
                          ? "✏️ Seçili Teslimat Adresini Düzenle"
                          : "Yeni Teslimat Adresi Ekle"}
                      </h4>
                      <div className="flex items-center gap-2">
                        {/* 1. ÖZELLİK: 📍 GPS ile Otomatik Adres & Konum Pini */}
                        <button
                          type="button"
                          disabled={locatingGpsTarget === "modal"}
                          onClick={() => handleDetectGpsLocation("modal")}
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-xl shadow-xs transition cursor-pointer"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>
                            {locatingGpsTarget === "modal"
                              ? "GPS Alınıyor..."
                              : "📍 Konumumu Bul (GPS)"}
                          </span>
                        </button>
                        {editingAddressId && (
                          <button
                            type="button"
                            onClick={handleCancelEditAddress}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1.5 rounded-xl cursor-pointer"
                          >
                            Vazgeç
                          </button>
                        )}
                      </div>
                    </div>

                    {gpsFeedback && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2">
                        <span>{gpsFeedback}</span>
                        {newAddressCoords && (
                          <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md whitespace-nowrap">
                            Pin: {newAddressCoords.lat}, {newAddressCoords.lng}
                          </span>
                        )}
                      </div>
                    )}

                    {autoMatchedZoneHint && (
                      <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-3 py-1.5 rounded-xl text-[11px] font-bold">
                        {autoMatchedZoneHint}
                      </div>
                    )}

                    {/* 3. ÖZELLİK: Tek Tıkla Hazır Başlık Seçici Rozetler */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-600">
                        Hızlı Adres Başlığı Seçin veya Yazın *
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "🏠 Evim", value: "Evim" },
                          { label: "🏢 İş Yerim", value: "İş Yerim" },
                          { label: "🎓 Kampüs / Yurt", value: "Kampüs / Yurt" },
                          { label: "❤️ Ailem", value: "Ailem" },
                          { label: "📍 Diğer", value: "Diğer Adresim" },
                        ].map((preset) => {
                          const active =
                            newAddressTitle.trim().toLowerCase() ===
                            preset.value.toLowerCase();
                          return (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => setNewAddressTitle(preset.value)}
                              className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                                active
                                  ? "bg-orange-600 text-white border-orange-600 shadow-2xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Adres Başlığı *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Örn: Evim, İş Yerim"
                          value={newAddressTitle}
                          onChange={(e) => setNewAddressTitle(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Mahalle / Teslimat Bölgesi *
                        </label>
                        <select
                          value={newAddressZoneId}
                          onChange={(e) => setNewAddressZoneId(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
                        >
                          {activeZones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name} (Min: {z.minAmount} {settings?.currency})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-600">
                          Cadde, Sokak, Apartman / Site Adı *
                        </label>
                        {newAddressCoords && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            🎯 GPS Harita Pini Eklendi
                            <button
                              type="button"
                              onClick={() => setNewAddressCoords(null)}
                              className="text-slate-400 hover:text-red-600 ml-1"
                              title="GPS Pinini Kaldır"
                            >
                              ×
                            </button>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="Örn: Caferağa Mah. Moda Cad. Çiçek Apt."
                        value={newAddressFull}
                        onChange={(e) => {
                          setNewAddressFull(e.target.value);
                          autoMatchDeliveryZoneFromText(e.target.value, "modal");
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                      />
                    </div>

                    {/* 2. ÖZELLİK: Bina No, Kat, Daire No ve Kurye Yol Tarifi Kutucukları */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          🏢 Bina / Kapı No
                        </label>
                        <input
                          type="text"
                          placeholder="Örn: 15"
                          value={newAddressBuildingNo}
                          onChange={(e) =>
                            setNewAddressBuildingNo(e.target.value)
                          }
                          className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          🪜 Kat
                        </label>
                        <input
                          type="text"
                          placeholder="Örn: 3"
                          value={newAddressFloor}
                          onChange={(e) => setNewAddressFloor(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          🚪 Daire No
                        </label>
                        <input
                          type="text"
                          placeholder="Örn: 8"
                          value={newAddressApartmentNo}
                          onChange={(e) =>
                            setNewAddressApartmentNo(e.target.value)
                          }
                          className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-semibold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        🧭 Kurye İçin Yol Tarifi / Zil Notu (İsteğe Bağlı)
                      </label>
                      <input
                        type="text"
                        placeholder="Örn: Köşedeki eczanenin üstü, bebek uyuyor zile basmayın..."
                        value={newAddressDirections}
                        onChange={(e) =>
                          setNewAddressDirections(e.target.value)
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={newAddressIsDefault}
                        onChange={(e) =>
                          setNewAddressIsDefault(e.target.checked)
                        }
                        className="w-4 h-4 accent-orange-600 rounded"
                      />
                      <span>
                        ⭐ Bu adresi varsayılan teslimat adresim olarak kullan
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={savingAddress}
                        className={`${
                          editingAddressId
                            ? "bg-orange-600 hover:bg-orange-700"
                            : "bg-slate-900 hover:bg-slate-800"
                        } text-white text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer`}
                      >
                        {savingAddress
                          ? "Kaydediliyor..."
                          : editingAddressId
                          ? "✓ Adres Değişikliğini Kaydet"
                          : "+ Adres Defterime Kaydet"}
                      </button>
                      {editingAddressId && (
                        <button
                          type="button"
                          onClick={handleCancelEditAddress}
                          className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-2.5 rounded-xl border border-slate-300 bg-white cursor-pointer"
                        >
                          İptal
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="space-y-2.5">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                      Kayıtlı Adresleriniz ({currentUser.addresses.length})
                    </h4>
                    {currentUser.addresses.map((addr) => {
                      const isSelected = customerAddress === addr.fullAddress;
                      const isBeingEdited = editingAddressId === addr.id;
                      const hasGps =
                        typeof addr.lat === "number" &&
                        typeof addr.lng === "number";
                      return (
                        <div
                          key={addr.id}
                          className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                            isBeingEdited
                              ? "border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/60"
                              : isSelected
                              ? "border-orange-500 bg-orange-50/40"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <Home className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-sm text-slate-900">
                                  {addr.title}
                                </span>
                                {addr.isDefault && (
                                  <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-md">
                                    ⭐ Varsayılan
                                  </span>
                                )}
                                {addr.zoneName && (
                                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                    {addr.zoneName}
                                  </span>
                                )}
                                {hasGps && (
                                  <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                                    🎯 GPS Pinli
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600">
                                {addr.fullAddress}
                              </p>
                              {(addr.buildingNo ||
                                addr.floor ||
                                addr.apartmentNo ||
                                addr.directions) && (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {addr.buildingNo && (
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                      🏢 Bina: {addr.buildingNo}
                                    </span>
                                  )}
                                  {addr.floor && (
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                      🪜 Kat: {addr.floor}
                                    </span>
                                  )}
                                  {addr.apartmentNo && (
                                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                      🚪 Daire: {addr.apartmentNo}
                                    </span>
                                  )}
                                  {addr.directions && (
                                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                                      🧭 {addr.directions}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 flex-shrink-0">
                            {!addr.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultAddress(addr.id)}
                                className="text-[11px] font-bold text-amber-700 hover:bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg transition cursor-pointer"
                                title="Varsayılan Adres Yap"
                              >
                                ⭐ Varsayılan Yap
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSelectSavedAddress(addr)}
                              className="text-xs font-bold text-orange-600 hover:underline px-2 py-1 cursor-pointer"
                            >
                              {isSelected ? "✓ Seçili" : "Seç"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditAddress(addr)}
                              className="text-xs font-bold text-slate-700 hover:text-orange-700 bg-slate-100 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                              title="Adresi Düzenle"
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                              title="Adresi Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP OTP ÜYELİK & DOĞRULAMA MODALI */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#25D366] flex items-center justify-center text-slate-950 shadow">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    WhatsApp ile Hızlı Üyelik / Giriş
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Şifre ezberlemeden 6 haneli WhatsApp kodu ile doğrulama
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuthModalOpen(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {authStep === "phone" ? (
              <form onSubmit={handleSendWhatsAppOtp} className="p-6 space-y-4">
                {authError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium">
                    {authError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    WhatsApp Cep Telefonu Numaranız *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="0532 123 45 67"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#25D366] font-semibold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>
                    {authLoading
                      ? "WhatsApp Kodu Gönderiliyor..."
                      : "WhatsApp Doğrulama Kodu Gönder"}
                  </span>
                </button>
              </form>
            ) : (
              <form
                onSubmit={handleVerifyWhatsAppOtp}
                className="p-6 space-y-4"
              >
                {authError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium">
                    {authError}
                  </div>
                )}

                {!isExistingAccount && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Adınız ve Soyadınız (Yeni Üyelik) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Ahmet Yılmaz"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6 Haneli WhatsApp Doğrulama Kodu *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={authOtpCode}
                    onChange={(e) => setAuthOtpCode(e.target.value)}
                    className="w-full px-4 py-2.5 text-center tracking-[0.4em] text-lg font-black border border-slate-300 rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#075E54] hover:bg-[#064e46] text-white font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>Kodu Doğrula ve Giriş Yap</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 📸 TAM EKRAN ÜRÜN FOTOĞRAFI BÜYÜTME (LIGHTBOX ZOOM) MODALI */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/15"
          >
            <div className="relative max-h-[70vh] bg-black flex items-center justify-center overflow-hidden">
              <img
                src={zoomImage.url}
                alt={zoomImage.title}
                className="w-full max-h-[70vh] object-contain"
              />
              <button
                type="button"
                onClick={() => setZoomImage(null)}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center shadow-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-extrabold text-base">{zoomImage.title}</h4>
                {zoomImage.description && (
                  <p className="text-xs text-slate-300 mt-0.5">
                    {zoomImage.description}
                  </p>
                )}
              </div>
              {zoomImage.price !== undefined && (
                <div className="flex items-baseline gap-2">
                  {zoomImage.originalPrice &&
                    zoomImage.originalPrice > zoomImage.price && (
                      <span className="text-xs text-slate-400 line-through">
                        {zoomImage.originalPrice.toFixed(2)}{" "}
                        {settings?.currency}
                      </span>
                    )}
                  <span className="text-lg font-black text-orange-400">
                    {zoomImage.price.toFixed(2)} {settings?.currency}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ürün Opsiyon & Ekstra Seçim Modalı */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl">
            <div className="relative h-48 bg-slate-100">
              <div className="w-12 h-1.5 bg-white/80 rounded-full mx-auto absolute top-2.5 left-1/2 -translate-x-1/2 z-10 shadow sm:hidden" />
              {selectedItem.imageUrl && (
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.name}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() =>
                    setZoomImage({
                      url: selectedItem.imageUrl,
                      title: selectedItem.name,
                      price: selectedItem.price,
                      originalPrice: selectedItem.originalPrice,
                      description: selectedItem.description,
                    })
                  }
                />
              )}
              {selectedItem.originalPrice &&
                selectedItem.originalPrice > selectedItem.price && (
                  <span className="absolute top-3 left-3 bg-rose-600 text-white text-xs font-black px-2.5 py-1 rounded-xl shadow">
                    -%
                    {Math.round(
                      ((selectedItem.originalPrice - selectedItem.price) /
                        selectedItem.originalPrice) *
                        100
                    )}{" "}
                    İNDİRİM
                  </span>
                )}
              {selectedItem.imageUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setZoomImage({
                      url: selectedItem.imageUrl,
                      title: selectedItem.name,
                      price: selectedItem.price,
                      originalPrice: selectedItem.originalPrice,
                      description: selectedItem.description,
                    })
                  }
                  className="absolute bottom-3 right-3 px-2.5 py-1 rounded-xl bg-black/65 hover:bg-black/80 text-white text-xs font-bold shadow cursor-pointer"
                >
                  🔍 Fotoğrafı Büyüt
                </button>
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl font-bold text-slate-900">
                    {selectedItem.name}
                  </h3>
                  <div className="text-right whitespace-nowrap">
                    {selectedItem.originalPrice &&
                      selectedItem.originalPrice > selectedItem.price && (
                        <span className="text-xs text-slate-400 line-through font-semibold mr-1.5">
                          {selectedItem.originalPrice.toFixed(2)}{" "}
                          {settings?.currency}
                        </span>
                      )}
                    <span className="text-lg font-extrabold text-orange-600">
                      {selectedItem.price.toFixed(2)} {settings?.currency}
                    </span>
                  </div>
                </div>
                {(selectedItem.badges || []).filter((b) => BADGE_META[b])
                  .length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(selectedItem.badges || [])
                      .filter((b) => BADGE_META[b])
                      .map((bKey) => (
                        <span
                          key={bKey}
                          className={`inline-flex items-center text-[11px] font-extrabold px-2 py-0.5 rounded-lg border ${BADGE_META[bKey].cls}`}
                        >
                          {BADGE_META[bKey].label}
                        </span>
                      ))}
                  </div>
                )}
                <p className="text-sm text-slate-600 mt-1.5">
                  {selectedItem.description}
                </p>
              </div>

              {(selectedItem.modifierGroups || []).map((group) => {
                const subHeader = extractSubProductHeader(group.productTag);
                const isPortionGroup =
                  Boolean(group.productTag) ||
                  group.name.toLowerCase().includes("porsiyon") ||
                  group.name.toLowerCase().includes("çeşit");

                return (
                  <div
                    key={group.id}
                    className={`p-3.5 rounded-2xl border-2 space-y-3 ${
                      group.productTag
                        ? "bg-orange-50/40 border-orange-300"
                        : "bg-slate-50 border-slate-200/80"
                    }`}
                  >
                    {group.productTag && (
                      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-3.5 py-2 rounded-xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2">
                          {subHeader.stepBadge && (
                            <span className="bg-white text-orange-700 font-black text-xs px-2.5 py-0.5 rounded-lg shadow-2xs">
                              {subHeader.stepBadge}
                            </span>
                          )}
                          <span className="font-extrabold text-xs sm:text-sm">
                            {subHeader.cleanTitle || group.productTag}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold bg-black/25 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Ürün + Porsiyon + Ekstra
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                        {isPortionGroup ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                            🍽️ PORSİYON & ÇEŞİT
                          </span>
                        ) : group.name.toLowerCase().includes("çıkarılacak") ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            🚫 ÇIKARILACAK
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✨ EKSTRA
                          </span>
                        )}
                        <span>{group.name}</span>
                      </h4>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          group.required
                            ? "bg-orange-100 text-orange-800 border border-orange-200"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {group.required ? "Zorunlu Seçim" : "İsteğe Bağlı"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.options.map((opt) => {
                        const isChecked = (
                          chosenModifiers[group.id] || []
                        ).includes(opt.id);
                        const subKey = `${group.id}__${opt.id}`;
                        const chosenSubIds = chosenSubOptions[subKey] || [];
                        const splitOpt = isPortionGroup
                          ? splitOptionNameAndPortion(opt.name)
                          : { dishName: "", portionLabel: opt.name };

                        return (
                          <div key={opt.id} className="space-y-1.5">
                            <label
                              onClick={() =>
                                toggleModifierOption(
                                  group.id,
                                  opt.id,
                                  group.multiSelect
                                )
                              }
                              className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition ${
                                isChecked
                                  ? "border-orange-500 bg-white shadow-xs"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-start gap-2.5 pr-2">
                                <input
                                  type={group.multiSelect ? "checkbox" : "radio"}
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="w-4 h-4 accent-orange-600 mt-0.5"
                                />
                                <div className="space-y-1">
                                  {isPortionGroup ? (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {splitOpt.dishName && (
                                        <span className="text-sm font-extrabold text-slate-900">
                                          {splitOpt.dishName}
                                        </span>
                                      )}
                                      <span className="inline-flex items-center gap-1 text-xs font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-lg">
                                        🍽️ Porsiyon: {splitOpt.portionLabel}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-sm font-semibold text-slate-800 block">
                                      {opt.name}
                                    </span>
                                  )}

                                  {opt.subOptions &&
                                    opt.subOptions.length > 0 && (
                                      <span className="text-[11px] font-bold text-orange-700 block">
                                        👇 Seçildiğinde bu porsiyona özel{" "}
                                        {opt.subOptions.length} ekstra/tercih
                                        açılır
                                      </span>
                                    )}
                                </div>
                              </div>
                              {opt.price > 0 ? (
                                <span className="text-xs font-black text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg whitespace-nowrap">
                                  +{opt.price.toFixed(2)} {settings?.currency}
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                  Menüye Dahil
                                </span>
                              )}
                            </label>

                            {/* Seçilen Porsiyona Özel Ekstralar (subOptions) */}
                            {isChecked &&
                              opt.subOptions &&
                              opt.subOptions.length > 0 && (
                                <div className="ml-3 sm:ml-5 pl-3 border-l-4 border-orange-500 bg-white p-3 rounded-xl border border-orange-200 space-y-2 shadow-xs">
                                  <div className="flex items-center justify-between border-b border-orange-100 pb-1.5">
                                    <span className="text-xs font-black text-orange-800 flex items-center gap-1.5">
                                      <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-md">
                                        ✨ EKSTRALAR
                                      </span>
                                      <span>
                                        {splitOpt.dishName || splitOpt.portionLabel}{" "}
                                        İçin Ekstra & Tercihler:
                                      </span>
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-500">
                                      İsteğe Bağlı
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 gap-1.5">
                                    {opt.subOptions.map((subOpt) => {
                                      const subChecked = chosenSubIds.includes(
                                        subOpt.id
                                      );
                                      return (
                                        <label
                                          key={subOpt.id}
                                          onClick={() =>
                                            toggleSubOption(
                                              group.id,
                                              opt.id,
                                              subOpt.id
                                            )
                                          }
                                          className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                                            subChecked
                                              ? "border-orange-500 bg-orange-50 font-bold text-slate-900"
                                              : "border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300"
                                          }`}
                                        >
                                          <span className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={subChecked}
                                              onChange={() => {}}
                                              className="w-3.5 h-3.5 accent-orange-600 rounded"
                                            />
                                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                              + EKSTRA
                                            </span>
                                            <span>{subOpt.name}</span>
                                          </span>
                                          {subOpt.price > 0 ? (
                                            <span className="font-extrabold text-orange-700 whitespace-nowrap">
                                              +{subOpt.price.toFixed(2)}{" "}
                                              {settings?.currency}
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-emerald-700 font-bold whitespace-nowrap">
                                              Ücretsiz
                                            </span>
                                          )}
                                        </label>
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

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                  Ürün Notu (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  placeholder="Örn: Tuzu az olsun, sos ayrı pakette gelsin..."
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl"
                />
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-3">
              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50">
                <button
                  type="button"
                  onClick={() => setItemQuantity((q) => Math.max(1, q - 1))}
                  className="p-3 text-slate-700 hover:text-orange-600"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-3 font-bold text-slate-900">
                  {itemQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setItemQuantity((q) => q + 1)}
                  className="p-3 text-slate-700 hover:text-orange-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-between transition shadow-md"
              >
                <span>Sepete Ekle</span>
                <span>
                  {(modalUnitPrice * itemQuantity).toFixed(2)}{" "}
                  {settings?.currency}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎨 3 AÇIK + 3 KAPALI TEMA SEÇİCİ MODALI */}
      {themeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    Görünüm & Tema Seçimi (3 Açık • 3 Kapalı)
                  </h3>
                  <p className="text-xs text-slate-300">
                    Göz zevkinize uygun açık veya koyu temayı tek tıkla seçin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setThemeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* 3 AÇIK TEMA */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>☀️ Açık Temalar (3 Seçenek)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STOREFRONT_THEMES.filter((t) => t.mode === "light").map(
                    (theme) => {
                      const isSelected = activeTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => handleSelectTheme(theme.id)}
                          className={`text-left p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-3 ${
                            isSelected
                              ? "border-orange-500 ring-2 ring-orange-500/20 shadow-md"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                          style={{ backgroundColor: theme.previewBg }}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: theme.previewAccent }}
                              >
                                {theme.badge}
                              </span>
                              {isSelected && (
                                <CheckCircle2
                                  className="w-4 h-4 flex-shrink-0"
                                  style={{ color: theme.previewAccent }}
                                />
                              )}
                            </div>
                            <div
                              className="font-extrabold text-sm"
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

                          {/* Renk Paleti Önizleme Çubuğu */}
                          <div
                            className="p-2 rounded-xl border flex items-center justify-between"
                            style={{
                              backgroundColor: theme.previewCard,
                              borderColor: "rgba(0,0,0,0.08)",
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-4 h-4 rounded-full border border-black/10"
                                style={{ backgroundColor: theme.previewBg }}
                              />
                              <span
                                className="w-4 h-4 rounded-full border border-black/10"
                                style={{ backgroundColor: theme.previewCard }}
                              />
                              <span
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: theme.previewAccent }}
                              />
                            </div>
                            <span
                              className="text-[10px] font-extrabold"
                              style={{ color: theme.previewAccent }}
                            >
                              {isSelected ? "✓ Aktif" : "Seç"}
                            </span>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 3 KAPALI (KOYU) TEMA */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span>🌙 Kapalı / Koyu Temalar (3 Seçenek)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STOREFRONT_THEMES.filter((t) => t.mode === "dark").map(
                    (theme) => {
                      const isSelected = activeTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => handleSelectTheme(theme.id)}
                          className={`text-left p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between gap-3 ${
                            isSelected
                              ? "border-orange-500 ring-2 ring-orange-500/30 shadow-lg"
                              : "border-slate-700 hover:border-slate-500"
                          }`}
                          style={{ backgroundColor: theme.previewBg }}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white"
                                style={{ backgroundColor: theme.previewAccent }}
                              >
                                {theme.badge}
                              </span>
                              {isSelected && (
                                <CheckCircle2
                                  className="w-4 h-4 flex-shrink-0"
                                  style={{ color: theme.previewAccent }}
                                />
                              )}
                            </div>
                            <div
                              className="font-extrabold text-sm"
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

                          {/* Renk Paleti Önizleme Çubuğu */}
                          <div
                            className="p-2 rounded-xl border flex items-center justify-between"
                            style={{
                              backgroundColor: theme.previewCard,
                              borderColor: "rgba(255,255,255,0.12)",
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-4 h-4 rounded-full border border-white/20"
                                style={{ backgroundColor: theme.previewBg }}
                              />
                              <span
                                className="w-4 h-4 rounded-full border border-white/20"
                                style={{ backgroundColor: theme.previewCard }}
                              />
                              <span
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: theme.previewAccent }}
                              />
                            </div>
                            <span
                              className="text-[10px] font-extrabold"
                              style={{ color: theme.previewAccent }}
                            >
                              {isSelected ? "✓ Aktif" : "Seç"}
                            </span>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">
                Seçili Tema:{" "}
                <strong className="text-slate-900">
                  {getThemeDefinition(activeTheme).name}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setThemeModalOpen(false)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderUserAuthBadge() {
    if (currentUser) {
      return (
        <button
          type="button"
          onClick={() => {
            fetchUserProfileAndOrders(currentUser.phone);
            setAccountTab(
              activeUserOrders.length > 0 ? "active_orders" : "addresses"
            );
            setAccountModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition"
        >
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <div className="text-left">
            <div className="text-xs font-bold text-slate-900 leading-none flex items-center gap-1.5">
              <span>{currentUser.name}</span>
              {isLoyaltyEnabled && (
                <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  🎁 {(currentUser.loyaltyPoints || 0).toFixed(0)}{" "}
                  {settings?.currency}
                </span>
              )}
              {activeUserOrders.length > 0 && (
                <span className="bg-orange-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                  {activeUserOrders.length} Aktif
                </span>
              )}
            </div>
            <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
              Siparişlerim & Adreslerim
            </div>
          </div>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          setAuthStep("phone");
          setAuthError("");
          setAuthModalOpen(true);
        }}
        className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs"
      >
        <MessageCircle className="w-4 h-4" />
        <span>WhatsApp ile Giriş / Üye Ol</span>
      </button>
    );
  }

  function renderCartAndCheckout() {
    if (cart.length === 0) {
      return (
        <div className="p-6 text-center space-y-2.5">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <p className="font-semibold text-sm text-slate-700">
            Sepetiniz henüz boş
          </p>
          <p className="text-xs text-slate-500">
            Sol taraftaki menüden dilediğiniz lezzetleri seçerek hemen sipariş
            verebilirsiniz.
          </p>
          {currentUser && pastUserOrders.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setAccountTab("past_orders");
                setAccountModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:underline pt-1"
            >
              <History className="w-3.5 h-3.5" />
              Geçmiş Siparişlerimden Tekrarla ({pastUserOrders.length})
            </button>
          )}
        </div>
      );
    }

    if (checkoutStep === "cart") {
      // 🎯 Minimum Paket Tutarı & İndirim Kuponu Hedefi Canlı İlerleme Hesabı
      const nextCouponGoal =
        appliedCoupon && subtotal < appliedCoupon.minOrderAmount
          ? appliedCoupon
          : !appliedCoupon
          ? activeCoupons
              .filter((c) => c.minOrderAmount > subtotal)
              .sort((a, b) => a.minOrderAmount - b.minOrderAmount)[0] || null
          : null;

      const needsMinDelivery =
        orderType === "delivery" &&
        currentMinDeliveryAmount > 0 &&
        subtotal < currentMinDeliveryAmount;

      const progressPct = needsMinDelivery
        ? Math.min(100, Math.round((subtotal / currentMinDeliveryAmount) * 100))
        : nextCouponGoal
        ? Math.min(
            100,
            Math.round((subtotal / nextCouponGoal.minOrderAmount) * 100)
          )
        : 100;

      return (
        <div className="p-4 space-y-4">
          {/* 🎯 Canlı Minimum Paket Tutarı / Kupon Hedefi Doluluk Çubuğu */}
          {(orderType === "delivery" || nextCouponGoal) && (
            <div
              className={`rounded-xl p-2.5 border text-xs space-y-1.5 ${
                needsMinDelivery
                  ? "bg-amber-50/80 border-amber-200 text-amber-900"
                  : nextCouponGoal
                  ? "bg-indigo-50/70 border-indigo-200 text-indigo-900"
                  : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-bold text-[11px]">
                {needsMinDelivery ? (
                  <span>
                    🛵 Bölge min. paket tutarına{" "}
                    <strong className="text-orange-700">
                      {(currentMinDeliveryAmount - subtotal).toFixed(0)}{" "}
                      {settings?.currency}
                    </strong>{" "}
                    kaldı
                  </span>
                ) : nextCouponGoal ? (
                  <span>
                    🎁{" "}
                    <strong className="text-indigo-700">
                      {(nextCouponGoal.minOrderAmount - subtotal).toFixed(0)}{" "}
                      {settings?.currency}
                    </strong>{" "}
                    daha ekleyin,{" "}
                    <strong>{nextCouponGoal.code}</strong> kuponunu kullanın!
                  </span>
                ) : (
                  <span>
                    ✅ Minimum paket sınırını geçtiniz! Hemen sipariş verebilirsiniz.
                  </span>
                )}
                <span className="font-black">%{progressPct}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    needsMinDelivery
                      ? "bg-orange-500"
                      : nextCouponGoal
                      ? "bg-indigo-600"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto pr-1">
            {cart.map((item) => {
              const structuredBlocks = parseStructuredModifiers(
                item.selectedModifiers
              );
              return (
                <div
                  key={item.id}
                  className="py-3 first:pt-0 last:pb-0 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm text-slate-900">
                      {item.name}
                    </div>
                    <div className="font-extrabold text-sm text-slate-900 whitespace-nowrap">
                      {item.totalPrice.toFixed(2)} {settings?.currency}
                    </div>
                  </div>

                  {structuredBlocks.length > 0 && (
                    <div className="space-y-2 pt-0.5">
                      {structuredBlocks.map((block, bIdx) => (
                        <div
                          key={bIdx}
                          className={`rounded-xl p-2.5 text-xs space-y-1.5 border ${
                            block.stepBadge
                              ? "bg-orange-50/50 border-orange-200"
                              : "bg-slate-50 border-slate-200/80"
                          }`}
                        >
                          {/* 1. ÜRÜN / 2. ÜRÜN / 3. ÜRÜN Başlığı */}
                          {(block.stepBadge || block.productTitle) && (
                            <div className="flex items-center gap-1.5 pb-1 border-b border-orange-200/60">
                              {block.stepBadge && (
                                <span className="bg-orange-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md">
                                  {block.stepBadge}
                                </span>
                              )}
                              {block.productTitle && (
                                <span className="font-extrabold text-slate-900 text-xs">
                                  {block.productTitle}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Seçilen Alt Ürün Çeşidi */}
                          {block.chosenDishName && (
                            <div className="flex items-center gap-1.5 text-slate-800">
                              <span className="font-black text-[10px] uppercase bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                ÜRÜN:
                              </span>
                              <span className="font-bold">
                                {block.chosenDishName}
                              </span>
                            </div>
                          )}

                          {/* Seçilen Porsiyon */}
                          {block.portionLabel && (
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-[10px] uppercase bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded">
                                  🍽️ PORSİYON:
                                </span>
                                <span className="font-extrabold text-indigo-950">
                                  {block.portionLabel}
                                </span>
                              </div>
                              {block.portionPrice > 0 && (
                                <span className="font-bold text-orange-700 text-[11px] whitespace-nowrap">
                                  +{block.portionPrice} {settings?.currency}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Seçilen Ekstralar */}
                          {block.extras.length > 0 && (
                            <div className="pt-1 border-t border-slate-200/60 space-y-1">
                              <div className="text-[10px] font-black uppercase text-emerald-800 flex items-center gap-1">
                                <span>✨ EKSTRALAR & TERCİHLER:</span>
                              </div>
                              <div className="space-y-0.5 pl-1.5">
                                {block.extras.map((ex, eIdx) => (
                                  <div
                                    key={eIdx}
                                    className="flex items-center justify-between text-[11px] text-slate-700"
                                  >
                                    <span className="font-medium">
                                      + {ex.name}
                                    </span>
                                    {ex.price > 0 && (
                                      <span className="font-bold text-emerald-700 whitespace-nowrap">
                                        +{ex.price} {settings?.currency}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Çıkarılacak Malzemeler */}
                          {block.removals.length > 0 && (
                            <div className="pt-1 border-t border-slate-200/60 space-y-0.5">
                              {block.removals.map((rem, rIdx) => (
                                <div
                                  key={rIdx}
                                  className="text-[11px] font-bold text-rose-700"
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
                    <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                      📝 Not: {item.itemNote}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">
                      Birim: {item.unitPrice.toFixed(2)} {settings?.currency}
                    </span>
                    <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, -1)}
                        className="p-1 text-slate-600 hover:text-red-600"
                      >
                        {item.quantity === 1 ? (
                          <Trash2 className="w-3.5 h-3.5" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="text-xs font-bold w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, 1)}
                        className="p-1 text-slate-600 hover:text-orange-600"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* SEPETTE "YANINA İYİ GİDER" (UPSELL) ÖNERİLERİ */}
          {upsellSuggestions.length > 0 && (
            <div className="bg-orange-50/60 border border-orange-200/80 rounded-xl p-3 space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-orange-700 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Yanına İyi Gider (Tek Tıkla
                Ekle)
              </div>
              <div className="space-y-1.5">
                {upsellSuggestions.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-orange-100 text-xs"
                  >
                    <span className="font-semibold text-slate-800 truncate pr-2">
                      {u.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuickAddUpsell(u)}
                      className="inline-flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white font-bold px-2 py-1 rounded-md whitespace-nowrap transition"
                    >
                      <Plus className="w-3 h-3" /> {u.price} {settings?.currency}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* İndirim Kuponu Kodu Alanı */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="İndirim Kuponu (Örn: MERHABA50)"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl uppercase font-semibold"
                />
              </div>
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput("");
                    setCouponMessage(null);
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600 rounded-xl"
                >
                  Kaldır
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleApplyCouponCode()}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
                >
                  Uygula
                </button>
              )}
            </div>
            {couponMessage && (
              <p
                className={`text-[11px] font-semibold ${
                  couponMessage.type === "success"
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {couponMessage.text}
              </p>
            )}
          </div>

          {/* 🎁 İsteğe Bağlı Müşteri Sadakat & Para Puan Harcama Kutusu */}
          {isLoyaltyEnabled && currentUser && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-900 flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-amber-600" />
                  Para Puan Cüzdanınız:
                </span>
                <span className="font-black text-amber-800">
                  {availableUserPoints.toFixed(2)} {settings?.currency}
                </span>
              </div>
              {canRedeemPoints ? (
                <label className="flex items-center gap-2 pt-1 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={useLoyaltyPoints}
                    onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <span>
                    Biriken Para Puanımı Bu Siparişte Kullan (-
                    {Math.min(
                      availableUserPoints,
                      baseTotalBeforeLoyalty
                    ).toFixed(2)}{" "}
                    {settings?.currency})
                  </span>
                </label>
              ) : (
                <p className="text-[11px] text-amber-700">
                  Puanlarınızı harcayabilmek için en az {minRedeemPoints}{" "}
                  {settings?.currency} puanınız olmalıdır.
                </p>
              )}
              {estimatedPointsToEarn > 0 && (
                <div className="text-[11px] font-bold text-emerald-700 pt-0.5">
                  ✨ Bu siparişten +{estimatedPointsToEarn.toFixed(2)}{" "}
                  {settings?.currency} Para Puan kazanacaksınız!
                </div>
              )}
            </div>
          )}

          {/* 💚 İsteğe Bağlı Kurye / Garson Bahşişi & 👥 Alman Usulü Hesap Bölücü */}
          <div className="border-t border-slate-200 pt-2.5 space-y-2">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                <span>
                  💚 {orderType === "dine_in" ? "Garson" : "Kurye"} Bahşişi (İsteğe Bağlı)
                </span>
                {calculatedTipAmount > 0 && (
                  <span className="text-emerald-700 font-extrabold">
                    +{calculatedTipAmount.toFixed(2)} {settings?.currency}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-6 gap-1">
                {(
                  [
                    { id: "none", label: "Yok" },
                    { id: "20", label: "+20₺" },
                    { id: "30", label: "+30₺" },
                    { id: "50", label: "+50₺" },
                    { id: "pct5", label: "+%5" },
                    { id: "pct10", label: "+%10" },
                  ] as const
                ).map((tp) => (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => setSelectedTipPreset(tp.id)}
                    className={`py-1 rounded-lg text-[10px] font-extrabold border transition cursor-pointer ${
                      selectedTipPreset === tp.id
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {tp.label}
                  </button>
                ))}
              </div>
            </div>

            {orderType === "dine_in" && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-700">
                    👥 Hesabı Böl (Alman Usulü):
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setSplitPeopleCount(cnt)}
                        className={`w-6 h-6 rounded-md text-[10px] font-extrabold border transition cursor-pointer ${
                          splitPeopleCount === cnt
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {cnt === 1 ? "Tek" : `${cnt}K`}
                      </button>
                    ))}
                  </div>
                </div>
                {splitPeopleCount > 1 && (
                  <div className="flex items-center justify-between text-xs font-extrabold text-indigo-800 bg-indigo-50/80 border border-indigo-200/70 rounded-lg px-2.5 py-1">
                    <span>👥 Kişi Başı ({splitPeopleCount} Kişi):</span>
                    <span>
                      {(totalAmount / splitPeopleCount).toFixed(2)} {settings?.currency}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tutar Özeti */}
          <div className="border-t border-slate-200 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Ara Toplam</span>
              <span>
                {subtotal.toFixed(2)} {settings?.currency}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>{activePriceAdjustment.label}</span>
                <span>
                  -{discountAmount.toFixed(2)} {settings?.currency}
                </span>
              </div>
            )}
            {surchargeAmount > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>{activePriceAdjustment.label}</span>
                <span>
                  +{surchargeAmount.toFixed(2)} {settings?.currency}
                </span>
              </div>
            )}
            {calculatedTipAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>
                  💚 {orderType === "dine_in" ? "Garson" : "Kurye"} Bahşişi
                </span>
                <span>
                  +{calculatedTipAmount.toFixed(2)} {settings?.currency}
                </span>
              </div>
            )}
            {loyaltyPointsToUse > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>🎁 Cüzdan Para Puan İndirimi</span>
                <span>
                  -{loyaltyPointsToUse.toFixed(2)} {settings?.currency}
                </span>
              </div>
            )}
            {orderType === "delivery" && (
              <div className="flex justify-between text-slate-600">
                <span>
                  Getirme Ücreti ({selectedZone?.name.split("/")[0] || "Bölge"})
                </span>
                <span>
                  {deliveryFee === 0
                    ? "Ücretsiz"
                    : `${deliveryFee.toFixed(2)} ${settings?.currency}`}
                </span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base text-slate-900 pt-1 border-t border-slate-100">
              <span>Toplam</span>
              <span className="text-orange-600">
                {totalAmount.toFixed(2)} {settings?.currency}
              </span>
            </div>
          </div>

          {orderType === "delivery" && subtotal < currentMinDeliveryAmount && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>{selectedZone?.name || "Bu bölge"}</strong> için
                sepetinize{" "}
                <strong>
                  {(currentMinDeliveryAmount - subtotal).toFixed(2)}{" "}
                  {settings?.currency}
                </strong>{" "}
                daha ürün eklemelisiniz.
              </span>
            </div>
          )}

          {isAuthRequiredForCurrentOrder && !currentUser ? (
            <button
              type="button"
              disabled={
                orderType === "delivery" && subtotal < currentMinDeliveryAmount
              }
              onClick={handleProceedToCheckout}
              className="w-full bg-[#25D366] hover:bg-[#20bd5a] disabled:bg-slate-300 text-slate-950 font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
            >
              <MessageCircle className="w-5 h-5" />
              <span>WhatsApp ile Doğrula & Devam Et</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={
                orderType === "delivery" && subtotal < currentMinDeliveryAmount
              }
              onClick={handleProceedToCheckout}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
            >
              <span>Siparişi Tamamla</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      );
    }

    // Checkout Form Adımı
    return (
      <form onSubmit={handleSubmitOrder} className="p-4 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
            Teslimat & Ödeme Bilgileri
          </span>
          <button
            type="button"
            onClick={() => setCheckoutStep("cart")}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            ← Sepete Dön
          </button>
        </div>

        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-xl text-xs font-medium">
            {formError}
          </div>
        )}

        {/* 2. ÖZELLİK: İLERİ SAATLİ SİPARİŞ (HEMEN VEYA İLERİ SAAT SEÇİMİ) */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
          <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <span>Teslimat / Hazırlanma Zamanı</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeliveryTiming("asap")}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition ${
                deliveryTiming === "asap"
                  ? "bg-orange-600 text-white border-orange-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              🚀 Hemen (~{settings?.estimatedPrepMinutes || 25} dk)
            </button>
            <button
              type="button"
              onClick={() => setDeliveryTiming("scheduled")}
              className={`py-2 px-2.5 rounded-lg text-xs font-bold border transition ${
                deliveryTiming === "scheduled"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              ⏰ İleri Saat Seç
            </button>
          </div>

          {deliveryTiming === "scheduled" && (
            <div className="pt-1">
              <label className="block text-[11px] font-bold text-indigo-800 mb-1">
                Bugün Hangi Saatte Hazır / Teslim Olsun?
              </label>
              <select
                value={scheduledTimeSlot}
                onChange={(e) => setScheduledTimeSlot(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-indigo-300 rounded-lg bg-white text-slate-900"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    Bugün Saat {slot}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {orderType === "delivery" && activeZones.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Teslimat Bölgesi / Mahalle *
            </label>
            <select
              value={selectedZone?.id || ""}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50"
            >
              {activeZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} (Min: {z.minAmount} {settings?.currency})
                </option>
              ))}
            </select>
          </div>
        )}

        {orderType === "dine_in" && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Masa Seçimi *
            </label>
            <select
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white font-semibold"
              required
            >
              <option value="">Masa Seçiniz...</option>
              {getRestaurantTables(settings).map((t) => (
                <option key={t} value={t}>
                  {formatTableLabel(t)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Adınız Soyadınız *
          </label>
          <input
            type="text"
            required
            placeholder="Örn: Ahmet Yılmaz"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
          />
        </div>

        {orderType === "delivery" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="block text-xs font-bold text-slate-700">
                Teslimat Adresiniz *
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={locatingGpsTarget === "checkout"}
                  onClick={() => handleDetectGpsLocation("checkout")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[11px] font-bold shadow-sm transition cursor-pointer"
                >
                  {locatingGpsTarget === "checkout" ? (
                    <>⏳ Konum Alınıyor...</>
                  ) : (
                    <>📍 GPS ile Konumumu Bul</>
                  )}
                </button>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountTab("addresses");
                      setAccountModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-orange-600 hover:underline px-1.5 py-1"
                  >
                    + Adres Defteri
                  </button>
                )}
              </div>
            </div>

            {gpsFeedback && (
              <div className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between gap-2">
                <span>{gpsFeedback}</span>
                {checkoutCoords && (
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded shrink-0">
                    🎯 Pin Aktif
                  </span>
                )}
              </div>
            )}

            {autoMatchedZoneHint && (
              <div className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
                {autoMatchedZoneHint}
              </div>
            )}

            {currentUser && currentUser.addresses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentUser.addresses.map((addr) => {
                  const isSelected = customerAddress.trim() === addr.fullAddress.trim();
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => handleSelectSavedAddress(addr)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
                        isSelected
                          ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                          : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      <span>{addr.isDefault ? "⭐" : "📍"}</span>
                      <span>{addr.title}</span>
                      {typeof addr.lat === "number" && typeof addr.lng === "number" && (
                        <span
                          className={`text-[9px] px-1 rounded ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                          title="GPS Konum Pinli"
                        >
                          🎯
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <textarea
              rows={2}
              required
              placeholder="Mahalle, Cadde, Sokak ve Apartman Adı..."
              value={customerAddress}
              onChange={(e) => {
                setCustomerAddress(e.target.value);
                autoMatchDeliveryZoneFromText(e.target.value, "checkout");
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
            />

            {/* Yapılandırılmış Bina / Kat / Daire / Tarif Alanları (Yeni adres girilirken veya detay eklenirken) */}
            {(!currentUser ||
              !currentUser.addresses.some(
                (a) => a.fullAddress.trim().toLowerCase() === customerAddress.trim().toLowerCase()
              )) && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Bina / Kapı No
                    </label>
                    <input
                      type="text"
                      placeholder="No: 14"
                      value={checkoutBuildingNo}
                      onChange={(e) => setCheckoutBuildingNo(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Kat
                    </label>
                    <input
                      type="text"
                      placeholder="Kat: 3"
                      value={checkoutFloor}
                      onChange={(e) => setCheckoutFloor(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                      Daire No
                    </label>
                    <input
                      type="text"
                      placeholder="Daire: 8"
                      value={checkoutApartmentNo}
                      onChange={(e) => setCheckoutApartmentNo(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="🧭 Kurye İçin Yol Tarifi / Zil Notu (Örn: Köşedeki marketin üstü)"
                    value={checkoutDirections}
                    onChange={(e) => setCheckoutDirections(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  />
                </div>

                {currentUser && customerAddress.trim().length > 3 && (
                  <div className="pt-1 border-t border-slate-200/70 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={saveCheckoutAddressToBook}
                        onChange={(e) => setSaveCheckoutAddressToBook(e.target.checked)}
                        className="w-3.5 h-3.5 accent-orange-600 rounded"
                      />
                      <span className="text-[11px] font-bold text-slate-700">
                        Bu adresi sonraki siparişlerim için Adres Defterime kaydet
                      </span>
                    </label>

                    {saveCheckoutAddressToBook && (
                      <div className="flex items-center gap-1.5 flex-wrap pl-5">
                        <span className="text-[10px] font-semibold text-slate-500">
                          Başlık:
                        </span>
                        {[
                          { label: "🏠 Evim", value: "Evim" },
                          { label: "🏢 İş Yerim", value: "İş Yerim" },
                          { label: "🎓 Kampüs", value: "Kampüs / Yurt" },
                          { label: "❤️ Ailem", value: "Ailem" },
                        ].map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setCheckoutAddressTitle(preset.value)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                              checkoutAddressTitle === preset.value
                                ? "bg-orange-600 text-white border-orange-600"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <input
                          type="text"
                          placeholder="Başlık..."
                          value={checkoutAddressTitle}
                          onChange={(e) => setCheckoutAddressTitle(e.target.value)}
                          className="px-2 py-0.5 text-[11px] border border-slate-200 rounded-md bg-white w-24 font-semibold"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Ödeme Yöntemi
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white"
          >
            {orderType === "dine_in" ? (
              <>
                <option value="pos_at_table">Masada Nakit / Kredi Kartı</option>
                <option value="cash">Kasada Ödeme</option>
              </>
            ) : (
              <>
                <option value="card_at_door">
                  Kapıda / Teslimatta Kredi Kartı (POS)
                </option>
                <option value="cash">Kapıda / Teslimatta Nakit</option>
              </>
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Hızlı Teslimat & Servis Tercihleri (Tek Dokunuş)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              ...(orderType === "delivery"
                ? [
                    "🔕 Zile Basmayın (Bebek Uyuyor)",
                    "🚪 Kapıya Bırakın (Temassız)",
                    "📞 Gelince Telefonla Arayın",
                  ]
                : []),
              "🌿 Plastik Çatal/Servis İstemiyorum",
              "🌶️ Turşu / Baharat Bol Olsun",
            ].map((pref) => {
              const isSelected = selectedQuickPrefs.includes(pref);
              return (
                <button
                  key={pref}
                  type="button"
                  onClick={() =>
                    setSelectedQuickPrefs((prev) =>
                      prev.includes(pref)
                        ? prev.filter((p) => p !== pref)
                        : [...prev, pref]
                    )
                  }
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    isSelected
                      ? "bg-orange-600 text-white border-orange-600 shadow-xs"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {isSelected ? `✓ ${pref}` : pref}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            placeholder="Ek Sipariş Notu (Örn: Soğansız olsun, 2. zili çalın vb.)"
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
          />
        </div>

        {/* 💚 Kurye / Garson Bahşişi Seçimi */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span>
              💚 {orderType === "dine_in" ? "Garson" : "Kurye"} Bahşişi (İsteğe Bağlı)
            </span>
            {calculatedTipAmount > 0 && (
              <span className="text-emerald-700 font-extrabold">
                +{calculatedTipAmount.toFixed(2)} {settings?.currency}
              </span>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1">
            {(
              [
                { id: "none", label: "Yok" },
                { id: "20", label: "+20₺" },
                { id: "30", label: "+30₺" },
                { id: "50", label: "+50₺" },
                { id: "pct5", label: "+%5" },
                { id: "pct10", label: "+%10" },
              ] as const
            ).map((tp) => (
              <button
                key={tp.id}
                type="button"
                onClick={() => setSelectedTipPreset(tp.id)}
                className={`py-1 rounded-lg text-[10px] font-extrabold border transition cursor-pointer ${
                  selectedTipPreset === tp.id
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {tp.label}
              </button>
            ))}
          </div>
        </div>

        {canRedeemPoints && (
          <label className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-xs font-bold text-amber-900 cursor-pointer">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={useLoyaltyPoints}
                onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                className="w-4 h-4 accent-amber-600 rounded"
              />
              <span>🎁 Cüzdanımdaki Para Puanı Kullan</span>
            </span>
            <span className="font-black text-amber-800">
              -{Math.min(availableUserPoints, baseTotalBeforeLoyalty).toFixed(2)}{" "}
              {settings?.currency}
            </span>
          </label>
        )}

        <div className="pt-2 border-t border-slate-100 space-y-1">
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-xs font-bold text-emerald-600">
              <span>{activePriceAdjustment.label}:</span>
              <span>
                -{discountAmount.toFixed(2)} {settings?.currency}
              </span>
            </div>
          )}
          {surchargeAmount > 0 && (
            <div className="flex items-center justify-between text-xs font-bold text-rose-600">
              <span>{activePriceAdjustment.label}:</span>
              <span>
                +{surchargeAmount.toFixed(2)} {settings?.currency}
              </span>
            </div>
          )}
          {calculatedTipAmount > 0 && (
            <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
              <span>
                💚 {orderType === "dine_in" ? "Garson" : "Kurye"} Bahşişi:
              </span>
              <span>
                +{calculatedTipAmount.toFixed(2)} {settings?.currency}
              </span>
            </div>
          )}
          {loyaltyPointsToUse > 0 && (
            <div className="flex items-center justify-between text-xs font-bold text-amber-700">
              <span>Kullanılan Para Puan:</span>
              <span>
                -{loyaltyPointsToUse.toFixed(2)} {settings?.currency}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between font-extrabold text-base">
            <span>Ödenecek Tutar</span>
            <span className="text-orange-600">
              {totalAmount.toFixed(2)} {settings?.currency}
            </span>
          </div>
          {orderType === "dine_in" && splitPeopleCount > 1 && (
            <div className="flex items-center justify-between text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
              <span>👥 Kişi Başı ({splitPeopleCount} Kişi):</span>
              <span>
                {(totalAmount / splitPeopleCount).toFixed(2)} {settings?.currency}
              </span>
            </div>
          )}
          {isLoyaltyEnabled && estimatedPointsToEarn > 0 && (
            <div className="text-[11px] font-bold text-emerald-700 text-right">
              🎁 Bu siparişten +{estimatedPointsToEarn.toFixed(2)}{" "}
              {settings?.currency} Para Puan kazanacaksınız
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>{submitting ? "Gönderiliyor..." : "Siparişi Onayla"}</span>
        </button>
      </form>
    );
  }
}

export default function CustomerOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          Yükleniyor...
        </div>
      }
    >
      <CustomerMenuContent />
    </Suspense>
  );
}
