const express = require('express');
const router = express.Router();
const { createOrder, getPendingOrders, processPayment } = require('../controllers/orderController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/', createOrder);
router.get('/pending', [authMiddleware, roleMiddleware(['cashier', 'admin'])], getPendingOrders);
router.post('/pay', [authMiddleware, roleMiddleware(['cashier', 'admin'])], processPayment);

module.exports = router;