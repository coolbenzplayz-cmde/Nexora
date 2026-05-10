import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';

const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());

// MongoDB connection
const mongoClient = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017');
let db: Db;

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Kafka setup
const kafka = new Kafka({
  clientId: 'recommendation-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'recommendation-service-group' });

interface Recommendation {
  userId: string;
  contentId: string;
  contentType: 'post' | 'video' | 'livestream' | 'user' | 'music';
  score: number;
  reason: string;
  timestamp: Date;
}

interface UserBehavior {
  userId: string;
  contentId: string;
  action: 'view' | 'like' | 'share' | 'comment' | 'follow' | 'skip';
  timestamp: Date;
  duration?: number;
}

// Initialize database
async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('recommendations');
  await db.createCollection('user_behaviors');
  await db.createIndex('recommendations', { userId: 1, score: -1 });
  await db.createIndex('user_behaviors', { userId: 1, timestamp: -1 });
  await db.createIndex('user_behaviors', { contentId: 1 });
  
  console.log('Database initialized');
}

// Get personalized recommendations
app.get('/recommendations/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 20, type } = req.query;
    
    const cacheKey = `recommendations:${userId}:${limit}:${type || 'all'}`;
    const cachedRecs = await redis.get(cacheKey);
    
    if (cachedRecs) {
      return res.json(JSON.parse(cachedRecs));
    }
    
    const query: any = { userId };
    if (type) {
      query.contentType = type;
    }
    
    const recommendations = await db.collection('recommendations')
      .find(query)
      .sort({ score: -1 })
      .limit(Number(limit))
      .toArray();
    
    await redis.setex(cacheKey, 600, JSON.stringify(recommendations));
    
    res.json(recommendations);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Record user behavior
app.post('/behavior', async (req: Request, res: Response) => {
  try {
    const { userId, contentId, action, duration } = req.body;
    
    if (!userId || !contentId || !action) {
      return res.status(400).json({ error: 'userId, contentId, and action are required' });
    }
    
    const behavior: UserBehavior = {
      userId,
      contentId,
      action,
      timestamp: new Date(),
      duration
    };
    
    await db.collection('user_behaviors').insertOne(behavior);
    
    // Publish to Kafka for real-time processing
    await producer.send({
      topic: 'user-behavior',
      messages: [{
        key: userId,
        value: JSON.stringify(behavior)
      }]
    });
    
    // Invalidate recommendation cache
    await redis.del(`recommendations:${userId}*`);
    
    res.status(201).json(behavior);
  } catch (error) {
    console.error('Record behavior error:', error);
    res.status(500).json({ error: 'Failed to record behavior' });
  }
});

// Generate recommendations (AI-based)
app.post('/recommendations/generate/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Get user's recent behaviors
    const recentBehaviors = await db.collection('user_behaviors')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    
    // Analyze interests from behaviors
    const interests = analyzeInterests(recentBehaviors);
    
    // Get candidate content based on interests
    const candidates = await getCandidateContent(interests);
    
    // Score candidates using AI model
    const scoredCandidates = await scoreCandidates(userId, candidates);
    
    // Save recommendations
    const recommendations = scoredCandidates.map((candidate, index) => ({
      userId,
      contentId: candidate.id,
      contentType: candidate.type,
      score: candidate.score,
      reason: candidate.reason,
      timestamp: new Date()
    }));
    
    // Delete old recommendations
    await db.collection('recommendations').deleteMany({ userId });
    
    // Insert new recommendations
    if (recommendations.length > 0) {
      await db.collection('recommendations').insertMany(recommendations);
    }
    
    // Invalidate cache
    await redis.del(`recommendations:${userId}*`);
    
    res.json({ message: 'Recommendations generated', count: recommendations.length });
  } catch (error) {
    console.error('Generate recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Get trending content
app.get('/trending', async (req: Request, res: Response) => {
  try {
    const { limit = 20, type, timeRange = '24h' } = req.query;
    
    const cacheKey = `trending:${limit}:${type || 'all'}:${timeRange}`;
    const cachedTrending = await redis.get(cacheKey);
    
    if (cachedTrending) {
      return res.json(JSON.parse(cachedTrending));
    }
    
    const timeThreshold = new Date();
    if (timeRange === '24h') {
      timeThreshold.setHours(timeThreshold.getHours() - 24);
    } else if (timeRange === '7d') {
      timeThreshold.setDate(timeThreshold.getDate() - 7);
    } else if (timeRange === '30d') {
      timeThreshold.setDate(timeThreshold.getDate() - 30);
    }
    
    const query: any = {
      timestamp: { $gte: timeThreshold }
    };
    
    if (type) {
      query.contentType = type;
    }
    
    const trending = await db.collection('user_behaviors')
      .aggregate([
        { $match: query },
        { $group: { _id: '$contentId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: Number(limit) }
      ])
      .toArray();
    
    await redis.setex(cacheKey, 300, JSON.stringify(trending));
    
    res.json(trending);
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

// Get similar content
app.get('/similar/:contentId', async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const { limit = 10 } = req.query;
    
    const cacheKey = `similar:${contentId}:${limit}`;
    const cachedSimilar = await redis.get(cacheKey);
    
    if (cachedSimilar) {
      return res.json(JSON.parse(cachedSimilar));
    }
    
    // Get users who interacted with this content
    const contentUsers = await db.collection('user_behaviors')
      .find({ contentId })
      .limit(100)
      .toArray();
    
    const userIds = contentUsers.map(b => b.userId);
    
    // Get other content these users interacted with
    const similarContent = await db.collection('user_behaviors')
      .aggregate([
        { $match: { userId: { $in: userIds }, contentId: { $ne: contentId } } },
        { $group: { _id: '$contentId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: Number(limit) }
      ])
      .toArray();
    
    await redis.setex(cacheKey, 600, JSON.stringify(similarContent));
    
    res.json(similarContent);
  } catch (error) {
    console.error('Get similar content error:', error);
    res.status(500).json({ error: 'Failed to fetch similar content' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'recommendation-service' });
});

// Helper functions

function analyzeInterests(behaviors: UserBehavior[]): string[] {
  const interests: string[] = [];
  const actionWeights = {
    like: 3,
    share: 2,
    comment: 2,
    view: 1,
    follow: 5,
    skip: -1
  };
  
  const contentScores: { [key: string]: number } = {};
  
  behaviors.forEach(behavior => {
    const score = actionWeights[behavior.action] || 0;
    contentScores[behavior.contentId] = (contentScores[behavior.contentId] || 0) + score;
  });
  
  // Extract top content types as interests
  const sortedContent = Object.entries(contentScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  sortedContent.forEach(([contentId]) => {
    interests.push(contentId);
  });
  
  return interests;
}

async function getCandidateContent(interests: string[]): Promise<any[]> {
  // This would query the feed service or content database
  // For now, return mock candidates
  return interests.map((interest, index) => ({
    id: interest,
    type: 'post',
    score: 1 - (index * 0.1),
    reason: 'Based on your interests'
  }));
}

async function scoreCandidates(userId: string, candidates: any[]): Promise<any[]> {
  // This would use a machine learning model to score candidates
  // For now, use a simple scoring algorithm
  return candidates.map(candidate => ({
    ...candidate,
    score: candidate.score * (0.8 + Math.random() * 0.4), // Add some randomness
    reason: 'Personalized for you'
  })).sort((a, b) => b.score - a.score);
}

// Start server
async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'user-behavior', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const behavior = JSON.parse(value);
        console.log('Received user behavior:', behavior);
        
        // Trigger recommendation update if significant action
        if (['like', 'follow', 'share'].includes(behavior.action)) {
          await redis.del(`recommendations:${behavior.userId}*`);
        }
      }
    }
  });
  
  app.listen(PORT, () => {
    console.log(`Recommendation Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start recommendation service:', error);
  process.exit(1);
});

export default app;
