// Domain entity for Order
// Business logic and validation for order state transitions

import { OrderStatus } from '@prisma/client';

export class OrderEntity {
    constructor(
        public readonly id: string,
        public readonly externalOrderId: string,
        public readonly productId: string,
        public readonly customerEmail: string,
        public status: OrderStatus,
        public readonly webhookEventId: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) { }

    /**
     * Check if order can be fulfilled
     */
    canBeFulfilled(): boolean {
        return this.status === 'PENDING' || this.status === 'FAILED';
    }

    /**
     * Mark order as processing
     */
    markAsProcessing(): void {
        if (!this.canBeFulfilled()) {
            throw new Error(`Order ${this.id} cannot be processed in ${this.status} state`);
        }
        this.status = 'PROCESSING';
    }

    /**
     * Mark order as fulfilled
     */
    markAsFulfilled(): void {
        if (this.status !== 'PROCESSING') {
            throw new Error(`Order ${this.id} must be in PROCESSING state to be fulfilled`);
        }
        this.status = 'FULFILLED';
    }

    /**
     * Mark order as failed
     */
    markAsFailed(): void {
        this.status = 'FAILED';
    }

    /**
     * Check if order is in final state
     */
    isFinal(): boolean {
        return this.status === 'FULFILLED' || this.status === 'FAILED';
    }
}
