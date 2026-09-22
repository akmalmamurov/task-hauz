export type FieldIssue = {
  field: string
  message: string
}

export type ActionErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'invalid_request'
  | 'personal_account_inconsistent'
  | 'internal_error'
  | 'transport'
  | 'unknown'

type ActionErrorInit = {
  code: ActionErrorCode
  message: string
  issues?: Array<FieldIssue>
}

/**
 * Server functions answer either with data or with a failure object. The
 * feature hooks turn a failure into this, so everything downstream — the
 * toast, the field errors, the retry — reads one shape.
 */
export class ActionError extends Error {
  readonly code: ActionErrorCode
  readonly issues?: Array<FieldIssue>

  constructor({ code, message, issues }: ActionErrorInit) {
    super(message)
    this.name = 'ActionError'
    this.code = code
    this.issues = issues
  }
}

export const isActionError = (error: unknown): error is ActionError =>
  error instanceof ActionError

export const toActionError = (error: unknown, fallbackMessage: string) =>
  isActionError(error) ? error : new ActionError({ code: 'unknown', message: fallbackMessage })
