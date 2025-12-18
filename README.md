<p align="center"><img width="150" height="150" src="https://data-star.dev/static/images/rocket-512x512.png"></p>

# Datastar Fastify SDK 

un-official [Datastar](https://data-star.dev) SDK for [Fastify](https://fastify.dev) - Build reactive web applications with Server-Sent Events.




This package provides a Nodejs/Fastify SDK for working with Datastar. 
Version 1.0.4

## Requirements

- **Node.js 20+**  (required by Fastify 5)
- Tested with **Node.js 24+**  

- **Fastify 5.x**
- **Datastar 1.0.0-RC.6** (client-side)

## Installation

```bash
npm install @johntom/datastar-fastify-sdk
```

## Quick Start

```javascript
const Fastify = require('fastify');
const { datastar, GetSSE, PostSSE } = require('@johntom/datastar-fastify-sdk');

const app = Fastify({ logger: true });

// Register the Datastar plugin
app.register(datastar);

// Serve HTML with Datastar attributes
app.get('/', async (request, reply) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.0-RC.6/bundles/datastar.js"></script>
    </head>
    <body>
      <div data-signals='{"count": 0}'>
        <p>Count: <span data-text="$count">0</span></p>
        <button data-on:click="${GetSSE('/api/increment')}">Increment</button>
      </div>
    </body>
    </html>
  `;
  reply.type('text/html').send(html);
});

// Handle Datastar requests with SSE responses
app.get('/api/increment', async (request, reply) => {
  const { signals } = await request.readSignals();
  const newCount = (signals?.count || 0) + 1;

  await reply.datastar((sse) => {
    sse.patchSignals({ count: newCount });
  });
});

app.listen({ port: 3000 });
```

## API Reference

### Plugin Registration

```javascript
app.register(datastar, {
  defaultRetryDuration: 1000 // Default SSE retry duration in ms
});
```

### Request Decorators

#### `request.readSignals()`

Reads Datastar signals from the request (query params for GET, body for POST/PUT/PATCH/DELETE).

```javascript
const { success, signals, error } = await request.readSignals();
if (success) {
  console.log(signals.count);
}
```

#### `request.isDatastarRequest()`

Returns `true` if the request includes the `datastar-request: true` header.

### Reply Decorators

#### `reply.datastar(callback, options)`

Starts an SSE stream that auto-closes after the callback completes.

```javascript
await reply.datastar((sse) => {
  sse.patchSignals({ count: 1 });
  sse.patchElements('<div id="output">Updated!</div>');
});
```

Options:
- `onError(error)` - Error callback
- `onAbort()` - Connection abort callback
- `keepAlive` - Keep stream open after callback (default: `false`)

#### `reply.datastarStream(options)`

Starts a persistent SSE stream that must be manually closed.

```javascript
const sse = reply.datastarStream({
  onAbort: () => console.log('Client disconnected')
});

// Send updates over time
sse.patchSignals({ status: 'processing' });

// Later...
sse.close();
```

### SSE Generator Methods

#### `sse.patchElements(html, options)`

Patches HTML elements into the DOM.

```javascript
sse.patchElements('<div id="content">Hello!</div>');

// With options
sse.patchElements('<li>New item</li>', {
  selector: '#list',
  mode: 'append' // outer, inner, replace, prepend, append, before, after, remove
});
```

#### `sse.patchSignals(signals, options)`

Updates client-side signals.

```javascript
sse.patchSignals({ count: 42, message: 'Hello' });

// Only set if not already present
sse.patchSignals({ defaults: true }, { onlyIfMissing: true });
```

#### `sse.executeScript(script, options)`

Executes JavaScript in the browser.

```javascript
sse.executeScript('alert("Hello!")');
sse.consoleLog('Debug message');
```

#### `sse.removeElements(selector)`

Removes elements from the DOM.

```javascript
sse.removeElements('#temporary-message');
```

#### `sse.redirect(url)` / `sse.redirectf(format, ...args)`

Redirects the browser.

```javascript
sse.redirect('/dashboard');
sse.redirectf('/users/%s', userId);
```

### Helper Functions

Template helpers for generating Datastar attributes:

```javascript
const { GetSSE, PostSSE, PutSSE, PatchSSE, DeleteSSE, escapeHtml } = require('@johntom/datastar-fastify-sdk');

// Generate action attributes
GetSSE('/api/data')      // "@get('/api/data')"
PostSSE('/api/submit')   // "@post('/api/submit')"

// With format strings
GetSSE('/api/users/%s', userId)

// HTML escaping
escapeHtml('<script>alert("xss")</script>')
```

## Examples

Run the included examples:

```bash
# Basic counter and message demo
npm run example

# Full TodoMVC implementation
npm run example:todo
```
```bash

## Tests
The test server emulates the Datastar SDK for GO test suite, providing the same functionality as the Go version but implemented in Node.js with Fastify.

Created Files:

  1. testserver.js - Main test server that mirrors the Go implementation
    - Listens on port 7331 (configurable via TEST_PORT env var)
    - Handles POST requests to /test endpoint
    - Processes three event types:
        - patchElements - Patches HTML elements into the DOM
      - patchSignals - Updates client-side signals
      - executeScript - Executes JavaScript in the browser
    - Supports all options: selector, mode, useViewTransition, onlyIfMissing, autoRemove, attributes, eventId, retryDuration
    - Handles multiline scripts and signals (using signals-raw field)
  2. test-request.js - Test client to verify the server works correctly
    - Tests all three event types
    - Tests multiple events in a single request
    - Successfully validated all functionality

  Key Features:

  - Signal Reading: Uses request.readSignals() from the Fastify SDK
  - SSE Streaming: Uses reply.datastar() to create SSE connections
  - Event Processing: Handles arrays of events sequentially
  - Connection Monitoring: Checks if SSE connection is closed before processing each event
  - Error Handling: Proper error responses with appropriate HTTP status codes
  - Logging: Uses Fastify's built-in logger

  How to Use:

  # Run automated tests (starts server, runs tests, stops server)
  npm test

  # Or manually:
  # 1. Start the test server in one terminal
  npm run testserver

  # 2. In another terminal, run test requests
  node test-request.js

  # Custom port
  TEST_PORT=8080 npm run testserver

  
```
## License

MIT
"# datastar-fastify-sdk" 

