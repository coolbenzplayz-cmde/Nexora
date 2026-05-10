import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe';
import ffprobeStatic from 'ffprobe-static';
import AWS from 'aws-sdk';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3007;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';

let db: Db;
const redis = new Redis(REDIS_URI);
const mongoClient = new MongoClient(MONGO_URI);

const kafka = new Kafka({
  clientId: 'video-service',
  brokers: KAFKA_BROKERS.split(','),
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: 'video-service-group' });

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const upload = multer({ storage: multer.memoryStorage() });

// Video Types
interface Video {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: 'short' | 'long';
  thumbnailUrl: string;
  videoUrl: string;
  duration: number;
  resolution: string;
  format: string;
  fileSize: number;
  tags: string[];
  category: string;
  visibility: 'public' | 'private' | 'unlisted';
  allowComments: boolean;
  allowDownloads: boolean;
  monetizationEnabled: boolean;
  views: number;
  likes: number;
  shares: number;
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: {
    [key: string]: any;
  };
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  bitrate: number;
  codec: string;
  format: string;
}

// Initialize database
async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('videos');
  await db.createCollection('video_views');
  await db.createCollection('video_likes');
  await db.createCollection('video_comments');
  await db.createIndex('videos', { userId: 1 });
  await db.createIndex('videos', { type: 1 });
  await db.createIndex('videos', { category: 1 });
  await db.createIndex('videos', { createdAt: -1 });
  await db.createIndex('videos', { views: -1 });
  await db.createIndex('video_likes', { videoId: 1, userId: 1 }, { unique: true });
  
  console.log('Video Service database initialized');
}

// Extract video metadata
async function extractVideoMetadata(videoBuffer: Buffer): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const tempPath = `/tmp/${Date.now()}.mp4`;
    require('fs').writeFileSync(tempPath, videoBuffer);
    
    ffprobe(tempPath, { path: ffprobeStatic.path }, (err, info) => {
      if (err) {
        reject(err);
        return;
      }
      
      const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
      resolve({
        duration: info.format.duration || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        bitrate: info.format.bit_rate || 0,
        codec: videoStream?.codec_name || 'unknown',
        format: info.format.format_name || 'unknown',
      });
      
      require('fs').unlinkSync(tempPath);
    });
  });
}

// Process video (transcode to multiple qualities)
async function processVideo(videoId: string, videoBuffer: Buffer): Promise<void> {
  try {
    const metadata = await extractVideoMetadata(videoBuffer);
    
    // Upload original to S3
    const originalKey = `videos/${videoId}/original.mp4`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET || 'nexora-videos',
      Key: originalKey,
      Body: videoBuffer,
      ContentType: 'video/mp4',
    }).promise();
    
    // Generate thumbnail
    const thumbnailBuffer = await generateThumbnail(videoBuffer);
    const thumbnailKey = `videos/${videoId}/thumbnail.jpg`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET || 'nexora-videos',
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
    }).promise();
    
    // Update video with metadata and URLs
    await db.collection('videos').updateOne(
      { id: videoId },
      {
        $set: {
          videoUrl: `https://${process.env.S3_BUCKET || 'nexora-videos'}.s3.amazonaws.com/${originalKey}`,
          thumbnailUrl: `https://${process.env.S3_BUCKET || 'nexora-videos'}.s3.amazonaws.com/${thumbnailKey}`,
          duration: metadata.duration,
          resolution: `${metadata.width}x${metadata.height}`,
          format: metadata.format,
          processingStatus: 'completed',
          metadata: metadata,
        },
      }
    );
    
    await redis.del(`video:${videoId}`);
    
    await producer.send({
      topic: 'video-events',
      messages: [{
        key: videoId,
        value: JSON.stringify({
          type: 'video_processed',
          videoId,
          metadata,
          timestamp: new Date(),
        }),
      }],
    });
  } catch (error) {
    console.error('Video processing error:', error);
    await db.collection('videos').updateOne(
      { id: videoId },
      { $set: { processingStatus: 'failed' } }
    );
  }
}

