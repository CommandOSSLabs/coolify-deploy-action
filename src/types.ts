import type { UpdateServiceOptions } from './update-service-options.ts'

export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }

export type CoolifyEnvVar = {
  key: string
  value: string
  is_secret: boolean
}

export type Inputs = {
  coolifyDomain: string
  apiToken: string
  dockerCompose: string
  environmentVariables: CoolifyEnvVar[]
  projectUuid?: string
  serverUuid?: string
  environmentNameOrUuid?: string
  serviceUuid?: string
  serviceOptions?: UpdateServiceOptions
  requestTimeoutMs: number
  requestRetryCount: number
}
