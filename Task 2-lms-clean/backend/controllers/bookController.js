const { validationResult } = require('express-validator');
const Book = require('../models/Book');

const getAllBooks = async (req, res, next) => {
  try {
    const { search, genre, available, page = 1, limit = 12, sort = '-createdAt' } = req.query;
    const query = { isActive: true };
    if (search) query.$text = { $search: search };
    if (genre) query.genre = genre;
    if (available === 'true') query.availableCopies = { $gt: 0 };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Book.countDocuments(query);
    const books = await Book.find(query).sort(sort).skip(skip).limit(Number(limit));

    res.json({ success: true, count: books.length, total, pages: Math.ceil(total / Number(limit)), currentPage: Number(page), books });
  } catch (error) { next(error); }
};

const getBookById = async (req, res, next) => {
  try {
    const book = await Book.findOne({ _id: req.params.id, isActive: true });
    if (!book) return res.status(404).json({ success: false, message: 'Book not found.' });
    res.json({ success: true, book });
  } catch (error) { next(error); }
};

const createBook = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { title, author, ISBN, genre, description, quantity, publishedYear } = req.body;
    const existing = await Book.findOne({ ISBN });
    if (existing) return res.status(409).json({ success: false, message: 'A book with this ISBN already exists.' });

    const book = await Book.create({ title, author, ISBN, genre, description, quantity: Number(quantity), availableCopies: Number(quantity), publishedYear });
    req.io && req.io.emit('book:created', book);
    res.status(201).json({ success: true, message: 'Book added successfully.', book });
  } catch (error) { next(error); }
};

const updateBook = async (req, res, next) => {
  try {
    const { quantity, ...rest } = req.body;
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found.' });

    if (quantity !== undefined) {
      const diff = Number(quantity) - book.quantity;
      rest.quantity = Number(quantity);
      rest.availableCopies = Math.max(0, book.availableCopies + diff);
    }

    const updated = await Book.findByIdAndUpdate(req.params.id, { $set: rest }, { new: true, runValidators: true });
    req.io && req.io.emit('book:updated', updated);
    res.json({ success: true, message: 'Book updated successfully.', book: updated });
  } catch (error) { next(error); }
};

const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found.' });
    await Book.findByIdAndUpdate(req.params.id, { isActive: false });
    req.io && req.io.emit('book:deleted', { _id: req.params.id });
    res.json({ success: true, message: 'Book removed from catalogue.' });
  } catch (error) { next(error); }
};

const getGenres = async (_req, res, next) => {
  try {
    const genres = await Book.distinct('genre', { isActive: true });
    res.json({ success: true, genres });
  } catch (error) { next(error); }
};

module.exports = { getAllBooks, getBookById, createBook, updateBook, deleteBook, getGenres };
