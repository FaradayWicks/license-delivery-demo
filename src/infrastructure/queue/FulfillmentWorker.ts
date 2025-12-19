// Fulfillment Worker
// Processes order fulfillment jobs from the queue
// Handles retries automatically via BullMQ configuration

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { FulfillmentService } from '../../application/services/FulfillmentService';
import { deadLetterQueue } from './BullMQConfig';

interface FulfillOrderJobData {
    orderId: string;
}

// Redis connection for worker
const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
});

const fulfillmentService = new FulfillmentService();

// Worker to process fulfillment jobs
export const fulfillmentWorker = new Worker<FulfillOrderJobData>(
    'order-fulfillment',
    async (job: Job<FulfillOrderJobData>) => {
        const { orderId } = job.data;

        console.log(`[Worker] Processing order fulfillment: ${orderId} (Attempt ${job.attemptsMade + 1}/5)`);

        try {
            await fulfillmentService.fulfillOrder(orderId);
            console.log(`[Worker] ✅ Order ${orderId} fulfilled successfully`);
            return { success: true, orderId };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Worker] ❌ Order ${orderId} fulfillment failed: ${errorMessage}`);

            // If this is the last attempt, send to DLQ
            if (job.attemptsMade >= 4) {
                console.error(`[Worker] 🚨 Order ${orderId} moved to Dead Letter Queue after 5 failed attempts`);
                await deadLetterQueue.add('failed-order', {
                    orderId,
                    originalJobId: job.id,
                    error: errorMessage,
                    attempts: job.attemptsMade + 1,
                });
            }

            throw error; // Re-throw to trigger BullMQ retry
        }
    },
    {
        connection,
        concurrency: 5, // Process up to 5 jobs concurrently
    }
);

// Worker event listeners
fulfillmentWorker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id ?? 'unknown'} completed`);
});

fulfillmentWorker.on('failed', (job, err) => {
    if (job) {
        console.log(`[Worker] Job ${job.id ?? 'unknown'} failed with error: ${err.message}`);
    }
});

fulfillmentWorker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    await fulfillmentWorker.close();
    await connection.quit();
});

console.log('✅ Fulfillment worker started');
