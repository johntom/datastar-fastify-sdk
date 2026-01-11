/**
 * Datastar SDK for Fastify
 * 
 * Build reactive web applications with hypermedia-driven server-sent events.
 * 
 * @module @starfederation/datastar-fastify
 * 
 * @example
 * const Fastify = require('fastify');
 * //const { datastar } = require('@starfederation/datastar-fastify');
 * const { datastar } = require('@johntom/datastar-fastify');
 * 
 * const app = Fastify();
 * app.register(datastar);
 * 
 * app.get('/api/counter', async (request, reply) => {
 *   const { signals } = await request.readSignals();
 *   
 *   await reply.datastar((sse) => {
 *     sse.patchElements(`<div id="count">${signals.count || 0}</div>`);
 *     sse.patchSignals({ count: (signals.count || 0) + 1 });
 *   });
 * });
 * 
 * app.listen({ port: 3000 });
 */

'use strict';

// Plugin
const { datastar, datastarPlugin } = require('./plugin');

// Core classes
const { ServerSentEventGenerator } = require('./sse');

// Utilities
const { readSignals, isDatastarRequest } = require('./signals');

// Constants
const {
  DATASTAR_VERSION,
  DATASTAR_KEY,
  EventType,
  PatchMode,
  DataLine,
  Defaults,
  Headers,
} = require('./constants');

// HTML Attribute Helpers
const {
  GetSSE,
  PostSSE,
  PutSSE,
  PatchSSE,
  DeleteSSE,
  signalsAttr,
  escapeHtml,
  safeJSON,
} = require('./helpers');

module.exports = {
  // Plugin (default export style)
  datastar,
  datastarPlugin,
  
  // Core classes
  ServerSentEventGenerator,
  
  // Utilities
  readSignals,
  isDatastarRequest,
  
  // Constants
  DATASTAR_VERSION,
  DATASTAR_KEY,
  EventType,
  PatchMode,
  DataLine,
  Defaults,
  Headers,
  
  // HTML Attribute Helpers
  GetSSE,
  PostSSE,
  PutSSE,
  PatchSSE,
  DeleteSSE,
  signalsAttr,
  escapeHtml,
  safeJSON,
};
