/**
 * aiService.js - AI Service with Groq API Integration
 * 
 * UPDATED: Replaced Gemini API with Groq API
 * Model: llama3-70b-8192
 * 
 * Features:
 * - Groq API integration with automatic fallback to mock mode
 * - Rate limiting (10 requests per user per minute)
 * - Local NLP analytics (readability, sentiment, complexity)
 * - Production-grade error handling
 */

require('dotenv').config({
  path: require('path').join(__dirname, '../.env')
});
const Groq = require('groq-sdk');
const Sentiment = require('sentiment');
const compromise = require('compromise');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
// PERFORMANCE OPTIMIZATION: Use ultra-fast 8B instant model instead of slow 70B
const GROQ_MODEL_FAST = 'openai/gpt-oss-120b'; // For simple operations (tone, rewrite)
const GROQ_MODEL_SMART = 'openai/gpt-oss-120b'; // For complex operations (summary, conclusion)
const AI_ENABLED = process.env.AI_ENABLED === 'true';
const FORCE_MOCK = process.env.AI_MOCK_MODE === 'true';
const MAX_DOC_LEN = 50_000;
const RATE_LIMIT = 10; // requests per user per minute

// System prompt for better AI responses
const SYSTEM_PROMPT = "You are an AI writing assistant. Improve clarity, keep responses concise, and maintain original meaning. Respond only with the improved content without any preamble or explanation.";

// PERFORMANCE OPTIMIZATION: Operation-specific configurations
const OPERATION_CONFIGS = {
  rewrite: { model: GROQ_MODEL_FAST, maxTokens: 512, temperature: 0.3 },
  tone: { model: GROQ_MODEL_FAST, maxTokens: 512, temperature: 0.3 },
  summarize: { model: GROQ_MODEL_FAST, maxTokens: 256, temperature: 0.5 },
  bulletPoints: { model: GROQ_MODEL_FAST, maxTokens: 512, temperature: 0.5 },
  conclusion: { model: GROQ_MODEL_SMART, maxTokens: 384, temperature: 0.6 },
  actionItems: { model: GROQ_MODEL_FAST, maxTokens: 512, temperature: 0.5 }
};

const PROMPTS = {
  rewrite: 'Rewrite the following text to improve clarity and readability while keeping the original meaning:\n\n',
  summarize: 'Provide a concise summary of the following text in 2-3 sentences:\n\n',
  bulletPoints: 'Convert the following text into clear, concise bullet points:\n\n',
  conclusion: 'Write a professional conclusion for the following text:\n\n',
  formalTone: 'Rewrite the following text in a formal, professional tone:\n\n',
  technicalTone: 'Rewrite the following text in a technical, precise tone:\n\n',
  actionItems: 'Extract all action items from the following text as a numbered list:\n\n'
};

// ══════════════════════════════════════════════════════════════════════════════
// AI SERVICE CLASS
// ══════════════════════════════════════════════════════════════════════════════

