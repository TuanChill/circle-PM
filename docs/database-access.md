# Production database access

Production PostgreSQL is available on the application server at `127.0.0.1:5534`, forwarded to the `db` container's port `5432`. The production Compose override binds this port to loopback only, so it is reachable through SSH on the server and is not exposed on its public network interface.

## Database client settings

Configure the database connection as follows:

| Setting | Value |
|---|---|
| Type | PostgreSQL |
| Host | `localhost` |
| Port | `5534` |
| Database | `ai-agent` |
| Username | Value of `DEFAULT_PG_USER` in `/opt/circle/be/.env` on the server |
| Password | Value of `DEFAULT_PG_PASSWORD` in `/opt/circle/be/.env` on the server |
| SSL | Disabled |

In the client's SSH tunnel settings, use the deployment host, SSH port `22`, and the deployment username and password. These are stored as the GitHub Actions secrets `SSH_HOST`, `SSH_USERNAME`, and `SSH_PASSWORD`. Keep the database Host set to `localhost`; the database client connects to that address from the SSH server side of the tunnel.

For a manual tunnel instead of the database client's built-in SSH tunnel:

```sh
ssh -N -L 5534:127.0.0.1:5534 SSH_USERNAME@SSH_HOST
```

Then connect your database client to `localhost:5534` with the database settings above. The SSH server must permit TCP forwarding (`AllowTcpForwarding yes`).
