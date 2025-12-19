// Provider Factory
// Creates the appropriate license provider based on configuration

import { ILicenseProvider } from '../../domain/interfaces/ILicenseProvider';
import { MockLicenseProvider } from './MockLicenseProvider';

export class ProviderFactory {
    static createLicenseProvider(): ILicenseProvider {
        const providerType = process.env.LICENSE_PROVIDER || 'mock';

        switch (providerType.toLowerCase()) {
            case 'mock':
                return new MockLicenseProvider();

            // Future providers can be added here:
            // case 'keysender':
            //   return new KeysenderProvider();

            default:
                console.warn(`Unknown provider type: ${providerType}, falling back to mock`);
                return new MockLicenseProvider();
        }
    }
}
