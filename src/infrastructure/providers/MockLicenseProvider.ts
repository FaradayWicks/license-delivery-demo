// Mock License Provider
// Simulates Keysender API behavior for demo purposes
// Supports configurable failure rate to test retry logic

import { ILicenseProvider, LicenseKeyData } from '../../domain/interfaces/ILicenseProvider';
import { randomUUID } from 'crypto';

export class MockLicenseProvider implements ILicenseProvider {
    private failureRate: number;
    private minDelay: number;
    private maxDelay: number;

    constructor() {
        this.failureRate = parseFloat(process.env.MOCK_PROVIDER_FAILURE_RATE || '0.0');
        this.minDelay = parseInt(process.env.MOCK_PROVIDER_MIN_DELAY_MS || '50', 10);
        this.maxDelay = parseInt(process.env.MOCK_PROVIDER_MAX_DELAY_MS || '200', 10);
    }

    /**
     * Simulate network delay
     */
    private async simulateDelay(): Promise<void> {
        const delay = Math.random() * (this.maxDelay - this.minDelay) + this.minDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Simulate random failures based on configured failure rate
     */
    private simulateFailure(): void {
        if (Math.random() < this.failureRate) {
            throw new Error('Mock Provider: Temporary service unavailable (simulated failure)');
        }
    }

    /**
     * Generate a mock license key
     */
    private generateLicenseKey(productId: string): string {
        const segments = 4;
        const segmentLength = 4;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        const key = Array.from({ length: segments }, () => {
            return Array.from({ length: segmentLength }, () =>
                chars.charAt(Math.floor(Math.random() * chars.length))
            ).join('');
        }).join('-');

        return key;
    }

    async reserveKey(productId: string): Promise<LicenseKeyData> {
        console.log(`[MockProvider] Reserving key for product: ${productId}`);

        await this.simulateDelay();
        this.simulateFailure();

        const key = this.generateLicenseKey(productId);
        const providerId = randomUUID();

        console.log(`[MockProvider] Key reserved successfully: ${key.substring(0, 8)}****`);

        return {
            key,
            providerId,
        };
    }

    async deliverKey(orderId: string, email: string, key: string): Promise<void> {
        console.log(`[MockProvider] Delivering key to ${email} for order ${orderId}`);

        await this.simulateDelay();
        this.simulateFailure();

        // In production: send email via SendGrid, AWS SES, etc.
        console.log(`[MockProvider] ✅ Key delivered successfully to ${email}`);
    }

    async releaseKey(keyId: string): Promise<void> {
        console.log(`[MockProvider] Releasing key: ${keyId}`);

        await this.simulateDelay();
        this.simulateFailure();

        console.log(`[MockProvider] Key released successfully`);
    }
}
