import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  adapterLabel,
  gpuAtRisk,
  gpuBudgetEnforced,
  gpuDestroyAllowed,
  gpuPowerFromSearch,
  outOfGpuBudget,
  underErrorScopes,
} from './context'

describe('gpuPowerFromSearch', () => {
  it('asks for the discrete GPU by default', () => {
    // The signal path is heavy enough that the integrated chip a hybrid laptop
    // hands out by default was costing 3x the frame time, so the default has to
    // be the fast one — an unset param must never mean "whatever the browser
    // felt like".
    expect(gpuPowerFromSearch('')).toBe('high-performance')
    expect(gpuPowerFromSearch('?preset=vhs')).toBe('high-performance')
  })

  it('sends the session to the integrated chip on request', () => {
    expect(gpuPowerFromSearch('?gpu=low-power')).toBe('low-power')
    expect(gpuPowerFromSearch('?preset=vhs&gpu=low-power')).toBe('low-power')
  })

  it('treats anything it does not recognise as the default', () => {
    // A typo must not silently strand the session on the slow GPU — that reads
    // as the app having got slower for no reason.
    expect(gpuPowerFromSearch('?gpu=integrated')).toBe('high-performance')
    expect(gpuPowerFromSearch('?gpu=')).toBe('high-performance')
    expect(gpuPowerFromSearch('?gpu=LOW-POWER')).toBe('high-performance')
  })
})

describe('gpuDestroyAllowed', () => {
  it('never destroys a device unless the URL insists', () => {
    // The load-bearing default in this file. Destroying a device that has been
    // presenting was measured to end the tab's rendering step, permanently and
    // across reloads (scripts/devicetear.mjs), so the app lets go of devices
    // instead — and the only way back to the old behaviour is deliberate.
    expect(gpuDestroyAllowed('')).toBe(false)
    expect(gpuDestroyAllowed('?set=fbMix:0.3')).toBe(false)
    expect(gpuDestroyAllowed('?gpudestroy=0')).toBe(false)
    expect(gpuDestroyAllowed('?gpudestroy=true')).toBe(false)
    expect(gpuDestroyAllowed('?gpudestroy=1')).toBe(true)
  })
})

// Two clocks, so the fixture sets two things. Devices built by *this document*
// live on `globalThis` and die with the document; devices created and destroyed by
// the *tab* live in `sessionStorage` and cross a reload. Keeping them separate here
// is the point of the suite below: almost every case is one of them moving while
// the other stays put.
function pageHavingBuilt(builds: number) {
  vi.stubGlobal('ntscGpuBuilds', builds)
}

function tabHavingSpent(sessions: number, releases = 0) {
  const cells = new Map([
    ['ntsc.gpuSessions', String(sessions)],
    ['ntsc.gpuReleases', String(releases)],
  ])
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => cells.get(k) ?? null,
    setItem: (k: string, v: string) => cells.set(k, v),
  })
}

// A tab that has been refreshed `loads` times and is healthy: every load made one
// device and left it behind with its document, so the tab's total is high and the
// live document has built exactly one. The shape the old tab-scoped count read as
// danger, and the shape 0004 measured as fine eight loads deep.
function tabRefreshed(loads: number) {
  tabHavingSpent(loads)
  pageHavingBuilt(1)
}

describe('outOfGpuBudget', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('never refuses a device for the number this page has created', () => {
    // Creating devices was measured to be cheap — four created, and four held
    // open presenting, cost a tab nothing — so no count of them ends a session.
    // This is the regression that matters most here: the gate exists to prevent a
    // dead tab, and a gate that blocks recovery on a healthy browser is doing the
    // damage it was written to avoid. There used to be a ceiling of eight, and the
    // sessions that reached it were the long ones whose card suspends on every
    // alt-tab — each of those rebuilds worked.
    pageHavingBuilt(0)
    expect(outOfGpuBudget('')).toBe(false)
    pageHavingBuilt(3)
    expect(outOfGpuBudget('')).toBe(false)
    pageHavingBuilt(8)
    expect(outOfGpuBudget('')).toBe(false)
    pageHavingBuilt(40)
    expect(outOfGpuBudget('')).toBe(false)
  })

  it('never refuses a device because the tab has been refreshed', () => {
    // Every one of these loads is a fresh document holding one device, with the
    // tab's running total behind it; 0004 reloads the real app eight times in one
    // tab at 69-81 rAF/1.5s, so a refuse here would be the app breaking a session
    // that measurement says is healthy.
    tabRefreshed(8)
    expect(outOfGpuBudget('')).toBe(false)
    tabRefreshed(24)
    expect(outOfGpuBudget('')).toBe(false)
  })

  it('stops a tab that has destroyed a device, however few it has made', () => {
    // One destroy of a presenting device was enough, and the next document in
    // that tab inherits the damage — so the count that gates is this one, not the
    // number of devices in existence. Note the fresh page: this is the only way a
    // first load in an already-spent tab can be refused, and it has to be, because
    // the damage is the one thing here that crosses a reload.
    tabHavingSpent(1, 1)
    pageHavingBuilt(0)
    expect(outOfGpuBudget('')).toBe(true)
  })

  it('counts without enforcing under ?gpubudget=ignore', () => {
    // Two callers need the escape hatch: a browser with no such fault should not
    // be told it is out of something it has plenty of, and the repro harnesses
    // exist to drive a tab past this on purpose.
    tabHavingSpent(13, 3)
    pageHavingBuilt(13)
    expect(outOfGpuBudget('?gpubudget=ignore')).toBe(false)
    expect(gpuBudgetEnforced('?gpubudget=ignore')).toBe(false)
    expect(gpuBudgetEnforced('?set=fbMix:0.3')).toBe(true)
    // Anything but the one word means enforce: a typo must not silently disable
    // the gate, since the failure it prevents is a tab that cannot be recovered.
    expect(outOfGpuBudget('?gpubudget=off')).toBe(true)
  })

  it('never reads a storage-less context as out of budget', () => {
    // Private modes switch sessionStorage off. Losing the counts has to mean
    // "carry on", never "refuse to start": they inform advice, and must not
    // become the reason a session cannot begin.
    expect(outOfGpuBudget('')).toBe(false)
    expect(gpuAtRisk()).toBe(false)
  })
})

