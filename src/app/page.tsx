"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  Suspense,
  useCallback,
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
  const tableParam = rawTableParam
    ? rawTableParam.replace(/^masa[-_\s]*/i, "").trim()
    : null;
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
  const [authPhone, setAuthPhone] = useState("");
  const [authName, setAuthName] = useState("");
  const [authOtpCode, setAuthOtpCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isExistingAccount, setIsExistingAccount] = useState(false);

  // Müşteri Hesabım Modalı
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<
    "active_orders" | "past_orders" | "addresses"
  >("active_orders");
  const [newAddressTitle, setNewAddressTitle] = useState("");
  const [newAddressZoneId, setNewAddressZoneId] = useState("");
  const [newAddressFull, setNewAddressFull] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);

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
  const [orderNote, setOrderNote] = useState("");
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

  // Masa Garson Çağır / Hesap İste Bildirimi
  const [tableCallSending, setTableCallSending] = useState(false);
  const [tableCallToast, setTableCallToast] = useState<string>("");

  // 3 Açık + 3 Kapalı Tema Yönetimi
  const [activeTheme, setActiveTheme] = useState<ThemeId>("light-classic");
  const [themeModalOpen, setThemeModalOpen] = useState(false);

  const handleSelectTheme = (themeId: ThemeId) => {
    setActiveTheme(themeId);
    applyThemeToDocument(themeId);
    try {
      localStorage.setItem("restoran_selected_theme", themeId);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (tableParam) {
      setOrderType("dine_in");
      setTableNumber(tableParam);
      setPaymentMethod("pos_at_table");
    }
  }, [tableParam]);

  const fetchUserProfileAndOrders = useCallback(async (phone: string) => {
    if (!phone) return;
    try {
      const [profRes, resvRes] = await Promise.all([
        fetch(`/api/auth/profile?phone=${encodeURIComponent(phone)}`),
        fetch(`/api/reservations?phone=${encodeURIComponent(phone)}`),
      ]);
      if (profRes.ok) {
        const data = await profRes.json();
        if (data.user) {
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
  }, []);

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
          setCustomerAddress(parsed.addresses[0].fullAddress);
          if (parsed.addresses[0].zoneId) {
            setSelectedZoneId(parsed.addresses[0].zoneId);
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
      categories.length > 0 &&
      !categories.some((c) => c.id === activeCategory)
    ) {
      setActiveCategory("all");
    }
  }, [activeCategory, categories]);

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
          setCustomerAddress(user.addresses[0].fullAddress);
          if (user.addresses[0].zoneId) {
            setSelectedZoneId(user.addresses[0].zoneId);
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
    setAccountModalOpen(false);
  };

  const handleAddNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newAddressFull.trim()) return;
    setSavingAddress(true);

    const zoneObj = activeZones.find((z) => z.id === newAddressZoneId);
    const newAddr: SavedAddress = {
      id: `addr-${Date.now()}`,
      title: newAddressTitle.trim() || "Ev / İş Adresim",
      zoneId: zoneObj?.id,
      zoneName: zoneObj?.name,
      fullAddress: newAddressFull.trim(),
    };

    const updatedAddresses = [newAddr, ...(currentUser.addresses || [])];

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
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        localStorage.setItem(
          "restoran_customer_user",
          JSON.stringify(data.user)
        );
        setCustomerAddress(newAddr.fullAddress);
        if (newAddr.zoneId) setSelectedZoneId(newAddr.zoneId);
        setNewAddressTitle("");
        setNewAddressFull("");
      }
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    if (!currentUser) return;
    const updatedAddresses = currentUser.addresses.filter(
      (a) => a.id !== addrId
    );
    const res = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: currentUser.phone,
        name: currentUser.name,
        addresses: updatedAddresses,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data.user);
      localStorage.setItem(
        "restoran_customer_user",
        JSON.stringify(data.user)
      );
      if (data.user.addresses.length > 0) {
        setCustomerAddress(data.user.addresses[0].fullAddress);
      }
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

  // Kupon veya İlk Sipariş İndirimi Hesaplama
  const isFirstOrderEligible = useMemo(() => {
    return (
      Boolean(currentUser) &&
      customerOrders.length === 0 &&
      (settings?.firstOrderDiscountPercent || 0) > 0
    );
  }, [currentUser, customerOrders.length, settings?.firstOrderDiscountPercent]);

  const discountAmount = useMemo(() => {
    if (cart.length === 0) return 0;
    if (appliedCoupon) {
      if (subtotal < appliedCoupon.minOrderAmount) return 0;
      const isPct =
        appliedCoupon.discountType === "percentage" ||
        (appliedCoupon.discountType as string) === "percent";
      if (isPct) {
        return Math.round((subtotal * appliedCoupon.discountValue) / 100);
      }
      return Math.min(subtotal, appliedCoupon.discountValue);
    }
    if (isFirstOrderEligible) {
      const pct = settings?.firstOrderDiscountPercent || 0;
      return Math.round((subtotal * pct) / 100);
    }
    return 0;
  }, [
    cart.length,
    appliedCoupon,
    subtotal,
    isFirstOrderEligible,
    settings?.firstOrderDiscountPercent,
  ]);

  const baseTotalBeforeLoyalty =
    Math.max(0, subtotal - discountAmount) + deliveryFee;

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
    return Math.min(availableUserPoints, baseTotalBeforeLoyalty);
  }, [canRedeemPoints, useLoyaltyPoints, availableUserPoints, baseTotalBeforeLoyalty]);

  const totalAmount = Math.max(0, baseTotalBeforeLoyalty - loyaltyPointsToUse);

  const estimatedPointsToEarn = useMemo(() => {
    if (!isLoyaltyEnabled) return 0;
    const pct = Number(settings?.loyaltyConfig?.earnPercent || 0);
    if (pct <= 0) return 0;
    return Math.round(((totalAmount * pct) / 100) * 100) / 100;
  }, [isLoyaltyEnabled, settings?.loyaltyConfig?.earnPercent, totalAmount]);

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
        activeCategory === "all" || item.categoryId === activeCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [items, activeCategory, searchQuery]);

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

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          tableNumber: orderType === "dine_in" ? tableNumber : undefined,
          userId: currentUser?.id,
          customerName,
          customerPhone:
            currentUser?.phone || customerPhone || "Masadan Sipariş",
          customerAddress:
            orderType === "delivery"
              ? `${selectedZone ? `[${selectedZone.name}] ` : ""}${customerAddress}`
              : undefined,
          deliveryZoneId:
            orderType === "delivery" ? selectedZone?.id : undefined,
          deliveryZoneName:
            orderType === "delivery" ? selectedZone?.name : undefined,
          scheduledTime:
            deliveryTiming === "scheduled"
              ? `Bugün ${scheduledTimeSlot}`
              : undefined,
          orderNote,
          paymentMethod,
          subtotal,
          discountAmount,
          couponCode: appliedCoupon
            ? appliedCoupon.code
            : isFirstOrderEligible
            ? `ILKSIPARIS%${settings?.firstOrderDiscountPercent}`
            : undefined,
          useLoyaltyPoints: Boolean(useLoyaltyPoints && canRedeemPoints),
          deliveryFee,
          totalAmount: baseTotalBeforeLoyalty,
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
        setCart([]);
        setAppliedCoupon(null);
        setCouponInput("");
        setCouponMessage(null);
        setUseLoyaltyPoints(false);
        setDeliveryTiming("asap");
        setCheckoutStep("cart");
        setMobileCartOpen(false);
        if (currentUser?.phone) {
          await fetchUserProfileAndOrders(currentUser.phone);
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Masa Çağrı / Hesap İste Bildirim Toast */}
      {tableCallToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-2.5 text-xs sm:text-sm font-bold">
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

      {/* Restoran Üst Başlık (Header) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 sm:py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900">
                    {settings?.name}
                  </h1>
                  {isCurrentlyOpen ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Açık • {settings?.openingHours || "11:00 - 23:30"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      Kapalı ({settings?.openingHours || "11:00 - 23:30"})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{settings?.slogan}</p>
              </div>
            </div>

            <div className="lg:hidden">{renderUserAuthBadge()}</div>
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2">
            {/* Sipariş Tipi Seçici */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setOrderType("delivery")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  orderType === "delivery"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                Paket Servis
              </button>
              <button
                type="button"
                onClick={() => setOrderType("pickup")}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  orderType === "pickup"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Gel-Al
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType("dine_in");
                  setPaymentMethod("pos_at_table");
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  orderType === "dine_in"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                Masada {tableNumber ? `(Masa ${tableNumber})` : "(QR)"}
              </button>
            </div>

            {/* 🎨 TEMA SEÇİCİ BUTONU (3 AÇIK + 3 KAPALI TEMA) */}
            {settings?.allowCustomerThemeSwitch !== false && (
              <button
                type="button"
                onClick={() => setThemeModalOpen(true)}
                title="Tema Değiştir (3 Açık + 3 Kapalı Tema)"
                className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs px-3 py-2 rounded-xl transition shadow-xs"
              >
                {getThemeDefinition(activeTheme).mode === "dark" ? (
                  <Moon className="w-3.5 h-3.5 text-orange-500" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-orange-500" />
                )}
                <span className="hidden sm:inline">
                  {getThemeDefinition(activeTheme).shortName}
                </span>
                <Palette className="w-3.5 h-3.5 text-slate-500 sm:hidden" />
              </button>
            )}

            {/* 1. ÖZELLİK: MASA REZERVASYONU BUTONU */}
            <button
              type="button"
              onClick={() => {
                setResSuccessMsg("");
                if (currentUser?.phone) {
                  fetchUserProfileAndOrders(currentUser.phone);
                }
                setReservationModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-xs"
            >
              <CalendarDays className="w-4 h-4 text-orange-400" />
              <span>Masa Rezervasyonu</span>
              {myReservations.filter((r) => r.status === "pending").length >
                0 && (
                <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                  {myReservations.filter((r) => r.status === "pending").length}
                </span>
              )}
            </button>

            <div className="hidden lg:block">{renderUserAuthBadge()}</div>
          </div>
        </div>

        {/* Kategori Sekmeleri & Arama Kutusu Tek Satırda */}
        <div className="border-t border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  activeCategory === "all"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Tüm Menü ({items.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                    activeCategory === cat.id
                      ? "bg-orange-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="relative sm:w-56 flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
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
          </div>
        </div>
      </header>

      {/* QR MASALAR İÇİN "GARSON ÇAĞIR" & "HESAP İSTE" CANLI SERVİS BARI */}
      {orderType === "dine_in" && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-3">
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
                  {Array.from(
                    { length: settings?.tableCount || 15 },
                    (_, i) => i + 1
                  ).map((n) => (
                    <option key={n} value={String(n)}>
                      Masa {n}
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
        </div>
      )}

      {/* Kompakt Aktif Sipariş Canlı Takip Çubuğu */}
      {bannerActiveOrder && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-3">
          <div className="bg-orange-50 border border-orange-300 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="bg-orange-600 text-white font-black px-2 py-0.5 rounded-md">
                #{bannerActiveOrder.orderNumber}
              </span>
              {bannerActiveOrder.scheduledTime && (
                <span className="bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {bannerActiveOrder.scheduledTime}
                </span>
              )}
              <span className="font-bold text-slate-900">
                {bannerActiveOrder.status === "pending" &&
                  "Siparişiniz restorana iletildi, onay bekleniyor..."}
                {bannerActiveOrder.status === "accepted" &&
                  `Siparişiniz Hazırlanıyor (~${
                    bannerActiveOrder.estimatedMinutes ||
                    settings?.estimatedPrepMinutes
                  } dk)`}
                {bannerActiveOrder.status === "ready" &&
                  (bannerActiveOrder.orderType === "delivery"
                    ? `Siparişiniz yola çıktı! ${
                        bannerActiveOrder.courierName
                          ? `Kurye (${bannerActiveOrder.courierName}) geliyor.`
                          : "Kuryemiz geliyor."
                      }`
                    : "Siparişiniz servise / teslime hazır!")}
              </span>
            </div>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  setAccountTab("active_orders");
                  setAccountModalOpen(true);
                }}
                className="font-bold text-orange-700 hover:underline"
              >
                Detayları Gör →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ana İçerik: Sol Doğrudan Yemek Menüsü + Sağ Sütun (Bölge, Fırsatlar & Sepet) */}
      <main className="max-w-7xl mx-auto w-full px-4 py-5 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SOL SÜTUN: DOĞRUDAN YEMEK MENÜSÜ */}
        <div className="lg:col-span-8 space-y-6">
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <Utensils className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-800 text-sm">
                Aradığınız kriterlere uygun ürün bulunamadı.
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
                (cat) => activeCategory === "all" || cat.id === activeCategory
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
                          Çoklu Ürün • Her Ürünün Porsiyonu & Ekstrası Seçilebilir
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {catItems.map((item) => {
                        const subProductCount = (
                          item.modifierGroups || []
                        ).filter((g) => Boolean(g.productTag)).length;
                        return (
                          <div
                            key={item.id}
                            onClick={() => openItemModal(item)}
                            className={`group bg-white rounded-2xl border p-3.5 flex gap-3.5 transition shadow-sm ${
                              item.available
                                ? "border-slate-200/80 hover:border-orange-400 hover:shadow-md cursor-pointer"
                                : "border-red-200 bg-slate-50/80 opacity-65 cursor-not-allowed"
                            }`}
                          >
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {subProductCount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide bg-orange-600 text-white px-2 py-0.5 rounded-md">
                                      🎁 {subProductCount} Ürünlü Kampanya
                                    </span>
                                  )}
                                  {item.popular && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                                      <Flame className="w-3 h-3" /> Popüler
                                    </span>
                                  )}
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
                                        Porsiyon & Ekstralı
                                      </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-slate-900 group-hover:text-orange-600 transition text-sm sm:text-base mt-0.5 truncate">
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

                              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                                <span className="font-extrabold text-slate-900 text-base">
                                  {item.price.toFixed(2)} {settings?.currency}
                                </span>
                              {item.available ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 bg-orange-50 group-hover:bg-orange-600 group-hover:text-white px-2.5 py-1 rounded-lg transition">
                                  <Plus className="w-3.5 h-3.5" /> Ekle
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                                  Stokta Yok
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

      {/* Mobil Alt Sepet Çubuğu */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 shadow-2xl z-40">
          <button
            onClick={() => setMobileCartOpen(true)}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3.5 px-5 rounded-xl flex items-center justify-between shadow-lg shadow-orange-600/30"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-2.5 py-0.5 rounded-lg text-sm">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
              <span>Sepeti Görüntüle & Onayla</span>
            </div>
            <span className="text-base">
              {totalAmount.toFixed(2)} {settings?.currency}
            </span>
          </button>
        </div>
      )}

      {/* Mobil Sepet Drawer Modal */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-black/60 flex items-end justify-center">
          <div className="bg-white w-full max-h-[90vh] rounded-t-3xl flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-400" />
                <h2 className="font-bold">Sipariş Sepetiniz</h2>
              </div>
              <button
                onClick={() => setMobileCartOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {renderCartAndCheckout()}
            </div>
          </div>
        </div>
      )}

      {/* ONLINE MASA REZERVASYONU MODALI (GLORIAFOOD TARZI) */}
      {reservationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
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
          <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
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

                        <div className="text-sm font-bold text-slate-900">
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
                    className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3"
                  >
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-orange-600" />
                      Yeni Teslimat Adresi Ekle
                    </h4>
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
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
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
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Açık Adres (Sokak, Bina, Daire, Tarif) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Örn: Moda Cad. No:15 D:4 Kadıköy"
                        value={newAddressFull}
                        onChange={(e) => setNewAddressFull(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingAddress}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                    >
                      {savingAddress
                        ? "Kaydediliyor..."
                        : "+ Adres Defterime Kaydet"}
                    </button>
                  </form>

                  <div className="space-y-2.5">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                      Kayıtlı Adresleriniz ({currentUser.addresses.length})
                    </h4>
                    {currentUser.addresses.map((addr) => {
                      const isSelected = customerAddress === addr.fullAddress;
                      return (
                        <div
                          key={addr.id}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                            isSelected
                              ? "border-orange-500 bg-orange-50/40"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <Home className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">
                                  {addr.title}
                                </span>
                                {addr.zoneName && (
                                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                    {addr.zoneName}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {addr.fullAddress}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCustomerAddress(addr.fullAddress);
                                if (addr.zoneId) setSelectedZoneId(addr.zoneId);
                              }}
                              className="text-xs font-bold text-orange-600 hover:underline px-2 py-1"
                            >
                              {isSelected ? "Seçili" : "Seç"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
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

      {/* Ürün Opsiyon & Ekstra Seçim Modalı */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="relative h-48 bg-slate-100">
              {selectedItem.imageUrl && (
                <img
                  src={selectedItem.imageUrl}
                  alt={selectedItem.name}
                  className="w-full h-full object-cover"
                />
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
                  <span className="text-lg font-extrabold text-orange-600 whitespace-nowrap">
                    {selectedItem.price.toFixed(2)} {settings?.currency}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">
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
      return (
        <div className="p-4 space-y-4">
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
                <span>
                  İndirim (
                  {appliedCoupon
                    ? appliedCoupon.code
                    : `İlk Sipariş %${settings?.firstOrderDiscountPercent}`}
                  )
                </span>
                <span>
                  -{discountAmount.toFixed(2)} {settings?.currency}
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
              Masa Numaranız *
            </label>
            <select
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white font-semibold"
              required
            >
              <option value="">Masa Seçiniz...</option>
              {Array.from(
                { length: settings?.tableCount || 15 },
                (_, idx) => idx + 1
              ).map((num) => (
                <option key={num} value={String(num)}>
                  Masa {num}
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Teslimat Adresiniz *
              </label>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setAccountTab("addresses");
                    setAccountModalOpen(true);
                  }}
                  className="text-[11px] font-bold text-orange-600 hover:underline"
                >
                  + Yeni Adres Ekle / Yönet
                </button>
              )}
            </div>

            {currentUser && currentUser.addresses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentUser.addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => {
                      setCustomerAddress(addr.fullAddress);
                      if (addr.zoneId) setSelectedZoneId(addr.zoneId);
                    }}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                      customerAddress === addr.fullAddress
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    📍 {addr.title}
                  </button>
                ))}
              </div>
            )}

            <textarea
              rows={2}
              required
              placeholder="Sokak, Bina No, Daire ve Tarif..."
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
            />
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

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Sipariş Notu (İsteğe Bağlı)
          </label>
          <input
            type="text"
            placeholder="Zile basmayın, peçete bol olsun vb."
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl"
          />
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
