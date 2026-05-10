# Nexora Platform API Documentation

Base URL: `https://api.nexora.com`

## Authentication

All API requests require an API key in the Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

### Validate Token

Validate a user token.

**Endpoint:** `POST /auth/validate`

**Request Body:**
```json
{
  "token": "user-jwt-token"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "username": "username",
    "displayName": "Display Name",
    "avatar": "https://...",
    "bio": "User bio",
    "followers": 100,
    "following": 50,
    "isVerified": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

## Users

### Get User

Get user by ID.

**Endpoint:** `GET /users/:userId`

**Response:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "username": "username",
  "displayName": "Display Name",
  "avatar": "https://...",
  "bio": "User bio",
  "followers": 100,
  "following": 50,
  "isVerified": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Update User

Update user profile.

**Endpoint:** `PUT /users/:userId`

**Request Body:**
```json
{
  "displayName": "New Name",
  "bio": "New bio",
  "avatar": "https://..."
}
```

### Follow User

Follow a user.

**Endpoint:** `POST /users/:userId/follow`

**Response:**
```json
{
  "success": true
}
```

### Unfollow User

Unfollow a user.

**Endpoint:** `DELETE /users/:userId/follow`

**Response:**
```json
{
  "success": true
}
```

### Get Followers

Get user's followers.

**Endpoint:** `GET /users/:userId/followers`

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
[
  {
    "id": "user-id",
    "username": "follower",
    "avatar": "https://..."
  }
]
```

### Get Following

Get users that user is following.

