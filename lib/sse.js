/**
 * ServerSentEventGenerator for Fastify
 * 
 * Handles the generation and sending of SSE events in the Datastar format.
 * This class provides methods to patch elements, signals, execute scripts,
 * and redirect the browser.
 * 
 * @module sse
 */

'use strict';

const { EventType, DataLine, Defaults, PatchMode } = require('./constants');

/**
 * @typedef {Object} PatchElementsOptions
 * @property {string} [selector] - CSS selector for the target element(s)
 * @property {string} [mode='outer'] - The patch mode to use
 * @property {boolean} [useViewTransition=false] - Whether to use View Transition API
 * @property {string} [eventId] - Custom event ID for this SSE event
 * @property {number} [retryDuration] - Retry duration in milliseconds
 */

/**
 * @typedef {Object} PatchSignalsOptions
 * @property {boolean} [onlyIfMissing=false] - Only patch signals that don't exist
 * @property {string} [eventId] - Custom event ID for this SSE event
 * @property {number} [retryDuration] - Retry duration in milliseconds
 */

/**
 * @typedef {Object} ExecuteScriptOptions
 * @property {boolean} [autoRemove=true] - Auto-remove script after execution
 * @property {Object.<string, string>} [attributes] - HTML attributes for script element
 * @property {string} [eventId] - Custom event ID for this SSE event
 * @property {number} [retryDuration] - Retry duration in milliseconds
 */

/**
 * @typedef {Object} RemoveElementsOptions
 * @property {string} [eventId] - Custom event ID for this SSE event
 * @property {number} [retryDuration] - Retry duration in milliseconds
 */

/**
 * ServerSentEventGenerator class for Datastar
 */
class ServerSentEventGenerator {
  /**
   * Create a new ServerSentEventGenerator
   * @param {import('fastify').FastifyReply} reply - Fastify reply object
   */
  constructor(reply) {
    this._reply = reply;
    this._isClosed = false;
  }

  /**
   * Get the underlying Fastify reply object
   * @returns {import('fastify').FastifyReply}
   */
  get reply() {
    return this._reply;
  }

  /**
   * Check if the stream is closed
   * @returns {boolean}
   */
  get isClosed() {
    return this._isClosed;
  }

  /**
   * Send an SSE event to the client
   * @param {string} eventType - The event type
   * @param {string[]} dataLines - Array of data lines
   * @param {Object} [options] - Optional event options
   * @param {string} [options.eventId] - Event ID
   * @param {number} [options.retryDuration] - Retry duration
   * @private
   */
  _send(eventType, dataLines, options = {}) {
    if (this._isClosed) {
      return;
    }

    const lines = [];

    // Add event type
    lines.push(`event: ${eventType}`);

    // Add event ID if provided
    if (options.eventId) {
      lines.push(`id: ${options.eventId}`);
    }

    // Add retry duration if provided
    if (options.retryDuration !== undefined) {
      lines.push(`retry: ${options.retryDuration}`);
    }

    // Add data lines
    for (const line of dataLines) {
      lines.push(`data: ${line}`);
    }

    // SSE events end with double newline
    lines.push('', '');

    const message = lines.join('\n');
    this._reply.raw.write(message);
  }

  /**
   * Send a custom SSE event (matches Go SDK's Send method)
   * Use this for custom event types not covered by patchElements/patchSignals
   *
   * @param {string} eventType - The event type (e.g., 'connected', 'card-locked')
   * @param {string[]} dataLines - Array of data lines to send
   * @param {Object} [options] - Optional event options
   * @param {string} [options.eventId] - Event ID
   * @param {number} [options.retryDuration] - Retry duration in milliseconds
   *
   * @example
   * // Send a custom event with raw data lines
   * sse.send('connected', ['{"clientId": "abc123"}']);
   *
   * @example
   * // Send with options
   * sse.send('notification', ['{"message": "Hello"}'], { eventId: '123' });
   */
  send(eventType, dataLines, options = {}) {
    this._send(eventType, dataLines, options);
  }

