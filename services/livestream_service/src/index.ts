import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { Server as RTMPServer } from 'node-media-server';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

// MongoDB connection
const mongoClient = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017');
let db: Db;

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Kafka setup
const kafka = new Kafka({
  clientId: 'livestream-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'livestream-service-group' });

// RTMP Server for live streaming
const rtmpServer = new RTMPServer({
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*'
  },
  trans: {
    ffmpeg: '/usr/local/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
      }
    ]
  }
});

interface Livestream {
  id: string;
  streamKey: string;
  broadcasterId: string;
  title: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  status: 'preparing' | 'live' | 'ended' | 'error';
  viewerCount: number;
  likes: number;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  recordingUrl?: string;
  hlsUrl?: string;
  dashUrl?: string;
  rtmpUrl?: string;
  createdAt: Date;
}

interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
}

// Initialize database
async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('livestreams');
  await db.createCollection('stream_chat');
  await db.createIndex('livestreams', { broadcasterId: 1, createdAt: -1 });
  await db.createIndex('livestreams', { status: 1 });
  await db.createIndex('stream_chat', { streamId: 1, timestamp: -1 });
  
  console.log('Database initialized');
}

// Generate stream key
function generateStreamKey(): string {
  return `sk_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
}

// Start livestream
app.post('/livestream/start', async (req: Request, res: Response) => {
  try {
    const { broadcasterId, title, description, category, thumbnailUrl } = req.body;
    
    if (!broadcasterId || !title) {
      return res.status(400).json({ error: 'broadcasterId and title are required' });
    }
    
    const streamKey = generateStreamKey();
    const livestream: Livestream = {
      id: generateId(),
      streamKey,
      broadcasterId,
      title,
      description,
      category,
      thumbnailUrl,
      status: 'preparing',
      viewerCount: 0,
      likes: 0,
      rtmpUrl: `rtmp://localhost:1935/live/${streamKey}`,
      hlsUrl: `http://localhost:8000/live/${streamKey}/index.m3u8`,
      dashUrl: `http://localhost:8000/live/${streamKey}/index.mpd`,
      createdAt: new Date()
    };
    
    await db.collection('livestreams').insertOne(livestream);
    
    // Publish to Kafka
    await producer.send({
      topic: 'livestream-events',
      messages: [{
        key: livestream.id,
        value: JSON.stringify({
          event: 'stream_created',
          data: livestream
        })
      }]
    });
    
    res.status(201).json(livestream);
  } catch (error) {
    console.error('Start livestream error:', error);
    res.status(500).json({ error: 'Failed to start livestream' });
  }
});

// Update stream status
app.put('/livestream/:streamId/status', async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;
    const { status } = req.body;
    
    if (!['preparing', 'live', 'ended', 'error'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const updateData: any = { status };
    
    if (status === 'live') {
      updateData.startTime = new Date();
    } else if (status === 'ended') {
      updateData.endTime = new Date();
      updateData.duration = updateData.endTime - (new Date());
    }
    
    const result = await db.collection('livestreams').updateOne(
      { id: streamId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    // Publish to Kafka
    await producer.send({
      topic: 'livestream-events',
      messages: [{
        key: streamId,
        value: JSON.stringify({
          event: 'stream_status_changed',
          data: { streamId, status }
        })
      }]
    });
    
    res.json({ message: 'Status updated' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get active streams
app.get('/livestreams/active', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'active_livestreams';
    const cachedStreams = await redis.get(cacheKey);
    
    if (cachedStreams) {
      return res.json(JSON.parse(cachedStreams));
    }
    
    const streams = await db.collection('livestreams')
      .find({ status: 'live' })
      .sort({ viewerCount: -1 })
      .toArray();
    
    await redis.setex(cacheKey, 30, JSON.stringify(streams));
    
    res.json(streams);
  } catch (error) {
    console.error('Get active streams error:', error);
    res.status(500).json({ error: 'Failed to fetch active streams' });
  }
});

// Get stream by ID
app.get('/livestream/:streamId', async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;
    
    const stream = await db.collection('livestreams').findOne({ id: streamId });
    
    if (!stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    
    res.json(stream);
  } catch (error) {
    console.error('Get stream error:', error);
    res.status(500).json({ error: 'Failed to fetch stream' });
  }
});

// Get user's streams
app.get('/livestreams/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const streams = await db.collection('livestreams')
      .find({ broadcasterId: userId })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    res.json(streams);
  } catch (error) {
    console.error('Get user streams error:', error);
    res.status(500).json({ error: 'Failed to fetch user streams' });
  }
});

// Update viewer count
app.post('/livestream/:streamId/viewers', async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;
    const { change } = req.body;
    
    await db.collection('livestreams').updateOne(
      { id: streamId },
      { $inc: { viewerCount: change || 1 } }
    );
    
    // Invalidate cache
    await redis.del('active_livestreams');
    
    res.json({ message: 'Viewer count updated' });
  } catch (error) {
    console.error('Update viewers error:', error);
    res.status(500).json({ error: 'Failed to update viewer count' });
  }
});

