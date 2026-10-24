"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Tv,
  Volume2,
  VolumeX,
  CheckCircle2,
  Flame,
  Maximize2,
  ChefHat,
  ArrowLeft,
  Clock,
  ShoppingBag,
  Utensils,
  Truck,
} from "lucide-react";
import { soundAlert } from "@/lib/sound";

interface TvOrderSummary {
  id: string;
  orderNumber: number;
  orderType: "dine_in" | "pickup" | "delivery";
  tableNumber?: string;
  status: "pending" | "accepted" | "ready";
  estimatedMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export default function TvOrderQueuePage() {
  const [orders, setOrders] = useState<TvOrderSummary[]>([]);
  const [restaurantName, setRestaurantName] = useState("Restoran Sıra Ekranı");
  const [slogan, setSlogan] = useState("Canlı Sipariş Durumu");
  const [tvOrderTypes, setTvOrderTypes] = useState<
    Array<"dine_in" | "pickup" | "delivery">
  >(["pickup", "dine_in", "delivery"]);
  const [tvTickerSpeed, setTvTickerSpeed] = useState<"slow" | "normal" | "fast">(
    "normal"
  );
  const [tvCustomNote, setTvCustomNote] = useState<string>("");
  const [announcementText, setAnnouncementText] = useState<string>("");
  const [happyHourSummary, setHappyHourSummary] = useState<string>("");
  const [featuredItems, setFeaturedItems] = useState<
    Array<{ id: string; name: string; price: number }>
  >([]);
  const [currency, setCurrency] = useState<string>("₺");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState("");
  const [originUrl, setOriginUrl] = useState("https://restoran-siparis.local");
  const [highlightedReadyIds, setHighlightedReadyIds] = useState<string[]>([]);
  const knownReadyIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  const announceReadyOrder = (order: TvOrderSummary) => {
    if (!voiceEnabled) return;
    soundAlert?.playReadyBeep?.();
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const text =
          order.orderType === "dine_in" && order.tableNumber
            ? `${order.orderNumber} numaralı sipariş, Masa ${order.tableNumber} hazır.`
            : `${order.orderNumber} numaralı siparişiniz hazır, teslim alabilirsiniz.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "tr-TR";
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      // ignore speech synthesis errors
    }
  };

  const fetchTvOrders = async () => {
    try {
      const res = await fetch("/api/orders?publicTv=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.restaurantName) setRestaurantName(data.restaurantName);
      if (data.slogan) setSlogan(data.slogan);
      if (data.currency) setCurrency(data.currency);
      if (Array.isArray(data.tvDisplayOrderTypes)) {
        setTvOrderTypes(data.tvDisplayOrderTypes);
      }
      if (
        data.tvTickerSpeed === "slow" ||
        data.tvTickerSpeed === "normal" ||
        data.tvTickerSpeed === "fast"
      ) {
        setTvTickerSpeed(data.tvTickerSpeed);
      }
      if (typeof data.tvCustomNote === "string") {
        setTvCustomNote(data.tvCustomNote);
      }
      if (data.announcementBar?.enabled && data.announcementBar?.text) {
        setAnnouncementText(
          `${data.announcementBar.badgeText || "🔥 FIRSAT"}: ${data.announcementBar.text}`
        );
      } else {
        setAnnouncementText("");
      }
      if (data.happyHourConfig?.enabled) {
        setHappyHourSummary(
          `⏱️ ${data.happyHourConfig.title} (${data.happyHourConfig.startTime}-${data.happyHourConfig.endTime} arası %${data.happyHourConfig.discountPercent} İndirim!)`
        );
      } else {
        setHappyHourSummary("");
      }
      if (Array.isArray(data.featuredItems)) {
        setFeaturedItems(data.featuredItems);
      }

      const list: TvOrderSummary[] = data.orders || [];
      setOrders(list);

      const currentReady = list.filter((o) => o.status === "ready");
      if (firstLoadRef.current) {
        currentReady.forEach((o) => knownReadyIdsRef.current.add(o.id));
        firstLoadRef.current = false;
      } else {
        const newlyReady: TvOrderSummary[] = [];
        currentReady.forEach((o) => {
          if (!knownReadyIdsRef.current.has(o.id)) {
            knownReadyIdsRef.current.add(o.id);
            newlyReady.push(o);
          }
        });
        if (newlyReady.length > 0) {
          announceReadyOrder(newlyReady[0]);
          const newIds = newlyReady.map((o) => o.id);
          setHighlightedReadyIds((prev) => [...prev, ...newIds]);
          setTimeout(() => {
            setHighlightedReadyIds((prev) =>
              prev.filter((id) => !newIds.includes(id))
            );
          }, 12000);
        }
      }
    } catch {
      // ignore network error
    }
  };

  useEffect(() => {
    fetchTvOrders();
    const interval = setInterval(fetchTvOrders, 3000);
    return () => clearInterval(interval);
  }, [voiceEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setOriginUrl(window.location.origin);
    }
    const updateClock = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const preparingList = orders
    .filter(
      (o) =>
        (o.status === "accepted" || o.status === "pending") &&
        tvOrderTypes.includes(o.orderType)
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  const readyList = orders
    .filter(
      (o) => o.status === "ready" && tvOrderTypes.includes(o.orderType)
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  const renderTypeTag = (o: TvOrderSummary) => {
    if (o.orderType === "dine_in") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
          <Utensils className="w-3 h-3" /> Masa {o.tableNumber || "-"}
        </span>
      );
    }
    if (o.orderType === "pickup") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
          <ShoppingBag className="w-3 h-3" /> Gel-Al
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
        <Truck className="w-3 h-3" /> Paket
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col select-none overflow-x-hidden">
      <style>{`
        @keyframes tvMarqueeScroll {
          0% { transform: translate3d(0%, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-tv-marquee {
          display: flex;
          width: max-content;
          animation: tvMarqueeScroll 85s linear infinite;
          will-change: transform;
        }
      `}</style>
      {/* Üst TV Başlık Çubuğu (Tek Satır Kompakt Görünüm) */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 whitespace-nowrap overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-600/30 shrink-0">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-white truncate">
              {restaurantName}
            </h1>
            <div className="flex items-center gap-1 shrink-0">
              {tvOrderTypes.includes("pickup") && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  🛍️ Gel-Al
                </span>
              )}
              {tvOrderTypes.includes("dine_in") && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  🪑 Masa
                </span>
              )}
              {tvOrderTypes.includes("delivery") && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  🛵 Paket
                </span>
              )}
            </div>
            <span className="hidden 2xl:inline text-xs text-slate-400 font-semibold truncate">
              • {slogan}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 📱 7. ÖNERİ: SIRADA BEKLEMEDEN QR OKUT & SİPARİŞ VER KÖŞE KARTI */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-950 border border-orange-500/40 px-2.5 py-1 rounded-xl shadow">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(
                originUrl
              )}`}
              alt="Online QR Menü"
              className="w-8 h-8 rounded bg-white p-0.5 shrink-0"
            />
            <div className="leading-tight">
              <div className="text-[10px] font-black text-orange-400 uppercase">
                📱 QR Okut • Sıra Bekleme!
              </div>
              <div className="text-[9px] font-semibold text-slate-300">
                Telefondan anında sipariş
              </div>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-sm sm:text-base font-black text-amber-400">
            {currentTime}
          </div>

          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition cursor-pointer ${
              voiceEnabled
                ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" /> Sesli Anons Açık
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" /> Sesli Anons Kapalı
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Tam Ekran Yap"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Tam Ekran</span>
          </button>

          <Link
            href="/kitchen"
            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 transition"
          >
            <ChefHat className="w-3.5 h-3.5 text-orange-400" />
            <span>Mutfak</span>
          </Link>

          <Link
            href="/"
            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Menü</span>
          </Link>
        </div>
      </header>

      {/* 🔔 YENİ HAZIR SİPARİŞ DEV SPOTLIGHT BANNERI */}
      {highlightedReadyIds.length > 0 &&
        (() => {
          const spotOrder = readyList.find((o) =>
            highlightedReadyIds.includes(o.id)
          );
          if (!spotOrder) return null;
          return (
            <div className="mx-6 mt-4 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 rounded-3xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl shadow-emerald-500/30 border-4 border-white animate-pulse">
              <div className="flex items-center gap-4">
                <span className="text-4xl sm:text-5xl">🔔🍽️</span>
                <div>
                  <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-950">
                    SİPARİŞİNİZ ŞİMDİ HAZIRLANDI!
                  </div>
                  <div className="text-2xl sm:text-4xl font-black tracking-tight text-slate-950">
                    Sipariş #{spotOrder.orderNumber}{" "}
                    {spotOrder.orderType === "dine_in" && spotOrder.tableNumber
                      ? `• Masa ${spotOrder.tableNumber}`
                      : "• Teslim Noktasından Alabilirsiniz"}
                  </div>
                </div>
              </div>
              <span className="bg-slate-950 text-emerald-300 font-black text-sm sm:text-lg px-5 py-2 rounded-2xl">
                AFİYET OLSUN! ✨
              </span>
            </div>
          );
        })()}

      {/* İki Sütunlu Dev TV Gösterim Alanı */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* SOL SÜTUN: HAZIRLANIYOR */}
        <section className="lg:col-span-6 bg-slate-900/70 border-2 border-amber-500/40 rounded-3xl p-6 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <Flame className="w-6 h-6 text-amber-400 animate-pulse" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-wide text-amber-400 uppercase">
                  HAZIRLANIYOR
                </h2>
                <p className="text-xs text-slate-400 font-semibold">
                  Mutfakta özenle hazırlanan siparişler
                </p>
              </div>
            </div>
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-lg px-4 py-1 rounded-2xl">
              {preparingList.length}
            </span>
          </div>

          {preparingList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 py-16">
              <Flame className="w-16 h-16 mb-3 opacity-30" />
              <p className="text-lg font-bold">
                Şu an hazırlanan sipariş bulunmuyor
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
              {preparingList.map((order) => (
                <div
                  key={order.id}
                  className="bg-slate-950 border-2 border-amber-500/40 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg space-y-2"
                >
                  <div className="text-4xl sm:text-5xl font-black text-amber-400 tracking-tight">
                    #{order.orderNumber}
                  </div>
                  {renderTypeTag(order)}
                  {order.estimatedMinutes && (
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                      <Clock className="w-3 h-3 text-amber-400" /> ~
                      {order.estimatedMinutes} dk
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SAĞ SÜTUN: HAZIR! TESLİM ALABİLİRSİNİZ */}
        <section className="lg:col-span-6 bg-emerald-950/20 border-2 border-emerald-500/60 rounded-3xl p-6 flex flex-col">
          <div className="flex items-center justify-between border-b border-emerald-800/50 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-wide text-emerald-400 uppercase">
                  HAZIR • TESLİM ALINIZ
                </h2>
                <p className="text-xs text-emerald-200/70 font-semibold">
                  Numaranız yandığında bankodan veya garsonumuzdan teslim
                  alabilirsiniz
                </p>
              </div>
            </div>
            <span className="bg-emerald-500 text-slate-950 font-black text-lg px-4 py-1 rounded-2xl shadow-lg shadow-emerald-500/30">
              {readyList.length}
            </span>
          </div>

          {readyList.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 py-16">
              <CheckCircle2 className="w-16 h-16 mb-3 opacity-30" />
              <p className="text-lg font-bold">
                Hazır bekleyen sipariş bulunmuyor
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 content-start">
              {readyList.map((order) => {
                const isNew = highlightedReadyIds.includes(order.id);
                return (
                  <div
                    key={order.id}
                    className={`rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-2 transition-all ${
                      isNew
                        ? "bg-emerald-500 text-slate-950 border-4 border-white shadow-2xl shadow-emerald-500/50 animate-bounce"
                        : "bg-emerald-900/40 border-2 border-emerald-400 text-white shadow-xl"
                    }`}
                  >
                    <div
                      className={`text-5xl sm:text-6xl font-black tracking-tight ${
                        isNew ? "text-slate-950" : "text-emerald-300"
                      }`}
                    >
                      #{order.orderNumber}
                    </div>
                    {isNew ? (
                      <span className="bg-slate-950 text-emerald-300 text-xs font-black uppercase px-3 py-1 rounded-full">
                        🔔 ŞİMDİ HAZIR!
                      </span>
                    ) : (
                      renderTypeTag(order)
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 7. ÖZELLİK: TV Digital Signage Alt Kayan Yazı (Kampanya, Happy Hour & Popüler Menü Bandı) */}
      <footer className="bg-gradient-to-r from-slate-950 via-orange-950/80 to-slate-950 border-t-2 border-orange-500/40 py-3 overflow-hidden flex items-center relative">
        <div className="z-10 bg-orange-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider px-4 py-2 ml-4 rounded-xl shadow-lg shrink-0 flex items-center gap-2">
          <span className="animate-pulse">📢</span>
          <span>FIRSAT & MENÜ</span>
        </div>

        <div className="flex-1 overflow-hidden relative ml-4">
          <div
            className="animate-tv-marquee items-center"
            style={{
              animationDuration:
                tvTickerSpeed === "slow"
                  ? "135s"
                  : tvTickerSpeed === "fast"
                  ? "50s"
                  : "85s",
            }}
          >
            {[0, 1].map((halfIdx) => (
              <div
                key={halfIdx}
                className="flex items-center gap-6 pr-6 shrink-0"
              >
                {[0, 1].map((repeatIdx) => (
                  <React.Fragment key={`${halfIdx}-${repeatIdx}`}>
                    {announcementText ? (
                      <span className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/40 text-orange-200 text-sm sm:text-base font-black px-4 py-1.5 rounded-xl whitespace-nowrap">
                        {announcementText}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/40 text-orange-200 text-sm sm:text-base font-black px-4 py-1.5 rounded-xl whitespace-nowrap">
                        🍽️ {restaurantName} — {slogan} • Sıcak & Taze Lezzetler!
                      </span>
                    )}

                    {tvCustomNote && (
                      <span className="inline-flex items-center gap-2 bg-sky-500/20 border border-sky-500/40 text-sky-200 text-sm sm:text-base font-black px-4 py-1.5 rounded-xl whitespace-nowrap">
                        {tvCustomNote}
                      </span>
                    )}

                    {happyHourSummary && (
                      <span className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm sm:text-base font-black px-4 py-1.5 rounded-xl whitespace-nowrap">
                        {happyHourSummary}
                      </span>
                    )}

                    {featuredItems.length > 0 && (
                      <div className="flex items-center gap-4">
                        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400 whitespace-nowrap">
                          ⭐ ÖNE ÇIKAN LEZZETLERİMİZ:
                        </span>
                        {featuredItems.map((fi) => (
                          <span
                            key={`${halfIdx}-${repeatIdx}-${fi.id}`}
                            className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold text-white whitespace-nowrap shadow"
                          >
                            <span>🔥 {fi.name}</span>
                            <strong className="text-amber-400 font-black">
                              {fi.price} {currency}
                            </strong>
                          </span>
                        ))}
                      </div>
                    )}

                    <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-emerald-300 whitespace-nowrap">
                      📱 Masanızdaki QR Kodu Okutarak veya Online Menümüzden Hemen Sipariş Verebilirsiniz!
                    </span>
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
