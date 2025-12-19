// Domain interface for license provider abstraction
// This allows swapping Keysender, MockProvider, or any future provider

export interface LicenseKeyData {
    key: string;
    providerId: string;
}

export interface ILicenseProvider {
    /**
     * Reserve a license key for a specific product
     * @param productId - Product identifier
     * @returns License key data from provider
     */
    reserveKey(productId: string): Promise<LicenseKeyData>;

    /**
     * Deliver a license key to customer
     * @param orderId - Order identifier
     * @param email - Customer email
     * @param key - License key to deliver
     */
    deliverKey(orderId: string, email: string, key: string): Promise<void>;

    /**
     * Release/return a license key back to inventory
     * @param keyId - Provider's key identifier
     */
    releaseKey(keyId: string): Promise<void>;
}
