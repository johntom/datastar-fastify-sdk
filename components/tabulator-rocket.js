// Rocket Tabulator component — Datastar Pro v1.0.1 bundle (OSS core 1.0.2)
// Public contract preserved from the RC.7/8 template version:
//   tag:       <rocket-tabulator>
//   props:     columns, data, height, layout, placeholder,
//              movable-columns, resizable-columns, enable-row-click,
//              selectable-rows, initial-sort, initial-filters, row-index,
//              filter-bar   (opt-in: shows a blue active-filter status
//                            footer like the legacy Delphi grid),
//              lock-column-order (opt-in: column picker is hide/show only —
//                            no drag-to-reorder grip/handlers)
//   emits:     tab-row-click   { row }
//              tab-columns-changed { columns: [{field, visible, width}] }   (debounced 600ms)
//              tab-rows-selected   { rows }   (only when selectable-rows is set)
//              tab-sorted      { sorters: [{field, dir, title}] }   (on every
//                            sort change + once after build for the initial
//                            state; sorters is [] when no sort is applied)
//   element methods/props:
//              _tabInstance     - the Tabulator instance
//              _showColPicker(anchorEl) - toggle the column picker popup
//
// Tabulator global is loaded via a <script> tag in layout.njk.

import { rocket } from '/public/js/datastar-pro.js'

