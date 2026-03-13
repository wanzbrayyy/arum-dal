const Order = require('../models/order');
const Product = require('../models/product');
const Table = require('../models/table');
const Shift = require('../models/shift');

exports.createOrder = async (req, res) => {
    const { tableId, items, customerName } = req.body;
    try {
        const table = await Table.findById(tableId);
        if(!table) return res.status(404).json({ msg: 'Table not found' });

        let totalAmount = 0;
        for (const item of items) {
            const product = await Product.findById(item.product);
            totalAmount += product.price * item.quantity;
        }

        const newOrder = new Order({
            table: tableId,
            customerName,
            items,
            totalAmount
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
        const orders = await Order.find({ status: 'pending' }).populate('table', 'name').populate('items.product', 'name price');
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
        const activeShift = await Shift.findOne({ cashier: cashierId, endTime: null });
        if (!activeShift) {
            return res.status(400).json({ msg: 'No active shift found. Please start a shift to process payments.' });
        }

        const order = await Order.findById(orderId);
        if(!order) return res.status(404).json({ msg: 'Order not found' });
        if(order.status === 'paid') return res.status(400).json({ msg: 'Order has already been paid' });

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