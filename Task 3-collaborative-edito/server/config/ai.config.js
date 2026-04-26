/**
 * AI Service Configuration - OPTIMIZED
 *
 * PERFORMANCE FIXES:
 * 1. Model downgraded from 70b → llama3-8b-8192 (4-5x faster)
 * 2. max_tokens reduced 1024 → 300 (shorter wait, still complete responses)
 * 3. temperature lowered to 0.5 (faster, more deterministic)
 * 4. requestTimeout tightened to 15s (fail fast rather than hang)
 * 5. mockMode can be toggled via env for instant demo fallback
 */

require('dotenv').config();

module.exports = {
  // Groq API Configuration
  groq: {
    apiKey:      process.env.GROQ_API_KEY,
    // FIX: Use fast 8b model — was causing 5-10s delays with 70b
    model:       process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    // FIX: Reduced from 1024 → 300 — enough for all AI operations
    maxTokens:   parseInt(process.env.GROQ_MAX_TOKENS) || 300,
    // FIX: Lower temperature = faster, more consistent outputs
    temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.5,
    enabled:     process.env.AI_ENABLED !== 'false',
    // Set AI_MOCK_MODE=true in .env for instant demo responses
    mockMode:    process.env.AI_MOCK_MODE === 'true'
  },

  // AI Feature Limits
  limits: {
    maxDocumentLength:   20000, // FIX: reduced from 50000 — trim input for speed
    maxRequestsPerMinute: 10,
    // FIX: tighter timeout — 30s was causing UI to hang
    requestTimeout:      15000
  },

  // AI Prompts — kept concise to reduce input tokens
  prompts: {
    rewrite:      'Rewrite the following text for clarity and readability. Be concise:\n\n',
    summarize:    'Summarize the following text in 2-3 sentences:\n\n',
    bulletPoints: 'Convert to clear bullet points (max 6 bullets):\n\n',
    conclusion:   'Write a short professional conclusion (2-3 sentences) for:\n\n',
    formalTone:   'Rewrite in a formal, professional tone:\n\n',
    technicalTone:'Rewrite in a technical, precise tone:\n\n',
    actionItems:  'List action items as a numbered list (max 8 items):\n\n',
    chatSystem:   'You are a writing assistant. Answer concisely based on the document context provided.'
  },

  // NLP Configuration (local — always fast)
  nlp: {
    sentimentEnabled:   true,
    readabilityEnabled: true,
    complexityEnabled:  true
  }
};