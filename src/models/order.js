const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
  table: {
    type: Schema.Types.ObjectId,
    ref: 'Table',
    required: true,
  },
  shift: {
    type: Schema.Types.ObjectId,
    ref: 'Shift'
  },
  customerName: {
    type: String,
    default: 'Customer',
  },
  items: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    priceAtOrder: {
        type: Number,
        required: true,
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled', 'hold'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'QRIS', 'Debit', 'Credit'],
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);