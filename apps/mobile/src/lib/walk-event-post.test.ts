import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from './api.ts'
import { toEventPostResult } from './walk-event-post.ts'

test('toEventPostResult keeps 401 as retryable for manual retry', () => {
  const error = new ApiError(
    {
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
      requestId: 'req-1',
      retryable: false,
    },
    401,
  )
  assert.deepEqual(toEventPostResult(error), {
    ok: false,
    status: 401,
    retryable: true,
  })
})

test('toEventPostResult preserves ApiError retryable for other statuses', () => {
  const retryable = new ApiError(
    {
      code: 'INTERNAL',
      message: 'fail',
      requestId: 'req-2',
      retryable: true,
    },
    500,
  )
  assert.deepEqual(toEventPostResult(retryable), {
    ok: false,
    status: 500,
    retryable: true,
  })

  const conflict = new ApiError(
    {
      code: 'CONFLICT',
      message: 'conflict',
      requestId: 'req-3',
      retryable: false,
    },
    409,
  )
  assert.deepEqual(toEventPostResult(conflict), {
    ok: false,
    status: 409,
    retryable: false,
  })
})

test('toEventPostResult treats unknown errors as retryable', () => {
  assert.deepEqual(toEventPostResult(new Error('network')), {
    ok: false,
    status: 0,
    retryable: true,
  })
})
