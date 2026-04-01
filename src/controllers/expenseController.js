const Expense = require('../models/expense');
const Shift = require('../models/shift');
const { memoryStore, initializeMemoryStore } = require('../store/memoryStore');
const { v4: uuidv4 } = require('uuid');

exports.addExpense = async (req, res) => {
  const { description, amount } = req.body;
  const cashierId = req.user.id;

  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const activeShift = memoryStore.shifts.find((shift) => shift.cashier === cashierId && !shift.endTime);
      if (!activeShift) {
        return res.status(400).json({ msg: 'No active shift found for this cashier' });
      }

      const expense = {
        _id: uuidv4(),
        description,
        amount: Number(amount),
        shift: activeShift._id,
        cashier: cashierId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      memoryStore.expenses.push(expense);
      return res.status(201).json(expense);
    }

    const activeShift = await Shift.findOne({ cashier: cashierId, endTime: null });
    if (!activeShift) {
      return res.status(400).json({ msg: 'No active shift found for this cashier' });
    }

    const expense = new Expense({
      description,
      amount,
      shift: activeShift._id,
      cashier: cashierId,
    });

    const savedExpense = await expense.save();
    res.status(201).json(savedExpense);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getExpensesByShift = async (req, res) => {
  try {
    if (global.useMemoryStore) {
      await initializeMemoryStore();
      const expenses = memoryStore.expenses.filter((expense) => expense.shift === req.params.shiftId);
      if (!expenses) {
        return res.status(404).json({ msg: 'No expenses found for this shift' });
      }
      return res.json(expenses);
    }

    const expenses = await Expense.find({ shift: req.params.shiftId });
    if (!expenses) {
      return res.status(404).json({ msg: 'No expenses found for this shift' });
    }
    res.json(expenses);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
