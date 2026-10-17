"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Order } from "@/types";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  KeyRound,
  LogOut,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserCheck,
} from "lucide-react";

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
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

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
          setOrders(data.orders || []);
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
    [loginCourierName]
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
    courierName?: string
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchCourierOrders(savedPin)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
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
                className="p-2 rounded-xl bg-slate-800 hover:bg-red-900/60 text-slate-300 hover:text-red-200"
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
            className={`py-2 rounded-lg text-xs font-extrabold transition ${
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
            className={`py-2 rounded-lg text-xs font-extrabold transition ${
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
                Yeni paket onaylandığında bu ekrana otomatik düşer.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {activeDeliveries.map((order) => {
                const elapsedMins = Math.max(
                  0,
                  Math.floor(
                    (nowMs - new Date(order.createdAt).getTime()) / 60000
                  )
                );
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  order.customerAddress || ""
                )}`;

                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl border p-4 space-y-3.5 ${
                      order.status === "ready"
                        ? "bg-slate-900 border-orange-500/60 shadow-lg shadow-orange-950/30"
                        : "bg-slate-900/90 border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="bg-orange-600 text-white font-black text-sm px-2.5 py-0.5 rounded-lg">
                            #{order.orderNumber}
                          </span>
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
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="w-3 h-3" /> {elapsedMins} dk
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

                    {/* Açık Adres Kutusu */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed">
                        <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                        <span className="font-semibold">
                          {order.customerAddress || "Adres belirtilmedi"}
                        </span>
                      </div>
                      {order.orderNote && (
                        <div className="text-xs text-amber-300 bg-amber-950/50 border border-amber-800/50 px-2.5 py-1.5 rounded-lg">
                          📝 Not: {order.orderNote}
                        </div>
                      )}
                    </div>

                    {/* Hızlı Arama ve Harita Butonları */}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl border border-slate-700 transition"
                      >
                        <Phone className="w-4 h-4 text-emerald-400" />
                        <span>Müşteriyi Ara</span>
                      </a>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 bg-blue-950/80 hover:bg-blue-900 text-blue-200 font-bold text-xs py-2.5 px-3 rounded-xl border border-blue-800 transition"
                      >
                        <Navigation className="w-4 h-4 text-blue-400" />
                        <span>Haritada Yol Tarifi</span>
                      </a>
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
                            {item.totalPrice.toFixed(0)} ₺
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
                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
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
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>
                          Teslim Edildi ({order.totalAmount.toFixed(0)} ₺ Tahsil
                          Edildi)
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
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-emerald-400">
                        #{o.orderNumber}
                      </span>
                      <span className="font-bold text-white">
                        {o.customerName}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5 truncate max-w-xs">
                      {o.customerAddress}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sm text-white">
                      {o.totalAmount.toFixed(2)} ₺
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {o.paymentMethod === "cash" ? "Nakit" : "POS Kart"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
