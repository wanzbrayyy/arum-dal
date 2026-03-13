const express = require('express');
const router = express.Router();
const { startShift, endShift, getCurrentShift } = require('../controllers/shiftController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/start', [authMiddleware, roleMiddleware(['cashier'])], startShift);
router.post('/end', [authMiddleware, roleMiddleware(['cashier'])], endShift);
router.get('/current', [authMiddleware, roleMiddleware(['cashier'])], getCurrentShift);

module.exports = router;