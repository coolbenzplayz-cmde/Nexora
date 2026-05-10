import express from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer } from 'kafkajs';
import * as tf from '@tensorflow/tfjs-node';
import natural from 'natural';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3010;
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];

let db: Db;
let redis: Redis;
let kafka: Kafka;
let producer: Producer;

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function initializeDatabase() {
  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  db = client.db('nexora');
  console.log('Connected to MongoDB');
}

async function initializeRedis() {
  redis = new Redis(REDIS_URL);
  console.log('Connected to Redis');
}

async function initializeKafka() {
  kafka = new Kafka({
    clientId: 'ai-inference-service',
    brokers: KAFKA_BROKERS,
  });

  producer = kafka.producer();
  await producer.connect();
  console.log('Kafka producer connected');
}

// Comprehensive Fraud Detection System
interface FraudDetectionResult {
  isFraudulent: boolean;
  riskScore: number; // 0-100
  categories: string[];
  confidence: number;
  details: {
    patternMatches: string[];
    behaviorFlags: string[];
    contentAnalysis: any;
    metadata: any;
  };
  action: 'allow' | 'flag' | 'block' | 'require_review';
}

// Pattern databases for fraud detection
const FRAUD_PATTERNS = {
  phishing: {
    patterns: [
      /click here.*verify/i,
      /confirm.*account/i,
      /update.*payment/i,
      /urgent.*action/i,
      /suspended.*account/i,
      /billing.*issue/i,
      /verify.*identity/i,
      /security.*alert/i,
    ],
    weight: 0.9,
  },
  scam: {
    patterns: [
      /send money/i,
      /wire transfer/i,
      /gift card/i,
      /bitcoin/i,
      /crypto.*wallet/i,
      /investment.*opportunity/i,
      /quick.*rich/i,
      /earn.*money.*fast/i,
      /western union/i,
      /moneygram/i,
    ],
    weight: 0.85,
  },
  spam: {
    patterns: [
      /buy now/i,
      /free.*offer/i,
      /click.*link/i,
      /subscribe.*now/i,
      /limited.*time/i,
      /act.*now/i,
      /don't.*miss/i,
      /exclusive.*deal/i,
      /winner/i,
      /congratulations/i,
    ],
    weight: 0.7,
  },
  harassment: {
    patterns: [
      /\b(hate|kill|die|stupid|idiot|ugly|fat|loser)\b/i,
      /go.*kill.*yourself/i,
      /you.*should.*die/i,
      /worthless/i,
      /pathetic/i,
    ],
    weight: 0.95,
  },
  bot_behavior: {
    patterns: [
      /\d{3}-\d{3}-\d{4}/g, // Phone number patterns
      /(https?:\/\/)?[\w\-]+(\.[\w\-]+)+([\w\-.,@?^=%&:/~+#]*[\w\-@?^=%&/~+#])?/gi, // Multiple URLs
      /^[A-Z]{2,}\s+[A-Z]{2,}/, // Excessive caps
    ],
    weight: 0.6,
  },
};

// Levenshtein distance for detecting obfuscated words
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Detect obfuscated toxic words
function detectObfuscatedWords(content: string): string[] {
  const toxicWords = ['spam', 'scam', 'fake', 'hate', 'violence', 'kill', 'die', 'stupid', 'idiot', 'loser', 'worthless', 'pathetic'];
  const tokens = tokenizer.tokenize(content.toLowerCase());
  const found: string[] = [];

  for (const token of tokens) {
    for (const toxic of toxicWords) {
      const distance = levenshteinDistance(token, toxic);
      const maxLength = Math.max(token.length, toxic.length);
      const similarity = 1 - (distance / maxLength);
      
      if (similarity > 0.7 && token !== toxic) {
        found.push(`${token} (similar to: ${toxic})`);
      }
    }
  }

  return found;
}

// Detect excessive repetition (spam indicator)
function detectRepetition(content: string): boolean {
  const tokens = tokenizer.tokenize(content.toLowerCase());
  const tokenCount = new Map<string, number>();
  
  for (const token of tokens) {
    tokenCount.set(token, (tokenCount.get(token) || 0) + 1);
  }
  
  // If any word appears more than 30% of the time, it's suspicious
  const maxCount = Math.max(...tokenCount.values());
  return maxCount / tokens.length > 0.3;
}

// Detect suspicious character patterns
function detectSuspiciousPatterns(content: string): string[] {
  const patterns: string[] = [];
  
  // Excessive special characters
  const specialCharCount = (content.match(/[^a-zA-Z0-9\s]/g) || []).length;
  if (specialCharCount / content.length > 0.3) {
    patterns.push('excessive_special_characters');
  }
  
  // Repeated characters
  if (/(.)\1{4,}/.test(content)) {
    patterns.push('repeated_characters');
  }
  
  // Mixed case randomness (character substitution)
  const mixedCaseWords = content.split(/\s+/).filter(word => 
    word.length > 3 && /[a-z]/.test(word) && /[A-Z]/.test(word)
  );
  if (mixedCaseWords.length / content.split(/\s+/).length > 0.5) {
    patterns.push('suspicious_case_mixing');
  }
  
  // Number substitution (leet speak)
  if (/[a-z]\d[a-z]/i.test(content) || /\d[a-z]\d/i.test(content)) {
    patterns.push('number_substitution');
  }
  
  return patterns;
}

// Behavioral analysis
interface BehaviorContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
  messageCount?: number;
  timeSinceLastMessage?: number;
}

async function analyzeBehavior(context: BehaviorContext): Promise<{
  riskScore: number;
  flags: string[];
}> {
  const flags: string[] = [];
  let riskScore = 0;
  
  // Check for high message velocity
  if (context.messageCount && context.messageCount > 10) {
    flags.push('high_message_velocity');
    riskScore += 30;
  }
  
  // Check for rapid succession
  if (context.timeSinceLastMessage && context.timeSinceLastMessage < 1000) {
    flags.push('rapid_succession');
    riskScore += 25;
  }
  
  // Check user history in Redis
  if (context.userId) {
    const userHistory = await redis.get(`fraud_history:${context.userId}`);
    if (userHistory) {
      const history = JSON.parse(userHistory);
      if (history.violationCount > 5) {
        flags.push('repeat_offender');
        riskScore += 40;
      }
      if (history.recentFlags > 3) {
        flags.push('suspicious_activity_pattern');
        riskScore += 20;
      }
    }
  }
  
  // Check IP-based reputation
  if (context.ipAddress) {
    const ipReputation = await redis.get(`ip_reputation:${context.ipAddress}`);
    if (ipReputation) {
      const rep = JSON.parse(ipReputation);
      if (rep.score < 50) {
        flags.push('low_ip_reputation');
        riskScore += 30;
      }
    }
  }
  
  return { riskScore: Math.min(riskScore, 100), flags };
}

// Comprehensive fraud detection
async function detectFraud(content: string, context: BehaviorContext = {}): Promise<FraudDetectionResult> {
  const details = {
    patternMatches: [] as string[],
    behaviorFlags: [] as string[],
    contentAnalysis: {} as any,
    metadata: {} as any,
  };
  
  let totalRiskScore = 0;
  const categories: string[] = [];
  
  // 1. Pattern matching
  for (const [category, data] of Object.entries(FRAUD_PATTERNS)) {
    for (const pattern of data.patterns) {
      if (pattern.test(content)) {
        categories.push(category);
        details.patternMatches.push(`${category}: ${pattern.source}`);
        totalRiskScore += data.weight * 100;
      }
    }
  }
  
  // 2. Obfuscated word detection
  const obfuscated = detectObfuscatedWords(content);
  if (obfuscated.length > 0) {
    categories.push('obfuscated_toxic_content');
    details.patternMatches.push(...obfuscated);
    totalRiskScore += obfuscated.length * 20;
  }
  
  // 3. Repetition detection
  if (detectRepetition(content)) {
    categories.push('repetitive_content');
    details.patternMatches.push('excessive_repetition');
    totalRiskScore += 30;
  }
  
  // 4. Suspicious character patterns
  const suspiciousPatterns = detectSuspiciousPatterns(content);
  if (suspiciousPatterns.length > 0) {
    categories.push('suspicious_formatting');
    details.patternMatches.push(...suspiciousPatterns);
    totalRiskScore += suspiciousPatterns.length * 15;
  }
  
  // 5. Behavioral analysis
  const behaviorResult = await analyzeBehavior(context);
  details.behaviorFlags = behaviorResult.flags;
  totalRiskScore += behaviorResult.riskScore;
  
  // 6. Content length analysis
  const tokens = tokenizer.tokenize(content);
  if (tokens.length < 3) {
    categories.push('suspiciously_short');
    totalRiskScore += 10;
  }
  if (tokens.length > 1000) {
    categories.push('suspiciously_long');
    totalRiskScore += 15;
  }
  
  // Normalize risk score
  const normalizedRiskScore = Math.min(Math.round(totalRiskScore), 100);
  
  // Determine action based on risk score
  let action: 'allow' | 'flag' | 'block' | 'require_review';
  if (normalizedRiskScore >= 80) {
    action = 'block';
  } else if (normalizedRiskScore >= 60) {
    action = 'require_review';
  } else if (normalizedRiskScore >= 30) {
    action = 'flag';
  } else {
    action = 'allow';
  }
  
  // Store violation history
  if (context.userId && normalizedRiskScore > 30) {
    const historyKey = `fraud_history:${context.userId}`;
    const existingHistory = await redis.get(historyKey);
    const history = existingHistory ? JSON.parse(existingHistory) : { violationCount: 0, recentFlags: 0, lastViolation: null };
    history.violationCount++;
    history.recentFlags++;
    history.lastViolation = new Date().toISOString();
    await redis.setex(historyKey, 86400, JSON.stringify(history)); // 24 hour TTL
  }
  
  details.contentAnalysis = {
    tokenCount: tokens.length,
    obfuscatedWordsFound: obfuscated.length,
    suspiciousPatterns: suspiciousPatterns.length,
  };
  
  details.metadata = {
    analyzedAt: new Date().toISOString(),
    userId: context.userId,
    ipAddress: context.ipAddress,
  };
  
  return {
    isFraudulent: normalizedRiskScore > 30,
    riskScore: normalizedRiskScore,
    categories: [...new Set(categories)],
    confidence: Math.min(normalizedRiskScore / 100, 1),
    details,
    action,
  };
}

// Legacy content moderation (kept for compatibility)
async function moderateContent(content: string): Promise<{
  isSafe: boolean;
  categories: string[];
  confidence: number;
}> {
  const fraudResult = await detectFraud(content);
  return {
    isSafe: !fraudResult.isFraudulent,
    categories: fraudResult.categories,
    confidence: fraudResult.confidence,
  };
}

// Content Scoring
async function scoreContent(content: string, tags: string[] = []): Promise<number> {
  const tokens = tokenizer.tokenize(content.toLowerCase());
  const engagementKeywords = ['amazing', 'great', 'awesome', 'love', 'best', 'incredible'];
  
  let score = 0.5; // Base score

  // Length bonus
  if (tokens.length > 50) score += 0.1;
  if (tokens.length > 100) score += 0.1;

  // Keyword bonus
  const keywordMatches = tokens.filter(token => 
    engagementKeywords.some(keyword => token.includes(keyword))
  ).length;
  score += keywordMatches * 0.05;

  // Tags bonus
  if (tags.length > 0) score += 0.1;

  return Math.min(score, 1.0);
}

// Interest Analysis
async function analyzeInterests(userBehaviors: any[]): Promise<string[]> {
  const interests = new Map<string, number>();

  for (const behavior of userBehaviors) {
    if (behavior.tags) {
      for (const tag of behavior.tags) {
        interests.set(tag, (interests.get(tag) || 0) + 1);
      }
    }
  }

  // Sort by frequency and return top interests
  return Array.from(interests.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([interest]) => interest);
}

// Similarity Calculation
async function calculateSimilarity(content1: string, content2: string): Promise<number> {
  const tokens1 = new Set(tokenizer.tokenize(content1.toLowerCase()));
  const tokens2 = new Set(tokenizer.tokenize(content2.toLowerCase()));

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'ai-inference-service' });
});

