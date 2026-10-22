// Minimal stand-in for the Claude-artifact window.storage API, backed by
// this browser's own localStorage so the app works fully offline/standalone.
(function () {
  function prefixFor(shared) { return shared ? "soft75:shared:" : "soft75:local:"; }
  window.storage = {
    async get(key, shared) {
      try { const raw = localStorage.getItem(prefixFor(shared) + key); if (raw === null) return null; return { key, value: raw, shared: !!shared }; } catch (e) { return null; }
    },
    async set(key, value, shared) {
      try { localStorage.setItem(prefixFor(shared) + key, value); return { key, value, shared: !!shared }; } catch (e) { return null; }
    },
    async delete(key, shared) {
      try { localStorage.removeItem(prefixFor(shared) + key); return { key, deleted: true, shared: !!shared }; } catch (e) { return null; }
    },
    async list(prefix, shared) {
      try {
        const base = prefixFor(shared); const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(base)) { const short = k.slice(base.length); if (!prefix || short.startsWith(prefix)) keys.push(short); }
        }
        return { keys, prefix, shared: !!shared };
      } catch (e) { return null; }
    },
  };
})();
