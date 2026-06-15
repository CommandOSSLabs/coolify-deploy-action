export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }

export type CoolifyEnvVar = {
  key: string
  value: string
  is_buildtime?: boolean
  is_runtime?: boolean
  is_preview?: boolean
  is_literal?: boolean
  is_multiline?: boolean
}

export type Inputs = {
  coolifyDomain: string
  apiToken: string
  dockerImage: string
  dockerImageTag?: string
  environmentVariables: CoolifyEnvVar[]
  projectUuid?: string
  serverUuid?: string
  environmentName?: string
  environmentUuid?: string
  appUuid?: string
  portsExposes?: string
  optionalOptions: JsonObject
  requestTimeoutMs: number
  requestRetryCount: number
}
