// BullMQ Queue Configuration
// Handles background job processing with retry logic and DLQ

import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
});

// Queue options with retry strategy
const queueOptions: QueueOptions = {
    connection,
    defaultJobOptions: {
        attempts: 5, // Retry up to 5 times
        backoff: {
            type: 'exponential',
            delay: 1000, // Start with 1 second, then 2s, 4s, 8s, 16s
        },
        removeOnComplete: {
            count: 100, // Keep last 100 completed jobs
            age: 24 * 3600, // Keep for 24 hours
        },
        removeOnFail: {
            count: 500, // Keep last 500 failed jobs for debugging
        },
    },
};

// Order Fulfillment Queue
export const orderFulfillmentQueue = new Queue('order-fulfillment', queueOptions);

// Dead Letter Queue (for permanently failed jobs)
export const deadLetterQueue = new Queue('order-fulfillment-failed', {
    connection,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    await orderFulfillmentQueue.close();
    await deadLetterQueue.close();
    await connection.quit();
});

console.log('✅ BullMQ queues initialized');
