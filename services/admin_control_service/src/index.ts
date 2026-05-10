import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3013;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';

let db: Db;
const redis = new Redis(REDIS_URI);
const mongoClient = new MongoClient(MONGO_URI);

const kafka = new Kafka({
  clientId: 'admin-control-service',
  brokers: KAFKA_BROKERS.split(','),
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: 'admin-control-service-group' });

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  targetUsers?: string[];
  targetSegments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface SystemConfig {
  id: string;
  key: string;
  value: any;
  category: string;
  description: string;
  updatedAt: Date;
  updatedBy: string;
}

interface ScalingRule {
  id: string;
  serviceName: string;
  metric: string;
  threshold: number;
  action: 'scale_up' | 'scale_down';
  targetInstances: number;
  cooldownMinutes: number;
  isActive: boolean;
  createdAt: Date;
}

interface FraudMonitoring {
  id: string;
  type: string;
  description: string;
  threshold: number;
  action: string;
  isActive: boolean;
  createdAt: Date;
}

async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('feature_flags');
  await db.createCollection('system_configs');
  await db.createCollection('scaling_rules');
  await db.createCollection('fraud_monitoring');
  
  await db.createIndex('feature_flags', { name: 1 }, { unique: true });
  await db.createIndex('system_configs', { key: 1 }, { unique: true });
  await db.createIndex('scaling_rules', { serviceName: 1 });
  
  console.log('Admin Control Service database initialized');
}

app.post('/admin/feature-flags', async (req: Request, res: Response) => {
  try {
    const { name, description, isEnabled, rolloutPercentage, targetUsers, targetSegments } = req.body;
    
    const flag: FeatureFlag = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      isEnabled: isEnabled || false,
      rolloutPercentage: rolloutPercentage || 0,
      targetUsers,
      targetSegments,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('feature_flags').insertOne(flag);
    
    await redis.set(`feature_flag:${name}`, JSON.stringify(flag));
    
    await producer.send({
      topic: 'admin-events',
      messages: [{
        key: name,
        value: JSON.stringify({
          type: 'feature_flag_created',
          flagName: name,
          isEnabled,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(flag);
  } catch (error) {
    console.error('Create feature flag error:', error);
    res.status(500).json({ error: 'Failed to create feature flag' });
  }
});

app.get('/admin/feature-flags/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const cacheKey = `feature_flag:${name}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    const flag = await db.collection('feature_flags').findOne({ name });
    
    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }
    
    await redis.setex(cacheKey, 300, JSON.stringify(flag));
    res.json(flag);
  } catch (error) {
    console.error('Get feature flag error:', error);
    res.status(500).json({ error: 'Failed to fetch feature flag' });
  }
});

app.put('/admin/feature-flags/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const updates = req.body;
    
    await db.collection('feature_flags').updateOne(
      { name },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      }
    );
    
    const flag = await db.collection('feature_flags').findOne({ name });
    await redis.set(`feature_flag:${name}`, JSON.stringify(flag));
    
    await producer.send({
      topic: 'admin-events',
      messages: [{
        key: name,
        value: JSON.stringify({
          type: 'feature_flag_updated',
          flagName: name,
          updates,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update feature flag error:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

app.get('/admin/feature-flags', async (req: Request, res: Response) => {
  try {
    const flags = await db.collection('feature_flags').find().toArray();
    
    res.json(flags);
  } catch (error) {
    console.error('Get feature flags error:', error);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

app.post('/admin/configs', async (req: Request, res: Response) => {
  try {
    const { key, value, category, description, updatedBy } = req.body;
    
    const config: SystemConfig = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      key,
      value,
      category,
      description,
      updatedAt: new Date(),
      updatedBy,
    };
    
    await db.collection('system_configs').insertOne(config);
    
    await redis.set(`config:${key}`, JSON.stringify(value));
    
    res.status(201).json(config);
  } catch (error) {
    console.error('Create config error:', error);
    res.status(500).json({ error: 'Failed to create config' });
  }
});

app.get('/admin/configs/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    
    const cacheKey = `config:${key}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    const config = await db.collection('system_configs').findOne({ key });
    
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }
    
    await redis.setex(cacheKey, 3600, JSON.stringify(config.value));
    res.json(config.value);
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

app.put('/admin/configs/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value, updatedBy } = req.body;
    
    await db.collection('system_configs').updateOne(
      { key },
      {
        $set: {
          value,
          updatedAt: new Date(),
          updatedBy,
        },
      }
    );
    
    await redis.set(`config:${key}`, JSON.stringify(value));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

app.post('/admin/scaling-rules', async (req: Request, res: Response) => {
  try {
    const { serviceName, metric, threshold, action, targetInstances, cooldownMinutes } = req.body;
    
    const rule: ScalingRule = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      serviceName,
      metric,
      threshold,
      action,
      targetInstances,
      cooldownMinutes,
      isActive: true,
      createdAt: new Date(),
    };
    
    await db.collection('scaling_rules').insertOne(rule);
    
    res.status(201).json(rule);
  } catch (error) {
    console.error('Create scaling rule error:', error);
    res.status(500).json({ error: 'Failed to create scaling rule' });
  }
});

app.get('/admin/scaling-rules/:serviceName', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    
    const rules = await db.collection('scaling_rules')
      .find({ serviceName, isActive: true })
      .toArray();
    
    res.json(rules);
  } catch (error) {
    console.error('Get scaling rules error:', error);
    res.status(500).json({ error: 'Failed to fetch scaling rules' });
  }
});

app.post('/admin/fraud-monitoring', async (req: Request, res: Response) => {
  try {
    const { type, description, threshold, action } = req.body;
    
    const monitoring: FraudMonitoring = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      threshold,
      action,
      isActive: true,
      createdAt: new Date(),
    };
    
    await db.collection('fraud_monitoring').insertOne(monitoring);
    
    res.status(201).json(monitoring);
  } catch (error) {
    console.error('Create fraud monitoring error:', error);
    res.status(500).json({ error: 'Failed to create fraud monitoring' });
  }
});

app.get('/admin/fraud-monitoring', async (req: Request, res: Response) => {
  try {
    const monitoring = await db.collection('fraud_monitoring')
      .find({ isActive: true })
      .toArray();
    
    res.json(monitoring);
  } catch (error) {
    console.error('Get fraud monitoring error:', error);
    res.status(500).json({ error: 'Failed to fetch fraud monitoring' });
  }
});

app.post('/admin/maintenance-mode', async (req: Request, res: Response) => {
  try {
    const { enabled, message, services } = req.body;
    
    await redis.set('maintenance_mode', JSON.stringify({
      enabled,
      message,
      services,
      updatedAt: new Date(),
    }));
    
    await producer.send({
      topic: 'admin-events',
      messages: [{
        key: 'maintenance_mode',
        value: JSON.stringify({
          type: 'maintenance_mode_changed',
          enabled,
          message,
          services,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Set maintenance mode error:', error);
    res.status(500).json({ error: 'Failed to set maintenance mode' });
  }
});

app.get('/admin/maintenance-mode', async (req: Request, res: Response) => {
  try {
    const maintenance = await redis.get('maintenance_mode');
    
    if (!maintenance) {
      return res.json({ enabled: false });
    }
    
    res.json(JSON.parse(maintenance));
  } catch (error) {
    console.error('Get maintenance mode error:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance mode' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'admin-control-service' });
});

async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'admin-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received admin event:', event);
      }
    },
  });
  
  app.listen(PORT, () => {
    console.log(`Admin Control Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start Admin Control Service:', error);
});
