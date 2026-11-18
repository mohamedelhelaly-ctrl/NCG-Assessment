import type { TFunction } from 'i18next'
import { ApiError } from './api'

/** Translate an API error by its code; unknown codes fall back to the server's English message. */
export function errorText(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    return t(`errors.${error.code}`, { defaultValue: error.message, ...error.params })
  }
  return t('errors.unknown')
}
