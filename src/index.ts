import * as core from '@actions/core'
import { CoolifyClient } from './coolify-client.ts'
import { readInputs } from './input.ts'
import { writeActionSummary } from './summary.ts'
import type { Inputs, JsonObject, JsonValue } from './types.ts'

async function main(): Promise<void> {
  const inputs = readInputs()
  const client = new CoolifyClient(
    inputs.coolifyDomain,
    inputs.apiToken,
    inputs.requestTimeoutMs,
    inputs.requestRetryCount
  )

  let appUuid = inputs.appUuid
  let created = false

  if (appUuid) {
    core.info(`Updating Coolify application '${appUuid}'.`)
    await client.updateApplication(appUuid, buildUpdateBody(inputs))
  } else {
    core.info('Creating Coolify Docker image application.')
    const createdApplication = await client.createDockerImageApplication(
      buildCreateBody(inputs)
    )
    appUuid = extractAppUuid(createdApplication)
    created = true

    if (!appUuid) {
      throw new Error(
        'Coolify did not return an application UUID after creation.'
      )
    }
  }

  core.setOutput('app_uuid', appUuid)
  core.setOutput('created', String(created))

  if (inputs.environmentVariables.length > 0) {
    core.info(
      `Syncing ${inputs.environmentVariables.length} environment variable(s).`
    )
    await client.updateApplicationEnvs(appUuid, inputs.environmentVariables)
  }

  core.info(`Triggering Coolify deployment for '${appUuid}'.`)
  const deployment = await client.deployApplication(appUuid)
  const deploymentUuid = extractDeploymentUuid(deployment)

  if (deploymentUuid) {
    core.setOutput('deployment_uuid', deploymentUuid)
  }

  await writeActionSummary(inputs, {
    appUuid,
    created,
    deploymentUuid,
  })
}

function buildCreateBody(inputs: Inputs): JsonObject {
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

function buildUpdateBody(inputs: Inputs): JsonObject {
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

function extractAppUuid(value: JsonValue): string | undefined {
  const object = asObject(value)
  const directUuid =
    stringField(object, 'uuid') ?? stringField(object, 'app_uuid')
  if (directUuid) {
    return directUuid
  }

  return (
    stringField(asObject(object?.data), 'uuid') ??
    stringField(asObject(object?.application), 'uuid')
  )
}

function extractDeploymentUuid(value: JsonValue): string | undefined {
  const object = asObject(value)
  const directUuid =
    stringField(object, 'deployment_uuid') ?? stringField(object, 'uuid')
  if (directUuid) {
    return directUuid
  }

  return stringField(asObject(object?.data), 'deployment_uuid')
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

try {
  await main()
} catch (error) {
  core.setFailed(error instanceof Error ? error.message : String(error))
}
