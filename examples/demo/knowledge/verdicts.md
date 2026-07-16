## Passed

Passed means recce reached the goal you described and can prove it. The verdict comes with a real quote from the page — the confirmation message, the order total, the heading that only appears on success. If recce can't find on-page proof, it won't mark a test Passed.

A green run is a run you can trust, because there are receipts behind it.

## Failed

Failed means recce drove the flow all the way through and the outcome was genuinely wrong. The button was missing, the total didn't add up, the confirmation never showed, the wrong page loaded. This is a real product bug, not an infrastructure hiccup.

Failed always includes what recce did and the evidence for the call, so you can reproduce it fast.

## Blocked

Blocked means something outside the test got in recce's way before it could judge the outcome — a down environment, an expired paywall, a CAPTCHA, a rate limit, a login wall it wasn't given access to. The flow itself might be fine; recce just couldn't get far enough to say.

Blocked is kept separate from Failed on purpose. An infra hiccup should never get logged as a product bug, and a CAPTCHA on your staging box shouldn't page your on-call.

## Aborted

Aborted means the run was stopped early — you cancelled it, or it hit the run timeout before finishing. No verdict was reached because recce never got to the end of the flow.

Re-run an Aborted test when conditions are back to normal. If tests abort often, they may be too long or the target may be unusually slow.
