const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const TableModel = require('../models/table');
const ProductModel = require('../models/product');
const UserModel = require('../models/user');
const OrderModel = require('../models/order');
const ShiftModel = require('../models/shift');
const TransactionModel = require('../models/transaction');
const { memoryStore, initializeMemoryStore } = require('../store/memoryStore');

const clone = (value) => JSON.parse(JSON.stringify(value));
const now = () => new Date();

function startOfDay(date = new Date()) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target;
}

function endOfDay(date = new Date()) {
  const target = new Date(date);
  target.setHours(23, 59, 59, 999);
  return target;
}

function startOfWeek(date = new Date()) {
  const target = startOfDay(date);
  const day = target.getDay();
  const diff = day === 0 ? 6 : day - 1;
  target.setDate(target.getDate() - diff);
  return target;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isToday(dateValue) {
  const date = new Date(dateValue);
  return date >= startOfDay() && date <= endOfDay();
}

function roundToNearest(value, mode) {
  if (mode === 'nearest_100') return Math.round(value / 100) * 100;
  if (mode === 'nearest_1000') return Math.round(value / 1000) * 1000;
  return Math.round(value);
}

function normalizeImageDataUri(value, fallback = '') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('data:image/')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

function resolveReportStart(period = 'daily') {
  if (period === 'monthly') return startOfMonth(new Date());
  if (period === 'weekly') return startOfWeek(new Date());
  return startOfDay(new Date());
}

function formatBucketLabel(date, period) {
  const value = new Date(date);
  if (period === 'monthly') return `${value.getDate()}/${value.getMonth() + 1}`;
  if (period === 'weekly') return value.toLocaleDateString('id-ID', { weekday: 'short' });
  return value.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function buildPeriodBuckets(period, referenceStart, orders) {
  const bucketMap = new Map();
  const bucketCount = period === 'monthly' ? 31 : period === 'weekly' ? 7 : 8;
  for (let index = 0; index < bucketCount; index += 1) {
    const bucketDate = new Date(referenceStart);
    if (period === 'daily') {
      bucketDate.setHours(referenceStart.getHours() + (index * 3), 0, 0, 0);
    } else {
      bucketDate.setDate(referenceStart.getDate() + index);
    }
    bucketMap.set(formatBucketLabel(bucketDate, period), {
      label: formatBucketLabel(bucketDate, period),
      orders: 0,
      revenue: 0,
    });
  }

  orders.forEach((order) => {
    const createdAt = new Date(order.createdAt || now());
    let bucketDate = new Date(createdAt);
    if (period === 'daily') {
      bucketDate.setMinutes(0, 0, 0);
      const bucketHour = Math.floor(bucketDate.getHours() / 3) * 3;
      bucketDate.setHours(bucketHour, 0, 0, 0);
    } else {
      bucketDate = startOfDay(createdAt);
    }
    const label = formatBucketLabel(bucketDate, period);
    if (!bucketMap.has(label)) {
      bucketMap.set(label, { label, orders: 0, revenue: 0 });
    }
    const bucket = bucketMap.get(label);
    bucket.orders += 1;
    bucket.revenue += Number(order.pricing?.total || 0);
  });

  return Array.from(bucketMap.values());
}

function getStore() {
  return memoryStore;
}

function ensureRuntimeCollections(store) {
  store.auditLogs ||= [];
  store.serviceCalls ||= [];
  store.transactions ||= [];
  store.deviceSettings ||= {
    receiptPrinter: 'Printer Kasir',
    kitchenPrinter: 'Printer Dapur',
    quickTouchMode: true,
  };
  store.quickActions ||= ['Kopi Hitam', 'Americano', 'Mie Goreng', 'Es Teh'];
  return store;
}

const mongoSyncState = {
  lastRunAt: 0,
};

function hasMongoConnection() {
  return mongoose.connection?.readyState === 1 && !global.useMemoryStore;
}

function createRuntimeCategory(name) {
  return {
    _id: uuidv4(),
    name,
    icon: 'circle',
    accentColor: '#27AE60',
    active: true,
    createdAt: now(),
    updatedAt: now(),
  };
}

function ensureCategory(name) {
  if (!name) return null;
  const store = getStore();
  let category = store.categories.find((item) => item.name === name);
  if (!category) {
    category = createRuntimeCategory(name);
    store.categories.push(category);
  }
  return category;
}

function mapMongoTableToMemory(table, existing = {}) {
  return {
    _id: String(table._id),
    name: table.name,
    area: table.area || existing.area || 'Indoor',
    capacity: Number(table.capacity || existing.capacity || 4),
    status: table.status || existing.status || 'available',
    activeOrderIds: existing.activeOrderIds || [],
    currentCustomerName: existing.currentCustomerName || '',
    currentReservationId: existing.currentReservationId || null,
    uniqueIdentifier: table.uniqueIdentifier,
    estimatedDurationMinutes: existing.estimatedDurationMinutes || 90,
    qrLandingPath: `/order/${table.uniqueIdentifier}`,
    createdAt: table.createdAt || existing.createdAt || now(),
    updatedAt: table.updatedAt || now(),
  };
}

function mapMongoProductToMemory(product, index, existing = {}) {
  const category = ensureCategory(product.category || existing.category || 'Lainnya');
  return {
    _id: String(product._id),
    sku: existing.sku || `SKU-${String(index + 1).padStart(3, '0')}`,
    barcode: existing.barcode || `${Date.now()}${index}`.slice(-12),
    name: product.name,
    description: product.description || existing.description || '',
    imageUrl: normalizeImageDataUri(product.imageUrl || existing.imageUrl || ''),
    category: category?.name || product.category || 'Lainnya',
    categoryId: category?._id || existing.categoryId || null,
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    minStock: Number(product.minStock || existing.minStock || 5),
    available: product.available !== false && existing.available !== false,
    featured: Boolean(product.featured || existing.featured),
    bestSeller: Boolean(product.bestSeller || existing.bestSeller),
    soldCount: Number(product.soldCount || existing.soldCount || 0),
    tags: existing.tags || [],
    variants: existing.variants || [],
    addOns: existing.addOns || [],
    sweetnessLevels: existing.sweetnessLevels || ['Normal'],
    iceLevels: existing.iceLevels || ['Normal'],
    spiceLevels: existing.spiceLevels || ['Normal'],
    allergens: existing.allergens || [],
    bundleSuggestions: existing.bundleSuggestions || [],
    schedule: existing.schedule || { availableAllDay: true, start: '00:00', end: '23:59' },
    createdAt: product.createdAt || existing.createdAt || now(),
    updatedAt: product.updatedAt || now(),
  };
}

function mapMongoUserToMemory(user, existing = {}) {
  return {
    _id: String(user._id),
    id: String(user._id),
    name: user.name,
    email: user.email,
    password: user.password,
    role: user.role || existing.role || 'cashier',
    phone: user.phone || existing.phone || '',
    isActive: user.isActive !== false,
    permissions: existing.permissions || [],
    favoriteProductIds: existing.favoriteProductIds || [],
    performance: existing.performance || {
      targetSales: 0,
      ordersHandled: 0,
      avgCheckoutSeconds: 0,
    },
    createdAt: user.createdAt || existing.createdAt || now(),
    updatedAt: user.updatedAt || now(),
  };
}

function mapMongoShiftToMemory(shift, existing = {}) {
  const cashierName = shift.cashierName || shift.cashier?.name || existing.cashierName || findUserById(String(shift.cashier))?.name || 'Cashier';
  return {
    _id: String(shift._id),
    cashierId: String(shift.cashier?._id || shift.cashier || existing.cashierId || ''),
    cashierName,
    startTime: shift.startTime || existing.startTime || now(),
    endTime: shift.endTime || null,
    shiftType: shift.shiftType || existing.shiftType || 'Pagi',
    initialCash: Number(shift.initialCash || 0),
    finalCash: Number(shift.finalCash || 0),
    totalRevenue: Number(shift.totalRevenue || 0),
    totalExpense: Number(shift.totalExpense || 0),
    totalOrders: Number(shift.totalOrders || 0),
    notes: shift.notes || existing.notes || '',
    cashLogs: shift.cashLogs || existing.cashLogs || [],
    createdAt: shift.createdAt || existing.createdAt || now(),
    updatedAt: shift.updatedAt || now(),
  };
}

function mapMongoOrderToMemory(order, existing = {}) {
  const fallbackModifiers = {
    variants: [],
    addOns: [],
    sweetness: 'Normal',
    ice: 'Normal',
    spice: 'Normal',
  };
  const normalizedItems = (order.items || []).map((item) => {
    const productId = String(item.productId || item.product || '');
    const knownProduct = findProductById(productId);
    const unitPrice = Number(item.unitPrice || item.priceAtOrder || 0);
    const modifierPrice = Number(item.modifierPrice || 0);
    const itemDiscount = Number(item.itemDiscount || 0);
    const quantity = Number(item.quantity || 1);
    return {
      _id: String(item._id || uuidv4()),
      productId,
      productName: item.productName || knownProduct?.name || 'Produk',
      category: knownProduct?.category || '',
      quantity,
      unitPrice,
      modifierPrice,
      itemDiscount,
      note: item.note || '',
      modifiers: item.modifiers || fallbackModifiers,
      lineSubtotal: Number(item.lineSubtotal || ((unitPrice + modifierPrice) * quantity) - itemDiscount),
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + Number(item.lineSubtotal || 0), 0);
  const pricing = order.pricing || {
    subtotal,
    promoDiscount: 0,
    memberDiscount: 0,
    serviceCharge: 0,
    tax: 0,
    roundingAdjustment: 0,
    total: Number(order.totalAmount || subtotal),
    paidAmount: (order.payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    changeAmount: 0,
  };

  return {
    _id: String(order._id),
    orderCode: order.orderCode || existing.orderCode || `ORD-${String(order.queueNumber || 0).padStart(4, '0')}`,
    invoiceCode: order.invoiceCode || existing.invoiceCode || null,
    source: order.source || existing.source || 'cashier',
    channel: order.channel || existing.channel || 'cashier',
    tableId: String(order.table?._id || order.table || existing.tableId || ''),
    tableName: order.tableName || order.table?.name || existing.tableName || findTableById(String(order.table || existing.tableId || ''))?.name || '-',
    orderType: order.orderType || existing.orderType || 'dine-in',
    diningOption: order.diningOption || existing.diningOption || 'dine-in',
    customerName: order.customerName || existing.customerName || 'Customer',
    customerPhone: order.customerPhone || existing.customerPhone || '',
    customerWhatsapp: order.customerWhatsapp || order.customerPhone || existing.customerWhatsapp || '',
    customerEmail: order.customerEmail || existing.customerEmail || '',
    customerId: order.customerId || existing.customerId || null,
    memberTier: order.memberTier || existing.memberTier || null,
    voucherCode: order.voucherCode || existing.voucherCode || '',
    appliedPromo: order.appliedPromo || existing.appliedPromo || null,
    status: order.status || existing.status || 'pending',
    kitchenStatus: order.kitchenStatus || existing.kitchenStatus || 'queued',
    serviceStatus: order.serviceStatus || existing.serviceStatus || 'waiting',
    paymentStatus: order.paymentStatus || existing.paymentStatus || (order.status === 'paid' ? 'paid' : 'unpaid'),
    paymentPreference: order.paymentPreference || existing.paymentPreference || 'pay_at_cashier',
    note: order.note || existing.note || '',
    customerRequest: order.customerRequest || existing.customerRequest || '',
    assignedWaiterId: order.assignedWaiterId || existing.assignedWaiterId || null,
    cashierId: order.cashierId || existing.cashierId || null,
    shiftId: order.shiftId || String(order.shift || existing.shiftId || ''),
    splitSourceOrderId: order.splitSourceOrderId || existing.splitSourceOrderId || null,
    mergedOrderIds: order.mergedOrderIds || existing.mergedOrderIds || [],
    paymentSplitCode: order.paymentSplitCode || existing.paymentSplitCode || uuidv4(),
    queueNumber: Number(order.queueNumber || existing.queueNumber || 0),
    items: normalizedItems,
    pricing: {
      ...pricing,
      total: Number(pricing.total || order.totalAmount || subtotal),
      paidAmount: Number(pricing.paidAmount || 0),
      changeAmount: Number(pricing.changeAmount || 0),
    },
    payments: order.payments || existing.payments || [],
    refundHistory: order.refundHistory || existing.refundHistory || [],
    inventoryReserved: order.inventoryReserved !== undefined ? !!order.inventoryReserved : existing.inventoryReserved !== false,
    inventoryRestoredAt: order.inventoryRestoredAt || existing.inventoryRestoredAt || null,
    timeline: order.timeline || existing.timeline || [],
    createdAt: order.createdAt || existing.createdAt || now(),
    updatedAt: order.updatedAt || now(),
  };
}

function buildMongoOrderPayload(order) {
  return {
    orderCode: order.orderCode || '',
    invoiceCode: order.invoiceCode || '',
    source: order.source || 'cashier',
    channel: order.channel || 'cashier',
    table: order.tableId,
    tableName: order.tableName || '',
    shift: order.shiftId || null,
    customerName: order.customerName || 'Customer',
    customerPhone: order.customerPhone || '',
    customerWhatsapp: order.customerWhatsapp || '',
    customerEmail: order.customerEmail || '',
    customerId: order.customerId || '',
    memberTier: order.memberTier || '',
    voucherCode: order.voucherCode || '',
    appliedPromo: order.appliedPromo || null,
    orderType: order.orderType || 'dine-in',
    diningOption: order.diningOption || 'dine-in',
    items: (order.items || []).map((item) => ({
      product: item.productId || null,
      productId: item.productId || '',
      productName: item.productName || '',
      quantity: Number(item.quantity || 1),
      priceAtOrder: Number(item.unitPrice || 0),
      unitPrice: Number(item.unitPrice || 0),
      modifierPrice: Number(item.modifierPrice || 0),
      itemDiscount: Number(item.itemDiscount || 0),
      note: item.note || '',
      modifiers: item.modifiers || {},
      lineSubtotal: Number(item.lineSubtotal || 0),
    })),
    totalAmount: Number(order.pricing?.total || order.totalAmount || 0),
    status: order.status || 'pending',
    kitchenStatus: order.kitchenStatus || 'queued',
    serviceStatus: order.serviceStatus || 'waiting',
    paymentStatus: order.paymentStatus || 'unpaid',
    paymentPreference: order.paymentPreference || 'pay_at_cashier',
    paymentMethod: order.payments?.[0]?.method || null,
    note: order.note || '',
    customerRequest: order.customerRequest || '',
    assignedWaiterId: order.assignedWaiterId || '',
    cashierId: order.cashierId || '',
    shiftId: order.shiftId || '',
    splitSourceOrderId: order.splitSourceOrderId || '',
    mergedOrderIds: order.mergedOrderIds || [],
    paymentSplitCode: order.paymentSplitCode || '',
    queueNumber: Number(order.queueNumber || 0),
    pricing: order.pricing || {},
    payments: order.payments || [],
    refundHistory: order.refundHistory || [],
    inventoryReserved: order.inventoryReserved !== false,
    inventoryRestoredAt: order.inventoryRestoredAt || null,
    timeline: order.timeline || [],
  };
}

function buildMongoShiftPayload(shift) {
  return {
    cashier: shift.cashierId,
    cashierName: shift.cashierName || 'Cashier',
    startTime: shift.startTime || now(),
    endTime: shift.endTime || null,
    shiftType: shift.shiftType || 'Pagi',
    initialCash: Number(shift.initialCash || 0),
    finalCash: Number(shift.finalCash || 0),
    totalRevenue: Number(shift.totalRevenue || 0),
    totalExpense: Number(shift.totalExpense || 0),
    totalOrders: Number(shift.totalOrders || 0),
    notes: shift.notes || '',
    cashLogs: shift.cashLogs || [],
  };
}

async function syncStoreWithMongo(force = false) {
  const store = getStore();
  if (!hasMongoConnection()) return store;

  const nowMs = Date.now();
  if (!force && nowMs - mongoSyncState.lastRunAt < 5000) return store;

  const [tables, products, users, shifts, orders, transactions] = await Promise.all([
    TableModel.find().lean(),
    ProductModel.find().lean(),
    UserModel.find().lean(),
    ShiftModel.find().populate('cashier', 'name').sort({ createdAt: -1 }).lean(),
    OrderModel.find().populate('table', 'name').sort({ createdAt: -1 }).lean(),
    TransactionModel.find().sort({ createdAt: -1 }).lean(),
  ]);

  if (tables.length) {
    store.tables = tables.map((table) => {
      const existing = store.tables.find((item) => item.uniqueIdentifier === table.uniqueIdentifier || item.name === table.name || String(item._id) === String(table._id));
      return mapMongoTableToMemory(table, existing);
    });
  }

  if (products.length) {
    store.products = products.map((product, index) => {
      const existing = store.products.find((item) => item.name === product.name || String(item._id) === String(product._id));
      return mapMongoProductToMemory(product, index, existing);
    });
  }

  if (users.length) {
    store.users = users.map((user) => {
      const existing = store.users.find((item) => item.email === user.email || String(item._id) === String(user._id));
      return mapMongoUserToMemory(user, existing);
    });
  }

  if (shifts.length) {
    store.shifts = shifts.map((shift) => {
      const existing = store.shifts.find((item) => String(item._id) === String(shift._id));
      return mapMongoShiftToMemory(shift, existing);
    });
  }

  if (orders.length) {
    store.orders = orders.map((order) => {
      const existing = store.orders.find((item) => String(item._id) === String(order._id));
      return mapMongoOrderToMemory(order, existing);
    });
  }

  if (transactions.length) {
    store.transactions = transactions.map((transaction) => ({
      _id: String(transaction._id),
      orderId: String(transaction.order || ''),
      invoiceCode: transaction.invoiceCode || '',
      amount: Number(transaction.amount || 0),
      paidAmount: Number(transaction.paidAmount || transaction.amount || 0),
      changeAmount: Number(transaction.changeAmount || 0),
      methods: transaction.methods?.length ? transaction.methods : [{ method: transaction.paymentMethod, amount: Number(transaction.amount || 0) }],
      cashierId: transaction.cashierId || '',
      shiftId: transaction.shiftId || String(transaction.shift || ''),
      createdAt: transaction.createdAt || now(),
    }));
  }

  store.sequences.order = Math.max(store.sequences.order || 1, store.orders.length + 1);
  store.sequences.invoice = Math.max(store.sequences.invoice || 1, store.transactions.length + 1);
  mongoSyncState.lastRunAt = nowMs;
  return store;
}

async function ensureReady() {
  const store = await initializeMemoryStore();
  ensureRuntimeCollections(store);
  await syncStoreWithMongo();
  return store;
}

function getNextSequence(sequenceName) {
  const store = getStore();
  const current = store.sequences[sequenceName] || 1;
  store.sequences[sequenceName] = current + 1;
  return current;
}

function buildOrderCode() {
  return `ORD-${String(getNextSequence('order')).padStart(4, '0')}`;
}

function buildInvoiceCode() {
  return `INV-${String(getNextSequence('invoice')).padStart(4, '0')}`;
}

function buildServiceCallCode() {
  return `CALL-${String(getNextSequence('call')).padStart(4, '0')}`;
}

function pushAuditLog(action, actor, payload = {}) {
  const store = getStore();
  store.auditLogs.push({
    _id: uuidv4(),
    action,
    actor,
    payload,
    createdAt: now(),
  });
}

function findUserById(userId) {
  return getStore().users.find((user) => (user.id || user._id) === userId);
}

function findCustomerByPhone(phone) {
  if (!phone) return null;
  return getStore().customers.find((customer) => customer.phone === phone);
}

function findProductById(productId) {
  return getStore().products.find((product) => product._id === productId);
}

function findTableById(tableId) {
  return getStore().tables.find((table) => table._id === tableId);
}

function findTableByIdentifier(uniqueIdentifier) {
  return getStore().tables.find((table) => table.uniqueIdentifier === uniqueIdentifier);
}

function normalizeProduct(product) {
  return {
    ...product,
    imageUrl: normalizeImageDataUri(product.imageUrl || ''),
    isLowStock: product.stock <= product.minStock,
  };
}

function calculateModifierPrice(item) {
  const modifiers = item.modifiers || {};
  const variantExtras = (modifiers.variants || []).reduce((sum, variant) => sum + Number(variant.priceDelta || 0), 0);
  const addOnExtras = (modifiers.addOns || []).reduce((sum, addOn) => sum + Number(addOn.price || 0), 0);
  return variantExtras + addOnExtras;
}

function calculateOrderPricing({ items, orderType, voucherCode, customerPhone }) {
  const store = getStore();
  const settings = store.settings;
  const customer = findCustomerByPhone(customerPhone);

  let subtotal = 0;
  const normalizedItems = items.map((item) => {
    const product = findProductById(item.productId || item.product);
    if (!product) {
      throw new Error(`Product not found: ${item.productId || item.product}`);
    }

    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || item.priceAtOrder || product.price);
    const modifierPrice = calculateModifierPrice(item);
    const itemDiscount = Number(item.discount || 0);
    const lineSubtotal = Math.max(0, ((unitPrice + modifierPrice) * quantity) - itemDiscount);
    subtotal += lineSubtotal;

    return {
      _id: uuidv4(),
      productId: product._id,
      productName: product.name,
      category: product.category,
      quantity,
      unitPrice,
      modifierPrice,
      itemDiscount,
      note: item.note || '',
      modifiers: item.modifiers || {
        variants: [],
        addOns: [],
        sweetness: 'Normal',
        ice: 'Normal',
        spice: 'Normal',
      },
      lineSubtotal,
    };
  });

  const applicablePromo = store.promos.find((promo) => {
    if (!promo.active || !voucherCode) return false;
    if (promo.code.toLowerCase() !== voucherCode.toLowerCase()) return false;
    if (subtotal < promo.minPurchase) return false;
    return true;
  });

  const promoDiscount = applicablePromo
    ? applicablePromo.type === 'percentage'
      ? Math.round((subtotal * applicablePromo.value) / 100)
      : applicablePromo.value
    : 0;

  const memberDiscount = customer?.tier === 'Gold' ? Math.round(subtotal * 0.03) : 0;
  const discountedSubtotal = Math.max(0, subtotal - promoDiscount - memberDiscount);
  const serviceCharge = orderType === 'takeaway' ? 0 : Math.round((discountedSubtotal * settings.servicePercent) / 100);
  const tax = Math.round((discountedSubtotal * settings.taxPercent) / 100);
  const beforeRounding = discountedSubtotal + serviceCharge + tax;
  const roundedTotal = roundToNearest(beforeRounding, settings.roundingMode);

  return {
    items: normalizedItems,
    summary: {
      subtotal,
      promoDiscount,
      memberDiscount,
      serviceCharge,
      tax,
      roundingAdjustment: roundedTotal - beforeRounding,
      total: roundedTotal,
    },
    appliedPromo: applicablePromo ? { code: applicablePromo.code, title: applicablePromo.title } : null,
  };
}

function attachTableLiveStatus(table) {
  const activeOrders = getStore().orders.filter((order) =>
    order.tableId === table._id && !['paid', 'cancelled', 'refunded'].includes(order.status)
  );

  const latestCall = [...getStore().serviceCalls]
    .filter((call) => call.tableId === table._id && call.status !== 'done')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

  return {
    ...table,
    activeOrders,
    liveStatus: activeOrders.length > 0 ? 'occupied' : table.status,
    latestCall,
  };
}

function createNotification(type, title, message, level = 'info') {
  getStore().notifications.unshift({
    _id: uuidv4(),
    type,
    title,
    message,
    level,
    createdAt: now(),
  });
}

async function persistProductInventory(product) {
  if (!hasMongoConnection() || !product?._id) return;
  await ProductModel.findByIdAndUpdate(product._id, {
    stock: Number(product.stock || 0),
    soldCount: Number(product.soldCount || 0),
    minStock: Number(product.minStock || 0),
    available: product.available !== false,
    updatedAt: now(),
  }, { new: true });
}

async function reserveInventoryForOrder(items) {
  items.forEach((item) => {
    const product = findProductById(item.productId);
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }
    if (Number(product.stock || 0) < Number(item.quantity || 0)) {
      throw new Error('INSUFFICIENT_STOCK');
    }

    product.stock = Number(product.stock || 0) - Number(item.quantity || 0);
    product.soldCount = Number(product.soldCount || 0) + Number(item.quantity || 0);
    product.available = Number(product.stock || 0) > 0;
    product.updatedAt = now();

    if (product.stock <= Number(product.minStock || 0)) {
      createNotification(
        'low-stock',
        `Stok menipis: ${product.name}`,
        `${product.name} tersisa ${product.stock}. Segera lakukan restock.`,
        'warning'
      );
    }
  });

  await Promise.all(items.map(async (item) => {
    const product = findProductById(item.productId);
    if (product) {
      await persistProductInventory(product);
    }
  }));
}

async function restoreInventoryForOrder(order) {
  if (!order?.inventoryReserved || order.inventoryRestoredAt) return;

  order.items.forEach((item) => {
    const product = findProductById(item.productId);
    if (!product) return;
    product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
    product.soldCount = Math.max(0, Number(product.soldCount || 0) - Number(item.quantity || 0));
    product.available = Number(product.stock || 0) > 0;
    product.updatedAt = now();
  });

  order.inventoryRestoredAt = now();

  await Promise.all((order.items || []).map(async (item) => {
    const product = findProductById(item.productId);
    if (product) {
      await persistProductInventory(product);
    }
  }));
}

async function getClientBootstrap(uniqueIdentifier) {
  const store = await ensureReady();
  let table = findTableByIdentifier(uniqueIdentifier);
  if (!table && hasMongoConnection()) {
    await syncStoreWithMongo(true);
    table = findTableByIdentifier(uniqueIdentifier);
  }
  if (!table) throw new Error('TABLE_NOT_FOUND');

  return {
    settings: clone(store.settings),
    table: clone(attachTableLiveStatus(table)),
    categories: clone(store.categories),
    promos: clone(store.promos.filter((promo) => promo.active && promo.channels.includes('client'))),
    banners: [
      {
        _id: uuidv4(),
        title: store.settings.bannerMessage,
        subtitle: store.settings.heroSubtitle,
      },
    ],
    products: clone(store.products.map(normalizeProduct)),
  };
}

async function getClientLanding() {
  const store = await ensureReady();
  return {
    outletName: store.settings.outletName || store.settings.brandName || 'Arum Dalu',
    tables: clone((store.tables || []).map((table) => ({
      _id: table._id,
      name: table.name,
      uniqueIdentifier: table.uniqueIdentifier,
    }))),
  };
}

async function estimatePricing(payload) {
  await ensureReady();

  const pricing = calculateOrderPricing({
    items: payload.items || [],
    orderType: payload.orderType || payload.diningOption || 'dine-in',
    voucherCode: payload.voucherCode || '',
    customerPhone: payload.customerPhone || '',
  });

  const customer = payload.customerPhone ? findCustomerByPhone(payload.customerPhone) : null;

  return {
    customer: customer ? clone(customer) : null,
    appliedPromo: pricing.appliedPromo,
    summary: pricing.summary,
  };
}

async function findOrCreateCustomer(payload) {
  const store = await ensureReady();
  const phone = (payload.phone || '').trim();
  if (!phone) return null;

  let customer = store.customers.find((item) => item.phone === phone);
  if (!customer) {
    customer = {
      _id: uuidv4(),
      name: payload.name || 'Customer',
      phone,
      email: payload.email || '',
      memberCode: `ARUM-${String(store.customers.length + 1).padStart(4, '0')}`,
      tier: 'Bronze',
      points: 0,
      favoriteProductIds: [],
      savedAddresses: [],
      notes: '',
      createdAt: now(),
      updatedAt: now(),
    };
    store.customers.push(customer);
  } else {
    if (payload.name?.trim()) customer.name = payload.name.trim();
    if (payload.email?.trim()) customer.email = payload.email.trim();
    customer.updatedAt = now();
  }

  return clone(customer);
}

async function lookupCustomer(phone) {
  await ensureReady();
  return clone(findCustomerByPhone(phone));
}

async function createOrder(payload, actor = {}) {
  const store = await ensureReady();
  const table = findTableById(payload.tableId);
  if (!table) throw new Error('TABLE_NOT_FOUND');

  const customerPhone = payload.customerPhone || payload.customerWhatsapp || '';
  const customer = customerPhone
    ? await findOrCreateCustomer({
        name: payload.customerName,
        phone: customerPhone,
        email: payload.customerEmail,
      })
    : null;

  const pricing = calculateOrderPricing({
    items: payload.items || [],
    orderType: payload.orderType || 'dine-in',
    voucherCode: payload.voucherCode || '',
    customerPhone: payload.customerPhone || '',
  });

  const queueNumber = store.orders.filter((order) => isToday(order.createdAt)).length + 1;
  const status = payload.status || 'pending';
  const order = {
    _id: uuidv4(),
    orderCode: buildOrderCode(),
    invoiceCode: null,
    source: payload.source || 'cashier',
    channel: payload.channel || payload.source || 'cashier',
    tableId: table._id,
    tableName: table.name,
    orderType: payload.orderType || 'dine-in',
    diningOption: payload.diningOption || 'dine-in',
    customerName: payload.customerName || customer?.name || 'Customer',
    customerPhone: customerPhone || customer?.phone || '',
    customerWhatsapp: payload.customerWhatsapp || customerPhone || customer?.phone || '',
    customerEmail: payload.customerEmail || customer?.email || '',
    customerId: customer?._id || null,
    memberTier: customer?.tier || null,
    voucherCode: payload.voucherCode || '',
    appliedPromo: pricing.appliedPromo,
    status,
    kitchenStatus: status === 'hold'
      ? 'hold'
      : status === 'accepted'
        ? 'accepted'
        : status === 'preparing'
          ? 'preparing'
          : status === 'ready'
            ? 'ready'
            : 'queued',
    serviceStatus: status === 'served' ? 'served' : status === 'accepted' ? 'accepted' : 'waiting',
    paymentStatus: 'unpaid',
    paymentPreference: payload.paymentPreference || 'pay_at_cashier',
    note: payload.note || '',
    customerRequest: payload.customerRequest || '',
    assignedWaiterId: payload.assignedWaiterId || null,
    cashierId: actor.userId || null,
    shiftId: actor.shiftId || null,
    splitSourceOrderId: payload.splitSourceOrderId || null,
    mergedOrderIds: payload.mergedOrderIds || [],
    paymentSplitCode: payload.paymentSplitCode || uuidv4(),
    queueNumber,
    items: pricing.items,
    pricing: {
      ...pricing.summary,
      paidAmount: 0,
      changeAmount: 0,
    },
    payments: [],
    refundHistory: [],
    inventoryReserved: payload.inventoryReserved !== undefined
      ? !!payload.inventoryReserved
      : !payload.skipInventoryAdjustment,
    inventoryRestoredAt: null,
    timeline: [
      {
        _id: uuidv4(),
        status,
        label: status === 'hold' ? 'Transaksi ditahan' : 'Pesanan dibuat',
        by: actor.name || payload.source || 'system',
        createdAt: now(),
      },
    ],
    createdAt: now(),
    updatedAt: now(),
  };

  if (!payload.skipInventoryAdjustment) {
    await reserveInventoryForOrder(order.items);
  }

  if (hasMongoConnection()) {
    const createdOrder = await OrderModel.create(buildMongoOrderPayload(order));
    order._id = String(createdOrder._id);
  }

  store.orders.unshift(order);
  table.activeOrderIds = Array.from(new Set([...(table.activeOrderIds || []), order._id]));
  table.status = 'occupied';
  table.currentCustomerName = order.customerName;
  table.updatedAt = now();

  pushAuditLog('ORDER_CREATED', actor.name || order.source, {
    orderId: order._id,
    tableId: table._id,
  });

  if (hasMongoConnection()) {
    await OrderModel.findByIdAndUpdate(order._id, buildMongoOrderPayload(order), { new: true });
  }

  return clone(order);
}

async function getOrderById(orderId) {
  await ensureReady();
  const order = getStore().orders.find((item) => item._id === orderId);
  return order ? clone(order) : null;
}

async function listOrders(filters = {}) {
  await ensureReady();
  let orders = [...getStore().orders];

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    orders = orders.filter((order) => statuses.includes(order.status));
  }
  if (filters.tableId) orders = orders.filter((order) => order.tableId === filters.tableId);
  if (filters.today) orders = orders.filter((order) => isToday(order.createdAt));

  return clone(orders);
}

async function updateOrderStatus(orderId, status, actorName, extra = {}) {
  await ensureReady();
  const store = getStore();
  const order = store.orders.find((item) => item._id === orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const derivedKitchenStatus = extra.kitchenStatus || (
    status === 'hold'
      ? 'hold'
      : status === 'accepted'
        ? 'accepted'
        : status === 'preparing'
          ? 'preparing'
          : status === 'ready'
            ? 'ready'
            : ['served', 'paid'].includes(status)
              ? 'done'
              : ['cancelled', 'refunded'].includes(status)
                ? 'cancelled'
                : order.kitchenStatus
  );

  const derivedServiceStatus = extra.serviceStatus || (
    status === 'accepted'
      ? 'accepted'
      : status === 'preparing'
        ? 'preparing'
        : status === 'ready'
          ? 'ready'
          : status === 'served'
            ? 'served'
            : status === 'paid'
              ? 'paid'
              : ['cancelled', 'refunded'].includes(status)
                ? status
                : order.serviceStatus
  );

  order.status = status;
  order.kitchenStatus = derivedKitchenStatus;
  order.serviceStatus = derivedServiceStatus;
  order.updatedAt = now();
  order.timeline.unshift({
    _id: uuidv4(),
    status,
    label: extra.label || `Status menjadi ${status}`,
    by: actorName,
    createdAt: now(),
  });

  if (['paid', 'cancelled', 'refunded'].includes(status)) {
    if (['cancelled', 'refunded'].includes(status)) {
      await restoreInventoryForOrder(order);
    }
    const table = findTableById(order.tableId);
    if (table) {
      table.activeOrderIds = (table.activeOrderIds || []).filter((item) => item !== order._id);
      if (table.activeOrderIds.length === 0) {
        table.status = 'available';
        table.currentCustomerName = '';
      }
      table.updatedAt = now();
    }
  }

  pushAuditLog('ORDER_STATUS_UPDATED', actorName, { orderId, status });
  if (hasMongoConnection()) {
    await OrderModel.findByIdAndUpdate(order._id, buildMongoOrderPayload(order), { new: true });
  }
  return clone(order);
}

async function processPayment(orderId, payload, actor) {
  await ensureReady();
  const store = getStore();
  const order = store.orders.find((item) => item._id === orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const methods = payload.methods?.length
    ? payload.methods
    : [{ method: payload.paymentMethod || 'Cash', amount: payload.amount || order.pricing.total }];

  const incomingAmount = methods.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (incomingAmount <= 0) throw new Error('INVALID_PAYMENT_AMOUNT');

  const existingPaid = Number(order.pricing?.paidAmount || 0);
  const remainingBeforePayment = Math.max(0, Number(order.pricing.total || 0) - existingPaid);
  const cumulativePaid = existingPaid + incomingAmount;
  const changeAmount = Math.max(0, cumulativePaid - Number(order.pricing.total || 0));
  const recognizedRevenue = Math.min(incomingAmount, remainingBeforePayment);
  const appendedPayments = methods.map((item) => ({
    _id: uuidv4(),
    method: item.method,
    amount: Number(item.amount),
    status: item.method === 'QRIS' ? (payload.qrisStatus || 'paid') : 'paid',
    reference: item.reference || '',
    createdAt: now(),
  }));

  order.invoiceCode = order.invoiceCode || buildInvoiceCode();
  order.paymentStatus = cumulativePaid >= Number(order.pricing.total || 0) ? 'paid' : 'partial';
  order.status = cumulativePaid >= Number(order.pricing.total || 0) ? 'paid' : order.status;
  order.kitchenStatus = cumulativePaid >= Number(order.pricing.total || 0) ? 'ready' : order.kitchenStatus;
  order.serviceStatus = cumulativePaid >= Number(order.pricing.total || 0) ? 'paid' : order.serviceStatus;
  order.payments = [...(order.payments || []), ...appendedPayments];
  order.pricing.paidAmount = cumulativePaid;
  order.pricing.changeAmount = changeAmount;
  order.updatedAt = now();

  if (actor.shiftId) {
    const shift = store.shifts.find((item) => item._id === actor.shiftId);
    if (shift) {
      shift.totalRevenue = (shift.totalRevenue || 0) + recognizedRevenue;
      shift.updatedAt = now();
    }
  }

  store.transactions.unshift({
    _id: uuidv4(),
    orderId: order._id,
    invoiceCode: order.invoiceCode,
    amount: recognizedRevenue,
    paidAmount: incomingAmount,
    changeAmount,
    methods: clone(appendedPayments),
    cashierId: actor.userId,
    shiftId: actor.shiftId || null,
    createdAt: now(),
  });

  await updateOrderStatus(orderId, order.status, actor.name, {
    label: cumulativePaid >= Number(order.pricing.total || 0) ? 'Pembayaran berhasil' : 'Pembayaran parsial',
    serviceStatus: cumulativePaid >= Number(order.pricing.total || 0) ? 'paid' : order.serviceStatus,
  });

  if (hasMongoConnection()) {
    await TransactionModel.create({
      order: order._id,
      shift: actor.shiftId || null,
      amount: Number(recognizedRevenue || 0),
      paymentMethod: methods[0]?.method || 'Cash',
      invoiceCode: order.invoiceCode || '',
      paidAmount: incomingAmount,
      changeAmount,
      methods: clone(appendedPayments),
      cashierId: actor.userId || '',
      shiftId: actor.shiftId || '',
    });
  }

  return clone(order);
}

async function refundOrder(orderId, payload, actor) {
  await ensureReady();
  const order = getStore().orders.find((item) => item._id === orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const refundAmount = Number(payload.amount || order.pricing.total);
  order.refundHistory.unshift({
    _id: uuidv4(),
    type: payload.type || 'full',
    amount: refundAmount,
    reason: payload.reason || 'Tanpa alasan',
    approvedBy: actor.name,
    createdAt: now(),
  });
  order.paymentStatus = 'refunded';
  order.status = 'refunded';
  order.updatedAt = now();
  await restoreInventoryForOrder(order);
  order.timeline.unshift({
    _id: uuidv4(),
    status: 'refunded',
    label: `Refund ${payload.type || 'full'} sebesar Rp ${refundAmount}`,
    by: actor.name,
    createdAt: now(),
  });
  pushAuditLog('ORDER_REFUNDED', actor.name, { orderId, refundAmount });
  return clone(order);
}

async function moveOrderTable(orderId, newTableId, actorName) {
  await ensureReady();
  const store = getStore();
  const order = store.orders.find((item) => item._id === orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const newTable = findTableById(newTableId);
  if (!newTable) throw new Error('TABLE_NOT_FOUND');

  const previousTable = findTableById(order.tableId);
  if (previousTable) {
    previousTable.activeOrderIds = (previousTable.activeOrderIds || []).filter((item) => item !== order._id);
    if (previousTable.activeOrderIds.length === 0) {
      previousTable.status = 'available';
      previousTable.currentCustomerName = '';
    }
    previousTable.updatedAt = now();
  }

  order.tableId = newTable._id;
  order.tableName = newTable.name;
  order.updatedAt = now();
  order.timeline.unshift({
    _id: uuidv4(),
    status: order.status,
    label: `Dipindahkan ke ${newTable.name}`,
    by: actorName,
    createdAt: now(),
  });

  newTable.activeOrderIds = Array.from(new Set([...(newTable.activeOrderIds || []), order._id]));
  newTable.status = 'occupied';
  newTable.currentCustomerName = order.customerName;
  newTable.updatedAt = now();

  pushAuditLog('ORDER_MOVED_TABLE', actorName, {
    orderId,
    newTableId,
  });

  return clone(order);
}

async function assignOrderWaiter(orderId, waiterId, actorName) {
  await ensureReady();
  const order = getStore().orders.find((item) => item._id === orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const waiter = findUserById(waiterId);
  if (!waiter) throw new Error('USER_NOT_FOUND');

  order.assignedWaiterId = waiterId;
  order.assignedWaiterName = waiter.name;
  order.updatedAt = now();
  order.timeline.unshift({
    _id: uuidv4(),
    status: order.status,
    label: `Waiter ${waiter.name} ditugaskan`,
    by: actorName,
    createdAt: now(),
  });

  pushAuditLog('ORDER_ASSIGNED_WAITER', actorName, { orderId, waiterId });
  return clone(order);
}

async function splitOrder(orderId, groups, actorName) {
  const order = await getOrderById(orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');

  const createdOrders = [];
  for (const group of groups) {
    const groupItems = order.items.filter((item) => group.itemIds.includes(item._id));
    if (groupItems.length === 0) continue;

    createdOrders.push(await createOrder({
      tableId: order.tableId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderType: order.orderType,
      source: 'cashier',
      status: 'pending',
      splitSourceOrderId: order._id,
      skipInventoryAdjustment: true,
      inventoryReserved: true,
      items: groupItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        modifiers: item.modifiers,
        note: item.note,
        discount: item.itemDiscount,
      })),
    }, { name: actorName, userId: null, shiftId: order.shiftId }));
  }

  const rawOrder = getStore().orders.find((item) => item._id === orderId);
  if (rawOrder) {
    rawOrder.inventoryReserved = false;
  }

  await updateOrderStatus(orderId, 'cancelled', actorName, {
    label: 'Order asal dibatalkan setelah split bill',
  });

  return createdOrders;
}

async function mergeOrders(orderIds, actorName) {
  const orders = await listOrders();
  const selectedOrders = orders.filter((order) => orderIds.includes(order._id));
  if (selectedOrders.length < 2) throw new Error('NOT_ENOUGH_ORDERS');

  const baseOrder = selectedOrders[0];
  const mergedItems = selectedOrders.flatMap((order) => order.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    modifiers: item.modifiers,
    note: item.note,
    discount: item.itemDiscount,
  })));

  const mergedOrder = await createOrder({
    tableId: baseOrder.tableId,
    customerName: baseOrder.customerName,
    customerPhone: baseOrder.customerPhone,
    orderType: baseOrder.orderType,
    source: 'cashier',
    mergedOrderIds: orderIds,
    skipInventoryAdjustment: true,
    inventoryReserved: true,
    items: mergedItems,
  }, { name: actorName, userId: null, shiftId: baseOrder.shiftId });

  for (const order of selectedOrders) {
    const rawOrder = getStore().orders.find((item) => item._id === order._id);
    if (rawOrder) {
      rawOrder.inventoryReserved = false;
    }
    await updateOrderStatus(order._id, 'cancelled', actorName, {
      label: 'Digabungkan ke order lain',
    });
  }

  return mergedOrder;
}

async function startShift(userId, initialCash, actorName) {
  const store = await ensureReady();
  const existingShift = store.shifts.find((shift) => shift.cashierId === userId && !shift.endTime);
  if (existingShift) return clone(existingShift);

  const shift = {
    _id: uuidv4(),
    cashierId: userId,
    cashierName: findUserById(userId)?.name || actorName || 'Cashier',
    startTime: now(),
    endTime: null,
    shiftType: 'Pagi',
    initialCash: Number(initialCash || 0),
    finalCash: 0,
    totalRevenue: 0,
    totalExpense: 0,
    totalOrders: 0,
    notes: '',
    cashLogs: [],
    createdAt: now(),
    updatedAt: now(),
  };

  if (hasMongoConnection()) {
    const createdShift = await ShiftModel.create(buildMongoShiftPayload(shift));
    shift._id = String(createdShift._id);
  }

  store.shifts.unshift(shift);
  pushAuditLog('SHIFT_STARTED', actorName || shift.cashierName, { shiftId: shift._id });
  return clone(shift);
}

async function getCurrentShift(userId) {
  await ensureReady();
  const shift = getStore().shifts.find((item) => item.cashierId === userId && !item.endTime);
  return shift ? clone(shift) : null;
}

async function endShift(userId, actorName) {
  await ensureReady();
  const store = getStore();
  const shift = store.shifts.find((item) => item.cashierId === userId && !item.endTime);
  if (!shift) throw new Error('SHIFT_NOT_FOUND');

  const paidTransactions = store.transactions.filter((transaction) => transaction.shiftId === shift._id);
  const shiftExpenses = store.expenses.filter((expense) => expense.shift === shift._id);
  const totalRevenue = paidTransactions.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = shiftExpenses.reduce((sum, item) => sum + item.amount, 0);

  shift.endTime = now();
  shift.totalRevenue = totalRevenue;
  shift.totalExpense = totalExpense;
  shift.finalCash = shift.initialCash + totalRevenue - totalExpense;
  shift.totalOrders = paidTransactions.length;
  shift.updatedAt = now();

  pushAuditLog('SHIFT_ENDED', actorName || shift.cashierName, { shiftId: shift._id });
  if (hasMongoConnection()) {
    await ShiftModel.findByIdAndUpdate(shift._id, buildMongoShiftPayload(shift), { new: true });
  }
  return clone(shift);
}

async function addCashLog(payload, actor) {
  const store = await ensureReady();
  const shift = store.shifts.find((item) => item._id === payload.shiftId);
  if (!shift) throw new Error('SHIFT_NOT_FOUND');

  const cashLog = {
    _id: uuidv4(),
    shiftId: shift._id,
    type: payload.type,
    amount: Number(payload.amount),
    note: payload.note || '',
    createdBy: actor.name,
    createdAt: now(),
  };

  store.cashLogs.unshift(cashLog);
  shift.cashLogs.unshift(cashLog);
  return clone(cashLog);
}

async function createServiceCall(uniqueIdentifier, payload) {
  const store = await ensureReady();
  const table = findTableByIdentifier(uniqueIdentifier);
  if (!table) throw new Error('TABLE_NOT_FOUND');

  const serviceCall = {
    _id: uuidv4(),
    code: buildServiceCallCode(),
    tableId: table._id,
    tableName: table.name,
    type: payload.type || 'Panggil pelayan',
    note: payload.note || '',
    customerName: payload.customerName || table.currentCustomerName || 'Customer',
    status: 'open',
    createdAt: now(),
    updatedAt: now(),
  };

  store.serviceCalls.unshift(serviceCall);
  createNotification('service-call', `Panggilan ${table.name}`, `${serviceCall.type} dari ${table.name}`, 'warning');
  return clone(serviceCall);
}

async function closeServiceCall(callId, actorName) {
  await ensureReady();
  const call = getStore().serviceCalls.find((item) => item._id === callId);
  if (!call) throw new Error('CALL_NOT_FOUND');

  call.status = 'done';
  call.updatedAt = now();
  pushAuditLog('SERVICE_CALL_DONE', actorName, { callId });
  return clone(call);
}

async function listServiceCalls(filters = {}) {
  await ensureReady();
  let calls = [...getStore().serviceCalls];
  if (filters.status) {
    calls = calls.filter((call) => call.status === filters.status);
  }
  return clone(calls);
}

async function listReservations(filters = {}) {
  await ensureReady();
  let reservations = [...getStore().reservations];
  if (filters.status) {
    reservations = reservations.filter((reservation) => reservation.status === filters.status);
  }
  return clone(reservations);
}

async function listCashLogs(filters = {}) {
  await ensureReady();
  let cashLogs = [...getStore().cashLogs];
  if (filters.shiftId) {
    cashLogs = cashLogs.filter((cashLog) => cashLog.shiftId === filters.shiftId);
  }
  return clone(cashLogs);
}

async function listCustomers(filters = {}) {
  await ensureReady();
  let customers = [...getStore().customers];
  if (filters.query) {
    const query = String(filters.query).toLowerCase();
    customers = customers.filter((customer) =>
      `${customer.name} ${customer.phone} ${customer.memberCode}`.toLowerCase().includes(query)
    );
  }
  return clone(customers);
}

async function listAuditLogs(limit = 50) {
  await ensureReady();
  return clone(getStore().auditLogs.slice(0, limit));
}

async function submitFeedback(payload) {
  const store = await ensureReady();
  const feedback = {
    _id: uuidv4(),
    customerName: payload.customerName || 'Customer',
    phone: payload.phone || '',
    rating: Number(payload.rating || 5),
    comment: payload.comment || '',
    source: payload.source || 'client',
    orderId: payload.orderId || null,
    createdAt: now(),
  };

  store.feedback.unshift(feedback);
  return clone(feedback);
}

async function getCashierDashboard(userId) {
  const store = await ensureReady();
  const currentShift = store.shifts.find((shift) => shift.cashierId === userId && !shift.endTime) || null;
  const todayOrders = store.orders.filter((order) => isToday(order.createdAt));
  const activeOrders = todayOrders.filter((order) => ['pending', 'accepted', 'preparing', 'ready', 'served', 'hold'].includes(order.status));
  const heldOrders = activeOrders.filter((order) => order.status === 'hold');
  const recentOrders = todayOrders.slice(0, 10);
  const lowStock = store.products.filter((product) => product.stock <= product.minStock);
  const openCalls = store.serviceCalls.filter((call) => call.status === 'open');
  const pendingPayments = todayOrders.filter((order) => ['unpaid', 'partial'].includes(order.paymentStatus));
  const todayReservations = store.reservations.filter((reservation) => ['confirmed', 'seated'].includes(reservation.status));
  const waiterOptions = store.users
    .filter((user) => ['waiter', 'cashier'].includes(user.role))
    .map((user) => ({ _id: user._id, name: user.name, role: user.role }));

  return {
    settings: clone(store.settings),
    currentShift: clone(currentShift),
    categories: clone(store.categories),
    products: clone(store.products.map(normalizeProduct)),
    tables: clone(store.tables.map(attachTableLiveStatus)),
    heldOrders: clone(heldOrders),
    activeOrders: clone(activeOrders),
    recentOrders: clone(recentOrders),
    lowStock: clone(lowStock),
    openCalls: clone(openCalls),
    pendingPayments: clone(pendingPayments),
    reservations: clone(todayReservations),
    promos: clone(store.promos.filter((promo) => promo.active && promo.channels.some((channel) => ['cashier', 'client'].includes(channel)))),
    waiters: clone(waiterOptions),
    quickActions: clone(store.quickActions),
    notifications: clone(store.notifications.slice(0, 10)),
    summary: {
      totalOrders: todayOrders.length,
      totalRevenue: store.transactions.filter((transaction) => isToday(transaction.createdAt)).reduce((sum, item) => sum + item.amount, 0),
      totalCash: store.transactions.filter((transaction) => isToday(transaction.createdAt)).flatMap((transaction) => transaction.methods).filter((method) => method.method === 'Cash').reduce((sum, item) => sum + item.amount, 0),
      totalNonCash: store.transactions.filter((transaction) => isToday(transaction.createdAt)).flatMap((transaction) => transaction.methods).filter((method) => method.method !== 'Cash').reduce((sum, item) => sum + item.amount, 0),
      totalPendingPayment: pendingPayments.reduce((sum, order) => sum + Number(order.pricing.total || 0), 0),
    },
  };
}

async function getCashierSummaryToday(userId) {
  const dashboard = await getCashierDashboard(userId);
  return {
    currentShift: dashboard.currentShift,
    summary: dashboard.summary,
    heldCount: dashboard.heldOrders.length,
    callCount: dashboard.openCalls.length,
    lowStockCount: dashboard.lowStock.length,
  };
}

async function getAdminDashboard() {
  const store = await ensureReady();
  const todayOrders = store.orders.filter((order) => isToday(order.createdAt));
  const paidToday = todayOrders.filter((order) => order.status === 'paid');
  const revenueToday = paidToday.reduce((sum, order) => sum + order.pricing.total, 0);
  const lowStock = store.products.filter((product) => product.stock <= product.minStock);
  const todayTransactions = store.transactions.filter((transaction) => isToday(transaction.createdAt));
  const paymentBreakdown = todayTransactions.reduce((acc, transaction) => {
    transaction.methods.forEach((method) => {
      acc[method.method] = (acc[method.method] || 0) + Number(method.amount || 0);
    });
    return acc;
  }, {});
  const feedbackToday = store.feedback.filter((item) => isToday(item.createdAt));

  return {
    settings: clone(store.settings),
    counts: {
      products: store.products.length,
      tables: store.tables.length,
      users: store.users.length,
      customers: store.customers.length,
      promos: store.promos.length,
    },
    today: {
      orders: todayOrders.length,
      paidOrders: paidToday.length,
      revenue: revenueToday,
      grossProfitEstimate: Math.round(revenueToday * 0.62),
    },
    tables: clone(store.tables.map(attachTableLiveStatus)),
    lowStock: clone(lowStock),
    openCalls: clone(store.serviceCalls.filter((call) => call.status === 'open')),
    notifications: clone(store.notifications.slice(0, 12)),
    topProducts: clone([...store.products].sort((a, b) => (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0)).slice(0, 5)),
    reservations: clone(store.reservations),
    recentShifts: clone(store.shifts.slice(0, 5)),
    paymentBreakdown: clone(paymentBreakdown),
    feedbackSummary: {
      total: feedbackToday.length,
      averageRating: feedbackToday.length
        ? Number((feedbackToday.reduce((sum, item) => sum + Number(item.rating || 0), 0) / feedbackToday.length).toFixed(1))
        : 0,
    },
  };
}

async function getAdminCatalog() {
  const store = await ensureReady();
  const publicWebBaseUrl = store.settings.publicWebBaseUrl || 'https://arum-dal.vercel.app';
  return {
    categories: clone(store.categories),
    products: clone(store.products.map(normalizeProduct)),
    promos: clone(store.promos),
    customers: clone(store.customers),
    users: clone(store.users.map((user) => ({ ...user, password: undefined }))),
    tables: clone(store.tables.map((table) => ({
      ...attachTableLiveStatus(table),
      qrUrl: `${publicWebBaseUrl.replace(/\/$/, '')}${table.qrLandingPath || `/order/${table.uniqueIdentifier}`}`,
    }))),
    shifts: clone(store.shifts),
    reservations: clone(store.reservations),
    printers: clone(store.printers),
    feedback: clone(store.feedback),
    auditLogs: clone(store.auditLogs || []),
    settings: clone(store.settings),
  };
}

async function createAdminCategory(payload, actorName) {
  const store = await ensureReady();
  const category = {
    _id: uuidv4(),
    name: payload.name,
    icon: payload.icon || 'circle',
    accentColor: payload.accentColor || '#27AE60',
    active: payload.active !== false,
    createdAt: now(),
    updatedAt: now(),
  };

  store.categories.push(category);
  pushAuditLog('CATEGORY_CREATED', actorName, { categoryId: category._id });
  return clone(category);
}

async function createAdminProduct(payload, actorName) {
  const store = await ensureReady();
  const category = store.categories.find((item) => item._id === payload.categoryId || item.name === payload.category);
  const product = {
    ...payload,
    _id: uuidv4(),
    category: category?.name || payload.category || 'Lainnya',
    categoryId: category?._id || payload.categoryId || null,
    sku: payload.sku || `SKU-${String(store.products.length + 1).padStart(3, '0')}`,
    barcode: payload.barcode || `${Date.now()}`.slice(-12),
    minStock: Number(payload.minStock || 5),
    stock: Number(payload.stock || 0),
    price: Number(payload.price || 0),
    description: payload.description || '',
    imageUrl: normalizeImageDataUri(payload.imageUrl || payload.imageBase64 || ''),
    available: payload.available !== false,
    featured: !!payload.featured,
    bestSeller: !!payload.bestSeller,
    soldCount: Number(payload.soldCount || 0),
    tags: payload.tags || [],
    addOns: payload.addOns || [],
    variants: payload.variants || [],
    sweetnessLevels: payload.sweetnessLevels || ['Normal'],
    iceLevels: payload.iceLevels || ['Normal'],
    spiceLevels: payload.spiceLevels || ['Normal'],
    allergens: payload.allergens || [],
    bundleSuggestions: payload.bundleSuggestions || [],
    schedule: payload.schedule || { availableAllDay: true, start: '00:00', end: '23:59' },
    createdAt: now(),
    updatedAt: now(),
  };
  if (hasMongoConnection()) {
    const createdProduct = await ProductModel.create({
      name: product.name,
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      price: Number(product.price || 0),
      category: product.category || 'Lainnya',
      stock: Number(product.stock || 0),
      minStock: Number(product.minStock || 5),
      available: product.available !== false,
      featured: !!product.featured,
      bestSeller: !!product.bestSeller,
      soldCount: Number(product.soldCount || 0),
    });
    product._id = String(createdProduct._id);
  }

  store.products.unshift(product);
  pushAuditLog('PRODUCT_CREATED', actorName, { productId: product._id });
  return clone(product);
}

async function updateAdminProduct(productId, payload, actorName) {
  await ensureReady();
  const product = getStore().products.find((item) => item._id === productId);
  if (!product) throw new Error('PRODUCT_NOT_FOUND');
  const previousStock = Number(product.stock || 0);
  const previousMinStock = Number(product.minStock || 5);
  Object.assign(product, payload, {
    description: payload.description !== undefined ? payload.description : product.description,
    imageUrl: payload.imageUrl || payload.imageBase64 ? normalizeImageDataUri(payload.imageUrl || payload.imageBase64, product.imageUrl || '') : product.imageUrl,
    stock: payload.stock !== undefined ? Number(payload.stock || 0) : Number(product.stock || 0),
    minStock: payload.minStock !== undefined ? Number(payload.minStock || 5) : Number(product.minStock || 5),
    price: payload.price !== undefined ? Number(payload.price || 0) : Number(product.price || 0),
    available: payload.available !== undefined ? payload.available !== false : product.available !== false,
    featured: payload.featured !== undefined ? !!payload.featured : !!product.featured,
    bestSeller: payload.bestSeller !== undefined ? !!payload.bestSeller : !!product.bestSeller,
    updatedAt: now(),
  });
  if (payload.stock !== undefined && payload.available === undefined) {
    product.available = Number(product.stock || 0) > 0;
  }
  if (hasMongoConnection()) {
    await ProductModel.findByIdAndUpdate(productId, {
      name: product.name,
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      price: Number(product.price || 0),
      category: product.category || 'Lainnya',
      stock: Number(product.stock || 0),
      minStock: Number(product.minStock || 5),
      available: product.available !== false,
      featured: !!product.featured,
      bestSeller: !!product.bestSeller,
      soldCount: Number(product.soldCount || 0),
    }, { new: true });
  }
  const stockDelta = Number(product.stock || 0) - previousStock;
  if (stockDelta !== 0) {
    createNotification(
      'stock-adjustment',
      `Stok ${stockDelta > 0 ? 'masuk' : 'keluar'}: ${product.name}`,
      `${product.name} ${stockDelta > 0 ? 'bertambah' : 'berkurang'} ${Math.abs(stockDelta)}. Stok sekarang ${product.stock}.`,
      stockDelta > 0 ? 'success' : 'warning'
    );
  }
  if (Number(product.stock || 0) <= Number(product.minStock || 0)) {
    createNotification(
      'low-stock',
      `Stok menipis: ${product.name}`,
      `${product.name} tersisa ${product.stock}. Segera lakukan restock.`,
      'warning'
    );
  } else if (previousStock <= previousMinStock && Number(product.stock || 0) > Number(product.minStock || 0)) {
    createNotification(
      'stock-restored',
      `Stok kembali aman: ${product.name}`,
      `${product.name} kini tersedia ${product.stock} dan sudah melewati batas minimum.`,
      'success'
    );
  }
  pushAuditLog('PRODUCT_UPDATED', actorName, { productId });
  return clone(product);
}

async function deleteAdminProduct(productId, actorName) {
  await ensureReady();
  const store = getStore();
  const index = store.products.findIndex((item) => item._id === productId);
  if (index < 0) throw new Error('PRODUCT_NOT_FOUND');
  const [deletedProduct] = store.products.splice(index, 1);
  if (hasMongoConnection()) {
    await ProductModel.findByIdAndDelete(productId);
  }
  pushAuditLog('PRODUCT_DELETED', actorName, { productId, name: deletedProduct?.name || '' });
  return { success: true, productId };
}

async function createAdminTable(payload, actorName) {
  const store = await ensureReady();
  const table = {
    ...payload,
    _id: uuidv4(),
    uniqueIdentifier: uuidv4(),
    activeOrderIds: [],
    status: payload.status || 'available',
    qrLandingPath: '',
    createdAt: now(),
    updatedAt: now(),
  };
  table.qrLandingPath = `/order/${table.uniqueIdentifier}`;
  if (hasMongoConnection()) {
    const createdTable = await TableModel.create({
      name: table.name,
      uniqueIdentifier: table.uniqueIdentifier,
      area: table.area || 'Indoor',
      capacity: Number(table.capacity || 4),
      status: table.status || 'available',
    });
    table._id = String(createdTable._id);
  }
  store.tables.push(table);
  pushAuditLog('TABLE_CREATED', actorName, { tableId: table._id });
  return clone(table);
}

async function updateAdminTable(tableId, payload, actorName) {
  await ensureReady();
  const table = getStore().tables.find((item) => item._id === tableId);
  if (!table) throw new Error('TABLE_NOT_FOUND');
  Object.assign(table, payload, { updatedAt: now() });
  if (hasMongoConnection()) {
    await TableModel.findByIdAndUpdate(tableId, {
      name: table.name,
      uniqueIdentifier: table.uniqueIdentifier,
      area: table.area || 'Indoor',
      capacity: Number(table.capacity || 4),
      status: table.status || 'available',
    }, { new: true });
  }
  pushAuditLog('TABLE_UPDATED', actorName, { tableId });
  return clone(table);
}

async function createAdminUser(payload, actorName) {
  const store = await ensureReady();
  const existingUser = store.users.find((item) => item.email?.toLowerCase() === String(payload.email || '').toLowerCase());
  if (existingUser) throw new Error('USER_ALREADY_EXISTS');
  const safeRole = payload.role === 'waiter' ? 'waiter' : 'cashier';
  const user = {
    _id: uuidv4(),
    id: undefined,
    name: payload.name,
    email: payload.email,
    role: safeRole,
    phone: payload.phone || '',
    isActive: true,
    permissions: payload.permissions || [],
    favoriteProductIds: [],
    performance: {
      targetSales: Number(payload.targetSales || 0),
      ordersHandled: 0,
      avgCheckoutSeconds: 0,
    },
    password: payload.password || 'changeme123',
    createdAt: now(),
    updatedAt: now(),
  };
  if (hasMongoConnection()) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user.password, salt);
    const createdUser = await UserModel.create({
      name: user.name,
      email: user.email,
      password: hashedPassword,
      role: safeRole,
      phone: user.phone || '',
      isActive: true,
      updatedAt: now(),
    });
    user._id = String(createdUser._id);
    user.password = createdUser.password;
  }

  user.id = user._id;
  store.users.push(user);
  pushAuditLog('USER_CREATED', actorName, { userId: user._id });
  return clone({ ...user, password: undefined });
}

