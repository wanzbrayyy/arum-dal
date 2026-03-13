const express = require('express');
const router = express.Router();
const { addExpense, getExpensesByShift } = require('../controllers/expenseController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/', [authMiddleware, roleMiddleware(['cashier', 'admin'])], addExpense);
router.get('/shift/:shiftId', [authMiddleware, roleMiddleware(['admin', 'cashier'])], getExpensesByShift);

module.exports = router;