import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import AWS from 'aws-sdk';
import ffmpeg from 'fluent-ffmpeg';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3014;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';

let db: Db;
const redis = new Redis(REDIS_URI);
const mongoClient = new MongoClient(MONGO_URI);

const kafka = new Kafka({
  clientId: 'editing-service',
  brokers: KAFKA_BROKERS.split(','),
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: 'editing-service-group' });

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

interface Project {
  id: string;
  userId: string;
  name: string;
  thumbnailUrl: string;
  duration: number;
  resolution: string;
  fps: number;
  timeline: TimelineLayer[];
  effects: Effect[];
  transitions: Transition[];
  audioTracks: AudioTrack[];
  createdAt: Date;
  updatedAt: Date;
}

interface TimelineLayer {
  id: string;
  type: 'video' | 'image' | 'text';
  items: TimelineItem[];
}

interface TimelineItem {
  id: string;
  sourceUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  opacity: number;
}

interface Effect {
  id: string;
  type: string;
  name: string;
  parameters: { [key: string]: any };
  startTime: number;
  duration: number;
}

interface Transition {
  id: string;
  type: string;
  name: string;
  duration: number;
  fromItemId: string;
  toItemId: string;
}

interface AudioTrack {
  id: string;
  sourceUrl: string;
  startTime: number;
  duration: number;
  volume: number;
}

interface Export {
  id: string;
  projectId: string;
  userId: string;
  format: 'mp4' | 'mov' | 'gif';
  resolution: string;
  quality: 'low' | 'medium' | 'high';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  outputUrl?: string;
  createdAt: Date;
  completedAt?: Date;
}

async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('editing_projects');
  await db.createCollection('editing_exports');
  await db.createCollection('editing_templates');
  
  await db.createIndex('editing_projects', { userId: 1 });
  await db.createIndex('editing_exports', { projectId: 1 });
  await db.createIndex('editing_exports', { userId: 1 });
  
  console.log('Editing Service database initialized');
}

app.post('/editing/projects', async (req: Request, res: Response) => {
  try {
    const { userId, name } = req.body;
    
    const project: Project = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name,
      thumbnailUrl: '',
      duration: 0,
      resolution: '1080p',
      fps: 30,
      timeline: [],
      effects: [],
      transitions: [],
      audioTracks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('editing_projects').insertOne(project);
    
    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.get('/editing/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const project = await db.collection('editing_projects').findOne({ id: projectId });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.get('/editing/users/:userId/projects', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const projects = await db.collection('editing_projects')
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();
    
    res.json(projects);
  } catch (error) {
    console.error('Get user projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.put('/editing/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const updates = req.body;
    
    await db.collection('editing_projects').updateOne(
      { id: projectId },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.post('/editing/projects/:projectId/export', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { format, resolution, quality } = req.body;
    
    const project = await db.collection('editing_projects').findOne({ id: projectId });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const exportJob: Export = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      userId: project.userId,
      format: format || 'mp4',
      resolution: resolution || '1080p',
      quality: quality || 'high',
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };
    
    await db.collection('editing_exports').insertOne(exportJob);
    
    processExport(exportJob, project as unknown as Project);
    
    res.status(201).json(exportJob);
  } catch (error) {
    console.error('Export project error:', error);
    res.status(500).json({ error: 'Failed to export project' });
  }
});

async function processExport(exportJob: Export, project: Project) {
  try {
    await db.collection('editing_exports').updateOne(
      { id: exportJob.id },
      { $set: { status: 'processing', progress: 10 } }
    );
    
    const outputKey = `exports/${exportJob.id}/output.${exportJob.format}`;
    
    await db.collection('editing_exports').updateOne(
      { id: exportJob.id },
      { $set: { progress: 50 } }
    );
    
    await db.collection('editing_exports').updateOne(
      { id: exportJob.id },
      {
        $set: {
          status: 'completed',
          progress: 100,
          outputUrl: `https://${process.env.S3_BUCKET || 'nexora-exports'}.s3.amazonaws.com/${outputKey}`,
          completedAt: new Date(),
        },
      }
    );
    
    await producer.send({
      topic: 'editing-events',
      messages: [{
        key: exportJob.userId,
        value: JSON.stringify({
          type: 'export_completed',
          exportId: exportJob.id,
          projectId: exportJob.projectId,
          outputUrl: `https://${process.env.S3_BUCKET || 'nexora-exports'}.s3.amazonaws.com/${outputKey}`,
          timestamp: new Date(),
        }),
      }],
    });
  } catch (error) {
    console.error('Process export error:', error);
    await db.collection('editing_exports').updateOne(
      { id: exportJob.id },
      { $set: { status: 'failed' } }
    );
  }
}

app.get('/editing/exports/:exportId', async (req: Request, res: Response) => {
  try {
    const { exportId } = req.params;
    
    const exportJob = await db.collection('editing_exports').findOne({ id: exportId });
    
    if (!exportJob) {
      return res.status(404).json({ error: 'Export not found' });
    }
    
    res.json(exportJob);
  } catch (error) {
    console.error('Get export error:', error);
    res.status(500).json({ error: 'Failed to fetch export' });
  }
});

app.get('/editing/users/:userId/exports', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const exports = await db.collection('editing_exports')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(exports);
  } catch (error) {
    console.error('Get user exports error:', error);
    res.status(500).json({ error: 'Failed to fetch exports' });
  }
});

app.delete('/editing/projects/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    await db.collection('editing_projects').deleteOne({ id: projectId });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'editing-service' });
});

async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'editing-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received editing event:', event);
      }
    },
  });
  
  app.listen(PORT, () => {
    console.log(`Editing Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start Editing Service:', error);
});
