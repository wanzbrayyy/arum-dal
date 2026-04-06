const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShiftSchema = new Schema({
  cashier: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  cashierName: {
    type: String,
    default: '',
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    default: null,
  },
  shiftType: {
    type: String,
    enum: ['Pagi', 'Malam'],
    default: 'Pagi',
  },
  initialCash: {
    type: Number,
    required: true,
  },
  finalCash: {
    type: Number,
    default: 0,
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  totalExpense: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
    default: '',
  },
  cashLogs: {
    type: [Schema.Types.Mixed],
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('Shift', ShiftSchema);
