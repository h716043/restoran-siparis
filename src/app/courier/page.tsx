"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Order } from "@/types";
import {
  Banknote,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  Printer,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserCheck,
  X,
} from "lucide-react";

function normalizeWhatsAppPhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 11) return "9" + digits;
  if (digits.length === 10 && digits.startsWith("5")) return "90" + digits;
  return digits;
}

export default function CourierPage() {
  const [pin, setPin] = useState("");
  const [loginCourierName, setLoginCourierName] = useState<string>("auto");
  const [savedPin, setSavedPin] = useState<string>("");
  const [lockedCourierName, setLockedCourierName] = useState<string | null>(
    null
  );
  const [isMasterLogin, setIsMasterLogin] = useState<boolean>(false);
  const [authError, setAuthError] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<string[]>([]);
  const [selectedCourier, setSelectedCourier] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [courierAlertMsg, setCourierAlertMsg] = useState<string>("");
  const [showSettlementSlip, setShowSettlementSlip] = useState<boolean>(false);
  const [wakeLockEnabled, setWakeLockEnabled] = useState<boolean>(true);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [gpsSharingEnabled, setGpsSharingEnabled] = useState<boolean>(true);
  const [lastGpsCoords, setLastGpsCoords] = useState<{
    lat: number;
    lng: number;
    updatedAt: string;
  } | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const knownDeliveryIdsRef = useRef<Set<string>>(new Set());
  const initialLoadedRef = useRef<boolean>(false);

  // Canlı Kurye GPS Konum Paylaşımı (Kurye telefonundan Mutfak/Admin haritasına gönderir)
  useEffect(() => {
    const activeCourier =
      lockedCourierName ||
      (selectedCourier && selectedCourier !== "all"
        ? selectedCourier
        : couriers[0] || "");
    if (!savedPin || !gpsSharingEnabled || !activeCourier) return;

    const sendCoords = (lat: number, lng: number, speedMs?: number | null) => {
      const speedKmh =
        speedMs && Number.isFinite(speedMs) && speedMs > 0
          ? Math.round(speedMs * 3.6)
          : 0;
      setLastGpsCoords({
        lat,
        lng,
        updatedAt: new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      fetch("/api/courier-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courierName: activeCourier,
          lat,
          lng,
          speedKmh,
          status: "delivering",
        }),
      }).catch(() => {});
    };

    let watchId: number | null = null;
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          sendCoords(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.speed
          );
        },
        () => {
          // Masaüstü PC veya GPS izni kapalı cihazda test edilirken varsayılan merkez koordinatı gönder
          const hash = activeCourier
            .split("")
            .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          const offsetLat = ((hash % 9) - 4) * 0.0022;
          const offsetLng = (((hash * 3) % 9) - 4) * 0.0025;
          sendCoords(41.0082 + offsetLat, 28.9784 + offsetLng, 7.5);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
      );
    } else {
      sendCoords(41.0082, 28.9784, 0);
    }

    return () => {
      if (
        watchId !== null &&
        typeof navigator !== "undefined" &&
        "geolocation" in navigator
      ) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [savedPin, gpsSharingEnabled, lockedCourierName, selectedCourier, couriers]);

  const requestCourierWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      const wl = await (
        navigator as Navigator & {
          wakeLock: {
            request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
          };
        }
      ).wakeLock.request("screen");
      wakeLockRef.current = wl;
      setWakeLockActive(true);
    } catch {
      setWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    if (!savedPin || !wakeLockEnabled) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      setWakeLockActive(false);
      return;
    }
    requestCourierWakeLock();
    const onVis = () => {
      if (document.visibilityState === "visible" && wakeLockEnabled) {
        requestCourierWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [savedPin, wakeLockEnabled, requestCourierWakeLock]);

  const playCourierAlertSound = useCallback(() => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([250, 120, 250]);
      }
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // ignore audio context restrictions
    }
  }, []);

  useEffect(() => {
    try {
      const sp = localStorage.getItem("restoran_courier_pin");
      const sc = localStorage.getItem("restoran_selected_courier");
      const lc = localStorage.getItem("restoran_login_courier_name");
      if (sp) setSavedPin(sp);
      if (sc) setSelectedCourier(sc);
      if (lc) setLoginCourierName(lc);
    } catch {
      // ignore
    }
    fetch("/api/menu")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.settings?.couriers)) {
          setCouriers(d.settings.couriers);
        }
      })
      .catch(() => {});
    const t = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const fetchCourierOrders = useCallback(
    async (pinToUse: string, courierHint?: string) => {
      if (!pinToUse) return;
      setLoading(true);
      try {
        const targetHint = courierHint ?? loginCourierName;
        const headers: Record<string, string> = {
          "x-courier-pin": pinToUse,
        };
        if (targetHint && targetHint !== "auto" && targetHint !== "all") {
          headers["x-courier-name"] = encodeURIComponent(targetHint);
        }
        const res = await fetch("/api/orders", { headers });
        if (res.status === 401) {
          setAuthError(
            "Hatalı Kurye Şifresi! Lütfen kendi kurye şifrenizi (PIN) kontrol edin."
          );
          setSavedPin("");
          setLockedCourierName(null);
          localStorage.removeItem("restoran_courier_pin");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          const fetchedOrders: Order[] = data.orders || [];
          const activeCourier =
            data.authenticatedCourier || selectedCourier || "all";

          const currentRelevantDeliveries = fetchedOrders.filter(
            (o) =>
              o.orderType === "delivery" &&
              (o.status === "accepted" || o.status === "ready") &&
              (activeCourier === "all" ||
                !o.courierName ||
                o.courierName === activeCourier)
          );

          if (initialLoadedRef.current) {
            const newlyArrived = currentRelevantDeliveries.filter(
              (o) => !knownDeliveryIdsRef.current.has(o.id)
            );
            if (newlyArrived.length > 0) {
              playCourierAlertSound();
              const first = newlyArrived[0];
              setCourierAlertMsg(
                `🔔 Yeni Paket Düştü: #${first.orderNumber} (${first.customerName})`
              );
              setTimeout(() => setCourierAlertMsg(""), 6000);
            }
          }
          knownDeliveryIdsRef.current = new Set(
            currentRelevantDeliveries.map((o) => o.id)
          );
          initialLoadedRef.current = true;

          setOrders(fetchedOrders);
          if (data.couriers && data.couriers.length > 0) {
            setCouriers(data.couriers);
          }
          if (data.authenticatedCourier) {
            setLockedCourierName(data.authenticatedCourier);
            setIsMasterLogin(false);
            setSelectedCourier(data.authenticatedCourier);
          } else {
            setLockedCourierName(null);
            setIsMasterLogin(Boolean(data.isMasterCourierLogin));
          }
          setAuthError("");
        }
      } catch {
        // ignore network error
      } finally {
        setLoading(false);
      }
    },
    [loginCourierName, playCourierAlertSound, selectedCourier]
  );

  useEffect(() => {
    if (!savedPin) return;
    fetchCourierOrders(savedPin);
    const interval = setInterval(() => fetchCourierOrders(savedPin), 4000);
    return () => clearInterval(interval);
  }, [savedPin, fetchCourierOrders]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pin.trim();
    if (!clean) return;
    setSavedPin(clean);
    try {
      localStorage.setItem("restoran_courier_pin", clean);
      localStorage.setItem("restoran_login_courier_name", loginCourierName);
    } catch {
      // ignore
    }
    await fetchCourierOrders(clean, loginCourierName);
  };

  const handleCourierChange = (val: string) => {
    if (lockedCourierName) return;
    setSelectedCourier(val);
    try {
      localStorage.setItem("restoran_selected_courier", val);
    } catch {
      // ignore
    }
  };

  const handleUpdateOrder = async (
    orderId: string,
    status: Order["status"],
    courierName?: string,
    paymentMethod?: Order["paymentMethod"]
  ) => {
    setUpdatingId(orderId);
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-courier-pin": savedPin,
        },
        body: JSON.stringify({
          status,
          courierName: lockedCourierName || courierName,
          paymentMethod,
        }),
      });
      await fetchCourierOrders(savedPin);
    } finally {
      setUpdatingId(null);
    }
  };

  const deliveryOrders = useMemo(() => {
    return orders.filter((o) => o.orderType === "delivery");
  }, [orders]);

  const activeDeliveries = useMemo(() => {
    return deliveryOrders.filter((o) => {
      const isAct = o.status === "accepted" || o.status === "ready";
      if (!isAct) return false;
      if (selectedCourier === "all") return true;
      // Hazırlanan ve henüz kurye atanmamış paketleri de göster ki kurye üzerine alabilsin
      return !o.courierName || o.courierName === selectedCourier;
    });
  }, [deliveryOrders, selectedCourier]);

  const claimableAcceptedPackages = useMemo(
    () => activeDeliveries.filter((o) => o.status === "accepted"),
    [activeDeliveries]
  );

  const togglePackageSelection = (id: string) => {
    setSelectedPackageIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const targetRouteOrders = useMemo(() => {
    const picked = activeDeliveries.filter((o) =>
      selectedPackageIds.includes(o.id)
    );
    return picked.length > 0 ? picked : activeDeliveries;
  }, [activeDeliveries, selectedPackageIds]);

  const multiStopMapsUrl = useMemo(() => {
    const stops = targetRouteOrders
      .map((o) => {
        const coords = o.splitPaymentInfo?.customerCoords;
        if (
          coords &&
          typeof coords.lat === "number" &&
          typeof coords.lng === "number"
        ) {
          return `${coords.lat},${coords.lng}`;
        }
        return (o.customerAddress || "").trim();
      })
      .filter(Boolean);
    if (stops.length === 0) return "";
    if (stops.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        stops[0]
      )}&travelmode=driving`;
    }
    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1).join("|");
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      destination
    )}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
  }, [targetRouteOrders]);

  const handleBatchCompleteSelected = async () => {
    const toComplete =
      selectedPackageIds.length > 0
        ? activeDeliveries.filter((o) => selectedPackageIds.includes(o.id))
        : activeDeliveries.filter((o) => o.status === "ready");
    if (toComplete.length === 0) return;
    setBatchUpdating(true);
    try {
      const assignedCourier =
        lockedCourierName ||
        (selectedCourier !== "all"
          ? selectedCourier
          : couriers[0] || "Kurye");
      await Promise.all(
        toComplete.map((ord) =>
          fetch(`/api/orders/${ord.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-courier-pin": savedPin,
            },
            body: JSON.stringify({
              status: "completed",
              courierName: ord.courierName || assignedCourier,
            }),
          })
        )
      );
      setSelectedPackageIds([]);
      await fetchCourierOrders(savedPin);
    } finally {
      setBatchUpdating(false);
    }
  };

  const handleBatchPickupAll = async () => {
    if (claimableAcceptedPackages.length === 0) return;
    setBatchUpdating(true);
    try {
      const assignedCourier =
        lockedCourierName ||
        (selectedCourier !== "all"
          ? selectedCourier
          : couriers[0] || "Kurye");
      await Promise.all(
        claimableAcceptedPackages.map((ord) =>
          fetch(`/api/orders/${ord.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-courier-pin": savedPin,
            },
            body: JSON.stringify({
              status: "ready",
              courierName: assignedCourier,
            }),
          })
        )
      );
      await fetchCourierOrders(savedPin);
    } finally {
      setBatchUpdating(false);
    }
  };

  const todayCompletedDeliveries = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return deliveryOrders.filter((o) => {
      if (o.status !== "completed") return false;
      if (new Date(o.createdAt).getTime() < startOfToday.getTime()) return false;
      if (selectedCourier !== "all" && o.courierName !== selectedCourier) {
        return false;
      }
      return true;
    });
  }, [deliveryOrders, selectedCourier]);

  const todayCashTotal = useMemo(
    () =>
      todayCompletedDeliveries
        .filter((o) => o.paymentMethod === "cash")
        .reduce((s, o) => s + o.totalAmount, 0),
    [todayCompletedDeliveries]
  );

  const todayCardTotal = useMemo(
    () =>
      todayCompletedDeliveries
        .filter((o) => o.paymentMethod === "card_at_door")
        .reduce((s, o) => s + o.totalAmount, 0),
    [todayCompletedDeliveries]
  );

  const unsettledCashTotal = useMemo(
    () =>
      todayCompletedDeliveries
        .filter(
          (o) =>
            o.paymentMethod === "cash" && !o.splitPaymentInfo?.courierSettled
        )
        .reduce((s, o) => s + o.totalAmount, 0),
    [todayCompletedDeliveries]
  );

  if (!savedPin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-lg shadow-orange-600/30">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold">Kurye Cep Paneli</h1>
              <p className="text-xs text-slate-400">
                Her kuryeye özel şifre ile güvenli giriş
              </p>
            </div>
          </div>

          {authError && (
            <div className="bg-red-950/80 border border-red-700 text-red-200 p-3 rounded-xl text-xs font-bold">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {couriers.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Kurye Seçimi
                </label>
                <select
                  value={loginCourierName}
                  onChange={(e) => setLoginCourierName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="auto">
                    🔑 Şifreme Göre Kurye Profilimi Otomatik Tanı
                  </option>
                  {couriers.map((c) => (
                    <option key={c} value={c}>
                      🛵 {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Kurye Özel Şifreniz (PIN)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-lg font-black tracking-widest text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Size atanan kişisel kurye şifrenizi girin (Örn: Kurye 1 → 1111, Kurye 2 → 2222).
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-lg cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Kurye Paneline Giriş Yap</span>
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-800">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-white transition"
            >
              ← Müşteri Vitrinine Dön
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12">
      {/* Üst Başlık */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm sm:text-base">
                  Kurye Teslimat Paneli
                </h1>
                <p className="text-[11px] text-slate-400">
                  Canlı Paket & Yol Tarifi Ekranı
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !gpsSharingEnabled;
                  setGpsSharingEnabled(next);
                  const activeCourier =
                    lockedCourierName ||
                    (selectedCourier && selectedCourier !== "all"
                      ? selectedCourier
                      : couriers[0] || "");
                  if (!next && activeCourier) {
                    fetch("/api/courier-locations", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ courierName: activeCourier }),
                    }).catch(() => {});
                  }
                }}
                className={`px-2.5 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-1 cursor-pointer transition ${
                  gpsSharingEnabled
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
                title={
                  lastGpsCoords
                    ? `Canlı GPS Konumu Aktif (Son: ${lastGpsCoords.updatedAt})`
                    : "Canlı GPS Konum Paylaşımı"
                }
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{gpsSharingEnabled ? "📍 GPS Açık" : "📍 GPS Kapalı"}</span>
              </button>
              <button
                type="button"
                onClick={() => setWakeLockEnabled((prev) => !prev)}
                className={`px-2.5 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-1 cursor-pointer transition ${
                  wakeLockEnabled
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
                title={
                  wakeLockActive
                    ? "Ekran Uyanık Tutma Aktif (Sürüşte Ekran Kapanmaz)"
                    : "Ekran Uyanık Tutma (Wake Lock)"
                }
              >
                <span>{wakeLockEnabled ? "🔋 Ekran Açık" : "🌙 Uyku"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSettlementSlip(true)}
                className="px-2.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                title="Gün Sonu Kurye Mutabakat Fişi"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mutabakat Fişi</span>
              </button>
              <button
                type="button"
                onClick={() => fetchCourierOrders(savedPin)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                title="Yenile"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavedPin("");
                  setLockedCourierName(null);
                  localStorage.removeItem("restoran_courier_pin");
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200 cursor-pointer"
                title="Çıkış"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Kurye Kimliği veya Yönetici Kurye Seçimi */}
          {lockedCourierName && !isMasterLogin ? (
            <div className="flex items-center justify-between bg-orange-950/40 border border-orange-500/40 px-3 py-2 rounded-xl text-xs">
              <div className="flex items-center gap-2 font-extrabold text-orange-300">
                <UserCheck className="w-4 h-4 text-orange-400 shrink-0" />
                <span>🛵 Aktif Kurye: {lockedCourierName}</span>
              </div>
              <span className="text-[10px] font-bold bg-orange-500/20 text-orange-200 px-2 py-0.5 rounded-md">
                Kişisel Şifre İle Giriş
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <select
                value={selectedCourier}
                onChange={(e) => handleCourierChange(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-2 rounded-xl"
              >
                <option value="all">
                  Tüm Kuryeler ({activeDeliveries.length} Aktif Paket)
                </option>
                {couriers.map((c) => (
                  <option key={c} value={c}>
                    🛵 {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {courierAlertMsg && (
          <div className="bg-orange-600 text-white px-4 py-3 rounded-2xl font-extrabold text-xs flex items-center justify-between shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <span>{courierAlertMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setCourierAlertMsg("")}
              className="text-white/80 hover:text-white font-black"
            >
              ×
            </button>
          </div>
        )}

        {/* Günlük Kurye Tahsilat Özeti */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-400">
              Bugün Teslim
            </div>
            <div className="text-lg font-black text-white mt-0.5">
              {todayCompletedDeliveries.length} Paket
            </div>
          </div>
          <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-emerald-400">
              Nakit Tahsilat
            </div>
            <div className="text-lg font-black text-emerald-300 mt-0.5">
              {todayCashTotal.toFixed(0)} ₺
            </div>
          </div>
          <div className="bg-blue-950/40 border border-blue-800/60 rounded-2xl p-3 text-center">
            <div className="text-[10px] font-bold uppercase text-blue-400">
              POS (Kart)
            </div>
            <div className="text-lg font-black text-blue-300 mt-0.5">
              {todayCardTotal.toFixed(0)} ₺
            </div>
          </div>
        </div>

        {/* Sekmeler */}
        <div className="grid grid-cols-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
              activeTab === "active"
                ? "bg-orange-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            🛵 Aktif Paketler ({activeDeliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
              activeTab === "completed"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ✅ Bugün Teslim ({todayCompletedDeliveries.length})
          </button>
        </div>

        {activeTab === "active" ? (
          activeDeliveries.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <PackageCheck className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-bold text-sm text-slate-300">
                Şu anda bekleyen aktif paket servis bulunmuyor.
              </p>
              <p className="text-xs text-slate-500">
                Yeni paket onaylandığında sesli bildirimle bu ekrana düşer.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Çoklu Paket Toplu İşlem & Çoklu Durak Harita Rotası Araç Çubuğu */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        selectedPackageIds.length === activeDeliveries.length
                      ) {
                        setSelectedPackageIds([]);
                      } else {
                        setSelectedPackageIds(activeDeliveries.map((o) => o.id));
                      }
                    }}
                    className="text-xs font-extrabold text-orange-300 hover:text-orange-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={
                        activeDeliveries.length > 0 &&
                        selectedPackageIds.length === activeDeliveries.length
                      }
                      className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                    />
                    <span>
                      {selectedPackageIds.length > 0
                        ? `${selectedPackageIds.length} Paket Seçildi (Tümünü Bırak)`
                        : `Tüm Paketleri Seç (${activeDeliveries.length})`}
                    </span>
                  </button>
                  <span className="text-[11px] font-bold text-slate-400">
                    Toplu Tutar:{" "}
                    <strong className="text-emerald-400">
                      {targetRouteOrders
                        .reduce((s, o) => s + o.totalAmount, 0)
                        .toFixed(0)}{" "}
                      ₺
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {multiStopMapsUrl && (
                    <a
                      href={multiStopMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <Navigation className="w-4 h-4 shrink-0" />
                      <span>
                        🗺️{" "}
                        {selectedPackageIds.length > 0
                          ? `Seçili ${selectedPackageIds.length} Durağı Tek Rotada Aç`
                          : `Tüm Paketleri (${activeDeliveries.length} Durak) Tek Rotada Aç`}
                      </span>
                    </a>
                  )}

                  {(selectedPackageIds.length > 0 ||
                    activeDeliveries.filter((o) => o.status === "ready").length >
                      1) && (
                    <button
                      type="button"
                      disabled={batchUpdating}
                      onClick={handleBatchCompleteSelected}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {batchUpdating
                          ? "Tamamlanıyor..."
                          : selectedPackageIds.length > 0
                          ? `✅ Seçili ${selectedPackageIds.length} Paketi Teslim Edildi Yap`
                          : `✅ Yoldaki Tüm Paketleri Teslim Edildi Yap`}
                      </span>
                    </button>
                  )}
                </div>

                {claimableAcceptedPackages.length > 1 && (
                  <button
                    type="button"
                    disabled={batchUpdating}
                    onClick={handleBatchPickupAll}
                    className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>
                      {batchUpdating
                        ? "Paketler Üzerinize Alınıyor..."
                        : `🛵 Hazır ${claimableAcceptedPackages.length} Paketin Tümünü Üzerime Al & Toplu Yola Çık`}
                    </span>
                  </button>
                )}
              </div>

              {activeDeliveries.map((order) => {
                const elapsedMins = Math.max(
                  0,
                  Math.floor(
                    (nowMs - new Date(order.createdAt).getTime()) / 60000
                  )
                );
                const exactCoords = order.splitPaymentInfo?.customerCoords;
                const hasExactGps =
                  exactCoords &&
                  typeof exactCoords.lat === "number" &&
                  typeof exactCoords.lng === "number";
                const mapsUrl = hasExactGps
                  ? `https://www.google.com/maps/dir/?api=1&destination=${exactCoords.lat},${exactCoords.lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      order.customerAddress || ""
                    )}`;
                const waPhone = normalizeWhatsAppPhone(order.customerPhone);
                const waOnWayUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                  `Merhaba ${order.customerName}, #${order.orderNumber} numaralı siparişinizle yola çıktım 🛵 Yaklaşık 10 dakika içinde adresinizdeyim.`
                )}`;
                const waAtDoorUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                  `Merhaba ${order.customerName}, #${order.orderNumber} numaralı siparişinizle şu an binanızın önündeyim / kapıdayım 🏠`
                )}`;
                const waLocationUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                  `Merhaba ${order.customerName}, #${order.orderNumber} numaralı siparişiniz için adresinizi daha hızlı bulabilmem adına bu mesaja WhatsApp üzerinden konum gönderebilir misiniz? 📍`
                )}`;
                const waLeftAtDoorUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(
                  `Merhaba ${order.customerName}, #${order.orderNumber} numaralı siparişinizi notunuz üzerine zile basmadan kapınıza bıraktım 🔔 Afiyet olsun!`
                )}`;

                const bracketTags = Array.from(
                  (order.orderNote || "").matchAll(/\[([^\]]+)\]/g)
                ).map((m) => m[1]);
                const plainOrderNote = (order.orderNote || "")
                  .replace(/\[[^\]]+\]/g, "")
                  .trim();

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl border p-4 space-y-3.5 ${
                      elapsedMins >= 25
                        ? "bg-slate-900 border-rose-500/80 shadow-lg shadow-rose-950/40"
                        : order.status === "ready"
                        ? "bg-slate-900 border-orange-500/60 shadow-lg shadow-orange-950/30"
                        : "bg-slate-900/90 border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPackageIds.includes(order.id)}
                              onChange={() => togglePackageSelection(order.id)}
                              className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                            />
                            <span className="bg-orange-600 text-white font-black text-sm px-2.5 py-0.5 rounded-lg">
                              #{order.orderNumber}
                            </span>
                          </label>
                          <span
                            className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                              order.status === "ready"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            }`}
                          >
                            {order.status === "ready"
                              ? "🛵 Yolda (Dağıtımda)"
                              : "👨‍🍳 Mutfakta Hazırlanıyor"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                              elapsedMins >= 25
                                ? "bg-rose-600 text-white animate-pulse"
                                : elapsedMins >= 15
                                ? "bg-amber-500/20 text-amber-300"
                                : "text-slate-400"
                            }`}
                          >
                            <Clock className="w-3 h-3" />{" "}
                            {elapsedMins >= 25
                              ? `🚨 Gecikti (${elapsedMins} dk)`
                              : `${elapsedMins} dk`}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-base text-white mt-1.5">
                          {order.customerName}
                        </h3>
                        {order.courierName && (
                          <div className="text-xs font-bold text-orange-400 mt-0.5">
                            Atanan Kurye: {order.courierName}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-black text-orange-400">
                          {order.totalAmount.toFixed(2)} ₺
                        </div>
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 mt-0.5">
                          {order.paymentMethod === "cash" ? (
                            <>
                              <Banknote className="w-3 h-3 text-emerald-400" />
                              Kapıda Nakit
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3 h-3 text-blue-400" />
                              Kapıda POS Kart
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Kapıda Tahsilat Yöntemi Hızlı Değiştirme (Nakit <-> POS Kart) */}
                    <div className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-400">
                        Tahsilat Tipi:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => {
                            if (order.paymentMethod !== "cash") {
                              handleUpdateOrder(
                                order.id,
                                order.status,
                                order.courierName,
                                "cash"
                              );
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer ${
                            order.paymentMethod === "cash"
                              ? "bg-emerald-600 text-white shadow"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          <Banknote className="w-3 h-3" />
                          <span>Nakit</span>
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => {
                            if (order.paymentMethod !== "card_at_door") {
                              handleUpdateOrder(
                                order.id,
                                order.status,
                                order.courierName,
                                "card_at_door"
                              );
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer ${
                            order.paymentMethod === "card_at_door"
                              ? "bg-blue-600 text-white shadow"
                              : "bg-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>POS Kart</span>
                        </button>
                      </div>
                    </div>

                    {/* 💵 6. ÖNERİ: KAPIDA NAKİT PARA ÜSTÜ HIZLI HESAPLAYICI */}
                    {order.paymentMethod === "cash" && (
                      <div className="bg-emerald-950/40 border border-emerald-700/50 rounded-xl px-3 py-2 space-y-1">
                        <div className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">
                          💵 Kapıda Nakit Para Üstü Rehberi (Tutar:{" "}
                          {order.totalAmount.toFixed(0)} ₺)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[200, 300, 400, 500, 1000]
                            .filter((note) => note > order.totalAmount)
                            .slice(0, 3)
                            .map((note) => (
                              <span
                                key={note}
                                className="inline-flex items-center gap-1 bg-slate-950 border border-emerald-600/50 px-2 py-0.5 rounded-lg text-[11px] font-bold text-slate-200"
                              >
                                <span>{note}₺ verirse →</span>
                                <strong className="text-emerald-400 font-black">
                                  {(note - order.totalAmount).toFixed(0)} ₺ Üstü
                                </strong>
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Açık Adres & Hızlı Teslimat Tercih Rozetleri Kutusu */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed">
                          <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                          <span className="font-semibold">
                            {order.customerAddress || "Adres belirtilmedi"}
                          </span>
                        </div>
                        {hasExactGps && (
                          <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-md whitespace-nowrap">
                            🎯 GPS Pinli
                          </span>
                        )}
                      </div>

                      {bracketTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {bracketTags.map((tag, idx) => (
                            <span
                              key={idx}
                              className={`text-[11px] font-extrabold px-2 py-1 rounded-lg border ${
                                tag.includes("Zile Basmayın") ||
                                tag.includes("Kapıya Bırakın")
                                  ? "bg-rose-950/90 text-rose-200 border-rose-600/80"
                                  : tag.includes("Bahşiş")
                                  ? "bg-emerald-950/90 text-emerald-200 border-emerald-600/80"
                                  : "bg-amber-950/80 text-amber-200 border-amber-700/80"
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {plainOrderNote && (
                        <div className="text-xs text-amber-300 bg-amber-950/50 border border-amber-800/50 px-2.5 py-1.5 rounded-lg">
                          📝 Not: {plainOrderNote}
                        </div>
                      )}
                    </div>

                    {/* Hızlı Arama ve Harita Navigasyon Butonları */}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-700 transition"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Müşteriyi Ara</span>
                      </a>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center justify-center gap-1.5 font-bold text-xs py-2.5 px-3 rounded-xl border transition ${
                          hasExactGps
                            ? "bg-emerald-950/90 hover:bg-emerald-900 text-emerald-200 border-emerald-600/80 shadow-sm"
                            : "bg-blue-950/80 hover:bg-blue-900 text-blue-200 border-blue-800"
                        }`}
                      >
                        <Navigation
                          className={`w-3.5 h-3.5 shrink-0 ${
                            hasExactGps ? "text-emerald-400" : "text-blue-400"
                          }`}
                        />
                        <span>{hasExactGps ? "🎯 GPS Pin Rota" : "🗺️ Yol Tarifi"}</span>
                      </a>
                    </div>

                    {/* Tek Tuşla Müşteriye Hazır WhatsApp Mesajları */}
                    <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-2 space-y-1.5">
                      <div className="text-[10px] font-bold text-emerald-400 px-1 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        <span>Tek Tuşla Müşteriye Hazır WhatsApp Mesajı Gönder:</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <a
                          href={waOnWayUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 font-bold text-[11px] py-2 px-1.5 rounded-lg border border-emerald-800/80 transition text-center"
                        >
                          <span>🛵 Yola Çıktım</span>
                        </a>
                        <a
                          href={waAtDoorUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1 bg-amber-950/80 hover:bg-amber-900 text-amber-200 font-bold text-[11px] py-2 px-1.5 rounded-lg border border-amber-800/80 transition text-center"
                        >
                          <span>🏠 Kapıdayım</span>
                        </a>
                        <a
                          href={waLocationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1 bg-sky-950/80 hover:bg-sky-900 text-sky-200 font-bold text-[11px] py-2 px-1.5 rounded-lg border border-sky-800/80 transition text-center"
                        >
                          <span>📍 Konum İste</span>
                        </a>
                        <a
                          href={waLeftAtDoorUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1 bg-purple-950/80 hover:bg-purple-900 text-purple-200 font-bold text-[11px] py-2 px-1.5 rounded-lg border border-purple-800/80 transition text-center"
                        >
                          <span>🚪 Kapıya Bıraktım</span>
                        </a>
                      </div>
                    </div>

                    {/* Sipariş İçeriği Özeti */}
                    <div className="text-xs text-slate-300 bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>
                            <strong className="text-orange-400">
                              {item.quantity}x
                            </strong>{" "}
                            {item.name}
                          </span>
                          <span className="text-slate-400">
                            {item.totalPrice.toFixed(2)} ₺
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Aksiyon Butonu */}
                    {order.status === "accepted" ? (
                      <button
                        type="button"
                        disabled={updatingId === order.id}
                        onClick={() =>
                          handleUpdateOrder(
                            order.id,
                            "ready",
                            selectedCourier !== "all"
                              ? selectedCourier
                              : order.courierName || couriers[0] || "Kurye"
                          )
                        }
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                      >
                        <Truck className="w-4 h-4" />
                        <span>
                          Paketi Aldım / Yola Çıktım (WhatsApp Bildir)
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingId === order.id}
                        onClick={() => handleUpdateOrder(order.id, "completed")}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>
                          Teslim Edildi ({order.totalAmount.toFixed(2)} ₺{" "}
                          {order.paymentMethod === "cash" ? "Nakit" : "POS"}{" "}
                          Tahsil Edildi)
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-2.5">
            {todayCompletedDeliveries.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                Bugün henüz tamamlanmış paket teslimatı yok.
              </div>
            ) : (
              todayCompletedDeliveries.map((o) => (
                <div
                  key={o.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-emerald-400">
                        #{o.orderNumber}
                      </span>
                      <span className="font-bold text-white truncate">
                        {o.customerName}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5 truncate max-w-xs">
                      {o.customerAddress}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateOrder(
                          o.id,
                          o.status,
                          o.courierName,
                          o.paymentMethod === "cash" ? "card_at_door" : "cash"
                        )
                      }
                      className={`px-2 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                        o.paymentMethod === "cash"
                          ? "bg-emerald-950/60 border-emerald-700 text-emerald-300"
                          : "bg-blue-950/60 border-blue-700 text-blue-300"
                      }`}
                      title="Tahsilat tipini değiştirmek için dokunun"
                    >
                      {o.paymentMethod === "cash" ? "💵 Nakit" : "💳 POS Kart"}
                    </button>
                    <div className="text-right">
                      <div className="font-black text-sm text-white">
                        {o.totalAmount.toFixed(2)} ₺
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {o.splitPaymentInfo?.courierSettled
                          ? "✅ Kasaya Teslim"
                          : "⏳ Kuryede"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Gün Sonu Kurye Bireysel Mutabakat (Hesaplaşma) Fişi Modalı */}
      {showSettlementSlip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  🧾 Kurye Gün Sonu Mutabakat Fişi
                </h3>
                <p className="text-xs text-slate-500">
                  {lockedCourierName ||
                    (selectedCourier === "all"
                      ? "Tüm Kuryeler"
                      : selectedCourier)}{" "}
                  • {new Date().toLocaleDateString("tr-TR")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettlementSlip(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span>Toplam Teslim Edilen:</span>
                <strong>{todayCompletedDeliveries.length} Paket</strong>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Toplam Nakit Tahsilat:</span>
                <strong>{todayCashTotal.toFixed(2)} ₺</strong>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>Toplam POS Kart Slip:</span>
                <strong>{todayCardTotal.toFixed(2)} ₺</strong>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-orange-700">
                <span>Kasaya Teslim Edilecek Nakit:</span>
                <span>{unsettledCashTotal.toFixed(2)} ₺</span>
              </div>
            </div>

            {todayCompletedDeliveries.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1 text-[11px] font-mono">
                {todayCompletedDeliveries.map((o) => (
                  <div key={o.id} className="flex justify-between">
                    <span>
                      #{o.orderNumber} {o.customerName.slice(0, 14)}
                    </span>
                    <span>
                      {o.totalAmount.toFixed(0)} ₺ (
                      {o.paymentMethod === "cash" ? "Nakit" : "POS"})
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Fişi Yazdır</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSettlementSlip(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

