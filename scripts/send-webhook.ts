// Test Script: Send Mock Webhook
// Usage: npm run test:webhook -- --event evt_test_123

import axios from 'axios';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Parse command line arguments
const args = process.argv.slice(2);
const eventIdIndex = args.indexOf('--event');
// Support both: npm run test:webhook -- --event evt_001 AND npm run test:webhook -- evt_001
const eventId = eventIdIndex !== -1
    ? args[eventIdIndex + 1]
    : (args[0] || `evt_test_${Date.now()}`);

// Mock Stripe webhook payload
const mockWebhookPayload = {
    id: eventId,
    type: 'checkout.session.completed',
    data: {
        object: {
            id: `cs_test_${Date.now()}`,
            customer_email: 'customer@example.com',
            metadata: {
                product_id: 'windows-10-pro',
            },
        },
    },
};

async function sendWebhook() {
    console.log(`\n🔔 Sending webhook with event ID: ${eventId}`);
    console.log(`📡 Target: ${SERVER_URL}/webhooks/stripe\n`);

    try {
        const startTime = Date.now();

        const response = await axios.post(
            `${SERVER_URL}/webhooks/stripe`,
            mockWebhookPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'stripe-signature': 'mock_signature',
                },
            }
        );

        const responseTime = Date.now() - startTime;

        console.log('✅ Response:', response.status, response.statusText);
        console.log(`⏱️  Response time: ${responseTime}ms`);
        console.log('📦 Data:', JSON.stringify(response.data, null, 2));

        if (response.data.processed) {
            console.log(`\n✨ Order created: ${response.data.orderId}`);
            console.log('⏳ Fulfillment job enqueued - check server logs for processing');
        } else {
            console.log(`\n⚠️  Event not processed: ${response.data.reason}`);
        }
    } catch (error: any) {
        console.error('❌ Error sending webhook:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

sendWebhook();
