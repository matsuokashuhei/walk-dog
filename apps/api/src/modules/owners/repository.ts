import type { Owner } from './types.js'

export interface OwnerRepository {
  resolveByCognitoSubject(cognitoSubject: string): Promise<Owner>
  updateDisplayName(cognitoSubject: string, displayName: string): Promise<Owner>
}
