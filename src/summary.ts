import * as core from '@actions/core'
import type { Inputs } from './types.ts'

export async function writeActionSummary(
  inputs: Inputs,
  result: {
    serviceUuid: string
    created: boolean
  }
): Promise<void> {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    core.debug('GITHUB_STEP_SUMMARY is not set; skipping action summary.')
    return
  }

  try {
    await core.summary
      .addHeading('Coolify Docker Compose Deployment', 2)
      .addTable(
        [
          [
            { data: 'Field', header: true },
            { data: 'Value', header: true },
          ],
          ['Result', result.created ? 'Created service' : 'Updated service'],
          ['Service UUID', result.serviceUuid],
          [
            'Environment variables',
            `${inputs.environmentVariables.length} synced`,
          ],
          ['Retries configured', String(inputs.requestRetryCount)],
        ].map((row) =>
          row.map((cell) =>
            typeof cell === 'string'
              ? escapeHtml(cell)
              : { ...cell, data: escapeHtml(cell.data) }
          )
        )
      )
      .write()
  } catch (error) {
    core.summary.emptyBuffer()
    core.warning(
      `Could not write GitHub step summary: ${getErrorMessage(error)}`
    )
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
