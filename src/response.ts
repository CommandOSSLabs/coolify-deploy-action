import type { JsonObject, JsonValue } from './types.ts'

export function extractServiceUuid(value: JsonValue): string | undefined {
  const object = asObject(value)
  const directUuid =
    stringField(object, 'uuid') ?? stringField(object, 'service_uuid')
  if (directUuid) {
    return directUuid
  }

  return (
    stringField(asObject(object?.data), 'uuid') ??
    stringField(asObject(object?.service), 'uuid')
  )
}

function asObject(value: JsonValue | undefined): JsonObject | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value
  }

  return undefined
}

function stringField(
  object: JsonObject | undefined,
  field: string
): string | undefined {
  const value = object?.[field]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
