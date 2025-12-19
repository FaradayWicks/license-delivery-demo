// Fulfillment Service
// Orchestrates license key reservation and delivery
// Called by BullMQ worker for async processing

import { prisma } from '../../infrastructure/database/PrismaClient';
import { ProviderFactory } from '../../infrastructure/providers/ProviderFactory';
import { OrderStatus } from '@prisma/client';

export class FulfillmentService {
    private licenseProvider = ProviderFactory.createLicenseProvider();

    /**
     * Fulfill an order by reserving and delivering a license key
     * Throws errors to trigger BullMQ retry logic
     */
    async fulfillOrder(orderId: string): Promise<void> {
        console.log(`[FulfillmentService] Starting fulfillment for order: ${orderId}`);

        // Fetch order details
        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        // Check if already fulfilled
        if (order.status === OrderStatus.FULFILLED) {
            console.log(`[FulfillmentService] Order ${orderId} already fulfilled, skipping`);
            return;
        }

        // Update status to PROCESSING
        await prisma.order.update({
            where: { id: orderId },
            data: { status: OrderStatus.PROCESSING },
        });

        try {
            // Reserve license key from provider
            console.log(`[FulfillmentService] Reserving key for product: ${order.productId}`);
            const licenseKeyData = await this.licenseProvider.reserveKey(order.productId);

            // Store license key in database
            const licenseKey = await prisma.licenseKey.create({
                data: {
                    orderId: order.id,
                    productId: order.productId,
                    licenseKey: licenseKeyData.key,
                    providerId: licenseKeyData.providerId,
                    deliveredAt: new Date(),
                },
            });

            console.log(`[FulfillmentService] License key stored: ${licenseKey.id}`);

            // Deliver key to customer (in production: send email)
            await this.licenseProvider.deliverKey(
                order.id,
                order.customerEmail,
                licenseKeyData.key
            );

            // Mark order as fulfilled
            await prisma.order.update({
                where: { id: orderId },
                data: { status: OrderStatus.FULFILLED },
            });

            console.log(`[FulfillmentService] ✅ Order ${orderId} fulfilled successfully`);
        } catch (error) {
            // Mark order as failed (will be retried by BullMQ)
            await prisma.order.update({
                where: { id: orderId },
                data: { status: OrderStatus.FAILED },
            });

            console.error(`[FulfillmentService] ❌ Order ${orderId} fulfillment failed:`, error);
            throw error; // Re-throw to trigger retry
        }
    }

    /**
     * Get order status
     */
    async getOrderStatus(orderId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                licenseKeys: true,
            },
        });

        return order;
    }
}
