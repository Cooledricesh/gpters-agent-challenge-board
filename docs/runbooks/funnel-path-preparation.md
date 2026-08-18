# Funnel Path Preparation and Rollback

> **Retired preparation procedure. Do not execute for current production onboarding.** This file preserves the pre-cutover Funnel setup evidence. New Vercel→NAS origins use a dedicated Cloudflare custom hostname as primary; GPTERS currently uses `https://gpters-api.rebridge.work`. The existing Funnel handler remains only as the tested rollback path. Current operations are documented in `docs/setup.md`, `docs/runbooks/nas-hard-cutover.md`, and `/Users/seunghyun/.hermes/workspaces/agent-ops/runbooks/vercel-to-nas-public-ingress.md`.

Updated: 2026-08-06
Status: prepared only; no Funnel mutation performed

## Immutable current baseline

- Tailscale Docker runtime version: `1.98.10` (`1.98.10-t36550d57f`)
- Public host: `baclava-nas.tailb06fb8.ts.net:443`
- Existing handler: `/ -> http://127.0.0.1:18787`
- Existing service: City Guardian
- Baseline public health: status `200`, body `{"status":"ok"}`
- Five-sample latency: `18.5, 18.9, 20.0, 21.2, 30.4 ms`
- Exact pre-change artifact: `docs/runbooks/artifacts/2026-08-06-funnel-prechange.json`
- Artifact SHA-256: `b21b0451663492bd6bb71cb6b506f3a0d9a55841cf61f8f4f4df058067b3a988`

The artifact contains no credentials. Do not replace it with a post-change snapshot.

## Why this path is safe to prepare but not yet apply

Tailscale 1.98.10 supports a second path handler without replacing `/`. Its implementation strips the configured mount prefix before proxying. Therefore:

- public `/gpters-challenge-board/health`
- proxies to API `/health`

The API currently rejects browser `Origin` requests and requires a Bearer service token for `/v1/*`. No public path is configured yet.

## Preflight gate

Run all checks immediately before any approved change:

```bash
DOCKER=/var/packages/ContainerManager/target/usr/bin/docker
sudo -n "$DOCKER" exec tailscale tailscale version
sudo -n "$DOCKER" exec tailscale tailscale funnel status --json
curl -fsS http://127.0.0.1:18787/health
curl -fsS http://127.0.0.1:18887/health
curl -fsS https://baclava-nas.tailb06fb8.ts.net/health
```

Stop if:

- Tailscale is not `1.98.10`
- current JSON differs from the pre-change artifact
- City Guardian or shadow API health is not `200`
- PostgreSQL, backup, Tailscale, or either API has an active incident

## Exact apply command — not executed

Only after separate approval:

```bash
DOCKER=/var/packages/ContainerManager/target/usr/bin/docker
sudo -n "$DOCKER" exec tailscale \
  tailscale funnel --bg --set-path=/gpters-challenge-board \
  http://127.0.0.1:18887
```

This command must add a handler; it must not replace `/`.

## Immediate post-apply gate

```bash
sudo -n "$DOCKER" exec tailscale tailscale funnel status --json
curl -fsS https://baclava-nas.tailb06fb8.ts.net/health
curl -fsS https://baclava-nas.tailb06fb8.ts.net/gpters-challenge-board/health
```

Required config:

- `/ -> http://127.0.0.1:18787`
- `/gpters-challenge-board -> http://127.0.0.1:18887`
- `AllowFunnel` remains enabled only for the existing HTTPS host

Required health:

- City Guardian status/body unchanged
- new path status `200`, body `{"status":"ok"}`
- existing City Guardian sample maximum no worse than the approved threshold

Do not add Vercel NAS environment variables until this gate passes.

## Preferred rollback: remove only the new path

```bash
sudo -n "$DOCKER" exec tailscale \
  tailscale funnel --https=443 --set-path=/gpters-challenge-board off
```

Then require exact baseline handler state and City Guardian health.

## Exact fallback rollback

Tailscale 1.98.10 has an undocumented but source-verified `serve set-raw` command that accepts `ipn.ServeConfig` JSON from stdin. Use it only if path-only removal fails or leaves a non-baseline config:

```bash
shasum -a 256 docs/runbooks/artifacts/2026-08-06-funnel-prechange.json
# Require: b21b0451663492bd6bb71cb6b506f3a0d9a55841cf61f8f4f4df058067b3a988

ssh faust@baclava-nas.tailb06fb8.ts.net \
  'DOCKER=/var/packages/ContainerManager/target/usr/bin/docker; sudo -n "$DOCKER" exec -i tailscale tailscale serve set-raw' \
  < docs/runbooks/artifacts/2026-08-06-funnel-prechange.json
```

After either rollback:

```bash
sudo -n "$DOCKER" exec tailscale tailscale funnel status --json
curl -fsS https://baclava-nas.tailb06fb8.ts.net/health
```

The JSON must equal the baseline artifact and City Guardian must return its baseline body. If rollback cannot restore both, treat it as a routing incident and do not retry apply.

## Evidence source

The exact add/remove and `set-raw` behavior was checked against Tailscale tag `v1.98.10`:

- `cmd/tailscale/cli/serve_v2.go`: `--set-path`, `off`, path-specific handler removal, `set-raw`
- `ipn/ipnlocal/serve.go`: mount prefix removal through `http.StripPrefix`
- `ipn/serve.go`: path handler add/remove while preserving other mounts

No Funnel or Serve configuration was changed while preparing this runbook.
