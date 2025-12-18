/**
 * Datastar Test Server for Node.js/Fastify
 *
 * This is a test server that mirrors the functionality of the Go test server
 * at datastar-go/cmd/testserver/main.go
 *
 * It processes test events and sends appropriate Datastar SSE responses
 * for testing the SDK.
 *
 * Run with: node testserver.js
 * Or with custom port: TEST_PORT=8080 node testserver.js
 */

'use strict';

const Fastify = require('fastify');
const { datastar } = require('./lib/index');

const app = Fastify({ logger: true });

// Register the Datastar plugin
app.register(datastar);

/**
 * Event represents a test event from the SDK test suite
 * @typedef {Object} Event
 * @property {string} type - Event type (patchElements, patchSignals, executeScript)
 *
 * PatchElements fields
 * @property {string} [elements] - HTML elements to patch
 * @property {string} [selector] - CSS selector for target
 * @property {string} [mode] - Patch mode (outer, inner, prepend, append, before, after, replace, remove)
 * @property {boolean} [useViewTransition] - Whether to use View Transition API
 *
 * PatchSignals fields
 * @property {Object} [signals] - Signals object
 * @property {string} [signals-raw] - Raw signals string (for multiline)
 * @property {boolean} [onlyIfMissing] - Only patch if signal doesn't exist
 *
 * ExecuteScript fields
 * @property {string} [script] - JavaScript code to execute
 * @property {boolean} [autoRemove] - Auto-remove script after execution
 * @property {Object.<string, string>} [attributes] - HTML attributes for script tag
 *
 * Common fields
 * @property {string} [eventId] - Custom event ID
 * @property {number} [retryDuration] - Retry duration in milliseconds
 */

/**
 * TestRequest represents the incoming test request
 * @typedef {Object} TestRequest
 * @property {Event[]} events - Array of events to process
 */

/**
 * Handle patchElements event
 * @param {import('./lib/sse').ServerSentEventGenerator} sse
 * @param {Event} event
 */
function handlePatchElements(sse, event) {
  const options = {};

  if (event.selector) {
    options.selector = event.selector;
  }

  if (event.mode) {
    options.mode = event.mode;
  }

  if (event.useViewTransition !== undefined) {
    options.useViewTransition = event.useViewTransition;
  }

  if (event.eventId) {
    options.eventId = event.eventId;
  }

  if (event.retryDuration !== undefined && event.retryDuration > 0) {
    options.retryDuration = event.retryDuration;
  }

  sse.patchElements(event.elements || '', options);
}

/**
 * Handle patchSignals event
 * @param {import('./lib/sse').ServerSentEventGenerator} sse
 * @param {Event} event
 */
function handlePatchSignals(sse, event) {
  const options = {};

  if (event.onlyIfMissing !== undefined) {
    options.onlyIfMissing = event.onlyIfMissing;
  }

  if (event.eventId) {
    options.eventId = event.eventId;
  }

  if (event.retryDuration !== undefined && event.retryDuration > 0) {
    options.retryDuration = event.retryDuration;
  }

  // Handle signals-raw for multiline signals
  let signalsData;
  if (event['signals-raw']) {
    // For multiline signals, use the raw string
    signalsData = event['signals-raw'];
  } else if (event.signals) {
    // Ensure compact JSON output (no pretty printing)
    signalsData = typeof event.signals === 'string'
      ? event.signals
      : JSON.stringify(event.signals);
  } else {
    signalsData = {};
  }

  sse.patchSignals(signalsData, options);
}

/**
 * Handle executeScript event
 * @param {import('./lib/sse').ServerSentEventGenerator} sse
 * @param {Event} event
 */
function handleExecuteScript(sse, event) {
  const options = {};

  if (event.autoRemove !== undefined) {
    options.autoRemove = event.autoRemove;
  }

  if (event.attributes) {
    options.attributes = event.attributes;
  }

  if (event.eventId) {
    options.eventId = event.eventId;
  }

  if (event.retryDuration !== undefined && event.retryDuration > 0) {
    options.retryDuration = event.retryDuration;
  }

  // Handle multiline scripts by converting escaped newlines to actual newlines
  const script = event.script ? event.script.replace(/\\n/g, '\n') : '';

  sse.executeScript(script, options);
}

/**
 * Main test handler endpoint
 */
app.post('/test', async (request, reply) => {
  try {
    // Parse the incoming request
    const result = await request.readSignals();

    if (!result.success) {
      return reply.code(400).send({ error: `Failed to read signals: ${result.error}` });
    }

    /** @type {TestRequest} */
    const req = result.signals || {};

    if (!req.events || !Array.isArray(req.events)) {
      return reply.code(400).send({ error: 'Missing or invalid events array' });
    }

    // Create SSE handler
    await reply.datastar((sse) => {
      // Process each event
      for (const event of req.events) {
        // Check if connection is closed before processing each event
        if (sse.isClosed) {
          request.log.warn('SSE connection closed, stopping event processing');
          return;
        }

        switch (event.type) {
          case 'patchElements':
            handlePatchElements(sse, event);
            break;

          case 'patchSignals':
            handlePatchSignals(sse, event);
            break;

          case 'executeScript':
            handleExecuteScript(sse, event);
            break;

          default:
            request.log.warn(`Unknown event type: ${event.type}`);
        }
      }
    });
  } catch (error) {
    request.log.error(error);
    return reply.code(500).send({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Start the server
const port = process.env.TEST_PORT || 7331;
const host = '127.0.0.1';

app.listen({ port, host }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Test server starting on http://${host}:${port}`);
});
