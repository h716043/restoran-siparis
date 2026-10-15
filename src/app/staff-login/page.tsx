"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  ChefHat,
  Settings,
  ArrowLeft,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
} from "lucide-react";

function StaffLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTarget =
    searchParams.get("target") === "admin" ? "admin" : "kitchen";
  const redirectPath =
    searchParams.get("redirect") ||
    (initialTarget === "admin" ? "/admin" : "/kitchen");

  const [target, setTarget] = useState<"admin" | "kitchen">(initialTarget);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/staff-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, target }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Şifre hatalı!");
      } else {
        const dest =
          target === "admin"
            ? "/admin"
            : redirectPath.startsWith("/kitchen")
            ? redirectPath
            : "/kitchen";
        router.push(dest);
        router.refresh();
      }
    } catch {
      setError("Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Üst Başlık */}
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800 text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-white">
            Yetkili Personel & Yönetici Girişi
          </h1>
          <p className="text-xs text-slate-400">
            Bu alan şifre korumalıdır. Lütfen giriş yapmak istediğiniz paneli
            seçin.
          </p>
        </div>

        {/* Panel Seçici (Mutfak vs Admin) */}
        <div className="p-4 pb-0">
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setTarget("kitchen");
                setError("");
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                target === "kitchen"
                  ? "bg-orange-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ChefHat className="w-4 h-4" />
              Mutfak / Kasa Ekranı
            </button>
            <button
              type="button"
              onClick={() => {
                setTarget("admin");
                setError("");
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                target === "admin"
                  ? "bg-orange-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              Yönetim (Admin)
            </button>
          </div>
        </div>

        {/* Şifre Formu */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {target === "admin"
                ? "Yönetici (Admin) Şifresi *"
                : "Mutfak / Kasa PIN veya Şifresi *"}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                autoFocus
                placeholder={
                  target === "admin"
                    ? "Yönetici şifrenizi girin..."
                    : "Mutfak PIN kodunu girin..."
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              💡 İlk kurulum varsayılan şifreleri:{" "}
              {target === "admin" ? (
                <strong className="text-slate-300">admin1234</strong>
              ) : (
                <strong className="text-slate-300">1234</strong>
              )}{" "}
              (Yönetim panelinden değiştirebilirsiniz).
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-orange-600/20"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {loading
                ? "Kontrol Ediliyor..."
                : target === "admin"
                ? "Yönetim Paneline Giriş Yap"
                : "Mutfak Ekranına Giriş Yap"}
            </span>
          </button>

          <div className="pt-2 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Müşteri Sipariş Menüsüne Dön
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
          Yükleniyor...
        </div>
      }
    >
      <StaffLoginContent />
    </Suspense>
  );
}
