const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.use(authMiddleware, roleMiddleware(['admin']));

router.get('/dashboard', appController.getAdminDashboard);
router.get('/catalog', appController.getAdminCatalog);
router.get('/customers', appController.listAdminCustomers);
router.get('/service-calls', appController.listAdminServiceCalls);
router.get('/reservations', appController.listAdminReservations);
router.get('/cash-logs', appController.listAdminCashLogs);
router.get('/audit-logs', appController.listAdminAuditLogs);
router.get('/reports/overview', appController.getReportsOverview);
router.post('/categories', appController.createAdminCategory);
router.post('/products', appController.createAdminProduct);
router.put('/products/:productId', appController.updateAdminProduct);
router.delete('/products/:productId', appController.deleteAdminProduct);
router.post('/tables', appController.createAdminTable);
router.put('/tables/:tableId', appController.updateAdminTable);
router.post('/users', appController.createAdminUser);
router.patch('/users/:userId/status', appController.updateAdminUserStatus);
router.put('/settings', appController.updateAdminSettings);
router.post('/promos', appController.createAdminPromo);

module.exports = router;
