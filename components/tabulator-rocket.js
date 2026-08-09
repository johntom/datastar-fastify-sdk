// Rocket Tabulator component — Datastar Pro v1.0.1 bundle (OSS core 1.0.2)
// Public contract preserved from the RC.7/8 template version:
//   tag:       <rocket-tabulator>
//   props:     columns, data, height, layout, placeholder,
//              movable-columns, resizable-columns, enable-row-click,
//              selectable-rows, initial-sort, initial-filters, row-index
//   emits:     tab-row-click   { row }
//              tab-columns-changed { columns: [{field, visible, width}] }   (debounced 600ms)
//              tab-rows-selected   { rows }   (only when selectable-rows is set)
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
  const v = cell.getValue() || ''
  const div = document.createElement('div')
  div.style.cssText =
    'white-space:pre-wrap;word-break:break-word;' +
    'max-height:3.6em;overflow:hidden;line-height:1.2em;cursor:pointer;'
  div.textContent = v
  if (v.length > 120 || v.indexOf('\n') !== -1) {
    div.title = 'Click to view full note'
  }
  div.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!v) return
    const old = document.getElementById('_notes-popup')
    if (old) old.remove()
    const overlay = document.createElement('div')
    overlay.id = '_notes-popup'
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10000;' +
      'background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;'
    const box = document.createElement('div')
    box.style.cssText =
      'background:var(--clr-surface,#fff);color:var(--clr-text,#222);' +
      'border:1px solid var(--clr-border,#ccc);border-radius:6px;padding:12px 16px;' +
      'max-width:720px;max-height:70vh;overflow-y:auto;white-space:pre-wrap;' +
      'word-break:break-word;font-size:13px;line-height:1.5;box-shadow:0 4px 24px rgba(0,0,0,.3);min-width:320px;'
    box.textContent = v
    overlay.appendChild(box)
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) overlay.remove()
    })
    document.body.appendChild(overlay)
  })
  return div
}

function notesWrapTooltip(_e, cell) {
  const v = cell.getValue() || ''
  return v.length > 200 ? v.substring(0, 200) + '…' : v
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

// Resolve string formatter/headerFilter placeholders to actual functions
function resolveColumnHelpers(cols, checklistFilter) {
  cols.forEach((c) => {
    if (c.headerFilter === 'checklistFilter') c.headerFilter = checklistFilter
    if (c.formatter === 'isoDate') c.formatter = isoDateFormatter
    if (c.formatter === 'notesWrap') {
      c.formatter = notesWrapFormatter
      c.tooltip = notesWrapTooltip
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
    initialSort: string.default(''),
    initialFilters: string.default(''),
    rowIndex: string.default(''),
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
    if (sort.length) config.initialSort = sort

    if (props.selectableRows) {
      config.selectableRows = 'highlight'
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

    if (props.enableRowClick) {
      const prevFormatter = config.rowFormatter
      config.rowFormatter = (row) => {
        if (prevFormatter) {
          try { prevFormatter(row) } catch {}
        }
        row.getElement().style.cursor = 'pointer'
      }
    }

    const tabInstance = new window.Tabulator(refs.tableEl, config)
    host._tabInstance = tabInstance

    if (props.enableRowClick) {
      tabInstance.on('rowClick', (e, row) => {
        if (e.target.closest('.tabulator-row-header')) return
        emit('tab-row-click', { row: row.getData() })
      })
    }

    const tabReady = new Promise((resolve) => tabInstance.on('tableBuilt', resolve))
    let prevDataStr = props.data || ''

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

    // Data swap — preserves column state, sort, filters
    observeProps((p) => {
      const dataStr = p.data || ''
      if (dataStr === prevDataStr) return
      prevDataStr = dataStr
      tabReady.then(() => {
        try {
          const parsed = dataStr ? JSON.parse(dataStr) : []
          tabInstance.setData(parsed)
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

      allCols.forEach((col) => {
        const def = col.getDefinition()
        const row = document.createElement('div')
        row.draggable = true
        row.dataset.field = def.field
        row.style.cssText =
          'display:flex;align-items:center;gap:4px;padding:2px 4px;' +
          'cursor:pointer;border-radius:3px;white-space:nowrap;break-inside:avoid;'

        const grip = document.createElement('span')
        grip.textContent = '⠇'
        grip.style.cssText = 'cursor:grab;opacity:.5;font-size:14px;user-select:none;color:var(--clr-text,#666);'
        row.appendChild(grip)

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
