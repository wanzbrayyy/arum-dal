const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.use(authMiddleware, roleMiddleware(['cashier', 'admin']));

router.get('/dashboard', appController.getCashierDashboard);
router.get('/summary/today', appController.getCashierSummary);
router.get('/shift/current', appController.getCurrentShift);
router.post('/shift/start', appController.startShift);
router.post('/shift/end', appController.endShift);
router.post('/cash-log', appController.createCashLog);
router.get('/cash-logs', appController.listCashierCashLogs);
router.post('/customer/lookup', appController.lookupCashierCustomer);
router.post('/orders/estimate', appController.estimatePricing);
router.get('/orders', appController.listCashierOrders);
router.post('/orders', appController.createCashierOrder);
router.patch('/orders/:orderId/status', appController.updateCashierOrderStatus);
router.patch('/orders/:orderId/move-table', appController.moveCashierOrderTable);
router.patch('/orders/:orderId/assign-waiter', appController.assignCashierOrderWaiter);
router.patch('/orders/:orderId/pay', appController.payCashierOrder);
router.patch('/orders/:orderId/refund', appController.refundCashierOrder);
router.post('/orders/:orderId/split', appController.splitCashierOrder);
router.post('/orders/merge', appController.mergeCashierOrders);
router.get('/service-calls', appController.listCashierServiceCalls);
router.patch('/service-calls/:callId/close', appController.closeServiceCall);
router.get('/reservations', appController.listCashierReservations);

module.exports = router;