app.post('/ai/moderate', async (req, res) => {
  try {
    const { content } = req.body;

    const result = await moderateContent(content);

    // Cache result
    await redis.setex(`moderate:${Buffer.from(content).toString('base64')}`, 3600, JSON.stringify(result));

    res.json(result);
  } catch (error) {
    console.error('Error moderating content:', error);
    res.status(500).json({ error: 'Content moderation failed' });
  }
});

// New comprehensive fraud detection endpoint
app.post('/ai/fraud-detect', async (req, res) => {
  try {
    const { content, context } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await detectFraud(content, context || {});

    // Cache result for 1 hour
    const cacheKey = `fraud:${Buffer.from(content).toString('base64')}`;
    await redis.setex(cacheKey, 3600, JSON.stringify(result));

    // Log high-risk detections
    if (result.riskScore > 50) {
      console.log(`[FRAUD DETECTION] Risk Score: ${result.riskScore}, Categories: ${result.categories.join(', ')}`);
      // Publish to Kafka for monitoring
      await producer.send({
        topic: 'fraud-alerts',
        messages: [{
          key: result.riskScore.toString(),
          value: JSON.stringify({
            event: 'fraud_detected',
            data: result,
            timestamp: new Date().toISOString(),
          }),
        }],
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error detecting fraud:', error);
    res.status(500).json({ error: 'Fraud detection failed' });
  }
});

// Batch fraud detection
app.post('/ai/fraud-detect-batch', async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items must be an array' });
    }

    const results = await Promise.all(
      items.map(async (item: any) => ({
        id: item.id,
        result: await detectFraud(item.content, item.context || {}),
      }))
    );

    res.json({ results });
  } catch (error) {
    console.error('Error in batch fraud detection:', error);
    res.status(500).json({ error: 'Batch fraud detection failed' });
  }
});

