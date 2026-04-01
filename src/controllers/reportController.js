const Shift = require('../models/shift');
const Order = require('../models/order');
const Expense = require('../models/expense');
const { memoryStore, initializeMemoryStore } = require('../store/memoryStore');

function isBetweenDates(value, start, end) {
  const date = new Date(value);
  return date >= start && date <= end;
}

exports.getShiftReport = async (req, res) => {
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();

      const shift = memoryStore.shifts.find((item) => item._id === req.params.shiftId);
      if (!shift) {
        return res.status(404).json({ msg: 'Shift not found' });
      }

      const cashier = memoryStore.users.find((user) => (user.id || user._id) === shift.cashier);
      const orders = memoryStore.orders.filter((order) => order.shift === shift._id && order.status === 'paid');
      const expenses = memoryStore.expenses.filter((expense) => expense.shift === shift._id);

      const totalRevenue = orders.reduce((acc, order) => acc + order.totalAmount, 0);
      const totalExpense = expenses.reduce((acc, expense) => acc + expense.amount, 0);
      const netIncome = totalRevenue - totalExpense;

      return res.json({
        shiftDetails: {
          id: shift._id,
          cashier: cashier?.name || 'Unknown Cashier',
          startTime: shift.startTime,
          endTime: shift.endTime,
          shiftType: shift.shiftType,
          initialCash: shift.initialCash,
        },
        summary: {
          totalRevenue,
          totalExpense,
          netIncome,
          cashInDrawer: shift.initialCash + totalRevenue - totalExpense,
        },
        orders,
        expenses,
      });
    }

    const shift = await Shift.findById(req.params.shiftId).populate('cashier', 'name');
    if (!shift) {
      return res.status(404).json({ msg: 'Shift not found' });
    }

    const orders = await Order.find({ shift: req.params.shiftId, status: 'paid' });
    const expenses = await Expense.find({ shift: req.params.shiftId });

    const totalRevenue = orders.reduce((acc, order) => acc + order.totalAmount, 0);
    const totalExpense = expenses.reduce((acc, expense) => acc + expense.amount, 0);
    const netIncome = totalRevenue - totalExpense;

    res.json({
      shiftDetails: {
        id: shift._id,
        cashier: shift.cashier.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        shiftType: shift.shiftType,
        initialCash: shift.initialCash,
      },
      summary: {
        totalRevenue,
        totalExpense,
        netIncome,
        cashInDrawer: shift.initialCash + totalRevenue - totalExpense,
      },
      orders,
      expenses,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};

exports.getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    if (global.useMemoryStore) {
      await initializeMemoryStore();

      const shifts = memoryStore.shifts.filter((shift) => shift.endTime && isBetweenDates(shift.startTime, startOfDay, endOfDay));
      if (shifts.length === 0) {
        return res.status(404).json({ msg: 'No completed shifts found for this date' });
      }

      const shiftIds = shifts.map((shift) => shift._id);
      const revenue = memoryStore.orders
        .filter((order) => shiftIds.includes(order.shift) && order.status === 'paid')
        .reduce((acc, order) => acc + order.totalAmount, 0);
      const expense = memoryStore.expenses
        .filter((item) => shiftIds.includes(item.shift))
        .reduce((acc, item) => acc + item.amount, 0);

      return res.json({
        date: startOfDay.toISOString().split('T')[0],
        totalRevenue: revenue,
        totalExpense: expense,
        netIncome: revenue - expense,
        shiftsCompleted: shifts.length,
      });
    }

    const shifts = await Shift.find({
      startTime: { $gte: startOfDay, $lte: endOfDay },
      endTime: { $ne: null },
    });

    if (shifts.length === 0) {
      return res.status(404).json({ msg: 'No completed shifts found for this date' });
    }

    const shiftIds = shifts.map((s) => s._id);

    const totalRevenue = await Order.aggregate([
      { $match: { shift: { $in: shiftIds }, status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    const totalExpense = await Expense.aggregate([
      { $match: { shift: { $in: shiftIds } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;
    const expense = totalExpense.length > 0 ? totalExpense[0].total : 0;

    res.json({
      date: startOfDay.toISOString().split('T')[0],
      totalRevenue: revenue,
      totalExpense: expense,
      netIncome: revenue - expense,
      shiftsCompleted: shifts.length,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};