function parseJSONStr(raw) {
  try {
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function isoDateFormatter(cell) {
  const v = cell.getValue()
  if (!v) return ''
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? m[2] + '/' + m[3] + '/' + m[1] : v
}

function notesWrapFormatter(cell) {
  // Multi-line preview cell (max ~3 lines, overflow hidden). The click-to-open
  // full-note popup was removed — it stopPropagation'd the cell click, so
  // clicking Notes opened a modal instead of selecting the diary row +
  // populating the edit form (which already shows the full note). Clicking the
  // cell now behaves like any other cell. The hover tooltip (notesWrapTooltip)
  // still gives a quick preview.
  const v = cell.getValue() || ''
  const div = document.createElement('div')
  div.style.cssText =
    'white-space:pre-wrap;word-break:break-word;' +
    'max-height:3.6em;overflow:hidden;line-height:1.2em;'
  div.textContent = v
  return div
}

function notesWrapTooltip(_e, cell) {
  const v = cell.getValue() || ''
  return v.length > 200 ? v.substring(0, 200) + '…' : v
}

// Status-pill formatter for the claims grid Status column. Reuses the
// .cdf-status styling already used by the claim-detail header — same
// green (Open / ReOpen) / red (Closed) palette, just scoped to a grid
// cell instead of a label. Accepts either the text label produced by
// liability.js / wcomp.js row mappers ("Open" | "Closed" | "ReOpen")
// OR the raw numeric value (1 | 2 | 3) so the formatter stays robust
// if the upstream mapper is bypassed.
// Render a small primary button that calls window.openClaimTab(id, claimNo,
// townId). Reads WCompID (wcomp) or LiabilityID (liability) from the row so
// the same formatter works on both module grids. Used by the wcomp grid view
// to give users explicit "open this claim" control while a plain row-click
// only updates the right-side scan panel — see views/wcomp/index.njk +
// public/js/wcomp/scan-panel.js.
function openClaimButtonFormatter(cell) {
  const d = cell.getRow().getData() || {}
  const id = d.WCompID != null ? d.WCompID : d.LiabilityID
  if (id == null) return ''
  const claimNo = String(d.ClaimNo || '').replace(/'/g, "\\'")
  const townId  = Number(d.TownID) || 0
  return '<button class="btn btn--xs btn--primary" type="button" ' +
         'onclick="event.stopPropagation();window.openClaimTab(' +
         id + ",'" + claimNo + "'," + townId + ')">Open</button>'
}

// Account cell as a link that filters the right-side scan panel (scan payments
// + scan docs) for the row's insured/town, via window._loadScansFor. Used on the
// wcomp claims grid: row-click opens the claim, this link loads its scans.
// stopPropagation so the row-click open doesn't also fire.
function accountScanLinkFormatter(cell) {
  const v = cell.getValue()
  const text = (v == null ? '' : String(v))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (!text) return ''
  const d = cell.getRow().getData() || {}
  const id = d.WCompID != null ? d.WCompID : d.LiabilityID
  const townId = Number(d.TownID) || 0
  if (id == null) return text
  return '<a href="#" class="acct-scan-link" title="Filter scans + payments for this insured" ' +
         'onclick="event.preventDefault();event.stopPropagation();' +
         'window._loadScansFor(' + id + ',' + townId + ')">' + text + '</a>'
}

function statusBadgeFormatter(cell) {
  const raw = cell.getValue()
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  let code, label
  if (s === 'Open'   || s === '1') { code = '1'; label = 'Open' }
  else if (s === 'Closed' || s === '2') { code = '2'; label = 'Closed' }
  else if (s === 'ReOpen' || s === 'Re-Open' || s === '3') { code = '3'; label = 'ReOpen' }
  else { code = '0'; label = s }
  return '<span class="cdf-status" data-status-value="' + code + '">' + label + '</span>'
}

// Factory: build a checklistFilter that cleans up via the supplied registry.
function makeChecklistFilter(registerCleanup) {
  return function checklistFilter(cell, _onRendered, success) {
    const field = cell.getColumn().getField()
    const container = document.createElement('div')
    container.style.position = 'relative'
    container.style.width = '100%'

    const display = document.createElement('input')
    display.type = 'text'
    display.readOnly = true
    display.style.cssText =
      'width:100%;cursor:pointer;box-sizing:border-box;padding:2px 4px;font-size:12px;'
    display.placeholder = 'Filter...'
    container.appendChild(display)

    let selected = {}
    const currentVal = cell.getValue()
    if (Array.isArray(currentVal)) currentVal.forEach((v) => (selected[v] = true))

    function updateDisplay() {
      const keys = Object.keys(selected)
      display.value = keys.length ? keys.length + ' selected' : ''
    }
    updateDisplay()

    const dropdown = document.createElement('div')
    dropdown.style.cssText =
      'display:none;position:fixed;z-index:9999;' +
      'background:var(--clr-surface,#fff);color:var(--clr-text,#333);' +
      'border:1px solid var(--clr-border,#ccc);box-shadow:0 2px 8px rgba(0,0,0,.25);' +
      'min-width:180px;max-height:260px;overflow:hidden;font-size:12px;'

    const searchBox = document.createElement('input')
    searchBox.type = 'text'
    searchBox.placeholder = 'Search...'
    searchBox.style.cssText =
      'width:100%;box-sizing:border-box;padding:4px 6px;border:none;' +
      'border-bottom:1px solid var(--clr-border,#ddd);font-size:12px;' +
      'background:var(--clr-bg,#fff);color:var(--clr-text,#333);'
    dropdown.appendChild(searchBox)

    const listWrap = document.createElement('div')
    listWrap.style.cssText = 'max-height:170px;overflow-y:auto;padding:4px 0;'
    dropdown.appendChild(listWrap)

    const btnBar = document.createElement('div')
    btnBar.style.cssText =
      'display:flex;gap:4px;padding:4px 6px;border-top:1px solid var(--clr-border,#ddd);'
    const applyBtn = document.createElement('button')
    applyBtn.textContent = 'Apply'
    applyBtn.style.cssText =
      'flex:1;padding:2px 6px;font-size:11px;cursor:pointer;background:#4472c4;color:#fff;border:1px solid #3560a8;border-radius:3px;'
    const clearBtn = document.createElement('button')
    clearBtn.textContent = 'Clear'
    clearBtn.style.cssText =
      'flex:1;padding:2px 6px;font-size:11px;cursor:pointer;' +
      'background:var(--clr-bg,#f5f5f5);color:var(--clr-text,#333);' +
      'border:1px solid var(--clr-border,#ccc);border-radius:3px;'
    btnBar.appendChild(applyBtn)
    btnBar.appendChild(clearBtn)
    dropdown.appendChild(btnBar)

    document.body.appendChild(dropdown)

    function positionDropdown() {
      const rect = display.getBoundingClientRect()
      dropdown.style.top = rect.bottom + 'px'
      dropdown.style.left = rect.left + 'px'
      dropdown.style.minWidth = Math.max(180, rect.width) + 'px'
      // Size the option list to the space below the header instead of the old
      // fixed 170px, so long value lists (e.g. every staff name) are visible
      // without scrolling whenever the viewport allows.
      const avail = window.innerHeight - rect.bottom - 8
      dropdown.style.maxHeight = Math.max(260, avail) + 'px'
      listWrap.style.maxHeight = Math.max(170, avail - 64) + 'px'
    }

    function buildList(filterText) {
      listWrap.innerHTML = ''
      const table = cell.getTable()
      const vals = {}
      table.getData().forEach((row) => {
        const v = row[field]
        if (v !== undefined && v !== null && v !== '') vals[v] = true
      })
      const sorted = Object.keys(vals).sort()
      const ft = (filterText || '').toLowerCase()
      sorted.forEach((val) => {
        if (ft && val.toLowerCase().indexOf(ft) === -1) return
        const label = document.createElement('label')
        label.style.cssText =
          'display:flex;align-items:center;gap:4px;padding:2px 6px;cursor:pointer;white-space:nowrap;'
        label.addEventListener('mouseover', () => (label.style.background = 'var(--clr-bg,#e8f0fe)'))
        label.addEventListener('mouseout', () => (label.style.background = ''))
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.checked = !!selected[val]
        cb.style.margin = '0'
        cb.addEventListener('change', () => {
          if (cb.checked) selected[val] = true
          else delete selected[val]
        })
        label.appendChild(cb)
        label.appendChild(document.createTextNode(val))
        listWrap.appendChild(label)
      })
    }

    searchBox.addEventListener('input', () => buildList(searchBox.value))

    applyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const keys = Object.keys(selected)
      updateDisplay()
      dropdown.style.display = 'none'
      success(keys.length ? keys : '')
    })

    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      selected = {}
      buildList(searchBox.value)
      updateDisplay()
      dropdown.style.display = 'none'
      success('')
    })

    display.addEventListener('click', (e) => {
      e.stopPropagation()
      const showing = dropdown.style.display !== 'none'
      if (showing) {
        dropdown.style.display = 'none'
      } else {
        positionDropdown()
        dropdown.style.display = 'block'
        searchBox.value = ''
        buildList('')
        searchBox.focus()
      }
    })

    function onDocClick(e) {
      if (!container.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none'
      }
    }
    document.addEventListener('click', onDocClick)

    registerCleanup(() => {
      document.removeEventListener('click', onDocClick)
      if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown)
    })

    return container
  }
}

