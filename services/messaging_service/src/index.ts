import express, { Request, Response } from 'express';
import { MongoClient, Db, ObjectId } from 'mongodb';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { Kafka } from 'kafkajs';
import axios from 'axios';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3003;

app.use(express.json());

// MongoDB connection
const mongoClient = new MongoClient(process.env.MONGODB_URL || 'mongodb://localhost:27017');
let db: Db;

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Kafka setup
const kafka = new Kafka({
  clientId: 'messaging-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'messaging-service-group' });

interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  mediaUrl?: string;
  timestamp: Date;
  read: boolean;
  reactions?: { [userId: string]: string };
  replyTo?: string;
  language?: string;
  translations?: { [lang: string]: string };
}

interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: { [userId: string]: number };
  createdAt: Date;
  updatedAt: Date;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  ownerId: string;
  members: string[];
  admins: string[];
  createdAt: Date;
}

// Online users tracking
const onlineUsers = new Map<string, Set<string>>();

// Initialize database
async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('messages');
  await db.createCollection('conversations');
  await db.createCollection('groups');
  await db.createIndex('messages', { senderId: 1, timestamp: -1 });
  await db.createIndex('messages', { receiverId: 1, timestamp: -1 });
  await db.createIndex('messages', { groupId: 1, timestamp: -1 });
  await db.createIndex('conversations', { participants: 1 });
  
  console.log('Database initialized');
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId as string;
  
  if (userId) {
    // Track online user
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)?.add(socket.id);
    
    // Join user's personal room
    socket.join(`user:${userId}`);
    
    // Publish online status
    producer.send({
      topic: 'user-presence',
      messages: [{
        key: userId,
        value: JSON.stringify({
          event: 'user_online',
          userId,
          timestamp: new Date()
        })
      }]
    });
    
    console.log(`User ${userId} connected`);
  }
  
  // Handle joining group chat
  socket.on('join_group', (groupId: string) => {
    socket.join(`group:${groupId}`);
    console.log(`User ${userId} joined group ${groupId}`);
  });
  
  // Handle leaving group chat
  socket.on('leave_group', (groupId: string) => {
    socket.leave(`group:${groupId}`);
    console.log(`User ${userId} left group ${groupId}`);
  });
  
  // Handle typing indicator
  socket.on('typing', async (data: { conversationId: string, isTyping: boolean }) => {
    const { conversationId, isTyping } = data;
    socket.to(`conversation:${conversationId}`).emit('user_typing', {
      userId,
      isTyping
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    if (userId) {
      onlineUsers.get(userId)?.delete(socket.id);
      
      if (onlineUsers.get(userId)?.size === 0) {
        onlineUsers.delete(userId);
        
        // Publish offline status
        producer.send({
          topic: 'user-presence',
          messages: [{
            key: userId,
            value: JSON.stringify({
              event: 'user_offline',
              userId,
              timestamp: new Date()
            })
          }]
        });
      }
      
      console.log(`User ${userId} disconnected`);
    }
  });
});

// REST API endpoints

