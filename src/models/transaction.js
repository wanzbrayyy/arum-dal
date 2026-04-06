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
    default: null,
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
  invoiceCode: {
    type: String,
    default: '',
  },
  paidAmount: {
    type: Number,
    default: 0,
  },
  changeAmount: {
    type: Number,
    default: 0,
  },
  methods: {
    type: [Schema.Types.Mixed],
    default: [],
  },
  cashierId: {
    type: String,
    default: '',
  },
  shiftId: {
    type: String,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
