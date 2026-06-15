# Coolify Docker Image Deploy Action

Create or update a Coolify Docker-image application, sync environment variables, and trigger a deployment.

Works with Coolify Cloud and self-hosted Coolify instances.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `coolify_domain` | `app.coolify.io` | Coolify domain or base URL. `https://` and `/api/v1` are added automatically when omitted. |
| `api_token` | - | Coolify API token. |
| `docker_image` | - | Docker registry image name. |
| `docker_image_tag` | - | Docker registry image tag. |
| `environment_variables` | - | JSON object, JSON array, or dotenv lines. |
| `project_uuid` | - | Required when creating a new app. |
| `server_uuid` | - | Required when creating a new app. |
| `environment_name` | - | Required when creating a new app unless `environment_uuid` is provided. |
| `environment_uuid` | - | Required when creating a new app unless `environment_name` is provided. |
| `app_uuid` | - | Existing app UUID. If omitted, a new app is created. |
| `ports_exposes` | - | Required when creating a new app unless supplied in `optional_options`. |
| `optional_options` | - | JSON object merged into the Coolify create/update body. |
| `request_timeout_ms` | `30000` | HTTP request timeout. |
| `request_retry_count` | `0` | Retries for timed-out or unknown transport errors. Coolify HTTP response errors are not retried. |

Explicit top-level inputs override duplicate keys in `optional_options`.

## Outputs

- `app_uuid`: Existing or newly created Coolify application UUID.
- `created`: `true` when the action created a new app, otherwise `false`.
- `deployment_uuid`: Deployment UUID when Coolify returns one.

## Environment Variables

As a JSON object:

```yaml
environment_variables: |
  {
    "NODE_ENV": "production",
    "PUBLIC_URL": "https://example.com"
  }
```

As a JSON array with Coolify flags:

```yaml
environment_variables: |
  [
    { "key": "NODE_ENV", "value": "production" },
    { "key": "API_URL", "value": "https://api.example.com", "is_buildtime": true }
  ]
```

As dotenv lines:

```yaml
environment_variables: |
  NODE_ENV=production
  PUBLIC_URL=https://example.com
```

## Examples

Create a Docker-image app and deploy it:

```yaml
- name: Deploy to Coolify
  uses: CommandOSSLabs/coolify-deploy-action@v1
  with:
    api_token: ${{ secrets.COOLIFY_API_TOKEN }}
    docker_image: ghcr.io/acme/web
    docker_image_tag: ${{ github.sha }}
    project_uuid: ${{ secrets.COOLIFY_PROJECT_UUID }}
    server_uuid: ${{ secrets.COOLIFY_SERVER_UUID }}
    environment_name: production
    ports_exposes: '3000'
    environment_variables: |
      NODE_ENV=production
      COMMIT_SHA=${{ github.sha }}
    optional_options: |
      {
        "name": "web",
        "domains": "https://web.example.com",
        "health_check_enabled": true,
        "health_check_path": "/health"
      }
```

Update an existing app:

```yaml
- name: Deploy to existing Coolify app
  uses: CommandOSSLabs/coolify-deploy-action@v1
  with:
    api_token: ${{ secrets.COOLIFY_API_TOKEN }}
    app_uuid: ${{ secrets.COOLIFY_APP_UUID }}
    docker_image: ghcr.io/acme/web
    docker_image_tag: ${{ github.sha }}
```

## License

This project is licensed under the [Apache License 2.0](LICENSE).
