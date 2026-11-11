# CineVerse Admin Worker

This Worker serves the admin UI and exposes a same-origin, authenticated catalog API. The GitHub token is only read from the Worker secret binding and is never sent to the browser.

## 1. Create the Worker

From this directory:

```bash
npm create cloudflare@latest -- --existing-script ./src/index.js
npx wrangler deploy
```

If the scaffold command is not needed in your environment, install Wrangler with `npm install --save-dev wrangler` and deploy with `npx wrangler deploy`.

## 2. Protect the Worker with Cloudflare Access

1. In Cloudflare Zero Trust, create a Self-hosted Access application for the exact Worker hostname shown after deployment (the `*.workers.dev` hostname).
2. Add an Allow policy restricted to the administrator email address(es). Do not use an Everyone policy.
3. Copy the application's Audience (AUD) tag.
4. Set `CF_ACCESS_TEAM_DOMAIN` to the team domain without protocol, for example `example.cloudflareaccess.com`.
5. Set `CF_ACCESS_AUD` to the copied AUD tag, then deploy again.

The Worker independently validates the `Cf-Access-Jwt-Assertion` signature, issuer, audience, and expiry. If Access is not configured, the Worker fails closed and does not serve the panel.

## 3. Add the GitHub token as a Worker secret

Create a GitHub fine-grained personal access token scoped only to repository `megamrtklc/mrtklc`, with **Contents: Read and write** permission. Do not paste the token into chat, source files, or `wrangler.jsonc`.

```bash
npx wrangler secret put GITHUB_TOKEN
```

Paste the token into the terminal prompt. The token is stored as an encrypted Worker secret.

## 4. Open the panel

Open the Worker hostname. Cloudflare Access will authenticate the administrator before the Worker serves the UI or API.

## API

- `GET /api/session` — verified Access identity.
- `GET /api/catalog` — current catalog and GitHub blob SHA.
- `PUT /api/catalog` — validated catalog update. Requires the latest SHA; stale writes return HTTP 409.

All routes require a valid Cloudflare Access JWT. The API is same-origin and does not enable cross-origin requests. Catalog writes create a normal Git commit, preserving GitHub history for rollback.

## Notes

- The public GitHub Pages copy of `/admin/` remains a read-only preview. Do not use it for privileged operations.
- The protected Worker URL is the actual management endpoint.
- Never commit `.dev.vars`, `.env`, or any token.
