import axios, { type AxiosError, type AxiosInstance, type Method } from 'axios'
import type { CoolifyEnvVar, JsonObject, JsonValue } from './types.ts'

export class CoolifyClient {
  private readonly http: AxiosInstance

  constructor(
    coolifyDomain: string,
    apiToken: string,
    private readonly requestTimeoutMs: number,
    private readonly requestRetryCount: number
  ) {
    this.http = axios.create({
      baseURL: normalizeApiBaseUrl(coolifyDomain),
      timeout: requestTimeoutMs,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    })
  }

  async createDockerComposeApplication(body: JsonObject): Promise<JsonValue> {
    return this.request('POST', '/applications/dockercompose', body)
  }

  async updateService(uuid: string, body: JsonObject): Promise<JsonValue> {
    return this.request('PATCH', `/services/${encodeURIComponent(uuid)}`, body)
  }

  async updateServiceEnvs(
    uuid: string,
    envs: CoolifyEnvVar[]
  ): Promise<JsonValue> {
    return this.request(
      'PATCH',
      `/services/${encodeURIComponent(uuid)}/envs/bulk`,
      { data: envs }
    )
  }

  private async request(
    method: Method,
    url: string,
    body?: JsonObject
  ): Promise<JsonValue> {
    let attempt = 0

    while (true) {
      try {
        return await this.requestOnce(method, url, body)
      } catch (error) {
        if (
          !(error instanceof CoolifyRetryableError) ||
          attempt >= this.requestRetryCount
        ) {
          throw error
        }

        attempt += 1
      }
    }
  }

  private async requestOnce(
    method: Method,
    url: string,
    body?: JsonObject
  ): Promise<JsonValue> {
    try {
      const response = await this.http.request({
        method,
        url,
        data: body,
      })

      return toJsonValue(response.data)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new CoolifyHttpError(
            `Coolify API ${method} ${url} failed with ${error.response.status} ${
              error.response.statusText
            }: ${formatErrorBody(toJsonValue(error.response.data))}`
          )
        }

        if (isAxiosTimeoutError(error)) {
          throw new CoolifyTimeoutError(
            `Coolify API ${method} ${url} timed out after ${this.requestTimeoutMs}ms.`
          )
        }

        throw new CoolifyUnknownRequestError(
          `Coolify API ${method} ${url} failed before a response was received: ${error.message}`
        )
      }

      throw error
    }
  }
}

class CoolifyHttpError extends Error {}

class CoolifyRetryableError extends Error {}

class CoolifyTimeoutError extends CoolifyRetryableError {}

class CoolifyUnknownRequestError extends CoolifyRetryableError {}

function isAxiosTimeoutError(error: AxiosError): boolean {
  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error.message.toLowerCase().includes('timeout')
  )
}

function normalizeApiBaseUrl(coolifyDomain: string): string {
  const trimmed = coolifyDomain.trim().replace(/\/+$/, '')
  if (trimmed.length === 0) {
    throw new Error("Input 'coolify_domain' cannot be empty.")
  }

  const baseUrl = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`

  return baseUrl.endsWith('/api/v1') ? baseUrl : `${baseUrl}/api/v1`
}

function toJsonValue(value: unknown): JsonValue {
  if (value === undefined || value === '') {
    return null
  }

  if (isJsonValue(value)) {
    return value
  }

  return JSON.stringify(value)
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue)
  }

  if (typeof value === 'object') {
    return Object.values(value).every(isJsonValue)
  }

  return false
}

function formatErrorBody(parsedBody: JsonValue): string {
  const formatted =
    typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody)

  return (formatted || '').slice(0, 2000)
}
