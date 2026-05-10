import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3012;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';

let db: Db;
const redis = new Redis(REDIS_URI);
const mongoClient = new MongoClient(MONGO_URI);

const kafka = new Kafka({
  clientId: 'moderation-service',
  brokers: KAFKA_BROKERS.split(','),
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: 'moderation-service-group' });

interface Report {
  id: string;
  reporterId: string;
  contentType: 'video' | 'music' | 'message' | 'comment' | 'livestream' | 'user';
  contentId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  actionTaken?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ModerationAction {
  id: string;
  targetId: string;
  targetType: 'user' | 'content';
  action: 'warning' | 'timeout' | 'suspend' | 'ban' | 'remove_content';
  reason: string;
  duration?: number;
  moderatorId: string;
  createdAt: Date;
  expiresAt?: Date;
}

interface Policy {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SpamDetection {
  id: string;
  userId: string;
  contentType: string;
  contentId: string;
  spamScore: number;
  flags: string[];
  action: 'none' | 'flag' | 'block' | 'remove';
  detectedAt: Date;
}

async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('reports');
  await db.createCollection('moderation_actions');
  await db.createCollection('policies');
  await db.createCollection('spam_detections');
  
  await db.createIndex('reports', { contentId: 1 });
  await db.createIndex('reports', { status: 1 });
  await db.createIndex('moderation_actions', { targetId: 1 });
  await db.createIndex('moderation_actions', { targetType: 1 });
  await db.createIndex('policies', { category: 1 });
  await db.createIndex('spam_detections', { userId: 1 });
  
  console.log('Moderation Service database initialized');
}

app.post('/moderation/reports', async (req: Request, res: Response) => {
  try {
    const { reporterId, contentType, contentId, reason, description } = req.body;
    
    const report: Report = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      reporterId,
      contentType,
      contentId,
      reason,
      description,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('reports').insertOne(report);
    
    await producer.send({
      topic: 'moderation-events',
      messages: [{
        key: report.id,
        value: JSON.stringify({
          type: 'report_created',
          reportId: report.id,
          contentId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(report);
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

app.get('/moderation/reports', async (req: Request, res: Response) => {
  try {
    const { status, contentType, limit = 50, offset = 0 } = req.query;
    
    const query: any = {};
    if (status) query.status = status;
    if (contentType) query.contentType = contentType;
    
    const reports = await db.collection('reports')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

app.put('/moderation/reports/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { status, actionTaken, reviewedBy } = req.body;
    
    await db.collection('reports').updateOne(
      { id: reportId },
      {
        $set: {
          status,
          actionTaken,
          reviewedBy,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

app.post('/moderation/actions', async (req: Request, res: Response) => {
  try {
    const { targetId, targetType, action, reason, duration, moderatorId } = req.body;
    
    const moderationAction: ModerationAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      targetId,
      targetType,
      action,
      reason,
      duration,
      moderatorId,
      createdAt: new Date(),
      expiresAt: duration ? new Date(Date.now() + duration * 1000) : undefined,
    };
    
    await db.collection('moderation_actions').insertOne(moderationAction);
    
    await producer.send({
      topic: 'moderation-events',
      messages: [{
        key: targetId,
        value: JSON.stringify({
          type: 'moderation_action',
          actionId: moderationAction.id,
          targetId,
          targetType,
          action,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(moderationAction);
  } catch (error) {
    console.error('Create action error:', error);
    res.status(500).json({ error: 'Failed to create action' });
  }
});

app.get('/moderation/actions/:targetId', async (req: Request, res: Response) => {
  try {
    const { targetId } = req.params;
    
    const actions = await db.collection('moderation_actions')
      .find({ targetId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(actions);
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

app.post('/moderation/policies', async (req: Request, res: Response) => {
  try {
    const { name, description, category, severity } = req.body;
    
    const policy: Policy = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      category,
      severity,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('policies').insertOne(policy);
    
    res.status(201).json(policy);
  } catch (error) {
    console.error('Create policy error:', error);
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

app.get('/moderation/policies', async (req: Request, res: Response) => {
  try {
    const policies = await db.collection('policies')
      .find({ isActive: true })
      .toArray();
    
    res.json(policies);
  } catch (error) {
    console.error('Get policies error:', error);
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
});

app.post('/moderation/spam-detect', async (req: Request, res: Response) => {
  try {
    const { userId, contentType, contentId, content } = req.body;
    
    let spamScore = 0;
    const flags: string[] = [];
    
    const spamKeywords = ['buy now', 'click here', 'free money', 'limited offer', 'act now'];
    for (const keyword of spamKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        spamScore += 20;
        flags.push(`spam_keyword: ${keyword}`);
      }
    }
    
    const excessiveCaps = (content.match(/[A-Z]/g) || []).length / content.length > 0.5;
    if (excessiveCaps) {
      spamScore += 15;
      flags.push('excessive_caps');
    }
    
    const excessiveLinks = (content.match(/http/g) || []).length > 3;
    if (excessiveLinks) {
      spamScore += 25;
      flags.push('excessive_links');
    }
    
    let action: 'none' | 'flag' | 'block' | 'remove' = 'none';
    if (spamScore >= 70) action = 'remove';
    else if (spamScore >= 50) action = 'block';
    else if (spamScore >= 30) action = 'flag';
    
    const detection: SpamDetection = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      contentType,
      contentId,
      spamScore,
      flags,
      action,
      detectedAt: new Date(),
    };
    
    await db.collection('spam_detections').insertOne(detection);
    
    if (action !== 'none') {
      await producer.send({
        topic: 'moderation-events',
        messages: [{
          key: contentId,
          value: JSON.stringify({
            type: 'spam_detected',
            detectionId: detection.id,
            userId,
            contentId,
            action,
            spamScore,
            timestamp: new Date(),
          }),
        }],
      });
    }
    
    res.json(detection);
  } catch (error) {
    console.error('Spam detection error:', error);
    res.status(500).json({ error: 'Failed to detect spam' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'moderation-service' });
});

async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'moderation-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received moderation event:', event);
      }
    },
  });
  
  app.listen(PORT, () => {
    console.log(`Moderation Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start Moderation Service:', error);
});
