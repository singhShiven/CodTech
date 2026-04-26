const mongoose = require('mongoose');

const issueRecordSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: {
      type: Date,
      default: () => {
        const due = new Date();
        due.setDate(due.getDate() + 14);
        return due;
      },
    },
    returnDate: { type: Date, default: null },
    status: { type: String, enum: ['issued', 'returned', 'overdue'], default: 'issued' },
    fine: { type: Number, default: 0 },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

issueRecordSchema.methods.checkOverdue = function () {
  if (this.status === 'issued' && new Date() > this.dueDate) {
    this.status = 'overdue';
    const daysOverdue = Math.ceil((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
    this.fine = daysOverdue * 1;
  }
  return this;
};

module.exports = mongoose.model('IssueRecord', issueRecordSchema);
