/**
 * Bootstrap: load last known-good app.js until full file can be pushed.
 */
(async () => {
  const url = "https://cdn.jsdelivr.net/gh/jorobertmac/Kinnect@e8e654dca8f280502c5a6b7c3fe8a26c386b4eb3/app.js";
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const code = await res.text();
    const s = document.createElement("script");
    s.textContent = code;
    document.head.appendChild(s);
  } catch (e) {
    console.error("Failed to load Kinnect app.js", e);
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div style="padding:2rem;font-family:sans-serif;color:#f87171">Failed to load app.js. Please refresh.</div>'
    );
  }
})();
