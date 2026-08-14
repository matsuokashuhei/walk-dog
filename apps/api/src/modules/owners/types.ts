export type Owner = {
  ownerId: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export type GetOwner = (cognitoSubject: string) => Promise<Owner>

export type UpdateOwnerDisplayName = (input: {
  cognitoSubject: string
  displayName: string
}) => Promise<Owner>
