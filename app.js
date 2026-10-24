/**
 * Kinnect — Family Tree App (entry)
 * Loads people & relationships from data.json (read-only seed).
 * In-session edits stay in memory only.
 */

import { state, el, bindElements, load, save } from "./modules/state.js";
import { $ } from "./modules/utils.js";
import {
  renderAll,
  renderPeopleList,
  applyTransform,
  setRenderHandlers,
} from "./modules/render.js";
import { initMobilePanels } from "./modules/mobile.js";
import {
  openPersonModal,
  closePersonModal,
  savePerson,
  deletePerson,
  openRelModal,
  closeRelModal,
  saveRel,
  exportData,
  importData,
} from "./modules/actions.js";

function initTheme() {
  const saved = localStorage.getItem("kinnect-theme");
  if (saved === "light") document.documentElement.setAttribute("data-theme", "light");
}

function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  if (next === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  localStorage.setItem("kinnect-theme", next === "light" ? "light" : "dark");
}

function setupPanZoom() {
  const vp = el.treeViewport;
  vp.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    state.isPanning = true;
    vp.classList.add("panning");
    state.panStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
  });
  window.addEventListener("mousemove", (e) => {
    if (!state.isPanning) return;
    state.panX = state.panStart.panX + (e.clientX - state.panStart.x);
    state.panY = state.panStart.panY + (e.clientY - state.panStart.y);
    applyTransform();
  });
  window.addEventListener("mouseup", () => {
    state.isPanning = false;
    vp.classList.remove("panning");
  });
  vp.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      state.scale = Math.min(2.5, Math.max(0.3, state.scale * delta));
      applyTransform();
    },
    { passive: false }
  );
}

function fitTree() {
  const canvas = el.treeCanvas;
  const vp = el.treeViewport;
  if (!canvas.offsetWidth || !vp.clientWidth) return;
  const sx = (vp.clientWidth - 40) / canvas.offsetWidth;
  const sy = (vp.clientHeight - 40) / canvas.offsetHeight;
  state.scale = Math.min(1.2, Math.max(0.3, Math.min(sx, sy)));
  state.panX = (vp.clientWidth - canvas.offsetWidth * state.scale) / 2;
  state.panY = (vp.clientHeight - canvas.offsetHeight * state.scale) / 2;
  applyTransform();
}

function bindEvents() {
  $("#btn-add-person")?.addEventListener("click", () => openPersonModal());
  $("#btn-theme")?.addEventListener("click", toggleTheme);
  $("#btn-export")?.addEventListener("click", exportData);
  $("#btn-import")?.addEventListener("click", () => el.importFile.click());
  el.importFile?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) importData(f);
    e.target.value = "";
  });
  el.formPerson?.addEventListener("submit", savePerson);
  ($("#btn-cancel-person") || $("#modal-person-cancel"))?.addEventListener(
    "click",
    closePersonModal
  );
  $("#modal-person-close")?.addEventListener("click", closePersonModal);
  el.formRel?.addEventListener("submit", saveRel);
  ($("#btn-cancel-rel") || $("#modal-rel-cancel"))?.addEventListener("click", closeRelModal);
  $("#modal-rel-close")?.addEventListener("click", closeRelModal);
  el.search?.addEventListener("input", () => renderPeopleList());
  el.peopleList?.addEventListener("click", (e) => {
    const card = e.target.closest(".person-card");
    if (card) {
      state.selectedId = card.dataset.id;
      renderAll();
    }
  });
  el.focusSelect?.addEventListener("change", () => {
    state.focusId = el.focusSelect.value || null;
    save();
    renderAll();
    requestAnimationFrame(() => setTimeout(fitTree, 50));
  });
  $("#btn-zoom-in")?.addEventListener("click", () => {
    state.scale = Math.min(2.5, state.scale * 1.15);
    applyTransform();
  });
  $("#btn-zoom-out")?.addEventListener("click", () => {
    state.scale = Math.max(0.3, state.scale / 1.15);
    applyTransform();
  });
  $("#btn-zoom-reset")?.addEventListener("click", () => {
    state.scale = 1;
    state.panX = 0;
    state.panY = 0;
    applyTransform();
  });
  $("#btn-fit")?.addEventListener("click", fitTree);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePersonModal();
      closeRelModal();
    }
  });
  setupPanZoom();
}

async function init() {
  bindElements();
  setRenderHandlers({
    onEditPerson: (p) => openPersonModal(p),
    onAddRel: (id) => openRelModal(id),
    onFocusPerson: (id) => {
      state.focusId = id;
      save();
      renderAll();
    },
    onDeletePerson: (id) => deletePerson(id),
  });
  initTheme();
  await load();
  if (!state.selectedId && state.people.length) {
    state.selectedId = state.focusId || state.people[0].id;
  }
  bindEvents();
  initMobilePanels();
  renderAll();
  requestAnimationFrame(() => setTimeout(fitTree, 50));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
