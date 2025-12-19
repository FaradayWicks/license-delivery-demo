# License Delivery Demo

A demonstration of **resilient license delivery architecture** with idempotent webhook processing, background job queues, and provider-agnostic design.

## 🎯 Key Features

- ✅ **Idempotent Webhook Processing** - Duplicate webhooks handled gracefully via database unique constraints
- ✅ **Async Background Jobs** - BullMQ with Redis for reliable job processing
- ✅ **Automatic Retries** - Exponential backoff (5 attempts: 1s, 2s, 4s, 8s, 16s)
- ✅ **Dead Letter Queue** - Failed jobs after 5 retries moved to DLQ for investigation
- ✅ **Provider Agnostic** - Swap license providers without changing business logic
- ✅ **Clean Architecture** - Clear separation: Domain → Application → Infrastructure → Presentation

## 🏗️ Architecture

```mermaid
sequenceDiagram
    participant Stripe
    participant Webhook API
    participant Database
    participant Queue
    participant Worker
    participant Provider

    Stripe->>Webhook API: POST /webhooks/stripe
    Webhook API->>Database: Create WebhookEvent (unique constraint)
    alt Event already exists
        Database-->>Webhook API: Unique constraint violation
        Webhook API-->>Stripe: 200 OK (duplicate)
    else New event
        Database-->>Webhook API: Event created
        Webhook API->>Database: Create Order (transaction)
        Webhook API->>Queue: Enqueue fulfillment job
        Webhook API-->>Stripe: 200 OK (processed)
        
        Queue->>Worker: Process job
        Worker->>Provider: Reserve license key
        alt Provider success
            Provider-->>Worker: License key
            Worker->>Database: Store license key
            Worker->>Provider: Deliver to customer
            Worker->>Database: Mark order FULFILLED
        else Provider failure
            Provider-->>Worker: Error
            Worker->>Queue: Retry (exponential backoff)
            Note over Queue,Worker: After 5 failures → DLQ
        end
    end
```

## 📁 Project Structure

```
src/
├── domain/                    # Business entities and interfaces
│   ├── entities/
│   │   ├── Order.ts          # Order domain model
│   │   └── LicenseKey.ts     # License key domain model
│   └── interfaces/
│       ├── ILicenseProvider.ts   # Provider abstraction
│       └── IOrderRepository.ts   # Repository contract
│
├── application/               # Use cases and services
│   └── services/
│       ├── WebhookService.ts     # Idempotent webhook processing
│       └── FulfillmentService.ts # License delivery orchestration
│
├── infrastructure/            # External integrations
│   ├── database/
│   │   └── PrismaClient.ts       # Database connection
│   ├── queue/
│   │   ├── BullMQConfig.ts       # Queue configuration
│   │   └── FulfillmentWorker.ts  # Background worker
│   └── providers/
│       ├── MockLicenseProvider.ts    # Mock provider (demo)
│       └── ProviderFactory.ts        # Provider factory
│
├── presentation/              # HTTP API layer
│   ├── controllers/
│   │   └── WebhookController.ts  # Webhook endpoint
│   ├── routes/
│   │   └── index.ts              # Route configuration
│   ├── middleware/
│   │   └── errorHandler.ts       # Error handling
│   └── server.ts                 # Express app entry point
│
prisma/
└── schema.prisma              # Database schema with unique constraints

scripts/
└── send-webhook.ts            # Test script
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Start PostgreSQL and Redis
docker-compose up -d

# 4. Run database migrations
npm run prisma:migrate

# 5. Start development server
npm run dev
```

The server will start on `http://localhost:3000`

## 🧪 Testing Scenarios

All tests can be run while the development server is running. Watch the server logs to see the processing in real-time.

### Test 1: Idempotency (Duplicate Webhook)

**Purpose:** Verify that duplicate webhooks don't create duplicate orders.

**Steps:**
```bash
# Send first webhook with event ID "evt_test_001"
npm run test:webhook -- evt_test_001

# Send duplicate with same event ID
npm run test:webhook -- evt_test_001
```

**Expected Result:**
- **First request:** 
  ```json
  {
    "processed": true,
    "orderId": "..."
  }
  ```
- **Second request:** 
  ```json
  {
    "processed": false,
    "reason": "duplicate"
  }
  ```
