const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { authenticate } = require('../middleware/auth');

router.use(express.json({ limit: '500kb' }));
router.use(authenticate);

router.post('/pdf', (req, res) => {
    console.log("BODY RECEIVED:", req.body);
    const content = req.body && req.body.content;

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }

  try {
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=syncspace-document.pdf');

    doc.pipe(res);

    // Title
    doc
      .fontSize(20)
      .text('SyncSpace AI Document', { align: 'center' })
      .moveDown(1.5);

    // Content
    doc
      .fontSize(12)
      .text(content.trim(), {
        align: 'left',
        lineGap: 4
      });

    doc.end();

  } catch (err) {
    console.error("🔥 FULL EXPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;