describe('gpuAtRisk', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stays quiet through a normal session', () => {
    // A boot, and a boot plus one rebuild. Neither is worth a notice on the
    // stage; crying wolf here would teach the user to ignore the one case that
    // matters.
    tabHavingSpent(1)
    pageHavingBuilt(1)
    expect(gpuAtRisk()).toBe(false)
    pageHavingBuilt(2)
    expect(gpuAtRisk()).toBe(false)
  })

  it('stays quiet however many times the tab has been refreshed', () => {
    // What the notice was doing wrong. Reloading is not rebuilding: each of these
    // loads made one device and left it behind with its document, so there is one
    // device in existence and nothing to warn about — and the banner that fired
    // here said "this tab keeps rebuilding its GPU engine" to someone who had
    // pressed refresh three times and was watching a working picture.
    tabRefreshed(3)
    expect(gpuAtRisk()).toBe(false)
    tabRefreshed(20)
    expect(gpuAtRisk()).toBe(false)
  })

  it('speaks up on repeated rebuilds, and on any destroyed device', () => {
    // The soft signal: something is replacing engines over and over *within one
    // document*, which is where tabs get spent even though no single device is the
    // problem. The tab total sits at one, so this cannot be a refresh.
    tabHavingSpent(1)
    pageHavingBuilt(3)
    expect(gpuAtRisk()).toBe(true)
    // The hard one, at the first occurrence and regardless of the other count —
    // and on a document that has built nothing, because this is the signal that
    // survives the reload that cleared the other one.
    tabHavingSpent(1, 1)
    pageHavingBuilt(0)
    expect(gpuAtRisk()).toBe(true)
  })
})

// The error scope stack as a device keeps it, with the errors that `raise`
// files into whichever scope of that kind is innermost.
function scopedDevice() {
  const stack: { filter: GPUErrorFilter; error: GPUError | null }[] = []
  return {
    depth: () => stack.length,
    raise: (filter: GPUErrorFilter, message: string) => {
      const scope = stack.findLast(s => s.filter === filter)
      if (scope !== undefined) scope.error = { message }
    },
    device: {
      pushErrorScope: (filter: GPUErrorFilter) =>
        void stack.push({ filter, error: null }),
      popErrorScope: async () => {
        const scope = stack.pop()
        if (scope === undefined) throw new Error('error scope stack is empty')
        return scope.error
      },
    },
  }
}

describe('underErrorScopes', () => {
  it('reports an internal error as well as a validation one', async () => {
    const d = scopedDevice()
    const internal = await underErrorScopes(d.device, () => {
      d.raise('internal', 'shader failed to compile in the backend')
      return 1
    })
    expect(internal.error?.message).toBe(
      'shader failed to compile in the backend',
    )
    const validation = await underErrorScopes(d.device, () => {
      d.raise('validation', 'bad bind group')
      return 2
    })
    expect(validation).toEqual({
      built: 2,
      error: { message: 'bad bind group' },
    })
    expect(d.depth()).toBe(0)
  })

  it('leaves no scope open for the first frames to raise into', async () => {
    const d = scopedDevice()
    const scoped = underErrorScopes(d.device, () => 3)
    expect(d.depth()).toBe(0)
    d.raise('validation', 'first frame')
    expect(await scoped).toEqual({ built: 3, error: null })
  })

  it('takes both scopes off a device when construction throws', async () => {
    const d = scopedDevice()
    await expect(
      underErrorScopes(d.device, () => {
        throw new Error('constructor threw')
      }),
    ).rejects.toThrow('constructor threw')
    expect(d.depth()).toBe(0)
  })
})

describe('adapterLabel', () => {
  const info = {
    vendor: 'nvidia',
    architecture: 'ampere',
    device: '0x2206',
    description: 'NVIDIA GeForce RTX 3080',
  }

  it('names the GPU a session ran on', () => {
    // The gpuSession trace line carries this, so a frozen session's black box
    // says which GPU it froze on.
    expect(adapterLabel(info)).toBe(
      'vendor=nvidia arch=ampere device=0x2206 desc=NVIDIA GeForce RTX 3080',
    )
  })

  it('leaves out what the browser withholds', () => {
    expect(adapterLabel({ ...info, device: '', description: '' })).toBe(
      'vendor=nvidia arch=ampere',
    )
    expect(
      adapterLabel({
        vendor: '',
        architecture: '',
        device: '',
        description: '',
      }),
    ).toBe('adapter unnamed')
  })

  it('keeps to one trace line and its fields', () => {
    const label = adapterLabel({
      ...info,
      description: `a|b\nc${'x'.repeat(400)}`,
    })
    expect(label).not.toMatch(/[|\n]/)
    expect(label).toContain('desc=a/b/c')
    expect(label.length).toBeLessThanOrEqual(160)
  })
})
