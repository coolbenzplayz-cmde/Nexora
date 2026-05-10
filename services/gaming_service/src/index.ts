import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3011;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';

let db: Db;
const redis = new Redis(REDIS_URI);
const mongoClient = new MongoClient(MONGO_URI);

const kafka = new Kafka({
  clientId: 'gaming-service',
  brokers: KAFKA_BROKERS.split(','),
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: 'gaming-service-group' });

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
});

interface Game {
  id: string;
  name: string;
  description: string;
  genre: string;
  minPlayers: number;
  maxPlayers: number;
  thumbnailUrl: string;
  isActive: boolean;
  createdAt: Date;
}

interface GameSession {
  id: string;
  gameId: string;
  hostId: string;
  players: {
    userId: string;
    score: number;
    joinedAt: Date;
  }[];
  status: 'waiting' | 'active' | 'completed';
  winnerId?: string;
  createdAt: Date;
  endedAt?: Date;
}

interface Tournament {
  id: string;
  name: string;
  gameId: string;
  description: string;
  startDate: Date;
  endDate: Date;
  maxParticipants: number;
  participants: string[];
  prizePool: number;
  status: 'upcoming' | 'ongoing' | 'completed';
  winnerId?: string;
  createdAt: Date;
}

interface Leaderboard {
  id: string;
  gameId: string;
  entries: {
    userId: string;
    score: number;
    rank: number;
  }[];
  updatedAt: Date;
}

async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('games');
  await db.createCollection('game_sessions');
  await db.createCollection('tournaments');
  await db.createCollection('leaderboards');
  
  await db.createIndex('game_sessions', { gameId: 1 });
  await db.createIndex('game_sessions', { hostId: 1 });
  await db.createIndex('tournaments', { gameId: 1 });
  await db.createIndex('leaderboards', { gameId: 1 });
  
  console.log('Gaming Service database initialized');
}

app.post('/gaming/games', async (req: Request, res: Response) => {
  try {
    const { name, description, genre, minPlayers, maxPlayers, thumbnailUrl } = req.body;
    
    const game: Game = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      genre,
      minPlayers,
      maxPlayers,
      thumbnailUrl,
      isActive: true,
      createdAt: new Date(),
    };
    
    await db.collection('games').insertOne(game);
    
    res.status(201).json(game);
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

app.get('/gaming/games', async (req: Request, res: Response) => {
  try {
    const { genre } = req.query;
    
    const query: any = { isActive: true };
    if (genre) query.genre = genre;
    
    const games = await db.collection('games').find(query).toArray();
    
    res.json(games);
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.post('/gaming/sessions', async (req: Request, res: Response) => {
  try {
    const { gameId, hostId } = req.body;
    
    const session: GameSession = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      gameId,
      hostId,
      players: [{ userId: hostId, score: 0, joinedAt: new Date() }],
      status: 'waiting',
      createdAt: new Date(),
    };
    
    await db.collection('game_sessions').insertOne(session);
    
    await producer.send({
      topic: 'gaming-events',
      messages: [{
        key: gameId,
        value: JSON.stringify({
          type: 'session_created',
          sessionId: session.id,
          gameId,
          hostId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.post('/gaming/sessions/:sessionId/join', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body;
    
    await db.collection('game_sessions').updateOne(
      { id: sessionId, status: 'waiting' },
      {
        $push: {
          players: { userId, score: 0, joinedAt: new Date() },
        },
      }
    );
    
    const session = await db.collection('game_sessions').findOne({ id: sessionId });
    
    io.to(`session:${sessionId}`).emit('player_joined', { userId, sessionId });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

app.post('/gaming/sessions/:sessionId/start', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    await db.collection('game_sessions').updateOne(
      { id: sessionId },
      { $set: { status: 'active' } }
    );
    
    io.to(`session:${sessionId}`).emit('game_started', { sessionId });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

app.post('/gaming/sessions/:sessionId/score', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { userId, score } = req.body;
    
    await db.collection('game_sessions').updateOne(
      { id: sessionId, 'players.userId': userId },
      { $set: { 'players.$.score': score } }
    );
    
    io.to(`session:${sessionId}`).emit('score_updated', { userId, score });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update score error:', error);
    res.status(500).json({ error: 'Failed to update score' });
  }
});

app.post('/gaming/tournaments', async (req: Request, res: Response) => {
  try {
    const { name, gameId, description, startDate, endDate, maxParticipants, prizePool } = req.body;
    
    const tournament: Tournament = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      gameId,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxParticipants,
      participants: [],
      prizePool,
      status: 'upcoming',
      createdAt: new Date(),
    };
    
    await db.collection('tournaments').insertOne(tournament);
    
    res.status(201).json(tournament);
  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

app.post('/gaming/tournaments/:tournamentId/join', async (req: Request, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const { userId } = req.body;
    
    await db.collection('tournaments').updateOne(
      { id: tournamentId, status: 'upcoming' },
      { $push: { participants: userId } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Join tournament error:', error);
    res.status(500).json({ error: 'Failed to join tournament' });
  }
});

app.get('/gaming/leaderboards/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    
    const leaderboard = await db.collection('leaderboards').findOne({ gameId });
    
    if (!leaderboard) {
      return res.json({ gameId, entries: [] });
    }
    
    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

io.on('connection', (socket) => {
  socket.on('join_session', (sessionId) => {
    socket.join(`session:${sessionId}`);
  });
  
  socket.on('leave_session', (sessionId) => {
    socket.leave(`session:${sessionId}`);
  });
  
  socket.on('game_action', (data) => {
    socket.to(`session:${data.sessionId}`).emit('game_action', data);
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'gaming-service' });
});

async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'gaming-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received gaming event:', event);
      }
    },
  });
  
  httpServer.listen(PORT, () => {
    console.log(`Gaming Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start Gaming Service:', error);
});
