const express = require('express');
const { body } = require('express-validator');
const { getAllBooks, getBookById, createBook, updateBook, deleteBook, getGenres } = require('../controllers/bookController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

const bookValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('author').trim().notEmpty().withMessage('Author is required'),
  body('ISBN').trim().notEmpty().withMessage('ISBN is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
];

router.get('/', getAllBooks);
router.get('/genres', getGenres);
router.get('/:id', getBookById);
router.post('/', protect, restrictTo('admin'), bookValidation, createBook);
router.put('/:id', protect, restrictTo('admin'), updateBook);
router.delete('/:id', protect, restrictTo('admin'), deleteBook);

module.exports = router;
