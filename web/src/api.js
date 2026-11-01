let memoryId = null;
export function clientId() {
  try {
    let id = localStorage.getItem('bluffcheck_client');
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) { id = crypto.randomUUID(); localStorage.setItem('bluffcheck_client', id); }
    return id;
  } catch {
    if (!memoryId) memoryId = crypto.randomUUID();
    return memoryId;
  }
}
export async function api(path, opts = {}) {
  const res = await fetch('/api' + path, { ...opts, headers: { 'content-type': 'application/json', 'x-client-id': clientId(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}
