const express = require('express');
const router = express.Router();
const posEngine = require('../services/posEngine');

// Route ketika customer scan QR Code: /order/:uniqueIdentifier
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
        res.status(500).send('Server Error');
    }
});

// Route halaman sukses setelah pesan
router.get('/success', (req, res) => {
    res.render('success', {
        orderId: req.query.orderId || '',
    });
});

module.exports = router;
