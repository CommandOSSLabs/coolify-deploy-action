import * as core from '@actions/core'
import { type ZodError, type ZodIssue, z } from 'zod'
import type { CoolifyEnvVar, Inputs, JsonObject, JsonValue } from './types.ts'

export class InputValidationError extends Error {
  constructor(error: ZodError) {
    super(formatInputValidationError(error))
    this.name = 'InputValidationError'
  }
}

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
)

const JsonObjectSchema = z.record(z.string(), JsonValueSchema)

const RequiredTextInputSchema = z
  .string({ error: 'is required' })
  .trim()
  .min(1, 'is required')

const OptionalTextInputSchema = z
  .string({ error: 'must be a string' })
  .trim()
  .min(1, 'must not be empty')
  .optional()

const EnvironmentVariableObjectSchema = z
  .object({
    key: z.string().trim().min(1, 'must not be empty'),
    value: z.unknown(),
    is_buildtime: z.boolean().optional(),
    is_runtime: z.boolean().optional(),
    is_preview: z.boolean().optional(),
    is_literal: z.boolean().optional(),
    is_multiline: z.boolean().optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (!Object.hasOwn(entry, 'value')) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'is required',
      })
    }
  })
  .transform(
    (entry): CoolifyEnvVar => ({
      key: entry.key,
      value: valueToEnvString(entry.value),
      ...optionalBooleanFlag(entry, 'is_buildtime'),
      ...optionalBooleanFlag(entry, 'is_runtime'),
      ...optionalBooleanFlag(entry, 'is_preview'),
      ...optionalBooleanFlag(entry, 'is_literal'),
      ...optionalBooleanFlag(entry, 'is_multiline'),
    })
  )

const EnvironmentVariableLineSchema = z
  .string()
  .refine((line) => line.indexOf('=') > 0, {
    message: 'must use KEY=value format',
  })
  .transform((line): CoolifyEnvVar => {
    const separatorIndex = line.indexOf('=')

    return {
      key: line.slice(0, separatorIndex).trim(),
      value: line.slice(separatorIndex + 1),
    }
  })
  .pipe(
    z.object({
      key: z.string().trim().min(1, 'must not be empty'),
      value: z.string(),
    })
  )

const EnvironmentVariableArrayEntrySchema = z.union([
  EnvironmentVariableLineSchema,
  EnvironmentVariableObjectSchema,
])

const ActionInputsSchema = z
  .object({
    coolify_domain: z
      .string({ error: 'must be a string' })
      .trim()
      .min(1, 'must not be empty')
      .default('app.coolify.io'),
    api_token: RequiredTextInputSchema,
    docker_image: RequiredTextInputSchema,
    docker_image_tag: OptionalTextInputSchema,
    environment_variables: z
      .string()
      .optional()
      .transform((raw, ctx) => parseEnvironmentVariablesInput(raw, ctx)),
    project_uuid: OptionalTextInputSchema,
    server_uuid: OptionalTextInputSchema,
    environment_name: OptionalTextInputSchema,
    environment_uuid: OptionalTextInputSchema,
    app_uuid: OptionalTextInputSchema,
    ports_exposes: OptionalTextInputSchema,
    optional_options: z
      .string()
      .optional()
      .transform((raw, ctx) => parseJsonObjectInput(raw, ctx)),
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
    if (inputs.app_uuid) {
      return
    }

    if (!inputs.project_uuid) {
      ctx.addIssue({
        code: 'custom',
        path: ['project_uuid'],
        message: 'is required when app_uuid is not provided',
      })
    }

    if (!inputs.server_uuid) {
      ctx.addIssue({
        code: 'custom',
        path: ['server_uuid'],
        message: 'is required when app_uuid is not provided',
      })
    }

    if (!inputs.environment_name && !inputs.environment_uuid) {
      ctx.addIssue({
        code: 'custom',
        path: ['environment_name'],
        message:
          'or environment_uuid is required when app_uuid is not provided',
      })
    }

    if (
      !inputs.ports_exposes &&
      !Object.hasOwn(inputs.optional_options, 'ports_exposes')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ports_exposes'],
        message:
          'is required when creating an app unless optional_options contains ports_exposes',
      })
    }
  })
  .transform(
    (inputs): Inputs => ({
      coolifyDomain: inputs.coolify_domain,
      apiToken: inputs.api_token,
      dockerImage: inputs.docker_image,
      dockerImageTag: inputs.docker_image_tag,
      environmentVariables: inputs.environment_variables,
      projectUuid: inputs.project_uuid,
      serverUuid: inputs.server_uuid,
      environmentName: inputs.environment_name,
      environmentUuid: inputs.environment_uuid,
      appUuid: inputs.app_uuid,
      portsExposes: inputs.ports_exposes,
      optionalOptions: inputs.optional_options,
      requestTimeoutMs: inputs.request_timeout_ms,
      requestRetryCount: inputs.request_retry_count,
    })
  )

