const IssueRecord = require('../models/IssueRecord');
const Book = require('../models/Book');

const issueBook = async (req, res, next) => {
  try {
    const { bookId } = req.body;
    if (!bookId) return res.status(400).json({ success: false, message: 'bookId is required.' });

    const book = await Book.findOne({ _id: bookId, isActive: true });
    if (!book) return res.status(404).json({ success: false, message: 'Book not found.' });
    if (book.availableCopies < 1) return res.status(400).json({ success: false, message: 'No copies available.' });

    const alreadyIssued = await IssueRecord.findOne({ user: req.user._id, book: bookId, status: { $in: ['issued', 'overdue'] } });
    if (alreadyIssued) return res.status(400).json({ success: false, message: 'You have already borrowed this book.' });

    await Book.findByIdAndUpdate(bookId, { $inc: { availableCopies: -1 } });
    const record = await IssueRecord.create({ user: req.user._id, book: bookId, issuedBy: req.user._id });
    const populated = await record.populate('book', 'title author ISBN');

    req.io && req.io.emit('book:availabilityChanged', { bookId, availableCopies: book.availableCopies - 1 });
    res.status(201).json({ success: true, message: 'Book issued successfully.', record: populated });
  } catch (error) { next(error); }
};

const returnBook = async (req, res, next) => {
  try {
    const record = await IssueRecord.findById(req.params.id).populate('book');
    if (!record) return res.status(404).json({ success: false, message: 'Issue record not found.' });
    if (record.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorised to return this record.' });
    }
    if (record.status === 'returned') return res.status(400).json({ success: false, message: 'Book already returned.' });

    record.returnDate = new Date();
    record.status = 'returned';
    if (new Date() > record.dueDate) {
      const daysOverdue = Math.ceil((new Date() - record.dueDate) / (1000 * 60 * 60 * 24));
      record.fine = daysOverdue * 1;
    }
    await record.save();

    const updatedBook = await Book.findByIdAndUpdate(record.book._id, { $inc: { availableCopies: 1 } }, { new: true });
    req.io && req.io.emit('book:availabilityChanged', { bookId: record.book._id, availableCopies: updatedBook.availableCopies });

    res.json({ success: true, message: 'Book returned successfully.', fine: record.fine, record });
  } catch (error) { next(error); }
};

const getMyIssues = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { user: req.user._id };
    if (status) query.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const total = await IssueRecord.countDocuments(query);
    const records = await IssueRecord.find(query).populate('book', 'title author ISBN genre').sort('-issueDate').skip(skip).limit(Number(limit));
    const updated = records.map((r) => r.checkOverdue());
    res.json({ success: true, count: updated.length, total, pages: Math.ceil(total / Number(limit)), currentPage: Number(page), records: updated });
  } catch (error) { next(error); }
};

const getAllIssues = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const total = await IssueRecord.countDocuments(query);
    const records = await IssueRecord.find(query).populate('user', 'name email').populate('book', 'title author ISBN').sort('-issueDate').skip(skip).limit(Number(limit));
    res.json({ success: true, count: records.length, total, pages: Math.ceil(total / Number(limit)), currentPage: Number(page), records });
  } catch (error) { next(error); }
};

const getStats = async (_req, res, next) => {
  try {
    const [totalBooks, totalUsers, totalIssued, totalOverdue] = await Promise.all([
      require('../models/Book').countDocuments({ isActive: true }),
      require('../models/User').countDocuments({ isActive: true }),
      IssueRecord.countDocuments({ status: 'issued' }),
      IssueRecord.countDocuments({ status: 'overdue' }),
    ]);
    res.json({ success: true, stats: { totalBooks, totalUsers, totalIssued, totalOverdue } });
  } catch (error) { next(error); }
};

module.exports = { issueBook, returnBook, getMyIssues, getAllIssues, getStats };
