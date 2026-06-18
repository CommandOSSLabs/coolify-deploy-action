import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

export function resolveDockerComposeContent(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('must not be empty')
  }

  const candidatePaths = [trimmed]
  if (!isAbsolute(trimmed) && process.env.GITHUB_WORKSPACE) {
    candidatePaths.push(resolve(process.env.GITHUB_WORKSPACE, trimmed))
  }

  if (!trimmed.includes('\n')) {
    for (const candidatePath of candidatePaths) {
      if (existsSync(candidatePath)) {
        return readFileSync(candidatePath, 'utf8')
      }
    }
  }

  return raw
}

export function encodeDockerComposeRaw(content: string): string {
  return Buffer.from(content, 'utf8').toString('base64')
}
