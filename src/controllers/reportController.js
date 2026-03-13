const Shift = require('../models/shift');
const Order = require('../models/order');
const Expense = require('../models/expense');

exports.getShiftReport = async (req, res) => {
    try {
        const shiftId = req.params.shiftId;
        const shift = await Shift.findById(shiftId).populate('cashier', 'name');
        if (!shift) {
            return res.status(404).json({ msg: 'Shift not found' });
        }

        const orders = await Order.find({ shift: shiftId, status: 'paid' });
        const expenses = await Expense.find({ shift: shiftId });
        
        const totalRevenue = orders.reduce((acc, order) => acc + order.totalAmount, 0);
        const totalExpense = expenses.reduce((acc, expense) => acc + expense.amount, 0);

        const netIncome = totalRevenue - totalExpense;

        const report = {
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
                cashInDrawer: shift.initialCash + totalRevenue - totalExpense
            },
            orders,
            expenses
        };

        res.json(report);
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

        const shifts = await Shift.find({
            startTime: { $gte: startOfDay, $lte: endOfDay },
            endTime: { $ne: null }
        });

        if (shifts.length === 0) {
            return res.status(404).json({ msg: 'No completed shifts found for this date' });
        }

        const shiftIds = shifts.map(s => s._id);

        const totalRevenue = await Order.aggregate([
            { $match: { shift: { $in: shiftIds }, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        const totalExpense = await Expense.aggregate([
            { $match: { shift: { $in: shiftIds } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;
        const expense = totalExpense.length > 0 ? totalExpense[0].total : 0;
        const netIncome = revenue - expense;

        res.json({
            date: startOfDay.toISOString().split('T')[0],
            totalRevenue: revenue,
            totalExpense: expense,
            netIncome,
            shiftsCompleted: shifts.length,
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
}