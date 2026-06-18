import * as core from '@actions/core'
import { type ZodIssue, z } from 'zod'
import { resolveDockerComposeContent } from './docker-compose.ts'
import { InputValidationError } from './errors.ts'
import type { CoolifyEnvVar, Inputs } from './types.ts'
import { parseUpdateServiceOptionsInput } from './update-service-options.ts'

export { InputValidationError } from './errors.ts'

const RequiredTextInputSchema = z
  .string({ error: 'is required' })
  .trim()
  .min(1, 'is required')

const OptionalTextInputSchema = z
  .string({ error: 'must be a string' })
  .trim()
  .min(1, 'must not be empty')
  .optional()

const EnvironmentVariableSchema = z
  .object({
    key: z.string().trim().min(1, 'must not be empty'),
    value: z.string(),
    is_secret: z.boolean(),
  })
  .strict()

const ActionInputsSchema = z
  .object({
    coolify_domain: z
      .string({ error: 'must be a string' })
      .trim()
      .min(1, 'must not be empty')
      .default('app.coolify.io'),
    api_token: RequiredTextInputSchema,
    docker_compose: RequiredTextInputSchema.transform((raw, ctx) => {
      try {
        return resolveDockerComposeContent(raw)
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: getErrorMessage(error),
        })
        return z.NEVER
      }
    }),
    environment_variables: z
      .string()
      .optional()
      .transform((raw, ctx) => parseEnvironmentVariablesInput(raw, ctx)),
    project_uuid: OptionalTextInputSchema,
    server_uuid: OptionalTextInputSchema,
    environment_name_or_uuid: OptionalTextInputSchema,
    service_uuid: OptionalTextInputSchema,
    service_options: z
      .string()
      .optional()
      .transform((raw, ctx) =>
        parseUpdateServiceOptionsInput(raw, ctx, formatZodIssues)
      ),
    request_timeout_ms: integerInputSchema({
      defaultValue: 30_000,
      minimum: 1,
      minimumDescription: 'a positive integer',
    }),
    request_retry_count: integerInputSchema({
      defaultValue: 0,
      minimum: 0,
      minimumDescription: 'a non-negative integer',
    }),
  })
  .superRefine((inputs, ctx) => {
    if (inputs.service_uuid) {
      return
    }

    if (!inputs.project_uuid) {
      ctx.addIssue({
        code: 'custom',
        path: ['project_uuid'],
        message: 'is required when service_uuid is not provided',
      })
    }

    if (!inputs.server_uuid) {
      ctx.addIssue({
        code: 'custom',
        path: ['server_uuid'],
        message: 'is required when service_uuid is not provided',
      })
    }

    if (!inputs.environment_name_or_uuid) {
      ctx.addIssue({
        code: 'custom',
        path: ['environment_name_or_uuid'],
        message: 'is required when service_uuid is not provided',
      })
    }
  })
  .transform(
    (inputs): Inputs => ({
      coolifyDomain: inputs.coolify_domain,
      apiToken: inputs.api_token,
      dockerCompose: inputs.docker_compose,
      environmentVariables: inputs.environment_variables,
      projectUuid: inputs.project_uuid,
      serverUuid: inputs.server_uuid,
      environmentNameOrUuid: inputs.environment_name_or_uuid,
      serviceUuid: inputs.service_uuid,
      serviceOptions: inputs.service_options,
      requestTimeoutMs: inputs.request_timeout_ms,
      requestRetryCount: inputs.request_retry_count,
    })
  )

type RawInputName = keyof z.input<typeof ActionInputsSchema>

const RAW_INPUT_NAMES: RawInputName[] = [
  'coolify_domain',
  'api_token',
  'docker_compose',
  'environment_variables',
  'project_uuid',
  'server_uuid',
  'environment_name_or_uuid',
  'service_uuid',
  'service_options',
  'request_timeout_ms',
  'request_retry_count',
]

function optionalInput(name: string): string | undefined {
  const value = core.getInput(name)
  return value.length > 0 ? value : undefined
}

function readRawInputs(): Record<RawInputName, string | undefined> {
  return Object.fromEntries(
    RAW_INPUT_NAMES.map((name) => [name, optionalInput(name)])
  ) as Record<RawInputName, string | undefined>
}

function integerInputSchema(options: {
  defaultValue: number
  minimum: number
  minimumDescription: string
}) {
  return z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) {
        return options.defaultValue
      }

      const trimmed = raw.trim()
      const value = Number.parseInt(trimmed, 10)

      if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(value)) {
        ctx.addIssue({
          code: 'custom',
          message: `must be ${options.minimumDescription}`,
        })
        return z.NEVER
      }

      if (value < options.minimum) {
        ctx.addIssue({
          code: 'custom',
          message: `must be ${options.minimumDescription}`,
        })
        return z.NEVER
      }

      return value
    })
}

function parseEnvironmentVariablesInput(
  raw: string | undefined,
  ctx: z.RefinementCtx
): CoolifyEnvVar[] {
  if (!raw || raw.trim().length === 0) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message: `must be a valid JSON array: ${getErrorMessage(error)}`,
    })
    return z.NEVER
  }

  const result = z.array(EnvironmentVariableSchema).safeParse(parsed)
  if (!result.success) {
    ctx.addIssue({
      code: 'custom',
      message: formatZodIssues(result.error.issues),
    })
    return z.NEVER
  }

  return result.data
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatZodIssues(issues: ZodIssue[]): string {
  return issues
    .map((issue) => `${formatNestedPath(issue.path)}: ${issue.message}`)
    .join('; ')
}

function formatNestedPath(path: ZodIssue['path']): string {
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

export function readInputs(): Inputs {
  const result = ActionInputsSchema.safeParse(readRawInputs())
  if (!result.success) {
    throw new InputValidationError(result.error)
  }

  core.setSecret(result.data.apiToken)

  for (const envVar of result.data.environmentVariables) {
    if (envVar.is_secret) {
      core.setSecret(envVar.value)
    }
  }

  return result.data
}
