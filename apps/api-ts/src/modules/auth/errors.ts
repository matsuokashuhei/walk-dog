export type AuthFailure =
  | 'invalid-input'
  | 'already-confirmed'
  | 'authentication-failed'
  | 'rate-limited'
  | 'code-expired'
  | 'invalid-code'
  | 'code-already-used'
