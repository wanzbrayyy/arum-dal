const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderSchema = new Schema({
  orderCode: {
    type: String,
    default: '',
  },
  invoiceCode: {
    type: String,
    default: '',
  },
  source: {
    type: String,
    default: 'cashier',
  },
  channel: {
    type: String,
    default: 'cashier',
  },
  table: {
    type: Schema.Types.ObjectId,
    ref: 'Table',
    required: true,
  },
  tableName: {
    type: String,
    default: '',
  },
  shift: {
    type: Schema.Types.ObjectId,
    ref: 'Shift',
    default: null,
  },
  customerName: {
    type: String,
    default: 'Customer',
  },
  customerPhone: {
    type: String,
    default: '',
  },
  customerWhatsapp: {
    type: String,
    default: '',
  },
  customerEmail: {
    type: String,
    default: '',
  },
  customerId: {
    type: String,
    default: '',
  },
  memberTier: {
    type: String,
    default: '',
  },
  voucherCode: {
    type: String,
    default: '',
  },
  appliedPromo: {
    type: Schema.Types.Mixed,
    default: null,
  },
  orderType: {
    type: String,
    default: 'dine-in',
  },
  diningOption: {
    type: String,
    default: 'dine-in',
  },
  items: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    productId: {
      type: String,
      default: '',
    },
    productName: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    priceAtOrder: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    modifierPrice: {
      type: Number,
      default: 0,
    },
    itemDiscount: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      default: '',
    },
    modifiers: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lineSubtotal: {
      type: Number,
      default: 0,
    },
  }],
  totalAmount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'preparing', 'ready', 'served', 'paid', 'cancelled', 'hold', 'refunded'],
    default: 'pending',
  },
  kitchenStatus: {
    type: String,
    default: 'queued',
  },
  serviceStatus: {
    type: String,
    default: 'waiting',
  },
  paymentStatus: {
    type: String,
    default: 'unpaid',
  },
  paymentPreference: {
    type: String,
    default: 'pay_at_cashier',
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'QRIS', 'Debit', 'Credit'],
    default: null,
  },
  note: {
    type: String,
    default: '',
  },
  customerRequest: {
    type: String,
    default: '',
  },
  assignedWaiterId: {
    type: String,
    default: '',
  },
  cashierId: {
    type: String,
    default: '',
  },
  shiftId: {
    type: String,
    default: '',
  },
  splitSourceOrderId: {
    type: String,
    default: '',
  },
  mergedOrderIds: {
    type: [String],
    default: [],
  },
  paymentSplitCode: {
    type: String,
    default: '',
  },
  queueNumber: {
    type: Number,
    default: 0,
  },
  pricing: {
    type: Schema.Types.Mixed,
    default: {},
  },
  payments: {
    type: [Schema.Types.Mixed],
    default: [],
  },
  refundHistory: {
    type: [Schema.Types.Mixed],
    default: [],
  },
  inventoryReserved: {
    type: Boolean,
    default: true,
  },
  inventoryRestoredAt: {
    type: Date,
    default: null,
  },
  timeline: {
    type: [Schema.Types.Mixed],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
