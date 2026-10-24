/**
 * Kinnect — Family Tree App
 * Loads people & relationships statically from data.json (read-only).
 * In-session edits stay in memory only; they are not written back to data.json.
 */

(() => {
  "use strict";

  // ---------- State ----------
  let people = [];
  let relationships = [];
  let selectedId = null;
  let focusId = null;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let panStart = { x: 0, y: 0, panX: 0, panY: 0 };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const el = {
    peopleList: $("#people-list"),
    peopleEmpty: $("#people-empty"),
    peopleCount: $("#people-count"),
    search: $("#search-people"),
    focusSelect: $("#focus-person"),
    detailTitle: $("#detail-title"),
    detailContent: $("#detail-content"),
    treeViewport: $("#tree-viewport"),
    treeCanvas: $("#tree-canvas"),
    treeSvg: $("#tree-svg"),
    treeEmpty: $("#tree-empty"),
    modalPerson: $("#modal-person"),
    modalRel: $("#modal-rel"),
    formPerson: $("#form-person"),
    formRel: $("#form-rel"),
    toast: $("#toast"),
    importFile: $("#import-file"),
    panelLeft: $("#panel-left"),
    panelRight: $("#panel-right"),
    drawerBackdrop: $("#drawer-backdrop"),
    btnTogglePeople: $("#btn-toggle-people"),
    btnToggleDetail: $("#btn-toggle-detail"),
    btnClosePeople: $("#btn-close-people"),
    btnCloseDetail: $("#btn-close-detail"),
  };

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function fullName(p) {
    return [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unnamed";
  }

  function initials(p) {
    const a = (p.firstName || "?").charAt(0);
    const b = (p.lastName || "").charAt(0);
    return (a + b).toUpperCase();
  }

  function formatDates(p) {
    const b = p.birth ? p.birth.slice(0, 4) : "?";
    const d = p.death ? p.death.slice(0, 4) : "";
    if (!p.birth && !p.death) return "";
    return d ? `${b} – ${d}` : `b. ${b}`;
  }

  function genderClass(g) {
    if (g === "female") return "female";
    if (g === "male") return "male";
    return "";
  }

  function toast(msg, ms = 2400) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    requestAnimationFrame(() => el.toast.classList.add("show"));
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.toast.classList.remove("show");
      setTimeout(() => (el.toast.hidden = true), 250);
    }, ms);
  }

  function applyData(data) {
    people = Array.isArray(data.people) ? data.people : [];
    relationships = Array.isArray(data.relationships) ? data.relationships : [];
    focusId = data.focusId || people[0]?.id || null;
  }

  function save() {}

  async function load() {
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      applyData(data);
    } catch (e) {
      console.warn("Could not load data.json", e);
      toast("Could not load data.json");
    }
  }
