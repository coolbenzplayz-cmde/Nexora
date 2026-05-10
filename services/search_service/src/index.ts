import express from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3009;
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';

let db: Db;
let redis: Redis;
let kafka: Kafka;
let producer: Producer;
let consumer: Consumer;
let esClient: Client;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function initializeDatabase() {
  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  db = client.db('nexora');
  console.log('Connected to MongoDB');
}

async function initializeRedis() {
  redis = new Redis(REDIS_URL);
  console.log('Connected to Redis');
}

async function initializeKafka() {
  kafka = new Kafka({
    clientId: 'search-service',
    brokers: KAFKA_BROKERS,
  });

  producer = kafka.producer();
  await producer.connect();
  console.log('Kafka producer connected');

  consumer = kafka.consumer({ groupId: 'search-service' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'content-events', fromBeginning: false });
  await consumer.subscribe({ topic: 'user-events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value?.toString() || '{}');
      await handleEvent(topic, event);
    },
  });

  console.log('Kafka consumer connected');
}

async function initializeElasticsearch() {
  esClient = new Client({ node: ELASTICSEARCH_URL });
  
  // Create index if not exists
  const indices = ['users', 'posts', 'livestreams'];
  for (const index of indices) {
    const exists = await esClient.indices.exists({ index });
    if (!exists) {
      await esClient.indices.create({
        index,
        body: {
          mappings: {
            properties: {
              username: { type: 'text' },
              displayName: { type: 'text' },
              bio: { type: 'text' },
              content: { type: 'text' },
              title: { type: 'text' },
              description: { type: 'text' },
              tags: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
    }
  }
  console.log('Elasticsearch connected');
}

async function handleEvent(topic: string, event: any) {
  try {
    switch (topic) {
      case 'user-events':
        if (event.type === 'user_created' || event.type === 'user_updated') {
          await indexUser(event.data);
        }
        break;
      case 'content-events':
        if (event.type === 'post_created') {
          await indexPost(event.data);
        } else if (event.type === 'livestream_started' || event.type === 'livestream_updated') {
          await indexLivestream(event.data);
        }
        break;
    }
  } catch (error) {
    console.error('Error handling event:', error);
  }
}

async function indexUser(user: any) {
  await esClient.index({
    index: 'users',
    id: user.id,
    body: {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      bio: user.bio || '',
      isVerified: user.isVerified,
      followers: user.followers || 0,
      createdAt: user.createdAt,
    },
  });
}

async function indexPost(post: any) {
  await esClient.index({
    index: 'posts',
    id: post.id,
    body: {
      id: post.id,
      userId: post.userId,
      username: post.username,
      content: post.content,
      type: post.type,
      tags: post.tags || [],
      likes: post.likes || 0,
      createdAt: post.createdAt,
    },
  });
}

async function indexLivestream(stream: any) {
  await esClient.index({
    index: 'livestreams',
    id: stream.id,
    body: {
      id: stream.id,
      broadcasterId: stream.broadcasterId,
      broadcasterName: stream.broadcasterName,
      title: stream.title,
      description: stream.description,
      category: stream.category,
      status: stream.status,
      viewerCount: stream.viewerCount || 0,
      createdAt: stream.createdAt,
    },
  });
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'search-service' });
});

app.get('/search', async (req, res) => {
  try {
    const { q, type = 'all', limit = '20', offset = '0' } = req.query;

    if (!q || (q as string).length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const cacheKey = `search:${q}:${type}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const results: any = {
      users: [],
      posts: [],
      livestreams: [],
    };

    const limitInt = parseInt(limit as string);
    const offsetInt = parseInt(offset as string);

    if (type === 'all' || type === 'users') {
      const userResult = await esClient.search({
        index: 'users',
        body: {
          query: {
            multi_match: {
              query: q as string,
              fields: ['username', 'displayName', 'bio'],
              fuzziness: 'AUTO',
            },
          },
          size: limitInt,
          from: offsetInt,
        },
      });
      results.users = userResult.hits.hits.map((hit: any) => hit._source);
    }

    if (type === 'all' || type === 'posts') {
      const postResult = await esClient.search({
        index: 'posts',
        body: {
          query: {
            multi_match: {
              query: q as string,
              fields: ['content', 'tags'],
              fuzziness: 'AUTO',
            },
          },
          size: limitInt,
          from: offsetInt,
        },
      });
      results.posts = postResult.hits.hits.map((hit: any) => hit._source);
    }

    if (type === 'all' || type === 'livestreams') {
      const streamResult = await esClient.search({
        index: 'livestreams',
        body: {
          query: {
            multi_match: {
              query: q as string,
              fields: ['title', 'description', 'category'],
              fuzziness: 'AUTO',
            },
          },
          size: limitInt,
          from: offsetInt,
        },
      });
      results.livestreams = streamResult.hits.hits.map((hit: any) => hit._source);
    }

    await redis.setex(cacheKey, 300, JSON.stringify(results));
    res.json(results);
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/search/users', async (req, res) => {
  try {
    const { q, limit = '20', offset = '0' } = req.query;

    if (!q || (q as string).length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const result = await esClient.search({
      index: 'users',
      body: {
        query: {
          multi_match: {
            query: q as string,
            fields: ['username', 'displayName', 'bio'],
            fuzziness: 'AUTO',
          },
        },
        size: parseInt(limit as string),
        from: parseInt(offset as string),
      },
    });

    const users = result.hits.hits.map((hit: any) => hit._source);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'User search failed' });
  }
});

app.get('/search/posts', async (req, res) => {
  try {
    const { q, limit = '20', offset = '0' } = req.query;

    if (!q || (q as string).length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const result = await esClient.search({
      index: 'posts',
      body: {
        query: {
          multi_match: {
            query: q as string,
            fields: ['content', 'tags'],
            fuzziness: 'AUTO',
          },
        },
        size: parseInt(limit as string),
        from: parseInt(offset as string),
      },
    });

    const posts = result.hits.hits.map((hit: any) => hit._source);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Post search failed' });
  }
});

app.get('/search/livestreams', async (req, res) => {
  try {
    const { q, limit = '20', offset = '0' } = req.query;

    if (!q || (q as string).length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const result = await esClient.search({
      index: 'livestreams',
      body: {
        query: {
          multi_match: {
            query: q as string,
            fields: ['title', 'description', 'category'],
            fuzziness: 'AUTO',
          },
        },
        size: parseInt(limit as string),
        from: parseInt(offset as string),
      },
    });

    const streams = result.hits.hits.map((hit: any) => hit._source);
    res.json(streams);
  } catch (error) {
    res.status(500).json({ error: 'Livestream search failed' });
  }
});

app.get('/search/suggestions', async (req, res) => {
  try {
    const { q, limit = '5' } = req.query;

    if (!q || (q as string).length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const result = await esClient.search({
      index: 'users',
      body: {
        query: {
          prefix: {
            username: q as string,
          },
        },
        size: parseInt(limit as string),
      },
    });

    const suggestions = result.hits.hits.map((hit: any) => ({
      id: hit._source.id,
      username: hit._source.username,
      displayName: hit._source.displayName,
    }));

    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

app.post('/search/reindex', async (req, res) => {
  try {
    const { type } = req.body;

    if (type === 'users') {
      const users = await db.collection('users').find({}).toArray();
      for (const user of users) {
        await indexUser(user);
      }
    } else if (type === 'posts') {
      const posts = await db.collection('feeds').find({}).toArray();
      for (const post of posts) {
        await indexPost(post);
      }
    } else if (type === 'livestreams') {
      const streams = await db.collection('livestreams').find({}).toArray();
      for (const stream of streams) {
        await indexLivestream(stream);
      }
    }

    res.json({ success: true, message: `Reindexed ${type}` });
  } catch (error) {
    res.status(500).json({ error: 'Reindex failed' });
  }
});

async function start() {
  try {
    await initializeDatabase();
    await initializeRedis();
    await initializeKafka();
    await initializeElasticsearch();

    app.listen(PORT, () => {
      console.log(`Search Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

start();
