const express = require('express');
const router = express.Router();
const Table = require('../models/table');
const Product = require('../models/product');

// Route ketika customer scan QR Code: /order/:uniqueIdentifier
router.get('/order/:uniqueIdentifier', async (req, res) => {
    try {
        // Cari meja berdasarkan ID unik dari QR
        const table = await Table.findOne({ uniqueIdentifier: req.params.uniqueIdentifier });
        
        if (!table) {
            return res.status(404).send('<h1>Meja tidak ditemukan atau QR Code tidak valid.</h1>');
        }

        // Ambil semua produk untuk ditampilkan di menu
        const products = await Product.find({ stock: { $gt: 0 } }); // Hanya tampilkan yg ada stok

        // Render halaman EJS dan kirim data meja & produk
        res.render('order', { table, products });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Route halaman sukses setelah pesan
router.get('/success', (req, res) => {
    res.render('success');
});

module.exports = router;