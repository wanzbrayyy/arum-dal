const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const now = () => new Date();

const memoryStore = {
  initialized: false,
  settings: null,
  categories: [],
  users: [],
  customers: [],
  promos: [],
  products: [],
  tables: [],
  shifts: [],
  expenses: [],
  cashLogs: [],
  notifications: [],
  feedback: [],
  reservations: [],
  printers: [],
  orders: [],
  sequences: {
    order: 1,
    invoice: 1,
    call: 1,
  },
};

async function createSeedUser(name, email, password, role, extras = {}) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  return {
    _id: uuidv4(),
    id: undefined,
    name,
    email,
    password: hashedPassword,
    role,
    phone: extras.phone || '',
    isActive: true,
    permissions: extras.permissions || [],
    favoriteProductIds: [],
    performance: {
      targetSales: extras.targetSales || 0,
      ordersHandled: 0,
      avgCheckoutSeconds: 0,
    },
    createdAt: now(),
    updatedAt: now(),
  };
}

function buildCategory(name, icon, accentColor) {
  return {
    _id: uuidv4(),
    name,
    icon,
    accentColor,
    active: true,
    createdAt: now(),
    updatedAt: now(),
  };
}

function buildProduct(partial) {
  return {
    _id: uuidv4(),
    sku: partial.sku,
    barcode: partial.barcode,
    name: partial.name,
    description: partial.description,
    imageUrl: partial.imageUrl,
    category: partial.category,
    categoryId: partial.categoryId,
    price: partial.price,
    stock: partial.stock,
    minStock: partial.minStock || 5,
    available: true,
    featured: !!partial.featured,
    bestSeller: !!partial.bestSeller,
    tags: partial.tags || [],
    variants: partial.variants || [],
    addOns: partial.addOns || [],
    sweetnessLevels: partial.sweetnessLevels || ['Normal'],
    iceLevels: partial.iceLevels || ['Normal'],
    spiceLevels: partial.spiceLevels || ['Normal'],
    allergens: partial.allergens || [],
    bundleSuggestions: partial.bundleSuggestions || [],
    schedule: partial.schedule || {
      availableAllDay: true,
      start: '00:00',
      end: '23:59',
    },
    createdAt: now(),
    updatedAt: now(),
  };
}

function buildTable(name, extras = {}) {
  return {
    _id: uuidv4(),
    name,
    area: extras.area || 'Indoor',
    capacity: extras.capacity || 4,
    status: extras.status || 'available',
    activeOrderIds: [],
    currentCustomerName: '',
    currentReservationId: null,
    uniqueIdentifier: uuidv4(),
    estimatedDurationMinutes: extras.estimatedDurationMinutes || 90,
    qrLandingPath: '',
    createdAt: now(),
    updatedAt: now(),
  };
}

function buildCustomer(partial) {
  return {
    _id: uuidv4(),
    name: partial.name,
    phone: partial.phone,
    email: partial.email || '',
    memberCode: partial.memberCode,
    tier: partial.tier || 'Bronze',
    points: partial.points || 0,
    birthday: partial.birthday || '',
    favoriteProductIds: partial.favoriteProductIds || [],
    savedAddresses: partial.savedAddresses || [],
    notes: partial.notes || '',
    createdAt: now(),
    updatedAt: now(),
  };
}

function buildPromo(partial) {
  return {
    _id: uuidv4(),
    code: partial.code,
    title: partial.title,
    description: partial.description,
    imageUrl: partial.imageUrl || '',
    bannerMessage: partial.bannerMessage || '',
    type: partial.type,
    value: partial.value,
    minPurchase: partial.minPurchase || 0,
    active: true,
    memberOnly: !!partial.memberOnly,
    appliesToCategories: partial.appliesToCategories || [],
    appliesToProducts: partial.appliesToProducts || [],
    channels: partial.channels || ['client', 'cashier'],
    startAt: partial.startAt || now().toISOString(),
    endAt: partial.endAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    createdAt: now(),
    updatedAt: now(),
  };
}

