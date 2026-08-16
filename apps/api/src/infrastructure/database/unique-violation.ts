export function isUniqueViolation(error: unknown): boolean {
  return hasPostgresCode(error, '23505') || (error instanceof Error && hasPostgresCode(error.cause, '23505'))
}

export function uniqueConstraint(error: unknown): string | undefined {
  return postgresConstraint(error) ?? (error instanceof Error ? postgresConstraint(error.cause) : undefined)
}

function hasPostgresCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

function postgresConstraint(error: unknown): string | undefined {
  return error instanceof Error && 'constraint' in error && typeof error.constraint === 'string'
    ? error.constraint
    : undefined
}
