"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Category,
  MenuItem,
  ModifierOption,
  Order,
  OrderItem,
  RestaurantSettings,
  SelectedModifier,
  TableCall,
} from "@/types";

function formatCurrency(val: number): string {
  return `${Number(val || 0).toFixed(2)} ₺`;
}

export default function WaiterTerminalPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tableRequests, setTableRequests] = useState<TableCall[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  const [activeTab, setActiveTab] = useState<"tables" | "order" | "alerts">("tables");
  const [selectedTable, setSelectedTable] = useState<string>("1");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Cart & Modifier Modal for Waiter POS
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedItemModal, setSelectedItemModal] = useState<MenuItem | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalItemNote, setModalItemNote] = useState("");
  const [modalSelections, setModalSelections] = useState<Record<string, ModifierOption[]>>({});
  const [modalSubSelections, setModalSubSelections] = useState<Record<string, ModifierOption[]>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    fetch("/api/staff-auth")
      .then((r) => r.json())
      .then((d) => setAuthenticated(Boolean(d.authenticated !== false)))
      .catch(() => setAuthenticated(true));
  }, []);

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/staff-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pinInput, role: "kitchen" }),
    });
    if (res.ok) {
      setAuthenticated(true);
    } else {
      setPinError("Hatalı personel PIN kodu!");
    }
  };

  const fetchAllData = useCallback(async () => {
    try {
      const [ordersRes, menuRes, reqRes] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/menu", { cache: "no-store" }),
        fetch("/api/table-calls", { cache: "no-store" }),
      ]);
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData.orders || []);
      }
      if (menuRes.ok) {
        const mData = await menuRes.json();
        setCategories(mData.categories || []);
        setMenuItems(mData.items || mData.menuItems || []);
        setSettings(mData.settings || null);
      }
      if (reqRes.ok) {
        const rData = await reqRes.json();
        setTableRequests(rData.calls || []);
      }
    } catch (err) {
      console.error("Garson verisi alınamadı:", err);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchAllData();
    const interval = setInterval(fetchAllData, 4000);
    return () => clearInterval(interval);
  }, [authenticated, fetchAllData]);

  const totalTables = settings?.tableCount || 20;

  const activeDineInOrders = useMemo(
    () => orders.filter((o) => o.orderType === "dine_in" && o.status !== "completed" && o.status !== "rejected"),
    [orders]
  );

  const openItemModal = (item: MenuItem) => {
    setSelectedItemModal(item);
    setModalQuantity(1);
    setModalItemNote("");
    const initial: Record<string, ModifierOption[]> = {};
    for (const grp of item.modifierGroups) {
      if (grp.required && !grp.multiSelect && grp.options.length > 0) {
        initial[grp.id] = [grp.options[0]];
      } else {
        initial[grp.id] = [];
      }
    }
    setModalSelections(initial);
    setModalSubSelections({});
  };

  const toggleModifierOption = (groupId: string, option: ModifierOption, multiSelect: boolean) => {
    setModalSelections((prev) => {
      const current = prev[groupId] || [];
      const exists = current.some((o) => o.id === option.id);
      if (!multiSelect) {
        return { ...prev, [groupId]: [option] };
      }
      if (exists) {
        return { ...prev, [groupId]: current.filter((o) => o.id !== option.id) };
      }
      return { ...prev, [groupId]: [...current, option] };
    });
  };

  const toggleSubOption = (parentKey: string, subOpt: ModifierOption) => {
    setModalSubSelections((prev) => {
      const current = prev[parentKey] || [];
      const exists = current.some((o) => o.id === subOpt.id);
      if (exists) {
        return { ...prev, [parentKey]: current.filter((o) => o.id !== subOpt.id) };
      }
      return { ...prev, [parentKey]: [...current, subOpt] };
    });
  };

  const addItemToWaiterCart = () => {
    if (!selectedItemModal) return;

    const chosenModifiers: SelectedModifier[] = [];
    for (const grp of selectedItemModal.modifierGroups) {
      const selectedOpts = modalSelections[grp.id] || [];
      if (grp.required && selectedOpts.length === 0) {
        alert(`Lütfen "${grp.name}" seçimi yapınız.`);
        return;
      }
      const isRemoval = grp.name.toLowerCase().includes("çıkar") || grp.name.toLowerCase().includes("istemiyorum");
      const role: SelectedModifier["modifierRole"] = isRemoval
        ? "removal"
        : !grp.multiSelect && grp.required
        ? "portion"
        : "extra";

      for (const opt of selectedOpts) {
        chosenModifiers.push({
          groupName: grp.name,
          optionName: opt.name,
          price: opt.price,
          productTag: grp.productTag,
          modifierRole: role,
        });
        const subKey = `${grp.id}__${opt.id}`;
        const chosenSubs = modalSubSelections[subKey] || [];
        for (const sub of chosenSubs) {
          chosenModifiers.push({
            groupName: `${opt.name} Ekstrası`,
            optionName: sub.name,
            price: sub.price,
            productTag: grp.productTag,
            modifierRole: "sub_extra",
            parentOptionName: opt.name,
          });
        }
      }
    }

    const modTotal = chosenModifiers.reduce((sum, m) => sum + m.price, 0);
    const unitPrice = selectedItemModal.price + modTotal;

    const newItem: OrderItem = {
      id: `waiter-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: selectedItemModal.id,
      name: selectedItemModal.name,
      quantity: modalQuantity,
      basePrice: selectedItemModal.price,
      unitPrice,
      totalPrice: unitPrice * modalQuantity,
      selectedModifiers: chosenModifiers,
      itemNote: modalItemNote.trim() || undefined,
    };

    setCart((prev) => [...prev, newItem]);
    setSelectedItemModal(null);
    showToast(`✅ ${newItem.quantity}x ${newItem.name} eklendi`);
  };

  const handleSendTableOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: selectedTable,
          customerName: `Masa ${selectedTable} (Garson)`,
          customerPhone: "05000000000",
          paymentMethod: "pos_at_table",
          orderNote: orderNote.trim() || undefined,
          items: cart,
        }),
      });
      if (res.ok) {
        setCart([]);
        setOrderNote("");
        await fetchAllData();
        showToast(`🚀 Masa ${selectedTable} siparişi mutfağa iletildi!`);
        setActiveTab("tables");
      } else {
        const err = await res.json();
        alert(err.error || "Sipariş gönderilemedi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveRequest = async (id: string) => {
    setTableRequests((prev) => prev.filter((c) => c.id !== id));
    await fetch("/api/table-calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchAllData();
    showToast("🔔 Masa çağrısı tamamlandı");
  };

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.available || item.dailyStock === 0) return false;
      if (activeCategory !== "all" && item.categoryId !== activeCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [menuItems, activeCategory, searchQuery]);

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center">
        <div className="text-sm text-stone-400 animate-pulse">Garson Terminali Yükleniyor...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center p-4">
        <form
          onSubmit={handlePinLogin}
          className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-3xl p-6 space-y-4 shadow-2xl"
        >
          <div className="text-center space-y-1">
            <span className="text-4xl">📱</span>
            <h1 className="text-xl font-black">Garson Cep Terminali</h1>
            <p className="text-xs text-stone-400">Hızlı masa siparişi ve çağrı ekranı için PIN giriniz</p>
          </div>
          {pinError && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-xs text-red-300 text-center font-bold">
              {pinError}
            </div>
          )}
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Personel PIN Kodu"
            className="w-full px-4 py-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-center text-lg font-black tracking-widest focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm transition"
          >
            Giriş Yap →
          </button>
        </form>
      </div>
    );
  }

  const readyTableOrders = activeDineInOrders.filter((o) => o.status === "ready");
  const alertCount = tableRequests.length + readyTableOrders.length;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-28">
      {/* Top Bar */}
      <header className="bg-stone-900 border-b border-stone-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg">
            📱
          </span>
          <div>
            <h1 className="text-sm font-black text-white leading-tight">Garson Cep Terminali</h1>
            <p className="text-[11px] text-stone-400">
              Seçili: <strong className="text-amber-400">Masa {selectedTable}</strong> • Açık Masa: {
                new Set(activeDineInOrders.map((o) => o.tableNumber)).size
              }/{totalTables}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/kitchen"
            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-bold text-stone-200"
          >
            👨‍🍳 Mutfak
          </Link>
        </div>
      </header>

      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-black shadow-xl">
          {toastMessage}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto p-3">
        {/* TAB 1: TABLES */}
        {activeTab === "tables" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-black text-stone-200">🪑 Salon Masaları (Dokun & Sipariş Gir)</h2>
              <span className="text-[11px] text-stone-400">
                🟢 Boş • 🟠 Dolu • 🔴 Çağrı Var
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {Array.from({ length: totalTables }, (_, i) => String(i + 1)).map((tNum) => {
                const tableOrders = activeDineInOrders.filter((o) => String(o.tableNumber) === tNum);
                const isOccupied = tableOrders.length > 0;
                const totalBill = tableOrders.reduce((s, o) => s + o.totalAmount, 0);
                const hasCall = tableRequests.some((r) => String(r.tableNumber) === tNum);
                const hasReady = tableOrders.some((o) => o.status === "ready");

                return (
                  <div
                    key={tNum}
                    onClick={() => {
                      setSelectedTable(tNum);
                      setActiveTab("order");
                    }}
                    className={`rounded-2xl p-3 border transition cursor-pointer flex flex-col justify-between min-h-[104px] ${
                      hasCall
                        ? "bg-red-950/60 border-red-500 animate-pulse"
                        : hasReady
                        ? "bg-emerald-950/60 border-emerald-500"
                        : isOccupied
                        ? "bg-amber-950/40 border-amber-500/60"
                        : "bg-stone-900/70 border-stone-800 hover:border-stone-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">Masa {tNum}</span>
                      {hasCall ? (
                        <span className="text-xs">🔔</span>
                      ) : hasReady ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-stone-950 font-black">
                          HAZIR
                        </span>
                      ) : isOccupied ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
                      )}
                    </div>

                    {isOccupied ? (
                      <div className="mt-2">
                        <div className="text-xs font-black text-amber-300">{formatCurrency(totalBill)}</div>
                        <div className="text-[10px] text-stone-400">
                          {tableOrders.reduce((acc, o) => acc + o.items.reduce((s, it) => s + it.quantity, 0), 0)} ürün • Ekle →
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-stone-500 font-semibold">+ Sipariş Aç</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: FAST ORDER ENTRY */}
        {activeTab === "order" && (
          <div className="space-y-3">
            {/* Table Selector Strip */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400">Masa:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="bg-stone-950 border border-amber-500/50 text-amber-300 font-black text-sm rounded-xl px-3 py-1.5"
                >
                  {Array.from({ length: totalTables }, (_, i) => String(i + 1)).map((tNum) => (
                    <option key={tNum} value={tNum}>
                      Masa {tNum}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Ürün ara..."
                className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Category Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setActiveCategory("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                  activeCategory === "all"
                    ? "bg-amber-500 text-stone-950"
                    : "bg-stone-900 text-stone-300 border border-stone-800"
                }`}
              >
                Tümü
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                    activeCategory === cat.id
                      ? "bg-amber-500 text-stone-950"
                      : "bg-stone-900 text-stone-300 border border-stone-800"
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openItemModal(item)}
                  className="bg-stone-900 hover:bg-stone-800/90 border border-stone-800 rounded-2xl p-3 text-left flex flex-col justify-between transition active:scale-95"
                >
                  <div>
                    <div className="text-xs font-black text-white line-clamp-2">{item.name}</div>
                    {item.dailyStock !== null && item.dailyStock !== undefined && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                        Kalan: {item.dailyStock}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-black text-amber-400">{formatCurrency(item.price)}</span>
                    <span className="w-6 h-6 rounded-lg bg-amber-500 text-stone-950 font-black text-xs flex items-center justify-center">
                      +
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Waiter Cart Box */}
            {cart.length > 0 && (
              <div className="bg-stone-900 border-2 border-amber-500/60 rounded-2xl p-3 space-y-2.5 mt-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-amber-400">
                    📝 Masa {selectedTable} İçin Eklenecekler ({cart.length} Kalem)
                  </h3>
                  <button
                    onClick={() => setCart([])}
                    className="text-[11px] text-red-400 font-bold hover:underline"
                  >
                    Temizle
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {cart.map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-stone-950/80 px-2.5 py-2 rounded-xl text-xs"
                    >
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-white">
                          {c.quantity}x {c.name}
                        </div>
                        {c.selectedModifiers.length > 0 && (
                          <div className="text-[10px] text-stone-400">
                            {c.selectedModifiers.map((m) => m.optionName).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-amber-300">{formatCurrency(c.totalPrice)}</span>
                        <button
                          onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 font-black px-1.5"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <input
                  type="text"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Garson mutfak notu (opsiyonel)..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white"
                />
                <button
                  onClick={handleSendTableOrder}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-sm shadow-lg transition"
                >
                  {submitting
                    ? "Mutfağa İletiliyor..."
                    : `🚀 Mutfağa Gönder (${formatCurrency(
                        cart.reduce((s, i) => s + i.totalPrice, 0)
                      )})`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ALERTS & READY TO SERVE */}
        {activeTab === "alerts" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-sm font-black text-red-400">🔔 Aktif Masa Çağrıları ({tableRequests.length})</h2>
              {tableRequests.length === 0 ? (
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-xs text-stone-400 text-center">
                  Bekleyen masa çağrısı yok.
                </div>
              ) : (
                tableRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-red-950/40 border border-red-500/50 rounded-2xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-black text-white">Masa {req.tableNumber}</div>
                      <div className="text-xs text-red-200 font-semibold">
                        {req.type === "bill_cash"
                          ? "💵 Hesap İstiyor (Nakit)"
                          : req.type === "bill_card"
                          ? "💳 Hesap İstiyor (Kart / POS)"
                          : "🙋‍♂️ Garson Çağırıyor"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleResolveRequest(req.id)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 text-stone-950 font-black text-xs"
                    >
                      ✓ İlgilenildi
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-black text-emerald-400">
                🍽️ Mutfakta Hazır - Masaya Servis Bekleyenler ({readyTableOrders.length})
              </h2>
              {readyTableOrders.length === 0 ? (
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-xs text-stone-400 text-center">
                  Mutfakta bekleyen hazır masa siparişi yok.
                </div>
              ) : (
                readyTableOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">
                        Masa {ord.tableNumber} (#{ord.orderNumber})
                      </span>
                      <span className="text-xs font-black text-emerald-300">{formatCurrency(ord.totalAmount)}</span>
                    </div>
                    <div className="text-xs text-stone-300 space-y-0.5">
                      {ord.items.map((it) => (
                        <div key={it.id}>
                          • {it.quantity}x {it.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modifier Modal */}
      {selectedItemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-stone-900 border-t sm:border border-stone-700 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">{selectedItemModal.name}</h3>
                <p className="text-xs text-amber-400 font-bold">{formatCurrency(selectedItemModal.price)}</p>
              </div>
              <button
                onClick={() => setSelectedItemModal(null)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {selectedItemModal.modifierGroups.map((grp) => {
                const chosen = modalSelections[grp.id] || [];
                return (
                  <div key={grp.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-stone-200">
                        {grp.productTag ? `${grp.productTag} - ` : ""}
                        {grp.name}
                      </span>
                      {grp.required && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                          Zorunlu
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {grp.options.map((opt) => {
                        const isSelected = chosen.some((o) => o.id === opt.id);
                        const subKey = `${grp.id}__${opt.id}`;
                        const chosenSubs = modalSubSelections[subKey] || [];
                        return (
                          <div key={opt.id} className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() => toggleModifierOption(grp.id, opt, grp.multiSelect)}
                              className={`w-full px-3 py-2 rounded-xl border text-left text-xs flex items-center justify-between ${
                                isSelected
                                  ? "bg-amber-500/20 border-amber-500 text-white font-bold"
                                  : "bg-stone-950 border-stone-800 text-stone-300"
                              }`}
                            >
                              <span>{opt.name}</span>
                              {opt.price > 0 && <span className="text-amber-400">+{formatCurrency(opt.price)}</span>}
                            </button>

                            {isSelected && opt.subOptions && opt.subOptions.length > 0 && (
                              <div className="pl-4 space-y-1 border-l-2 border-amber-500/40">
                                <div className="text-[10px] text-amber-300 font-bold">
                                  ↳ {opt.name} Ekstraları:
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {opt.subOptions.map((sub) => {
                                    const subPicked = chosenSubs.some((s) => s.id === sub.id);
                                    return (
                                      <button
                                        key={sub.id}
                                        type="button"
                                        onClick={() => toggleSubOption(subKey, sub)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] border ${
                                          subPicked
                                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-200 font-bold"
                                            : "bg-stone-950 border-stone-800 text-stone-400"
                                        }`}
                                      >
                                        {sub.name} {sub.price > 0 ? `+${formatCurrency(sub.price)}` : ""}
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

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-400">Ürün Notu</label>
                <input
                  type="text"
                  value={modalItemNote}
                  onChange={(e) => setModalItemNote(e.target.value)}
                  placeholder="Örn: Soğansız, az pişmiş..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white"
                />
              </div>
            </div>

            <div className="p-4 border-t border-stone-800 flex items-center gap-3 bg-stone-950">
              <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-xl px-2 py-1">
                <button
                  type="button"
                  onClick={() => setModalQuantity((q) => Math.max(1, q - 1))}
                  className="w-7 h-7 rounded-lg bg-stone-800 text-white font-black"
                >
                  -
                </button>
                <span className="text-sm font-black px-2">{modalQuantity}</span>
                <button
                  type="button"
                  onClick={() => setModalQuantity((q) => q + 1)}
                  className="w-7 h-7 rounded-lg bg-stone-800 text-white font-black"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={addItemToWaiterCart}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs"
              >
                Masaya Ekle →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Mobile Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-stone-900/95 backdrop-blur border-t border-stone-800 grid grid-cols-3 p-2 max-w-2xl mx-auto">
        <button
          onClick={() => setActiveTab("tables")}
          className={`py-2 rounded-xl flex flex-col items-center justify-center text-xs font-black ${
            activeTab === "tables" ? "bg-amber-500 text-stone-950" : "text-stone-400"
          }`}
        >
          <span>🪑 Masalar</span>
        </button>
        <button
          onClick={() => setActiveTab("order")}
          className={`py-2 rounded-xl flex flex-col items-center justify-center text-xs font-black ${
            activeTab === "order" ? "bg-amber-500 text-stone-950" : "text-stone-400"
          }`}
        >
          <span>➕ Sipariş Al ({cart.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("alerts")}
          className={`py-2 rounded-xl flex flex-col items-center justify-center text-xs font-black relative ${
            activeTab === "alerts" ? "bg-amber-500 text-stone-950" : "text-stone-400"
          }`}
        >
          <span>🔔 Çağrılar ({alertCount})</span>
        </button>
      </nav>
    </div>
  );
}
