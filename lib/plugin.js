/**
 * Fastify plugin for Datastar
 * 
 * This plugin adds Datastar-specific decorators to Fastify's request and reply objects.
 * 
 * @module plugin
 */

'use strict';

const fp = require('fastify-plugin');
const { ServerSentEventGenerator } = require('./sse');
const { readSignals, isDatastarRequest } = require('./signals');
const { Headers, Defaults } = require('./constants');

/**
 * @typedef {Object} DatastarPluginOptions
 * @property {number} [defaultRetryDuration=1000] - Default SSE retry duration in ms
 */

/**
 * @typedef {Object} StreamOptions
 * @property {Function} [onError] - Error callback
 * @property {Function} [onAbort] - Connection abort callback
 * @property {boolean} [keepAlive=false] - Keep stream open after callback
 */

/**
 * Initialize an SSE stream on the Fastify reply
 * @param {import('fastify').FastifyReply} reply - Fastify reply
 * @param {number} retryDuration - Retry duration in ms
 * @returns {ServerSentEventGenerator}
 * @private
 */
function initializeSSEStream(reply, retryDuration) {
  // Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': Headers.ContentTypeSSE,
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial retry duration
  reply.raw.write(`retry: ${retryDuration}\n\n`);

  return new ServerSentEventGenerator(reply);
}

/**
 * Fastify plugin for Datastar
 * 
 * Adds the following decorators:
 * 
 * Request decorators:
 * - `request.readSignals()` - Read Datastar signals from the request
 * - `request.isDatastarRequest()` - Check if this is a Datastar request
 * 
 * Reply decorators:
 * - `reply.datastar(callback, options)` - Start an SSE stream with auto-close
 * - `reply.datastarStream(options)` - Start a persistent SSE stream
 * 
 * @param {import('fastify').FastifyInstance} fastify - Fastify instance
 * @param {DatastarPluginOptions} options - Plugin options
 * @param {Function} done - Callback
 */
function datastarPlugin(fastify, options, done) {
  const defaultRetryDuration = options.defaultRetryDuration || Defaults.SSERetryDuration;

  // Decorate request with signal reading methods
  fastify.decorateRequest('readSignals', null);
  fastify.decorateRequest('isDatastarRequest', null);

  // Decorate reply with SSE methods
  fastify.decorateReply('datastar', null);
  fastify.decorateReply('datastarStream', null);

  // Add request decorators via hook
  fastify.addHook('onRequest', async (request, reply) => {
    /**
     * Read Datastar signals from the request
     * @returns {Promise<import('./signals').ReadSignalsResult>}
     */
    request.readSignals = function () {
      return readSignals(this);
    };

    /**
     * Check if this is a Datastar request
     * @returns {boolean}
     */
    request.isDatastarRequest = function () {
      return isDatastarRequest(this);
    };
  });

  // Add reply decorators via hook
  fastify.addHook('onRequest', async (request, reply) => {
    /**
     * Start an SSE stream for Datastar responses
     * The stream is automatically closed after the callback completes
     * 
     * @param {Function} callback - Callback that receives the SSE generator
     * @param {StreamOptions} [streamOptions={}] - Stream options
     * @returns {Promise<void>}
     */
    reply.datastar = async function (callback, streamOptions = {}) {
      const sse = initializeSSEStream(this, defaultRetryDuration);

      try {
        await callback(sse);
      } catch (error) {
        if (streamOptions.onError && error instanceof Error) {
          streamOptions.onError(error);
        }
      } finally {
        if (!streamOptions.keepAlive) {
          sse.close();
        }
      }
    };

    /**
     * Start a persistent SSE stream
     * The stream must be manually closed by calling sse.close()
     * 
     * @param {StreamOptions} [streamOptions={}] - Stream options
     * @returns {ServerSentEventGenerator}
     */
    reply.datastarStream = function (streamOptions = {}) {
      const sse = initializeSSEStream(this, defaultRetryDuration);

      // Handle connection abort
      this.raw.on('close', () => {
        if (streamOptions.onAbort) {
          streamOptions.onAbort();
        }
      });

      return sse;
    };
  });

  done();
}

// Export the plugin wrapped with fastify-plugin for proper encapsulation
const datastar = fp(datastarPlugin, {
  fastify: '5.x',
  name: '@starfederation/datastar-fastify',
});

module.exports = {
  datastar,
  datastarPlugin,
};
