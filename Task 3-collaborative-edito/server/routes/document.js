const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const Document = require('../models/Document');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use(authenticate);

router.post(
    '/',
    [body('title').optional().trim().isLength({ max: 200 })],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ error: errors.array()[0].msg });
        }
  
        const doc = await Document.create({
          title: req.body.title || 'Untitled Document',
          content: '',
          ownerId: req.user._id,
          roomId: uuidv4(),
        });
  
        res.status(201).json({ success: true, data: doc });
  
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create document' });
      }
    }
  );

  router.get('/', async (req, res) => {
    try {
      const docs = await Document.findAccessible(req.user._id)
        .select('title ownerId collaborators roomId createdAt updatedAt content')
        .sort({ updatedAt: -1 });
  
      const docsWithPreview = docs.map(doc => ({
        _id: doc._id,
        roomId: doc.roomId,
        title: doc.title,
        ownerId: doc.ownerId,
        collaborators: doc.collaborators,
        updatedAt: doc.updatedAt,
  
        // 🔥 PREVIEW FIX
        content: doc.content
          ? (typeof doc.content === 'string'
              ? doc.content.slice(0, 120)
              : JSON.stringify(doc.content).slice(0, 120))
          : ""
      }));
  
      res.json({ success: true, data: docsWithPreview });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const doc = await Document.findById(req.params.id);
  
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }
  
      if (!doc.hasAccess(req.user._id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
  
      res.json({ success: true, data: doc });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const doc = await Document.findById(req.params.id);
  
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }
  
      if (!doc.hasAccess(req.user._id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
  
      if (req.body.title !== undefined && req.body.title.trim()) {
        doc.title = req.body.title.slice(0, 200);
      }
  
      if (req.body.content !== undefined) {
        doc.content = req.body.content;
      }
  
      const mongoose = require('mongoose');

      if (Array.isArray(req.body.collaborators)) {
        doc.collaborators = req.body.collaborators.filter(id =>
          mongoose.Types.ObjectId.isValid(id)
        );
      }
  
      await doc.save();
  
      res.json({ success: true, data: doc });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update document' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const doc = await Document.findById(req.params.id);
  
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }
  
      if (doc.ownerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Only the owner can delete this document' });
      }
  
      await doc.deleteOne();
  
      res.json({ success: true });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  router.patch('/by-room/:roomId', async (req, res) => {
    try {
      const doc = await Document.findOne({ roomId: req.params.roomId });
  
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }
  
      if (!doc.hasAccess(req.user._id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
  
      if (req.body.content !== undefined) {
        doc.content = req.body.content;
      }
  
      if (req.body.title !== undefined && req.body.title.trim()) {
        doc.title = req.body.title.slice(0, 200);
      }
  
      await doc.save();
  
      res.json({ success: true });
  
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Auto-save failed' });
    }
  });
module.exports = router;