const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');

router.get('/bootstrap/:uniqueIdentifier', appController.getClientBootstrap);
router.post('/customer/lookup', appController.lookupCustomer);
router.post('/orders/estimate', appController.estimatePricing);
router.post('/orders', appController.createClientOrder);
router.get('/orders/:orderId', appController.getOrderStatus);
router.get('/orders/:orderId/status', appController.getOrderStatus);
router.post('/tables/:uniqueIdentifier/call', appController.createServiceCall);
router.post('/feedback', appController.submitFeedback);

module.exports = router;
