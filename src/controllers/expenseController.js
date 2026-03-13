const Expense = require('../models/expense');
const Shift = require('../models/shift');

exports.addExpense = async (req, res) => {
  const { description, amount } = req.body;
  const cashierId = req.user.id;

  try {
    const activeShift = await Shift.findOne({ cashier: cashierId, endTime: null });
    if (!activeShift) {
        return res.status(400).json({ msg: 'No active shift found for this cashier' });
    }

    const newExpense = new Expense({
        description,
        amount,
        shift: activeShift._id,
        cashier: cashierId
    });

    const expense = await newExpense.save();
    res.status(201).json(expense);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

exports.getExpensesByShift = async (req, res) => {
    try {
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