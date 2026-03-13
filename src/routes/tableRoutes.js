const express = require('express');
const router = express.Router();
const { createTable, getAllTables, getTableQR, deleteTable } = require('../controllers/tableController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/', [authMiddleware, roleMiddleware(['admin'])], createTable);
router.get('/', [authMiddleware, roleMiddleware(['admin', 'cashier'])], getAllTables);
router.get('/:id/qr', [authMiddleware, roleMiddleware(['admin'])], getTableQR);
router.delete('/:id', [authMiddleware, roleMiddleware(['admin'])], deleteTable);

module.exports = router;