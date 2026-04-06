const express = require('express');
const router = express.Router();
const posEngine = require('../services/posEngine');

router.get(['/favicon.ico', '/favicon.png'], (_req, res) => {
  res.status(204).end();
});

router.get('/', async (_req, res) => {
  try {
    const landing = await posEngine.getClientLanding();
    const tableLinks = landing.tables.length
      ? landing.tables.map((table) => `<li><a href="/order/${table.uniqueIdentifier}">${table.name}</a></li>`).join('')
      : '<li>Belum ada meja aktif.</li>';

    res.status(200).send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${landing.outletName}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #172330; color: #fff; padding: 32px; }
    .card { max-width: 720px; margin: 0 auto; background: #223344; border-radius: 20px; padding: 24px; }
    a { color: #f1c40f; text-decoration: none; }
    ul { line-height: 1.9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${landing.outletName}</h1>
    <p>Backend dan client Arum Dalu aktif. Gunakan link meja di bawah untuk simulasi QR order pelanggan.</p>
    <ul>${tableLinks}</ul>
  </div>
</body>
</html>`);
  } catch (error) {
    console.error(error);
    res.status(200).send('<h1>Arum Dalu Backend Active</h1>');
  }
});

router.get('/order/:uniqueIdentifier', async (req, res) => {
  try {
    const bootstrap = await posEngine.getClientBootstrap(req.params.uniqueIdentifier);
    if (!bootstrap?.table) {
      return res.status(404).send('<h1>Meja tidak ditemukan atau QR Code tidak valid.</h1>');
    }

    res.render('order', {
      uniqueIdentifier: req.params.uniqueIdentifier,
      tableName: bootstrap.table.name,
      outletName: bootstrap.settings.outletName,
      theme: bootstrap.settings.colors,
    });
  } catch (err) {
    console.error(err.message);
    if (err.message === 'TABLE_NOT_FOUND') {
      return res.status(404).send('<h1>Meja tidak ditemukan atau QR Code tidak valid.</h1>');
    }
    res.status(500).send('Server Error');
  }
});

router.get('/success', (req, res) => {
  res.render('success', {
    orderId: req.query.orderId || '',
  });
});

module.exports = router;
