import * as core from '@actions/core'
import { CoolifyClient } from './coolify-client.ts'
import { readInputs } from './input.ts'
import { buildCreateBody, buildUpdateBody } from './payload.ts'
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
    await client.updateService(serviceUuid, buildUpdateBody(inputs))
  } else {
    core.info('Creating Coolify Docker Compose service.')
    const createdService = await client.createDockerComposeApplication(
      buildCreateBody(inputs)
    )
    serviceUuid = extractServiceUuid(createdService)
    created = true

    if (!serviceUuid) {
      throw new Error('Coolify did not return a service UUID after creation.')
    }
  }

  core.setOutput('service_uuid', serviceUuid)
  core.setOutput('created', String(created))

  core.info(
    `Syncing ${inputs.environmentVariables.length} environment variable(s).`
  )
  await client.updateServiceEnvs(serviceUuid, inputs.environmentVariables)

  await writeActionSummary(inputs, {
    serviceUuid,
    created,
  })
}

try {
  await main()
} catch (error) {
  core.setFailed(error instanceof Error ? error.message : String(error))
}