  /**
   * Send a custom SSE event with JSON data (convenience method)
   * Automatically serializes the data object to JSON
   *
   * @param {string} eventType - The event type (e.g., 'connected', 'card-locked')
   * @param {Object} data - Data object to send (will be JSON stringified)
   * @param {Object} [options] - Optional event options
   * @param {string} [options.eventId] - Event ID
   * @param {number} [options.retryDuration] - Retry duration in milliseconds
   *
   * @example
   * // Send a custom event with object data
   * sse.sendEvent('connected', { clientId: 'abc123', boardId: 'board1' });
   *
   * @example
   * // Send card lock notification
   * sse.sendEvent('card-locked', { cardId: '123', userName: 'John' });
   */
  sendEvent(eventType, data, options = {}) {
    const dataLine = typeof data === 'string' ? data : JSON.stringify(data);
    this._send(eventType, [dataLine], options);
  }

  /**
   * Patch HTML elements into the DOM
   * @param {string} elements - HTML string of elements to patch
   * @param {PatchElementsOptions} [options={}] - Options for patching
   */
  patchElements(elements, options = {}) {
    const dataLines = [];

    // Add mode if not default
    if (options.mode && options.mode !== Defaults.PatchMode) {
      dataLines.push(`${DataLine.Mode} ${options.mode}`);
    }

    // Add selector if provided
    if (options.selector) {
      dataLines.push(`${DataLine.Selector} ${options.selector}`);
    }

    // Add useViewTransition if true
    if (options.useViewTransition) {
      dataLines.push(`${DataLine.UseViewTransition} true`);
    }

    // Add elements - each line needs the elements prefix
    const elementLines = elements.split('\n');
    for (const line of elementLines) {
      dataLines.push(`${DataLine.Elements} ${line}`);
    }

    this._send(EventType.PatchElements, dataLines, {
      eventId: options.eventId,
      retryDuration: options.retryDuration,
    });
  }

  /**
   * Patch signals into the client's signal store
   * @param {Object|string} signals - Signals object or JSON string
   * @param {PatchSignalsOptions} [options={}] - Options for patching
   */
  patchSignals(signals, options = {}) {
    const dataLines = [];

    // Add onlyIfMissing if true
    if (options.onlyIfMissing) {
      dataLines.push(`${DataLine.OnlyIfMissing} true`);
    }

    // Convert signals to string if object
    const signalsStr = typeof signals === 'string' ? signals : JSON.stringify(signals);
    dataLines.push(`${DataLine.Signals} ${signalsStr}`);

    this._send(EventType.PatchSignals, dataLines, {
      eventId: options.eventId,
      retryDuration: options.retryDuration,
    });
  }

  /**
   * Convenience method to marshal and patch signals (matches Go SDK API)
   * @param {Object} signals - Signals object
   * @param {PatchSignalsOptions} [options={}] - Options for patching
   */
  marshalAndPatchSignals(signals, options = {}) {
    this.patchSignals(signals, options);
  }

  /**
   * Execute JavaScript in the browser by appending a script element to body
   * In Datastar 1.0.0-RC.76, this is done via patchElements with mode=append and selector=body
   * @param {string} script - JavaScript code to execute
   * @param {ExecuteScriptOptions} [options={}] - Options for script execution
   */
  executeScript(script, options = {}) {
    // Build script tag attributes
    const attrs = [];
    
    if (options.attributes) {
      for (const [key, value] of Object.entries(options.attributes)) {
        attrs.push(`${key}="${value}"`);
      }
    }

    // Add auto-remove via data-on:load if autoRemove is true (default)
    const autoRemove = options.autoRemove !== undefined ? options.autoRemove : Defaults.AutoRemove;
    if (autoRemove) {
      attrs.push('data-on:load="this.remove()"');
    }

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    const scriptElement = `<script${attrStr}>${script}</script>`;

    // In Datastar RC.6, executeScript is done by patching a script element to body
    this.patchElements(scriptElement, {
      selector: 'body',
      mode: PatchMode.Append,
      eventId: options.eventId,
      retryDuration: options.retryDuration,
    });
  }

  /**
   * Remove an element from the DOM
   * @param {string} selector - CSS selector for element to remove
   * @param {RemoveElementsOptions} [options={}] - Options
   */
  removeElement(selector, options = {}) {
    this.patchElements('', {
      selector,
      mode: PatchMode.Remove,
      eventId: options.eventId,
      retryDuration: options.retryDuration,
    });
  }

