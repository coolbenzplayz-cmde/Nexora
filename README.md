# Nexora Platform - Complete Implementation

Nexora is a comprehensive social media and livestreaming platform built with microservices architecture.

## Architecture

### Microservices (11 Services)

1. **API Gateway** (Port 8080) - Entry point for all API requests with JWT auth, rate limiting
2. **Auth Service** (Port 3001) - Authentication with PostgreSQL, Redis, session management
3. **Feed Service** (Port 3002) - Content feed with MongoDB, Kafka events, AI scoring
4. **Messaging Service** (Port 3003) - Real-time messaging with Socket.IO, groups, chat
5. **Livestream Service** (Port 3004) - RTMP streaming with HLS/DASH, viewer tracking
6. **User Service** (Port 3005) - User profiles, social graph, follow/unfollow, caching
7. **Recommendation Service** (Port 3006) - AI-powered recommendations with behavior tracking
8. **Notification Service** (Port 3007) - Push notifications, email, Firebase
9. **Payment Service** (Port 3008) - Payment processing with Stripe
10. **Search Service** (Port 3009) - Full-text search with Elasticsearch
11. **AI Inference Service** (Port 3010) - Content moderation, AI features, NLP

### Frontend Applications

- **Web App** (Port 3000) - React/Vite web application with complete UI
- **Mobile App** - Flutter mobile application with BLoC pattern
- **Admin Panel** (Port 3001) - React/Vite admin dashboard

## Project Structure

```
windsurf-project/
├── services/                    # Backend microservices
│   ├── api_gateway/
│   ├── auth_service/
│   ├── feed_service/
│   ├── messaging_service/
│   ├── livestream_service/
│   ├── user_service/
│   ├── recommendation_service/
│   ├── notification_service/
│   ├── payment_service/
│   ├── search_service/
│   └── ai_inference_service/
├── apps/                        # Frontend applications
│   ├── web/                    # React web app
│   ├── mobile/                 # Flutter mobile app
│   └── desktop/               # Desktop app placeholder
├── admin/                       # Admin panel
├── databases/                   # Database schemas
│   ├── postgres/
│   └── mongodb/
├── infrastructure/              # Infrastructure configs
│   └── monitoring/
├── sdk/                         # Third-party SDK
├── docs/                        # Documentation
└── .github/                     # GitHub workflows
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Databases**: PostgreSQL, MongoDB
- **Cache**: Redis
- **Message Queue**: Apache Kafka
- **Streaming**: RTMP with node-media-server
- **Search**: Elasticsearch
- **AI/ML**: TensorFlow.js, Natural NLP
- **Payments**: Stripe

### Frontend
- **Web**: React, Vite, TailwindCSS, Zustand, React Query
- **Mobile**: Flutter, BLoC pattern
- **Admin**: React, Vite, TailwindCSS

### Infrastructure
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus, Grafana
- **Alerting**: Alertmanager

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 7+
- PostgreSQL 15+
- Redis 7+
- Apache Kafka
- Elasticsearch 8+
- Docker & Docker Compose (optional)
- Flutter (for mobile app)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd windsurf-project
```

2. Install dependencies:
```bash
# Install service dependencies
cd services/api_gateway && npm install
# Repeat for all services

# Install web app
cd ../../apps/web && npm install

# Install admin panel
cd ../../admin && npm install

# Install SDK
cd ../sdk && npm install

# Install mobile app dependencies
cd ../apps/mobile && flutter pub get
```

3. Set up environment variables for each service

4. Run database migrations:
```bash
psql -U postgres -d nexora -f databases/postgres/migrations/001_initial.sql
```

### Running the Platform

#### Start Infrastructure Services
```bash
# Start MongoDB
mongod

# Start PostgreSQL
postgres

# Start Redis
redis-server

# Start Kafka
kafka-server-start.sh

# Start Elasticsearch
elasticsearch
```

#### Start Microservices
```bash
# In separate terminals for each service
cd services/api_gateway && npm run dev
cd services/auth_service && npm run dev
cd services/feed_service && npm run dev
# ... continue for all 11 services
```

#### Start Frontend Applications
```bash
# Web app (Port 3000)
cd apps/web && npm run dev

# Admin panel (Port 3001)
cd admin && npm run dev

# Mobile app
cd apps/mobile && flutter run
```

#### Start Monitoring
```bash
cd infrastructure/monitoring
docker-compose up -d
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
```

## API Documentation

Complete API documentation is available in `docs/API.md`.

## SDK Usage

The Nexora SDK provides a simple interface for third-party integrations:

```typescript
import NexoraSDK from '@nexora/sdk';

const sdk = new NexoraSDK({
  apiKey: 'your-api-key',
});

const user = await sdk.getUser('user-id');
```

See `sdk/README.md` for complete SDK documentation.

## CI/CD

The platform uses GitHub Actions for CI/CD:
- Automated testing on push
- Docker image building
- Kubernetes deployment
- Security scanning with Trivy
- Monitoring workflows

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Alertmanager**: http://localhost:9093

## Development

### Code Style
- Use TypeScript strict mode
- Follow functional programming patterns
- Document all public APIs

### Adding a New Service
1. Create service directory in `services/`
2. Initialize with `npm init`
3. Add dependencies
4. Create `src/index.ts` with Express app
5. Add health check endpoint
6. Update API Gateway to route to new service

## License

MIT License
