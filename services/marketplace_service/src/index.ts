import express, { Request, Response } from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import Stripe from 'stripe';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3010;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const REDIS_URI = process.env.REDIS_URI || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

let db: Db;
const redis = new Redis(REDIS_URI);
const mongoClient = new MongoClient(MONGO_URI);
const stripe = new Stripe(STRIPE_SECRET_KEY);

const kafka = new Kafka({
  clientId: 'marketplace-service',
  brokers: KAFKA_BROKERS.split(','),
});

const producer: Producer = kafka.producer();
const consumer: Consumer = kafka.consumer({ groupId: 'marketplace-service-group' });

interface Product {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: string;
  stock: number;
  status: 'active' | 'sold' | 'removed';
  createdAt: Date;
  updatedAt: Date;
}

interface Order {
  id: string;
  buyerId: string;
  productId: string;
  sellerId: string;
  quantity: number;
  totalPrice: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  stripePaymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Cart {
  id: string;
  userId: string;
  items: {
    productId: string;
    quantity: number;
  }[];
  updatedAt: Date;
}

interface Store {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  avatarUrl: string;
  bannerUrl: string;
  verified: boolean;
  rating: number;
  totalSales: number;
  createdAt: Date;
  updatedAt: Date;
}

async function initDatabase() {
  await mongoClient.connect();
  db = mongoClient.db('nexora');
  
  await db.createCollection('products');
  await db.createCollection('orders');
  await db.createCollection('carts');
  await db.createCollection('stores');
  
  await db.createIndex('products', { sellerId: 1 });
  await db.createIndex('products', { category: 1 });
  await db.createIndex('products', { status: 1 });
  await db.createIndex('orders', { buyerId: 1 });
  await db.createIndex('orders', { sellerId: 1 });
  await db.createIndex('carts', { userId: 1 }, { unique: true });
  await db.createIndex('stores', { creatorId: 1 }, { unique: true });
  
  console.log('Marketplace Service database initialized');
}

app.post('/marketplace/products', async (req: Request, res: Response) => {
  try {
    const { sellerId, title, description, price, category, stock, images } = req.body;
    
    const product: Product = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sellerId,
      title,
      description,
      price,
      currency: 'USD',
      images: images || [],
      category,
      stock,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('products').insertOne(product);
    
    await producer.send({
      topic: 'marketplace-events',
      messages: [{
        key: sellerId,
        value: JSON.stringify({
          type: 'product_created',
          productId: product.id,
          sellerId,
          timestamp: new Date(),
        }),
      }],
    });
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

app.get('/marketplace/products/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    
    const product = await db.collection('products').findOne({ id: productId });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

app.get('/marketplace/products', async (req: Request, res: Response) => {
  try {
    const { category, sellerId, limit = 20, offset = 0 } = req.query;
    
    const query: any = { status: 'active' };
    if (category) query.category = category;
    if (sellerId) query.sellerId = sellerId;
    
    const products = await db.collection('products')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .toArray();
    
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/marketplace/orders', async (req: Request, res: Response) => {
  try {
    const { buyerId, productId, quantity, shippingAddress } = req.body;
    
    const product = await db.collection('products').findOne({ id: productId });
    
    if (!product || product.stock < quantity) {
      return res.status(400).json({ error: 'Product not available' });
    }
    
    const totalPrice = product.price * quantity;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalPrice * 100,
      currency: 'usd',
      metadata: { orderId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` },
    });
    
    const order: Order = {
      id: paymentIntent.metadata.orderId,
      buyerId,
      productId,
      sellerId: product.sellerId,
      quantity,
      totalPrice,
      status: 'pending',
      shippingAddress,
      stripePaymentIntentId: paymentIntent.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('orders').insertOne(order);
    
    res.status(201).json({ order, clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.get('/marketplace/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    
    const order = await db.collection('orders').findOne({ id: orderId });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.put('/marketplace/orders/:orderId/status', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    await db.collection('orders').updateOne(
      { id: orderId },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

app.post('/marketplace/carts', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    const cart: Cart = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      items: [],
      updatedAt: new Date(),
    };
    
    await db.collection('carts').insertOne(cart);
    
    res.status(201).json(cart);
  } catch (error) {
    console.error('Create cart error:', error);
    res.status(500).json({ error: 'Failed to create cart' });
  }
});

app.post('/marketplace/carts/:cartId/items', async (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;
    const { productId, quantity } = req.body;
    
    await db.collection('carts').updateOne(
      { id: cartId },
      {
        $push: { items: { productId, quantity } },
        $set: { updatedAt: new Date() },
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

app.get('/marketplace/carts/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const cart = await db.collection('carts').findOne({ userId });
    
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }
    
    res.json(cart);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

app.post('/marketplace/stores', async (req: Request, res: Response) => {
  try {
    const { creatorId, name, description } = req.body;
    
    const store: Store = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      creatorId,
      name,
      description,
      avatarUrl: '',
      bannerUrl: '',
      verified: false,
      rating: 0,
      totalSales: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.collection('stores').insertOne(store);
    
    res.status(201).json(store);
  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

app.get('/marketplace/stores/:creatorId', async (req: Request, res: Response) => {
  try {
    const { creatorId } = req.params;
    
    const store = await db.collection('stores').findOne({ creatorId });
    
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }
    
    res.json(store);
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'marketplace-service' });
});

async function start() {
  await initDatabase();
  await producer.connect();
  await consumer.connect();
  
  await consumer.subscribe({ topic: 'marketplace-events', fromBeginning: false });
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      if (value) {
        const event = JSON.parse(value);
        console.log('Received marketplace event:', event);
      }
    },
  });
  
  app.listen(PORT, () => {
    console.log(`Marketplace Service running on port ${PORT}`);
  });
}

start().catch(error => {
  console.error('Failed to start Marketplace Service:', error);
});
