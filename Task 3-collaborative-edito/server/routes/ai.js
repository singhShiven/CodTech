
const router = require('express').Router();
const aiService = require('../services/aiService');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);
router.post('/suggest', async (req, res) => {
    try {
      const { text, type } = req.body;
      const userId = req.user?.id || 'anonymous';
  
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
  
      let result;
  
      switch (type) {
        case 'improve':
        case 'rewrite':
          result = await aiService.rewriteText(text, userId);
          break;
  
        case 'summarize':
          result = await aiService.summarizeDocument(text, userId);
          break;
  
        case 'bullet':
          result = await aiService.generateBulletPoints(text, userId);
          break;
  
        case 'conclusion':
          result = await aiService.generateConclusion(text, userId);
          break;
  
        default:
          result = await aiService.rewriteText(text, userId);
      }
  
      res.json({ suggestion: result });
  
    } catch (err) {
      console.error("AI ROUTE ERROR:", err.message);
      res.status(500).json({ error: err.message || 'AI request failed' });
    }
  });
module.exports = router;