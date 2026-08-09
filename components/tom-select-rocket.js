// Rocket Tom Select component — Datastar Pro v1.0.1 bundle (OSS core 1.0.2)
// Public contract preserved from the RC.7/8 template version:
//   tag:    <rocket-tom-select>
//   props:  placeholder, max-items, options, value, allow-create,
//           detail-field, search-url, check-options, dropdown-parent
//   emits:  ts-change CustomEvent { detail: { value: string } }

import { rocket } from '/public/js/datastar-pro.js'

const TOM_SELECT_CDN =
  'https://cdn.jsdelivr.net/npm/tom-select@2.4.1/dist/js/tom-select.complete.min.js'

let tomSelectPromise = null
function loadTomSelect() {
  if (window.TomSelect) return Promise.resolve(window.TomSelect)
  if (tomSelectPromise) return tomSelectPromise
  tomSelectPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = TOM_SELECT_CDN
    s.onload = () => resolve(window.TomSelect)
    s.onerror = () => reject(new Error('Failed to load TomSelect'))
    document.head.appendChild(s)
  })
  return tomSelectPromise
}

function parseOptions(raw) {
  try {
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

rocket('rocket-tom-select', {
  mode: 'light',
  renderOnPropChange: false,

  props: ({ string, number, bool }) => ({
    placeholder: string.default('Select...'),
    maxItems: number.min(1).default(1),
    options: string.default(''),
    value: string.default(''),
    allowCreate: bool.default(false),
    detailField: string.default(''),
    // Opt-in: render this ONE detail field FIRST and bold (alongside the bold
    // text label) instead of as a trailing muted detail. Used by the wcomp
    // payee picker to lead each row with the bold FEDID before the payee name.
    // Must also appear in detail-field. Empty = current behavior (text first,
    // all detail fields trailing/muted) — so liability and other pickers are
    // unaffected.
    leadField: string.default(''),
    searchUrl: string.default(''),
    checkOptions: bool.default(false),
    dropdownParent: string.default(''),
    // Space-separated class names to add to the tom-select dropdown
    // element after init. The dropdown is appended to <body> (or to the
    // dropdownParent if set), NOT inside the rocket-tom-select host — so
    // host classes can't reach it via CSS descendant selectors. This prop
    // lets a consumer scope dropdown styling (e.g. dropdown-class="driver-picker-dropdown"
    // + CSS .driver-picker-dropdown { min-width: 720px }) without changing
    // the dropdown's parent.
    dropdownClass: string.default(''),
    // When active, as soon as the user's typing narrows the dropdown to a
    // single remaining option, that option is auto-selected. Two code
    // paths are wired: onType (local-option pickers, sync filter) and the
    // post-load event (remote search-url pickers, async results).
    // Single-select picker: setValue + close + blur.
    // Multi / check-options picker: addItem + clear typed text so the user
    //   can keep filtering for more matches.
    // NOTE: the declared default below is NOT the authority — the live
    // _autoSelectActive() gate in onFirstRender reads the raw attribute per
    // call (unset → ON for single-select / OFF for multi; "false"/"0" → off),
    // so the feature is runtime-toggleable via setAttribute. The prop is
    // declared only so `auto-select-single` is a recognized attribute.
    autoSelectSingle: bool.default(false),
  }),

  render: ({ html }) => html`<select data-rocket-ref="selectEl"></select>`,

  onFirstRender({ host, refs, props, emit, cleanup, observeProps }) {
    let tsInstance = null
    let prevOptionsStr = ''
    let lastSyncedValue = ''

    // Shared auto-select-single resolver. Called from config.onType (always
    // wired in buildConfig) AND from a post-init 'load' listener (always wired
    // for search-url pickers). One implementation, two call sites — covers
    // both local-option and remote search-url pickers.
    //
    // _autoSelectActive() is the per-call LIVE gate: it reads the raw
    // attribute on every keystroke so the feature can be toggled at runtime
    // via setAttribute / data-attr:auto-select-single (see the demo page).
    // bool.default(false) would collapse "unset" and explicit "false", so the
    // raw attribute is authoritative: unset → ON for single-select / OFF for
    // multi; explicit "false"/"0" → off; anything else → on.
    const isMulti = !!props.checkOptions || (props.maxItems || 1) > 1
    function _autoSelectActive() {
      const raw = host.getAttribute('auto-select-single')
      if (raw === null) return !isMulti
      return raw !== 'false' && raw !== '0'
    }
    function _tryAutoSelectSingle(ts) {
      if (!ts) return
      if (!_autoSelectActive()) return
      const items = ts.currentResults && ts.currentResults.items
      if (!items || items.length !== 1) return
      const only = items[0].id
      const current = ts.getValue()
      const alreadyHas = Array.isArray(current)
        ? current.indexOf(only) !== -1
        : current === only
      if (alreadyHas) return
      if (isMulti) {
        ts.addItem(only, false)        // add to selection
        ts.setTextboxValue('')          // clear typed text for next filter
      } else {
        ts.setValue(only, false)        // false → fire onChange / ts-change
        ts.close()
        ts.blur()
      }
    }

    function buildConfig(TomSelect) {
      const opts = parseOptions(props.options)
      const config = {
        placeholder: props.placeholder,
        maxItems: props.maxItems || 1,
        maxOptions: null,
        create: !!props.allowCreate,
        plugins: {},
        onInitialize() {
          if (props.value) this.setValue(props.value.split(','), true)
        },
        onChange(val) {
          try {
            const strVal = Array.isArray(val) ? val.join(',') : ('' + (val || ''))
            // Sync back to the value attribute so external bindings see it
            if (host.getAttribute('value') !== strVal) {
              host.setAttribute('value', strVal)
            }
            lastSyncedValue = strVal
            emit('ts-change', { value: strVal })
          } catch (e) {
            console.error('[rocket-tom-select onChange]', e)
          }
        },
      }

      if (props.dropdownParent) config.dropdownParent = props.dropdownParent

      if (props.checkOptions) {
        config.maxItems = 50
        config.plugins.checkbox_options = {}
        config.plugins.remove_button = { title: 'Remove' }
        config._realOnChange = config.onChange
        config.onChange = function () {} // Apply button fires it
      } else if ((props.maxItems || 1) > 1) {
        config.plugins.remove_button = { title: 'Remove' }
      }

      // Auto-resolve when typing narrows the dropdown to a single option.
      // Always wired; the per-call _autoSelectActive() gate inside
      // _tryAutoSelectSingle decides whether it acts. Fired from two places:
      //   • onType  → covers local-option pickers (TomSelect filters
      //     currentResults synchronously, so setTimeout(0) lets that pass
      //     finish before we inspect items).
      //   • 'load' event → covers remote search-url pickers (results
      //     arrive AFTER the keystroke; onType already ran and saw 0).
      // currentResults.items[i].id is the option's value (per valueField).
      // Single-select  → setValue + close + blur.
      // Multi / check-options → addItem and clear the typed text so the
      //   user can keep filtering for more matches (the check-options
      //   Apply / dropdown_close auto-apply still gate the actual search).
      config.onType = function (query) {
        if (!query) return
        var self = this
        setTimeout(function () { _tryAutoSelectSingle(self) }, 0)
      }

      if (opts.length > 0) {
        config.options = opts
        config.labelField = 'text'
        config.valueField = 'value'
        config.searchField = ['text']
      }

      if (props.detailField) {
        const fields = props.detailField.split(',').map((f) => f.trim())
        config.searchField = ['text'].concat(fields)
        // Optional lead field: rendered first + bold (with a bold text label),
        // and pulled out of the trailing muted details.
        const lead = props.leadField || ''
        const detailFields = lead ? fields.filter((f) => f !== lead) : fields
        config.render = {
          option(data, escape) {
            let h = '<div style="display:flex;gap:.5rem">'
            if (lead) {
              h += '<span style="font-weight:700;min-width:6rem">' + escape(data[lead] || '') + '</span>'
            }
            h += '<span style="flex:1' + (lead ? ';font-weight:700' : '') + '">'
              + escape(data.text) + '</span>'
            for (const f of detailFields) {
              h += '<span style="color:#888;font-size:.8em;min-width:5rem;text-align:right">'
                + escape(data[f] || '') + '</span>'
            }
            return h + '</div>'
          },
          item(data, escape) {
            const parts = []
            if (lead && data[lead]) parts.push(escape(data[lead]))
            parts.push(escape(data.text))
            for (const f of detailFields) if (data[f]) parts.push(escape(data[f]))
            return '<div>' + parts.join(' · ') + '</div>'
          },
        }
      }

      if (props.searchUrl) {
        const sUrl = props.searchUrl
        config.load = function (query, callback) {
          if (!query.length) return callback()
          fetch(sUrl + '?q=' + encodeURIComponent(query))
            .then((res) => res.json())
            .then((data) => callback(data))
            .catch(() => callback())
        }
        config.labelField = 'text'
        config.valueField = 'value'
        // DON'T blindly overwrite searchField here — if `detail-field` was
        // also set, that block above expanded searchField to include the
        // detail columns (license/dob/state/...) so a typed query could
        // match any of them. Overwriting back to ['text'] meant a query
        // like "ABC123" (a license number) would never match because the
        // server returned rows whose `text` column ("Last, First") didn't
        // contain "ABC123" — bug #9 (driver search shows 2 records but
        // dropdown is empty). Only set ['text'] when detail-field didn't.
        if (!props.detailField) config.searchField = ['text']
      }

      return config
    }

    function attachCheckboxBar() {
      const cfg = tsInstance.settings
      if (!cfg._realOnChange) return
      const fireChange = cfg._realOnChange
      const bar = document.createElement('div')
      bar.style.cssText = 'display:flex;gap:4px;padding:4px 6px;border-top:1px solid var(--clr-border,#ddd);'
      const applyBtn = document.createElement('button')
      applyBtn.type = 'button'
      applyBtn.textContent = 'Apply'
      applyBtn.style.cssText = 'flex:1;padding:2px 6px;font-size:11px;cursor:pointer;background:#4472c4;color:#fff;border:1px solid #3560a8;border-radius:3px;'
      const clearBtn = document.createElement('button')
      clearBtn.type = 'button'
      clearBtn.textContent = 'Clear'
      clearBtn.style.cssText = 'flex:1;padding:2px 6px;font-size:11px;cursor:pointer;background:var(--clr-bg,#f5f5f5);color:var(--clr-text,#333);border:1px solid var(--clr-border,#ccc);border-radius:3px;'
      const ts = tsInstance
      const norm = (v) => (Array.isArray(v) ? v.join(',') : ('' + (v || '')))
      // Value last emitted via ts-change; used so the dropdown-close
      // auto-apply doesn't fire a duplicate emit right after Apply/Clear.
      let lastApplied = norm(ts.getValue())
      function apply (val) {
        lastApplied = norm(val)
        fireChange.call(ts, val)
      }
      applyBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        apply(ts.getValue())
        ts.close()
      })
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        ts.clear(true)
        apply('')
        ts.close()
      })
      // Auto-apply on dropdown close (click-away / Escape / done selecting)
      // when the value changed since the last apply — so picking a filter
      // (e.g. All Insureds → one town) refreshes without hunting for the
      // Apply button. Explicit Apply/Clear still work; no-ops when unchanged.
      ts.on('dropdown_close', () => {
        if (norm(ts.getValue()) !== lastApplied) apply(ts.getValue())
      })
      // Removing a chip via its ✕ (remove_button) happens with the dropdown
      // closed, so neither Apply nor dropdown_close fires — and check-options
      // gates the normal onChange. Clearing the last selected option that way
      // (e.g. an Insured restored from a saved search) therefore never emitted
      // ts-change and the grid never refreshed. Apply on item removal when the
      // dropdown is closed; the open-dropdown uncheck is still handled by
      // dropdown_close above, so this won't double-fire.
      ts.on('item_remove', () => {
        if (!ts.isOpen && norm(ts.getValue()) !== lastApplied) apply(ts.getValue())
      })
      bar.appendChild(applyBtn)
      bar.appendChild(clearBtn)
      ts.dropdown.style.display = 'flex'
      ts.dropdown.style.flexDirection = 'column'
      ts.dropdown_content.style.maxHeight = '170px'
      ts.dropdown_content.style.flex = '1'
      ts.dropdown.appendChild(bar)
      ts.close()
      ts.blur()
    }

    loadTomSelect()
      .then((TomSelect) => {
        if (!refs.selectEl || tsInstance) return
        tsInstance = new TomSelect(refs.selectEl, buildConfig(TomSelect))
        prevOptionsStr = props.options || ''
        lastSyncedValue = props.value || ''
        // Re-apply the server-provided initial value after construction.
        // onInitialize() already calls setValue during construction, but for
        // check-options pickers the control is wired by the checkbox_options /
        // remove_button plugins, and that initial setValue can leave the
        // control showing the placeholder while a value is actually set — a
        // restored Insured / Claim Type then reads as "All …" instead of its
        // chip. setValue is silent (no ts-change) and idempotent, so this is
        // purely visual; it runs before attachCheckboxBar() so the auto-apply
        // baseline (lastApplied) captures the correct value.
        if (props.value) tsInstance.setValue(props.value.split(','), true)
        // Propagate dropdown-class onto the actual dropdown element. The
        // dropdown is appended to <body> by default, so this is the only
        // way for a consumer to scope CSS to a specific picker's dropdown
        // without setting dropdown-parent.
        if (props.dropdownClass && tsInstance.dropdown) {
          props.dropdownClass.split(/\s+/).filter(Boolean).forEach(function (c) {
            tsInstance.dropdown.classList.add(c)
          })
        }
        attachCheckboxBar()

        // ── Ctrl/Cmd+C copies the selected option's label ──────────────────
        // TomSelect renders the chosen item as a non-selectable <div>, so a
        // plain Ctrl+C copies nothing. Wire a copy handler on the control:
        // with a value selected and no live text selection (so we never
        // hijack copying typed search text), write the option label(s) to the
        // clipboard. Multi-select joins labels with ", ". Listener lives on
        // the TomSelect wrapper, which is removed by destroy() — no leak.
        function _copySelectedLabel(e) {
          // Respect a real text selection (e.g. user highlighted typed text).
          var docSel = window.getSelection && window.getSelection()
          if (docSel && String(docSel).length > 0) return
          var val = tsInstance.getValue()
          var vals = Array.isArray(val) ? val : (val ? [val] : [])
          if (!vals.length) return
          var labelField = tsInstance.settings.labelField || 'text'
          var text = vals.map(function (v) {
            var o = tsInstance.options[v]
            return o ? (o[labelField] || o.text || v) : v
          }).join(', ')
          if (!text) return
          e.preventDefault()
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).catch(function () { _fallbackCopy(text) })
            } else {
              _fallbackCopy(text)
            }
          } catch (_) { _fallbackCopy(text) }
        }
        function _fallbackCopy(text) {
          try {
            var ta = document.createElement('textarea')
            ta.value = text
            ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
          } catch (_) { /* clipboard unavailable — nothing more we can do */ }
        }
        if (tsInstance.wrapper) {
          // Capture phase so we handle Ctrl/Cmd+C before TomSelect's own
          // control_input key handling gets a chance to swallow it.
          tsInstance.wrapper.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
              _copySelectedLabel(e)
            }
          }, true)
        }

        // Remote-picker auto-select: re-evaluate after each async load
        // completes (onType already ran before fetch returned and saw 0).
        // Always wired; the per-call _autoSelectActive() gate decides.
        if (props.searchUrl) {
          tsInstance.on('load', function () {
            _tryAutoSelectSingle(tsInstance)
          })
        }
        // Custom dropdown-parent positioning fix.
        //   TomSelect's positionDropdown() only runs when dropdownParent
        //   is 'body' (the default). When you set dropdownParent to a
        //   custom element (e.g. for a picker inside a <dialog> opened
        //   with showModal(), where body-children are occluded by the
        //   top-layer), positionDropdown bails. The dropdown's CSS then
        //   uses its default `top: 100%` rule, which means 100% of the
        //   PARENT's height — so the dropdown ends up at the bottom of
        //   the dialog (often off-screen ~y=900px), not below the input.
        //
        //   Fix: on every dropdown_open, manually anchor the dropdown to
        //   the .ts-control element (the input wrapper) using offsets
        //   computed relative to the dropdown's parent. This mirrors
        //   what positionDropdown() does for the default body parent.
        if (props.dropdownParent) {
          tsInstance.on('dropdown_open', function () {
            try {
              var ctrl = tsInstance.control
              var dd   = tsInstance.dropdown
              var pe   = dd.parentElement
              if (!ctrl || !dd || !pe) return
              var cRect = ctrl.getBoundingClientRect()
              var pRect = pe.getBoundingClientRect()
              dd.style.top   = (cRect.bottom - pRect.top)  + 'px'
              dd.style.left  = (cRect.left   - pRect.left) + 'px'
              dd.style.width = cRect.width + 'px'
            } catch (e) { /* non-fatal: dropdown still renders, just maybe mispositioned */ }
          })
        }
      })
      .catch((e) => console.error('[rocket-tom-select]', e))

    observeProps(
      (_p, changes) => {
        if (!tsInstance) return
        if ('options' in changes) {
          const optStr = props.options || ''
          if (optStr !== prevOptionsStr) {
            prevOptionsStr = optStr
            try {
              const parsed = optStr ? JSON.parse(optStr) : []
              tsInstance.clearOptions()
              tsInstance.addOptions(parsed)
              tsInstance.refreshOptions(false)
            } catch {}
          }
        }
        if ('value' in changes) {
          const newVal = props.value || ''
          if (newVal !== lastSyncedValue) {
            lastSyncedValue = newVal
            if (newVal) tsInstance.setValue(newVal.split(','), true)
            else tsInstance.clear(true)
          }
        }
      },
      'options',
      'value',
    )

    cleanup(() => {
      if (tsInstance) {
        tsInstance.destroy()
        tsInstance = null
      }
    })
  },
})
