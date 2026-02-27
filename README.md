# auth-service

Authentication microservice for the **Library Management System** — a portfolio project demonstrating a production-style microservice architecture across multiple languages and frameworks.

> The full system includes a user-service (Kotlin/Spring Boot), catalog-service (Java/Spring Boot), loan-service (Kotlin/Spring Boot), notification-service (TypeScript/Node.js), and an API gateway (Spring Cloud Gateway). Each service owns its own database and communicates asynchronously via RabbitMQ or synchronously over REST.

## Overview

The auth-service is responsible for all authentication concerns in the system. It issues and validates JWTs, manages refresh tokens, and handles the invite-based account activation flow. No third-party identity providers are involved — all credentials are managed on the platform.

The service follows the OAuth 2.0 framework (RFC 6749), exposing a `/oauth/token` endpoint that supports the **Resource Owner Password** and **Refresh Token** grant types, and a `/oauth/revoke` endpoint conforming to RFC 7009.

## Features

- **Login** — validates email/password credentials and issues a short-lived JWT access token paired with a longer-lived refresh token
- **Token refresh** — exchanges a valid refresh token for a new token pair; the old refresh token is immediately revoked (refresh token rotation)
- **Token revocation** — revokes a refresh token per RFC 7009; always returns 200 to avoid leaking token existence
- **Invite flow** — on user creation, receives a RabbitMQ event from the user-service, generates a single-use invite token, and publishes it for the notification-service to deliver by email
- **Password activation** — allows a new user to set their password by redeeming the invite token
- **Password change** — allows an authenticated user to update their password; all active refresh tokens are revoked to invalidate other sessions
- **Role synchronisation** — keeps the local credential store in sync with role changes published by the user-service

## Tech Stack

- **Runtime:** Node.js 20, TypeScript
- **Framework:** Express
- **Database:** PostgreSQL (via `pg`, connection pool)
- **Messaging:** RabbitMQ (via `amqplib`)
- **Auth:** JWT (`jsonwebtoken`), bcrypt, SHA-256 token hashing
- **Validation:** Zod (schema validation for environment config and request bodies)
- **Containerisation:** Docker (multi-stage build, non-root user)

## Security Design

| Concern | Approach |
|---|---|
| Password storage | bcrypt with cost factor 12 |
| Token storage | SHA-256 hash stored in DB; raw value sent to client only |
| Refresh token reuse | Rotation — each refresh revokes the old token and issues a new one |
| Refresh race condition | `SELECT ... FOR UPDATE` pessimistic lock within a transaction |
| Error messages | Identical response for wrong password vs unknown email to prevent account enumeration |

## API

### OAuth endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/oauth/token` | Authenticate (`grant_type=password`) or refresh (`grant_type=refresh_token`) |
| `POST` | `/oauth/revoke` | Revoke a refresh token |

**Login request**
```
POST /oauth/token
Content-Type: application/json

{ "grant_type": "password", "username": "user@example.com", "password": "..." }
```

**Refresh request**
```
POST /oauth/token
Content-Type: application/json

{ "grant_type": "refresh_token", "refresh_token": "..." }
```

### Auth endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/set-password` | — | Activate account using an invite token |
| `POST` | `/auth/change-password` | Bearer token | Change password for the authenticated user |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ "status": "ok" }` |

## Messaging

The service consumes events from the `user-service.events` RabbitMQ exchange and publishes to `auth-service.events`. Each queue has a corresponding dead-letter queue (DLQ) for messages that cannot be processed.

| Event consumed | Action |
|---|---|
| `user.created` | Creates a credential record and issues an invite token; publishes `auth.invite_token_generated` |
| `user.invite_resent` | Revokes any outstanding invite tokens and issues a new one; publishes `auth.invite_token_generated` |
| `user.role_updated` | Updates the role on the local credential record |
| `user.deleted` | Deletes the credential record (tokens are removed via `ON DELETE CASCADE`) |

The RabbitMQ connection uses **exponential backoff** (capped at 30 s) for reconnection on startup or failure.

## Running Locally

The included `docker-compose.yml` starts the service together with PostgreSQL and RabbitMQ.

```bash
docker compose up --build
```

The service will be available at `http://localhost:3000`. The RabbitMQ management UI is available at `http://localhost:15672` (guest / guest).

Migrations run automatically on container startup.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `DB_HOST` | — | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | — | Database name |
| `DB_USER` | — | Database user |
| `DB_PASSWORD` | — | Database password |
| `DB_POOL_MIN` | `2` | Minimum pool connections |
| `DB_POOL_MAX` | `10` | Maximum pool connections |
| `DB_SSL` | `false` | Enable SSL for the DB connection |
| `JWT_SECRET` | — | Secret for signing JWTs (min 32 characters) |
| `JWT_ACCESS_EXPIRES_IN` | `900` | Access token lifetime in seconds |
| `JWT_REFRESH_EXPIRES_IN` | `604800` | Refresh token lifetime in seconds |
| `INVITE_TOKEN_EXPIRES_IN` | `86400` | Invite token lifetime in seconds |
| `RABBITMQ_URL` | — | RabbitMQ connection URL |
| `RABBITMQ_PREFETCH` | `10` | Per-consumer prefetch count |

All variables are validated with Zod at startup — the process exits immediately with a descriptive error if any required variable is missing or invalid.