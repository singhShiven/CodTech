const express = require('express');
const { issueBook, returnBook, getMyIssues, getAllIssues, getStats } = require('../controllers/issueController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', issueBook);
router.post('/return/:id', returnBook);
router.get('/my', getMyIssues);
router.get('/stats', restrictTo('admin'), getStats);
router.get('/all', restrictTo('admin'), getAllIssues);

module.exports = router;
