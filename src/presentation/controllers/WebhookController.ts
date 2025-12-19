// Webhook Controller
// Handles incoming webhook requests from Stripe (or mock)

import { Request, Response } from 'express';
import { WebhookService } from '../../application/services/WebhookService';

const webhookService = new WebhookService();

export class WebhookController {
    /**
     * Handle Stripe webhook
     * POST /webhooks/stripe
     */
    async handleStripeWebhook(req: Request, res: Response): Promise<void> {
        try {
            const signature = req.headers['stripe-signature'] as string;
            const payload = req.body;

            // Verify webhook signature (mocked for demo)
            const isValid = webhookService.verifyWebhookSignature(
                JSON.stringify(payload),
                signature || ''
            );

            if (!isValid) {
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }

            // Extract event ID and process webhook
            const eventId = payload.id;
            const result = await webhookService.processStripeWebhook(eventId, payload);

            // Always return 200 OK (Stripe best practice)
            // Even for duplicate events
            res.status(200).json({
                received: true,
                processed: result.processed,
                reason: result.reason,
                orderId: result.orderId,
            });
        } catch (error) {
            console.error('[WebhookController] Error:', error);

            // Return 500 to trigger Stripe retry
            res.status(500).json({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
}
