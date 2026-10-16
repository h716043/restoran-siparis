import { Category, MenuItem, ModifierGroup } from "@/types";

export const CAMPAIGN_CATEGORY: Category = {
  id: "cat-kampanya",
  name: "🎁 Kampanya & Fırsat Menüleri",
  slug: "kampanya-firsat-menuleri",
  sortOrder: 0,
  icon: "Sparkles",
};

export const CAMPAIGN_MENU_ITEMS: MenuItem[] = [
  {
    id: "item-kamp-1",
    categoryId: "cat-kampanya",
    name: "🔥 İkili Kebap & Izgara Ziyafeti (2 Kişilik Kampanya)",
    description:
      "2 adet seçmeli Ana Yemek (Kebap/Izgara) + Ortaya Gavurdağı Salatası + Sıcak Künefe + 2 Adet İçecek! Her ürünün porsiyonunu ve porsiyona özel ekstralarını ayrı ayrı seçebilirsiniz.",
    price: 690,
    imageUrl:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
    available: true,
    popular: true,
    modifierGroups: [
      {
        id: "k1-urun1-porsiyon",
        productTag: "🍖 1. ÜRÜN: 1. Ana Yemek (Kebap / Izgara)",
        name: "1. Ana Yemek & Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k1-u1-p1",
            name: "Zırh Adana Kebap — 1 Porsiyon (Standart 180g)",
            price: 0,
            subOptions: [
              { id: "k1-u1-p1-e1", name: "Ekstra Sıcak Puf Lavaş (2 Adet)", price: 20 },
              { id: "k1-u1-p1-e2", name: "Közlenmiş Biber & Domates İlavesi", price: 30 },
              { id: "k1-u1-p1-e3", name: "Yanına Tekli İçli Köfte", price: 70 },
              { id: "k1-u1-p1-e4", name: "Soğansız Olsun", price: 0 },
              { id: "k1-u1-p1-e5", name: "Az Acılı Olsun", price: 0 },
            ],
          },
          {
            id: "k1-u1-p2",
            name: "Zırh Adana Kebap — 1.5 Porsiyon (Doyuran 270g)",
            price: 130,
            subOptions: [
              { id: "k1-u1-p2-e1", name: "Duble Puf Lavaş & Tırnak Pide Seti", price: 35 },
              { id: "k1-u1-p2-e2", name: "Süzme Yoğurt & İskender Tereyağı Sosu", price: 55 },
              { id: "k1-u1-p2-e3", name: "2 Adet İçli Köfte (Kampanyalı)", price: 120 },
              { id: "k1-u1-p2-e4", name: "Soğansız Olsun", price: 0 },
              { id: "k1-u1-p2-e5", name: "Ekstra Acılı Olsun", price: 0 },
            ],
          },
          {
            id: "k1-u1-p3",
            name: "Yaprak Kuzu Şiş — 1 Porsiyon (Standart)",
            price: 45,
            subOptions: [
              { id: "k1-u1-p3-e1", name: "Kekikli Trabzon Tereyağı Sosu", price: 30 },
              { id: "k1-u1-p3-e2", name: "Közlenmiş Sarımsak & Arpacık Soğan", price: 35 },
              { id: "k1-u1-p3-e3", name: "Ekstra Lavaş", price: 20 },
              { id: "k1-u1-p3-e4", name: "Soğansız Olsun", price: 0 },
            ],
          },
          {
            id: "k1-u1-p4",
            name: "Yaprak Kuzu Şiş — 1.5 Porsiyon (Doyuran)",
            price: 175,
            subOptions: [
              { id: "k1-u1-p4-e1", name: "Süzme Yoğurt Yatağında (Ali Nazik Usulü)", price: 60 },
              { id: "k1-u1-p4-e2", name: "Kaşarlı Fırın Mantar İlavesi", price: 65 },
              { id: "k1-u1-p4-e3", name: "Duble Lavaş & Köz Paket", price: 35 },
              { id: "k1-u1-p4-e4", name: "Soğansız Olsun", price: 0 },
            ],
          },
        ],
      },
      {
        id: "k1-urun2-porsiyon",
        productTag: "🥩 2. ÜRÜN: 2. Ana Yemek (Kebap / Köfte / Kanat)",
        name: "2. Ana Yemek & Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k1-u2-p1",
            name: "Urfa Kebap (Acısız) — 1 Porsiyon (Standart)",
            price: 0,
            subOptions: [
              { id: "k1-u2-p1-e1", name: "Ekstra Sıcak Lavaş", price: 20 },
              { id: "k1-u2-p1-e2", name: "Köz Patlıcan Söğürme", price: 50 },
              { id: "k1-u2-p1-e3", name: "Tekli İçli Köfte", price: 70 },
              { id: "k1-u2-p1-e4", name: "Soğansız Olsun", price: 0 },
            ],
          },
          {
            id: "k1-u2-p2",
            name: "Urfa Kebap (Acısız) — 1.5 Porsiyon (Doyuran)",
            price: 130,
            subOptions: [
              { id: "k1-u2-p2-e1", name: "Duble Lavaş & Köz Biber-Domates", price: 35 },
              { id: "k1-u2-p2-e2", name: "Süzme Yoğurt & Tereyağı", price: 50 },
              { id: "k1-u2-p2-e3", name: "Fındık Lahmacun İlavesi (2 Adet)", price: 90 },
              { id: "k1-u2-p2-e4", name: "Soğansız Olsun", price: 0 },
            ],
          },
          {
            id: "k1-u2-p3",
            name: "Kasap Izgara Köfte — 1 Porsiyon (200g)",
            price: 0,
            subOptions: [
              { id: "k1-u2-p3-e1", name: "Üzerine Eritme Kaşar Peyniri", price: 35 },
              { id: "k1-u2-p3-e2", name: "Baharatlı Patates Kızartması", price: 45 },
              { id: "k1-u2-p3-e3", name: "Ev Yapımı Acı Sos", price: 15 },
              { id: "k1-u2-p3-e4", name: "Soğansız Olsun", price: 0 },
            ],
          },
          {
            id: "k1-u2-p4",
            name: "Kasap Izgara Köfte — 1.5 Porsiyon (300g Doyuran)",
            price: 120,
            subOptions: [
              { id: "k1-u2-p4-e1", name: "Duble Eritme Kaşar & Cheddar", price: 55 },
              { id: "k1-u2-p4-e2", name: "Büyük Boy Patates Kızartması", price: 65 },
              { id: "k1-u2-p4-e3", name: "Süzme Yoğurt", price: 45 },
              { id: "k1-u2-p4-e4", name: "Soğansız Olsun", price: 0 },
            ],
          },
        ],
      },
      {
        id: "k1-urun3-porsiyon",
        productTag: "🥗 3. ÜRÜN: Ortaya Salata & Meze",
        name: "Salata Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k1-u3-p1",
            name: "Gavurdağı Salatası — Standart Porsiyon",
            price: 0,
            subOptions: [
              { id: "k1-u3-p1-e1", name: "Ekstra Bol Ceviz İçi", price: 30 },
              { id: "k1-u3-p1-e2", name: "Ekstra Nar Ekşisi Sosu", price: 15 },
              { id: "k1-u3-p1-e3", name: "Soğansız Hazırlansın", price: 0 },
            ],
          },
          {
            id: "k1-u3-p2",
            name: "Gavurdağı Salatası — Büyük Duble Porsiyon",
            price: 55,
            subOptions: [
              { id: "k1-u3-p2-e1", name: "Duble Ceviz & Erzincan Tulum Peyniri", price: 50 },
              { id: "k1-u3-p2-e2", name: "Yanına Sıcak Humus Porsiyon Ekle", price: 85 },
              { id: "k1-u3-p2-e3", name: "Soğansız Hazırlansın", price: 0 },
            ],
          },
        ],
      },
      {
        id: "k1-urun4-porsiyon",
        productTag: "🍮 4. ÜRÜN: Tatlı & İçecek Paketi",
        name: "Tatlı & İçecek Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k1-u4-p1",
            name: "Sıcak Künefe (1 Porsiyon) + 2 Adet Yayık Ayran",
            price: 0,
            subOptions: [
              { id: "k1-u4-p1-e1", name: "Künefe Üzerine Kesme Maraş Dondurması", price: 55 },
              { id: "k1-u4-p1-e2", name: "Künefe Üzerine Manda Kaymağı", price: 65 },
              { id: "k1-u4-p1-e3", name: "Ekstra Boz Antep Fıstığı", price: 45 },
            ],
          },
          {
            id: "k1-u4-p2",
            name: "Duble Sıcak Künefe (2 Kişilik Porsiyon) + 2 Kutu İçecek",
            price: 95,
            subOptions: [
              { id: "k1-u4-p2-e1", name: "Duble Maraş Dondurması (2 Top)", price: 90 },
              { id: "k1-u4-p2-e2", name: "Duble Manda Kaymağı", price: 95 },
              { id: "k1-u4-p2-e3", name: "İçecekleri 1 Litre Coca-Cola + 2 Ayran Yap", price: 40 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "item-kamp-2",
    categoryId: "cat-kampanya",
    name: "🍕 Muhteşem İkili: Taş Fırın Pide & Gurme Burger Paketi",
    description:
      "1 Adet Odun Ateşinde Taş Fırın Pide + 1 Adet Gurme Burger + Baharatlı Patates Kızartması + 2 İçecek! Her ürünün porsiyonunu ve ekstralarını ayrı ayrı belirleyin.",
    price: 590,
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
    available: true,
    popular: true,
    modifierGroups: [
      {
        id: "k2-urun1-porsiyon",
        productTag: "🍕 1. ÜRÜN: Taş Fırın Pide Seçimi",
        name: "Pide Çeşidi & Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k2-u1-p1",
            name: "Kaşarlı Kuşbaşılı Pide — 1 Porsiyon (Standart)",
            price: 0,
            subOptions: [
              { id: "k2-u1-p1-e1", name: "Üzerine Köy Yumurtası Kırılsın", price: 30 },
              { id: "k2-u1-p1-e2", name: "Ekstra Kaşar Peyniri", price: 40 },
              { id: "k2-u1-p1-e3", name: "Ekstra Trabzon Tereyağı", price: 25 },
              { id: "k2-u1-p1-e4", name: "İnce & Çok Çıtır Pişsin", price: 0 },
            ],
          },
          {
            id: "k2-u1-p2",
            name: "Kaşarlı Kuşbaşılı Pide — 1.5 Porsiyon (Uzun Doyuran)",
            price: 115,
            subOptions: [
              { id: "k2-u1-p2-e1", name: "Üzerine 2 Adet Köy Yumurtası", price: 50 },
              { id: "k2-u1-p2-e2", name: "Duble Kaşar & Pastırma İlavesi", price: 75 },
              { id: "k2-u1-p2-e3", name: "Bol Trabzon Tereyağlı", price: 30 },
              { id: "k2-u1-p2-e4", name: "İnce & Çok Çıtır Pişsin", price: 0 },
            ],
          },
          {
            id: "k2-u1-p3",
            name: "Karışık Gurme Pide (Kuşbaşı, Sucuk, Kaşar) — 1.5 Porsiyon",
            price: 130,
            subOptions: [
              { id: "k2-u1-p3-e1", name: "Üzerine Köy Yumurtası", price: 30 },
              { id: "k2-u1-p3-e2", name: "Kavurma İlavesi (+50g)", price: 80 },
              { id: "k2-u1-p3-e3", name: "Kenarları Susamlı & Kaşarlı", price: 40 },
            ],
          },
        ],
      },
      {
        id: "k2-urun2-porsiyon",
        productTag: "🍔 2. ÜRÜN: Gurme Burger Seçimi",
        name: "Burger Porsiyon (Gramaj) Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k2-u2-p1",
            name: "Trüf Mantarlı Gurme Burger — 180g Tek Köfte (Standart Porsiyon)",
            price: 0,
            subOptions: [
              { id: "k2-u2-p1-e1", name: "Ekstra Duble Cheddar Peyniri", price: 35 },
              { id: "k2-u2-p1-e2", name: "Dana Füme Et İlavesi", price: 65 },
              { id: "k2-u2-p1-e3", name: "Ekstra Karamelize Soğan", price: 20 },
              { id: "k2-u2-p1-e4", name: "Turşusuz Olsun", price: 0 },
              { id: "k2-u2-p1-e5", name: "İyi Pişmiş (Well Done) Olsun", price: 0 },
            ],
          },
          {
            id: "k2-u2-p2",
            name: "Trüf Mantarlı Gurme Burger — 300g Duble Köfte (Dev Porsiyon)",
            price: 125,
            subOptions: [
              { id: "k2-u2-p2-e1", name: "Triple (3 Kat) Cheddar Peyniri", price: 50 },
              { id: "k2-u2-p2-e2", name: "Duble Dana Füme Kaburga", price: 95 },
              { id: "k2-u2-p2-e3", name: "Üzerine Göz Yumurta", price: 30 },
              { id: "k2-u2-p2-e4", name: "Turşusuz Olsun", price: 0 },
              { id: "k2-u2-p2-e5", name: "İyi Pişmiş (Well Done) Olsun", price: 0 },
            ],
          },
        ],
      },
      {
        id: "k2-urun3-porsiyon",
        productTag: "🍟 3. ÜRÜN: Yan Lezzet & İçecekler",
        name: "Patates & İçecek Boyutu Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k2-u3-p1",
            name: "Baharatlı Patates (Normal Porsiyon) + 2 Kutu İçecek",
            price: 0,
            subOptions: [
              { id: "k2-u3-p1-e1", name: "Eritme Cheddar Peynir Sosu", price: 35 },
              { id: "k2-u3-p1-e2", name: "Trüflü Mayonez Sos", price: 25 },
              { id: "k2-u3-p1-e3", name: "4'lü Çıtır Soğan Halkası Ekle", price: 45 },
            ],
          },
          {
            id: "k2-u3-p2",
            name: "Kova Boy Patates + 6'lı Soğan Halkası + 2 İçecek (Büyük Porsiyon)",
            price: 75,
            subOptions: [
              { id: "k2-u3-p2-e1", name: "Patates Üzeri Bol Eritme Cheddar & Füme Et", price: 70 },
              { id: "k2-u3-p2-e2", name: "3'lü Gurme Dip Sos Seti", price: 40 },
              { id: "k2-u3-p2-e3", name: "2 Adet Mozzarella Stick Ekle", price: 65 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "item-kamp-3",
    categoryId: "cat-kampanya",
    name: "👨‍👩‍👧‍👦 Aile Boyu 4'lü Ziyafet Paketi (3-4 Kişilik Dev Kampanya)",
    description:
      "Karışık Izgara Tepsisi + Taş Fırın Pide Paketi + Sıcak Humus & Salata Seti + Tepsi Künefe & İçecekler! Her ürünün porsiyonunu ve ekstralarını seçin.",
    price: 1250,
    imageUrl:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
    available: true,
    popular: true,
    modifierGroups: [
      {
        id: "k3-urun1-porsiyon",
        productTag: "🔥 1. ÜRÜN: Karışık Izgara & Kebap Tepsisi",
        name: "Izgara Tepsisi Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k3-u1-p1",
            name: "3 Kişilik Standart Aile Izgara Tepsisi (Adana, Urfa, Şiş, Kanat, Köfte)",
            price: 0,
            subOptions: [
              { id: "k3-u1-p1-e1", name: "Ekstra 4 Adet Puf Lavaş", price: 35 },
              { id: "k3-u1-p1-e2", name: "3 Adet Kızarmış İçli Köfte", price: 180 },
              { id: "k3-u1-p1-e3", name: "Soğansız Hazırlansın", price: 0 },
            ],
          },
          {
            id: "k3-u1-p2",
            name: "4-5 Kişilik Mega Aile Tepsisi (1.5 Kat Et Porsiyonlu + Kuzu Kaburga)",
            price: 340,
            subOptions: [
              { id: "k3-u1-p2-e1", name: "Ekstra Kuzu Pirzola İlavesi (2 Kalem)", price: 210 },
              { id: "k3-u1-p2-e2", name: "4 Adet İçli Köfte (Aile İndirimli)", price: 220 },
              { id: "k3-u1-p2-e3", name: "Büyük Kase Süzme Yoğurt & Tereyağ", price: 85 },
            ],
          },
        ],
      },
      {
        id: "k3-urun2-porsiyon",
        productTag: "🫓 2. ÜRÜN: Taş Fırın Pide & Lahmacun Seçimi",
        name: "Fırın Ürünleri Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k3-u2-p1",
            name: "1 Porsiyon Kuşbaşılı Pide + 2 Adet Taş Fırın Lahmacun",
            price: 0,
            subOptions: [
              { id: "k3-u2-p1-e1", name: "Pide Üzerine Köy Yumurtası", price: 30 },
              { id: "k3-u2-p1-e2", name: "Ekstra Kaşar Peyniri", price: 45 },
              { id: "k3-u2-p1-e3", name: "Lahmacunlar Acılı Olsun", price: 0 },
            ],
          },
          {
            id: "k3-u2-p2",
            name: "1.5 Porsiyon Karışık Pide + 4 Adet Taş Fırın Lahmacun (Doyuran)",
            price: 160,
            subOptions: [
              { id: "k3-u2-p2-e1", name: "Pide Üzerine Duble Kaşar & Yumurta", price: 65 },
              { id: "k3-u2-p2-e2", name: "Ekstra Yeşillik & Limon Söğüş Paketi", price: 30 },
              { id: "k3-u2-p2-e3", name: "Lahmacunlar Acılı Olsun", price: 0 },
            ],
          },
        ],
      },
      {
        id: "k3-urun3-porsiyon",
        productTag: "🥗 3. ÜRÜN: Sıcak Humus & Salata Seti",
        name: "Meze & Salata Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k3-u3-p1",
            name: "Tereyağlı Sıcak Humus (1 Porsiyon) + Büyük Gavurdağı Salatası",
            price: 0,
            subOptions: [
              { id: "k3-u3-p1-e1", name: "Humus Üzerine Kayseri Pastırması", price: 55 },
              { id: "k3-u3-p1-e2", name: "Salataya Ekstra Bol Ceviz İçi", price: 35 },
            ],
          },
          {
            id: "k3-u3-p2",
            name: "Pastırmalı Duble Humus (1.5 Porsiyon) + Duble Gavurdağı + Haydari",
            price: 120,
            subOptions: [
              { id: "k3-u3-p2-e1", name: "Çam Fıstıklı & Tereyağlı Humus Sosu", price: 45 },
              { id: "k3-u3-p2-e2", name: "Ekstra Acılı Antep Ezmesi", price: 45 },
            ],
          },
        ],
      },
      {
        id: "k3-urun4-porsiyon",
        productTag: "🍮 4. ÜRÜN: Aile Boyu Tatlı & İçecekler",
        name: "Tatlı & İçecek Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k3-u4-p1",
            name: "Aile Boyu Sıcak Künefe + 4 Adet Yayık Ayran",
            price: 0,
            subOptions: [
              { id: "k3-u4-p1-e1", name: "Ortaya 250g Kesme Maraş Dondurması", price: 110 },
              { id: "k3-u4-p1-e2", name: "Bol Manda Kaymağı İlavesi", price: 95 },
            ],
          },
          {
            id: "k3-u4-p2",
            name: "Fıstıkzade Duble Tepsi Künefe + 4 Ayran + 1 Lt Coca-Cola",
            price: 135,
            subOptions: [
              { id: "k3-u4-p2-e1", name: "Duble Maraş Dondurması & Kaymak Seti", price: 160 },
              { id: "k3-u4-p2-e2", name: "Ekstra Boz Fıstık Kaplama", price: 75 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "item-kamp-4",
    categoryId: "cat-kampanya",
    name: "⚡ Süper Gurme Menü (Ana Yemek + Ara Sıcak + Tatlı + İçecek)",
    description:
      "Tek kişilik eksiksiz ziyafet! Ana Yemeğinizi, Ara Sıcağınızı ve Tatlı/İçeceğinizi kendi porsiyon ve ekstralarıyla oluşturun.",
    price: 460,
    imageUrl:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
    available: true,
    popular: false,
    modifierGroups: [
      {
        id: "k4-urun1-porsiyon",
        productTag: "🍽️ 1. ÜRÜN: Ana Yemek Tercihi & Porsiyonu",
        name: "Ana Yemek & Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k4-u1-p1",
            name: "Zırh Adana Kebap — 1 Porsiyon (Standart)",
            price: 0,
            subOptions: [
              { id: "k4-u1-p1-e1", name: "Ekstra Sıcak Lavaş", price: 20 },
              { id: "k4-u1-p1-e2", name: "Köz Biber & Domates", price: 30 },
              { id: "k4-u1-p1-e3", name: "Soğansız Olsun", price: 0 },
              { id: "k4-u1-p1-e4", name: "Acısız (Urfa) Olsun", price: 0 },
            ],
          },
          {
            id: "k4-u1-p2",
            name: "Zırh Adana Kebap — 1.5 Porsiyon (Doyuran)",
            price: 120,
            subOptions: [
              { id: "k4-u1-p2-e1", name: "Duble Lavaş & Süzme Yoğurt", price: 50 },
              { id: "k4-u1-p2-e2", name: "Tereyağlı Sos", price: 30 },
              { id: "k4-u1-p2-e3", name: "Soğansız Olsun", price: 0 },
            ],
          },
          {
            id: "k4-u1-p3",
            name: "Trüf Mantarlı Gurme Burger — 180g Standart Porsiyon",
            price: 0,
            subOptions: [
              { id: "k4-u1-p3-e1", name: "Ekstra Cheddar Peyniri", price: 35 },
              { id: "k4-u1-p3-e2", name: "Dana Füme Et", price: 65 },
              { id: "k4-u1-p3-e3", name: "Turşusuz Olsun", price: 0 },
            ],
          },
          {
            id: "k4-u1-p4",
            name: "Trüf Mantarlı Gurme Burger — 300g Duble Porsiyon",
            price: 120,
            subOptions: [
              { id: "k4-u1-p4-e1", name: "Duble Cheddar & Dana Füme", price: 85 },
              { id: "k4-u1-p4-e2", name: "Eritme Peynir Sosu", price: 35 },
              { id: "k4-u1-p4-e3", name: "Turşusuz Olsun", price: 0 },
            ],
          },
        ],
      },
      {
        id: "k4-urun2-porsiyon",
        productTag: "🥟 2. ÜRÜN: Ara Sıcak & Başlangıç",
        name: "Ara Sıcak Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k4-u2-p1",
            name: "Kızarmış İçli Köfte — 1 Adet (Standart)",
            price: 0,
            subOptions: [
              { id: "k4-u2-p1-e1", name: "Süzme Yoğurt Sosu İle", price: 25 },
              { id: "k4-u2-p1-e2", name: "Limon & Taze Nane", price: 0 },
            ],
          },
          {
            id: "k4-u2-p2",
            name: "Kızarmış İçli Köfte — 2 Adet (Duble Porsiyon)",
            price: 60,
            subOptions: [
              { id: "k4-u2-p2-e1", name: "Süzme Yoğurt & Tereyağ Sosu İle", price: 35 },
              { id: "k4-u2-p2-e2", name: "Acılı Ezme Eşliğinde", price: 30 },
            ],
          },
          {
            id: "k4-u2-p3",
            name: "Sıcak Humus — 1 Porsiyon",
            price: 15,
            subOptions: [
              { id: "k4-u2-p3-e1", name: "Üzerine Kayseri Pastırması", price: 50 },
              { id: "k4-u2-p3-e2", name: "Sıcak Puf Lavaş İle", price: 20 },
            ],
          },
        ],
      },
      {
        id: "k4-urun3-porsiyon",
        productTag: "🍨 3. ÜRÜN: Tatlı & İçecek",
        name: "Tatlı & İçecek Porsiyon Seçimi",
        required: true,
        multiSelect: false,
        options: [
          {
            id: "k4-u3-p1",
            name: "Antep Fıstıklı Künefe (1 Porsiyon) + Yayık Ayran",
            price: 0,
            subOptions: [
              { id: "k4-u3-p1-e1", name: "Kesme Maraş Dondurması Ekle", price: 50 },
              { id: "k4-u3-p1-e2", name: "Manda Kaymağı Ekle", price: 60 },
            ],
          },
          {
            id: "k4-u3-p2",
            name: "Fıstıklı Duble Künefe (1.5 Porsiyon) + Kutu İçecek (Cola/Fanta/Şalgam)",
            price: 55,
            subOptions: [
              { id: "k4-u3-p2-e1", name: "Dondurma + Kaymak İkisi Bir Arada", price: 90 },
              { id: "k4-u3-p2-e2", name: "Ekstra Boz Fıstık", price: 40 },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * Normal tekil menü ürünlerinde de her porsiyonun kendi ekstraları (subOptions) olmasını sağlar.
 */
export function enrichSingleItemPortions(item: MenuItem): MenuItem {
  if (item.categoryId === "cat-kampanya") return item;

  const groups: ModifierGroup[] = (item.modifierGroups || []).map((g) => {
    const isPortionGroup =
      g.name.toLowerCase().includes("porsiyon") ||
      g.name.toLowerCase().includes("sunum");
    if (!isPortionGroup) return g;

    return {
      ...g,
      options: g.options.map((opt, idx) => {
        if (opt.subOptions && opt.subOptions.length > 0) return opt;
        const isLarge =
          idx > 0 ||
          opt.name.includes("1.5") ||
          opt.name.toLowerCase().includes("duble") ||
          opt.name.toLowerCase().includes("pastırma");
        return {
          ...opt,
          subOptions: isLarge
            ? [
                {
                  id: `${opt.id}-sub-1`,
                  name: "Duble Sıcak Lavaş & Köz Biber-Domates",
                  price: 35,
                },
                {
                  id: `${opt.id}-sub-2`,
                  name: "Süzme Yoğurt & Tereyağı Sosu",
                  price: 50,
                },
                {
                  id: `${opt.id}-sub-3`,
                  name: "Ekstra Kaşar / Özel Sos",
                  price: 40,
                },
                {
                  id: `${opt.id}-sub-4`,
                  name: "Soğansız Hazırlansın",
                  price: 0,
                },
              ]
            : [
                {
                  id: `${opt.id}-sub-1`,
                  name: "Ekstra Sıcak Lavaş",
                  price: 20,
                },
                {
                  id: `${opt.id}-sub-2`,
                  name: "Közlenmiş Biber & Domates",
                  price: 30,
                },
                {
                  id: `${opt.id}-sub-3`,
                  name: "Ekstra Sos / Garnitür",
                  price: 25,
                },
                {
                  id: `${opt.id}-sub-4`,
                  name: "Soğansız Hazırlansın",
                  price: 0,
                },
              ],
        };
      }),
    };
  });

  // Eğer ürünün hiç porsiyon grubu yoksa (örn: Burger, Pide, Salata, Künefe), porsiyon + porsiyon ekstrası ekle
  const hasPortion = groups.some(
    (g) =>
      g.name.toLowerCase().includes("porsiyon") ||
      g.name.toLowerCase().includes("sunum") ||
      g.name.toLowerCase().includes("içecek")
  );

  if (!hasPortion && item.categoryId !== "cat-6") {
    const portionGroup: ModifierGroup = {
      id: `mod-por-${item.id}`,
      name: "Porsiyon Seçimi",
      required: true,
      multiSelect: false,
      options: [
        {
          id: `${item.id}-por-1`,
          name: "1 Porsiyon (Standart)",
          price: 0,
          subOptions: [
            { id: `${item.id}-p1-s1`, name: "Ekstra Garnitür & Sos", price: 25 },
            { id: `${item.id}-p1-s2`, name: "Ekstra Kaşar / Peynir", price: 35 },
            { id: `${item.id}-p1-s3`, name: "Soğansız Olsun", price: 0 },
          ],
        },
        {
          id: `${item.id}-por-2`,
          name: "1.5 Porsiyon (Doyuran)",
          price: Math.round(item.price * 0.42),
          subOptions: [
            { id: `${item.id}-p2-s1`, name: "Duble Garnitür & Özel Sos", price: 40 },
            { id: `${item.id}-p2-s2`, name: "Duble Kaşar / Kaymak / Ekstra", price: 55 },
            { id: `${item.id}-p2-s3`, name: "Soğansız Olsun", price: 0 },
          ],
        },
      ],
    };
    groups.unshift(portionGroup);
  }

  return {
    ...item,
    modifierGroups: groups,
  };
}
