import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import AWS from 'aws-sdk';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3008;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';

let db: Db;
const redis = new Redis(REDIS_URI);
const mongoClient = new MongoClient(MONGO_URI);

const kafka = new Kafka({
  clientId: 'music-service',
  brokers: KAFKA_BROKERS.split(','),
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: 'music-service-group' });

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

// Music Types
interface Track {
  id: string;
  title: string;
  artistId: string;
  albumId?: string;
  duration: number;
  audioUrl: string;
  coverArtUrl: string;
  genre: string[];
  releaseDate: Date;
  lyrics?: string;
  explicit: boolean;
  plays: number;
  likes: number;
  shares: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Album {
  id: string;
  title: string;
  artistId: string;
  coverArtUrl: string;
  releaseDate: Date;
  genre: string[];
  trackIds: string[];
  description?: string;
  plays: number;
  createdAt: Date;
}

interface Playlist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  coverArtUrl?: string;
  trackIds: string[];
  isPublic: boolean;
  followers: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Artist {
  id: string;
  userId: string;
  name: string;
  bio?: string;
  coverArtUrl: string;
  followers: number;
  monthlyListeners: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Initialize database
async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('tracks');
  await db.createCollection('albums');
  await db.createCollection('playlists');
  await db.createCollection('artists');
  await db.createCollection('music_likes');
  await db.createCollection('music_history');
  
  await db.createIndex('tracks', { artistId: 1 });
  await db.createIndex('tracks', { albumId: 1 });
  await db.createIndex('tracks', { genre: 1 });
  await db.createIndex('albums', { artistId: 1 });
  await db.createIndex('playlists', { userId: 1 });
  await db.createIndex('artists', { userId: 1 });
  await db.createIndex('music_likes', { trackId: 1, userId: 1 }, { unique: true });
  
  console.log('Music Service database initialized');
}

// Upload track
app.post('/music/tracks', async (req: Request, res: Response) => {
  try {
    const { userId, title, artistId, albumId, genre, explicit, lyrics } = req.body;
    const file = req.files?.audio;
    const coverArt = req.files?.coverArt;
    
    const trackId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Upload audio to S3
    const audioKey = `music/${trackId}/audio.mp3`;
    // await s3.putObject({ Bucket: process.env.S3_BUCKET, Key: audioKey, Body: file }).promise();
    
    const track: Track = {
      id: trackId,
      title,
      artistId,
      albumId,
      duration: 0,
      audioUrl: `https://${process.env.S3_BUCKET || 'nexora-music'}.s3.amazonaws.com/${audioKey}`,
      coverArtUrl: coverArt ? `https://${process.env.S3_BUCKET || 'nexora-music'}.s3.amazonaws.com/music/${trackId}/cover.jpg` : '',
      genre: genre ? genre.split(',') : [],
      releaseDate: new Date(),
      lyrics,
      explicit: explicit || false,
      plays: 0,
      likes: 0,
      shares: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('tracks').insertOne(track);
    
    await producer.send({
      topic: 'music-events',
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'track_uploaded',
          trackId,
          userId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(track);
  } catch (error) {
    console.error('Upload track error:', error);
    res.status(500).json({ error: 'Failed to upload track' });
  }
});

// Get track by ID
app.get('/music/tracks/:trackId', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    
    const cacheKey = `track:${trackId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    const track = await db.collection('tracks').findOne({ id: trackId });
    
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    await redis.setex(cacheKey, 3600, JSON.stringify(track));
    res.json(track);
  } catch (error) {
    console.error('Get track error:', error);
    res.status(500).json({ error: 'Failed to fetch track' });
  }
});

// Get tracks by artist
app.get('/music/artists/:artistId/tracks', async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const tracks = await db.collection('tracks')
      .find({ artistId })
      .sort({ releaseDate: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    res.json(tracks);
  } catch (error) {
    console.error('Get artist tracks error:', error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// Get tracks by genre
app.get('/music/genres/:genre/tracks', async (req: Request, res: Response) => {
  try {
    const { genre } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const tracks = await db.collection('tracks')
      .find({ genre: genre })
      .sort({ plays: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    res.json(tracks);
  } catch (error) {
    console.error('Get genre tracks error:', error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// Create album
app.post('/music/albums', async (req: Request, res: Response) => {
  try {
    const { userId, artistId, title, genre, description } = req.body;
    const coverArt = req.files?.coverArt;
    
    const albumId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const album: Album = {
      id: albumId,
      title,
      artistId,
      coverArtUrl: coverArt ? `https://${process.env.S3_BUCKET || 'nexora-music'}.s3.amazonaws.com/albums/${albumId}/cover.jpg` : '',
      releaseDate: new Date(),
      genre: genre ? genre.split(',') : [],
      trackIds: [],
      description,
      plays: 0,
      createdAt: new Date(),
    };
    
    await db.collection('albums').insertOne(album);
    
    await producer.send({
      topic: 'music-events',
      messages: [{
        key: userId,
        value: JSON.stringify({
          type: 'album_created',
          albumId,
          userId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(album);
  } catch (error) {
    console.error('Create album error:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
});

// Create playlist
app.post('/music/playlists', async (req: Request, res: Response) => {
  try {
    const { userId, name, description, isPublic } = req.body;
    
    const playlistId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const playlist: Playlist = {
      id: playlistId,
      userId,
      name,
      description,
      coverArtUrl: '',
      trackIds: [],
      isPublic: isPublic || false,
      followers: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('playlists').insertOne(playlist);
    
    res.status(201).json(playlist);
  } catch (error) {
    console.error('Create playlist error:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// Add track to playlist
app.post('/music/playlists/:playlistId/tracks', async (req: Request, res: Response) => {
  try {
    const { playlistId } = req.params;
    const { trackId } = req.body;
    
    await db.collection('playlists').updateOne(
      { id: playlistId },
      {
        $push: { trackIds: trackId },
        $set: { updatedAt: new Date() },
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Add track to playlist error:', error);
    res.status(500).json({ error: 'Failed to add track' });
  }
});

// Record play
app.post('/music/tracks/:trackId/play', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const { userId } = req.body;
    
    await db.collection('tracks').updateOne(
      { id: trackId },
      { $inc: { plays: 1 } }
    );
    
    await db.collection('music_history').insertOne({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trackId,
      userId,
      timestamp: new Date(),
    });
    
    await redis.del(`track:${trackId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Record play error:', error);
    res.status(500).json({ error: 'Failed to record play' });
  }
});

// Like track
app.post('/music/tracks/:trackId/like', async (req: Request, res: Response) => {
  try {
    const { trackId } = req.params;
    const { userId } = req.body;
    
    const existing = await db.collection('music_likes').findOne({ trackId, userId });
    
    if (existing) {
      await db.collection('music_likes').deleteOne({ trackId, userId });
      await db.collection('tracks').updateOne({ id: trackId }, { $inc: { likes: -1 } });
      res.json({ liked: false });
    } else {
      await db.collection('music_likes').insertOne({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        trackId,
        userId,
        timestamp: new Date(),
      });
      await db.collection('tracks').updateOne({ id: trackId }, { $inc: { likes: 1 } });
      res.json({ liked: true });
    }
    
    await redis.del(`track:${trackId}`);
  } catch (error) {
    console.error('Like track error:', error);
    res.status(500).json({ error: 'Failed to like track' });
  }
});

// Get user playlists
app.get('/music/users/:userId/playlists', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const playlists = await db.collection('playlists')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(playlists);
  } catch (error) {
    console.error('Get user playlists error:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'music-service' });
});

// Start server
async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'music-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received music event:', event);
      }
    },
  });
  
  app.listen(PORT, () => {
    console.log(`Music Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start Music Service:', error);
});
