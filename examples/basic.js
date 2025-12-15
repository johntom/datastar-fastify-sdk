/**
 * Basic Datastar + Fastify Example
 * 
 * This example demonstrates the core features of the Datastar Fastify SDK:
 * - Reading signals from requests
 * - Patching elements into the DOM
 * - Patching signals
 * - Executing scripts
 * - Handling long-lived SSE connections
 * 
 * Run with: node examples/basic.js
 */

'use strict';

const Fastify = require('fastify');
const { datastar, GetSSE, PostSSE, PatchMode } = require('../lib/index');

const app = Fastify({ logger: true });

// Register the Datastar plugin
app.register(datastar);

// Store for demo purposes
let store = {
  count: 0,
  message: 'Hello from Datastar!',
};

// Serve the HTML page
app.get('/', async (request, reply) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Datastar + Fastify Demo</title>
  <script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.0-RC.6/bundles/datastar.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; padding: 0 1rem; }
    button { padding: 0.5rem 1rem; margin: 0.25rem; cursor: pointer; }
    #output { padding: 1rem; background: #f0f0f0; border-radius: 4px; margin: 1rem 0; }
    section { margin: 2rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; }
    .indicator { display: inline-block; width: 10px; height: 10px; background: #ccc; border-radius: 50%; }
    .indicator.loading { background: #4caf50; animation: pulse 1s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  </style>
</head>
<body>
  <h1>Datastar + Fastify Demo</h1>
  
  <div data-signals='{"count": ${store.count}, "message": "${store.message}", "fetching": false}'>
    
    <!-- Counter Example -->
    <section>
      <h2>Counter</h2>
      <div id="counter-output">
        <p>Count: <span data-text="\$count">${store.count}</span></p>
      </div>
      <button data-on:click="${GetSSE('/api/increment')}" data-indicator:fetching>
        <span class="indicator" data-class:loading="\$fetching"></span>
        Increment
      </button>
      <button data-on:click="${GetSSE('/api/decrement')}">Decrement</button>
      <button data-on:click="${PostSSE('/api/reset')}">Reset</button>
    </section>

    <!-- Message Example -->
    <section>
      <h2>Message</h2>
      <div id="message-output">
        <p data-text="\$message">${store.message}</p>
      </div>
      <input type="text" data-bind:message placeholder="Enter message..." />
      <button data-on:click="${PostSSE('/api/update-message')}">Update Message</button>
    </section>

    <!-- Script Execution Example -->
    <section>
      <h2>Script Execution</h2>
      <button data-on:click="${GetSSE('/api/alert')}">Show Alert</button>
      <button data-on:click="${GetSSE('/api/console-log')}">Console Log</button>
    </section>

    <!-- Long-lived Connection Example -->
    <section>
      <h2>Real-time Updates</h2>
      <div id="time-output">
        <p>Server time: <span id="server-time">--</span></p>
      </div>
      <button data-on:click="${GetSSE('/api/time-stream')}">Start Time Stream (5s)</button>
    </section>

  </div>
</body>
</html>
`;

  reply.type('text/html').send(html);
});

// Increment counter
app.get('/api/increment', async (request, reply) => {
  const result = await request.readSignals();
  const currentCount = result.signals?.count ?? store.count;
  store.count = currentCount + 1;

  await reply.datastar((sse) => {
    sse.patchSignals({ count: store.count });
  });
});

// Decrement counter
app.get('/api/decrement', async (request, reply) => {
  const result = await request.readSignals();
  const currentCount = result.signals?.count ?? store.count;
  store.count = Math.max(0, currentCount - 1);

  await reply.datastar((sse) => {
    sse.patchSignals({ count: store.count });
  });
});

// Reset counter
app.post('/api/reset', async (request, reply) => {
  store.count = 0;
  store.message = 'Hello from Datastar!';

  await reply.datastar((sse) => {
    sse.patchSignals({ count: store.count, message: store.message });
  });
});

// Update message
app.post('/api/update-message', async (request, reply) => {
  const result = await request.readSignals();

  if (result.signals?.message) {
    store.message = result.signals.message;
  }

  await reply.datastar((sse) => {
    sse.patchSignals({ message: store.message });
    // Also patch an element directly
    sse.patchElements(
      `<p id="status">Message updated at ${new Date().toLocaleTimeString()}</p>`,
      { selector: '#message-output', mode: PatchMode.Append }
    );
  });
});

// Show alert via script execution
app.get('/api/alert', async (request, reply) => {
  await reply.datastar((sse) => {
    sse.executeScript('alert("Hello from the server!")');
  });
});

// Log to console via script execution
app.get('/api/console-log', async (request, reply) => {
  await reply.datastar((sse) => {
    sse.consoleLog(`Server says hello at ${new Date().toISOString()}`);
    sse.patchElements(
      '<p id="console-status">Check your browser console!</p>',
      { selector: 'section:last-child', mode: PatchMode.Append }
    );
  });
});

// Long-lived time stream
app.get('/api/time-stream', async (request, reply) => {
  await reply.datastar(async (sse) => {
    // Stream time updates for 5 seconds
    for (let i = 0; i < 5; i++) {
      const time = new Date().toLocaleTimeString();
      sse.patchElements(`<span id="server-time">${time}</span>`);
      await sleep(1000);
    }
    sse.patchElements('<span id="server-time">Stream ended</span>');
  });
});

// Utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the server
app.listen({ port: 3000 }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log('Server running at http://localhost:3000');
});