async function updateAdminUserStatus(userId, payload, actorName) {
  await ensureReady();
  const store = getStore();
  const user = store.users.find((item) => item._id === userId || item.id === userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  user.isActive = payload.isActive !== false;
  user.updatedAt = now();
  if (hasMongoConnection()) {
    await UserModel.findByIdAndUpdate(user._id, {
      isActive: user.isActive,
      updatedAt: now(),
    }, { new: true });
  }
  pushAuditLog(user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', actorName, { userId: user._id });
  return clone({ ...user, password: undefined });
}

async function updateAdminSettings(payload, actorName) {
  const store = await ensureReady();
  store.settings = {
    ...store.settings,
    ...payload,
    bannerImageUrl: normalizeImageDataUri(payload.bannerImageUrl || payload.bannerImageBase64 || '', store.settings.bannerImageUrl || ''),
    colors: {
      ...store.settings.colors,
      ...(payload.colors || {}),
    },
  };
  pushAuditLog('SETTINGS_UPDATED', actorName, payload);
  return clone(store.settings);
}

async function createAdminPromo(payload, actorName) {
  const store = await ensureReady();
  const promo = {
    _id: uuidv4(),
    code: payload.code,
    title: payload.title,
    description: payload.description || '',
    imageUrl: normalizeImageDataUri(payload.imageUrl || payload.imageBase64 || ''),
    bannerMessage: payload.bannerMessage || '',
    type: payload.type || 'percentage',
    value: Number(payload.value || 0),
    minPurchase: Number(payload.minPurchase || 0),
    active: payload.active !== false,
    memberOnly: !!payload.memberOnly,
    appliesToCategories: payload.appliesToCategories || [],
    appliesToProducts: payload.appliesToProducts || [],
    channels: payload.channels || ['client', 'cashier'],
    startAt: payload.startAt || now().toISOString(),
    endAt: payload.endAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    createdAt: now(),
    updatedAt: now(),
  };
  store.promos.unshift(promo);
  pushAuditLog('PROMO_CREATED', actorName, { promoId: promo._id });
  return clone(promo);
}

async function getReportsOverview(period = 'daily') {
  const store = await ensureReady();
  const referenceStart = resolveReportStart(period);
  const filteredOrders = store.orders.filter((order) => new Date(order.createdAt) >= referenceStart);
  const paidOrders = filteredOrders.filter((order) => order.status === 'paid');
  const revenue = paidOrders.reduce((sum, order) => sum + order.pricing.total, 0);
  const refunds = filteredOrders.flatMap((order) => order.refundHistory || []).reduce((sum, refund) => sum + refund.amount, 0);
  const paymentBreakdown = store.transactions
    .filter((transaction) => new Date(transaction.createdAt) >= referenceStart)
    .reduce((acc, transaction) => {
      transaction.methods.forEach((method) => {
        acc[method.method] = (acc[method.method] || 0) + Number(method.amount || 0);
      });
      return acc;
    }, {});

  const productCounter = {};
  const productRevenueCounter = {};
  paidOrders.forEach((order) => {
    order.items.forEach((item) => {
      productCounter[item.productName] = (productCounter[item.productName] || 0) + item.quantity;
      productRevenueCounter[item.productName] = (productRevenueCounter[item.productName] || 0) + Number(item.lineSubtotal || 0);
    });
  });

  const soldProducts = Object.entries(productCounter)
    .sort((a, b) => b[1] - a[1])
    .map(([name, quantity]) => {
      const inventoryProduct = store.products.find((product) => product.name === name);
      return {
        name,
        quantity,
        revenue: Number(productRevenueCounter[name] || 0),
        stockRemaining: Number(inventoryProduct?.stock || 0),
        minStock: Number(inventoryProduct?.minStock || 0),
      };
    });

  const inventorySnapshot = store.products
    .map((product) => ({
      name: product.name,
      category: product.category,
      currentStock: Number(product.stock || 0),
      minStock: Number(product.minStock || 0),
      soldQuantity: Number(productCounter[product.name] || 0),
      isLowStock: Number(product.stock || 0) <= Number(product.minStock || 0),
    }))
    .sort((a, b) => a.currentStock - b.currentStock);

  return {
    period,
    summary: {
      orders: filteredOrders.length,
      paidOrders: paidOrders.length,
      revenue,
      refunds,
      netRevenue: revenue - refunds,
      averageTicket: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
      grossProfitEstimate: Math.round((revenue - refunds) * 0.62),
    },
    topProducts: soldProducts.slice(0, 10),
    soldProducts,
    inventorySnapshot,
    lowStock: clone(store.products.filter((product) => product.stock <= product.minStock)),
    shiftRanking: clone(store.shifts.map((shift) => ({ cashierName: shift.cashierName, totalRevenue: shift.totalRevenue, totalOrders: shift.totalOrders })).sort((a, b) => b.totalRevenue - a.totalRevenue)),
    paymentBreakdown: clone(paymentBreakdown),
    timeline: buildPeriodBuckets(period, referenceStart, paidOrders),
  };
}

module.exports = {
  ensureReady,
  getClientLanding,
  getClientBootstrap,
  estimatePricing,
  findOrCreateCustomer,
  lookupCustomer,
  createOrder,
  getOrderById,
  listOrders,
  updateOrderStatus,
  processPayment,
  refundOrder,
  splitOrder,
  mergeOrders,
  moveOrderTable,
  assignOrderWaiter,
  startShift,
  getCurrentShift,
  endShift,
  addCashLog,
  createServiceCall,
  closeServiceCall,
  listServiceCalls,
  listReservations,
  listCashLogs,
  listCustomers,
  listAuditLogs,
  submitFeedback,
  getCashierDashboard,
  getCashierSummaryToday,
  getAdminDashboard,
  getAdminCatalog,
  createAdminCategory,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  createAdminTable,
  updateAdminTable,
  createAdminUser,
  updateAdminUserStatus,
  updateAdminSettings,
  createAdminPromo,
  getReportsOverview,
};


