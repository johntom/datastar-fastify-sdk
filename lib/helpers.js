/**
 * Helper functions for generating Datastar HTML attributes
 * 
 * These functions generate the `data-on-*` attribute values for
 * triggering backend SSE requests. They match the Go SDK API.
 * 
 * @module helpers
 * 
 * @example
 * const { GetSSE, PostSSE } = require('@starfederation/datastar-fastify');
 * 
 * // In your template:
 * // <button data-on-click="${GetSSE('/api/data')}">Load</button>
 * // <button data-on-click="${PostSSE('/api/submit')}">Submit</button>
 */

'use strict';

/**
 * Internal helper to format SSE action strings
 * @param {string} action - The action type
 * @param {string} urlFormat - URL format string
 * @param {Array} args - Arguments for format substitution
 * @returns {string}
 * @private
 */
function formatSSE(action, urlFormat, args) {
  let url = urlFormat;

  if (args.length > 0) {
    // Simple sprintf-style replacement for %s and %v
    let argIndex = 0;
    url = urlFormat.replace(/%[sv]/g, () => {
      const arg = args[argIndex++];
      return arg !== undefined ? String(arg) : '';
    });
  }

  return `${action}('${url}')`;
}

/**
 * Generate a Datastar GET action attribute value
 * @param {string} url - The URL to fetch
 * @param {...*} args - Optional format arguments (sprintf-style %s substitution)
 * @returns {string}
 * 
 * @example
 * GetSSE('/api/data')
 * // Returns: "@get('/api/data')"
 * 
 * GetSSE('/api/users/%s', userId)
 * // Returns: "@get('/api/users/123')"
 */
function GetSSE(url, ...args) {
  return formatSSE('@get', url, args);
}

/**
 * Generate a Datastar POST action attribute value
 * @param {string} url - The URL to post to
 * @param {...*} args - Optional format arguments
 * @returns {string}
 */
function PostSSE(url, ...args) {
  return formatSSE('@post', url, args);
}

/**
 * Generate a Datastar PUT action attribute value
 * @param {string} url - The URL to put to
 * @param {...*} args - Optional format arguments
 * @returns {string}
 */
function PutSSE(url, ...args) {
  return formatSSE('@put', url, args);
}

/**
 * Generate a Datastar PATCH action attribute value
 * @param {string} url - The URL to patch
 * @param {...*} args - Optional format arguments
 * @returns {string}
 */
function PatchSSE(url, ...args) {
  return formatSSE('@patch', url, args);
}

/**
 * Generate a Datastar DELETE action attribute value
 * @param {string} url - The URL to delete
 * @param {...*} args - Optional format arguments
 * @returns {string}
 */
function DeleteSSE(url, ...args) {
  return formatSSE('@delete', url, args);
}

/**
 * Helper to create a data-signals attribute value
 * @param {Object} signals - Object containing signal key-value pairs
 * @returns {string}
 * 
 * @example
 * signalsAttr({ count: 0, name: '' })
 * // Returns: '{"count":0,"name":""}'
 */
function signalsAttr(signals) {
  return JSON.stringify(signals);
}

/**
 * Helper to escape HTML entities
 * @param {string} str - String to escape
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Helper to create safe JSON for embedding in HTML attributes
 * @param {Object} obj - Object to serialize
 * @returns {string}
 */
function safeJSON(obj) {
  return escapeHtml(JSON.stringify(obj));
}

module.exports = {
  GetSSE,
  PostSSE,
  PutSSE,
  PatchSSE,
  DeleteSSE,
  signalsAttr,
  escapeHtml,
  safeJSON,
};
