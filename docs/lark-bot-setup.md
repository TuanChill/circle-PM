# Circle Lark assignment bot

Circle can connect a regular Lark custom app bot to each workspace. When an issue is assigned or reassigned, Circle posts the issue identifier/title to that workspace’s configured group and mentions the assignee. The bot does not listen for chat messages, search issues, or use an agent/LLM.

## Create the Lark app

1. In the [Lark Developer Console](https://open.larksuite.com/), create a company custom app in the tenant used by the workspace.
2. Enable the **Bot** capability and set its name and avatar.
3. Add the current Lark permission required to send group messages. The app does not need inbound event subscriptions or contact-directory access for this integration. Review the scope and release requirements in the Developer Console before releasing the app.
4. Release a test version to the intended users and add the bot to the destination group.
5. Keep the App ID and App Secret available to the workspace admin. The App Secret is encrypted by Circle before it is stored.

Circle uses the official [`@larksuiteoapi/node-sdk`](https://github.com/larksuite/node-sdk) message API. GoClaw’s Lark adapter was reviewed for architecture only; no GoClaw code is copied or adapted. Its license is [CC BY-NC 4.0](https://github.com/nextlevelbuilder/goclaw/blob/28afa5b63e01a1fa7ee4c2bb22ac1eac0c26444f/LICENSE).

## Configure Circle

Each Circle workspace has its own Lark app/domain, group chat ID, enabled state, and member mappings. Workspaces can use the same app when they belong to the same Lark tenant and the bot is in each configured group. A workspace connected to another tenant needs its own app credentials. Circle never selects a group or member mapping from another workspace.

1. Sign in as that Circle workspace’s owner or admin and open **Workspace settings → Integrations**.
2. Select the Lark domain: `https://open.larksuite.com` for Lark Global or `https://open.feishu.cn` for Feishu China.
3. Enter the app ID, app secret, and destination group chat ID. To retain a saved secret, leave the secret field blank.
4. For each Circle member to mention, enter that user’s Lark `open_id` for the configured app/tenant. Confirm the ID in the Lark tenant before saving. Circle does not infer identity from a matching name or email.
5. Save the settings, then enable assignment notifications. App ID, secret, and group ID are required before enabling.

Lark `open_id` values are scoped to an app. If the workspace changes its Lark app or tenant, verify and update the member mappings. A missing mapping moves the queued event to **needs configuration** and Circle does not send a lookalike plain-text mention.

## Run the service

Set `LARK_INTEGRATION_ENCRYPTION_KEY` in the deployment secret manager to a stable 32-byte hexadecimal key, generated for example with `openssl rand -hex 32`. Set the same value in `project-service` and `lark-bot-service`. Keep a protected backup of this key: saved app secrets cannot be decrypted without it. Do not rotate it without first re-encrypting the stored credentials.

`project-service` listens for internal gRPC on port `3314` by default. `lark-bot-service` uses `GRPC_PROJECT_SERVICE_HOST` and `GRPC_PROJECT_SERVICE_PORT` to reach it; the default Compose host is `project-service`. Compose passes both services the encryption key and keeps the gRPC listener on the internal network.

For local development, provide these settings through your local environment configuration:

| Variable | Default | Used by |
|---|---|---|
| `LARK_INTEGRATION_ENCRYPTION_KEY` | required, 64 hex characters | project-service and lark-bot-service |
| `GRPC_PROJECT_SERVICE_HOST` | deployment-specific | both services; use `0.0.0.0` for local listener/client as required by the repo gRPC convention |
| `GRPC_PROJECT_SERVICE_PORT` | `3314` | both services |
| `LARK_BOT_SERVICE_APP_PORT` | `3305` | lark-bot-service HTTP health endpoint |
| `LARK_BOT_POLL_INTERVAL_MS` | `5000` | lark-bot-service outbox polling interval |

Build and start the services using the repository scripts:

```bash
pnpm --filter project-service build
pnpm --filter lark-bot-service build
pnpm --filter project-service start:dev
pnpm --filter lark-bot-service start:dev
```

For Compose, use the repository’s normal build/start workflow after setting the required key in the deployment environment. Apply the project-service migration through the normal migration workflow after taking the database backup required by your deployment process.

The health endpoint is `/circle/lark-bot/health` on port `3305`. It reports worker state and the last successful poll/error code; it never includes app credentials or message payloads.

## Verify delivery

1. Assign a test issue to a member with a verified mapping. Confirm one group message includes the issue identifier/title and tags that member.
2. Reassign it to a different mapped member and confirm the new member is mentioned.
3. Edit another issue field without changing its assignee and confirm no assignment message is generated. Unassigning also does not send a message.
4. Configure another Circle workspace with a separate test group and mapping. Confirm its issue notifications go only to its own group.
5. Check the Integrations page’s delivery counts for pending, needs-configuration, and failed events. Correct a missing workspace mapping or integration and save to requeue blocked events.

Delivery uses a transactional outbox, leases, acknowledgements, and bounded retries. Lark does not provide an idempotency key for message creation, so a process/network failure after Lark accepts a message but before Circle records the acknowledgement can result in a duplicate; delivery is at-least-once in that failure window.

Disable the workspace integration to stop new posts. Existing pending events remain available for review. Circle issue assignments and in-app notifications continue to work independently.
