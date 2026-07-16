## What counts as a run

A run is one full execution of one test, from start to finish, no matter how many steps or pages it touches. A ten-step checkout flow across four pages is a single run.

Each scheduled execution is its own run, and a manual re-run counts too. So a test on an every-15-minutes schedule uses about 96 runs a day. Retries are counted as separate runs as well — recce never hides usage behind silent retries.

## Your plan

Acme is on the Team plan, which includes 2,000 test runs per month. Your usage resets on the first of each month. You can see how many runs you've used and how many are left on the Usage & billing page.

Unlimited tests can be defined on any plan — you're only ever metered on runs, the actual executions against your site.

## Usage limits

When you approach your monthly run limit, recce warns you on the dashboard and on Usage & billing so nothing gets silently dropped. If you expect a busy month — a big launch, a burst of scheduled monitoring — upgrade the plan or dial back cadence on lower-priority tests.

To lower run volume without losing coverage, widen the interval on stable flows (say, hourly instead of every 15 minutes) and keep the tight cadence for your critical checkout and signup paths.
