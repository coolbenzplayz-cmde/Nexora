# Messaging and Real-Time Communication System

## Overview

The messaging system inside Nexora is engineered as a real-time distributed communication infrastructure rather than a simple chat feature. It's designed to handle billions of messages per day while maintaining low latency, high reliability, and strong security.

## Message Flow Architecture

When a message is sent, it does not directly travel from one user to another. Instead, it follows a sophisticated pipeline:

```
User Device
    ↓
API Gateway
    ↓ [Authentication, Rate Limiting, Spam Analysis, Encryption Validation]
Event Stream (Kafka)
    ↓
Message Brokers (Redis Pub/Sub)
    ↓
Recipient Devices
```

### Pipeline Stages

1. **Client Upload** - Message encrypted on device
2. **API Gateway** - Initial validation and security checks
3. **Event Stream** - Durable event storage
4. **Message Brokers** - Real-time distribution
5. **Recipient Delivery** - Decrypted and displayed

## API Gateway Layer

The API gateway performs critical validation before messages enter the system:

### Authentication & Authorization

- JWT token validation
- Session verification
- Permission checks (blocked users, group membership)
- Device fingerprinting

### Rate Limiting

- Per-user message rate limits
- Per-device connection limits
- Global spam protection thresholds
- Dynamic adjustment based on trust score

### Spam Analysis

- Content pattern matching
- Behavioral anomaly detection
- Link reputation checking
- AI-powered spam classification

### Encryption Validation

- End-to-end encryption verification
- Key rotation checks
- Device key validation
- Forward secrecy enforcement

## Kafka Event Streaming

Kafka serves as the backbone for message persistence and distribution:

### Topic Structure

```
nexora.messages.incoming  - All incoming messages
nexora.messages.outgoing  - Messages ready for delivery
nexora.messages.receipts  - Read receipts and delivery confirmations
nexora.messages.typing    - Typing indicators
nexora.messages.presence  - Online/offline status changes
```

### Partitioning Strategy

- Partition by conversation ID for message ordering
- Partition by user ID for user-specific topics
- Time-based partitions for retention management
- Replication factor of 3 for fault tolerance

### Event Schema

```json
{
  "messageId": "uuid",
  "conversationId": "uuid",
  "senderId": "uuid",
  "recipientIds": ["uuid"],
  "content": "encrypted_payload",
  "contentType": "text|image|video|audio|file",
  "timestamp": "iso8601",
  "metadata": {
    "replyTo": "uuid",
    "mentions": ["uuid"],
    "hashtags": ["string"]
  }
}
```

## Redis Pub/Sub Real-Time Distribution

Redis provides the low-latency real-time layer for instant message delivery:

### Pub/Sub Channels

```
conversation:{conversationId}  - Message updates
user:{userId}:notifications    - User notifications
user:{userId}:typing           - Typing indicators
presence:{userId}              - Online status
```

### Connection Management

- Persistent WebSocket connections
- Connection pooling for scalability
- Automatic reconnection with exponential backoff
- Heartbeat monitoring for connection health

### Message Delivery Guarantees

- At-least-once delivery via Pub/Sub
- Deduplication at client level
- Offline message queueing
- Delivery receipt tracking

## Message Types and Features

### Supported Message Types

1. **Text Messages** - Plain text with rich formatting
2. **Images** - Compressed images with preview thumbnails
3. **Videos** - Short video clips with auto-play
4. **Audio** - Voice notes with transcription
5. **Files** - Document sharing with virus scanning
6. **Location** - Real-time location sharing
7. **Contacts** - Contact card sharing
8. **Reactions** - Emoji reactions to messages
9. **Replies** - Threaded conversations
10. **Mentions** - @mentions with notifications

### Advanced Features

#### Typing Indicators

- Real-time typing status
- Debounced to reduce noise
- Privacy-respecting (can be disabled)

#### Read Receipts

- Delivered status (message reached device)
- Read status (user opened message)
- Optional privacy mode
- Timestamp tracking

#### Message Reactions

- Emoji reactions with counts
- Reaction aggregation
- Notification for reactions

#### Message Search

- Full-text search across conversations
- Semantic search using embeddings
- Filter by date, sender, type
- Saved searches

## Group Chat Architecture

Group chats require additional complexity:

### Member Management

- Group creation and configuration
- Member invitation and removal
- Admin permissions
- Member roles and permissions

### Message Broadcasting

- Efficient broadcast to multiple recipients
- Fan-out optimization
- Offline member handling
- Delivery status tracking

### Group Features

- Group mentions (@everyone, @here)
- Pinned messages
- Group announcements
- Message expiration (self-destructing messages)

## End-to-End Encryption

### Key Management

- Signal Protocol for key exchange
- Double ratchet algorithm for forward secrecy
- Key rotation on device changes
- Backup key recovery

### Encryption Process

1. Sender encrypts with recipient's public key
2. Message travels encrypted through all systems
3. Recipient decrypts with private key
4. Systems cannot read message content

### Key Storage

- Keys stored in secure enclave (mobile)
- Keys encrypted at rest (web)
- Biometric protection for key access
- Secure key backup and recovery

## Offline Message Queueing

When users are offline, messages are queued:

### Queue Implementation

- Redis-based message queues
- Per-user queues
- TTL-based expiration
- Priority queue for important messages

### Sync on Reconnection

1. Client reconnects
2. Request queued messages
3. Apply conflict resolution
4. Mark messages as delivered
5. Update conversation state

## Scalability Considerations

### Horizontal Scaling

- Stateless message brokers
- Connection sharding by user ID
- Geographic distribution for low latency
- Load balancing across broker instances

### Performance Optimization

- Message compression
- Binary protocol for efficiency
- Connection pooling
- Batch processing for non-critical operations

### Global Synchronization

Conversations remain synchronized globally even during massive traffic spikes through:

- Geographic distribution of brokers
- Eventual consistency model
- Conflict resolution algorithms
- Multi-region data replication

## Monitoring and Observability

### Key Metrics

- Message throughput (messages/second)
- Delivery latency (p50, p95, p99)
- Connection count
- Error rates
- Queue depths

### Alerting

- High delivery latency
- Connection failures
- Queue backlog
- Encryption failures

## Integration with Other Systems

The messaging system integrates with:

- **Notification Service** - Push notifications for new messages
- **AI Service** - Smart replies, translation, moderation
- **Analytics Service** - Message analytics for insights
- **Moderation Service** - Content scanning for policy violations
- **Search Service** - Message indexing for search

## Future Enhancements

Planned features include:

- AI-powered message summarization
- Real-time translation
- Voice message enhancement
- Augmented reality messaging
- Blockchain-based message verification

The messaging system is designed to be the backbone of all real-time communication in Nexora, providing reliable, secure, and instant messaging at scale.