**Endpoint:** `GET /users/:userId/following`

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
[
  {
    "id": "user-id",
    "username": "following",
    "avatar": "https://..."
  }
]
```

## Feed

### Get Feed

Get personalized feed.

**Endpoint:** `GET /feed`

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
[
  {
    "id": "post-id",
    "userId": "user-id",
    "username": "username",
    "content": "Post content",
    "type": "post",
    "mediaUrl": "https://...",
    "likes": 100,
    "comments": 50,
    "tags": ["tag1", "tag2"],
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

### Create Post

Create a new post.

**Endpoint:** `POST /feed/posts`

**Request Body:**
```json
{
  "content": "Post content",
  "mediaUrl": "https://...",
  "tags": ["tag1", "tag2"]
}
```

**Response:**
```json
{
  "id": "post-id",
  "userId": "user-id",
  "content": "Post content",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Like Post

Like a post.

**Endpoint:** `POST /feed/posts/:postId/like`

**Response:**
```json
{
  "success": true,
  "likes": 101
}
```

### Unlike Post

Unlike a post.

**Endpoint:** `DELETE /feed/posts/:postId/like`

**Response:**
```json
{
  "success": true,
  "likes": 100
}
```

### Comment on Post

Add a comment to a post.

**Endpoint:** `POST /feed/posts/:postId/comments`

**Request Body:**
```json
{
  "content": "Comment content"
}
```

**Response:**
```json
{
  "id": "comment-id",
  "postId": "post-id",
  "userId": "user-id",
  "content": "Comment content",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Get Post Comments

Get comments for a post.

**Endpoint:** `GET /feed/posts/:postId/comments`

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
[
  {
    "id": "comment-id",
    "postId": "post-id",
    "userId": "user-id",
    "username": "username",
    "content": "Comment content",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

## Messaging

### Get Conversations

Get user's conversations.

**Endpoint:** `GET /conversations`

**Response:**
```json
[
  {
    "id": "conversation-id",
    "participants": ["user-id-1", "user-id-2"],
    "lastMessage": {
      "id": "message-id",
      "content": "Last message",
      "timestamp": "2024-01-01T00:00:00Z"
    },
    "unreadCount": 2
  }
]
```

### Get Messages

Get messages for a conversation.

**Endpoint:** `GET /messages/conversation/:conversationId`

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
[
  {
    "id": "message-id",
    "senderId": "user-id",
    "receiverId": "user-id",
    "content": "Message content",
    "timestamp": "2024-01-01T00:00:00Z",
    "read": false
  }
]
```

### Send Message

Send a direct message.

**Endpoint:** `POST /messages/direct`

**Request Body:**
```json
{
  "senderId": "sender-id",
  "receiverId": "receiver-id",
  "content": "Message content"
}
```

**Response:**
```json
{
  "id": "message-id",
  "senderId": "sender-id",
  "receiverId": "receiver-id",
  "content": "Message content",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Mark Message as Read

Mark a message as read.

**Endpoint:** `POST /messages/:messageId/read`

**Response:**
```json
{
  "success": true
}
```

## Livestreams

### Get Active Livestreams

Get all active livestreams.

**Endpoint:** `GET /livestreams/active`

**Response:**
```json
[
  {
    "id": "stream-id",
    "broadcasterId": "user-id",
    "broadcasterName": "username",
    "title": "Stream Title",
    "description": "Stream description",
    "category": "Gaming",
    "thumbnailUrl": "https://...",
    "status": "live",
    "viewerCount": 1000,
    "likes": 500,
    "hlsUrl": "https://...",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

### Get Livestream

Get specific livestream details.

**Endpoint:** `GET /livestream/:streamId`

**Response:**
```json
{
  "id": "stream-id",
  "broadcasterId": "user-id",
  "broadcasterName": "username",
  "title": "Stream Title",
  "description": "Stream description",
  "category": "Gaming",
  "thumbnailUrl": "https://...",
  "status": "live",
  "viewerCount": 1000,
  "likes": 500,
  "hlsUrl": "https://...",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Start Livestream

Start a new livestream.

**Endpoint:** `POST /livestreams/start`

**Request Body:**
```json
{
  "title": "Stream Title",
  "description": "Stream description",
  "category": "Gaming"
}
```

**Response:**
```json
{
  "id": "stream-id",
  "streamKey": "stream-key",
  "rtmpUrl": "rtmp://...",
  "hlsUrl": "https://..."
}
```

### End Livestream

End a livestream.

**Endpoint:** `POST /livestreams/:streamId/end`

**Response:**
```json
{
  "success": true
}
```

### Like Livestream

Like a livestream.

**Endpoint:** `POST /livestream/:streamId/like`

**Response:**
```json
{
  "success": true,
  "likes": 501
}
```

### Send Stream Chat

Send a chat message to a livestream.

**Endpoint:** `POST /livestream/:streamId/chat`

**Request Body:**
```json
{
  "userId": "user-id",
  "username": "username",
  "content": "Chat message"
}
```

**Response:**
```json
{
  "success": true
}
```

### Get Stream Chat

Get chat messages for a livestream.

**Endpoint:** `GET /livestream/:streamId/chat`

**Response:**
```json
[
  {
    "id": "chat-id",
    "streamId": "stream-id",
    "userId": "user-id",
    "username": "username",
    "content": "Chat message",
    "timestamp": "2024-01-01T00:00:00Z"
  }
]
```

## Notifications

### Get Notifications

Get user's notifications.

**Endpoint:** `GET /notifications`

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
[
  {
    "id": "notification-id",
    "userId": "user-id",
    "type": "follow",
    "title": "New follower",
    "content": "Someone followed you",
    "data": {},
    "isRead": false,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]
```

### Mark Notification as Read

Mark a notification as read.

**Endpoint:** `POST /notifications/:notificationId/read`

**Response:**
```json
{
  "success": true
}
```

### Mark All Notifications as Read

Mark all notifications as read.

**Endpoint:** `POST /notifications/read-all`

**Response:**
```json
{
  "success": true
}
```

## Search

### Search

Search across users, posts, and livestreams.

**Endpoint:** `GET /search`

**Query Parameters:**
- `q` (required): Search query
- `type` (optional): Filter by type (all, users, posts, livestreams)
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
{
  "users": [],
  "posts": [],
  "livestreams": []
}
```

### Search Users

Search for users.

**Endpoint:** `GET /search/users`

**Query Parameters:**
- `q` (required): Search query
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
[
  {
    "id": "user-id",
    "username": "username",
    "displayName": "Display Name",
    "avatar": "https://...",
    "followers": 100
  }
]
```

## Recommendations

### Get Recommendations

Get personalized content recommendations.

**Endpoint:** `GET /recommendations`

**Query Parameters:**
- `limit` (optional): Number of results (default: 10)

**Response:**
```json
[
  {
    "id": "content-id",
    "type": "post",
    "score": 0.95,
    "reason": "Based on your interests",
    "content": {}
  }
]
```

### Record Behavior

Record user behavior for recommendation algorithm.

**Endpoint:** `POST /recommendations/behavior`

**Request Body:**
```json
{
  "userId": "user-id",
  "contentId": "content-id",
  "action": "like",
  "duration": 30
}
```

**Response:**
```json
{
  "success": true
}
```

## Error Responses

All endpoints may return error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `UNAUTHORIZED`: Invalid or missing API key
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request data
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Rate Limiting

- Standard rate limit: 1000 requests per hour
- WebSocket connections: 100 per hour per user

## Webhooks

Webhooks allow you to receive real-time notifications about events.

### Create Webhook

**Endpoint:** `POST /webhooks`

**Request Body:**
```json
{
  "url": "https://your-site.com/webhook",
  "events": ["user.followed", "post.created"]
}
```

**Response:**
```json
{
  "id": "webhook-id",
  "url": "https://your-site.com/webhook",
  "events": ["user.followed", "post.created"],
  "secret": "webhook-secret"
}
```

### Delete Webhook

**Endpoint:** `DELETE /webhooks/:webhookId`

**Response:**
```json
{
  "success": true
}
```

## WebSocket Events

Connect to the WebSocket at `wss://api.nexora.com`.

### Events

- `message`: New message received
- `notification`: New notification received
- `livestream_update`: Livestream status updated
- `user_presence`: User presence updated

### Example

```javascript
const socket = io('wss://api.nexora.com', {
  auth: {
    apiKey: 'your-api-key'
  }
});

socket.on('message', (message) => {
  console.log('New message:', message);
});
```
