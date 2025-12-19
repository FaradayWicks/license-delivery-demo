// Domain entity for License Key

export class LicenseKeyEntity {
    constructor(
        public readonly id: string,
        public readonly orderId: string,
        public readonly productId: string,
        public readonly licenseKey: string,
        public readonly providerId: string,
        public deliveredAt: Date | null,
        public readonly createdAt: Date
    ) { }

    /**
     * Check if license key has been delivered
     */
    isDelivered(): boolean {
        return this.deliveredAt !== null;
    }

    /**
     * Mark license key as delivered
     */
    markAsDelivered(): void {
        if (this.isDelivered()) {
            throw new Error(`License key ${this.id} has already been delivered`);
        }
        this.deliveredAt = new Date();
    }

    /**
     * Mask license key for logging (security)
     */
    getMaskedKey(): string {
        if (this.licenseKey.length <= 8) {
            return '****';
        }
        const visibleChars = 4;
        const start = this.licenseKey.substring(0, visibleChars);
        const end = this.licenseKey.substring(this.licenseKey.length - visibleChars);
        return `${start}****${end}`;
    }
}
