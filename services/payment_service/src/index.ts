import express from 'express';
import { MongoClient, Db } from 'mongodb';
import Redis from 'ioredis';
import { Kafka, Producer } from 'kafkajs';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3008;
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

let db: Db;
let redis: Redis;
let kafka: Kafka;
let producer: Producer;
let stripe: Stripe;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function initializeDatabase() {
  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  db = client.db('nexora');
  console.log('Connected to MongoDB');

  await db.collection('transactions').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('transactions').createIndex({ status: 1 });
  await db.collection('creator_earnings').createIndex({ creatorId: 1, createdAt: -1 });
  
  // Subscription indexes
  await db.collection('subscriptions').createIndex({ userId: 1, status: 1 });
  await db.collection('subscriptions').createIndex({ stripeSubscriptionId: 1 });
  
  // Virtual gifts indexes
  await db.collection('virtual_gifts').createIndex({ streamId: 1, createdAt: -1 });
  await db.collection('virtual_gifts').createIndex({ senderId: 1, createdAt: -1 });
  
  // Ad revenue indexes
  await db.collection('ad_revenue').createIndex({ creatorId: 1, periodStart: -1 });
  
  // Premium content indexes
  await db.collection('premium_content').createIndex({ contentId: 1 });
  await db.collection('premium_content_purchases').createIndex({ userId: 1, contentId: 1 });
  
  // Virtual currency indexes
  await db.collection('wallets').createIndex({ userId: 1 }, { unique: true });
  await db.collection('transactions').createIndex({ type: 1 });
  
  // Marketplace indexes
  await db.collection('marketplace_listings').createIndex({ creatorId: 1, status: 1 });
  await db.collection('marketplace_orders').createIndex({ buyerId: 1, createdAt: -1 });
  
  /Subscription tiers configuration
const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    currency: 'usd',
    interval: 'month',
    features: [
      'Basic feed access',
      'Limited messaging',
      'Standard video quality',
      'Ad-supported content'
    ],
    limits: {
      postsPerDay: 5,
      messagesPerDay: 50,
      livestreamHoursPerMonth: 0,
      storageGB: 1
    }
  },
  premium: {
    name: 'Premium',
    price: 9.99,
    currency: 'usd',
    interval: 'month',
    stripePriceId: process.env.STRIPE_PREMIUM_PRICE_ID,
    features: [
      'Ad-free experience',
      'Unlimited messaging',
      'HD video quality',
      'Priority support',
      'Custom themes',
      'Advanced analytics'
    ],
    limits: {
      postsPerDay: 50,
      messagesPerDay: 1000,
      livestreamHoursPerMonth: 10,
      storageGB: 50
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 49.99,
    currency: 'usd',
    interval: 'month',
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    features: [
      'All Premium features',
      '4K video quality',
      'API access',
      'White-label branding',
      'Dedicated support',
      'Team collaboration',
      'Advanced moderation tools',
      'Revenue sharing (80%)'
    ],
    limits: {
      postsPerDay: Infinity,
      messagesPerDay: Infinity,
      livestreamHoursPerMonth: Infinity,
      storageGB: 1000
    }
  }
};

// Virtual gift configurations
const VIRTUAL_GIFTS = {
  rose: { name: 'Rose', price: 1, icon: '🌹', rarity: 'common' },
  heart: { name: 'Heart', price: 2, icon: '❤️', rarity: 'common' },
  star: { name: 'Star', price: 5, icon: '⭐', rarity: 'uncommon' },
  diamond: { name: 'Diamond', price: 10, icon: '💎', rarity: 'rare' },
  rocket: { name: 'Rocket', price: 25, icon: '🚀', rarity: 'epic' },
  crown: { name: 'Crown', price: 50, icon: '👑', rarity: 'legendary' }
};

// Ad revenue sharing percentages
const AD_REVENUE_SHARE = {
  free: 0,
  premium: 0.5,
  enterprise: 0.8
};

