const bcrypt = require('bcryptjs');
const Product = require('../models/product');
const Table = require('../models/table');
const User = require('../models/user');
const { initializeMemoryStore } = require('../store/memoryStore');
const { v4: uuidv4 } = require('uuid');

const seedUsers = [
  {
    name: 'Admin Arum',
    email: 'admin@arumdalu.local',
    password: 'admin123',
    role: 'admin',
  },
  {
    name: 'Kasir Arum',
    email: 'cashier@arumdalu.local',
    password: 'cashier123',
    role: 'cashier',
  },
];

const seedProducts = [
  { name: 'Kopi Hitam', price: 12000, category: 'Kopi', stock: 50 },
  { name: 'Mie Goreng', price: 18000, category: 'Makanan', stock: 25 },
  { name: 'Es Teh', price: 8000, category: 'Minuman', stock: 40 },
];

const seedTables = ['Meja 1', 'Meja 2', 'Meja 3'];

async function ensureUser(userData) {
  let user = await User.findOne({ email: userData.email });
  if (user) {
    return user;
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(userData.password, salt);

  user = new User({
    name: userData.name,
    email: userData.email,
    password: hashedPassword,
    role: userData.role,
  });

  await user.save();
  return user;
}

async function ensureProduct(productData) {
  const existing = await Product.findOne({ name: productData.name });
  if (existing) {
    return existing;
  }

  const product = new Product(productData);
  await product.save();
  return product;
}

async function ensureTable(name) {
  const existing = await Table.findOne({ name });
  if (existing) {
    return existing;
  }

  const table = new Table({
    name,
    uniqueIdentifier: uuidv4(),
  });
  await table.save();
  return table;
}

async function seedInitialData() {
  if (global.useMemoryStore) {
    await initializeMemoryStore();
    return;
  }

  for (const user of seedUsers) {
    await ensureUser(user);
  }

  for (const product of seedProducts) {
    await ensureProduct(product);
  }

  for (const table of seedTables) {
    await ensureTable(table);
  }
}

module.exports = seedInitialData;
