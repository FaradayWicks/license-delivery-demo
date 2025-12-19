// Express Routes Configuration

import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';

const router = Router();
const webhookController = new WebhookController();

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'license-delivery-demo',
    });
});

// Webhook endpoints
router.post('/webhooks/stripe', (req, res) =>
    webhookController.handleStripeWebhook(req, res)
);

export default router;
