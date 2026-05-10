import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Bot,
  BrainCircuit,
  Car,
  Cloud,
  Code2,
  CreditCard,
  Database,
  Gamepad2,
  Globe2,
  Lock,
  MessageCircle,
  Radio,
  Rocket,
  Search,
  Server,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Tv,
  UserRound,
  Wallet,
  Zap,
} from 'lucide-react';
import './styles.css';

const stack = {
  Frontend: ['Flutter', 'React', 'Next.js', 'TailwindCSS', 'WebSockets', 'GraphQL'],
  Backend: ['Node.js', 'NestJS', 'Go services', 'Python AI services'],
  Databases: ['PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch'],
  Infrastructure: ['Docker', 'Kubernetes', 'NGINX', 'Kafka', 'CDN', 'Cloudflare'],
  AI: ['LLM models', 'Recommendation systems', 'Moderation AI', 'Fraud AI', 'Voice AI', 'Search AI'],
};

const services = [
  ['Auth Service', 'JWT, OAuth, MFA, device verification, token rotation, biometric authentication.', Lock],
  ['User Service', 'Profiles, followers, avatars, bios, interests, personalization signals.', UserRound],
  ['Chat Service', 'DMs, group chats, typing indicators, read receipts, voice notes, reactions.', MessageCircle],
  ['AI Service', 'LLMs, NLP, vision AI, smart replies, moderation, generation, recommendations.', BrainCircuit],
  ['Feed Service', 'Watch time, likes, shares, saves, ranking, embeddings, distribution.', Activity],
  ['Media Service', 'Video upload, encoding, compression, captions, CDN delivery.', Tv],
  ['Payment Service', 'Wallets, transfers, cards, refunds, fraud checks, PCI-minded tokenization.', CreditCard],
  ['Creator Service', 'Subscriptions, donations, paid content, revenue sharing, analytics.', Sparkles],
  ['Streaming Service', 'RTMP ingest, transcoding, HLS/DASH, live polls, gifts, super chats.', Radio],
  ['Game Engine', 'Multiplayer, matchmaking, real-time state sync, dedicated game servers.', Gamepad2],
  ['Mini Apps', 'Third-party embedded services, internal app store, commerce integrations.', Code2],
  ['Analytics Service', 'Engagement, retention, conversion, revenue, AI insights, trend signals.', Zap],
];

const functions = [
  ['Authentication System', 'Login, signup, MFA, OAuth, JWT, session management, risk analysis.'],
  ['User Profile System', 'Bios, usernames, followers, avatars, interests, AI personalization.'],
  ['Real-Time Messaging', 'DMs, groups, voice notes, stickers, typing indicators, read receipts.'],
  ['Voice & Video Calls', 'WebRTC, TURN/STUN, group calls, screen sharing, AI noise suppression.'],
  ['AI Assistant Engine', 'Recommendations, search, smart replies, moderation, AI generation.'],
  ['Personalized Feed Algorithm', 'Ranking from watch time, likes, shares, saves, session depth.'],
  ['Short Video System', 'Reels, encoding, compression, captions, CDN distribution.'],
  ['Long Video Streaming', '4K streaming, chunked delivery, DRM, HLS/DASH, edge caching.'],
  ['Live Streaming', 'RTMP ingest, transcoding, CDN viewing, gifts, polls, super chats.'],
  ['Creator Monetization', 'Subscriptions, donations, paid content, wallet payouts, analytics.'],
  ['Digital Wallet', 'Balances, rewards, creator earnings, transfers, QR payments, purchases.'],
  ['Payment Gateway', 'Card processing, mobile money, fraud detection, refunds, tokenization.'],
  ['AI Fraud Detection', 'Fake accounts, scam behavior, spam bots, payment abuse, risk scoring.'],
  ['Notification System', 'Push, SMS, email, in-app alerts using queues and Firebase/APNs.'],
  ['Search Engine', 'Users, videos, chats, posts, hashtags, Elasticsearch, semantic search.'],
  ['Trend Detection Engine', 'Viral content, hashtags, regional spikes, real-time clustering.'],
  ['AI Moderation', 'Images, videos, messages, comments, spam, toxicity, dangerous content.'],
  ['Content Delivery Network', 'Image, video, and download optimization with regional edge caching.'],
  ['Gaming Platform', 'Multiplayer games, matchmaking, real-time sync, UDP networking.'],
  ['Mini Apps Ecosystem', 'Food delivery, ticketing, shopping, embedded partner services.'],
  ['Ride-Hailing System', 'Driver matching, GPS tracking, fare estimation, passenger requests.'],
  ['Maps & Navigation', 'Live GPS, traffic optimization, geofencing, location sharing.'],
  ['E-Commerce Marketplace', 'Listings, checkout, reviews, inventory, recommendations, logistics.'],
  ['Delivery Logistics', 'Dispatching, courier tracking, route optimization, AI routing.'],
  ['Analytics Platform', 'Engagement, revenue, retention, conversion, big data pipelines.'],
  ['Cloud File Storage', 'Images, videos, documents, chat media, replication, redundancy.'],
  ['Recommendation AI', 'Friends, products, content suggestions, vectors, neural ranking.'],
  ['Admin Control Center', 'Bans, reports, system monitoring, monetization management.'],
  ['DevOps & Deployment', 'GitHub, CI/CD, Docker, Kubernetes, canary deployments, rollbacks.'],
  ['Security & Encryption Layer', 'E2EE, DDoS protection, TLS, OAuth2, JWT, WAF, zero trust.'],
];

