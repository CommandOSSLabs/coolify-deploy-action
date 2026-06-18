# Coolify Docker Compose Deploy Action

Create or update a Coolify Docker Compose service, sync environment variables, and restart the service to apply changes.

Works with Coolify Cloud and self-hosted Coolify instances.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `coolify_domain` | `app.coolify.io` | Coolify domain or base URL. `https://` and `/api/v1` are added automatically when omitted. |
| `api_token` | - | Coolify API token. |
| `docker_compose` | - | Docker Compose file content or path to a compose file. |
| `environment_variables` | - | JSON array with `key`, `value`, and `is_secret` fields. |
| `project_uuid` | - | Required when creating a new service. |
| `server_uuid` | - | Required when creating a new service. |
| `environment_name_or_uuid` | - | Required when creating a new service. |
| `service_uuid` | - | Existing service UUID. If omitted, a new service is created. |
| `service_options` | - | JSON object with `name`, `description`, and/or `urls`. Other fields are ignored with a warning. Not used during service creation. |
| `request_timeout_ms` | `30000` | HTTP request timeout. |
| `request_retry_count` | `0` | Retries for timed-out or unknown transport errors. Coolify HTTP response errors are not retried. |

## Outputs

- `service_uuid`: Existing or newly created Coolify service UUID.
- `created`: `true` when the action created a new service, otherwise `false`.

## Environment Variables

Accepted format — JSON array with `key`, `value`, and `is_secret`:

```yaml
environment_variables: |
  [
    { "key": "NODE_ENV", "value": "production", "is_secret": false },
    { "key": "API_TOKEN", "value": "${{ secrets.API_TOKEN }}", "is_secret": true }
  ]
```

Values marked with `is_secret: true` are masked in GitHub Actions logs.

## Docker Compose Input

Provide raw compose content:

```yaml
docker_compose: |
  services:
    web:
      image: ghcr.io/acme/web:latest
      ports:
        - "3000:3000"
```

Or provide a file path:

```yaml
docker_compose: docker-compose.yml
```

## Examples

Create a Docker Compose service:

```yaml
- name: Deploy to Coolify
  uses: CommandOSSLabs/coolify-deploy-action@v1
  with:
    api_token: ${{ secrets.COOLIFY_API_TOKEN }}
    docker_compose: docker-compose.yml
    project_uuid: ${{ secrets.COOLIFY_PROJECT_UUID }}
    server_uuid: ${{ secrets.COOLIFY_SERVER_UUID }}
    environment_name_or_uuid: production
    environment_variables: |
      [
        { "key": "NODE_ENV", "value": "production", "is_secret": false },
        { "key": "COMMIT_SHA", "value": "${{ github.sha }}", "is_secret": false }
      ]
    service_options: |
      {
        "name": "web",
        "description": "Production web service"
      }
```

Update an existing service:

```yaml
- name: Deploy to existing Coolify service
  uses: CommandOSSLabs/coolify-deploy-action@v1
  with:
    api_token: ${{ secrets.COOLIFY_API_TOKEN }}
    service_uuid: ${{ secrets.COOLIFY_SERVICE_UUID }}
    docker_compose: docker-compose.yml
    environment_variables: |
      [
        { "key": "COMMIT_SHA", "value": "${{ github.sha }}", "is_secret": false }
      ]
```

## License

This project is licensed under the [Apache License 2.0](LICENSE).