# Nexora SDK

Official JavaScript/TypeScript SDK for the Nexora Platform.

## Installation

```bash
npm install @nexora/sdk
```

## Quick Start

```typescript
import NexoraSDK from '@nexora/sdk';

const sdk = new NexoraSDK({
  apiKey: 'your-api-key',
  apiUrl: 'https://api.nexora.com',
});

// Get user information
const user = await sdk.getUser('user-id');
console.log(user);
```

## Authentication

```typescript
// Validate a token
const user = await sdk.authenticate('user-token');
```

## Users

```typescript
// Get user
const user = await sdk.getUser('user-id');

// Update user
const updatedUser = await sdk.updateUser('user-id', {
  displayName: 'New Name',
  bio: 'New bio',
});

// Follow user
await sdk.followUser('current-user-id', 'target-user-id');

// Unfollow user
await sdk.unfollowUser('current-user-id', 'target-user-id');

// Search users
const users = await sdk.searchUsers('john', 20);
```

## Feed

```typescript
// Get feed
const posts = await sdk.getFeed(20, 0);

// Create post
const post = await sdk.createPost('Hello world!', null, ['greeting']);

// Like post
await sdk.likePost('post-id');

// Unlike post
await sdk.unlikePost('post-id');

// Comment on post
await sdk.commentOnPost('post-id', 'Great post!');

// Get post comments
const comments = await sdk.getPostComments('post-id');
```

## Messaging

```typescript
// Get conversations
const conversations = await sdk.getConversations();

// Get messages
const messages = await sdk.getMessages('conversation-id');

// Send message
const message = await sdk.sendMessage('receiver-id', 'Hello!');

// Mark message as read
await sdk.markMessageAsRead('message-id');
```

## Livestreams

```typescript
// Get active livestreams
const streams = await sdk.getActiveLivestreams();

// Get specific livestream
const stream = await sdk.getLivestream('stream-id');

// Start livestream
const newStream = await sdk.startLivestream({
  title: 'My Stream',
  description: 'Streaming now!',
  category: 'Gaming',
});

// End livestream
await sdk.endLivestream('stream-id');

// Like livestream
await sdk.likeLivestream('stream-id');

// Send chat message
await sdk.sendStreamChat('stream-id', 'Hello everyone!');

// Get stream chat
const chat = await sdk.getStreamChat('stream-id');
```

## Notifications

```typescript
// Get notifications
const notifications = await sdk.getNotifications(20);

// Mark notification as read
await sdk.markNotificationAsRead('notification-id');

// Mark all as read
await sdk.markAllNotificationsAsRead();
```

## Search

```typescript
// Search everything
const results = await sdk.search('gaming');

// Search specific type
const results = await sdk.search('gaming', 'posts');
```

## Recommendations

```typescript
// Get personalized recommendations
const recommendations = await sdk.getRecommendations(10);

// Record user behavior
await sdk.recordBehavior({
  contentId: 'post-id',
  action: 'like',
  duration: 30,
});
```

## WebSocket / Real-time

```typescript
// Connect
const socket = sdk.connectWebSocket();

// Listen for messages
sdk.onMessage((message) => {
  console.log('New message:', message);
});

// Listen for notifications
sdk.onNotification((notification) => {
  console.log('New notification:', notification);
});

// Listen for livestream updates
sdk.onLivestreamUpdate((stream) => {
  console.log('Stream updated:', stream);
});

// Disconnect
sdk.disconnectWebSocket();
```

## Webhooks

```typescript
// Create webhook
const webhook = await sdk.createWebhook('https://your-site.com/webhook', [
  'user.followed',
  'post.created',
]);

// Get webhooks
const webhooks = await sdk.getWebhooks();

// Delete webhook
await sdk.deleteWebhook('webhook-id');
```

## Error Handling

The SDK throws errors for failed requests. Always wrap your API calls in try-catch:

```typescript
try {
  const user = await sdk.getUser('user-id');
} catch (error) {
  console.error('Failed to get user:', error);
}
```

## License

MIT
