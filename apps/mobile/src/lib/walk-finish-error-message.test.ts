import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from './api.ts'
import { walkFinishErrorMessage } from './walk-finish-error-message.ts'

test('walkFinishErrorMessage uses ApiError message', () => {
  assert.equal(
    walkFinishErrorMessage(
      new ApiError(
        {
          code: 'SERVICE_UNAVAILABLE',
          message: '終了処理を完了できませんでした。もう一度お試しください。',
          requestId: 'r1',
          retryable: true,
        },
        503,
      ),
    ),
    '終了処理を完了できませんでした。もう一度お試しください。',
  )
})

test('walkFinishErrorMessage falls back for non-ApiError', () => {
  assert.equal(walkFinishErrorMessage(new Error('network')), '終了に失敗しました。再試行してください。')
})
