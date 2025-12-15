/**
 * Signal reading utilities for Datastar
 * @module signals
 */

'use strict';

const { Headers } = require('./constants');

/**
 * @typedef {Object} ReadSignalsResult
 * @property {boolean} success - Whether signals were read successfully
 * @property {Object} [signals] - The parsed signals
 * @property {string} [error] - Error message if failed
 */

/**
 * Read Datastar signals from a Fastify request
 * 
 * For GET requests, signals are read from the 'datastar' query parameter.
 * For other methods, signals are read from the JSON request body.
 * 
 * @param {import('fastify').FastifyRequest} request - The Fastify request object
 * @returns {Promise<ReadSignalsResult>} Result with signals or error
 */
async function readSignals(request) {
  try {
    if (request.method === 'GET') {
      // For GET requests, signals are in the query parameter
      const query = request.query || {};
      const querySignals = query[Headers.SignalsQueryParam];

      if (!querySignals) {
        return {
          success: true,
          signals: {},
        };
      }

      // Query param should be URL-encoded JSON
      const decoded = typeof querySignals === 'string'
        ? decodeURIComponent(querySignals)
        : JSON.stringify(querySignals);

      const signals = JSON.parse(decoded);

      return {
        success: true,
        signals,
      };
    } else {
      // For POST/PUT/PATCH/DELETE, signals are in the body
      const body = request.body;

      if (!body) {
        return {
          success: true,
          signals: {},
        };
      }

      // Body could be a string or already parsed object
      const signals = typeof body === 'string' ? JSON.parse(body) : body;

      return {
        success: true,
        signals,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error reading signals';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Check if a request is a Datastar request
 * 
 * Datastar requests include a 'datastar-request: true' header
 * 
 * @param {import('fastify').FastifyRequest} request - The Fastify request object
 * @returns {boolean} true if this is a Datastar request
 */
function isDatastarRequest(request) {
  const header = request.headers[Headers.DatastarRequest];
  return header === 'true';
}

module.exports = {
  readSignals,
  isDatastarRequest,
};