// Human-readable operator for the filter-status bar
function filterOpSymbol(type) {
  switch (type) {
    case '=': return '='
    case '!=': return '≠'   // ≠
    case '<': return '<'
    case '<=': return '≤'   // ≤
    case '>': return '>'
    case '>=': return '≥'   // ≥
    case 'like': return 'contains'
    case 'keywords': return 'contains'
    case 'starts': return 'starts with'
    case 'ends': return 'ends with'
    case 'in': return 'in'
    default: return '='
  }
}

// Collapse the current header + programmatic filters into display parts.
// Legacy Delphi showed e.g. "(Payee Detail ID = Arleo & Donohue, LLC)".
function describeFilters(tabInstance) {
  const parts = []
  const seen = new Set()
  function collect(arr) {
    ;(arr || []).forEach((f) => {
      if (Array.isArray(f)) return collect(f) // OR-groups are nested arrays
      if (!f || !f.field) return
      let val = f.value
      if (val === '' || val === undefined || val === null) return
      if (Array.isArray(val)) {
        if (!val.length) return
        val = val.join(', ')
      }
      const key = f.field + '|' + f.type + '|' + val
      if (seen.has(key)) return
      seen.add(key)
      let title = f.field
      try {
        const col = tabInstance.getColumn(f.field)
        if (col) title = col.getDefinition().title || f.field
      } catch {}
      parts.push({ title: String(title), op: filterOpSymbol(f.type), val: String(val) })
    })
  }
  try { collect(tabInstance.getHeaderFilters && tabInstance.getHeaderFilters()) } catch {}
  try { collect(tabInstance.getFilters && tabInstance.getFilters()) } catch {}
  return parts
}