// Update user reputation
app.post('/ai/user-reputation', async (req, res) => {
  try {
    const { userId, action, score } = req.body;

    if (!userId || !action) {
      return res.status(400).json({ error: 'userId and action are required' });
    }

    const reputationKey = `user_reputation:${userId}`;
    const existing = await redis.get(reputationKey);
    const reputation = existing ? JSON.parse(existing) : { score: 100, violations: 0, lastUpdate: null };

    if (action === 'violation') {
      reputation.score = Math.max(0, reputation.score - (score || 10));
      reputation.violations++;
    } else if (action === 'restore') {
      reputation.score = Math.min(100, reputation.score + (score || 5));
    }

    reputation.lastUpdate = new Date().toISOString();
    await redis.setex(reputationKey, 604800, JSON.stringify(reputation)); // 7 day TTL

    res.json(reputation);
  } catch (error) {
    console.error('Error updating user reputation:', error);
    res.status(500).json({ error: 'Failed to update reputation' });
  }
});

// Get user reputation
app.get('/ai/user-reputation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const reputationKey = `user_reputation:${userId}`;
    const existing = await redis.get(reputationKey);
    const reputation = existing ? JSON.parse(existing) : { score: 100, violations: 0, lastUpdate: null };

    res.json(reputation);
  } catch (error) {
    console.error('Error getting user reputation:', error);
    res.status(500).json({ error: 'Failed to get reputation' });
  }
});

