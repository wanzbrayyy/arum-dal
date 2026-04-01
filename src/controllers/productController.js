const Product = require('../models/product');
const { memoryStore, initializeMemoryStore } = require('../store/memoryStore');
const { v4: uuidv4 } = require('uuid');

exports.createProduct = async (req, res) => {
  const { name, price, category, stock } = req.body;
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const product = {
        _id: uuidv4(),
        name,
        price: Number(price),
        category,
        stock: Number(stock ?? 0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.products.push(product);
      return res.status(201).json(product);
    }

    const newProduct = new Product({
      name,
      price,
      category,
      stock,
    });
    const product = await newProduct.save();
    res.status(201).json(product);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      return res.json(memoryStore.products);
    }

    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.updateProduct = async (req, res) => {
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const product = memoryStore.products.find((item) => item._id === req.params.id);
      if (!product) {
        return res.status(404).json({ msg: 'Product not found' });
      }

      Object.assign(product, req.body, { updatedAt: new Date() });
      return res.json(product);
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const index = memoryStore.products.findIndex((item) => item._id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ msg: 'Product not found' });
      }

      memoryStore.products.splice(index, 1);
      return res.json({ msg: 'Product removed' });
    }

    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    res.json({ msg: 'Product removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
