import express from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3007;
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];

let db: Db;
let redis: Redis;
let kafka: Kafka;
let producer: Producer;
let consumer: Consumer;

// Firebase Admin initialization
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function initializeDatabase() {
  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  db = client.db('nexora');
  console.log('Connected to MongoDB');

  await db.collection('notifications').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('notifications').createIndex({ isRead: 1 });
}

async function initializeRedis() {
  redis = new Redis(REDIS_URL);
  console.log('Connected to Redis');
}

async function initializeKafka() {
  kafka = new Kafka({
    clientId: 'notification-service',
    brokers: KAFKA_BROKERS,
  });

  producer = kafka.producer();
  await producer.connect();
  console.log('Kafka producer connected');

  consumer = kafka.consumer({ groupId: 'notification-service' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'user-events', fromBeginning: false });
  await consumer.subscribe({ topic: 'content-events', fromBeginning: false });
  await consumer.subscribe({ topic: 'social-events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value?.toString() || '{}');
      await handleEvent(topic, event);
    },
  });

  console.log('Kafka consumer connected');
}

async function handleEvent(topic: string, event: any) {
  try {
    switch (topic) {
      case 'user-events':
        await handleUserEvent(event);
        break;
      case 'content-events':
        await handleContentEvent(event);
        break;
      case 'social-events':
        await handleSocialEvent(event);
        break;
    }
  } catch (error) {
    console.error('Error handling event:', error);
  }
}

async function handleUserEvent(event: any) {
  if (event.type === 'user_registered') {
    await sendWelcomeEmail(event.data);
    await createNotification({
      userId: event.data.id,
      type: 'welcome',
      title: 'Welcome to Nexora!',
      content: 'Thanks for joining Nexora. Start exploring and connecting with others!',
      data: event.data,
    });
  }
}

async function handleContentEvent(event: any) {
  if (event.type === 'post_created' || event.type === 'livestream_started') {
    const followers = await getFollowers(event.data.userId);
    for (const follower of followers) {
      await createNotification({
        userId: follower.id,
        type: event.type === 'post_created' ? 'new_post' : 'livestream',
        title: event.data.username + (event.type === 'post_created' ? ' posted something new' : ' is now live'),
        content: event.data.content || event.data.title,
        data: event.data,
      });
    }
  }
}

async function handleSocialEvent(event: any) {
  if (event.type === 'follow') {
    await createNotification({
      userId: event.data.followingId,
      type: 'follow',
      title: event.data.followerUsername + ' followed you',
      content: 'You have a new follower!',
      data: event.data,
    });
  } else if (event.type === 'like' || event.type === 'comment') {
    await createNotification({
      userId: event.data.recipientId,
      type: event.type,
      title: event.data.username + (event.type === 'like' ? ' liked your post' : ' commented on your post'),
      content: event.data.content || '',
      data: event.data,
    });
  }
}

async function getFollowers(userId: string): Promise<any[]> {
  const cacheKey = `followers:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const followers = await db.collection('follows')
    .find({ followingId: userId })
    .toArray();

  await redis.setex(cacheKey, 300, JSON.stringify(followers));
  return followers;
}

async function createNotification(notification: any) {
  const doc = {
    id: generateId(),
    ...notification,
    createdAt: new Date(),
    isRead: false,
  };

  await db.collection('notifications').insertOne(doc);

  // Send push notification if user has device tokens
  await sendPushNotification(notification.userId, notification);

  // Invalidate cache
  await redis.del(`notifications:${notification.userId}`);
}

async function sendPushNotification(userId: string, notification: any) {
  if (!serviceAccount) return;

  const user = await db.collection('users').findOne({ id: userId });
  if (!user?.deviceTokens) return;

  const message = {
    notification: {
      title: notification.title,
      body: notification.content,
    },
    tokens: user.deviceTokens,
  };

  try {
    await admin.messaging().sendMulticast(message);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

async function sendWelcomeEmail(user: any) {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@nexora.com',
    to: user.email,
    subject: 'Welcome to Nexora!',
    html: `
      <h1>Welcome to Nexora, ${user.username}!</h1>
      <p>Thanks for joining our community. We're excited to have you on board.</p>
      <p>Start exploring and connecting with others today!</p>
      <p>Best regards,<br>The Nexora Team</p>
    `,
  };

  try {
    await emailTransporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification-service' });
});

app.get('/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const cacheKey = `notifications:${userId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const notifications = await db.collection('notifications')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .toArray();

    await redis.setex(cacheKey, 60, JSON.stringify(notifications));
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/notifications/:userId/read', async (req, res) => {
  try {
    const { userId } = req.params;
    const { notificationId } = req.body;

    await db.collection('notifications').updateOne(
      { id: notificationId, userId },
      { $set: { isRead: true, readAt: new Date() } }
    );

    await redis.del(`notifications:${userId}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.post('/notifications/:userId/read-all', async (req, res) => {
  try {
    const { userId } = req.params;

    await db.collection('notifications').updateMany(
      { userId, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    await redis.del(`notifications:${userId}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

app.post('/notifications/send', async (req, res) => {
  try {
    const { userIds, type, title, content, data } = req.body;

    for (const userId of userIds) {
      await createNotification({ userId, type, title, content, data });
    }

    res.json({ success: true, count: userIds.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

app.post('/notifications/register-device', async (req, res) => {
  try {
    const { userId, deviceToken } = req.body;

    await db.collection('users').updateOne(
      { id: userId },
      { $addToSet: { deviceTokens: deviceToken } },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register device' });
  }
});

app.delete('/notifications/unregister-device', async (req, res) => {
  try {
    const { userId, deviceToken } = req.body;

    await db.collection('users').updateOne(
      { id: userId },
      { $pull: { deviceTokens: deviceToken } }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unregister device' });
  }
});

async function start() {
  try {
    await initializeDatabase();
    await initializeRedis();
    await initializeKafka();

    app.listen(PORT, () => {
      console.log(`Notification Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

start();
