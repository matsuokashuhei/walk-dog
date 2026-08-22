export type CheckHealth = () => Promise<{ ok: boolean }>

export type CheckHealthDependencies = {
  pingPostgres: () => Promise<void>
  pingWorker: () => Promise<void>
}

export function createCheckHealth(
  dependencies: CheckHealthDependencies,
): CheckHealth {
  return async () => {
    try {
      await Promise.all([
        dependencies.pingPostgres(),
        dependencies.pingWorker(),
      ])
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }
}
