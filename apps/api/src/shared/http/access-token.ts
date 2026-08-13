export type Principal = {
  cognitoSubject: string
}

export type AccessTokenVerifier = {
  verify(accessToken: string): Promise<Principal>
}