// Language Detection using simple heuristics
function detectLanguage(content: string): string {
  // Simple language detection based on character patterns
  // In production, use a proper library like franc or langdetect
  
  const patterns = {
    'en': /\b(the|and|is|in|to|of|a|for|it|on|with|as|this|that|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can)\b/i,
    'es': /\b(el|la|de|que|y|a|en|un|ser|se|no|haber|por|con|su|para|como|estar|tener|le|lo|todo|pero|más|hacer|o|poder|decir|este|ir|otro|ese|cuando|mucho|sí|ya|al|donde)\b/i,
    'fr': /\b(le|de|un|à|être|et|à|il|avoir|ne|je|son|que|se|qui|dans|ce|en|du|elle|au|que|qui|est|sur|avec|pas|plus|par|faire|tout|mais|nous|comme|ou|si|leur|y|dire|elle|sous|temps)\b/i,
    'de': /\b(der|die|und|in|den|von|zu|das|mit|sich|des|auf|für|ist|im|dem|nicht|ein|eine|als|auch|es|an|werden|aus|er|hat|dass|sie|nach|wird|bei|einer|um|am|sind|noch|wie einem|über|so|zum|haben|oder|aber)\b/i,
    'zh': /[\u4e00-\u9fff]/, // Chinese characters
    'ja': /[\u3040-\u309f\u30a0-\u30ff]/, // Hiragana and Katakana
    'ko': /[\uac00-\ud7af]/, // Korean characters
    'ar': /[\u0600-\u06ff]/, // Arabic characters
    'ru': /[\u0400-\u04ff]/, // Cyrillic characters
    'pt': /\b(o|a|de|que|e|do|da|em|um|para|é|com|não|uma|os|no|se|na|por|mais|as|dos|como|mas|foi|ao|ele|das|tem|à|seu|sua|ou|ser|quando|muito|há|nos|já|está|eu|também|só|pelo|pela|até|isso|ela|entre|era|depois|sem|mesmo|aos|ter|seus|quem|nas|me|esse|eles|estão|você|tinha|foram|essa|num|nem|suas|meu|às|minha|têm|numa|pelos|elas|havia|seja|qual|será|nós|tenho|lhe|deles|essas|esses|pelas|este|fosse|dele)\b/i,
    'it': /\b(il|la|di|che|e|un|in|a|per|non|è|del|le|si|lo|una|da|mi|su|al|con|come|ma|più|anche|tutto|quando|se|ne|dal|ai|suo|fare|questo|bene|così|ora|ancora|solo|questi|tua|tutto|dopo|essere|stato|prima|tra|noi|quello|cui|sui|questa|negli|degli|sulla|dalle|dalla|quella|quelli|quelle|nella|nello|negli|sul|dallo|dagli|dalle|dallo|dalla|dagli|dalle)\b/i,
  };

  for (const [lang, pattern] of Object.entries(patterns)) {
    const matches = content.match(pattern);
    if (matches && matches.length > 2) {
      return lang;
    }
  }

  return 'en'; // Default to English
}

