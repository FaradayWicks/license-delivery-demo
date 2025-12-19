// Domain interface for Order repository operations

import { Order, OrderStatus } from '@prisma/client';

export interface IOrderRepository {
    /**
     * Create a new order
     */
    create(data: {
        externalOrderId: string;
        productId: string;
        customerEmail: string;
        webhookEventId: string;
    }): Promise<Order>;

    /**
     * Find order by ID
     */
    findById(id: string): Promise<Order | null>;

    /**
     * Find order by external order ID (from Stripe)
     */
    findByExternalId(externalOrderId: string): Promise<Order | null>;

    /**
     * Update order status
     */
    updateStatus(id: string, status: OrderStatus): Promise<Order>;

    /**
     * Find orders by customer email
     */
    findByCustomerEmail(email: string): Promise<Order[]>;
}
