// One writer owns a browser profile. Arena never touches storage or browser locks.
export function createProfileSession(options = {}) {
  const { preview = false, storage, locks = null, eventTarget = null,
    namespace = 'ichiProfileV2', lockless = false, leaseMs = 6000,
    settleMs = 40, now = () => Date.now(),
    schedule = (fn, ms) => setTimeout(fn, ms), cancel = id => clearTimeout(id),
    onStatus = () => {}, onAcquire = () => {}, onLost = () => {}, onError = () => {} } = options;
  const token = options.token || globalThis.crypto?.randomUUID?.() || `${now()}-${Math.random().toString(36).slice(2)}`;
  const hasLocks = typeof locks?.request === 'function';
  const leaseKey = `${namespace}:writerLease`, lockName = `${namespace}:writer`;
  const observed = new Map();
  let active = Boolean(preview || lockless), disposed = false, timer = null, unlock = null, pending = null, generation = 0;
  const notify = status => onStatus({ status, active, persistent: !preview, token });
  function fail(code, error) { onError({ code, error, message: code === 'conflict' ? 'Progress changed in another tab. Reopen the game.' : 'Could not save progress. Check that browser storage is available.' }); }
  function lose(reason) {
    const wasActive = active; active = false; observed.clear();
    if (timer !== null) { cancel(timer); timer = null; }
    if (unlock) { const done = unlock; unlock = null; done(); }
    if (wasActive) onLost({ reason });
    notify(reason);
  }
  function rawRead(key) { return storage.getItem(key); }
  function lease() { try { return JSON.parse(rawRead(leaseKey) || 'null'); } catch (error) { fail('storage', error); return null; } }
  function ownsLease() { const value = lease(); return value?.token === token && value.until > now(); }
  function canWrite() {
    if (disposed) return false;
    if (preview) return true;
    if (!active) return false;
    if (lockless || hasLocks || ownsLease()) return true;
    lose('other-tab'); return false;
  }
  function renew() {
    timer = null;
    if (!active || disposed) return;
    if (!ownsLease()) { lose('other-tab'); return; }
    try { storage.setItem(leaseKey, JSON.stringify({ token, until: now() + leaseMs })); }
    catch (error) { fail('storage', error); lose('storage-error'); return; }
    if (!ownsLease()) { lose('other-tab'); return; }
    timer = schedule(renew, Math.max(250, Math.floor(leaseMs / 3)));
  }
  function becameOwner() {
    if (disposed) return false;
    active = true; observed.clear(); notify('active');
    // This callback MUST reload the profile before the newly owned tab can play.
    onAcquire(); return true;
  }
  function read(key, fallback = null) {
    if (preview) return fallback;
    try { const value = rawRead(key); observed.set(key, value); return value === null ? fallback : value; }
    catch (error) { fail('storage', error); return fallback; }
  }
  function write(key, value) {
    if (preview) return true;
    if (!canWrite()) { notify('other-tab'); return false; }
    try {
      const latest = rawRead(key);
      if (observed.has(key) && observed.get(key) !== latest) {
        fail('conflict'); lose('conflict'); return false;
      }
      // A resumed background tab must verify its lease immediately before writing.
      if (!canWrite()) return false;
      const text = String(value); storage.setItem(key, text); observed.set(key, text); return true;
    } catch (error) { fail('storage', error); return false; }
  }
  function update(key, change, fallback = null) {
    if (preview) return { ok: true, value: change(fallback) };
    if (!canWrite()) return { ok: false, value: null };
    const previous = read(key, fallback), next = change(previous);
    if (next === undefined) return { ok: false, value: previous };
    return { ok: write(key, next), value: next };
  }
  function release() {
    generation++;
    if (timer !== null) { cancel(timer); timer = null; }
    if (!preview && !lockless && !hasLocks) {
      try { if (lease()?.token === token) storage.setItem(leaseKey, JSON.stringify({ token: '', until: 0 })); }
      catch (error) { fail('storage', error); }
    }
    if (unlock) { const done = unlock; unlock = null; done(); }
    lose('released');
  }
  async function acquire() {
    if (disposed) return false;
    if (preview || lockless) { becameOwner(); return true; }
    if (canWrite()) return true;
    if (pending) return pending;
    const attempt = generation;
    if (hasLocks) {
      pending = new Promise(resolve => {
        Promise.resolve(locks.request(lockName, { ifAvailable: true }, async lock => {
          if (!lock || disposed || attempt !== generation) { notify('other-tab'); resolve(false); return; }
          const held = new Promise(done => { unlock = done; });
          becameOwner(); resolve(true); await held;
        })).catch(error => { fail('lock', error); lose('lock-error'); resolve(false); });
      });
    } else {
      pending = (async () => {
        try {
          const current = lease();
          if (current && current.token !== token && current.until > now()) { notify('other-tab'); return false; }
          storage.setItem(leaseKey, JSON.stringify({ token, until: now() + leaseMs }));
          // Contending claims settle before either tab is allowed to save.
          await new Promise(resolve => schedule(resolve, settleMs));
          if (disposed || attempt !== generation || !ownsLease()) { notify('other-tab'); return false; }
          becameOwner(); timer = schedule(renew, Math.max(250, Math.floor(leaseMs / 3))); return true;
        } catch (error) { fail('storage', error); notify('storage-error'); return false; }
      })();
    }
    try { return await pending; } finally { pending = null; }
  }
  function onStorage(event) { if (!hasLocks && active && event.key === leaseKey && !ownsLease()) lose('other-tab'); }
  function onPageHide() { release(); }
  function onPageShow() { if (!disposed) acquire(); }
  if (!preview) {
    eventTarget?.addEventListener?.('storage', onStorage);
    eventTarget?.addEventListener?.('pagehide', onPageHide);
    eventTarget?.addEventListener?.('pageshow', onPageShow);
  }
  return { acquire, canWrite, read, write, update, release,
    get active() { return canWrite(); }, get preview() { return preview; },
    destroy() { release(); disposed = true;
      eventTarget?.removeEventListener?.('storage', onStorage);
      eventTarget?.removeEventListener?.('pagehide', onPageHide);
      eventTarget?.removeEventListener?.('pageshow', onPageShow);
    } };
}