// Chronological date sorter. Column defs are JSON-serialized server-side, and
// JSON.stringify drops function-valued properties — so a `sorter: <function>`
// set on the server never reaches the client and the column falls back to a
// STRING sort. For "MM/DD/YYYY" display strings that's wrong order (sorts by
// month, then day, then year). This sorter handles BOTH "MM/DD/YYYY" and ISO
// "YYYY-MM-DD" cell values so it can be applied to any date column regardless of
// the underlying storage format. Servers send `sorter: 'mmddyyyy'` (a string
// token, mapped below) and date columns are also auto-detected (see
// resolveColumnHelpers). Blank/unparseable values sort to the bottom (0).
function mmddyyyySorter(a, b) {
  const toN = (s) => {
    const v = String(s || '')
    let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v) // MM/DD/YYYY (display)
    if (m) return (+m[3]) * 10000 + (+m[1]) * 100 + (+m[2])
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v) // YYYY-MM-DD (ISO)
    if (m) return (+m[1]) * 10000 + (+m[2]) * 100 + (+m[3])
    return 0
  }
  return toN(a) - toN(b)
}

// Money cell that renders NEGATIVE amounts (credits — e.g. a Pay Status = C
// payment, whose Pay/Billed amounts are stored negative) in red. The cell
// value arrives pre-formatted as a string ("$-1,234.00"); a minus sign marks
// it negative. Positive/blank values pass through unchanged. Pairs with the
// `cssClass: "pay-money-green"` (bold) already on these columns.
function signedMoneyFormatter(cell) {
  const v = cell.getValue()
  const s = v == null ? '' : String(v)
  if (s.indexOf('-') !== -1) {
    return '<span style="color:var(--clr-danger,#c0392b)">' + s + '</span>'
  }
  return s
}

// Resolve string formatter/headerFilter/sorter placeholders to actual functions
function resolveColumnHelpers(cols, checklistFilter) {
  cols.forEach((c) => {
    if (c.headerFilter === 'checklistFilter') c.headerFilter = checklistFilter
    if (c.sorter === 'mmddyyyy') c.sorter = mmddyyyySorter
    // Auto-apply the chronological date sorter to any date column that didn't
    // set one explicitly — date columns are marked by a "date" header filter or
    // the isoDate display formatter. Without this, MM/DD/YYYY cells sort by
    // month (wrong). The sorter also handles ISO values, so it's safe on either.
    if (!c.sorter && (c.headerFilter === 'date' || c.formatter === 'isoDate')) {
      c.sorter = mmddyyyySorter
    }
    if (c.formatter === 'signedMoney') c.formatter = signedMoneyFormatter
    if (c.formatter === 'isoDate') c.formatter = isoDateFormatter
    if (c.formatter === 'notesWrap') {
      c.formatter = notesWrapFormatter
      c.tooltip = notesWrapTooltip
    }
    if (c.formatter === 'statusBadge') {
      c.formatter = statusBadgeFormatter
      // formatter outputs HTML — Tabulator needs to know not to escape it.
      c.formatterParams = c.formatterParams || {}
    }
    if (c.formatter === 'openClaimButton') {
      c.formatter = openClaimButtonFormatter
      c.formatterParams = c.formatterParams || {}
    }
    if (c.formatter === 'accountScanLink') {
      c.formatter = accountScanLinkFormatter
      c.formatterParams = c.formatterParams || {}
    }
  })
}

