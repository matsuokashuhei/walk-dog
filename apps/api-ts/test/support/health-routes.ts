import { registerHealthRoutes } from '../../src/modules/health/index.js'

export const healthyHealth = {
  checkHealth: async () => ({ ok: true as const }),
}

export function registerHealthyHealthRoutes() {
  return registerHealthRoutes(healthyHealth)
}