// Translation cache with fallback translations
const TRANSLATIONS = {
  en: {},
  es: {
    'hello': 'hola',
    'goodbye': 'adiós',
    'thank you': 'gracias',
    'please': 'por favor',
    'yes': 'sí',
    'no': 'no',
  },
  fr: {
    'hello': 'bonjour',
    'goodbye': 'au revoir',
    'thank you': 'merci',
    'please': 's\'il vous plaît',
    'yes': 'oui',
    'no': 'non',
  },
  de: {
    'hello': 'hallo',
    'goodbye': 'auf wiedersehen',
    'thank you': 'danke',
    'please': 'bitte',
    'yes': 'ja',
    'no': 'nein',
  },
  pt: {
    'hello': 'olá',
    'goodbye': 'tchau',
    'thank you': 'obrigado',
    'please': 'por favor',
    'yes': 'sim',
    'no': 'não',
  },
  it: {
    'hello': 'ciao',
    'goodbye': 'arrivederci',
    'thank you': 'grazie',
    'please': 'per favore',
    'yes': 'sì',
    'no': 'no',
  },
  zh: {
    'hello': '你好',
    'goodbye': '再见',
    'thank you': '谢谢',
    'please': '请',
    'yes': '是',
    'no': '不',
  },
  ja: {
    'hello': 'こんにちは',
    'goodbye': 'さようなら',
    'thank you': 'ありがとう',
    'please': 'お願いします',
    'yes': 'はい',
    'no': 'いいえ',
  },
  ko: {
    'hello': '안녕하세요',
    'goodbye': '안녕히 가세요',
    'thank you': '감사합니다',
    'please': '부탁합니다',
    'yes': '예',
    'no': '아니요',
  },
  ar: {
    'hello': 'مرحبا',
    'goodbye': 'وداعا',
    'thank you': 'شكرا',
    'please': 'من فضلك',
    'yes': 'نعم',
    'no': 'لا',
  },
  ru: {
    'hello': 'привет',
    'goodbye': 'до свидания',
    'thank you': 'спасибо',
    'please': 'пожалуйста',
    'yes': 'да',
    'no': 'нет',
  },
};

