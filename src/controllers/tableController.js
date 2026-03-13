const Table = require('../models/table');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

exports.createTable = async (req, res) => {
    const { name } = req.body;
    try {
        const uniqueIdentifier = uuidv4();

        const newTable = new Table({
            name,
            uniqueIdentifier
        });

        const table = await newTable.save();
        res.status(201).json(table);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getAllTables = async (req, res) => {
    try {
        const tables = await Table.find();
        res.json(tables);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.getTableQR = async (req, res) => {
    try {
        const table = await Table.findById(req.params.id);
        if(!table) return res.status(404).json({ msg: 'Table not found' });
        
        // Ganti 'http://your-frontend-url' dengan URL halaman pemesanan client Anda
        const orderUrl = `http://your-frontend-url/order/${table.uniqueIdentifier}`;

        qrcode.toDataURL(orderUrl, (err, url) => {
            if(err) {
                console.error(err);
                return res.status(500).send('Error generating QR Code');
            }
            res.json({ qrDataUrl: url, tableUrl: orderUrl });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

exports.deleteTable = async (req, res) => {
    try {
        const table = await Table.findByIdAndDelete(req.params.id);
        if (!table) return res.status(404).json({ msg: 'Table not found' });
        res.json({ msg: 'Table removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};