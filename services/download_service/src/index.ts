import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import AWS from 'aws-sdk';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3015;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';

let db: Db;
const redis = new Redis(REDIS_URI);
const mongoClient = new MongoClient(MONGO_URI);

const kafka = new Kafka({
  clientId: 'download-service',
  brokers: KAFKA_BROKERS.split(','),
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: 'download-service-group' });

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

interface Download {
  id: string;
  userId: string;
  contentType: 'video' | 'music' | 'playlist';
  contentId: string;
  title: string;
  quality: 'low' | 'medium' | 'high';
  fileSize: number;
  downloadUrl: string;
  encrypted: boolean;
  encryptionKey?: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  localPath?: string;
  expiresAt?: Date;
  createdAt: Date;
  completedAt?: Date;
}

interface DownloadQueue {
  id: string;
  userId: string;
  downloads: string[];
  maxConcurrent: number;
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
}

interface StorageInfo {
  userId: string;
  usedSpace: number;
  maxSpace: number;
  downloadsCount: number;
  lastSync: Date;
}

async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('downloads');
  await db.createCollection('download_queues');
  await db.createCollection('storage_info');
  
  await db.createIndex('downloads', { userId: 1 });
  await db.createIndex('downloads', { contentId: 1 });
  await db.createIndex('downloads', { status: 1 });
  await db.createIndex('storage_info', { userId: 1 }, { unique: true });
  
  console.log('Download Service database initialized');
}

app.post('/downloads', async (req: Request, res: Response) => {
  try {
    const { userId, contentType, contentId, title, quality, sourceUrl } = req.body;
    
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    
    const download: Download = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      contentType,
      contentId,
      title,
      quality: quality || 'medium',
      fileSize: 0,
      downloadUrl: '',
      encrypted: true,
      encryptionKey,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };
    
    await db.collection('downloads').insertOne(download);
    
    processDownload(download, sourceUrl);
    
    await producer.send({
      topic: 'download-events',
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'download_started',
          downloadId: download.id,
          userId,
          contentId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(download);
  } catch (error) {
    console.error('Create download error:', error);
    res.status(500).json({ error: 'Failed to create download' });
  }
});

async function processDownload(download: Download, sourceUrl: string) {
  try {
    await db.collection('downloads').updateOne(
      { id: download.id },
      { $set: { status: 'downloading', progress: 10 } }
    );
    
    const encryptedData = encryptData(sourceUrl, download.encryptionKey!);
    
    const key = `downloads/${download.userId}/${download.id}`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET || 'nexora-downloads',
      Key: key,
      Body: encryptedData,
      ContentType: 'application/octet-stream',
    }).promise();
    
    const headObject = await s3.headObject({
      Bucket: process.env.S3_BUCKET || 'nexora-downloads',
      Key: key,
    }).promise();
    
    await db.collection('downloads').updateOne(
      { id: download.id },
      {
        $set: {
          status: 'completed',
          progress: 100,
          downloadUrl: `https://${process.env.S3_BUCKET || 'nexora-downloads'}.s3.amazonaws.com/${key}`,
          fileSize: headObject.ContentLength || 0,
          completedAt: new Date(),
        },
      }
    );
    
    await updateStorageInfo(download.userId, headObject.ContentLength || 0);
    
    await producer.send({
      topic: 'download-events',
      messages: [{
        key: download.userId,
        value: JSON.stringify({
          type: 'download_completed',
          downloadId: download.id,
          userId: download.userId,
          contentId: download.contentId,
          timestamp: new Date(),
        }),
      }],
    });
  } catch (error) {
    console.error('Process download error:', error);
    await db.collection('downloads').updateOne(
      { id: download.id },
      { $set: { status: 'failed' } }
    );
  }
}

function encryptData(data: string, key: string): Buffer {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return Buffer.from(iv.toString('hex') + encrypted, 'hex');
}

function decryptData(encryptedData: Buffer, key: string): string {
  const hex = encryptedData.toString('hex');
  const iv = Buffer.from(hex.substring(0, 32), 'hex');
  const encrypted = hex.substring(32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function updateStorageInfo(userId: string, fileSize: number) {
  const storageInfo = await db.collection('storage_info').findOne({ userId });
  
  if (storageInfo) {
    await db.collection('storage_info').updateOne(
      { userId },
      {
        $inc: {
          usedSpace: fileSize,
          downloadsCount: 1,
        },
        $set: { lastSync: new Date() },
      }
    );
  } else {
    await db.collection('storage_info').insertOne({
      userId,
      usedSpace: fileSize,
      maxSpace: 10 * 1024 * 1024 * 1024,
      downloadsCount: 1,
      lastSync: new Date(),
    });
  }
}

app.get('/downloads/:downloadId', async (req: Request, res: Response) => {
  try {
    const { downloadId } = req.params;
    
    const download = await db.collection('downloads').findOne({ id: downloadId });
    
    if (!download) {
      return res.status(404).json({ error: 'Download not found' });
    }
    
    res.json(download);
  } catch (error) {
    console.error('Get download error:', error);
    res.status(500).json({ error: 'Failed to fetch download' });
  }
});

app.get('/downloads/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { contentType, status } = req.query;
    
    const query: any = { userId };
    if (contentType) query.contentType = contentType;
    if (status) query.status = status;
    
    const downloads = await db.collection('downloads')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(downloads);
  } catch (error) {
    console.error('Get user downloads error:', error);
    res.status(500).json({ error: 'Failed to fetch downloads' });
  }
});

app.delete('/downloads/:downloadId', async (req: Request, res: Response) => {
  try {
    const { downloadId } = req.params;
    
    const download = await db.collection('downloads').findOne({ id: downloadId });
    
    if (download) {
      const key = `downloads/${download.userId}/${download.id}`;
      await s3.deleteObject({
        Bucket: process.env.S3_BUCKET || 'nexora-downloads',
        Key: key,
      }).promise();
      
      await updateStorageInfo(download.userId, -download.fileSize);
    }
    
    await db.collection('downloads').deleteOne({ id: downloadId });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete download error:', error);
    res.status(500).json({ error: 'Failed to delete download' });
  }
});

app.get('/storage/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const storageInfo = await db.collection('storage_info').findOne({ userId });
    
    if (!storageInfo) {
      return res.json({
        usedSpace: 0,
        maxSpace: 10 * 1024 * 1024 * 1024,
        downloadsCount: 0,
        availableSpace: 10 * 1024 * 1024 * 1024,
      });
    }
    
    res.json({
      ...storageInfo,
      availableSpace: storageInfo.maxSpace - storageInfo.usedSpace,
    });
  } catch (error) {
    console.error('Get storage info error:', error);
    res.status(500).json({ error: 'Failed to fetch storage info' });
  }
});

app.post('/downloads/sync', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    const downloads = await db.collection('downloads')
      .find({ userId, status: 'completed' })
      .toArray();
    
    await producer.send({
      topic: 'download-events',
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'sync_requested',
          userId,
          downloads: downloads.map(d => d.id),
          timestamp: new Date(),
        }),
      }],
    });
    
    res.json({ success: true, syncedCount: downloads.length });
  } catch (error) {
    console.error('Sync downloads error:', error);
    res.status(500).json({ error: 'Failed to sync downloads' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'download-service' });
});

async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'download-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received download event:', event);
      }
    },
  });
  
  app.listen(PORT, () => {
    console.log(`Download Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start Download Service:', error);
});
