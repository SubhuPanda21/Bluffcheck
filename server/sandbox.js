// Isolated execution of untrusted JavaScript using QuickJS compiled to WebAssembly.
// The guest has no access to Node, the file system, the network or the host process.
// Infinite loops are stopped by an interrupt handler; memory and stack are capped.
import { getQuickJS } from 'quickjs-emscripten';

let QJS = null;
export async function initSandbox() {
  if (!QJS) QJS = await getQuickJS();
  return { build };
}

const PRELUDE = `
globalThis.__enc = function __enc(v) {
  if (v === undefined) return { $: 'u' };
  if (typeof v === 'number') {
    if (v !== v) return { $: 'nan' };
    if (v === Infinity) return { $: 'inf' };
    if (v === -Infinity) return { $: '-inf' };
    if (Object.is(v, -0)) return { $: '-0' };
    return v;
  }
  if (typeof v === 'bigint') return { $: 'big', s: String(v) };
  if (typeof v === 'function' || typeof v === 'symbol') return { $: 'fn' };
  if (Array.isArray(v)) return v.map(__enc);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = __enc(v[k]); return o; }
  return v;
};
`;

const SPECIAL = { u: undefined, nan: NaN, inf: Infinity, '-inf': -Infinity, '-0': -0 };
export function dec(v) {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') {
    if (typeof v.$ === 'string' && Object.keys(v).length <= 2) {
      if (v.$ in SPECIAL) return SPECIAL[v.$];
      if (v.$ === 'big') return BigInt(v.s);
      if (v.$ === 'fn') return '[function]';
    }
    const o = {};
    for (const k of Object.keys(v)) o[k] = dec(v[k]);
    return o;
  }
  return v;
}

function build(code, name) {
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error('Invalid function name');
  const rt = QJS.newRuntime();
  rt.setMemoryLimit(48 * 1024 * 1024);
  rt.setMaxStackSize(256 * 1024);
  let deadline = Infinity;
  rt.setInterruptHandler(() => Date.now() > deadline);
  const ctx = rt.newContext();

  const ev = (src, ms) => {
    deadline = Date.now() + ms;
    const r = ctx.evalCode(src, 'sandbox.js');
    if (r.error) {
      const e = ctx.dump(r.error); r.error.dispose();
      return { ok: false, error: (e && e.message) || String(e), interrupted: !!(e && e.message === 'interrupted') };
    }
    const v = ctx.dump(r.value); r.value.dispose();
    return { ok: true, v };
  };

  let r = ev(PRELUDE, 1000);
  if (!r.ok) { ctx.dispose(); rt.dispose(); throw new Error('Sandbox failed to start: ' + r.error); }
  r = ev(code, 1500);
  if (!r.ok) { ctx.dispose(); rt.dispose(); throw new Error('Your code failed to load: ' + r.error); }
  r = ev(`globalThis.__f = (typeof ${name} === 'function') ? ${name} : undefined; typeof __f`, 500);
  const hasFn = r.ok && r.v === 'function';
  ev(`
    globalThis.__call = function (json) {
      const a = JSON.parse(json);
      try {
        const v = __f.apply(null, a);
        return JSON.stringify({ ok: true, value: __enc(v), args: __enc(a) });
      } catch (e) {
        return JSON.stringify({ ok: false, error: String((e && e.message) || e) });
      }
    };
    globalThis.__time = function (json, reps, clone) {
      const a0 = JSON.parse(json);
      const t0 = Date.now();
      for (let i = 0; i < reps; i++) __f.apply(null, clone ? JSON.parse(json) : a0);
      return Date.now() - t0;
    };
  `, 500);

  return {
    hasFn,
    call(args, ms = 400) {
      const out = ev(`__call(${JSON.stringify(JSON.stringify(args))})`, ms);
      if (!out.ok) return { ok: false, error: out.interrupted ? 'LOOP_LIMIT' : out.error, args };
      const p = JSON.parse(out.v);
      if (!p.ok) return { ok: false, error: p.error, args };
      return { ok: true, value: dec(p.value), args: dec(p.args) };
    },
    // Wall time in ms for `reps` calls. null means the guest was interrupted (too slow).
    time(args, reps, clone, ms = 8000) {
      const out = ev(`__time(${JSON.stringify(JSON.stringify(args))}, ${reps}, ${clone ? 'true' : 'false'})`, ms);
      if (!out.ok) { if (out.interrupted) return null; throw new Error(out.error); }
      return out.v;
    },
    dispose() { try { ctx.dispose(); rt.dispose(); } catch { /* already disposed */ } },
  };
}
