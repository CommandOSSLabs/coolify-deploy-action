import type { ZodError } from 'zod'

export class InputValidationError extends Error {
  constructor(error: ZodError | string) {
    super(typeof error === 'string' ? error : formatZodValidationError(error))
    this.name = 'InputValidationError'
  }
}

export class EmptyDockerComposeError extends Error {
  constructor() {
    super('must not be empty')
    this.name = 'EmptyDockerComposeError'
  }
}

export class InvalidCoolifyDomainError extends Error {
  constructor() {
    super("Input 'coolify_domain' cannot be empty.")
    this.name = 'InvalidCoolifyDomainError'
  }
}

export class ServiceUuidNotReturnedError extends Error {
  constructor() {
    super('Coolify did not return a service UUID after creation.')
    this.name = 'ServiceUuidNotReturnedError'
  }
}

export class CoolifyHttpError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoolifyHttpError'
  }
}

export class CoolifyRetryableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoolifyRetryableError'
  }
}

export class CoolifyTimeoutError extends CoolifyRetryableError {
  constructor(message: string) {
    super(message)
    this.name = 'CoolifyTimeoutError'
  }
}

export class CoolifyUnknownRequestError extends CoolifyRetryableError {
  constructor(message: string) {
    super(message)
    this.name = 'CoolifyUnknownRequestError'
  }
}

function formatZodValidationError(error: ZodError): string {
  return `Input validation failed:\n${error.issues
    .map((issue) => `- ${formatInputIssue(issue)}`)
    .join('\n')}`
}

function formatInputIssue(issue: {
  path: PropertyKey[]
  message: string
}): string {
  return `${formatInputPath(issue.path)}: ${issue.message}`
}

function formatInputPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return 'inputs'
  }

  const [inputName, ...nestedPath] = path
  const suffix = formatNestedPath(nestedPath)

  return suffix === 'value'
    ? `input '${String(inputName)}'`
    : `input '${String(inputName)}' ${suffix}`
}

function formatNestedPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return 'value'
  }

  return path
    .map((part) =>
      typeof part === 'number' ? `[${part}]` : `.${String(part)}`
    )
    .join('')
    .replace(/^\./, '')
}
