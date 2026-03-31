# Chat System: Design & Architecture

This document outlines the decisions, trade-offs, and future scalability path for this chat application. The goal was to deliver a simple, reliable chat experience that feels like a real product, while setting up a foundation that demonstrates how to think about moving from a single-node prototype to a distributed system.

## Approach & Scope

When approaching an open-ended assignment, the primary challenge is scope management. I focused on building a rock-solid core rather than a brittle feature-factory.

**What's Covered:**
- Real-time bidirectional messaging.
- Identity management (custom JWT-based auth backed by PostgreSQL) to clearly separate who sent what.
- Multiple conversation support (a global channel + 1:1 direct messages) to prove out database relationship modeling.
- Presence tracking (Online/Offline status) + typing indicators to make the UI feel alive.

**What's Not Covered (Intentionally Omitted):**
- Read receipts, message editing, and reactions. (I added presence instead, as it provides a higher immediate impact on the "live" feel of the app).
- Media uploads (S3/presigned URLs). Pushes scope out too far for a lightweight prototype.
- End-to-end encryption. I kept to standard TLS transport-level encryption for simplicity.

## Architecture & Specific Choices

### 1. The Monorepo (Turborepo + pnpm)
I opted for a monorepo structure.
*Why:* It allows the frontend (`apps/web`) and backend (`apps/api`) to share strict TypeScript contracts via `packages/shared-types`. This eliminates an entire class of serialization errors and makes refactoring cheap. If I change a Socket payload type in the backend, the frontend build instantly catches the mismatch.

### 2. NestJS + TypeORM + PostgreSQL
*Why:* I wanted explicit database modeling rather than an opaque backend-as-a-service. Using Postgres gives strict consistency guarantees for chat history. TypeORM provides an easy migration path. NestJS was chosen for the backend because its built-in WebSockets gateway and dependency injection make testing and structuring scalable Socket architectures straightforward.

### 3. Custom Auth Validation
*Why:* I deliberately avoided using a third-party auth provider like Auth0. Third-party auth in a take-home often leads to rate-limiting or environment setup issues for reviewers. Building auth in-house (JWT + bcrypt) demonstrates an understanding of how to securely handle session tokens across both REST loops and WebSocket handshakes.

### 4. The Focus Feature: Online Presence
The prompt asked for one feature that improves the experience. I built a real-time presence system (the green dot). 
*Why:* In modern chat applications, knowing if the recipient is online sets expectations for response latency. It immediately bridges the gap between synchronous chat and asynchronous email. 
*How:* The `ChatGateway` tracks active WebSocket connections in memory, managing the edge case where a user has multiple browser tabs open (only marking them offline when the connection count reaches zero).

## Trade-offs & Current Failure Modes

Any system this size has deliberate trade-offs:

1. **Stateful WebSockets:** Currently, the WebSocket connections are terminated directly on the Node process. 
   - *Failure Mode:* If the API server crashes or deploys, all connections drop and clients have to reconnect. While Socket.IO handles the client-side reconnect natively, any messages sent during that 1-2 second window are lost unless we implement a client-side retry queue.
2. **In-Memory Presence:** The `activeUsers` map lives in the heap of the single NestJS instance. 
   - *Failure Mode:* If we scale this to two API instances behind a load balancer, User A (Node 1) won't see User B (Node 2) come online because the maps don't synchronize.
3. **Database Write Bottleneck:** Every message triggers an immediate synchronous `INSERT` into Postgres.
   - *Failure Mode:* During a massive spike in traffic (e.g., a popular global channel), Postgres connections will saturate, causing row lock contention and slowing the entire API.

## Path to Scale: Fault Tolerance & Strong Consistency

To take this system to a competitive tier serving millions of concurrent connections, I would evolve the architecture as follows:

1. **Scale Out WebSockets (Pub/Sub):**
   - Introduce **Redis** (specifically utilizing the `socket.io-redis` adapter). This allows horizontal scaling of the API instances. When Node 1 receives a message, it publishes to Redis, which fans it out to Node 2 where the recipient is connected. 
2. **Decouple Message Ingestion (Kafka/RabbitMQ):**
   - Instead of writing directly to Postgres on the WebSocket thread, the API should push message payloads to an event stream (like Kafka). A separate set of worker nodes would consume from this stream and batch-insert into Postgres. This protects the database from traffic spikes and ensures zero message loss.
3. **Distributed Presence (Redis Sets):**
   - Move the online/offline state out of Node memory and into Redis key-value pairs with short TTLs (Time-To-Live). The client sends a heartbeat ping every 10 seconds to keep their key alive.
4. **Read Scaling (Cassandra/ScyllaDB):**
   - While Postgres is great for relational data (Users, Conversations), time-series chat logs eventually outgrow a single relational instance. Migrating the `messages` table to a wide-column store like Cassandra offers massive write throughput and easy horizontal partitioning by `conversationId`.
