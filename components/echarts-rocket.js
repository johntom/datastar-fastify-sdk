// Rocket ECharts component — Datastar Pro v1.0.1 bundle (OSS core 1.0.2)
// Public contract preserved from the RC.7/8 template version:
//   tag:    <rocket-echarts>
//   props:  option, height, theme, resize-delay
//   emits:  chart-ready { chart }   (fires on every init: first + theme reinit)
//   element prop:
//           _chartInstance — live ECharts instance (null until init, replaced on
//                            theme change, nulled on disconnect)
//
// ECharts global is loaded per-page via a <script src> tag in views that use
// charts (grid-reports, grid-reports-wc). Not loaded in layout.njk because
// most pages don't need it.
//
// Codec choice: `option` uses the `js` codec — Datastar parses the JSON
// (and revives function strings) on the way in, so `props.option` is a live
// object, not a string. Matches the DS canonical example at
// https://data-star.dev/examples/rocket_echarts.

import { rocket } from '/public/js/datastar-pro.js'

// Resolve CSS variables like "var(--clr-primary)" against the host element's
// computed style. Applied recursively to nested arrays/objects.
function resolveVars(host, value) {
  if (Array.isArray(value)) return value.map((part) => resolveVars(host, part))
  if (value && typeof value === 'object') {
    const out = {}
    for (const k in value) {
      if (Object.prototype.hasOwnProperty.call(value, k)) {
        out[k] = resolveVars(host, value[k])
      }
    }
    return out
  }
  if (typeof value !== 'string' || value.indexOf('var(') < 0) return value
  return value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
    return getComputedStyle(host).getPropertyValue(name).trim() || 'var(' + name + ')'
  })
}

rocket('rocket-echarts', {
  mode: 'light',
  renderOnPropChange: false,

  props: ({ js, string, number }) => ({
    option: js,
    height: string.default('100%'),
    theme: string.default('default'),
    resizeDelay: number.min(0).default(100),
  }),

  render: ({ html }) =>
    html`<div data-rocket-ref="container" style="width:100%;min-height:200px;"></div>`,

  onFirstRender({ host, refs, props, cleanup, observeProps }) {
    if (!window.echarts) {
      console.error('[rocket-echarts] echarts global is not loaded')
      return
    }

    let chartInstance = null
    let resizeTimer = 0
    let ro = null

    function applyOption() {
      if (!chartInstance) return
      chartInstance.setOption(resolveVars(host, props.option ?? {}), true)
    }

    function scheduleResize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (chartInstance) chartInstance.resize()
      }, props.resizeDelay || 100)
    }

    function initChart() {
      const container = refs.container
      if (!container) return

      container.style.width = '100%'
      container.style.height = props.height || '100%'
      if (!container.style.minHeight) container.style.minHeight = '200px'

      if (chartInstance) chartInstance.dispose()
      const theme = props.theme || 'default'
      chartInstance = window.echarts.init(container, theme === 'default' ? undefined : theme)

      host._chartInstance = chartInstance
      host.dispatchEvent(
        new CustomEvent('chart-ready', { detail: { chart: chartInstance }, bubbles: false }),
      )

      applyOption()

      if (ro) ro.disconnect()
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(scheduleResize)
        ro.observe(container)
      }
    }

    const onWinResize = () => {
      if (chartInstance) chartInstance.resize()
    }

    window.addEventListener('resize', onWinResize)

    // ECharts measures the container at init() time. If the host is
    // display:none / 0×0 (e.g. <rocket-echarts data-show="$isChart"> before
    // the user picks the Charts tab), an eager init() bakes in a 0×0 size
    // and renders blank — the post-init ResizeObserver does not reliably
    // recover an instance born at zero size. So GATE the first init until
    // the container actually has a size, then init once and drop the gate.
    // Contract preserved: _chartInstance + 'chart-ready' still fire on init
    // (just when first visible), which is exactly when runChartReport's
    // withChart() poll/listener is waiting for them.
    let gateRO = null
    function tryInit() {
      if (chartInstance) return true
      const c = refs.container
      if (c && c.clientWidth > 0 && c.clientHeight > 0) {
        initChart()
        return true
      }
      return false
    }
    if (!tryInit()) {
      if (typeof ResizeObserver !== 'undefined' && refs.container) {
        gateRO = new ResizeObserver(() => {
          if (tryInit()) {
            gateRO.disconnect()
            gateRO = null
          }
        })
        gateRO.observe(refs.container)
      } else {
        // No ResizeObserver available — fall back to eager init (legacy).
        initChart()
      }
    }

    // ECharts can't change theme live — full re-init.
    observeProps(initChart, 'theme')
    // Option change → setOption(_, true) merges into existing chart.
    observeProps(applyOption, 'option')
    // Height change → resize container.
    observeProps(() => {
      if (!refs.container) return
      refs.container.style.height = props.height || '100%'
      if (chartInstance) chartInstance.resize()
    }, 'height')

    cleanup(() => {
      window.removeEventListener('resize', onWinResize)
      if (gateRO) {
        gateRO.disconnect()
        gateRO = null
      }
      if (ro) {
        ro.disconnect()
        ro = null
      }
      clearTimeout(resizeTimer)
      if (chartInstance) {
        chartInstance.dispose()
        chartInstance = null
      }
      host._chartInstance = null
    })
  },
})
