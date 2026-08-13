import { apiRequest } from '@/lib/api'

export type StartSignInResponse = {
  username: string
  session: string
  requestId: string
  codeDelivery: { destination: string; attribute: string } | null
}

export type StartSignUpResponse = {
  requestId: string
  username: string
  session: string | null
  codeDelivery: {
    destination: string
    attribute: string
  } | null
}

export type VerifyAuthResponse = {
  requestId: string
  accessToken: string
  idToken: string
  refreshToken: string
  owner: {
    ownerId: string
    displayName: string | null
    avatarUrl: string | null
    createdAt: string
    updatedAt: string
  }
}

export async function startSignIn(email: string): Promise<StartSignInResponse> {
  return apiRequest<StartSignInResponse>('/v1/auth/sign-in', {
    method: 'POST',
    body: { email },
  })
}

export async function startSignUp(email: string): Promise<StartSignUpResponse> {
  return apiRequest<StartSignUpResponse>('/v1/auth/sign-up', {
    method: 'POST',
    body: { email },
  })
}

export async function verifySignIn(input: {
  username: string
  session: string | null
  code: string
}): Promise<VerifyAuthResponse> {
  return apiRequest<VerifyAuthResponse>('/v1/auth/sign-in/verify', {
    method: 'POST',
    body: input,
  })
}

export async function verifySignUp(input: {
  username: string
  session: string | null
  code: string
}): Promise<VerifyAuthResponse> {
  return apiRequest<VerifyAuthResponse>('/v1/auth/sign-up/verify', {
    method: 'POST',
    body: input,
  })
}

export async function signOut(accessToken: string): Promise<void> {
  await apiRequest<void>('/v1/auth/sign-out', {
    method: 'POST',
    accessToken,
  })
}