// Generate thumbnail from video
async function generateThumbnail(videoBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tempPath = `/tmp/${Date.now()}.mp4`;
    const outputPath = `/tmp/${Date.now()}.jpg`;
    require('fs').writeFileSync(tempPath, videoBuffer);
    
    ffmpeg(tempPath)
      .screenshots({
        timestamps: ['10%'],
        filename: outputPath,
        folder: '/tmp',
        size: '1280x720',
      })
      .on('end', () => {
        const thumbnail = require('fs').readFileSync(outputPath);
        require('fs').unlinkSync(tempPath);
        require('fs').unlinkSync(outputPath);
        resolve(thumbnail);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// Upload video
app.post('/videos/upload', upload.single('video'), async (req: Request, res: Response) => {
  try {
    const { userId, title, description, type, category, tags, visibility } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    
    const videoId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const video: Video = {
      id: videoId,
      userId,
      title,
      description,
      type: type || 'long',
      thumbnailUrl: '',
      videoUrl: '',
      duration: 0,
      resolution: '',
      format: '',
      fileSize: file.size,
      tags: tags ? tags.split(',') : [],
      category: category || 'general',
      visibility: visibility || 'public',
      allowComments: true,
      allowDownloads: true,
      monetizationEnabled: false,
      views: 0,
      likes: 0,
      shares: 0,
      commentsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      processingStatus: 'pending',
      metadata: {},
    };
    
    await db.collection('videos').insertOne(video);
    
    // Process video asynchronously
    processVideo(videoId, file.buffer);
    
    await producer.send({
      topic: 'video-events',
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'video_uploaded',
          videoId,
          userId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(video);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Get video by ID
app.get('/videos/:videoId', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    
    const cacheKey = `video:${videoId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    const video = await db.collection('videos').findOne({ id: videoId });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    await redis.setex(cacheKey, 3600, JSON.stringify(video));
    res.json(video);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Get videos by user
app.get('/users/:userId/videos', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { type, limit = 20, offset = 0 } = req.query;
    
    const query: any = { userId };
    if (type) query.type = type;
    
    const videos = await db.collection('videos')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    res.json(videos);
  } catch (error) {
    console.error('Get user videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get trending videos (user-controlled, not AI)
app.get('/videos/trending', async (req: Request, res: Response) => {
  try {
    const { category, timeRange = '24h', limit = 20 } = req.query;
    
    const cacheKey = `trending:${category || 'all'}:${timeRange}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    const timeAgo = new Date();
    if (timeRange === '24h') timeAgo.setHours(timeAgo.getHours() - 24);
    else if (timeRange === '7d') timeAgo.setDate(timeAgo.getDate() - 7);
    else if (timeRange === '30d') timeAgo.setDate(timeAgo.getDate() - 30);
    
    const query: any = {
      processingStatus: 'completed',
      visibility: 'public',
      publishedAt: { $gte: timeAgo },
    };
    if (category) query.category = category;
    
    const videos = await db.collection('videos')
      .find(query)
      .sort({ views: -1, likes: -1 })
      .limit(Number(limit))
      .toArray();
    
    await redis.setex(cacheKey, 300, JSON.stringify(videos));
    res.json(videos);
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ error: 'Failed to fetch trending videos' });
  }
});

// Record video view
app.post('/videos/:videoId/view', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.body;
    
    await db.collection('videos').updateOne(
      { id: videoId },
      { $inc: { views: 1 } }
    );
    
    await db.collection('video_views').insertOne({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      videoId,
      userId,
      timestamp: new Date(),
    });
    
    await redis.del(`video:${videoId}`);
    await redis.del(`trending:*`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('View error:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Like video
app.post('/videos/:videoId/like', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.body;
    
    const existing = await db.collection('video_likes').findOne({ videoId, userId });
    
    if (existing) {
      await db.collection('video_likes').deleteOne({ videoId, userId });
      await db.collection('videos').updateOne({ id: videoId }, { $inc: { likes: -1 } });
      res.json({ liked: false });
    } else {
      await db.collection('video_likes').insertOne({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        videoId,
        userId,
        timestamp: new Date(),
      });
      await db.collection('videos').updateOne({ id: videoId }, { $inc: { likes: 1 } });
      res.json({ liked: true });
    }
    
    await redis.del(`video:${videoId}`);
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to like video' });
  }
});

// Share video
app.post('/videos/:videoId/share', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    
    await db.collection('videos').updateOne(
      { id: videoId },
      { $inc: { shares: 1 } }
    );
    
    await redis.del(`video:${videoId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({ error: 'Failed to share video' });
  }
});

// Update video
app.put('/videos/:videoId', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const updates = req.body;
    
    await db.collection('videos').updateOne(
      { id: videoId },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      }
    );
    
    await redis.del(`video:${videoId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// Delete video
app.delete('/videos/:videoId', async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.body;
    
    await db.collection('videos').deleteOne({ id: videoId, userId });
    await db.collection('video_likes').deleteMany({ videoId });
    await db.collection('video_comments').deleteMany({ videoId });
    await db.collection('video_views').deleteMany({ videoId });
    
    await redis.del(`video:${videoId}`);
    
    await producer.send({
      topic: 'video-events',
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'video_deleted',
          videoId,
          userId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'video-service' });
});

// Start server
async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'video-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received video event:', event);
      }
    },
  });
  
  app.listen(PORT, () => {
    console.log(`Video Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start Video Service:', error);
});
