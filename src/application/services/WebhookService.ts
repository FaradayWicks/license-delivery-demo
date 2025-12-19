// Webhook Service
// Handles idempotent webhook processing
// Uses database unique constraint to prevent duplicate processing

import { prisma } from '../../infrastructure/database/PrismaClient';
import { Provider } from '@prisma/client';
import { orderFulfillmentQueue } from '../../infrastructure/queue/BullMQConfig';

interface StripeWebhookPayload {
    id: string;
    type: string;
    data: {
        object: {
            id: string;
            customer_email: string;
            metadata?: {
                product_id?: string;
            };
        };
    };
}

export class WebhookService {
    /**
     * Process Stripe webhook with idempotency guarantee
     * Returns early if event already processed (duplicate webhook)
     */
    async processStripeWebhook(eventId: string, payload: StripeWebhookPayload): Promise<{
        processed: boolean;
        reason?: string;
        orderId?: string;
    }> {
        console.log(`[WebhookService] Processing event: ${eventId}`);

        try {
            // Attempt to create webhook event record
            // The unique constraint on externalId will prevent duplicates
            const result = await prisma.$transaction(async (tx) => {
                // Try to create webhook event
                let webhookEvent;
                try {
                    webhookEvent = await tx.webhookEvent.create({
                        data: {
                            externalId: eventId,
                            provider: Provider.STRIPE,
                            eventType: payload.type,
                            payload: payload as any,
                            processedAt: new Date(),
                        },
                    });
                } catch (error: any) {
                    // Check if it's a unique constraint violation
                    if (error.code === 'P2002') {
                        console.log(`[WebhookService] ⚠️  Event ${eventId} already processed (duplicate webhook)`);
                        return { processed: false, reason: 'duplicate' };
                    }
                    throw error;
                }

                // Extract order data from webhook payload
                const sessionId = payload.data.object.id;
                const customerEmail = payload.data.object.customer_email;
                const productId = payload.data.object.metadata?.product_id || 'default-product';

                // Create order
                const order = await tx.order.create({
                    data: {
                        externalOrderId: sessionId,
                        productId,
                        customerEmail,
                        status: 'PENDING',
                        webhookEventId: webhookEvent.id,
                    },
                });

                console.log(`[WebhookService] ✅ Order created: ${order.id}`);

                // Enqueue fulfillment job
                await orderFulfillmentQueue.add('fulfill-order', {
                    orderId: order.id,
                });

                console.log(`[WebhookService] 📤 Fulfillment job enqueued for order: ${order.id}`);

                return { processed: true, orderId: order.id };
            });

            return result;
        } catch (error) {
            console.error('[WebhookService] Error processing webhook:', error);
            throw error;
        }
    }

    /**
     * Verify webhook signature (mocked for demo)
     * In production: use Stripe's signature verification
     */
    verifyWebhookSignature(payload: string, signature: string): boolean {
        // Mock verification - always returns true
        // In production: use stripe.webhooks.constructEvent()
        console.log('[WebhookService] Webhook signature verified (mocked)');
        return true;
    }
}
