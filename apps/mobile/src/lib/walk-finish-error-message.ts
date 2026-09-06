import { ApiError } from './api.ts'

export function walkFinishErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return '終了に失敗しました。再試行してください。'
}