// Send direct message
app.post('/messages/direct', async (req: Request, res: Response) => {
  try {
    const { senderId, receiverId, content, type, mediaUrl, replyTo, targetLanguage } = req.body;
    
    if (!senderId || !receiverId || !content) {
      return res.status(400).json({ error: 'senderId, receiverId, and content are required' });
    }
    
    // Detect language
    let detectedLanguage = 'en';
    try {
      const langResponse = await axios.post(
        `${process.env.AI_SERVICE_URL || 'http://localhost:3010'}/ai/detect-language`,
        { content }
      );
      if (langResponse.data) {
        detectedLanguage = langResponse.data.language;
      }
    } catch (error) {
      console.error('Language detection error:', error);
    }
    
    const message: Message = {
      id: generateId(),
      senderId,
      receiverId,
      content,
      type: type || 'text',
      mediaUrl,
      timestamp: new Date(),
      read: false,
      replyTo,
      language: detectedLanguage,
      translations: {}
    };
    
    // Auto-translate if target language specified and different from detected
    if (targetLanguage && targetLanguage !== detectedLanguage) {
      try {
        const translateResponse = await axios.post(
          `${process.env.AI_SERVICE_URL || 'http://localhost:3010'}/ai/translate`,
          { content, targetLanguage, sourceLanguage: detectedLanguage }
        );
        if (translateResponse.data && message.translations) {
          message.translations[targetLanguage] = translateResponse.data.translatedText;
        }
      } catch (error) {
        console.error('Translation error:', error);
      }
    }
    
    // Save to database
    await db.collection('messages').insertOne(message);
    
    // Update or create conversation
    const conversationId = [senderId, receiverId].sort().join(':');
    await db.collection('conversations').updateOne(
      { id: conversationId },
      {
        $set: {
          participants: [senderId, receiverId],
          lastMessage: message,
          updatedAt: new Date()
        },
        $inc: { [`unreadCount.${receiverId}`]: 1 }
      },
      { upsert: true }
    );
    
    // Publish to Kafka
    await producer.send({
      topic: 'message-events',
      messages: [{
        key: message.id,
        value: JSON.stringify({
          event: 'message_sent',
          data: message
        })
      }]
    });
    
    // Send via Socket.IO if receiver is online
    if (onlineUsers.has(receiverId)) {
      io.to(`user:${receiverId}`).emit('new_message', message);
    }
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Direct message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send group message
app.post('/messages/group', async (req: Request, res: Response) => {
  try {
    const { senderId, groupId, content, type, mediaUrl, replyTo, targetLanguage } = req.body;
    
    if (!senderId || !groupId || !content) {
      return res.status(400).json({ error: 'senderId, groupId, and content are required' });
    }
    
    // Detect language
    let detectedLanguage = 'en';
    try {
      const langResponse = await axios.post(
        `${process.env.AI_SERVICE_URL || 'http://localhost:3010'}/ai/detect-language`,
        { content }
      );
      if (langResponse.data) {
        detectedLanguage = langResponse.data.language;
      }
    } catch (error) {
      console.error('Language detection error:', error);
    }
    
    const message: Message = {
      id: generateId(),
      senderId,
      groupId,
      content,
      type: type || 'text',
      mediaUrl,
      timestamp: new Date(),
      read: false,
      replyTo,
      language: detectedLanguage,
      translations: {}
    };
    
    // Auto-translate if target language specified and different from detected
    if (targetLanguage && targetLanguage !== detectedLanguage) {
      try {
        const translateResponse = await axios.post(
          `${process.env.AI_SERVICE_URL || 'http://localhost:3010'}/ai/translate`,
          { content, targetLanguage, sourceLanguage: detectedLanguage }
        );
        if (translateResponse.data && message.translations) {
          message.translations[targetLanguage] = translateResponse.data.translatedText;
        }
      } catch (error) {
        console.error('Translation error:', error);
      }
    }
    
    // Save to database
    await db.collection('messages').insertOne(message);
    
    // Update group's last message
    await db.collection('groups').updateOne(
      { id: groupId },
      { $set: { lastMessage: message } }
    );
    
    // Publish to Kafka
    await producer.send({
      topic: 'message-events',
      messages: [{
        key: message.id,
        value: JSON.stringify({
          event: 'group_message_sent',
          data: message
        })
      }]
    });
    
    // Send via Socket.IO to group members
    io.to(`group:${groupId}`).emit('new_group_message', message);
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Group message error:', error);
    res.status(500).json({ error: 'Failed to send group message' });
  }
});

// Get conversation messages with translation
app.get('/messages/conversation/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const [senderId, receiverId] = conversationId.split(':');
    
    const { lang } = req.query;
    
    const messages = await db.collection('messages')
      .find({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ]
      })
      .sort({ timestamp: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    // Auto-translate messages if language requested
    if (lang && typeof lang === 'string') {
      const messagesToTranslate = messages.filter((m: any) => 
        m.language && m.language !== lang && (!m.translations || !m.translations[lang])
      );
      
      if (messagesToTranslate.length > 0) {
        try {
          const batchResponse = await axios.post(
            `${process.env.AI_SERVICE_URL || 'http://localhost:3010'}/ai/translate-batch`,
            {
              items: messagesToTranslate.map((m: any) => ({ id: m.id, content: m.content, sourceLanguage: m.language })),
              targetLanguage: lang
            }
          );
          
          if (batchResponse.data && batchResponse.data.results) {
            // Update messages with translations
            for (const result of batchResponse.data.results) {
              const message = messages.find((m: any) => m.id === result.id);
              if (message && result.result) {
                message.translations = message.translations || {};
                message.translations[lang] = result.result.translatedText;
                // Update in database
                await db.collection('messages').updateOne(
                  { id: result.id },
                  { $set: { translations: message.translations } }
                );
              }
            }
          }
        } catch (error) {
          console.error('Batch translation error:', error);
        }
      }
    }
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get group messages with translation
app.get('/messages/group/:groupId', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const { lang } = req.query;
    
    const messages = await db.collection('messages')
      .find({ groupId })
      .sort({ timestamp: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    // Auto-translate messages if language requested
    if (lang && typeof lang === 'string') {
      const messagesToTranslate = messages.filter((m: any) => 
        m.language && m.language !== lang && (!m.translations || !m.translations[lang])
      );
      
      if (messagesToTranslate.length > 0) {
        try {
          const batchResponse = await axios.post(
            `${process.env.AI_SERVICE_URL || 'http://localhost:3010'}/ai/translate-batch`,
            {
              items: messagesToTranslate.map((m: any) => ({ id: m.id, content: m.content, sourceLanguage: m.language })),
              targetLanguage: lang
            }
          );
          
          if (batchResponse.data && batchResponse.data.results) {
            // Update messages with translations
            for (const result of batchResponse.data.results) {
              const message = messages.find((m: any) => m.id === result.id);
              if (message && result.result) {
                message.translations = message.translations || {};
                message.translations[lang] = result.result.translatedText;
                // Update in database
                await db.collection('messages').updateOne(
                  { id: result.id },
                  { $set: { translations: message.translations } }
                );
              }
            }
          }
        } catch (error) {
          console.error('Batch translation error:', error);
        }
      }
    }
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
});

// Get user conversations
app.get('/conversations/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const conversations = await db.collection('conversations')
      .find({ participants: userId })
      .sort({ updatedAt: -1 })
      .toArray();
    
    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Mark message as read
app.post('/messages/:messageId/read', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;
    
    await db.collection('messages').updateOne(
      { id: messageId, receiverId: userId },
      { $set: { read: true } }
    );
    
    // Update unread count
    const message = await db.collection('messages').findOne({ id: messageId });
    if (message) {
      const conversationId = [message.senderId, message.receiverId].sort().join(':');
      await db.collection('conversations').updateOne(
        { id: conversationId },
        { $inc: { [`unreadCount.${userId}`]: -1 } }
      );
    }
    
    res.json({ message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// Create group
app.post('/groups', async (req: Request, res: Response) => {
  try {
    const { name, description, ownerId, members, avatar } = req.body;
    
    if (!name || !ownerId) {
      return res.status(400).json({ error: 'name and ownerId are required' });
    }
    
    const group: Group = {
      id: generateId(),
      name,
      description,
      avatar,
      ownerId,
      members: [...new Set([ownerId, ...(members || [])])],
      admins: [ownerId],
      createdAt: new Date()
    };
    
    await db.collection('groups').insertOne(group);
    
    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get user groups
app.get('/groups/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const groups = await db.collection('groups')
      .find({ members: userId })
      .toArray();
    
    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'messaging-service', onlineUsers: onlineUsers.size });
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
  
  await consumer.subscribe({ topic: 'message-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received message event:', event);
      }
    }
  });
  
  httpServer.listen(PORT, () => {
    console.log(`Messaging Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start messaging service:', error);
  process.exit(1);
});

export default app;
