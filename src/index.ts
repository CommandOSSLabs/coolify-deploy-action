import * as core from '@actions/core'
import { CoolifyClient } from './coolify-client.ts'
import { ServiceUuidNotReturnedError } from './errors.ts'
import { readInputs } from './input.ts'
import {
  buildCreateBody,
  buildServiceOptionsBody,
  buildUpdateBody,
} from './payload.ts'
import { extractServiceUuid } from './response.ts'
import { writeActionSummary } from './summary.ts'

async function main(): Promise<void> {
  const inputs = readInputs()
  const client = new CoolifyClient(
    inputs.coolifyDomain,
    inputs.apiToken,
    inputs.requestTimeoutMs,
    inputs.requestRetryCount
  )

  let serviceUuid = inputs.serviceUuid
  let created = false

  if (serviceUuid) {
    core.info(`Updating Coolify service '${serviceUuid}'.`)
    const body = buildUpdateBody(inputs)
    await client.updateService(serviceUuid, body)
  } else {
    core.info('Creating Coolify Docker Compose service.')
    const body = buildCreateBody(inputs)
    const createdService = await client.createDockerComposeApplication(body)
    serviceUuid = extractServiceUuid(createdService)
    created = true

    if (!serviceUuid) throw new ServiceUuidNotReturnedError()

    if (inputs.serviceOptions) {
      core.info(
        `Applying service options to newly created service '${serviceUuid}'.`
      )
      await client.updateService(serviceUuid, buildServiceOptionsBody(inputs))
    }
  }

  core.setOutput('service_uuid', serviceUuid)
  core.setOutput('created', String(created))

  core.info(
    `Syncing ${inputs.environmentVariables.length} environment variable(s).`
  )
  await client.updateServiceEnvs(serviceUuid, inputs.environmentVariables)

  core.info(`Restarting Coolify service '${serviceUuid}' to apply changes.`)
  await client.restartService(serviceUuid)

  await writeActionSummary(inputs, { serviceUuid, created })
}

try {
  await main()
} catch (error) {
  core.setFailed(error instanceof Error ? error.message : String(error))
}
