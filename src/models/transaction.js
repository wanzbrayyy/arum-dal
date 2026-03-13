const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TransactionSchema = new Schema({
  order: {
    type: Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  shift: {
    type: Schema.Types.ObjectId,
    ref: 'Shift',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['Cash', 'QRIS', 'Debit', 'Credit'],
  },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);