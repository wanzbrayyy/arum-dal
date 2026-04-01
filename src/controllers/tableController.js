const Table = require('../models/table');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { memoryStore, initializeMemoryStore } = require('../store/memoryStore');

exports.createTable = async (req, res) => {
  const { name } = req.body;
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const table = {
        _id: uuidv4(),
        name,
        uniqueIdentifier: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.tables.push(table);
      return res.status(201).json(table);
    }

    const uniqueIdentifier = uuidv4();
    const newTable = new Table({
      name,
      uniqueIdentifier,
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
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      return res.json(memoryStore.tables);
    }

    const tables = await Table.find();
    res.json(tables);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.getTableQR = async (req, res) => {
    try {
        if (global.useMemoryStore) {
            await initializeMemoryStore();
            const table = memoryStore.tables.find((item) => item._id === req.params.id);
            if (!table) return res.status(404).json({ msg: 'Table not found' });

            const orderUrl = `${req.protocol}://${req.get('host')}/order/${table.uniqueIdentifier}`;
            return qrcode.toDataURL(orderUrl, (err, url) => {
                if (err) {
                  console.error(err);
                  return res.status(500).send('Error generating QR Code');
        }
        res.json({ qrDataUrl: url, tableUrl: orderUrl });
      });
    }

    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ msg: 'Table not found' });

    const orderUrl = `${req.protocol}://${req.get('host')}/order/${table.uniqueIdentifier}`;

    qrcode.toDataURL(orderUrl, (err, url) => {
      if (err) {
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
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const index = memoryStore.tables.findIndex((item) => item._id === req.params.id);
      if (index === -1) return res.status(404).json({ msg: 'Table not found' });

      memoryStore.tables.splice(index, 1);
      return res.json({ msg: 'Table removed' });
    }

    const table = await Table.findByIdAndDelete(req.params.id);
    if (!table) return res.status(404).json({ msg: 'Table not found' });
    res.json({ msg: 'Table removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