const databases = [
  ['PostgreSQL', 'Users, transactions, orders, wallets', Database],
  ['MongoDB', 'Messages, feeds, comments', Server],
  ['Redis', 'Sessions, cache, real-time presence', Zap],
  ['Elasticsearch', 'Search indexes, trending data', Search],
  ['Object Storage', 'Videos, images, documents, chat media', Cloud],
];

const expansion = ['AR/VR social spaces', 'AI avatars', 'AI-generated worlds', 'Blockchain identity', 'AI coding assistant', 'Smart commerce AI', 'Cross-platform metaverse', 'AI operating system layer'];

function App() {
  return (
    <main>
      <section className="hero">
        <nav className="nav">
          <div className="brand"><span>N</span>NEXORA</div>
          <div className="navPills">
            <a href="#architecture">Architecture</a>
            <a href="#functions">30 Functions</a>
            <a href="#security">Security</a>
          </div>
        </nav>

        <div className="heroGrid">
          <div className="heroCopy">
            <p className="eyebrow"><Rocket size={16} /> Super app ecosystem blueprint</p>
            <h1>One cloud-native platform for social, AI, commerce, finance, streaming, gaming, and mobility.</h1>
            <p className="lead">Nexora is designed as a modular microservices ecosystem where every feature scales independently through APIs, Kafka events, distributed databases, real-time communication, and AI-first automation.</p>
            <div className="heroActions">
              <a href="#functions" className="primary">Explore Core Functions</a>
              <a href="#architecture" className="secondary">View System Map</a>
            </div>
          </div>

          <div className="systemCard" aria-label="Nexora architecture diagram">
            <div className="clientNode"><Smartphone /> Android · iOS · Web Clients</div>
            <div className="gateway">API Gateway<br /><span>Auth · Routing · Rate Limits</span></div>
            <div className="serviceMesh">
              {services.slice(0, 9).map(([name, detail, Icon]) => <div className="node" key={name}><Icon size={18} /><strong>{name}</strong><small>{detail.split(',')[0]}</small></div>)}
            </div>
            <div className="eventBus"><Globe2 size={20} /> Kafka / Event Bus · Real-time Messaging</div>
            <div className="storageRow">PostgreSQL <span /> Redis <span /> Object CDN</div>
          </div>
        </div>
      </section>

      <section className="section" id="architecture">
        <div className="sectionHeader">
          <p className="eyebrow"><Server size={16} /> Architecture</p>
          <h2>Cloud-native, event-driven, independently deployable services.</h2>
        </div>
        <div className="cards three">
          {services.map(([name, detail, Icon]) => <article className="card" key={name}><Icon /><h3>{name}</h3><p>{detail}</p></article>)}
        </div>
      </section>

      <section className="section split">
        <div>
          <p className="eyebrow"><Bot size={16} /> Technology stack</p>
          <h2>Built for real-time scale and AI-heavy workloads.</h2>
        </div>
        <div className="stackGrid">
          {Object.entries(stack).map(([title, items]) => <div className="stack" key={title}><h3>{title}</h3>{items.map(item => <span key={item}>{item}</span>)}</div>)}
        </div>
      </section>

      <section className="section" id="functions">
        <div className="sectionHeader">
          <p className="eyebrow"><Sparkles size={16} /> 30 major functions</p>
          <h2>The full Nexora product surface mapped into scalable platform modules.</h2>
        </div>
        <div className="functionGrid">
          {functions.map(([title, text], index) => <article className="function" key={title}><b>{String(index + 1).padStart(2, '0')}</b><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className="section split darkPanel">
        <div>
          <p className="eyebrow"><Database size={16} /> Data architecture</p>
          <h2>Polyglot persistence for relational, document, cache, search, and media workloads.</h2>
        </div>
        <div className="databaseGrid">
          {databases.map(([name, text, Icon]) => <div className="database" key={name}><Icon /><div><h3>{name}</h3><p>{text}</p></div></div>)}
        </div>
      </section>

      <section className="section flow">
        <div className="sectionHeader">
          <p className="eyebrow"><Activity size={16} /> Event-driven flow</p>
          <h2>Upload once. Moderate, rank, distribute, analyze, and notify through decoupled events.</h2>
        </div>
        <div className="pipeline">
          {['User uploads video', 'Kafka event', 'AI moderation', 'Recommendation engine', 'Feed distribution', 'Notifications'].map(step => <div key={step}>{step}</div>)}
        </div>
      </section>

      <section className="section split" id="security">
        <div>
          <p className="eyebrow"><ShieldCheck size={16} /> Security and scale</p>
          <h2>Zero-trust service boundaries with encrypted traffic and horizontally scalable infrastructure.</h2>
        </div>
        <div className="securityGrid">
          {['TLS everywhere', 'OAuth2 and JWT validation', 'End-to-end encryption', 'WAF and DDoS defense', 'Device fingerprinting', 'AI fraud prevention', 'Kubernetes auto-scaling', 'CDN edge replication'].map(item => <span key={item}><ShieldCheck size={16} />{item}</span>)}
        </div>
      </section>

      <section className="section future">
        <p className="eyebrow"><Wallet size={16} /> Future expansion</p>
        <h2>Nexora can expand into metaverse spaces, identity, AI assistants, and smart commerce layers.</h2>
        <div>{expansion.map(item => <span key={item}>{item}</span>)}</div>
      </section>

      <section className="section docs">
        <div className="sectionHeader">
          <p className="eyebrow"><Code2 size={16} /> Detailed documentation</p>
          <h2>Deep-dive into each system architecture, implementation details, and operational patterns.</h2>
        </div>
        <div className="docsGrid">
          {[
            { title: 'Frontend Architecture', desc: 'Smart client design, modular UI domains, dynamic feed rendering, performance optimization', file: 'docs/01-frontend-architecture.md', icon: Smartphone },
            { title: 'Messaging System', desc: 'Real-time distributed communication, Kafka events, Redis Pub/Sub, end-to-end encryption', file: 'docs/02-messaging-system.md', icon: MessageCircle },
            { title: 'Video & Streaming', desc: 'Short video engine, 4K streaming, live infrastructure, WebRTC calls, CDN delivery', file: 'docs/03-video-streaming.md', icon: Tv },
            { title: 'AI & Recommendation', desc: 'Embedding generation, vector databases, ranking models, psychological modeling', file: 'docs/04-ai-recommendation.md', icon: BrainCircuit },
            { title: 'Infrastructure & Deployment', desc: 'Kubernetes orchestration, Kafka event system, Redis caching, Docker containerization', file: 'docs/05-infrastructure-deployment.md', icon: Server },
            { title: 'Security & Analytics', desc: 'Zero-trust architecture, fraud detection, monitoring, data pipeline, compliance', file: 'docs/06-security-analytics.md', icon: ShieldCheck },
            { title: 'Gaming & Mini Apps', desc: 'Dedicated game servers, matchmaking, mini app ecosystem, developer platform', file: 'docs/07-gaming-mini-apps.md', icon: Gamepad2 },
            { title: 'Ride-Hailing & Logistics', desc: 'Geospatial infrastructure, matching engine, route optimization, delivery dispatch', file: 'docs/08-ride-hailing-logistics.md', icon: Car },
            { title: 'Creator Monetization', desc: 'Wallet system, subscriptions, super chats, gifts, fraud detection, payouts', file: 'docs/09-creator-monetization.md', icon: Wallet },
            { title: 'Search & Discovery', desc: 'Semantic search, embeddings, vector databases, intent recognition, personalization', file: 'docs/10-search-discovery.md', icon: Search },
            { title: 'Admin System', desc: 'Control center infrastructure, moderation, security operations, financial oversight, AI supervision, audit trails', file: 'docs/11-admin-system.md', icon: ShieldCheck },
          ].map(({ title, desc, file, icon: Icon }) => (
            <a href={file} className="docCard" key={title} target="_blank" rel="noopener noreferrer">
              <Icon />
              <div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer>
        <strong>NEXORA</strong>
        <p>Microservices · API Gateway · Kafka · AI Systems · Distributed Data · Real-time Communication</p>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
