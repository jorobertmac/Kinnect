/** Pure helpers */

export function $(sel) {
  return document.querySelector(sel);
}

export function $$(sel) {
  return [...document.querySelectorAll(sel)];
}

export function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

export function fullName(p) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unnamed";
}

export function initials(p) {
  const a = (p.firstName || "?").charAt(0);
  const b = (p.lastName || "").charAt(0);
  return (a + b).toUpperCase();
}

export function formatDates(p) {
  const b = p.birth ? p.birth.slice(0, 4) : "?";
  const d = p.death ? p.death.slice(0, 4) : "";
  if (!p.birth && !p.death) return "";
  return d ? `${b} – ${d}` : `b. ${b}`;
}

export function genderClass(g) {
  if (g === "female") return "female";
  if (g === "male") return "male";
  return "";
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function toast(msg, ms = 2400) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => (el.hidden = true), 250);
  }, ms);
}
