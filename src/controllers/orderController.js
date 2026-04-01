const Order = require('../models/order');
const Product = require('../models/product');
const Table = require('../models/table');
const Shift = require('../models/shift');
const { memoryStore, initializeMemoryStore } = require('../store/memoryStore');
const { v4: uuidv4 } = require('uuid');

exports.createOrder = async (req, res) => {
  const { tableId, items, customerName } = req.body;
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();

      const table = memoryStore.tables.find((item) => item._id === tableId);
      if (!table) return res.status(404).json({ msg: 'Table not found' });

      let totalAmount = 0;
      const normalizedItems = [];

      for (const item of items) {
        const product = memoryStore.products.find((productItem) => productItem._id === item.product);
        if (!product) {
          return res.status(404).json({ msg: 'Product not found' });
        }

        const quantity = Number(item.quantity);
        const priceAtOrder = Number(item.priceAtOrder ?? product.price);
        totalAmount += priceAtOrder * quantity;
        normalizedItems.push({
          product: product._id,
          quantity,
          priceAtOrder,
        });
      }

      const order = {
        _id: uuidv4(),
        table: tableId,
        shift: null,
        customerName: customerName || 'Customer',
        items: normalizedItems,
        totalAmount,
        status: 'pending',
        paymentMethod: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      memoryStore.orders.push(order);
      return res.status(201).json(order);
    }

    const table = await Table.findById(tableId);
    if (!table) return res.status(404).json({ msg: 'Table not found' });

    let totalAmount = 0;
    for (const item of items) {
      const product = await Product.findById(item.product);
      totalAmount += product.price * item.quantity;
    }

    const newOrder = new Order({
      table: tableId,
      customerName,
      items,
      totalAmount,
    });

    const order = await newOrder.save();
    res.status(201).json(order);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.getPendingOrders = async (req, res) => {
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const orders = memoryStore.orders
        .filter((order) => order.status === 'pending')
        .map((order) => ({
          ...order,
          table: {
            _id: order.table,
            name: memoryStore.tables.find((table) => table._id === order.table)?.name || 'Unknown Table',
          },
          items: order.items.map((item) => {
            const product = memoryStore.products.find((productItem) => productItem._id === item.product);
            return {
              ...item,
              product: product ? { _id: product._id, name: product.name, price: product.price } : null,
            };
          }),
        }));

      return res.json(orders);
    }

    const orders = await Order.find({ status: 'pending' })
      .populate('table', 'name')
      .populate('items.product', 'name price');
    res.json(orders);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.processPayment = async (req, res) => {
  const { orderId, paymentMethod } = req.body;
  const cashierId = req.user.id;

  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();

      const activeShift = memoryStore.shifts.find((shift) => shift.cashier === cashierId && !shift.endTime);
      if (!activeShift) {
        return res.status(400).json({ msg: 'No active shift found. Please start a shift to process payments.' });
      }

      const order = memoryStore.orders.find((item) => item._id === orderId);
      if (!order) return res.status(404).json({ msg: 'Order not found' });
      if (order.status === 'paid') return res.status(400).json({ msg: 'Order has already been paid' });

      order.status = 'paid';
      order.paymentMethod = paymentMethod;
      order.shift = activeShift._id;
      order.updatedAt = new Date();

      return res.json({ msg: 'Payment successful', order });
    }

    const activeShift = await Shift.findOne({ cashier: cashierId, endTime: null });
    if (!activeShift) {
      return res.status(400).json({ msg: 'No active shift found. Please start a shift to process payments.' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ msg: 'Order not found' });
    if (order.status === 'paid') return res.status(400).json({ msg: 'Order has already been paid' });

    order.status = 'paid';
    order.paymentMethod = paymentMethod;
    order.shift = activeShift._id;

    await order.save();
    res.json({ msg: 'Payment successful', order });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
