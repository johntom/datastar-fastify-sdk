# TODO

## Compression support — closed (Option A shipped)

**Status:** Closed. Option A landed in commit `8fbacdd` ("Document
@fastify/compress recipe for SSE compression in README") — see the
"Production: enabling SSE compression" section in `README.md`.

### Option B — deferred (not on the roadmap)

Building compression into the SDK directly (gzip/deflate/brotli/zstd
with per-event flush control, mirroring the Go SDK's `sse-compression.go`)
remains a future possibility, but is deferred unless users report that
`@fastify/compress` is insufficient — typically because they need
per-event flushing for latency-sensitive feeds. Revisit only on demand.
