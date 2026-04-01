const Shift = require('../models/shift');
const Order = require('../models/order');
const Expense = require('../models/expense');
const { memoryStore, initializeMemoryStore } = require('../store/memoryStore');
const { v4: uuidv4 } = require('uuid');

const getShiftType = () => {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 19 ? 'Pagi' : 'Malam';
};

exports.startShift = async (req, res) => {
  const { initialCash } = req.body;
  const cashierId = req.user.id;

  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const existingShift = memoryStore.shifts.find((shift) => shift.cashier === cashierId && !shift.endTime);
      if (existingShift) {
        return res.status(400).json({ msg: 'You already have an active shift' });
      }

      const shift = {
        _id: uuidv4(),
        cashier: cashierId,
        startTime: new Date(),
        initialCash: Number(initialCash),
        shiftType: getShiftType(),
        endTime: null,
        finalCash: null,
        totalRevenue: 0,
        totalExpense: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      memoryStore.shifts.push(shift);
      return res.status(201).json(shift);
    }

    const existingShift = await Shift.findOne({ cashier: cashierId, endTime: null });
    if (existingShift) {
      return res.status(400).json({ msg: 'You already have an active shift' });
    }

    const shiftType = getShiftType();
    const newShift = new Shift({
      cashier: cashierId,
      startTime: new Date(),
      initialCash,
      shiftType,
    });

    const shift = await newShift.save();
    res.status(201).json(shift);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.endShift = async (req, res) => {
  const cashierId = req.user.id;
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const shift = memoryStore.shifts.find((item) => item.cashier === cashierId && !item.endTime);
      if (!shift) {
        return res.status(404).json({ msg: 'No active shift found to end' });
      }

      const orders = memoryStore.orders.filter((order) => order.shift === shift._id && order.status === 'paid');
      const expenses = memoryStore.expenses.filter((expense) => expense.shift === shift._id);
      const totalRevenue = orders.reduce((acc, order) => acc + order.totalAmount, 0);
      const totalExpense = expenses.reduce((acc, expense) => acc + expense.amount, 0);

      shift.endTime = new Date();
      shift.finalCash = shift.initialCash + totalRevenue - totalExpense;
      shift.totalRevenue = totalRevenue;
      shift.totalExpense = totalExpense;
      shift.updatedAt = new Date();

      return res.json({ msg: 'Shift ended successfully', shiftSummary: shift });
    }

    const shift = await Shift.findOne({ cashier: cashierId, endTime: null });
    if (!shift) {
      return res.status(404).json({ msg: 'No active shift found to end' });
    }

    const orders = await Order.find({ shift: shift._id, status: 'paid' });
    const expenses = await Expense.find({ shift: shift._id });

    const totalRevenue = orders.reduce((acc, order) => acc + order.totalAmount, 0);
    const totalExpense = expenses.reduce((acc, expense) => acc + expense.amount, 0);

    shift.endTime = new Date();
    shift.finalCash = shift.initialCash + totalRevenue - totalExpense;
    shift.totalRevenue = totalRevenue;
    shift.totalExpense = totalExpense;

    await shift.save();
    res.json({ msg: 'Shift ended successfully', shiftSummary: shift });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.getCurrentShift = async (req, res) => {
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const shift = memoryStore.shifts.find((item) => item.cashier === req.user.id && !item.endTime);
      if (!shift) {
        return res.status(404).json({ msg: 'No active shift' });
      }
      return res.json(shift);
    }

    const shift = await Shift.findOne({ cashier: req.user.id, endTime: null }).populate('cashier', 'name');
    if (!shift) {
      return res.status(404).json({ msg: 'No active shift' });
    }
    res.json(shift);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
