const express = require('express');
const router = express.Router();
const { getShiftReport, getDailyReport } = require('../controllers/reportController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.get('/shift/:shiftId', [authMiddleware, roleMiddleware(['admin'])], getShiftReport);
router.get('/daily', [authMiddleware, roleMiddleware(['admin'])], getDailyReport);

module.exports = router;