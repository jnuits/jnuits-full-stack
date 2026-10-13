# Vercel/GitHub deployment status repair — 2026-10-13

Production main `59152c0ae4afcf830b45a6b8828db1382d1bcdf9` was live, while GitHub's Vercel context still read Pending / Waiting for checks to complete. This was a provider status handoff failure rather than an Actions runner that had not started.

Read-only inspection of the JnUITS project `prj_obl0FMLeQAXoSV0P4cPEXsSDLRBH` confirmed the main Git linkage and automatic production alias assignment. The modern deployment-check API showed all three configured production gates (Required CI, native Lint and native Typecheck) succeeded on old deployment `dpl_2F5TYD23em7oa1w7zSKakK31Gq9b`; its GitHub history lacked a terminal deployment event after manual promotion.

One supported same-commit redeployment through the JnUITS Vercel connection created `dpl_7wP44mmzZZdKbkA4ZNUkd8PxEoo6`, with `withLatestCommit=false`. It became READY, all three gates succeeded and production aliases were assigned automatically. GitHub's genuine Vercel context changed to SUCCESS for that deployment. Its real deployment_status event automatically started [Production Browser Smoke 38363439702](https://github.com/jnuits/jnuits-full-stack/actions/runs/38363439702), which passed 57 checks across Chromium, Firefox and WebKit with the exact expected SHA.

No Git/source/status was forged; no README retry commit, forced promotion, disabled gate, removed protection, Git disconnection or billing change was used. The existing deployment_status workflow remains appropriate. Subsequent releases must verify their own provider context, deployment SHA and automatic smoke result; one successful recovery does not prove future events cannot fail.

Use the modern project `/v2/projects/{projectId}/checks` and deployment `/v2/deployments/{deploymentId}/check-runs` endpoints when diagnosing current deployment checks. Some connector snapshots omit these fields and legacy check endpoints can return an empty list. Raw responses may contain private environment/owner information: keep them outside published artifacts and never print or commit credentials.