  /**
   * Remove elements from the DOM (alias for removeElement)
   * @param {string} selector - CSS selector for elements to remove
   * @param {RemoveElementsOptions} [options={}] - Options
   */
  removeElements(selector, options = {}) {
    this.removeElement(selector, options);
  }

  /**
   * Redirect the browser to a new URL
   * Uses setTimeout to ensure proper event processing before navigation.
   * @param {string} url - URL to redirect to
   * @param {ExecuteScriptOptions} [options={}] - Options
   */
  redirect(url, options = {}) {
    this.executeScript(`setTimeout(() => window.location = "${url}")`, options);
  }

  /**
   * Redirect with format string support (matches Go SDK API)
   * @param {string} format - URL format string with %s placeholders
   * @param {...*} args - Arguments to substitute
   */
  redirectf(format, ...args) {
    let url = format;
    let argIndex = 0;
    url = format.replace(/%[sv]/g, () => {
      const arg = args[argIndex++];
      return arg !== undefined ? String(arg) : '';
    });
    this.redirect(url);
  }

  /**
   * Replace the current URL without navigation
   * @param {string} url - New URL
   * @param {ExecuteScriptOptions} [options={}] - Options
   */
  replaceUrl(url, options = {}) {
    this.executeScript(`history.replaceState({}, '', "${url}")`, options);
  }

  /**
   * Update the URL query string without navigation
   * @param {string} querystring - New query string (including ?)
   * @param {ExecuteScriptOptions} [options={}] - Options
   */
  replaceUrlQuerystring(querystring, options = {}) {
    this.executeScript(
      `history.replaceState({}, '', window.location.pathname + "${querystring}")`,
      options
    );
  }

  /**
   * Log a message to the browser console
   * @param {string} message - Message to log
   * @param {ExecuteScriptOptions} [options={}] - Options
   */
  consoleLog(message, options = {}) {
    const escaped = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    this.executeScript(`console.log("${escaped}")`, options);
  }

  /**
   * Log an error to the browser console
   * @param {string} message - Error message to log
   * @param {ExecuteScriptOptions} [options={}] - Options
   */
  consoleError(message, options = {}) {
    const escaped = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    this.executeScript(`console.error("${escaped}")`, options);
  }

  /**
   * Dispatch a custom DOM event
   * @param {string} eventName - Name of the custom event
   * @param {Object} [detail={}] - Event detail data
   * @param {Object} [options={}] - Options
   * @param {string} [options.selector='document'] - Target selector
   * @param {boolean} [options.bubbles=true] - Whether event bubbles
   * @param {boolean} [options.cancelable=true] - Whether event is cancelable
   * @param {boolean} [options.composed=true] - Whether event is composed
   */
  dispatchCustomEvent(eventName, detail = {}, options = {}) {
    const {
      selector = 'document',
      bubbles = true,
      cancelable = true,
      composed = true,
      ...scriptOptions
    } = options;

    const eventOptions = {
      detail,
      bubbles,
      cancelable,
      composed,
    };

    const script = selector === 'document'
      ? `document.dispatchEvent(new CustomEvent("${eventName}", ${JSON.stringify(eventOptions)}))`
      : `document.querySelector("${selector}")?.dispatchEvent(new CustomEvent("${eventName}", ${JSON.stringify(eventOptions)}))`;

    this.executeScript(script, scriptOptions);
  }

  /**
   * Prefetch URLs using the Speculation Rules API
   * @param {string[]} urls - URLs to prefetch
   * @param {ExecuteScriptOptions} [options={}] - Options
   */
  prefetch(urls, options = {}) {
    const rules = {
      prefetch: [{ source: 'list', urls }],
    };

    const script = `
      const script = document.createElement('script');
      script.type = 'speculationrules';
      script.textContent = '${JSON.stringify(rules)}';
      document.head.appendChild(script);
    `.trim().replace(/\n\s*/g, ' ');

    this.executeScript(script, options);
  }

  /**
   * Close the SSE connection
   */
  close() {
    if (!this._isClosed) {
      this._isClosed = true;
      this._reply.raw.end();
    }
  }
}

module.exports = { ServerSentEventGenerator };
