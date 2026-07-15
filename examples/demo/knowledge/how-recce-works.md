## What recce does

recce is grounded AI QA that drives your real website like a person would — clicking, typing, waiting for pages to load — and returns an honest verdict for each test. There are no recorded selectors and no brittle scripts to maintain. You point recce at a URL, describe what should happen, and it figures out the flow against the live page every time it runs.

Because recce reads the real page instead of a hardcoded DOM path, a redesign, a moved button, or a renamed field usually doesn't break your tests. If the goal is still reachable, recce still reaches it.

## Plain-English tests

You write tests the way you'd explain them to a teammate. For example: "Log in, add a widget to the cart, and check out. Make sure the order total shows and there's a Place Order button." recce turns that into actions on your real site — no code, no CSS selectors, no waiting logic.

Keep each test focused on one flow and one outcome. That keeps verdicts sharp: when a test fails, you know exactly which flow broke.

## The receipts (evidence)

Every recce verdict comes with the receipts. When a test passes, recce quotes the real on-page text that proves the goal was met — the confirmation heading, the order total, the success message. When a test fails, it shows what it did, where it got stuck, and the quote (or the missing element) that made the call.

The point is that you never have to take recce's word for it. The proof is a real quote from your real page.

## No flaky retries

recce does not paper over instability with silent retries. There is no "flaky" verdict — that's deliberate. A test either reached its goal (Passed), genuinely produced the wrong outcome (Failed), was stopped by something outside the test (Blocked), or was ended early (Aborted).

If your site is intermittently broken, recce reports it as broken instead of quietly retrying until it goes green. Honest signal beats a green dashboard that lies.
