import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// MongoDB connection
const mongoClient = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017');
let db: Db;

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Kafka setup
const kafka = new Kafka({
  clientId: 'user-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'user-service-group' });

interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  followers: number;
  following: number;
  isVerified: boolean;
  isCreator: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface UserProfile {
  userId: string;
  location?: string;
  website?: string;
  birthDate?: Date;
  gender?: string;
  interests?: string[];
  languages?: string[];
}

interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

interface Device {
  id: string;
  userId: string;
  type: 'mobile' | 'tablet' | 'desktop' | 'tv';
  os: string;
  browser?: string;
  appVersion?: string;
  lastActive: Date;
  isActive: boolean;
  pushToken?: string;
  metadata: {
    [key: string]: any;
  };
}

// Initialize database
async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('users');
  await db.createCollection('user_profiles');
  await db.createCollection('follows');
  await db.createIndex('users', { username: 1 }, { unique: true });
  await db.createIndex('users', { email: 1 }, { unique: true });
  await db.createIndex('follows', { followerId: 1, followingId: 1 }, { unique: true });
  await db.createIndex('follows', { followingId: 1 });
  await db.createIndex('follows', { followerId: 1 });
  
  console.log('Database initialized');
}

// Get user by ID
app.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const cacheKey = `user:${userId}`;
    const cachedUser = await redis.get(cacheKey);
    
    if (cachedUser) {
      return res.json(JSON.parse(cachedUser));
    }
    
    const user = await db.collection('users').findOne({ id: userId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await redis.setex(cacheKey, 3600, JSON.stringify(user));
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get user by username
app.get('/users/username/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    
    const user = await db.collection('users').findOne({ username });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user by username error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
app.put('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { displayName, bio, avatar } = req.body;
    
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (displayName) updateData.displayName = displayName;
    if (bio) updateData.bio = bio;
    if (avatar) updateData.avatar = avatar;
    
    const result = await db.collection('users').updateOne(
      { id: userId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Invalidate cache
    await redis.del(`user:${userId}`);
    
    // Publish to Kafka
    await producer.send({
      topic: 'user-events',
      messages: [{
        key: userId,
        value: JSON.stringify({
          event: 'user_updated',
          data: { userId, updateData }
        })
      }]
    });
    
    res.json({ message: 'User updated' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Follow user
app.post('/users/:userId/follow', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { followerId } = req.body;
    
    if (!followerId) {
      return res.status(400).json({ error: 'followerId is required' });
    }
    
    if (followerId === userId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    const follow: Follow = {
      id: generateId(),
      followerId,
      followingId: userId,
      createdAt: new Date()
    };
    
    await db.collection('follows').insertOne(follow);
    
    // Update follower/following counts
    await db.collection('users').updateOne(
      { id: userId },
      { $inc: { followers: 1 } }
    );
    
    await db.collection('users').updateOne(
      { id: followerId },
      { $inc: { following: 1 } }
    );
    
    // Invalidate caches
    await redis.del(`user:${userId}`);
    await redis.del(`user:${followerId}`);
    
    // Publish to Kafka
    await producer.send({
      topic: 'social-events',
      messages: [{
        key: follow.id,
        value: JSON.stringify({
          event: 'user_followed',
          data: follow
        })
      }]
    });
    
    res.status(201).json(follow);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Already following' });
    }
    console.error('Follow user error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow user
app.delete('/users/:userId/follow', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { followerId } = req.body;
    
    if (!followerId) {
      return res.status(400).json({ error: 'followerId is required' });
    }
    
    const result = await db.collection('follows').deleteOne({
      followerId,
      followingId: userId
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Follow relationship not found' });
    }
    
    // Update follower/following counts
    await db.collection('users').updateOne(
      { id: userId },
      { $inc: { followers: -1 } }
    );
    
    await db.collection('users').updateOne(
      { id: followerId },
      { $inc: { following: -1 } }
    );
    
    // Invalidate caches
    await redis.del(`user:${userId}`);
    await redis.del(`user:${followerId}`);
    
    // Publish to Kafka
    await producer.send({
      topic: 'social-events',
      messages: [{
        key: `${followerId}:${userId}`,
        value: JSON.stringify({
          event: 'user_unfollowed',
          data: { followerId, followingId: userId }
        })
      }]
    });
    
    res.json({ message: 'Unfollowed successfully' });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get user's followers
app.get('/users/:userId/followers', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const follows = await db.collection('follows')
      .find({ followingId: userId })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    const followerIds = follows.map(f => f.followerId);
    const users = await db.collection('users')
      .find({ id: { $in: followerIds } })
      .toArray();
    
    res.json(users);
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get user's following
app.get('/users/:userId/following', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const follows = await db.collection('follows')
      .find({ followerId: userId })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    const followingIds = follows.map(f => f.followingId);
    const users = await db.collection('users')
      .find({ id: { $in: followingIds } })
      .toArray();
    
    res.json(users);
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// Search users
app.get('/users/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const cacheKey = `user_search:${q}:${limit}`;
    const cachedResults = await redis.get(cacheKey);
    
    if (cachedResults) {
      return res.json(JSON.parse(cachedResults));
    }
    
    const users = await db.collection('users')
      .find({
        $or: [
          { username: { $regex: q as string, $options: 'i' } },
          { displayName: { $regex: q as string, $options: 'i' } }
        ]
      })
      .limit(Number(limit))
      .toArray();
    
    await redis.setex(cacheKey, 300, JSON.stringify(users));
    
    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Update user profile details
app.put('/users/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { location, website, birthDate, gender, interests, languages } = req.body;
    
    const profileData: any = {};
    if (location) profileData.location = location;
    if (website) profileData.website = website;
    if (birthDate) profileData.birthDate = new Date(birthDate);
    if (gender) profileData.gender = gender;
    if (interests) profileData.interests = interests;
    if (languages) profileData.languages = languages;
    
    await db.collection('user_profiles').updateOne(
      { userId },
      { $set: profileData },
      { upsert: true }
    );
    
    // Invalidate cache
    await redis.del(`user:${userId}`);
    
    res.json({ message: 'Profile updated' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user profile
app.get('/users/:userId/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
   Register device
app.post('/users/devices/register', async (req: Request, res: Response) => {
  try {
    const { userId, deviceInfo } = req.body;
    
    const device: Device = {
      id: generateId(),
      userId,
      type: deviceInfo.type || 'desktop',
      os: deviceInfo.os || 'unknown',
      browser: deviceInfo.browser,
      appVersion: deviceInfo.appVersion,
      lastActive: new Date(),
      isActive: true,
      pushToken: deviceInfo.pushToken,
      metadata: deviceInfo.metadata || {},
    };
    
    await db.collection('devices').insertOne(device);
    await redis.setex(`device:${device.id}`, 86400, JSON.stringify(device));
    await redis.sadd(`user_devices:${userId}`, device.id);
    
    await producer.send({
      topic: 'device-events',
        
        if (event.type === 'sync_data') {
          console.log('Sync data received:', event);
        }
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'device_registered',
          device,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(device);
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Update device activity
app.post('/users/devices/:deviceId/heartbeat', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { userId } = req.body;
    
    await db.collection('devices').updateOne(
      { id: deviceId, userId },
      { $set: { lastActive: new Date(), isActive: true } }
    );
    
    const cachedDevice = await redis.get(`device:${deviceId}`);
    if (cachedDevice) {
      const device = JSON.parse(cachedDevice);
      device.lastActive = new Date();
      device.isActive = true;
      await redis.setex(`device:${deviceId}`, 86400, JSON.stringify(device));
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Device heartbeat error:', error);
    res.status(500).json({ error: 'Failed to update device activity' });
  }
});

// Get user devices
app.get('/users/:userId/devices', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const deviceIds = await redis.smembers(`user_devices:${userId}`);
    const devices = [];
    
    for (const deviceId of deviceIds) {
      const cachedDevice = await redis.get(`device:${deviceId}`);
      if (cachedDevice) {
        devices.push(JSON.parse(cachedDevice));
      }
    }
    
    if (devices.length === 0) {
      const dbDevices = await db.collection('devices').find({ userId }).toArray();
      for (const device of dbDevices) {
        await redis.setex(`device:${device.id}`, 86400, JSON.stringify(device));
        await redis.sadd(`user_devices:${userId}`, device.id);
      }
      res.json(dbDevices);
    } else {
      res.json(devices);
    }
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Sync user data across devices
app.post('/users/:userId/sync', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { syncData, deviceId } = req.body;
    
    const deviceIds = await redis.smembers(`user_devices:${userId}`);
    
    await producer.send({
      topic: 'device-sync',
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'sync_data',
          userId,
          deviceId,
          syncData,
          targetDevices: deviceIds.filter((id: string) => id !== deviceId),
          timestamp: new Date(),
        }),
      }],
    });
    
    await redis.set(`user_sync:${userId}`, new Date().toISOString());
    
    res.json({ success: true, syncedDevices: deviceIds.length - 1 });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

// Remove device
app.delete('/users/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { userId } = req.body;
    
    await db.collection('devices').deleteOne({ id: deviceId, userId });
    await redis.del(`device:${deviceId}`);
    await redis.srem(`user_devices:${userId}`, deviceId);
    
    await producer.send({
      topic: 'device-events',
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'device_removed',
          deviceId,
          userId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Device removal error:', error);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// Get user sync status
app.get('/users/:userId/sync-status', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const lastSync = await redis.get(`user_sync:${userId}`);
    const deviceIds = await redis.smembers(`user_devices:${userId}`);
    
    res.json({
      lastSync,
      deviceCount: deviceIds.length,
      canSync: deviceIds.length > 1,
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'user-service' });
});

// Helper functions
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Start server
async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'user-events', fromBeginning: false });
  await consumer.subscribe({ topic: 'social-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received user event:', event);
        
        if (event.event === 'user_updated') {
          await redis.del(`user:${event.data.userId}`);
        }
      }
    }
  });
  
  app.listen(PORT, () => {
    console.log(`User Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start user service:', error);
  process.exit(1);
});

export default app;
