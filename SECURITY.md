# Security Policy

isVisible helps blind and low-vision users read, navigate, and interact with their devices. Many users depend on assistive technology, so a security bug here is also an accessibility failure. We take both seriously.

## Supported versions

| Version | Supported |
| --- | --- |
| main branch | yes |
| older tags | best effort |

## Reporting a vulnerability

Please report responsibly:

1. Email **security@isvisible.example** with:
   - A short title and a severity guess
   - The affected component (PWA, server proxy, firmware, tools)
   - Reproduction steps or a proof of concept
   - Any relevant logs or screenshots
2. You will get an acknowledgement within **48 hours**.
3. We will keep you updated while we triage and fix.
4. Details may be published **90 days** after the report under coordinated disclosure, even if a fix is still in progress. We will credit you in the disclosure unless you ask to stay anonymous.

Do not open a public GitHub issue for security reports.

## Scope

In scope:

- `pwa/`: the Progressive Web App, including all modules, the service worker, and build output
- `pwa/server/`: the server-side proxy that holds provider API keys
- `firmware/`: Arduino targets accepting the compact tactile protocol
- `tools/`: Python bridges and CLI utilities

Out of scope:

- Vulnerabilities in third-party services (report those to NVIDIA or Cloudflare directly)
- Social engineering against users
- Missing rate limits on demo deployments

## Threat model

The main assets are user data (clipboard text, camera frames, voice input) and provider credentials. The main trust boundaries are the browser bundle, the server proxy, and the serial/HID link to hardware.

### Secret leakage into the client bundle

Vite exposes any variable prefixed with `VITE_` to the browser, which makes that prefix dangerous for secrets.

Guard rails:

- `scripts/check-env-leakage.mjs` scans for `VITE_`-prefixed secrets. It runs as `npm run check-env` and again automatically through the `prebuild` hook, so `npm run build` fails if a secret would leak into the bundle.
- Provider keys such as `NVIDIA_VISION_API_KEY` live only in the server-side proxy (`pwa/server/index.mjs`). The browser talks to the proxy; keys never enter client code.
- Never prefix secrets with `VITE_`. Only non-secret, public configuration may use it.
- `.env` is covered by `.gitignore` and never committed. Keep it that way.

### Content Security Policy

`pwa/index.html` ships `script-src 'self' 'wasm-unsafe-eval'` with no `'unsafe-inline'`, which blocks injected inline scripts. The `'wasm-unsafe-eval'` source exists solely for the Liblouis WASM translator. Production headers from `pwa/public/_headers` add `X-Frame-Options: DENY`, `frame-ancestors 'none'`, and `X-Content-Type-Options: nosniff`.

If you need a new script, put it in `pwa/public/` and load it with `<script src>`. Do not weaken the CSP.

### Hardware link

The compact protocol over Web Serial / WebHID drives physical pins. Firmware validates frame structure and clamps values, but treat anything arriving on the serial port as untrusted input.

## Safe development practices

- Run `cd pwa && npm run check-env` before pushing.
- Add secrets only as server-side environment variables.
- Review your diff for accidental key paste before opening a PR. The pull request template includes a checklist item for this.
