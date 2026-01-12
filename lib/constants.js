/**
 * Datastar SDK Constants
 * These values align with the official Datastar specification (1.0.0-RC.6)
 * @module constants
 */

'use strict';

/** Current Datastar version */
const DATASTAR_VERSION = '1.0.0-RC.7';

/** Datastar key used in query parameters and headers */
const DATASTAR_KEY = 'datastar';

/**
 * SSE Event Types
 * Note: In RC.6, there is no separate execute-script event type.
 * Scripts are executed by patching a <script> element to body.
 * @enum {string}
 */
const EventType = {
  /** Event for patching HTML elements into the DOM */
  PatchElements: 'datastar-patch-elements',
  /** Event for patching signals */
  PatchSignals: 'datastar-patch-signals',
};

/**
 * Element Patch Modes
 * @enum {string}
 */
const PatchMode = {
  /** Morphs the outer HTML of the elements (default and recommended) */
  Outer: 'outer',
  /** Morphs the inner HTML of the elements */
  Inner: 'inner',
  /** Replaces the outer HTML of the elements */
  Replace: 'replace',
  /** Prepends the elements to the target's children */
  Prepend: 'prepend',
  /** Appends the elements to the target's children */
  Append: 'append',
  /** Inserts the elements before the target as siblings */
  Before: 'before',
  /** Inserts the elements after the target as siblings */
  After: 'after',
  /** Removes the target elements from DOM */
  Remove: 'remove',
};

/**
 * Data Line Prefixes for SSE events
 * @enum {string}
 */
const DataLine = {
  Selector: 'selector',
  Mode: 'mode',
  Elements: 'elements',
  UseViewTransition: 'useViewTransition',
  Signals: 'signals',
  OnlyIfMissing: 'onlyIfMissing',
};

/**
 * Default Values
 * @enum {*}
 */
const Defaults = {
  /** Default SSE retry duration in milliseconds */
  SSERetryDuration: 1000,
  /** Default value for useViewTransition */
  UseViewTransitions: false,
  /** Default value for onlyIfMissing when patching signals */
  OnlyIfMissing: false,
  /** Default value for autoRemove when executing scripts */
  AutoRemove: true,
  /** Default element patch mode */
  PatchMode: PatchMode.Outer,
};

/**
 * Request/Response Headers
 * @enum {string}
 */
const Headers = {
  /** Header indicating a Datastar request */
  DatastarRequest: 'datastar-request',
  /** Content type for SSE responses */
  ContentTypeSSE: 'text/event-stream',
  /** Content type for JSON */
  ContentTypeJSON: 'application/json',
  /** Query parameter name for signals in GET requests */
  SignalsQueryParam: 'datastar',
};

module.exports = {
  DATASTAR_VERSION,
  DATASTAR_KEY,
  EventType,
  PatchMode,
  DataLine,
  Defaults,
  Headers,
};