async function initializeMemoryStore() {
  if (memoryStore.initialized) {
    return memoryStore;
  }

  memoryStore.settings = {
    brandName: 'Warkop Arum Dalu',
    appName: 'Arum POS',
    outletName: 'Arum Dalu Pusat',
    languageOptions: ['id', 'en'],
    defaultLanguage: 'id',
    colors: {
      background: '#1F2D3D',
      surface: '#2A3B4C',
      accentPrimary: '#27AE60',
      accentSecondary: '#F39C12',
      textPrimary: '#FFFFFF',
      textSecondary: '#95A5A6',
    },
    taxPercent: 10,
    servicePercent: 5,
    roundingMode: 'nearest_100',
    currency: 'IDR',
    enableDarkMode: true,
    enablePWA: true,
    publicWebBaseUrl: 'https://arum-dal.vercel.app',
    receiptFooter: 'Terima kasih sudah berkunjung ke Arum Dalu.',
    bannerMessage: 'Promo kopi pagi sampai jam 11 siang',
    latestHeadline: 'Makanan dan kopi terbaru minggu ini',
    bannerImageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    heroSubtitle: 'Ngopi santai, pesan dari meja.',
    callWaiterOptions: ['Panggil pelayan', 'Minta tagihan', 'Bersihkan meja'],
    paymentMethods: ['Cash', 'QRIS', 'Debit', 'Credit'],
    quickCashAmounts: [20000, 50000, 100000, 200000],
  };

  memoryStore.categories = [
    buildCategory('Kopi', 'mug-hot', '#F39C12'),
    buildCategory('Makanan', 'utensils', '#27AE60'),
    buildCategory('Minuman', 'glass-water', '#3498DB'),
    buildCategory('Snack', 'cookie-bite', '#9B59B6'),
  ];

  const admin = await createSeedUser('Admin Arum', 'admin@arumdalu.local', 'admin123', 'admin', {
    phone: '081234567890',
    targetSales: 3000000,
  });
  const cashier = await createSeedUser('Kasir Arum', 'cashier@arumdalu.local', 'cashier123', 'cashier', {
    phone: '081111111111',
    targetSales: 1500000,
  });
  const waiter = await createSeedUser('Waiter Arum', 'waiter@arumdalu.local', 'waiter123', 'waiter', {
    phone: '082222222222',
  });

  memoryStore.users = [admin, cashier, waiter].map((user) => ({
    ...user,
    id: user._id,
  }));

  const kopiCategory = memoryStore.categories.find((item) => item.name === 'Kopi');
  const makananCategory = memoryStore.categories.find((item) => item.name === 'Makanan');
  const minumanCategory = memoryStore.categories.find((item) => item.name === 'Minuman');
  const snackCategory = memoryStore.categories.find((item) => item.name === 'Snack');

  memoryStore.products = [
    buildProduct({
      sku: 'KOP-001',
      barcode: '899100000001',
      name: 'Kopi Hitam',
      description: 'Seduhan kopi hitam khas Arum Dalu.',
      imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80',
      category: 'Kopi',
      categoryId: kopiCategory._id,
      price: 12000,
      stock: 50,
      minStock: 10,
      bestSeller: true,
      featured: true,
      tags: ['best-seller', 'kopi'],
      sweetnessLevels: ['Normal', 'Less Sugar', 'No Sugar'],
      bundleSuggestions: ['Pisang Goreng'],
      addOns: [
        { _id: uuidv4(), name: 'Extra Shot', price: 4000 },
        { _id: uuidv4(), name: 'Susu', price: 3000 },
      ],
      allergens: ['Milk'],
    }),
    buildProduct({
      sku: 'KOP-002',
      barcode: '899100000002',
      name: 'Americano',
      description: 'Espresso ringan untuk teman kerja.',
      imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
      category: 'Kopi',
      categoryId: kopiCategory._id,
      price: 15000,
      stock: 35,
      minStock: 8,
      tags: ['kopi', 'espresso'],
      addOns: [
        { _id: uuidv4(), name: 'Lemon Slice', price: 2000 },
      ],
      bundleSuggestions: ['Cookies'],
    }),
    buildProduct({
      sku: 'MAK-001',
      barcode: '899100000003',
      name: 'Mie Goreng',
      description: 'Mie goreng spesial dengan telur.',
      imageUrl: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=800&q=80',
      category: 'Makanan',
      categoryId: makananCategory._id,
      price: 18000,
      stock: 25,
      minStock: 5,
      spiceLevels: ['Normal', 'Pedas', 'Extra Pedas'],
      tags: ['makanan', 'favorit'],
      bundleSuggestions: ['Es Teh'],
    }),
    buildProduct({
      sku: 'MIN-001',
      barcode: '899100000004',
      name: 'Es Teh',
      description: 'Es teh manis segar.',
      imageUrl: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&w=800&q=80',
      category: 'Minuman',
      categoryId: minumanCategory._id,
      price: 8000,
      stock: 40,
      minStock: 10,
      sweetnessLevels: ['Normal', 'Less Sugar', 'No Sugar'],
      iceLevels: ['Normal', 'Less Ice', 'No Ice'],
      bundleSuggestions: ['Mie Goreng'],
    }),
    buildProduct({
      sku: 'SNK-001',
      barcode: '899100000005',
      name: 'Pisang Goreng',
      description: 'Pisang goreng hangat cocok untuk teman kopi.',
      imageUrl: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=800&q=80',
      category: 'Snack',
      categoryId: snackCategory._id,
      price: 10000,
      stock: 18,
      minStock: 6,
      tags: ['snack'],
      bundleSuggestions: ['Kopi Hitam'],
    }),
  ];

  memoryStore.tables = [
    buildTable('Meja 1', { area: 'Indoor', capacity: 4 }),
    buildTable('Meja 2', { area: 'Indoor', capacity: 2 }),
    buildTable('Meja 3', { area: 'Teras', capacity: 4 }),
    buildTable('Meja 4', { area: 'VIP', capacity: 6 }),
  ].map((table) => ({
    ...table,
    qrLandingPath: `/order/${table.uniqueIdentifier}`,
  }));

  memoryStore.customers = [
    buildCustomer({
      name: 'Budi Santoso',
      phone: '081300000001',
      email: 'budi@example.com',
      memberCode: 'ARUM-0001',
      tier: 'Gold',
      points: 220,
      savedAddresses: ['Jl. Melati No. 10'],
    }),
    buildCustomer({
      name: 'Sari Wulandari',
      phone: '081300000002',
      email: 'sari@example.com',
      memberCode: 'ARUM-0002',
      tier: 'Silver',
      points: 120,
    }),
  ];

  memoryStore.promos = [
    buildPromo({
      code: 'PAGIKOPI',
      title: 'Promo Kopi Pagi',
      description: 'Diskon kopi 10% sampai jam 11 siang.',
      type: 'percentage',
      value: 10,
      minPurchase: 10000,
      appliesToCategories: ['Kopi'],
    }),
    buildPromo({
      code: 'HEMAT10K',
      title: 'Potongan 10 Ribu',
      description: 'Potongan Rp10.000 untuk minimal belanja Rp50.000.',
      type: 'flat',
      value: 10000,
      minPurchase: 50000,
      channels: ['client', 'cashier', 'admin'],
    }),
  ];

  memoryStore.printers = [
    { _id: uuidv4(), name: 'Printer Kasir', type: 'receipt', active: true },
    { _id: uuidv4(), name: 'Printer Dapur', type: 'kitchen', active: true },
  ];

  memoryStore.reservations = [
    {
      _id: uuidv4(),
      tableId: memoryStore.tables[3]._id,
      customerName: 'Andi Reservasi',
      customerPhone: '081377777777',
      arrivalTime: '19:00',
      status: 'confirmed',
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  memoryStore.notifications = [
    {
      _id: uuidv4(),
      type: 'promo',
      title: 'Promo aktif',
      message: 'Promo PAGIKOPI sedang aktif untuk client dan kasir.',
      level: 'info',
      createdAt: now(),
    },
  ];

  memoryStore.initialized = true;
  return memoryStore;
}

module.exports = {
  memoryStore,
  initializeMemoryStore,
};