- **Database:** Only ONE `WebhookEvent` record for `evt_test_001` (verify with `npm run prisma:studio`)

---

### Test 2: Async Processing (Fast Response)

**Purpose:** Verify webhook endpoint returns quickly without waiting for fulfillment.

**Steps:**
```bash
# Send webhook and observe response time
npm run test:webhook -- evt_async_test
```

**Expected Result:**
- **Response time:** Displayed in output (should be < 100ms)
- **Server logs:** Show webhook returns immediately, then worker processes job in background
- **Output shows:** `⏱️ Response time: XXms`

---

### Test 3: Retry Logic (Provider Failure)

**Purpose:** Verify automatic retries with exponential backoff when provider fails.

**Steps:**

1. **Stop the current server** (Press `Ctrl+C` in the terminal running `npm run dev`)

2. **Edit `.env` file** and change:
   ```bash
   MOCK_PROVIDER_FAILURE_RATE=0.7
   ```
   (This makes the mock provider fail 70% of the time)

3. **Restart server:**
   ```bash
   npm run dev
   ```

4. **Send webhook:**
   ```bash
   npm run test:webhook -- evt_retry_test
   ```

5. **Watch server logs** for retry attempts

**Expected Result:**
- **Server logs show:** Multiple retry attempts with delays (1s, 2s, 4s, 8s, 16s)
- **Example log:**
  ```
  [Worker] Processing order fulfillment: xxx (Attempt 1/5)
  [Worker] ❌ Order xxx fulfillment failed
  [Worker] Processing order fulfillment: xxx (Attempt 2/5)
  [Worker] ❌ Order xxx fulfillment failed
  [Worker] Processing order fulfillment: xxx (Attempt 3/5)
  [Worker] ✅ Order xxx fulfilled successfully
  ```
- **Outcome:** Job eventually succeeds after retries

---

### Test 4: Dead Letter Queue (Permanent Failure)

**Purpose:** Verify failed jobs move to DLQ after max retries.

**Steps:**

1. **Stop the current server** (Press `Ctrl+C`)

2. **Edit `.env` file** and change:
   ```bash
   MOCK_PROVIDER_FAILURE_RATE=1.0
   ```
   (This makes the provider fail 100% of the time)

3. **Restart server:**
   ```bash
   npm run dev
   ```

4. **Send webhook:**
   ```bash
   npm run test:webhook -- evt_dlq_test
   ```

5. **Watch server logs** for all 5 retry attempts and DLQ message

**Expected Result:**
- **Server logs show:** 5 failed attempts with exponential backoff delays
- **Final log message:**
  ```
  [Worker] 🚨 Order xxx moved to Dead Letter Queue after 5 failed attempts
  ```
- **Database:** Order status is `FAILED` (verify with `npm run prisma:studio`)
- **DLQ:** Contains failed job details for manual investigation

---

### Reset to Normal Operation

After testing, reset the failure rate:

1. **Edit `.env` file:**
   ```bash
   MOCK_PROVIDER_FAILURE_RATE=0.0
   ```

2. **Restart server:**
   ```bash
   npm run dev
   ```


## 📊 Database Schema

### WebhookEvent (Idempotency Table)

```prisma
model WebhookEvent {
  id          String   @id @default(uuid())
  externalId  String   @unique  // ← Prevents duplicates
  provider    Provider
  eventType   String
  payload     Json
  processedAt DateTime?
  createdAt   DateTime @default(now())
}
```

The `@unique` constraint on `externalId` is the **critical mechanism** for idempotency.

### Order

```prisma
model Order {
  id              String      @id @default(uuid())
  externalOrderId String
  productId       String
  customerEmail   String
  status          OrderStatus @default(PENDING)
  webhookEventId  String
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

enum OrderStatus {
  PENDING
  PROCESSING
  FULFILLED
  FAILED
}
```

### LicenseKey

```prisma
model LicenseKey {
  id          String    @id @default(uuid())
  orderId     String
  productId   String
  licenseKey  String    // In production: encrypt this
  providerId  String
  deliveredAt DateTime?
  createdAt   DateTime  @default(now())
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://demo_user:demo_password@localhost:5432/license_delivery"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3000
NODE_ENV=development

# Mock Provider (for testing)
MOCK_PROVIDER_FAILURE_RATE=0.0      # 0.0 = no failures, 1.0 = always fail
MOCK_PROVIDER_MIN_DELAY_MS=50
MOCK_PROVIDER_MAX_DELAY_MS=200
```

