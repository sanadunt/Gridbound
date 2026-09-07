# Release dan operasi production

[Masterplan](../PRODUCTION-MASTERPLAN.md). Prosedur ini belum dijalankan untuk kandidat v0.4; no deploy approval implied.

## Release lifecycle

1. Freeze scope dan catat known issues.
2. Confirm release branch dan Hostinger auto-deploy behavior sebelum push.
3. Review working-tree diff; preserve recovery history; commit hanya setelah approval.
4. Clean checkout install/build, regenerate database/GDD, test/simulation/browser/device gates.
5. Package exact artifact, checksum, version/commit map dan release notes.
6. Rehearse rollback on isolated environment dengan representative save fixtures.
7. Product owner approves candidate + target URL/environment.
8. Deploy through approved GitHub/Hostinger flow.
9. Read back deployment ID/live version, run remote smoke.
10. Observe agreed window, triage, accept or rollback.

Do not change main, trigger auto-deploy, create public releases or send external announcements under documentation-only scope.

## Environment contract

Runtime game remains static/local assets. Hostinger managed build: repo root `.`, `npm run build`, `dist`, supported Node22 version; optional `server.js`/`npm start`. Port from environment for Node. Read existing HOSTINGER-GITHUB guide; no credential values in repo/docs. Local Chrome harness must stay isolated. Add staging only if account supports it and user approves; do not invent a staging URL.

## Artifact provenance

Required fields: package version, source commit, dirty-tree status (RC must resolve), build command/toolchain, checksum, test report paths, deployment target/ID, approver. Rebuilding same filename can overwrite previous ZIP, so archive approved artifacts under immutable commit/version naming at release time. Retain known-good prior artifact. Build identification UI is proposed; until implemented record server/deployment evidence, not a fictional visible version badge.

## Save and rollback policy

Saves tied to browser origin, not GitHub user. v2→v3 additive migration retains v2; v3 corruption/future/incomplete envelope must not auto-overwrite. Backup export is existing; import UI is proposed until verified. Data copied manually for debugging remains private.

Rollback assets does not downgrade save schema. Older app may read older v2 snapshot and omit progression earned in v3. Preserve/export v3 and v2 before rollback; tell player the consequence. Never clear localStorage or forcibly normalize unknown data merely to get a green screen. A rollback triggered by save corruption requires incident preservation before further writes.

## Remote smoke checklist

- [ ] Target URL/environment explicitly approved.
- [ ] Served build matches intended source/artifact.
- [ ] Index and assets load, correct MIME; no mixed content/remote CDN dependency unexpectedly added.
- [ ] Hashed assets cache correctly; HTML update does not stick to old bundles.
- [ ] Production has no development QA API.
- [ ] Fresh player can prepare, depart, fight naturally, see death and locked choices.
- [ ] Existing representative save reloads/migrates safely on same origin.
- [ ] Gear preview/cancel/confirm, talent selection, quest claim and next wave function.
- [ ] Mobile touch and reduced motion smoke checked.
- [ ] Rollback handle recorded; result communicated with known limits.

## Incident response

| Stage | Action |
|---|---|
| Detect | Record user report/device/build/repro, no automatic private scraping |
| Contain | Stop release promotion; if active data-loss issue, agree mitigation/rollback promptly |
| Preserve | Keep logs/artifact IDs and consented minimal fixtures; avoid sensitive copies |
| Diagnose | Reproduce isolated, distinguish client save from deployment/cache |
| Fix | Small patch and regression, no unrelated refactor |
| Verify | Affected gates + save safety + remote read-back |
| Close | User-facing explanation, known recovery limits and prevention action |

No 24/7 response SLA promised; owner and availability must be decided in M0/M7. Error monitoring service or analytics is not installed by this plan. Start manual bug reports; any telemetry later needs payload/privacy/retention/cost approval.

## Maintenance cadence proposal

After release: short agreed observation window, manual support check, scheduled dependency/security review at an agreed cadence, targeted browser compatibility check after updates. Before each patch run risk-based regressions. Schema, cache/service-worker, input or combat changes require stronger gates. Keep changelog and known issues current. End-of-support/maintenance ownership must be explicit rather than implied indefinitely.

## Cost, privacy and legal checklist

Hostinger plan, domain, bandwidth/storage headroom and renewal owners: TBD verified by user, not inferred. No extra paid services presumed. Record fonts/art/audio/package license and notices. No platform tokens bundled into dist. Validate third-party packages before adding. Diagnostic export should allowlist technical data, not raw localStorage. If public analytics/accounts become scope, add separate privacy/security design and applicable legal review; this document is not legal advice or certification.
