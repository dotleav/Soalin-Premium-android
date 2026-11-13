// Notifikasi update. Logika ini SAMA di semua build; yang beda cuma blok CONFIG.
// Baca version.json dari repo, kalau versinya lebih baru tampilkan banner. Gagal = diam saja.

const SOALIN_UPDATE = {
  currentVersion: "1.6",   // = versionName (Android) / version (PC) build ini
  manifestUrl: "https://raw.githubusercontent.com/dotleav/soalin-premium-dist/main/version.json",     // isi: { "version": "1.7", "url": "...apk atau .exe" }
};

(function () {
  const SKIP_KEY = "soalin-update-skipped";
  const CHECK_DELAY_MS = 3000;

  function parseVersion(v) {
    return String(v).replace(/^v/i, "").split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  }

  function isNewer(latest, current) {
    const a = parseVersion(latest);
    const b = parseVersion(current);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return false;
  }

  async function fetchManifest() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(SOALIN_UPDATE.manifestUrl + "?_=" + Date.now(), {
        cache: "no-store",
        signal: ctrl.signal,
      });
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  const hasNativeInstaller = () =>
    !!(window.SoalinNative && typeof window.SoalinNative.installUpdate === "function");

  function styleButton(el, primary) {
    el.style.cssText =
      "padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.25);" +
      "background:" + (primary ? "#7c5cff" : "transparent") + ";color:#fff;" +
      "font:600 13px system-ui,sans-serif;cursor:pointer;text-decoration:none;";
    return el;
  }

  function showBanner(m) {
    const box = document.createElement("div");
    box.id = "soalinUpdateBanner";
    box.setAttribute("role", "status");
    box.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:99999;max-width:360px;" +
      "background:#1d1640;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:12px;" +
      "padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,.4);font:14px system-ui,sans-serif;";

    const title = document.createElement("div");
    title.style.cssText = "font-weight:700;margin-bottom:4px;";
    title.textContent = "Update tersedia";

    const text = document.createElement("div");
    text.style.cssText = "opacity:.85;margin-bottom:12px;line-height:1.4;";
    text.textContent = "Soalin v" + m.version + " sudah rilis. Mau diunduh sekarang?";

    const close = () => box.remove();

    // Android: unduh APK lalu langsung buka installer. PC: buka link di browser.
    const native = hasNativeInstaller();
    const primary = document.createElement(native ? "button" : "a");
    primary.textContent = native ? "Update sekarang" : "Unduh";
    if (native) {
      primary.type = "button";
      primary.addEventListener("click", () => {
        window.SoalinNative.installUpdate(m.url);
        close();
      });
    } else {
      primary.href = m.url; // tanpa target: wrapper PC/Android membukanya di browser luar
      primary.addEventListener("click", close);
    }
    styleButton(primary, true);

    const later = document.createElement("button");
    later.type = "button";
    later.textContent = "Nanti";
    styleButton(later, false);
    later.addEventListener("click", close);

    const skip = document.createElement("button");
    skip.type = "button";
    skip.textContent = "Lewati versi ini";
    styleButton(skip, false);
    skip.addEventListener("click", () => {
      try { localStorage.setItem(SKIP_KEY, String(m.version)); } catch (e) {}
      close();
    });

    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
    row.append(primary, later, skip);
    box.append(title, text, row);
    document.body.appendChild(box);
  }

  async function checkForUpdate() {
    const m = await fetchManifest();
    if (!m || !m.version || !m.url) return;
    if (!isNewer(m.version, SOALIN_UPDATE.currentVersion)) return;
    try {
      if (localStorage.getItem(SKIP_KEY) === String(m.version)) return;
    } catch (e) {}
    showBanner(m);
  }

  setTimeout(checkForUpdate, CHECK_DELAY_MS);
})();
