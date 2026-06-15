import type { Inputs, JsonObject, JsonValue } from './types.ts'

export function buildCreateBody(inputs: Inputs): JsonObject {
  return removeUndefined({
    ...inputs.optionalOptions,
    project_uuid: inputs.projectUuid,
    server_uuid: inputs.serverUuid,
    environment_name: inputs.environmentName,
    environment_uuid: inputs.environmentUuid,
    docker_registry_image_name: inputs.dockerImage,
    docker_registry_image_tag: inputs.dockerImageTag,
    ports_exposes: inputs.portsExposes ?? inputs.optionalOptions.ports_exposes,
  })
}

export function buildUpdateBody(inputs: Inputs): JsonObject {
  return removeUndefined({
    ...inputs.optionalOptions,
    docker_registry_image_name: inputs.dockerImage,
    docker_registry_image_tag: inputs.dockerImageTag,
    ports_exposes: inputs.portsExposes,
  })
}

function removeUndefined(record: Record<string, unknown>): JsonObject {
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, JsonValue] => {
      const [, value] = entry
      return value !== undefined
    })
  )
}
