export class DogNameDuplicateError extends Error {
  readonly code = 'DOG_NAME_DUPLICATE' as const
}
