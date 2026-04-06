require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./src/config/db');
const seedInitialData = require('./src/config/seed');

const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const tableRoutes = require('./src/routes/tableRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const shiftRoutes = require('./src/routes/shiftRoutes');
const expenseRoutes = require('./src/routes/expenseRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const clientApiRoutes = require('./src/routes/clientApiRoutes');
const cashierAppRoutes = require('./src/routes/cashierAppRoutes');
const adminAppRoutes = require('./src/routes/adminAppRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const BODY_LIMIT = process.env.BODY_LIMIT || '15mb';

let bootstrapPromise;

function ensureBootstrap() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await connectDB();
      await seedInitialData();
    })();
  }
  return bootstrapPromise;
}

app.use(cors());
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(async (_req, _res, next) => {
  try {
    await ensureBootstrap();
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/client', clientApiRoutes);
app.use('/api/app/cashier', cashierAppRoutes);
app.use('/api/app/admin', adminAppRoutes);
app.use('/', clientRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      msg: 'PAYLOAD_TOO_LARGE',
      detail: `Ukuran upload melebihi batas server (${BODY_LIMIT}). Kompres gambar lalu coba lagi.`,
    });
  }
  res.status(500).json({ msg: 'Server error', detail: error.message });
});

if (require.main === module) {
  ensureBootstrap()
    .then(() => {
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch((error) => {
      console.error(`Failed to start server: ${error.message}`);
      process.exit(1);
    });
}

module.exports = app;
