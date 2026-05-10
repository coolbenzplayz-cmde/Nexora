import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import Stripe from 'stripe';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3009;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

let db: Db;
const redis = new Redis(REDIS_URI);
const mongoClient = new MongoClient(MONGO_URI);
const stripe = new Stripe(STRIPE_SECRET_KEY);

const kafka = new Kafka({
  clientId: 'creator-service',
  brokers: KAFKA_BROKERS.split(','),
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: 'creator-service-group' });

interface CreatorProfile {
  id: string;
  userId: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  category: string;
  verified: boolean;
  subscribers: number;
  totalRevenue: number;
  subscriptionPrice: number;
  monetizationEnabled: boolean;
  tier: 'free' | 'premium' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

interface Sponsorship {
  id: string;
  creatorId: string;
  sponsorId: string;
  amount: number;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  message?: string;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
}

interface Payout {
  id: string;
  creatorId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  period: string;
  stripeTransferId?: string;
  createdAt: Date;
  completedAt?: Date;
}

interface Subscription {
  id: string;
  creatorId: string;
  subscriberId: string;
  status: 'active' | 'cancelled' | 'expired';
  tier: 'premium' | 'enterprise';
  stripeSubscriptionId: string;
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
}

async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('creator_profiles');
  await db.createCollection('sponsorships');
  await db.createCollection('payouts');
  await db.createCollection('subscriptions');
  
  await db.createIndex('creator_profiles', { userId: 1 }, { unique: true });
  await db.createIndex('creator_profiles', { category: 1 });
  await db.createIndex('sponsorships', { creatorId: 1 });
  await db.createIndex('sponsorships', { sponsorId: 1 });
  await db.createIndex('payouts', { creatorId: 1 });
  await db.createIndex('subscriptions', { creatorId: 1 });
  await db.createIndex('subscriptions', { subscriberId: 1 });
  
  console.log('Creator Service database initialized');
}

app.post('/creator/profiles', async (req: Request, res: Response) => {
  try {
    const { userId, displayName, bio, category } = req.body;
    
    const profile: CreatorProfile = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      displayName,
      bio,
      avatarUrl: '',
      bannerUrl: '',
      category,
      verified: false,
      subscribers: 0,
      totalRevenue: 0,
      subscriptionPrice: 9.99,
      monetizationEnabled: false,
      tier: 'free',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('creator_profiles').insertOne(profile);
    
    await producer.send({
      topic: 'creator-events',
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'profile_created',
          creatorId: profile.id,
          userId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(profile);
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

app.get('/creator/profiles/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const cacheKey = `creator_profile:${userId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    const profile = await db.collection('creator_profiles').findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    await redis.setex(cacheKey, 3600, JSON.stringify(profile));
    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/creator/profiles/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    await db.collection('creator_profiles').updateOne(
      { userId },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      }
    );
    
    await redis.del(`creator_profile:${userId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/creator/sponsorships', async (req: Request, res: Response) => {
  try {
    const { creatorId, sponsorId, amount, message } = req.body;
    
    const sponsorship: Sponsorship = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      creatorId,
      sponsorId,
      amount,
      status: 'pending',
      message,
      startDate: new Date(),
      createdAt: new Date(),
    };
    
    await db.collection('sponsorships').insertOne(sponsorship);
    
    await producer.send({
      topic: 'creator-events',
      messages: [{
        key: creatorId,
        value: JSON.stringify({
          type: 'sponsorship_requested',
          sponsorshipId: sponsorship.id,
          creatorId,
          sponsorId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(sponsorship);
  } catch (error) {
    console.error('Create sponsorship error:', error);
    res.status(500).json({ error: 'Failed to create sponsorship' });
  }
});

app.post('/creator/sponsorships/:sponsorshipId/accept', async (req: Request, res: Response) => {
  try {
    const { sponsorshipId } = req.params;
    
    await db.collection('sponsorships').updateOne(
      { id: sponsorshipId },
      { $set: { status: 'active' } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Accept sponsorship error:', error);
    res.status(500).json({ error: 'Failed to accept sponsorship' });
  }
});

app.post('/creator/subscribe', async (req: Request, res: Response) => {
  try {
    const { creatorId, subscriberId, tier } = req.body;
    
    const profile = await db.collection('creator_profiles').findOne({ userId: creatorId });
    
    const stripeProduct = await stripe.products.create({
      name: `${profile.displayName} - ${tier} subscription`,
    });
    
    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: tier === 'premium' ? 999 : 4999,
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    
    const stripeSubscription = await stripe.subscriptions.create({
      customer: subscriberId,
      items: [{ price: stripePrice.id }],
    });
    
    const subscription: Subscription = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      creatorId,
      subscriberId,
      status: 'active',
      tier,
      stripeSubscriptionId: stripeSubscription.id,
      startDate: new Date(),
      createdAt: new Date(),
    };
    
    await db.collection('subscriptions').insertOne(subscription);
    await db.collection('creator_profiles').updateOne(
      { userId: creatorId },
      { $inc: { subscribers: 1 } }
    );
    
    await producer.send({
      topic: 'creator-events',
      messages: [{
        key: creatorId,
        value: JSON.stringify({
          type: 'subscription_created',
          subscriptionId: subscription.id,
          creatorId,
          subscriberId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(subscription);
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

app.get('/creator/:creatorId/subscriptions', async (req: Request, res: Response) => {
  try {
    const { creatorId } = req.params;
    
    const subscriptions = await db.collection('subscriptions')
      .find({ creatorId, status: 'active' })
      .toArray();
    
    res.json(subscriptions);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

app.post('/creator/payouts', async (req: Request, res: Response) => {
  try {
    const { creatorId, amount, period } = req.body;
    
    const payout: Payout = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      creatorId,
      amount,
      status: 'pending',
      period,
      createdAt: new Date(),
    };
    
    await db.collection('payouts').insertOne(payout);
    
    res.status(201).json(payout);
  } catch (error) {
    console.error('Create payout error:', error);
    res.status(500).json({ error: 'Failed to create payout' });
  }
});

app.get('/creator/:creatorId/revenue', async (req: Request, res: Response) => {
  try {
    const { creatorId } = req.params;
    const { period = '30d' } = req.query;
    
    const startDate = new Date();
    if (period === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (period === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (period === '90d') startDate.setDate(startDate.getDate() - 90);
    
    const payouts = await db.collection('payouts')
      .find({
        creatorId,
        createdAt: { $gte: startDate },
      })
      .toArray();
    
    const totalRevenue = payouts.reduce((sum, p) => sum + p.amount, 0);
    
    res.json({ totalRevenue, payouts });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'creator-service' });
});

async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'creator-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received creator event:', event);
      }
    },
  });
  
  app.listen(PORT, () => {
    console.log(`Creator Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start Creator Service:', error);
});