rocket('rocket-tabulator', {
  mode: 'light',
  renderOnPropChange: false,

  props: ({ string, number, bool }) => ({
    columns: string.default(''),
    data: string.default(''),
    height: string.default('311px'),
    layout: string.default('fitColumns'),
    placeholder: string.default('No Data'),
    movableColumns: bool.default(false),
    resizableColumns: bool.default(true),
    enableRowClick: bool.default(false),
    selectableRows: bool.default(false),
    // When selectableRows is on, this controls the leading row-selection
    // checkbox column. Default true = existing behavior; set false (e.g. the
    // diary grid) to keep the row-highlight selection WITHOUT the checkbox.
    selectionCheckbox: bool.default(true),
    initialSort: string.default(''),
    initialFilters: string.default(''),
    rowIndex: string.default(''),
    filterBar: bool.default(false),
    // When true, the column picker (_showColPicker) is hide/show only — its
    // drag-to-reorder grip and handlers are omitted. Default false keeps the
    // existing reorder behavior for every other view.
    lockColumnOrder: bool.default(false),
    // Tabulator column-calculation placement: "" (default), "both", "group",
    // or "table". "both"/"group" yield per-group subtotal rows when grouping.
    columnCalcs: string.default(''),
    // Tabulator group toggle element: "" (default arrow), "header" (whole
    // group header click-toggles collapse), or "arrow".
    groupToggle: string.default(''),
    // Open the grid grouped by this field (grid-reports pattern): group
    // header shows "field : value (n items)". Runtime regrouping still works
    // via _tabInstance.setGroupBy(). Empty = no grouping (default).
    groupBy: string.default(''),
  }),

  render: ({ html }) => html`<div data-rocket-ref="tableEl" style="width:100%"></div>`,

  onFirstRender({ host, refs, props, emit, cleanup, observeProps }) {
    if (!window.Tabulator) {
      console.error('[rocket-tabulator] Tabulator global is not loaded')
      return
    }

    const cellCleanups = []
    const registerCellCleanup = (fn) => cellCleanups.push(fn)
    const checklistFilter = makeChecklistFilter(registerCellCleanup)
    // Expose the Apply/Clear checklist filter for grids that set their columns
    // AFTER construction via host._tabInstance.setColumns() (e.g. mailflow,
    // whose columns carry live formatter/sorter closures that can't go through
    // the JSON `columns` attribute where resolveColumnHelpers normally runs).
    // Such grids resolve the 'checklistFilter' token themselves from here.
    host._checklistFilter = checklistFilter

    const cols = parseJSONStr(props.columns)
    const rows = parseJSONStr(props.data)
    const sort = parseJSONStr(props.initialSort)
    resolveColumnHelpers(cols, checklistFilter)

    const config = {
      data: rows,
      layout: props.layout || 'fitColumns',
      height: props.height || '311px',
      movableColumns: !!props.movableColumns,
      resizableColumns: !!props.resizableColumns,
      placeholder: props.placeholder || 'No Data',
      columns: cols,
    }
    if (props.rowIndex) config.index = props.rowIndex
    // Hand Tabulator a COPY — it mutates the initialSort array in place,
    // replacing each `column` string with the live Column object (circular
    // refs). Keeping `sort` pristine lets us re-apply it cleanly post-build.
    if (sort.length) config.initialSort = sort.map((s) => ({ ...s }))
    if (props.columnCalcs) config.columnCalcs = props.columnCalcs
    if (props.groupToggle) config.groupToggleElement = props.groupToggle
    if (props.groupBy) {
      config.groupBy = props.groupBy
      // Group values come from row data — escape them, groupHeader renders HTML.
      const escGh = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      config.groupHeader = (value, count) =>
        `${escGh(props.groupBy)} : ${escGh(value)} <span style="color:#16a34a">(${count} items)</span>`
    }

    if (props.selectableRows) {
      config.selectableRows = 'highlight'
      // The checkbox column is opt-out (selection-checkbox="false") — highlight
      // selection still works via row.select() without it.
      if (props.selectionCheckbox) {
        config.rowHeader = {
          formatter: 'rowSelection',
          titleFormatter: 'rowSelection',
          headerSort: false,
          resizable: false,
          frozen: true,
          headerHozAlign: 'center',
          hozAlign: 'center',
          width: 40,
        }
      }
    }

    if (props.enableRowClick) {
      const prevFormatter = config.rowFormatter
      config.rowFormatter = (row) => {
        if (prevFormatter) {
          try { prevFormatter(row) } catch {}
        }
        row.getElement().style.cursor = 'pointer'
      }
    }

    // Active-filter status footer (opt-in via filter-bar="true")
    let filterBarEl = null
    if (props.filterBar) {
      filterBarEl = document.createElement('div')
      filterBarEl.className = 'rk-filter-bar'
      filterBarEl.style.display = 'none'
      config.footerElement = filterBarEl
    }

    const tabInstance = new window.Tabulator(refs.tableEl, config)
    host._tabInstance = tabInstance

    function renderFilterBar() {
      if (!filterBarEl || !host._tabInstance) return
      const footerWrap = filterBarEl.closest('.tabulator-footer')
      const parts = describeFilters(tabInstance)
      filterBarEl.textContent = ''
      if (!parts.length) {
        filterBarEl.style.display = 'none'
        if (footerWrap) footerWrap.style.display = 'none'
        return
      }
      if (footerWrap) footerWrap.style.display = ''
      filterBarEl.style.cssText =
        'display:flex;align-items:center;gap:10px;box-sizing:border-box;width:100%;' +
        'background:var(--clr-accent,#4472c4);color:#fff;font-size:11px;' +
        'padding:3px 8px;line-height:1.4;'

      const lbl = document.createElement('span')
      lbl.textContent = '▼ Filtered:' // ▼
      lbl.style.cssText = 'font-weight:600;white-space:nowrap;flex-shrink:0;'
      filterBarEl.appendChild(lbl)

      const txt = parts
        .map((p) => '(' + p.title + ' ' + p.op + ' ' + p.val + ')')
        .join(' AND ')
      const txtSpan = document.createElement('span')
      txtSpan.textContent = txt
      txtSpan.title = txt
      txtSpan.style.cssText =
        'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
      filterBarEl.appendChild(txtSpan)

      let shown = 0
      let total = 0
      try { shown = tabInstance.getDataCount('active') } catch {}
      try { total = tabInstance.getDataCount('all') } catch {}
      const count = document.createElement('span')
      count.textContent = shown + ' of ' + total + ' rows'
      count.style.cssText = 'white-space:nowrap;flex-shrink:0;opacity:.9;'
      filterBarEl.appendChild(count)

      const clr = document.createElement('button')
      clr.type = 'button'
      clr.textContent = '✕' // ✕
      clr.title = 'Clear all filters'
      clr.style.cssText =
        'flex-shrink:0;background:rgba(255,255,255,.18);color:#fff;border:none;' +
        'border-radius:3px;cursor:pointer;font-size:11px;line-height:1;padding:2px 6px;'
      clr.addEventListener('click', (e) => {
        e.stopPropagation()
        try { tabInstance.clearHeaderFilter() } catch {}
        try { tabInstance.clearFilter(true) } catch {}
      })
      filterBarEl.appendChild(clr)
    }
    if (filterBarEl) tabInstance.on('dataFiltered', renderFilterBar)

    if (props.enableRowClick) {
      tabInstance.on('rowClick', (e, row) => {
        if (e.target.closest('.tabulator-row-header')) return
        emit('tab-row-click', { row: row.getData() })
      })
    }

    const tabReady = new Promise((resolve) => tabInstance.on('tableBuilt', resolve))
    // Expose the build-ready promise. host._tabInstance is set synchronously
    // (above) BEFORE Tabulator finishes building, so grids that drive the table
    // post-construction (mailflow: setColumns/replaceData) must wait on this —
    // otherwise columns set pre-build don't get resize handles bound.
    host._tabReady = tabReady
    let prevDataStr = props.data || ''

    // Init the filter bar (collapses the empty footer strip + reflects
    // any server-restored initial-filters once the table is built).
    if (filterBarEl) tabReady.then(renderFilterBar)

    // Apply server-saved header filters once the table is built
    try {
      const savedFilters = JSON.parse(props.initialFilters || '[]')
      if (Array.isArray(savedFilters) && savedFilters.length) {
        tabReady.then(() => {
          savedFilters.forEach((f) => {
            if (f && f.field && f.value !== undefined && f.value !== '') {
              try { tabInstance.setHeaderFilterValue(f.field, f.value) } catch {}
            }
          })
        })
      }
    } catch {}

    // Debounced column-state emit
    let colTimer = null
    function emitColumnState() {
      clearTimeout(colTimer)
      colTimer = setTimeout(() => {
        if (!host._tabInstance) return
        const out = tabInstance
          .getColumns()
          .filter((c) => !!c.getField())
          .map((c) => ({
            field: c.getField(),
            visible: c.isVisible(),
            width: c.getWidth(),
          }))
        emit('tab-columns-changed', { columns: out })
      }, 600)
    }
    tabInstance.on('columnMoved', emitColumnState)
    tabInstance.on('columnResized', emitColumnState)
    tabInstance.on('columnVisibilityChanged', emitColumnState)

    if (props.selectableRows) {
      const emitSelection = () => emit('tab-rows-selected', { rows: tabInstance.getSelectedData() })
      tabInstance.on('rowSelected', emitSelection)
      tabInstance.on('rowDeselected', emitSelection)
    }

    // Sort-changed emit. Fires on every sort change (header click or a
    // programmatic setSort) and once after the table is built — so consumers
    // can render an initial sort label even when a saved initial-sort was
    // applied (or none, in which case sorters is []). Each sorter carries its
    // resolved column title so consumers don't have to reach into the instance
    // or duplicate the field→title lookup.
    // Build the current-sort payload (primary-first; see ordering note below)
    // and emit it. Also cache it on the host so consumers that wire up AFTER an
    // emit already fired (the toolbar sort label attaches via its own poll, and
    // can miss the build-time emit) can read the live state on attach.
    const sortPayload = () => {
      const out = tabInstance.getSorters().map((s) => {
        let title = s.field
        try { title = (s.column && s.column.getDefinition().title) || s.field } catch {}
        return { field: s.field, dir: s.dir, title }
      })
      // Tabulator applies/reports a multi-column sort with the LAST entry as the
      // PRIMARY (verified: setSort([Date,Dept]) groups by Dept). Reverse so the
      // payload lists the primary sort first, matching what the user sees.
      // Harmless for single-column.
      out.reverse()
      return out
    }
    const emitSorted = () => {
      const out = sortPayload()
      host._lastSorters = out
      emit('tab-sorted', { sorters: out })
    }
    tabInstance.on('dataSorted', emitSorted)
    tabReady.then(emitSorted)

    // Apply the saved initial-sort once the table is built. Passing data +
    // initialSort together in the constructor REGISTERS the sorters but does NOT
    // order the rows in this build (the claims grids get their rows at construct
    // time via data-attr:data) — so the grid showed source order with the sort
    // "set" but unapplied. setSort here actually orders the rows (and fires
    // dataSorted → emitSorted, refreshing the label). Pass a COPY: Tabulator
    // mutates the array (column string → live Column object, circular).
    if (sort.length) tabReady.then(() => { try { tabInstance.setSort(sort.map((s) => ({ ...s }))) } catch {} })

    // Data swap — preserves column state, sort, filters. Fires when $claimsData
    // changes after build (e.g. a new search). setData replaces the rows WITHOUT
    // re-running the active sort, so re-assert it afterward; empty getSorters()
    // (user cleared the sort) is a no-op so the server default is respected.
    // (The initial load is handled by the tabReady setSort above, since the
    // grid is built with its rows already in place.) addData (load-more) does
    // not route through here, so appended pages keep the active sort untouched.
    observeProps((p) => {
      const dataStr = p.data || ''
      if (dataStr === prevDataStr) return
      prevDataStr = dataStr
      tabReady.then(() => {
        try {
          const parsed = dataStr ? JSON.parse(dataStr) : []
          const res = tabInstance.setData(parsed)
          const reapply = () => {
            const s = tabInstance.getSorters()
            if (s.length) {
              try { tabInstance.setSort(s.map((x) => ({ column: x.field, dir: x.dir }))) } catch {}
            }
          }
          if (res && typeof res.then === 'function') res.then(reapply).catch(() => {})
          else reapply()
        } catch {}
      })
    }, 'data')

    // Column picker with drag-to-reorder
    let colPickerPanel = null
    let colPickerCleanup = null

    host._showColPicker = function (anchorEl) {
      if (!tabInstance) return

      if (colPickerPanel) {
        colPickerPanel.remove()
        colPickerPanel = null
        if (colPickerCleanup) colPickerCleanup()
        colPickerCleanup = null
        return
      }

      const allCols = tabInstance.getColumns().filter((c) => !!c.getField())
      const numCols = Math.max(1, Math.ceil(allCols.length / 30))

      const panel = document.createElement('div')
      colPickerPanel = panel
      panel.style.cssText =
        'position:fixed;z-index:1000;' +
        'background:var(--clr-surface,#fff);color:var(--clr-text,#333);' +
        'border:1px solid var(--clr-border,#ccc);' +
        'border-radius:4px;padding:6px 4px;max-height:750px;overflow-y:auto;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.25);font-size:12px;' +
        'column-count:' + numCols + ';column-gap:8px;min-width:' + (numCols * 180) + 'px;'

      let dragSrc = null

      const lockOrder = !!props.lockColumnOrder

      allCols.forEach((col) => {
        const def = col.getDefinition()
        const row = document.createElement('div')
        row.draggable = !lockOrder
        row.dataset.field = def.field
        row.style.cssText =
          'display:flex;align-items:center;gap:4px;padding:2px 4px;' +
          'cursor:pointer;border-radius:3px;white-space:nowrap;break-inside:avoid;'

        // Drag grip — omitted when column order is locked.
        if (!lockOrder) {
          const grip = document.createElement('span')
          grip.textContent = '⠇'
          grip.style.cssText = 'cursor:grab;opacity:.5;font-size:14px;user-select:none;color:var(--clr-text,#666);'
          row.appendChild(grip)
        }

        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.checked = col.isVisible()
        cb.style.cssText = 'margin:0;cursor:pointer;'
        cb.addEventListener('change', (e) => {
          e.stopPropagation()
          col.toggle()
          emitColumnState()
        })
        row.appendChild(cb)
        row.appendChild(document.createTextNode(' ' + (def.title || def.field)))

        row.addEventListener('mouseover', () => (row.style.background = 'var(--clr-bg,#f0f4ff)'))
        row.addEventListener('mouseout', () => (row.style.background = ''))

        if (!lockOrder) {
          row.addEventListener('dragstart', (e) => {
            dragSrc = row
            row.style.opacity = '.4'
            e.dataTransfer.effectAllowed = 'move'
          })
          row.addEventListener('dragend', () => {
            dragSrc = null
            row.style.opacity = ''
            panel.querySelectorAll('div').forEach((d) => (d.style.borderTop = ''))
          })
          row.addEventListener('dragover', (e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            if (dragSrc && row !== dragSrc) row.style.borderTop = '2px solid #4472c4'
          })
          row.addEventListener('dragleave', () => (row.style.borderTop = ''))
          row.addEventListener('drop', (e) => {
            e.preventDefault()
            row.style.borderTop = ''
            if (!dragSrc || dragSrc === row) return
            panel.insertBefore(dragSrc, row)
            tabInstance.moveColumn(dragSrc.dataset.field, row.dataset.field, true)
            emitColumnState()
          })
        }

        panel.appendChild(row)
      })

      const rect = anchorEl ? anchorEl.getBoundingClientRect() : host.getBoundingClientRect()
      document.body.appendChild(panel)
      const panelRect = panel.getBoundingClientRect()
      let top = rect.bottom + 4
      const maxTop = window.innerHeight - panelRect.height - 4
      if (top > maxTop) top = Math.max(4, maxTop)
      panel.style.top = top + 'px'
      panel.style.left = rect.left + 'px'

      function onDown(e) {
        if (!panel.contains(e.target) && e.target !== anchorEl) {
          panel.remove()
          colPickerPanel = null
          document.removeEventListener('mousedown', onDown)
          colPickerCleanup = null
        }
      }
      setTimeout(() => document.addEventListener('mousedown', onDown), 50)
      colPickerCleanup = () => document.removeEventListener('mousedown', onDown)
    }

    cleanup(() => {
      clearTimeout(colTimer)
      if (colPickerPanel) {
        colPickerPanel.remove()
        colPickerPanel = null
      }
      if (colPickerCleanup) {
        colPickerCleanup()
        colPickerCleanup = null
      }
      cellCleanups.forEach((fn) => {
        try { fn() } catch {}
      })
      cellCleanups.length = 0
      if (host._tabInstance) {
        try { host._tabInstance.destroy() } catch {}
        host._tabInstance = null
      }
    })
  },
})
