// Real wall-clock frame telemetry. Simulation clamping belongs to the caller.
export function createFrameTelemetry({ capacity = 600, stallMs = 50 } = {}) {
  capacity = Math.max(30, Math.min(3600, Math.floor(capacity) || 600));
  const frames = new Float64Array(capacity);
  let count = 0, cursor = 0, previous = null, latest = {};
  function sample(timestamp, info = {}) {
    const ms = Number(timestamp);
    if (!Number.isFinite(ms)) return;
    if (previous !== null && ms > previous) { frames[cursor] = ms - previous; cursor = (cursor + 1) % capacity; count = Math.min(count + 1, capacity); }
    previous = ms;
    const render = info.render || info;
    latest = { drawCalls: Number(render.calls) || 0, triangles: Number(render.triangles) || 0,
      geometries: Number(info.memory?.geometries) || 0, textures: Number(info.memory?.textures) || 0,
      programs: Array.isArray(info.programs) ? info.programs.length : 0 };
  }
  function summary() {
    const sorted = Array.from(frames.subarray(0, count)).sort((a, b) => a - b);
    const percentile = p => count ? sorted[Math.max(0, Math.ceil(count * p) - 1)] : 0;
    const elapsed = sorted.reduce((a, b) => a + b, 0);
    return { samples: count, capacity, fps: elapsed ? 1000 * count / elapsed : 0,
      p50: percentile(.5), p95: percentile(.95), p99: percentile(.99),
      maxMs: count ? sorted[count - 1] : 0, stalls: sorted.filter(value => value > stallMs).length,
      windowMs: elapsed, ...latest };
  }
  return { sample, summary, exportJSON: () => JSON.stringify({ version: 1, ...summary() }, null, 2),
    reset() { count = 0; cursor = 0; previous = null; latest = {}; frames.fill(0); } };
}

export function qualityPixelRatio(deviceRatio = 1, lowQuality = false, currentRatio = Infinity) {
  const requested = Number(deviceRatio), device = Number.isFinite(requested) && requested > 0 ? requested : 1;
  const cap = Math.min(device, lowQuality ? 1 : 1.5);
  const current = Number(currentRatio);
  return lowQuality ? Math.min(cap, Number.isFinite(current) && current > 0 ? current : cap) : cap;
}

// Restoration deliberately remains paused until the player chooses Continue.
export function createContextRecovery(canvas, { onLost = () => {}, onRestored = () => {} } = {}) {
  let lost = false;
  function lose(event) { event.preventDefault?.(); lost = true; onLost(); }
  function restore() { if (!lost) return; lost = false; onRestored(); }
  canvas.addEventListener('webglcontextlost', lose);
  canvas.addEventListener('webglcontextrestored', restore);
  return { get lost() { return lost; }, destroy() {
    canvas.removeEventListener?.('webglcontextlost', lose);
    canvas.removeEventListener?.('webglcontextrestored', restore);
  } };
}
