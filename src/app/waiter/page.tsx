"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

function getElapsedMinutes(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.max(1, Math.floor(diff / 60000));
}

const QUICK_WAITER_NOTES = [
  "🔥 Acil / Öncelikli",
  "🧊 İçecekler Hemen Gelsin",
  "🥗 Önden Salata / Meze",
  "🍞 Bol Ekmek / Lavaş",
  "👶 Çocuklu Masa",
  "🎂 Doğum Günü / İkram",
  "🥡 Paket Yapılacak",
];

export default function WaiterTerminalPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tableRequests, setTableRequests] = useState<TableCall[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  const [activeTab, setActiveTab] = useState<
    "tables" | "order" | "bill" | "alerts"
  >("tables");
  const [selectedTable, setSelectedTable] = useState<string>("1");
  const [tableFilter, setTableFilter] = useState<
    "all" | "occupied" | "empty" | "ready" | "calls"
  >("all");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [waiterName, setWaiterName] = useState<string>("Garson");

  // Sound notification state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const prevAlertSignatureRef = useRef<string>("");

  // Cart & Modifier Modal for Waiter POS
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [selectedItemModal, setSelectedItemModal] = useState<MenuItem | null>(
    null
  );
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalItemNote, setModalItemNote] = useState("");
  const [modalSelections, setModalSelections] = useState<
    Record<string, ModifierOption[]>
  >({});
  const [modalSubSelections, setModalSubSelections] = useState<
    Record<string, ModifierOption[]>
  >({});

  // Bill / Table Management States (Tab 3)
  const [transferTargetTable, setTransferTargetTable] = useState<string>("");
  const [billPaymentMethod, setBillPaymentMethod] = useState<
    "cash" | "card" | "split" | "credit"
  >("cash");
  const [billDiscountInput, setBillDiscountInput] = useState<string>("");
  const [splitCashInput, setSplitCashInput] = useState<string>("");
  const [splitCardInput, setSplitCardInput] = useState<string>("");
  const [creditCustomerName, setCreditCustomerName] = useState<string>("");
  const [selectedCreditAccountId, setSelectedCreditAccountId] =
    useState<string>("");
  const [splitPeopleCount, setSplitPeopleCount] = useState<number>(2);
  const [checkedBillItemIds, setCheckedBillItemIds] = useState<string[]>([]);
  const [processingBill, setProcessingBill] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Play notification chime via Web Audio API
  const playNotificationBeep = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Ignore audio autoplay blocks
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("restoran_waiter_name");
      if (savedName) setWaiterName(savedName);
      const savedSound = localStorage.getItem("restoran_waiter_sound");
      if (savedSound !== null) setSoundEnabled(savedSound === "1");
    }
    fetch("/api/staff-auth")
      .then((r) => r.json())
      .then((d) => setAuthenticated(Boolean(d.authenticated !== false)))
      .catch(() => setAuthenticated(true));
  }, []);

  const handleWaiterNameChange = (val: string) => {
    setWaiterName(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("restoran_waiter_name", val);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("restoran_waiter_sound", next ? "1" : "0");
    }
    showToast(next ? "🔊 Sesli bildirimler açıldı" : "🔇 Sesli bildirimler kapatıldı");
  };

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
    () =>
      orders.filter(
        (o) =>
          o.orderType === "dine_in" &&
          o.status !== "completed" &&
          o.status !== "rejected"
      ),
    [orders]
  );

  const readyTableOrders = useMemo(
    () => activeDineInOrders.filter((o) => o.status === "ready"),
    [activeDineInOrders]
  );

  // Trigger sound when a new table call or newly ready order appears
  useEffect(() => {
    const sig = [
      ...tableRequests.map((r) => r.id),
      ...readyTableOrders.map((o) => `${o.id}-${o.status}`),
    ]
      .sort()
      .join("|");
    if (
      prevAlertSignatureRef.current &&
      sig !== prevAlertSignatureRef.current &&
      sig.length > prevAlertSignatureRef.current.length
    ) {
      playNotificationBeep();
    }
    prevAlertSignatureRef.current = sig;
  }, [tableRequests, readyTableOrders, playNotificationBeep]);

  // Orders for the currently selected table
  const selectedTableOrders = useMemo(
    () =>
      activeDineInOrders.filter(
        (o) => String(o.tableNumber) === String(selectedTable)
      ),
    [activeDineInOrders, selectedTable]
  );

  const selectedTableSubtotal = useMemo(
    () => selectedTableOrders.reduce((s, o) => s + o.subtotal, 0),
    [selectedTableOrders]
  );

  const selectedTableExistingDiscount = useMemo(
    () => selectedTableOrders.reduce((s, o) => s + (o.discountAmount || 0), 0),
    [selectedTableOrders]
  );

  const selectedTableTotal = useMemo(
    () => selectedTableOrders.reduce((s, o) => s + o.totalAmount, 0),
    [selectedTableOrders]
  );

  const extraDiscountAmount = Math.max(0, Number(billDiscountInput || 0));
  const netPayableBillAmount = Math.max(
    0,
    selectedTableTotal - extraDiscountAmount
  );

  // Flat list of items across all open orders of the selected table
  const selectedTableAllItems = useMemo(() => {
    return selectedTableOrders.flatMap((ord) =>
      ord.items.map((item) => ({
        ...item,
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        orderStatus: ord.status,
      }))
    );
  }, [selectedTableOrders]);

  const checkedItemsSubtotal = useMemo(() => {
    return selectedTableAllItems
      .filter((it) => checkedBillItemIds.includes(`${it.orderId}__${it.id}`))
      .reduce((s, it) => s + it.totalPrice, 0);
  }, [selectedTableAllItems, checkedBillItemIds]);

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

  const toggleModifierOption = (
    groupId: string,
    option: ModifierOption,
    multiSelect: boolean
  ) => {
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
      const isRemoval =
        grp.name.toLowerCase().includes("çıkar") ||
        grp.name.toLowerCase().includes("istemiyorum");
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
    showToast(`✅ ${newItem.quantity}x ${newItem.name} sepete eklendi`);
  };

  const updateCartItemQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      const nextQty = item.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return prev.map((c, i) =>
        i === idx
          ? {
              ...c,
              quantity: nextQty,
              totalPrice: Number((c.unitPrice * nextQty).toFixed(2)),
            }
          : c
      );
    });
  };

  const appendQuickWaiterNote = (tag: string) => {
    setOrderNote((prev) => {
      if (prev.includes(tag)) return prev;
      return prev.trim() ? `${prev.trim()} • ${tag}` : tag;
    });
  };

  const handleSendTableOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const staffLabel = waiterName.trim() || "Garson";
      const combinedNote = [
        orderNote.trim(),
        `Garson: ${staffLabel}`,
      ]
        .filter(Boolean)
        .join(" | ");

      // Eğer masada zaten açık bir sipariş varsa ona ekle (append_items)
      if (selectedTableOrders.length > 0) {
        const primaryOrder = selectedTableOrders[0];
        const res = await fetch(`/api/orders/${primaryOrder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "append_items",
            items: cart,
            extraNote: combinedNote,
          }),
        });
        if (res.ok) {
          setCart([]);
          setOrderNote("");
          await fetchAllData();
          showToast(
            `🚀 Masa ${selectedTable} açık adisyonuna ek ürünler eklendi ve mutfağa iletildi!`
          );
          setActiveTab("bill");
        } else {
          const err = await res.json();
          alert(err.error || "Ek sipariş gönderilemedi.");
        }
        return;
      }

      // Masada açık sipariş yoksa yeni adisyon aç
      const subtotalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType: "dine_in",
          tableNumber: selectedTable,
          customerName: `Masa ${selectedTable} (${staffLabel})`,
          customerPhone: "05000000000",
          paymentMethod: "pos_at_table",
          orderNote: combinedNote || undefined,
          subtotal: subtotalAmount,
          discountAmount: 0,
          deliveryFee: 0,
          totalAmount: subtotalAmount,
          isStaffPosOrder: true,
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

  const handleRemoveOrDecrementBillItem = async (
    orderId: string,
    itemId: string,
    decrementOnly: boolean
  ) => {
    setProcessingBill(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_order_item",
          itemId,
          decrementOnly,
        }),
      });
      if (res.ok) {
        await fetchAllData();
        showToast(
          decrementOnly
            ? "➖ Ürün adedi 1 düşürüldü"
            : "🗑️ Ürün adisyondan iptal edildi"
        );
      }
    } finally {
      setProcessingBill(false);
    }
  };

  const handleToggleItemServed = async (orderId: string, itemId: string) => {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_item_prepared",
        itemId,
      }),
    });
    if (res.ok) {
      await fetchAllData();
    }
  };

  const handleTransferTable = async () => {
    if (!transferTargetTable || transferTargetTable === selectedTable) return;
    setProcessingBill(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer_table",
          fromTable: selectedTable,
          toTable: transferTargetTable,
        }),
      });
      if (res.ok) {
        const target = transferTargetTable;
        setTransferTargetTable("");
        setSelectedTable(target);
        await fetchAllData();
        showToast(`🔄 Masa ${selectedTable} → Masa ${target} taşındı/birleştirildi!`);
      }
    } finally {
      setProcessingBill(false);
    }
  };

  const handleCloseTableBill = async () => {
    if (selectedTableOrders.length === 0) return;

    let mappedMethod: Order["paymentMethod"] = "cash";
    let cashAmt: number | undefined = undefined;
    let cardAmt: number | undefined = undefined;

    if (billPaymentMethod === "cash") {
      mappedMethod = "cash";
    } else if (billPaymentMethod === "card") {
      mappedMethod = "pos_at_table";
    } else if (billPaymentMethod === "split") {
      mappedMethod = "pos_at_table";
      cashAmt = Math.max(0, Number(splitCashInput || 0));
      cardAmt = Math.max(0, Number(splitCardInput || 0));
      if (cashAmt + cardAmt <= 0) {
        alert("Lütfen parçalı ödeme için Nakit ve/veya Kart tutarını giriniz.");
        return;
      }
    } else if (billPaymentMethod === "credit") {
      mappedMethod = "credit";
      if (!selectedCreditAccountId && !creditCustomerName.trim()) {
        alert("Veresiye / Cari kapama için müşteri seçin veya isim yazın.");
        return;
      }
    }

    setProcessingBill(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close_table_payment",
          tableNumber: selectedTable,
          paymentMethod: mappedMethod,
          discountAmount: extraDiscountAmount > 0 ? extraDiscountAmount : undefined,
          cashAmount: cashAmt,
          cardAmount: cardAmt,
          creditAccountId: selectedCreditAccountId || undefined,
          creditAccountName: creditCustomerName.trim() || undefined,
        }),
      });
      if (res.ok) {
        setBillDiscountInput("");
        setSplitCashInput("");
        setSplitCardInput("");
        setCheckedBillItemIds([]);
        await fetchAllData();
        showToast(`✅ Masa ${selectedTable} hesabı kapatıldı!`);
        setActiveTab("tables");
      } else {
        const err = await res.json();
        alert(err.error || "Hesap kapatılamadı.");
      }
    } finally {
      setProcessingBill(false);
    }
  };

  const handlePrintTableBill = () => {
    if (selectedTableOrders.length === 0 || typeof window === "undefined") return;
    const win = window.open("", "_blank", "width=360,height=640");
    if (!win) return;
    const rowsHtml = selectedTableAllItems
      .map(
        (it) => `
        <tr>
          <td style="padding:4px 0;font-weight:bold;">${it.quantity}x ${it.name}${
          it.selectedModifiers.length > 0
            ? `<div style="font-size:11px;color:#555;font-weight:normal;">${it.selectedModifiers
                .map((m) => m.optionName)
                .join(", ")}</div>`
            : ""
        }</td>
          <td style="padding:4px 0;text-align:right;font-weight:bold;">${formatCurrency(
            it.totalPrice
          )}</td>
        </tr>`
      )
      .join("");

    win.document.write(`
      <html>
        <head>
          <title>Masa ${selectedTable} Adisyon Fişi</title>
          <style>
            body { font-family: monospace; width: 280px; margin: 0 auto; padding: 12px; color: #000; }
            h2, h3, p { margin: 4px 0; text-align: center; }
            hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
          </style>
        </head>
        <body>
          <h2>${settings?.name || "RESTORAN POS"}</h2>
          <h3>MASA ${selectedTable} ADİSYON</h3>
          <p style="font-size:11px;">Tarih: ${new Date().toLocaleString("tr-TR")} • Garson: ${waiterName}</p>
          <hr />
          <table>${rowsHtml}</table>
          <hr />
          <table>
            <tr><td>Ara Toplam:</td><td style="text-align:right;">${formatCurrency(selectedTableSubtotal)}</td></tr>
            ${
              selectedTableExistingDiscount + extraDiscountAmount > 0
                ? `<tr><td>İndirim / İkram:</td><td style="text-align:right;">-${formatCurrency(
                    selectedTableExistingDiscount + extraDiscountAmount
                  )}</td></tr>`
                : ""
            }
            <tr style="font-size:16px;font-weight:bold;">
              <td>GENEL TOPLAM:</td>
              <td style="text-align:right;">${formatCurrency(netPayableBillAmount)}</td>
            </tr>
          </table>
          <hr />
          <p style="font-size:11px;">Afiyet Olsun!</p>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); };</script>
        </body>
      </html>
    `);
    win.document.close();
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
      if (activeCategory !== "all" && item.categoryId !== activeCategory)
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [menuItems, activeCategory, searchQuery]);

  // Summary metrics for top dashboard strip
  const occupiedTableNumbers = useMemo(
    () => new Set(activeDineInOrders.map((o) => String(o.tableNumber))),
    [activeDineInOrders]
  );
  const totalOpenSalonRevenue = useMemo(
    () => activeDineInOrders.reduce((s, o) => s + o.totalAmount, 0),
    [activeDineInOrders]
  );

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center">
        <div className="text-sm text-stone-400 animate-pulse">
          Garson Terminali Yükleniyor...
        </div>
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
            <h1 className="text-xl font-black">Garson Cep & Salon Terminali</h1>
            <p className="text-xs text-stone-400">
              Masa yönetimi, adisyon ve sipariş ekranı için PIN giriniz
            </p>
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

  const alertCount = tableRequests.length + readyTableOrders.length;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-28">
      {/* Top Bar */}
      <header className="bg-stone-900/95 backdrop-blur border-b border-stone-800 px-3 sm:px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg shrink-0">
            📱
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-white truncate">
                Garson Terminali
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[11px] font-black text-amber-300">
                Masa {selectedTable}
              </span>
            </div>
            <p className="text-[11px] text-stone-400 truncate">
              Dolu: <strong className="text-white">{occupiedTableNumbers.size}/{totalTables}</strong> • Açık Ciro:{" "}
              <strong className="text-emerald-400">
                {formatCurrency(totalOpenSalonRevenue)}
              </strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="text"
            value={waiterName}
            onChange={(e) => handleWaiterNameChange(e.target.value)}
            placeholder="Garson Adı"
            title="Aktif Garson Adı"
            className="w-24 sm:w-28 px-2.5 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px] font-bold text-amber-300 focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={toggleSound}
            title="Sesli Bildirim Zili"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${
              soundEnabled
                ? "bg-emerald-950/60 border-emerald-600/50 text-emerald-300"
                : "bg-stone-800 border-stone-700 text-stone-400"
            }`}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
          <Link
            href="/kitchen"
            className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-bold text-stone-200"
          >
            👨‍🍳 Mutfak
          </Link>
        </div>
      </header>

      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-full text-xs font-black shadow-2xl border border-emerald-400/40">
          {toastMessage}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-3">
        {/* =========================================================
            TAB 1: SALON & MASALAR (CANLI MASA HARİTASI)
           ========================================================= */}
        {activeTab === "tables" && (
          <div className="space-y-3">
            {/* Live Salon Summary Strip */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-2.5 text-center">
                <div className="text-[10px] text-stone-400 font-bold">DOLU MASA</div>
                <div className="text-base font-black text-amber-400">
                  {occupiedTableNumbers.size} / {totalTables}
                </div>
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-2.5 text-center">
                <div className="text-[10px] text-stone-400 font-bold">SALON CİRO</div>
                <div className="text-sm sm:text-base font-black text-emerald-400 truncate">
                  {formatCurrency(totalOpenSalonRevenue)}
                </div>
              </div>
              <div
                onClick={() => setActiveTab("alerts")}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-2.5 text-center cursor-pointer hover:border-emerald-500/50"
              >
                <div className="text-[10px] text-stone-400 font-bold">SERVİSE HAZIR</div>
                <div className="text-base font-black text-emerald-300">
                  🍽️ {readyTableOrders.length}
                </div>
              </div>
              <div
                onClick={() => setActiveTab("alerts")}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-2.5 text-center cursor-pointer hover:border-red-500/50"
              >
                <div className="text-[10px] text-stone-400 font-bold">MASA ÇAĞRISI</div>
                <div className="text-base font-black text-red-400">
                  🔔 {tableRequests.length}
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: "all", label: `Tüm Masalar (${totalTables})` },
                { id: "occupied", label: `🟠 Dolu (${occupiedTableNumbers.size})` },
                {
                  id: "empty",
                  label: `🟢 Boş (${Math.max(0, totalTables - occupiedTableNumbers.size)})`,
                },
                { id: "ready", label: `🍽️ Hazır (${readyTableOrders.length})` },
                { id: "calls", label: `🔴 Çağrı (${tableRequests.length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    setTableFilter(
                      f.id as "all" | "occupied" | "empty" | "ready" | "calls"
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    tableFilter === f.id
                      ? "bg-amber-500 text-stone-950 font-black"
                      : "bg-stone-900 text-stone-300 border border-stone-800"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {Array.from({ length: totalTables }, (_, i) => String(i + 1))
                .filter((tNum) => {
                  const tableOrders = activeDineInOrders.filter(
                    (o) => String(o.tableNumber) === tNum
                  );
                  const isOccupied = tableOrders.length > 0;
                  const hasCall = tableRequests.some(
                    (r) => String(r.tableNumber) === tNum
                  );
                  const hasReady = tableOrders.some((o) => o.status === "ready");
                  if (tableFilter === "occupied") return isOccupied;
                  if (tableFilter === "empty") return !isOccupied;
                  if (tableFilter === "ready") return hasReady;
                  if (tableFilter === "calls") return hasCall;
                  return true;
                })
                .map((tNum) => {
                  const tableOrders = activeDineInOrders.filter(
                    (o) => String(o.tableNumber) === tNum
                  );
                  const isOccupied = tableOrders.length > 0;
                  const totalBill = tableOrders.reduce(
                    (s, o) => s + o.totalAmount,
                    0
                  );
                  const totalItemCount = tableOrders.reduce(
                    (acc, o) =>
                      acc + o.items.reduce((s, it) => s + it.quantity, 0),
                    0
                  );
                  const oldestOrderIso =
                    tableOrders.length > 0
                      ? tableOrders[tableOrders.length - 1].createdAt
                      : null;
                  const elapsedMins = oldestOrderIso
                    ? getElapsedMinutes(oldestOrderIso)
                    : 0;
                  const activeCall = tableRequests.find(
                    (r) => String(r.tableNumber) === tNum
                  );
                  const hasReady = tableOrders.some((o) => o.status === "ready");
                  const isPreparing = tableOrders.some(
                    (o) => o.status === "accepted" || o.status === "pending"
                  );

                  return (
                    <div
                      key={tNum}
                      className={`rounded-2xl p-3 border transition flex flex-col justify-between min-h-[136px] ${
                        activeCall
                          ? "bg-red-950/60 border-red-500 shadow-lg shadow-red-950/50"
                          : hasReady
                          ? "bg-emerald-950/60 border-emerald-500 shadow-lg shadow-emerald-950/40"
                          : isOccupied
                          ? "bg-amber-950/35 border-amber-500/60"
                          : "bg-stone-900/70 border-stone-800 hover:border-stone-700"
                      }`}
                    >
                      {/* Top Header */}
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-black text-white">
                            Masa {tNum}
                          </span>
                          {activeCall ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white font-black animate-pulse">
                              🔔{" "}
                              {activeCall.type === "bill_cash"
                                ? "NAKİT HESAP"
                                : activeCall.type === "bill_card"
                                ? "KART HESAP"
                                : "ÇAĞRI"}
                            </span>
                          ) : hasReady ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-stone-950 font-black">
                              🍽️ HAZIR
                            </span>
                          ) : isPreparing ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                              👨‍🍳 Ocakta
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-bold">
                              Boş
                            </span>
                          )}
                        </div>

                        {isOccupied ? (
                          <div className="mt-2 space-y-0.5">
                            <div className="text-sm font-black text-amber-300">
                              {formatCurrency(totalBill)}
                            </div>
                            <div className="text-[11px] text-stone-300 flex items-center justify-between">
                              <span>{totalItemCount} ürün</span>
                              <span className="text-stone-400">
                                ⏱️ {elapsedMins} dk
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-xs text-stone-500 font-medium">
                            Açık adisyon yok
                          </div>
                        )}
                      </div>

                      {/* Quick Action Buttons on Table Card */}
                      <div className="mt-3 pt-2 border-t border-stone-800/80 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTable(tNum);
                            setActiveTab("order");
                          }}
                          className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-[11px] transition"
                        >
                          {isOccupied ? "➕ Ürün Ekle" : "➕ Sipariş Aç"}
                        </button>
                        {isOccupied && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTable(tNum);
                              setActiveTab("bill");
                            }}
                            className="flex-1 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 font-bold text-[11px] border border-stone-700 transition"
                          >
                            🧾 Adisyon
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: HIZLI SİPARİŞ AL (ÜRÜN, PORSİYON, EKSTRA, NOT)
           ========================================================= */}
        {activeTab === "order" && (
          <div className="space-y-3">
            {/* Table Selector & Active Bill Banner */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-400">Masa:</span>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="bg-stone-950 border border-amber-500/50 text-amber-300 font-black text-sm rounded-xl px-3 py-1.5"
                  >
                    {Array.from({ length: totalTables }, (_, i) =>
                      String(i + 1)
                    ).map((tNum) => (
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
                  placeholder="🔍 Ürün veya menü ara..."
                  className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {selectedTableOrders.length > 0 && (
                <div className="flex items-center justify-between bg-amber-950/40 border border-amber-500/40 rounded-xl px-3 py-2 text-xs">
                  <div>
                    <span className="text-amber-300 font-black">
                      Masa {selectedTable} Açık Adisyon:{" "}
                      {formatCurrency(selectedTableTotal)}
                    </span>
                    <span className="text-stone-400 ml-2 text-[11px]">
                      ({selectedTableAllItems.reduce((s, i) => s + i.quantity, 0)}{" "}
                      ürün)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("bill")}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-200 font-bold text-[11px]"
                  >
                    🧾 Adisyonu Gör →
                  </button>
                </div>
              )}
            </div>

            {/* Category Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                  activeCategory === "all"
                    ? "bg-amber-500 text-stone-950 font-black"
                    : "bg-stone-900 text-stone-300 border border-stone-800"
                }`}
              >
                Tümü
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                    activeCategory === cat.id
                      ? "bg-amber-500 text-stone-950 font-black"
                      : "bg-stone-900 text-stone-300 border border-stone-800"
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredItems.map((item) => {
                const inCartQty = cart
                  .filter((c) => c.menuItemId === item.id)
                  .reduce((s, c) => s + c.quantity, 0);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItemModal(item)}
                    className={`bg-stone-900 hover:bg-stone-800/90 border rounded-2xl p-3 text-left flex flex-col justify-between transition active:scale-95 ${
                      inCartQty > 0
                        ? "border-amber-500/80 bg-amber-950/20"
                        : "border-stone-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <div className="text-xs font-black text-white line-clamp-2">
                          {item.name}
                        </div>
                        {inCartQty > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-stone-950 font-black text-[10px] shrink-0">
                            {inCartQty}x
                          </span>
                        )}
                      </div>
                      {item.dailyStock !== null &&
                        item.dailyStock !== undefined && (
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                            Stok: {item.dailyStock}
                          </span>
                        )}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-xs font-black text-amber-400">
                        {formatCurrency(item.price)}
                      </span>
                      <span className="w-6 h-6 rounded-lg bg-amber-500 text-stone-950 font-black text-xs flex items-center justify-center">
                        +
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Waiter Cart Box */}
            {cart.length > 0 && (
              <div className="bg-stone-900 border-2 border-amber-500/70 rounded-2xl p-3.5 space-y-3 mt-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-amber-400">
                    📝 Masa {selectedTable} Sepeti (
                    {cart.reduce((s, i) => s + i.quantity, 0)} Adet)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-[11px] text-red-400 font-bold hover:underline"
                  >
                    Sepeti Boşalt
                  </button>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {cart.map((c, idx) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-stone-950/90 px-3 py-2 rounded-xl text-xs border border-stone-800"
                    >
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-white">{c.name}</div>
                        {c.selectedModifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.selectedModifiers.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300"
                              >
                                {m.productTag ? `${m.productTag}: ` : ""}
                                {m.optionName}
                              </span>
                            ))}
                          </div>
                        )}
                        {c.itemNote && (
                          <div className="text-[10px] text-amber-300 mt-0.5">
                            📝 Not: {c.itemNote}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 rounded-lg px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartItemQty(idx, -1)}
                            className="w-5 h-5 rounded bg-stone-800 text-white font-black text-xs"
                          >
                            -
                          </button>
                          <span className="text-xs font-black px-1">
                            {c.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartItemQty(idx, 1)}
                            className="w-5 h-5 rounded bg-stone-800 text-white font-black text-xs"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-black text-amber-300 w-16 text-right">
                          {formatCurrency(c.totalPrice)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Waiter Note Chips */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-stone-400">
                    ⚡ Hızlı Garson / Mutfak Notları (Dokun Ekle):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_WAITER_NOTES.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => appendQuickWaiterNote(chip)}
                        className="px-2 py-1 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[10px] text-stone-300 font-semibold"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Garson mutfak notu (opsiyonel)..."
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendTableOrder}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-sm shadow-lg transition"
                >
                  {submitting
                    ? "Mutfağa İletiliyor..."
                    : selectedTableOrders.length > 0
                    ? `🚀 Açık Adisyona Ekle & Mutfağa Gönder (+${formatCurrency(
                        cart.reduce((s, i) => s + i.totalPrice, 0)
                      )})`
                    : `🚀 Yeni Adisyon Aç & Mutfağa Gönder (${formatCurrency(
                        cart.reduce((s, i) => s + i.totalPrice, 0)
                      )})`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 3: MASA ADİSYONU, TAŞIMA, ALMAN USULÜ & TAHSİLAT
           ========================================================= */}
        {activeTab === "bill" && (
          <div className="space-y-3">
            {/* Table Picker & Print Header */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-400">
                  Seçili Masa:
                </span>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setCheckedBillItemIds([]);
                  }}
                  className="bg-stone-950 border border-amber-500/50 text-amber-300 font-black text-sm rounded-xl px-3 py-1.5"
                >
                  {Array.from({ length: totalTables }, (_, i) =>
                    String(i + 1)
                  ).map((tNum) => {
                    const hasOrd = occupiedTableNumbers.has(tNum);
                    return (
                      <option key={tNum} value={tNum}>
                        Masa {tNum} {hasOrd ? "(Dolu)" : "(Boş)"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("order")}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-stone-950 font-black text-xs"
                >
                  ➕ Ürün Ekle
                </button>
                {selectedTableOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePrintTableBill}
                    className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs border border-stone-700"
                  >
                    🖨️ Adisyon Yazdır
                  </button>
                )}
              </div>
            </div>

            {selectedTableOrders.length === 0 ? (
              <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center space-y-3">
                <div className="text-3xl">🪑</div>
                <div className="text-sm font-black text-white">
                  Masa {selectedTable} Şu Anda Boş
                </div>
                <p className="text-xs text-stone-400">
                  Bu masada açık adisyon bulunmuyor. Hemen yeni sipariş
                  girebilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("order")}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-black text-xs"
                >
                  ➕ Masa {selectedTable} İçin Sipariş Aç
                </button>
              </div>
            ) : (
              <>
                {/* 1. Open Bill Items List with Item Cancel / Decrement / Prepared Status */}
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white">
                        🧾 Masa {selectedTable} Açık Adisyon Kalemleri
                      </h3>
                      <p className="text-[11px] text-stone-400">
                        Alman usulü ara hesap için ürünlerin solundaki kutucuğu
                        işaretleyebilirsiniz
                      </p>
                    </div>
                    <span className="text-sm font-black text-amber-400">
                      {formatCurrency(selectedTableTotal)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedTableAllItems.map((it) => {
                      const compositeKey = `${it.orderId}__${it.id}`;
                      const isChecked =
                        checkedBillItemIds.includes(compositeKey);
                      return (
                        <div
                          key={compositeKey}
                          className={`rounded-xl p-2.5 border flex items-center justify-between gap-2 transition ${
                            isChecked
                              ? "bg-amber-950/30 border-amber-500/60"
                              : "bg-stone-950/90 border-stone-800"
                          }`}
                        >
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() =>
                                setCheckedBillItemIds((prev) =>
                                  prev.includes(compositeKey)
                                    ? prev.filter((k) => k !== compositeKey)
                                    : [...prev, compositeKey]
                                )
                              }
                              className="mt-1 w-4 h-4 accent-amber-500 rounded cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-white">
                                  {it.quantity}x {it.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleItemServed(it.orderId, it.id)
                                  }
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                    it.prepared
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                      : "bg-stone-800 text-stone-400"
                                  }`}
                                >
                                  {it.prepared
                                    ? "✓ Mutfakta Hazır"
                                    : "⏳ Hazırlanıyor"}
                                </button>
                              </div>
                              {it.selectedModifiers.length > 0 && (
                                <div className="text-[10px] text-stone-400 mt-0.5">
                                  {it.selectedModifiers
                                    .map((m) =>
                                      m.productTag
                                        ? `${m.productTag}: ${m.optionName}`
                                        : m.optionName
                                    )
                                    .join(" • ")}
                                </div>
                              )}
                              {it.itemNote && (
                                <div className="text-[10px] text-amber-300">
                                  📝 {it.itemNote}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-black text-amber-300 mr-1">
                              {formatCurrency(it.totalPrice)}
                            </span>
                            {it.quantity > 1 && (
                              <button
                                type="button"
                                disabled={processingBill}
                                onClick={() =>
                                  handleRemoveOrDecrementBillItem(
                                    it.orderId,
                                    it.id,
                                    true
                                  )
                                }
                                title="Adedi 1 Azalt"
                                className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-[10px] font-bold text-stone-200"
                              >
                                -1
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={processingBill}
                              onClick={() =>
                                handleRemoveOrDecrementBillItem(
                                  it.orderId,
                                  it.id,
                                  false
                                )
                              }
                              title="Kalemi İptal Et / Sil"
                              className="px-2 py-1 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-800/60 text-[10px] font-bold text-red-300"
                            >
                              🗑️ İptal
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Split Bill Calculator (Alman Usulü / Kişi Başı veya Seçili Ürünler) */}
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3.5 space-y-2.5">
                  <h4 className="text-xs font-black text-amber-400">
                    🧮 Alman Usulü & Kişi Başı Bölüşüm Hesaplayıcı
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-stone-950 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-stone-400 font-bold">
                          KİŞİ SAYISINA BÖL
                        </div>
                        <div className="text-xs font-black text-white mt-0.5">
                          Kişi Başı:{" "}
                          <span className="text-emerald-400">
                            {formatCurrency(
                              netPayableBillAmount /
                                Math.max(1, splitPeopleCount)
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSplitPeopleCount((c) => Math.max(1, c - 1))
                          }
                          className="w-7 h-7 rounded-lg bg-stone-800 text-white font-black text-xs"
                        >
                          -
                        </button>
                        <span className="text-xs font-black px-1.5">
                          {splitPeopleCount} Kişi
                        </span>
                        <button
                          type="button"
                          onClick={() => setSplitPeopleCount((c) => c + 1)}
                          className="w-7 h-7 rounded-lg bg-stone-800 text-white font-black text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="bg-stone-950 border border-stone-800 rounded-xl p-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-stone-400 font-bold">
                          SEÇİLEN ÜRÜNLER TOPLAMI ({checkedBillItemIds.length}{" "}
                          Kalem)
                        </div>
                        <div className="text-xs font-black text-amber-300 mt-0.5">
                          {formatCurrency(checkedItemsSubtotal)}
                        </div>
                      </div>
                      {checkedBillItemIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setBillPaymentMethod("split");
                            setSplitCardInput(
                              checkedItemsSubtotal.toFixed(2)
                            );
                            setSplitCashInput(
                              Math.max(
                                0,
                                netPayableBillAmount - checkedItemsSubtotal
                              ).toFixed(2)
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-[10px] font-bold text-amber-300"
                        >
                          Parçalıya Aktar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Table Transfer / Merge (Masa Taşı veya Birleştir) */}
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-3.5 space-y-2">
                  <h4 className="text-xs font-black text-sky-400">
                    🔄 Masa Taşı / Başka Masayla Birleştir
                  </h4>
                  <div className="flex items-center gap-2">
                    <select
                      value={transferTargetTable}
                      onChange={(e) => setTransferTargetTable(e.target.value)}
                      className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white font-bold"
                    >
                      <option value="">Hedef Masayı Seçin...</option>
                      {Array.from({ length: totalTables }, (_, i) =>
                        String(i + 1)
                      )
                        .filter((t) => t !== selectedTable)
                        .map((t) => {
                          const isOcc = occupiedTableNumbers.has(t);
                          return (
                            <option key={t} value={t}>
                              Masa {t}{" "}
                              {isOcc
                                ? "(Dolu - Hesapları Birleştir)"
                                : "(Boş - Masayı Taşı)"}
                            </option>
                          );
                        })}
                    </select>
                    <button
                      type="button"
                      disabled={!transferTargetTable || processingBill}
                      onClick={handleTransferTable}
                      className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-stone-950 font-black text-xs"
                    >
                      Taşı / Birleştir →
                    </button>
                  </div>
                </div>

                {/* 4. Close Table Payment Box (Garson Tahsilat & Hesap Kapama) */}
                <div className="bg-stone-900 border-2 border-emerald-500/60 rounded-2xl p-4 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-emerald-400">
                      💳 Masa {selectedTable} Tahsilat & Hesap Kapat
                    </h4>
                    <div className="text-right">
                      <div className="text-[10px] text-stone-400">
                        Ödenecek Net Tutar
                      </div>
                      <div className="text-base font-black text-white">
                        {formatCurrency(netPayableBillAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Discount Input & Quick % */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={billDiscountInput}
                      onChange={(e) => setBillDiscountInput(e.target.value)}
                      placeholder="İndirim / İkram Tutarı (₺)"
                      className="flex-1 min-w-[150px] bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setBillDiscountInput(
                          Math.round(selectedTableTotal * 0.1).toString()
                        )
                      }
                      className="px-2.5 py-2 rounded-xl bg-stone-800 text-[11px] font-bold text-amber-300"
                    >
                      %10 İndirim
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBillDiscountInput(
                          Math.round(selectedTableTotal * 0.2).toString()
                        )
                      }
                      className="px-2.5 py-2 rounded-xl bg-stone-800 text-[11px] font-bold text-amber-300"
                    >
                      %20 İndirim
                    </button>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "cash", label: "💵 Nakit" },
                      { id: "card", label: "💳 Kredi Kartı" },
                      { id: "split", label: "⚖️ Parçalı Ödeme" },
                      { id: "credit", label: "📒 Cari / Veresiye" },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() =>
                          setBillPaymentMethod(
                            pm.id as "cash" | "card" | "split" | "credit"
                          )
                        }
                        className={`py-2.5 px-2 rounded-xl text-xs font-black border transition ${
                          billPaymentMethod === pm.id
                            ? "bg-emerald-500 text-stone-950 border-emerald-400"
                            : "bg-stone-950 text-stone-300 border-stone-800"
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>

                  {billPaymentMethod === "split" && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold">
                          Nakit Tahsilat (₺)
                        </label>
                        <input
                          type="number"
                          value={splitCashInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSplitCashInput(val);
                            const remain = Math.max(
                              0,
                              netPayableBillAmount - Number(val || 0)
                            );
                            setSplitCardInput(remain.toFixed(2));
                          }}
                          placeholder="0.00"
                          className="w-full mt-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold">
                          Kart / POS Tahsilat (₺)
                        </label>
                        <input
                          type="number"
                          value={splitCardInput}
                          onChange={(e) => setSplitCardInput(e.target.value)}
                          placeholder="0.00"
                          className="w-full mt-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  {billPaymentMethod === "credit" && (
                    <div className="space-y-2 pt-1">
                      {(settings?.creditAccounts || []).length > 0 && (
                        <select
                          value={selectedCreditAccountId}
                          onChange={(e) => {
                            setSelectedCreditAccountId(e.target.value);
                            const found = settings?.creditAccounts?.find(
                              (a) => a.id === e.target.value
                            );
                            if (found) setCreditCustomerName(found.customerName);
                          }}
                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white"
                        >
                          <option value="">
                            Kayıtlı Cari Hesap Seçin (veya aşağıya yeni isim yazın)
                          </option>
                          {(settings?.creditAccounts || []).map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.customerName} (Bakiye:{" "}
                              {formatCurrency(acc.balance)})
                            </option>
                          ))}
                        </select>
                      )}
                      <input
                        type="text"
                        value={creditCustomerName}
                        onChange={(e) => setCreditCustomerName(e.target.value)}
                        placeholder="Veresiye Müşteri Adı Soyadı..."
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={processingBill}
                    onClick={handleCloseTableBill}
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-sm shadow-lg transition"
                  >
                    {processingBill
                      ? "Hesap Kapatılıyor..."
                      : `✅ Masa ${selectedTable} Hesabını Kapat (${formatCurrency(
                          netPayableBillAmount
                        )})`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 4: ÇAĞRILAR & MUTFAKTA HAZIR SERVİSLER
           ========================================================= */}
        {activeTab === "alerts" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-sm font-black text-red-400">
                🔔 Aktif Masa Çağrıları ({tableRequests.length})
              </h2>
              {tableRequests.length === 0 ? (
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-xs text-stone-400 text-center">
                  Bekleyen masa çağrısı yok.
                </div>
              ) : (
                tableRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-red-950/40 border border-red-500/50 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-sm font-black text-white">
                        Masa {req.tableNumber}
                      </div>
                      <div className="text-xs text-red-200 font-semibold">
                        {req.type === "bill_cash"
                          ? "💵 Hesap İstiyor (Nakit)"
                          : req.type === "bill_card"
                          ? "💳 Hesap İstiyor (Kart / POS)"
                          : "🙋‍♂️ Garson Çağırıyor"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTable(String(req.tableNumber));
                          setBillPaymentMethod(
                            req.type === "bill_card" ? "card" : "cash"
                          );
                          setActiveTab("bill");
                        }}
                        className="px-3 py-2 rounded-xl bg-amber-500 text-stone-950 font-black text-xs"
                      >
                        🧾 Adisyona Git
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveRequest(req.id)}
                        className="px-3 py-2 rounded-xl bg-emerald-500 text-stone-950 font-black text-xs"
                      >
                        ✓ İlgilenildi
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-black text-emerald-400">
                🍽️ Mutfakta Hazır - Masaya Servis Bekleyenler (
                {readyTableOrders.length})
              </h2>
              {readyTableOrders.length === 0 ? (
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 text-xs text-stone-400 text-center">
                  Mutfakta bekleyen hazır masa siparişi yok.
                </div>
              ) : (
                readyTableOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">
                        Masa {ord.tableNumber} (#{ord.orderNumber})
                      </span>
                      <span className="text-xs font-black text-emerald-300">
                        {formatCurrency(ord.totalAmount)}
                      </span>
                    </div>
                    <div className="text-xs text-stone-200 space-y-1">
                      {ord.items.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between bg-stone-950/60 px-2.5 py-1.5 rounded-lg"
                        >
                          <span>
                            • <strong>{it.quantity}x</strong> {it.name}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold">
                            🍽️ Servise Hazır
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTable(String(ord.tableNumber));
                          setActiveTab("bill");
                        }}
                        className="flex-1 py-2 rounded-xl bg-amber-500 text-stone-950 font-black text-xs"
                      >
                        🧾 Masa Adisyonunu Aç / Tahsilat
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTable(String(ord.tableNumber));
                          setActiveTab("order");
                        }}
                        className="px-3 py-2 rounded-xl bg-stone-800 text-stone-200 font-bold text-xs"
                      >
                        ➕ Ek Ürün
                      </button>
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
                <h3 className="text-sm font-black text-white">
                  {selectedItemModal.name}
                </h3>
                <p className="text-xs text-amber-400 font-bold">
                  {formatCurrency(selectedItemModal.price)}
                </p>
              </div>
              <button
                type="button"
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
                              onClick={() =>
                                toggleModifierOption(
                                  grp.id,
                                  opt,
                                  grp.multiSelect
                                )
                              }
                              className={`w-full px-3 py-2 rounded-xl border text-left text-xs flex items-center justify-between ${
                                isSelected
                                  ? "bg-amber-500/20 border-amber-500 text-white font-bold"
                                  : "bg-stone-950 border-stone-800 text-stone-300"
                              }`}
                            >
                              <span>{opt.name}</span>
                              {opt.price > 0 && (
                                <span className="text-amber-400">
                                  +{formatCurrency(opt.price)}
                                </span>
                              )}
                            </button>

                            {isSelected &&
                              opt.subOptions &&
                              opt.subOptions.length > 0 && (
                                <div className="pl-4 space-y-1 border-l-2 border-amber-500/40">
                                  <div className="text-[10px] text-amber-300 font-bold">
                                    ↳ {opt.name} Ekstraları:
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {opt.subOptions.map((sub) => {
                                      const subPicked = chosenSubs.some(
                                        (s) => s.id === sub.id
                                      );
                                      return (
                                        <button
                                          key={sub.id}
                                          type="button"
                                          onClick={() =>
                                            toggleSubOption(subKey, sub)
                                          }
                                          className={`px-2.5 py-1 rounded-lg text-[11px] border ${
                                            subPicked
                                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-200 font-bold"
                                              : "bg-stone-950 border-stone-800 text-stone-400"
                                          }`}
                                        >
                                          {sub.name}{" "}
                                          {sub.price > 0
                                            ? `+${formatCurrency(sub.price)}`
                                            : ""}
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
                <label className="text-xs font-bold text-stone-400">
                  Ürün Notu
                </label>
                <input
                  type="text"
                  value={modalItemNote}
                  onChange={(e) => setModalItemNote(e.target.value)}
                  placeholder="Örn: Soğansız, az pişmiş, acısız..."
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
                Sepete Ekle →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom 4-Tab Mobile Navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-stone-900/95 backdrop-blur border-t border-stone-800 grid grid-cols-4 p-2 gap-1 max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => setActiveTab("tables")}
          className={`py-2 rounded-xl flex flex-col items-center justify-center text-[11px] font-black ${
            activeTab === "tables"
              ? "bg-amber-500 text-stone-950"
              : "text-stone-400"
          }`}
        >
          <span>🪑 Salon ({occupiedTableNumbers.size})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("order")}
          className={`py-2 rounded-xl flex flex-col items-center justify-center text-[11px] font-black ${
            activeTab === "order"
              ? "bg-amber-500 text-stone-950"
              : "text-stone-400"
          }`}
        >
          <span>➕ Sipariş ({cart.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bill")}
          className={`py-2 rounded-xl flex flex-col items-center justify-center text-[11px] font-black ${
            activeTab === "bill"
              ? "bg-amber-500 text-stone-950"
              : "text-stone-400"
          }`}
        >
          <span>🧾 Adisyon (M.{selectedTable})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`py-2 rounded-xl flex flex-col items-center justify-center text-[11px] font-black relative ${
            activeTab === "alerts"
              ? "bg-amber-500 text-stone-950"
              : "text-stone-400"
          }`}
        >
          <span>🔔 Çağrı ({alertCount})</span>
        </button>
      </nav>
    </div>
  );
}
