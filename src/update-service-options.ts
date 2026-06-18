import * as core from '@actions/core'
import { type ZodIssue, z } from 'zod'

const SUPPORTED_SERVICE_OPTION_KEYS = ['name', 'description', 'urls'] as const
const SUPPORTED_SERVICE_URL_KEYS = ['name', 'url'] as const

const UpdateServiceUrlSchema = z.object({
  name: z.string(),
  url: z.string(),
})

/**
 * Supported request body fields for PATCH /services/{uuid}.
 *
 * @see https://coolify.io/docs/api-reference/api/operations/update-service-by-uuid
 */
export const UpdateServiceOptionsSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  urls: z.array(UpdateServiceUrlSchema).optional(),
})

export type UpdateServiceOptions = z.infer<typeof UpdateServiceOptionsSchema>

export function parseUpdateServiceOptionsInput(
  raw: string | undefined,
  ctx: z.RefinementCtx,
  formatIssues: (issues: ZodIssue[]) => string
): UpdateServiceOptions | undefined {
  if (!raw) {
    return undefined
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

  if (!isPlainObject(parsed)) {
    ctx.addIssue({
      code: 'custom',
      message: 'must be a JSON object',
    })
    return z.NEVER
  }

  warnUnsupportedKeys(
    Object.keys(parsed),
    SUPPORTED_SERVICE_OPTION_KEYS,
    'service_options'
  )

  const sanitized: Record<string, unknown> = {}
  for (const key of SUPPORTED_SERVICE_OPTION_KEYS) {
    if (!(key in parsed)) {
      continue
    }

    if (key === 'urls') {
      sanitized.urls = sanitizeUrls(parsed.urls)
      continue
    }

    sanitized[key] = parsed[key]
  }

  const result = UpdateServiceOptionsSchema.safeParse(sanitized)
  if (!result.success) {
    ctx.addIssue({
      code: 'custom',
      message: formatIssues(result.error.issues),
    })
    return z.NEVER
  }

  return result.data
}

function sanitizeUrls(urls: unknown): unknown {
  if (!Array.isArray(urls)) {
    return urls
  }

  return urls.map((item, index) => {
    if (!isPlainObject(item)) {
      return item
    }

    warnUnsupportedKeys(
      Object.keys(item),
      SUPPORTED_SERVICE_URL_KEYS,
      `service_options.urls[${index}]`
    )

    return Object.fromEntries(
      SUPPORTED_SERVICE_URL_KEYS.filter((key) => key in item).map((key) => [
        key,
        item[key],
      ])
    )
  })
}

function warnUnsupportedKeys(
  keys: string[],
  supportedKeys: readonly string[],
  path: string
): void {
  const supported = new Set<string>(supportedKeys)
  const unsupportedKeys = keys.filter((key) => !supported.has(key))
  if (unsupportedKeys.length === 0) {
    return
  }

  core.warning(
    `${path}: ignoring unsupported field(s): ${unsupportedKeys.join(', ')}. Supported fields: ${supportedKeys.join(', ')}.`
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
