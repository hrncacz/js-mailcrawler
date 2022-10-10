const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  hasPdfAttachment: {
    type: Boolean,
    required: true,
  },
  attachments: {
    type: Array,
  },
  completed: {
    type: Boolean,
  },
});

const Invoice = mongoose.model('invoice', invoiceSchema);

module.exports = Invoice;
