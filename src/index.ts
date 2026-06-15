import * as core from '@actions/core'
import { CoolifyClient } from './coolify-client.ts'
import { readInputs } from './input.ts'
import { buildCreateBody, buildUpdateBody } from './payload.ts'
import { extractAppUuid, extractDeploymentUuid } from './response.ts'
import { writeActionSummary } from './summary.ts'

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

try {
  await main()
} catch (error) {
  core.setFailed(error instanceof Error ? error.message : String(error))
}
