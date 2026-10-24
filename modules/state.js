/** Shared mutable app state and DOM refs */

import { $, toast } from "./utils.js";

export const state = {
  people: [],
  relationships: [],
  selectedId: null,
  focusId: null,
  scale: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  panStart: { x: 0, y: 0, panX: 0, panY: 0 },
};

export const el = {
  peopleList: null,
  peopleEmpty: null,
  peopleCount: null,
  search: null,
  focusSelect: null,
  detailTitle: null,
  detailContent: null,
  treeViewport: null,
  treeCanvas: null,
  treeSvg: null,
  treeEmpty: null,
  modalPerson: null,
  modalRel: null,
  formPerson: null,
  formRel: null,
  toast: null,
  importFile: null,
};

export function bindElements() {
  el.peopleList = $("#people-list");
  el.peopleEmpty = $("#people-empty");
  el.peopleCount = $("#people-count");
  el.search = $("#search-people");
  el.focusSelect = $("#focus-person");
  el.detailTitle = $("#detail-title");
  el.detailContent = $("#detail-content");
  el.treeViewport = $("#tree-viewport");
  el.treeCanvas = $("#tree-canvas");
  el.treeSvg = $("#tree-svg");
  el.treeEmpty = $("#tree-empty");
  el.modalPerson = $("#modal-person");
  el.modalRel = $("#modal-rel");
  el.formPerson = $("#form-person");
  el.formRel = $("#form-rel");
  el.toast = $("#toast");
  el.importFile = $("#import-file");
}

export function applyData(data) {
  state.people = Array.isArray(data.people) ? data.people : [];
  state.relationships = Array.isArray(data.relationships) ? data.relationships : [];
  state.focusId = data.focusId || state.people[0]?.id || null;
}

export function save() {
  /* session-only; no persistence to data.json */
}

export async function load() {
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
