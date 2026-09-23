import { IFoodAdapter } from '../ifood/adapter.mjs';
import { SaiposAdapter } from '../saipos/adapter.mjs';

class IntegrationRegistry {
  constructor() {
    this.adapters = new Map();
    this.register(new IFoodAdapter());
    this.register(new SaiposAdapter());
  }

  register(adapter) {
    if (!adapter || !adapter.providerId) {
      throw new Error("Não é possível registrar um adaptador sem providerId.");
    }
    this.adapters.set(adapter.providerId.toUpperCase(), adapter);
  }

  getAdapter(providerId) {
    if (!providerId) return null;
    return this.adapters.get(String(providerId).toUpperCase()) || null;
  }

  listAdapters() {
    return Array.from(this.adapters.values()).map(adapter => ({
      providerId: adapter.providerId,
      providerName: adapter.providerName,
      capabilities: adapter.getCapabilities(),
    }));
  }

  async testConnection(providerId, config = {}) {
    const adapter = this.getAdapter(providerId);
    if (!adapter) {
      return {
        ok: false,
        status: 'ERROR',
        message: `Provedor de integração '${providerId}' não suportado ou não registrado.`,
      };
    }
    return adapter.testConnection(config);
  }
}

export const integrationRegistry = new IntegrationRegistry();
