# TODO

## Compression support

Highest-value gap vs the Go SDK (which ships `sse-compression.go` with
gzip, deflate, brotli, zstd and client/server priority negotiation).

Pick one of two approaches:

### Option A — document `@fastify/compress` (lighter lift)

Add a "Production: enabling SSE compression" section to README that shows:

```js
const Fastify = require('fastify');
const compress = require('@fastify/compress');
const { datastar } = require('@johntom/datastar-fastify');

const app = Fastify();
await app.register(compress, {
  encodings: ['br', 'gzip', 'deflate'],
  threshold: 0,
  // SSE streams are chunked; compress must operate on the stream
  customTypes: /^text\/event-stream$/,
});
app.register(datastar);
```

Notes to call out in the docs:
- Why `threshold: 0` and `customTypes` matter for SSE (default threshold
  skips small chunks; default content-type filter excludes
  `text/event-stream`).
- That `@fastify/compress` performs content-negotiation via
  `Accept-Encoding`, matching the Go SDK's behavior.
- Caveat: `@fastify/compress` doesn't expose per-event flush controls,
  so very latency-sensitive event streams may want option B instead.

### Option B — build compression into the SDK (closer parity with Go)

Mirror the Go SDK API surface:
- `datastar({ compression: { strategy: 'serverPriority', codecs: ['br','gzip','deflate','zstd'] } })`
- Per-codec tuning (gzip level, brotli quality/lgwin, deflate dictionary)
- Negotiate via the request's `Accept-Encoding`
- Set `Content-Encoding` on the SSE response and pipe `reply.raw` through
  the chosen `zlib`/`brotli` stream
- Flush after each event so the client receives data in real time
  (the trap most SSE+compression integrations fall into)

This is more code and requires zlib/brotli/zstd stream handling +
back-pressure tests. Defer unless users actually hit bandwidth issues
with option A.

### Suggested order

1. Ship option A in the README first (cheap, unblocks users).
2. Revisit option B only if there's demand for per-codec tuning or
   built-in flush control.