type RawInputName = keyof z.input<typeof ActionInputsSchema>

const RAW_INPUT_NAMES: RawInputName[] = [
  'coolify_domain',
  'api_token',
  'docker_image',
  'docker_image_tag',
  'environment_variables',
  'project_uuid',
  'server_uuid',
  'environment_name',
  'environment_uuid',
  'app_uuid',
  'ports_exposes',
  'optional_options',
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

function parseJsonObjectInput(
  raw: string | undefined,
  ctx: z.RefinementCtx
): JsonObject {
  if (!raw) {
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message: `must be a valid JSON object: ${getErrorMessage(error)}`,
    })
    return z.NEVER
  }

  const result = JsonObjectSchema.safeParse(parsed)
  if (!result.success) {
    ctx.addIssue({
      code: 'custom',
      message: `must be a JSON object: ${formatZodIssues(result.error.issues)}`,
    })
    return z.NEVER
  }

  return result.data
}

function parseEnvironmentVariablesInput(
  raw: string | undefined,
  ctx: z.RefinementCtx
): CoolifyEnvVar[] {
  if (!raw || raw.trim().length === 0) {
    return []
  }

  try {
    return parseEnvironmentVariables(raw)
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message: getErrorMessage(error),
    })
    return z.NEVER
  }
}

function parseEnvironmentVariables(raw: string): CoolifyEnvVar[] {
  const trimmed = raw.trim()

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJsonEnvironmentVariables(trimmed)
  }

  return parseDotenvEnvironmentVariables(raw)
}

function parseJsonEnvironmentVariables(raw: string): CoolifyEnvVar[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `must be valid JSON or dotenv lines: ${getErrorMessage(error)}`
    )
  }

  if (Array.isArray(parsed)) {
    return parseWithSchema(
      z.array(EnvironmentVariableArrayEntrySchema),
      parsed,
      'JSON array'
    )
  }

  const objectResult = JsonObjectSchema.safeParse(parsed)
  if (!objectResult.success) {
    throw new Error(
      `JSON input must be an object or array: ${formatZodIssues(
        objectResult.error.issues
      )}`
    )
  }

  return Object.entries(objectResult.data).map(([key, value]) => {
    if (isJsonObject(value) && Object.hasOwn(value, 'value')) {
      return parseWithSchema(
        EnvironmentVariableObjectSchema,
        { key, ...value },
        key
      )
    }

    return {
      key,
      value: valueToEnvString(value),
    }
  })
}

function parseDotenvEnvironmentVariables(raw: string): CoolifyEnvVar[] {
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))

  return parseWithSchema(
    z.array(EnvironmentVariableLineSchema),
    entries,
    'dotenv'
  )
}

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string
): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error(`${label}: ${formatZodIssues(result.error.issues)}`)
  }

  return result.data
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalBooleanFlag(
  entry: {
    is_buildtime?: boolean
    is_runtime?: boolean
    is_preview?: boolean
    is_literal?: boolean
    is_multiline?: boolean
  },
  key: keyof Omit<CoolifyEnvVar, 'key' | 'value'>
): Partial<CoolifyEnvVar> {
  return entry[key] === undefined ? {} : { [key]: entry[key] }
}

function valueToEnvString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }

  return JSON.stringify(value)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatInputValidationError(error: ZodError): string {
  return `Input validation failed:\n${error.issues
    .map((issue) => `- ${formatInputIssue(issue)}`)
    .join('\n')}`
}

function formatInputIssue(issue: ZodIssue): string {
  return `${formatInputPath(issue.path)}: ${issue.message}`
}

function formatZodIssues(issues: ZodIssue[]): string {
  return issues
    .map((issue) => `${formatNestedPath(issue.path)}: ${issue.message}`)
    .join('; ')
}

function formatInputPath(path: ZodIssue['path']): string {
  if (path.length === 0) {
    return 'inputs'
  }

  const [inputName, ...nestedPath] = path
  const suffix = formatNestedPath(nestedPath)

  return suffix === 'value'
    ? `input '${String(inputName)}'`
    : `input '${String(inputName)}' ${suffix}`
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
    core.setSecret(envVar.value)
  }

  return result.data
}