class AIService {
  constructor() {
    this.groqClient = null;
    this.sentiment = new Sentiment();
    this.rateLimits = new Map(); // userId -> [timestamps]
    this.mockMode = FORCE_MOCK || !AI_ENABLED || !GROQ_API_KEY;
    this.fallbackToMock = false; // Set if API fails

    if (!this.mockMode) {
      this._initGroq();
    } else {
      const reason = FORCE_MOCK ? 'AI_MOCK_MODE=true'
        : !AI_ENABLED ? 'AI_ENABLED=false'
          : 'GROQ_API_KEY not set';
      logger.info(`[AIService] Starting in MOCK mode (${reason})`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ────────────────────────────────────────────────────────────────────────────

  _initGroq() {
    try {
      this.groqClient = new Groq({
        apiKey: GROQ_API_KEY
      });
      logger.info(`[AIService] Groq client initialized (fast model: ${GROQ_MODEL_FAST})`);
    } catch (err) {
      logger.error('[AIService] Failed to create Groq client', err);
      this.mockMode = true;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RATE LIMITING
  // ────────────────────────────────────────────────────────────────────────────

  _checkRateLimit(userId) {
    const now = Date.now();
    const hits = (this.rateLimits.get(userId) || []).filter(t => now - t < 60_000);
  
    if (hits.length >= RATE_LIMIT) return false;
  
    hits.push(now);
  
    // ✅ CLEANUP: remove old users
    if (this.rateLimits.size > 1000) {
      this.rateLimits.clear();
    }
  
    this.rateLimits.set(userId, hits);
    return true;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CORE GROQ API CALL - OPTIMIZED FOR PERFORMANCE
  // ────────────────────────────────────────────────────────────────────────────

  async _callGroq(prompt, text, operationType = 'rewrite') {
    // Use mock mode if forced OR if previous attempts failed
    if (this.mockMode || this.fallbackToMock) {
      return this._mock(prompt, text);
    }

    const fullPrompt = text ? prompt + text : prompt;
    
    // PERFORMANCE: Get operation-specific config
    const config = OPERATION_CONFIGS[operationType] || OPERATION_CONFIGS.rewrite;

    try {
      logger.debug(`[AIService] Calling Groq API (${config.model}, ${config.maxTokens} tokens)...`);

      const chatCompletion = await Promise.race([
        this.groqClient.chat.completions.create({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: fullPrompt }
          ],
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          top_p: 1,
          stream: false
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI timeout after 10s')), 10000)
        )
      ]);

      const response = chatCompletion.choices[0]?.message?.content;

      if (!response || response.trim() === '') {
        throw new Error('Empty response from Groq API');
      }

      logger.debug('[AIService] Groq API call successful');
      return response.trim();

    } catch (err) {
      // Log detailed error for debugging
      console.error('\n━━━ GROQ API ERROR ━━━');
      console.error('Error:', err.message);
      console.error('Status:', err.status || 'N/A');
      console.error('━━━━━━━━━━━━━━━━━━━━━━\n');
    
      const msg = err.message || '';

      // Categorize errors for user-friendly messages
      if (err.status === 401 || err.status === 403 || msg.includes('API key') || msg.includes('authentication')) {
        logger.error('[AIService] Invalid Groq API key');
        throw new Error('Invalid Groq API key. Check GROQ_API_KEY in your .env file.');
      }

      if (err.status === 429 || msg.includes('rate limit') || msg.includes('quota')) {
        logger.error('[AIService] Groq rate limit exceeded');
        throw new Error('Groq rate limit exceeded. Please wait a moment before trying again.');
      }

      if (msg.includes('timeout') || msg.includes('network')) {
        logger.error('[AIService] Network error reaching Groq');
        throw new Error('Network error reaching Groq API. Check your internet connection.');
      }

      // Unknown error - fall back to mock mode for this session
      logger.warn('[AIService] Unknown error, falling back to mock mode for this session');
      this.fallbackToMock = true;
      return this._mock(prompt, text);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MOCK RESPONSES
  // ────────────────────────────────────────────────────────────────────────────

  _mock(prompt, text) {
    const snippet = text.substring(0, 80).replace(/\n/g, ' ');

    if (prompt.includes('Rewrite') || prompt.includes('clarity'))
      return `[MOCK] Improved: "${snippet}..." — rewritten for clarity and readability.`;

    if (prompt.includes('summary'))
      return `[MOCK] Summary: This document discusses collaborative editing concepts. (${text.split(/\s+/).length} words analyzed)`;

    if (prompt.includes('bullet'))
      return `[MOCK]\n• Key point 1 from your document\n• Key point 2 identified\n• Key point 3 extracted`;

    if (prompt.includes('conclusion'))
      return `[MOCK] In conclusion, the collaborative work demonstrates clear structure and effective communication.`;

    if (prompt.includes('formal'))
      return `[MOCK] (Formal tone) We hereby present the formalized documentation: "${snippet}..."`;

    if (prompt.includes('technical'))
      return `[MOCK] (Technical) System specification for: "${snippet}..."`;

    if (prompt.includes('action'))
      return `[MOCK]\n1. Review document sections\n2. Update project timeline\n3. Schedule follow-up meeting`;

    return `[MOCK] AI response generated for: "${snippet}..."`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // INPUT GUARDS
  // ────────────────────────────────────────────────────────────────────────────

  _guard(text, userId) {
    if (!this._checkRateLimit(userId)) {
      throw new Error('Rate limit reached. Please wait a moment before trying again.');
    }
    if ((text || '').length > MAX_DOC_LEN) {
      throw new Error(`Document too long for AI processing (max ${MAX_DOC_LEN.toLocaleString()} characters).`);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PUBLIC AI METHODS - OPTIMIZED WITH OPERATION-SPECIFIC CONFIGS
  // ────────────────────────────────────────────────────────────────────────────

  async rewriteText(text, userId) {
    this._guard(text, userId || 'anonymous') ;
    return this._callGroq(PROMPTS.rewrite, text, 'rewrite');
  }

  async summarizeDocument(text, userId) {
    this._guard(text, userId || 'anonymous') ;
    return this._callGroq(PROMPTS.summarize, text, 'summarize');
  }

  async generateBulletPoints(text, userId) {
    this._guard(text, userId || 'anonymous') ;
    return this._callGroq(PROMPTS.bulletPoints, text, 'bulletPoints');
  }

  async generateConclusion(text, userId) {
    this._guard(text, userId || 'anonymous') ;
    return this._callGroq(PROMPTS.conclusion, text, 'conclusion');
  }

  async adjustTone(text, tone, userId) {
    this._guard(text, userId || 'anonymous') ;
    const prompt = tone === 'formal' ? PROMPTS.formalTone : PROMPTS.technicalTone;
    return this._callGroq(prompt, text, 'tone'); // PERFORMANCE: Use fast model for tone
  }

  async extractActionItems(text, userId) {
    this._guard(text, userId || 'anonymous') ;
    return this._callGroq(PROMPTS.actionItems, text, 'actionItems');
  }

  // Alias for backwards compatibility
  async callOpenAI(prompt, text) {
    return this._callGroq(prompt, text, 'rewrite');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // NLP ANALYTICS (100% LOCAL - NO API CALLS - UNCHANGED)
  // ════════════════════════════════════════════════════════════════════════════

  _countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    const vowels = 'aeiouy';
    let count = 0, prevVowel = false;
    for (const ch of word) {
      const isV = vowels.includes(ch);
      if (isV && !prevVowel) count++;
      prevVowel = isV;
    }
    if (word.endsWith('e')) count--;
    return Math.max(1, count);
  }

  calculateReadability(text) {
    if (!text?.trim()) return { score: 0, level: 'N/A' };
    try {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim());
      const words = text.split(/\s+/).filter(w => w);
      if (!sentences.length || !words.length) return { score: 0, level: 'N/A' };

      const syllables = words.reduce((n, w) => n + this._countSyllables(w), 0);
      const score = Math.max(0, Math.min(100,
        206.835 - 1.015 * (words.length / sentences.length)
          - 84.6 * (syllables / words.length)
      ));

      const level =
        score >= 90 ? 'Very Easy' :
          score >= 80 ? 'Easy' :
            score >= 70 ? 'Fairly Easy' :
              score >= 60 ? 'Standard' :
                score >= 50 ? 'Fairly Difficult' :
                  score >= 30 ? 'Difficult' : 'Very Difficult';

      return { score: Math.round(score), level };
    } catch {
      return { score: 0, level: 'Error' };
    }
  }

  analyzeSentiment(text) {
    if (!text?.trim()) return { score: 0, sentiment: 'neutral', positive: 0, negative: 0 };
    try {
      const result = this.sentiment.analyze(text);
      return {
        score: result.score,
        sentiment: result.score > 2 ? 'positive' : result.score < -2 ? 'negative' : 'neutral',
        positive: result.positive.length,
        negative: result.negative.length
      };
    } catch {
      return { score: 0, sentiment: 'error', positive: 0, negative: 0 };
    }
  }

  detectPassiveVoice(text) {
    if (!text?.trim()) return { count: 0, percentage: 0, examples: [] };
    try {
      const sentences = compromise(text).sentences().out('array');
      let count = 0;
      const examples = [];

      sentences.forEach(sentence => {
        const doc = compromise(sentence);
        const hasAuxiliary = doc.verbs().out('array')
          .some(verb => ['is', 'are', 'was', 'were', 'been', 'be', 'being'].includes(verb.toLowerCase()));
        const hasPastParticiple = doc.match('#PastTense').found;

        if (hasAuxiliary && hasPastParticiple) {
          count++;
          if (examples.length < 3) examples.push(sentence.trim());
        }
      });

      const percentage = sentences.length > 0
        ? Math.round((count / sentences.length) * 100)
        : 0;

      return { count, percentage, examples };
    } catch {
      return { count: 0, percentage: 0, examples: [] };
    }
  }

  calculateComplexity(text) {
    if (!text?.trim()) return { score: 0, level: 'N/A' };
    try {
      const words = text.split(/\s+/).filter(w => w);
      const sentences = text.split(/[.!?]+/).filter(s => s.trim());
      const longWords = words.filter(w => w.length > 6).length;

      const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
      const avgSentenceLength = words.length / (sentences.length || 1);
      const longWordPercent = (longWords / words.length) * 100;

      const score = Math.min(100, Math.round(
        (avgWordLength * 5) + (avgSentenceLength * 2) + longWordPercent
      ));

      const level =
        score < 30 ? 'Simple' :
          score < 50 ? 'Moderate' :
            score < 70 ? 'Complex' : 'Very Complex';

      return { score, level };
    } catch {
      return { score: 0, level: 'Error' };
    }
  }

  getDocumentAnalytics(text) {
    const content = text || '';
    const words = content.split(/\s+/).filter(w => w);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());

    return {
      wordCount: words.length,
      characterCount: content.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      estimatedReadingTime: Math.ceil(words.length / 200), // 200 words per minute
      readability: this.calculateReadability(content),
      sentiment: this.analyzeSentiment(content),
      passiveVoice: this.detectPassiveVoice(content),
      complexity: this.calculateComplexity(content)
    };
    
  }
  // AI CHAT WITH DOCUMENT
async chatWithDocument(message, document, userId) {
  this._guard(document || message, userId);

  const prompt = `
You are an AI assistant helping with a collaborative document.

DOCUMENT:
${document}

USER QUESTION:
${message}

INSTRUCTIONS:
- Answer based ONLY on the document
- Be clear and concise
- If answer not found, say "Not enough information in document"
`;

return this._callGroq(prompt, '', 'rewrite');
}
}


// ══════════════════════════════════════════════════════════════════════════════
// EXPORT SINGLETON
// ══════════════════════════════════════════════════════════════════════════════

module.exports = new AIService();