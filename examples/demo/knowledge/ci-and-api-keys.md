## Running in CI

You can trigger a recce run from any pipeline. Use the recce CLI step with a project-scoped API key stored as a CI secret, or drop in the GitHub Actions step. Kick off a specific test (or a group) on every push, on a schedule, or as a required check before deploy.

The CI step exits non-zero on any verdict other than Passed — Failed, Blocked, and Aborted all fail the build. That way a broken checkout flow or a blocked environment stops the pipeline instead of shipping silently, and the receipts land right in your build logs so you can see exactly why.

## API keys

API keys authenticate CI and the recce API. Create one on the API keys page, give it a clear name (like "CI · GitHub Actions"), and copy it once at creation — the full key is shown only that one time. Each key is project-scoped, so a key can only trigger and read the tests in its project.

Use a separate key per pipeline or integration so you can rotate or revoke one without touching the others. The keys list shows each key's masked value, when it was created, and when it was last used.

## Auth & secrets

Store recce API keys as secrets in your CI provider — never commit them to the repo or paste them into config that lands in version control. recce never writes secrets into reports or run logs, and masks key values everywhere in the dashboard, so evidence you share with your team won't leak credentials.

If a key is exposed, revoke it from the API keys page and create a fresh one. Because keys are project-scoped, the blast radius of a leaked key is limited to that one project.
