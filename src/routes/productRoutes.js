const express = require('express');
const router = express.Router();
const { createProduct, getAllProducts, updateProduct, deleteProduct } = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/', [authMiddleware, roleMiddleware(['admin'])], createProduct);
router.get('/', getAllProducts);
router.put('/:id', [authMiddleware, roleMiddleware(['admin'])], updateProduct);
router.delete('/:id', [authMiddleware, roleMiddleware(['admin'])], deleteProduct);

module.exports = router;