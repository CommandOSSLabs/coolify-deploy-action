import { encodeDockerComposeRaw } from './docker-compose.ts'
import type { Inputs, JsonObject, JsonValue } from './types.ts'

export function buildCreateBody(inputs: Inputs): JsonObject {
  return removeUndefined({
    project_uuid: inputs.projectUuid,
    server_uuid: inputs.serverUuid,
    ...resolveEnvironmentFields(inputs.environmentNameOrUuid),
    docker_compose_raw: encodeDockerComposeRaw(inputs.dockerCompose),
  })
}

export function buildUpdateBody(inputs: Inputs): JsonObject {
  return removeUndefined({
    ...buildPlacementFields(inputs),
    ...inputs.serviceOptions,
    docker_compose_raw: encodeDockerComposeRaw(inputs.dockerCompose),
  })
}

export function buildServiceOptionsBody(inputs: Inputs): JsonObject {
  return removeUndefined({
    ...buildPlacementFields(inputs),
    ...inputs.serviceOptions,
  })
}

function buildPlacementFields(inputs: Inputs): JsonObject {
  return removeUndefined({
    project_uuid: inputs.projectUuid,
    server_uuid: inputs.serverUuid,
    ...resolveEnvironmentFields(inputs.environmentNameOrUuid),
  })
}

function resolveEnvironmentFields(
  environmentNameOrUuid: string | undefined
): JsonObject {
  if (!environmentNameOrUuid) {
    return {}
  }

  if (isCoolifyUuid(environmentNameOrUuid)) {
    return { environment_uuid: environmentNameOrUuid }
  }

  return { environment_name: environmentNameOrUuid }
}

function isCoolifyUuid(value: string): boolean {
  return /^[a-z0-9]{20,}$/.test(value)
}

function removeUndefined(record: Record<string, unknown>): JsonObject {
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, JsonValue] => {
      const [, value] = entry
      return value !== undefined
    })
  )
}