## 📡 API Endpoints

### POST /webhooks/stripe

Receive Stripe webhook events.

**Request:**
```json
{
  "id": "evt_1234567890",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_abc123",
      "customer_email": "customer@example.com",
      "metadata": {
        "product_id": "windows-10-pro"
      }
    }
  }
}
```

**Response:**
```json
{
  "received": true,
  "processed": true,
  "orderId": "a7e61353-b54b-4f70-9a9f-2a76a50c2a44"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-19T13:30:00.000Z",
  "service": "license-delivery-demo"
}
```

## 🎓 Design Patterns Demonstrated

### 1. Idempotency via Database Constraint

Instead of checking "if exists" (race condition), we **attempt to insert** and catch the unique constraint violation:

```typescript
try {
  await db.webhookEvent.create({ data: { externalId: eventId } });
} catch (UniqueConstraintError) {
  return { processed: false, reason: 'duplicate' };
}
```

### 2. Provider Adapter Pattern

```typescript
interface ILicenseProvider {
  reserveKey(productId: string): Promise<LicenseKeyData>;
  deliverKey(orderId: string, email: string, key: string): Promise<void>;
  releaseKey(keyId: string): Promise<void>;
}

// Swap providers without changing business logic
const provider = ProviderFactory.createLicenseProvider();
```

### 3. Transactional Outbox Pattern

Webhook event creation + order creation + job enqueue happen in a **single transaction**:

```typescript
await db.$transaction(async (tx) => {
  const event = await tx.webhookEvent.create({ ... });
  const order = await tx.order.create({ ... });
  await queue.add('fulfill-order', { orderId: order.id });
});
```

### 4. Retry with Exponential Backoff

```typescript
{
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000  // 1s → 2s → 4s → 8s → 16s
  }
}
```

## 🚧 Production Considerations

This is a **demo**. For production deployment:

### Security
- [ ] Implement real Stripe signature verification
- [ ] Encrypt license keys in database
- [ ] Add authentication/authorization
- [ ] Use environment-specific secrets management (AWS Secrets Manager, Vault)

### Monitoring
- [ ] Add structured logging (Winston, Pino)
- [ ] Integrate APM (Datadog, New Relic)
- [ ] Set up alerts for DLQ items
- [ ] Monitor queue depth and processing times

### Scalability
- [ ] Horizontal scaling for workers
- [ ] Database connection pooling
- [ ] Redis Cluster for high availability
- [ ] Rate limiting on webhook endpoint

### Email Delivery
- [ ] Replace console.log with real email service (SendGrid, AWS SES)
- [ ] Add email templates
- [ ] Track delivery status

### Real Keysender Integration
- [ ] Implement `KeysenderProvider` class
- [ ] Add API credentials management
- [ ] Handle Keysender-specific errors
- [ ] Implement inventory checks

## 📝 Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio (DB GUI)
npm run test:webhook     # Send test webhook
npm run docker:up        # Start Docker services
npm run docker:down      # Stop Docker services
```

## 🐛 Debugging

### View Database Records

```bash
npm run prisma:studio
```

Opens a GUI at `http://localhost:5555` to inspect:
- WebhookEvents (check `externalId` uniqueness)
- Orders (check status transitions)
- LicenseKeys (check delivery)

### View Queue Jobs

Install Bull Board (optional):

```bash
npm install @bull-board/express @bull-board/api
```

Add to `server.ts` to visualize queue at `http://localhost:3000/admin/queues`

### Check Logs

All operations are logged to console with prefixes:
- `[WebhookService]` - Webhook processing
- `[FulfillmentService]` - License delivery
- `[Worker]` - Background job processing
- `[MockProvider]` - Provider operations

## 📄 License

ISC

## 👤 Author

Muhammad Mujtaba Rehman

---

**Built to demonstrate:**
- Idempotent webhook processing
- Async job queues with retries
- Provider-agnostic architecture
- Clean architecture principles
- Resilient distributed systems
