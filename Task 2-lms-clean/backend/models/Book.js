const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    ISBN: { type: String, required: true, unique: true, trim: true },
    genre: { type: String, trim: true, default: 'General' },
    description: { type: String, trim: true },
    publishedYear: { type: Number },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    availableCopies: { type: Number, min: 0, default: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bookSchema.index({ title: 'text', author: 'text' });

bookSchema.virtual('isAvailable').get(function () {
  return this.availableCopies > 0;
});

bookSchema.set('toJSON', { virtuals: true });
bookSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Book', bookSchema);
