# BluffCheck

Paste a JavaScript function that claims to do something. BluffCheck runs it in a sandbox, tests it against a reference, shrinks any failure to a minimal counterexample, probes how its running time grows, and gives a trust score with exportable Jest tests.

## How it works

- **Sandbox:** untrusted code runs in QuickJS compiled to WebAssembly (`quickjs-emscripten`) with a 48 MB memory cap, 256 KB stack cap and a 400 ms deadline per call, inside a worker thread per audit. At most 2 audits run at once, with a queue limit and a 90 s job timeout.
- **Checks:** differential fuzzing against a reference implementation, property checks, a shrinker that reduces failures to the smallest input, and a log-log slope probe over input sizes 250 to 8000 to estimate complexity.
- **Score:** a critical finding caps the trust score at 55. A missing oracle caps it at 85.
- **Output:** live progress over Server-Sent Events, Jest test export, Markdown report, audit history.
- **Style:** brutalist UI. Seven seeded examples (binary search, median, dedupe, merge intervals, palindrome, floor log2, Kadane).

## Honest limits

Fuzzing finds bugs but cannot prove correctness. The complexity probe is an estimate and is noisy on tiny inputs. Only the listed input shapes are supported.

## Resume bullets (edit to taste)

- Built BluffCheck, a full-stack code auditing service (Node, Express, React, SQLite) that executes untrusted JavaScript in a QuickJS WebAssembly sandbox with memory, stack and time limits inside worker threads.
- Implemented differential fuzzing, input shrinking and empirical complexity estimation, with Jest test export and SSE progress streaming; 15 automated tests.

## Interview talking points

- Why a WASM sandbox instead of `vm` (the Node docs say `vm` is not a security boundary) and how interrupts stop `while(true){}`.
- How shrinking works and why it makes a bug report actionable.
- Why the score is capped without an oracle: no reference means less evidence.

## Run locally

Requires Node 22.13 or newer (it uses the built-in `node:sqlite`).

```bash
npm install
npm run dev      # API on :3000, Vite on :5173 (open the Vite URL)
npm test         # node --test
npm run build && npm start   # production, serves everything on :3000
```

## Deploy

Any host that runs a Node web service or a Dockerfile works (Render, Railway, Fly.io, a VPS).

- Build command: `npm install && npm run build`. Start command: `npm start`. Or use the included `Dockerfile`.
- Attach a **persistent disk** and point `DATA_DIR` at it (the Dockerfile uses `/data`). Without it, data is lost on each deploy.
- Set `TRUST_PROXY=1` behind a platform proxy so the rate limiter sees real client IPs.
- Put your contact email in `web/src/site.config.js` so the privacy and terms pages show it.

## Privacy model

No accounts and no cookies. Each browser gets a random ID stored in localStorage and sent as a header. Data is scoped to that ID and deleted automatically after the retention period shown in the app. Requests are rate limited and a strict Content-Security-Policy is set.
