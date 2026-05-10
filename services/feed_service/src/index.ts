import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// MongoDB connection
const mongoClient = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017');
let db: Db;

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Kafka setup
const kafka = new Kafka({
  clientId: 'feed-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'feed-service-group' });

interface FeedItem {
  id: string;
  userId: string;
  content: string;
  type: 'post' | 'video' | 'image' | 'livestream';
  mediaUrl?: string;
  likes: number;
  comments: number;
  shares: number;
  createdAt: Date;
  aiScore?: number;
  tags?: string[];
}

interface User {
  id: string;
  username: string;
  avatar?: string;
  followers: number;
  following: number;
}

// Initialize database
async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('feeds');
  await db.createCollection('users');
  await db.createIndex('feeds', { userId: 1, createdAt: -1 });
  await db.createIndex('feeds', { type: 1, createdAt: -1 });
  await db.createIndex('feeds', { tags: 1 });
  
  console.log('Database initialized');
}

// Get personalized feed
app.get('/feed/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0, type } = req.query;
    
    // Check cache
    const cacheKey = `feed:${userId}:${limit}:${offset}:${type || 'all'}`;
    const cachedFeed = await redis.get(cacheKey);
    
    if (cachedFeed) {
      return res.json(JSON.parse(cachedFeed));
    }
    
    // Build query
    const query: any = {};
    if (type) {
      query.type = type;
    }
    
    // Get user's following list
    const user = await db.collection('users').findOne({ id: userId });
    const followingIds = user?.following || [userId];
    
    // Get feed items
    const feedItems = await db.collection('feeds')
      .find({ userId: { $in: followingIds }, ...query })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(feedItems));
    
    res.json(feedItems);
  } catch (error) {
    console.error('Feed fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
});

// Get trending feed
app.get('/trending', async (req: Request, res: Response) => {
  try {
    const { limit = 20, timeRange = '24h' } = req.query;
    
    const cacheKey = `trending:${limit}:${timeRange}`;
    const cachedTrending = await redis.get(cacheKey);
    
    if (cachedTrending) {
      return res.json(JSON.parse(cachedTrending));
    }
    
    // Calculate time threshold
    const timeThreshold = new Date();
    if (timeRange === '24h') {
      timeThreshold.setHours(timeThreshold.getHours() - 24);
    } else if (timeRange === '7d') {
      timeThreshold.setDate(timeThreshold.getDate() - 7);
    } else if (timeRange === '30d') {
      timeThreshold.setDate(timeThreshold.getDate() - 30);
    }
    
    // Get trending items based on engagement
    const trendingItems = await db.collection('feeds')
      .find({
        createdAt: { $gte: timeThreshold }
      })
      .sort({ 
        likes: -1,
        comments: -1,
        shares: -1
      })
      .limit(Number(limit))
      .toArray();
    
    // Cache for 10 minutes
    await redis.setex(cacheKey, 600, JSON.stringify(trendingItems));
    
    res.json(trendingItems);
  } catch (error) {
    console.error('Trending fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch trending feed' });
  }
});

// Create post
app.post('/post', async (req: Request, res: Response) => {
  try {
    const { userId, content, type, mediaUrl, tags } = req.body;
    
    if (!userId || !content) {
      return res.status(400).json({ error: 'userId and content are required' });
    }
    
    const feedItem: FeedItem = {
      id: generateId(),
      userId,
      content,
      type: type || 'post',
      mediaUrl,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: new Date(),
      aiScore: calculateAIScore(content),
      tags: tags || []
    };
    
    // Insert into database
    await db.collection('feeds').insertOne(feedItem);
    
    // Publish to Kafka
    await producer.send({
      topic: 'feed-events',
      messages: [
        {
          key: feedItem.id,
          value: JSON.stringify({
            event: 'post_created',
            data: feedItem
          })
        }
      ]
    });
    
    // Invalidate cache
    await redis.del(`feed:${userId}*`);
    
    res.status(201).json(feedItem);
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Like post
app.post('/post/:postId/like', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { userId } = req.body;
    
    const result = await db.collection('feeds').updateOne(
      { id: postId },
      { $inc: { likes: 1 } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Publish to Kafka
    await producer.send({
      topic: 'feed-events',
      messages: [
        {
          key: postId,
          value: JSON.stringify({
            event: 'post_liked',
            data: { postId, userId }
          })
        }
      ]
    });
    
    res.json({ message: 'Post liked' });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// Get post by ID
app.get('/post/:postId', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    
    const post = await db.collection('feeds').findOne({ id: postId });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    res.json(post);
  } catch (error) {
    console.error('Post fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Get user's posts
app.get('/user/:userId/posts', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const posts = await db.collection('feeds')
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    res.json(posts);
  } catch (error) {
    console.error('User posts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user posts' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'feed-service' });
});

// Helper functions
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateAIScore(content: string): number {
  // Simple AI score calculation based on content length and keywords
  const lengthScore = Math.min(content.length / 100, 1) * 0.3;
  const engagementKeywords = ['!', '?', 'amazing', 'wow', 'incredible', 'must see'];
  const keywordScore = engagementKeywords.filter(keyword => 
    content.toLowerCase().includes(keyword)
  ).length * 0.1;
  
  return Math.min(lengthScore + keywordScore, 1);
}

// Start server
async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'feed-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received feed event:', event);
        
        // Handle feed events
        if (event.event === 'post_created') {
          // Invalidate relevant caches
          await redis.del(`feed:${event.data.userId}*`);
        }
      }
    }
  });
  
  app.listen(PORT, () => {
    console.log(`Feed Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start feed service:', error);
  process.exit(1);
});

export default app;