// / Donation indexes
  await db.collection('donations').createIndex({ creatorId: 1, createdAt: -1 });
}

async function initializeRedis() {
  redis = new Redis(REDIS_URL);
  console.log('Connected to Redis');
}

async function initializeKafka() {
  kafka = new Kafka({
    clientId: 'payment-service',
    brokers: KAFKA_BROKERS,
  });

  producer = kafka.producer();
  await producer.connect();
  console.log('Kafka producer connected');
}

async function initializeStripe() {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payment-service' });
});

app.post('/payments/create-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', userId, description } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      description,
      metadata: { userId },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

app.post('/payments/confirm', async (req, res) => {
  try {
    const { paymentIntentId, userId, type, amount, description } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    const transaction = {
      id: generateId(),
      userId,
      type: type || 'payment',
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency.toUpperCase(),
      status: 'completed',
      description,
      stripePaymentIntentId: paymentIntentId,
      metadata: paymentIntent.metadata,
      createdAt: new Date(),
    };

    await db.collection('transactions').insertOne(transaction);

    // Publish event
    await producer.send({
      topic: 'payment-events',
      messages: [
        {
          value: JSON.stringify({
            type: 'payment_completed',
            data: transaction,
          }),
        },
      ],
    });

    // Invalidate cache
    await redis.del(`transactions:${userId}`);

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

app.get('/payments/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = '20', offset = '0', status } = req.query;

    const cacheKey = `transactions:${userId}:${status || 'all'}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const filter: any = { userId };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const transactions = await db.collection('transactions')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string))
      .toArray();

    await redis.setex(cacheKey, 300, JSON.stringify(transactions));
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/payments/creator-earnings', async (req, res) => {
  try {
    const { creatorId, amount, source, periodStart, periodEnd } = req.body;

    const earning = {
      id: generateId(),
      creatorId,
      amount: parseFloat(amount),
      source,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      status: 'pending',
      createdAt: new Date(),
    };

    await db.collection('creator_earnings').insertOne(earning);

    res.json({ success: true, earning });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create earning record' });
  }
});

app.get('/payments/creator-earnings/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { status } = req.query;

    const filter: any = { creatorId };
    if (status) {
      filter.status = status;
    }

    const earnings = await db.collection('creator_earnings')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(earnings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

app.post('/payments/creator-earnings/:earningId/payout', async (req, res) => {
  try {
    const { earningId } = req.params;

    const earning = await db.collection('creator_earnings').findOne({ id: earningId });
    if (!earning) {
      return res.status(404).json({ error: 'Earning record not found' });
    }

    if (earning.status !== 'pending') {
      return res.status(400).json({ error: 'Earning already processed' });
    }

    // Create Stripe transfer
    const creator = await db.collection('users').findOne({ id: earning.creatorId });
    if (!creator?.stripeAccountId) {
      return res.status(400).json({ error: 'Creator has no Stripe account' });
    }

    const transfer = await stripe.transfers.create({
      amount: Math.round(earning.amount * 100),
      currency: 'usd',
      destination: creator.stripeAccountId,
      metadata: { earningId },
    });

    await db.collection('creator_earnings').updateOne(
      { id: earningId },
      {
        $set: {
          status: 'paid',
          stripeTransferId: transfer.id,
          paidAt: new Date(),
        },
      }
    );

    res.json({ success: true, transfer });
  } catch (error) {
    console.error('Error processing payout:', error);
    res.status(500).json({ error: 'Failed to process payout' });
  }
});

app.post('/payments/creator/connect', async (req, res) => {
  try {
    const { userId, code } = req.body;

    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    });

    const stripeAccountId = response.stripe_user_id;

    await db.collection('users').updateOne(
      { id: userId },
      { $set: { stripeAccountId } },
      { upsert: true }
    );

    res.json({ success: true, stripeAccountId });
  } catch (error) {
    console.error('Error connecting Stripe account:', error);
    res.status(500).json({ error: 'Failed to connect Stripe account' });
  }
});

app.get('/payments/creator/connect-link', async (req, res) => {
  try {
    const { userId } = req.query;

    const accountLink = await stripe.accountLinks.create({
      account: 'acct_test_placeholder', // In production, use user's Stripe account
      refresh_url: `${process.env.APP_URL}/settings/payments`,
      return_url: `${process.env.APP_URL}/settings/payments`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (error) {
    console.error('Error creating account link:', error);
    res.status(500).json({ error: 'Failed to create account link' });
  }
});

app.get('/payments/summary/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const summary = await db.collection('transactions').aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$amount' },
        },
      },
    ]).toArray();

    const result = {
      total: 0,
      completed: 0,
      pending: 0,
      failed: 0,
    };

    summary.forEach((item) => {
      result[item._id] = { count: item.count, total: item.total };
      result.total += item.total;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
});

// Subscription endpoints
app.get('/subscriptions/tiers', (req, res) => {
  res.json(SUBSCRIPTION_TIERS);
});

app.post('/subscriptions/create', async (req, res) => {
  try {
    const { userId, tier } = req.body;

    if (!SUBSCRIPTION_TIERS[tier]) {
      return res.status(400).json({ error: 'Invalid subscription tier' });
    }

    const tierConfig = SUBSCRIPTION_TIERS[tier];

    // Create Stripe subscription
    const customer = await stripe.customers.create({
      metadata: { userId },
    });

    const priceId = tierConfig.stripePriceId;
    if (!priceId) {
      return res.status(400).json({ error: 'No Stripe price ID configured for this tier' });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      metadata: { userId, tier },
    });

    const subscriptionDoc = {
      id: generateId(),
      userId,
      tier,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customer.id,
      status: 'active',
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      features: tierConfig.features,
      limits: tierConfig.limits,
      createdAt: new Date(),
    };

    await db.collection('subscriptions').insertOne(subscriptionDoc);

    // Update user subscription status
    await db.collection('users').updateOne(
      { id: userId },
      { $set: { subscriptionTier: tier, subscriptionStatus: 'active' } }
    );

    // Publish event
    await producer.send({
      topic: 'payment-events',
      messages: [
        {
          value: JSON.stringify({
            type: 'subscription_created',
            data: subscriptionDoc,
          }),
        },
      ],
    });

    res.json({ success: true, subscription: subscriptionDoc });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

app.get('/subscriptions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const subscription = await db.collection('subscriptions').findOne({
      userId,
      status: 'active',
    });

    if (!subscription) {
      // Return free tier if no active subscription
      return res.json({
        tier: 'free',
        ...SUBSCRIPTION_TIERS.free,
      });
    }

    res.json(subscription);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

app.post('/subscriptions/cancel', async (req, res) => {
  try {
    const { userId } = req.body;

    const subscription = await db.collection('subscriptions').findOne({
      userId,
      status: 'active',
    });

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel in Stripe
    await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);

    // Update in database
    await db.collection('subscriptions').updateOne(
      { id: subscription.id },
      { $set: { status: 'cancelled', cancelledAt: new Date() } }
    );

    await db.collection('users').updateOne(
      { id: userId },
      { $set: { subscriptionTier: 'free', subscriptionStatus: 'cancelled' } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Virtual gifts endpoints
app.get('/virtual-gifts', (req, res) => {
  res.json(VIRTUAL_GIFTS);
});

app.post('/virtual-gifts/send', async (req, res) => {
  try {
    const { senderId, streamId, giftType, quantity = 1, message } = req.body;

    const gift = VIRTUAL_GIFTS[giftType];
    if (!gift) {
      return res.status(400).json({ error: 'Invalid gift type' });
    }

    const totalCost = gift.price * quantity;

    // Check sender's wallet balance
    const wallet = await db.collection('wallets').findOne({ userId: senderId });
    if (!wallet || wallet.balance < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct from sender's wallet
    await db.collection('wallets').updateOne(
      { userId: senderId },
      { $inc: { balance: -totalCost } }
    );

    // Add to streamer's wallet
    await db.collection('wallets').updateOne(
      { userId: streamId },
      { $inc: { balance: totalCost } },
      { upsert: true }
    );

    // Record the gift transaction
    const giftRecord = {
      id: generateId(),
      senderId,
      streamId,
      giftType,
      giftName: gift.name,
      giftIcon: gift.icon,
      quantity,
      totalCost,
      message,
      createdAt: new Date(),
    };

    await db.collection('virtual_gifts').insertOne(giftRecord);

    // Create transaction records
    await db.collection('transactions').insertOne({
      id: generateId(),
      userId: senderId,
      type: 'gift_sent',
      amount: totalCost,
      currency: 'usd',
      status: 'completed',
      description: `Sent ${quantity}x ${gift.name} to stream`,
      metadata: { streamId, giftType, quantity },
      createdAt: new Date(),
    });

    await db.collection('transactions').insertOne({
      id: generateId(),
      userId: streamId,
      type: 'gift_received',
      amount: totalCost,
      currency: 'usd',
      status: 'completed',
      description: `Received ${quantity}x ${gift.name} from viewer`,
      metadata: { senderId, giftType, quantity },
      createdAt: new Date(),
    });

    // Publish event
    await producer.send({
      topic: 'payment-events',
      messages: [
        {
          value: JSON.stringify({
            type: 'gift_sent',
            data: giftRecord,
          }),
        },
      ],
    });

    res.json({ success: true, gift: giftRecord });
  } catch (error) {
    console.error('Error sending gift:', error);
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

app.get('/virtual-gifts/stream/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const { limit = '50' } = req.query;

    const gifts = await db.collection('virtual_gifts')
      .find({ streamId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .toArray();

    res.json(gifts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gifts' });
  }
});

// Ad revenue sharing endpoints
app.post('/ad-revenue/record', async (req, res) => {
  try {
    const { creatorId, periodStart, periodEnd, views, impressions, revenue } = req.body;

    // Get creator's subscription tier
    const creator = await db.collection('users').findOne({ id: creatorId });
    const tier = creator?.subscriptionTier || 'free';
    const sharePercentage = AD_REVENUE_SHARE[tier] || 0;

    const creatorShare = revenue * sharePercentage;
    const platformShare = revenue - creatorShare;

    const adRevenue = {
      id: generateId(),
      creatorId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      views,
      impressions,
      totalRevenue: revenue,
      sharePercentage,
      creatorShare,
      platformShare,
      status: 'pending',
      createdAt: new Date(),
    };

    await db.collection('ad_revenue').insertOne(adRevenue);

    // Add to creator's wallet
    if (creatorShare > 0) {
      await db.collection('wallets').updateOne(
        { userId: creatorId },
        { $inc: { balance: creatorShare } },
        { upsert: true }
      );
    }

    // Create earning record
    await db.collection('creator_earnings').insertOne({
      id: generateId(),
      creatorId,
      amount: creatorShare,
      source: 'ad_revenue',
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      status: 'paid',
      createdAt: new Date(),
    });

    res.json({ success: true, adRevenue });
  } catch (error) {
    console.error('Error recording ad revenue:', error);
    res.status(500).json({ error: 'Failed to record ad revenue' });
  }
});

app.get('/ad-revenue/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { limit = '12' } = req.query;

    const revenues = await db.collection('ad_revenue')
      .find({ creatorId })
      .sort({ periodStart: -1 })
      .limit(parseInt(limit as string))
      .toArray();

    res.json(revenues);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ad revenue' });
  }
});

// Premium content endpoints
app.post('/premium-content/create', async (req, res) => {
  try {
    const { contentId, creatorId, price, title, description } = req.body;

    const premiumContent = {
      id: generateId(),
      contentId,
      creatorId,
      price: parseFloat(price),
      title,
      description,
      status: 'active',
      createdAt: new Date(),
    };

    await db.collection('premium_content').insertOne(premiumContent);

    res.json({ success: true, content: premiumContent });
  } catch (error) {
    console.error('Error creating premium content:', error);
    res.status(500).json({ error: 'Failed to create premium content' });
  }
});

app.post('/premium-content/purchase', async (req, res) => {
  try {
    const { userId, contentId } = req.body;

    const premiumContent = await db.collection('premium_content').findOne({ contentId });
    if (!premiumContent) {
      return res.status(404).json({ error: 'Premium content not found' });
    }

    // Check if already purchased
    const existingPurchase = await db.collection('premium_content_purchases').findOne({
      userId,
      contentId,
    });

    if (existingPurchase) {
      return res.status(400).json({ error: 'Content already purchased' });
    }

    // Check user's wallet balance
    const wallet = await db.collection('wallets').findOne({ userId });
    if (!wallet || wallet.balance < premiumContent.price) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct from user's wallet
    await db.collection('wallets').updateOne(
      { userId },
      { $inc: { balance: -premiumContent.price } }
    );

    // Add to creator's wallet
    await db.collection('wallets').updateOne(
      { userId: premiumContent.creatorId },
      { $inc: { balance: premiumContent.price } },
      { upsert: true }
    );

    // Record purchase
    const purchase = {
      id: generateId(),
      userId,
      contentId,
      price: premiumContent.price,
      creatorId: premiumContent.creatorId,
      purchasedAt: new Date(),
    };

    await db.collection('premium_content_purchases').insertOne(purchase);

    // Create transaction
    await db.collection('transactions').insertOne({
      id: generateId(),
      userId,
      type: 'premium_content_purchase',
      amount: premiumContent.price,
      currency: 'usd',
      status: 'completed',
      description: `Purchased: ${premiumContent.title}`,
      metadata: { contentId, purchaseId: purchase.id },
      createdAt: new Date(),
    });

    res.json({ success: true, purchase });
  } catch (error) {
    console.error('Error purchasing premium content:', error);
    res.status(500).json({ error: 'Failed to purchase premium content' });
  }
});

app.get('/premium-content/check/:userId/:contentId', async (req, res) => {
  try {
    const { userId, contentId } = req.params;

    const purchase = await db.collection('premium_content_purchases').findOne({
      userId,
      contentId,
    });

    res.json({ hasAccess: !!purchase, purchase });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check access' });
  }
});

// Virtual currency (wallet) endpoints
app.get('/wallet/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    let wallet = await db.collection('wallets').findOne({ userId });

    if (!wallet) {
      wallet = {
        userId,
        balance: 0,
        currency: 'usd',
        createdAt: new Date(),
      };
      await db.collection('wallets').insertOne(wallet);
    }

    res.json(wallet);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

app.post('/wallet/topup', async (req, res) => {
  try {
    const { userId, amount, paymentMethodId } = req.body;

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      metadata: { userId, type: 'wallet_topup' },
    });

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment failed' });
    }

    // Add to wallet
    await db.collection('wallets').updateOne(
      { userId },
      { $inc: { balance: amount } },
      { upsert: true }
    );

    // Create transaction
    await db.collection('transactions').insertOne({
      id: generateId(),
      userId,
      type: 'wallet_topup',
      amount,
      currency: 'usd',
      status: 'completed',
      description: 'Wallet top-up',
      stripePaymentIntentId: paymentIntent.id,
      createdAt: new Date(),
    });

    const wallet = await db.collection('wallets').findOne({ userId });

    res.json({ success: true, wallet });
  } catch (error) {
    console.error('Error topping up wallet:', error);
    res.status(500).json({ error: 'Failed to top up wallet' });
  }
});

// Marketplace endpoints
app.post('/marketplace/listings', async (req, res) => {
  try {
    const { creatorId, title, description, price, type, imageUrl } = req.body;

    const listing = {
      id: generateId(),
      creatorId,
      title,
      description,
      price: parseFloat(price),
      type,
      imageUrl,
      status: 'active',
      createdAt: new Date(),
    };

    await db.collection('marketplace_listings').insertOne(listing);

    res.json({ success: true, listing });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

app.get('/marketplace/listings', async (req, res) => {
  try {
    const { creatorId, status = 'active', limit = '50' } = req.query;

    const filter: any = { status };
    if (creatorId) {
      filter.creatorId = creatorId;
    }

    const listings = await db.collection('marketplace_listings')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .toArray();

    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

app.post('/marketplace/purchase', async (req, res) => {
  try {
    const { buyerId, listingId } = req.body;

    const listing = await db.collection('marketplace_listings').findOne({
      id: listingId,
      status: 'active',
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Check buyer's wallet balance
    const wallet = await db.collection('wallets').findOne({ userId: buyerId });
    if (!wallet || wallet.balance < listing.price) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct from buyer's wallet
    await db.collection('wallets').updateOne(
      { userId: buyerId },
      { $inc: { balance: -listing.price } }
    );

    // Add to creator's wallet
    await db.collection('wallets').updateOne(
      { userId: listing.creatorId },
      { $inc: { balance: listing.price } },
      { upsert: true }
    );

    // Update listing status
    await db.collection('marketplace_listings').updateOne(
      { id: listingId },
      { $set: { status: 'sold', buyerId, soldAt: new Date() } }
    );

    // Create order
    const order = {
      id: generateId(),
      buyerId,
      listingId,
      creatorId: listing.creatorId,
      amount: listing.price,
      status: 'completed',
      createdAt: new Date(),
    };

    await db.collection('marketplace_orders').insertOne(order);

    // Create transaction
    await db.collection('transactions').insertOne({
      id: generateId(),
      userId: buyerId,
      type: 'marketplace_purchase',
      amount: listing.price,
      currency: 'usd',
      status: 'completed',
      description: `Purchased: ${listing.title}`,
      metadata: { listingId, orderId: order.id },
      createdAt: new Date(),
    });

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error purchasing from marketplace:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

// Donation endpoints
app.post('/donations/create', async (req, res) => {
  try {
    const { donorId, creatorId, amount, message, isAnonymous = false } = req.body;

    // Check donor's wallet balance
    const wallet = await db.collection('wallets').findOne({ userId: donorId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct from donor's wallet
    await db.collection('wallets').updateOne(
      { userId: donorId },
      { $inc: { balance: -amount } }
    );

    // Add to creator's wallet
    await db.collection('wallets').updateOne(
      { userId: creatorId },
      { $inc: { balance: amount } },
      { upsert: true }
    );

    // Record donation
    const donation = {
      id: generateId(),
      donorId: isAnonymous ? null : donorId,
      creatorId,
      amount: parseFloat(amount),
      message,
      isAnonymous,
      status: 'completed',
      createdAt: new Date(),
    };

    await db.collection('donations').insertOne(donation);

    // Create transaction
    await db.collection('transactions').insertOne({
      id: generateId(),
      userId: donorId,
      type: 'donation',
      amount,
      currency: 'usd',
      status: 'completed',
      description: 'Donation to creator',
      metadata: { creatorId, donationId: donation.id },
      createdAt: new Date(),
    });

    // Publish event
    await producer.send({
      topic: 'payment-events',
      messages: [
        {
          value: JSON.stringify({
            type: 'donation_received',
            data: donation,
          }),
        },
      ],
    });

    res.json({ success: true, donation });
  } catch (error) {
    console.error('Error creating donation:', error);
    res.status(500).json({ error: 'Failed to create donation' });
  }
});

app.get('/donations/:creatorId', async (req, res) => {
  try {
    const { creatorId } = req.params;
    const { limit = '50' } = req.query;

    const donations = await db.collection('donations')
      .find({ creatorId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .toArray();

    res.json(donations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

async function start() {
  try {
    await initializeDatabase();
    await initializeRedis();
    await initializeKafka();
    await initializeStripe();

    app.listen(PORT, () => {
      console.log(`Payment Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

start();