// Like stream
app.post('/livestream/:streamId/like', async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;
    
    await db.collection('livestreams').updateOne(
      { id: streamId },
      { $inc: { likes: 1 } }
    );
    
    res.json({ message: 'Stream liked' });
  } catch (error) {
    console.error('Like stream error:', error);
    res.status(500).json({ error: 'Failed to like stream' });
  }
});

// Send chat message
app.post('/livestream/:streamId/chat', async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;
    const { userId, username, content } = req.body;
    
    if (!userId || !username || !content) {
      return res.status(400).json({ error: 'userId, username, and content are required' });
    }
    
    const chatMessage: ChatMessage = {
      id: generateId(),
      streamId,
      userId,
      username,
      content,
      timestamp: new Date()
    };
    
    await db.collection('stream_chat').insertOne(chatMessage);
    
    // Publish to Kafka for real-time distribution
    await producer.send({
      topic: 'stream-chat',
      messages: [{
        key: streamId,
        value: JSON.stringify(chatMessage)
      }]
    });
    
    res.status(201).json(chatMessage);
  } catch (error) {
    console.error('Send chat error:', error);
    res.status(500).json({ error: 'Failed to send chat message' });
  }
});

// Get stream chat
app.get('/livestream/:streamId/chat', async (req: Request, res: Response) => {
  try {
    const { streamId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const messages = await db.collection('stream_chat')
      .find({ streamId })
      .sort({ timestamp: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Get trending streams
app.get('/livestreams/trending', async (req: Request, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    
    const cacheKey = `trending_streams:${limit}`;
    const cachedStreams = await redis.get(cacheKey);
    
    if (cachedStreams) {
      return res.json(JSON.parse(cachedStreams));
    }
    
    const streams = await db.collection('livestreams')
      .find({ status: 'live' })
      .sort({ viewerCount: -1, likes: -1 })
      .limit(Number(limit))
      .toArray();
    
    await redis.setex(cacheKey, 60, JSON.stringify(streams));
    
    res.json(streams);
  } catch (error) {
    console.error('Get trending streams error:', error);
    res.status(500).json({ error: 'Failed to fetch trending streams' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'livestream-service' });
});

// Helper functions
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// RTMP Server events
rtmpServer.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

rtmpServer.on('publish', (id, StreamPath, args) => {
  console.log('[NodeEvent on publish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

rtmpServer.on('done', (id, StreamPath, args) => {
  console.log('[NodeEvent on done]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

// Start server
async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'livestream-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received livestream event:', event);
      }
    }
  });
  
  // Start RTMP server
  rtmpServer.run();
  
  app.listen(PORT, () => {
    console.log(`Livestream Service running on port ${PORT}`);
    console.log(`RTMP Server running on port 1935`);
    console.log(`HTTP-FLV Server running on port 8000`);
  });
}

start().catch(error => {
  console.error('Failed to start livestream service:', error);
  process.exit(1);
});

export default app;
