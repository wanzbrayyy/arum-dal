const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  uniqueIdentifier: {
    type: String,
    required: true,
    unique: true,
  },
  area: {
    type: String,
    default: 'Indoor',
  },
  capacity: {
    type: Number,
    default: 4,
  },
  status: {
    type: String,
    default: 'available',
  },
}, { timestamps: true });

module.exports = mongoose.model('Table', TableSchema);
