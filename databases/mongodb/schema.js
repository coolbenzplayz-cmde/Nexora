# MongoDB Schema Definitions
# These are the schema definitions for MongoDB collections

# Users Collection
"""
{
  "_id": ObjectId,
  "id": "string (UUID)",
  "email": "string",
  "username": "string",
  "displayName": "string",
  "avatar": "string",
  "bio": "string",
  "followers": "number",
  "following": "number",
  "isVerified": "boolean",
  "isCreator": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
"""

# Feeds Collection
"""
{
  "_id": ObjectId,
  "id": "string",
  "userId": "string",
  "content": "string",
  "type": "post|video|image|livestream",
  "mediaUrl": "string",
  "likes": "number",
  "comments": "number",
  "shares": "number",
  "aiScore": "number",
  "tags": ["string"],
  "createdAt": "Date"
}
"""

# Messages Collection
"""
{
  "_id": ObjectId,
  "id": "string",
  "senderId": "string",
  "receiverId": "string",
  "groupId": "string",
  "content": "string",
  "type": "text|image|video|audio|file",
  "mediaUrl": "string",
  "timestamp": "Date",
  "read": "boolean",
  "reactions": {
    "userId": "emoji"
  },
  "replyTo": "string"
}
"""

# Conversations Collection
"""
{
  "_id": ObjectId,
  "id": "string",
  "participants": ["string"],
  "lastMessage": {
    "id": "string",
    "content": "string",
    "timestamp": "Date"
  },
  "unreadCount": {
    "userId": "number"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
"""

# Groups Collection
"""
{
  "_id": ObjectId,
  "id": "string",
  "name": "string",
  "description": "string",
  "avatar": "string",
  "ownerId": "string",
  "members": ["string"],
  "admins": ["string"],
  "createdAt": "Date"
}
"""

# Livestreams Collection
"""
{
  "_id": ObjectId,
  "id": "string",
  "streamKey": "string",
  "broadcasterId": "string",
  "title": "string",
  "description": "string",
  "category": "string",
  "thumbnailUrl": "string",
  "status": "preparing|live|ended|error",
  "viewerCount": "number",
  "likes": "number",
  "startTime": "Date",
  "endTime": "Date",
  "duration": "number",
  "recordingUrl": "string",
  "hlsUrl": "string",
  "dashUrl": "string",
  "rtmpUrl": "string",
  "createdAt": "Date"
}
"""

# Stream Chat Collection
"""
{
  "_id": ObjectId,
  "id": "string",
  "streamId": "string",
  "userId": "string",
  "username": "string",
  "content": "string",
  "timestamp": "Date"
}
"""

# Recommendations Collection
"""
{
  "_id": ObjectId,
  "userId": "string",
  "contentId": "string",
  "contentType": "post|video|livestream|user|music",
  "score": "number",
  "reason": "string",
  "timestamp": "Date"
}
"""

# User Behaviors Collection
"""
{
  "_id": ObjectId,
  "userId": "string",
  "contentId": "string",
  "action": "view|like|share|comment|follow|skip",
  "timestamp": "Date",
  "duration": "number"
}
"""

# Index Definitions
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "username": 1 }, { unique: true })
db.feeds.createIndex({ "userId": 1, "createdAt": -1 })
db.feeds.createIndex({ "type": 1, "createdAt": -1 })
db.feeds.createIndex({ "tags": 1 })
db.messages.createIndex({ "senderId": 1, "timestamp": -1 })
db.messages.createIndex({ "receiverId": 1, "timestamp": -1 })
db.messages.createIndex({ "groupId": 1, "timestamp": -1 })
db.conversations.createIndex({ "participants": 1 })
db.groups.createIndex({ "members": 1 })
db.livestreams.createIndex({ "broadcasterId": 1, "createdAt": -1 })
db.livestreams.createIndex({ "status": 1 })
db.stream_chat.createIndex({ "streamId": 1, "timestamp": -1 })
db.recommendations.createIndex({ "userId": 1, "score": -1 })
db.user_behaviors.createIndex({ "userId": 1, "timestamp": -1 })
db.user_behaviors.createIndex({ "contentId": 1 })