// Simple translation function (in production, use Google Translate API, DeepL, or similar)
async function translateText(text: string, targetLang: string, sourceLang?: string): Promise<{
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}> {
  const detectedSource = sourceLang || detectLanguage(text);
  
  // If same language, return as-is
  if (detectedSource === targetLang) {
    return {
      translatedText: text,
      sourceLanguage: detectedSource,
      targetLanguage: targetLang,
      confidence: 1.0,
    };
  }

  // Check cache first
  const cacheKey = `translate:${detectedSource}:${targetLang}:${Buffer.from(text).toString('base64')}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Simple word-by-word translation for common phrases
  let translatedText = text.toLowerCase();
  const translations = TRANSLATIONS[targetLang] || {};
  
  for (const [original, translated] of Object.entries(translations)) {
    const regex = new RegExp(`\\b${original}\\b`, 'gi');
    translatedText = translatedText.replace(regex, translated);
  }

  const result = {
    translatedText,
    sourceLanguage: detectedSource,
    targetLanguage: targetLang,
    confidence: 0.7, // Lower confidence for simple translation
  };

  // Cache for 24 hours
  await redis.setex(cacheKey, 86400, JSON.stringify(result));

  return result;
}

// Language detection endpoint
app.post('/ai/detect-language', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const language = detectLanguage(content);
    const confidence = 0.8; // Base confidence for simple detection

    res.json({
      language,
      confidence,
      content,
    });
  } catch (error) {
    console.error('Error detecting language:', error);
    res.status(500).json({ error: 'Language detection failed' });
  }
});

// Translation endpoint
app.post('/ai/translate', async (req, res) => {
  try {
    const { content, targetLanguage, sourceLanguage } = req.body;

    if (!content || !targetLanguage) {
      return res.status(400).json({ error: 'Content and targetLanguage are required' });
    }

    const result = await translateText(content, targetLanguage, sourceLanguage);

    res.json(result);
  } catch (error) {
    console.error('Error translating text:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Batch translation endpoint
app.post('/ai/translate-batch', async (req, res) => {
  try {
    const { items, targetLanguage } = req.body;

    if (!Array.isArray(items) || !targetLanguage) {
      return res.status(400).json({ error: 'Items must be an array and targetLanguage is required' });
    }

    const results = await Promise.all(
      items.map(async (item: any) => ({
        id: item.id,
        result: await translateText(item.content, targetLanguage, item.sourceLanguage),
      }))
    );

    res.json({ results });
  } catch (error) {
    console.error('Error in batch translation:', error);
    res.status(500).json({ error: 'Batch translation failed' });
  }
});

app.post('/ai/score', async (req, res) => {
  try {
    const { content, tags } = req.body;

    const score = await scoreContent(content, tags);

    res.json({ score });
  } catch (error) {
    res.status(500).json({ error: 'Content scoring failed' });
  }
});

app.post('/ai/analyze-interests', async (req, res) => {
  try {
    const { userId } = req.body;

    const behaviors = await db.collection('user_behaviors')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();

    const interests = await analyzeInterests(behaviors);

    // Cache result
    await redis.setex(`interests:${userId}`, 3600, JSON.stringify(interests));

    res.json({ interests });
  } catch (error) {
    res.status(500).json({ error: 'Interest analysis failed' });
  }
});

app.post('/ai/similarity', async (req, res) => {
  try {
    const { content1, content2 } = req.body;

    const similarity = await calculateSimilarity(content1, content2);

    res.json({ similarity });
  } catch (error) {
    res.status(500).json({ error: 'Similarity calculation failed' });
  }
});

app.post('/ai/batch-score', async (req, res) => {
  try {
    const { contents } = req.body;

    const scores = await Promise.all(
      contents.map(async (content: any) => ({
        id: content.id,
        score: await scoreContent(content.content, content.tags),
      }))
    );

    res.json({ scores });
  } catch (error) {
    res.status(500).json({ error: 'Batch scoring failed' });
  }
});

app.post('/ai/recommend', async (req, res) => {
  try {
    const { userId, limit = 10 } = req.body;

    // Get user's interests
    const cachedInterests = await redis.get(`interests:${userId}`);
    let interests = cachedInterests ? JSON.parse(cachedInterests) : [];

    if (interests.length === 0) {
      const behaviors = await db.collection('user_behaviors')
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      interests = await analyzeInterests(behaviors);
      await redis.setex(`interests:${userId}`, 3600, JSON.stringify(interests));
    }

    // Get candidate content based on interests
    const candidateContent = await db.collection('feeds')
      .find({ tags: { $in: interests } })
      .limit(parseInt(limit) * 2)
      .toArray();

    // Score and rank candidates
    const scored = await Promise.all(
      candidateContent.map(async (content: any) => ({
        ...content,
        score: await scoreContent(content.content, content.tags),
      }))
    );

    const recommendations = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit));

    res.json({ recommendations });
  } catch (error) {
    res.status(500).json({ error: 'Recommendation failed' });
  }
});

app.post('/ai/extract-tags', async (req, res) => {
  try {
    const { content } = req.body;

    const tokens = tokenizer.tokenize(content.toLowerCase());
    const stemmed = tokens.map(t => stemmer.stem(t));
    
    // Filter common words and get unique stems
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very']);
    
    const tags = [...new Set(stemmed.filter(t => !stopWords.has(t) && t.length > 2))].slice(0, 10);

    res.json({ tags });
  } catch (error) {
    res.status(500).json({ error: 'Tag extraction failed' });
  }
});

async function start() {
  try {
    await initializeDatabase();
    await initializeRedis();
    await initializeKafka();

    app.listen(PORT, () => {
      console.log(`AI Inference Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

start();
