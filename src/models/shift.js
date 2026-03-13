const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ShiftSchema = new Schema({
  cashier: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
  },
  shiftType: {
    type: String,
    enum: ['Pagi', 'Malam'],
    required: true,
  },
  initialCash: {
    type: Number,
    required: true,
  },
  finalCash: {
    type: Number,
  },
  totalRevenue: {
    type: Number,
    default: 0
  },
  totalExpense: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Shift', ShiftSchema);