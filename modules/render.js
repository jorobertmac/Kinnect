/** List, detail, and tree rendering */

import { state, el } from "./state.js";
import {
  $,
  fullName,
  initials,
  formatDates,
  genderClass,
  escapeHtml,
} from "./utils.js";
import { getRelationsFor, layoutTree } from "./tree.js";

/** Set by app.js to avoid circular imports */
let handlers = {
  onEditPerson: () => {},
  onAddRel: () => {},
  onFocusPerson: () => {},
  onDeletePerson: () => {},
};

export function setRenderHandlers(h) {
  handlers = { ...handlers, ...h };
}

export function applyTransform() {
  el.treeCanvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
  const btn = $("#btn-zoom-reset");
  if (btn) btn.textContent = Math.round(state.scale * 100) + "%";
}

export function renderPeopleList() {
  const q = (el.search.value || "").trim().toLowerCase();
  const filtered = state.people.filter((p) => {
    if (!q) return true;
    return fullName(p).toLowerCase().includes(q);
  });
  el.peopleCount.textContent = state.people.length;
  el.peopleEmpty.hidden = state.people.length > 0;
  el.peopleList.innerHTML = filtered
    .map((p) => {
      const selected = p.id === state.selectedId ? " selected" : "";
      return `
        <div class="person-card${selected}" data-id="${p.id}" role="listitem" tabindex="0">
          <div class="person-avatar ${genderClass(p.gender)}">${initials(p)}</div>
          <div class="person-info">
            <div class="person-name">${escapeHtml(fullName(p))}</div>
            <div class="person-meta">${escapeHtml(formatDates(p))}</div>
          </div>
        </div>`;
    })
    .join("");
  el.focusSelect.innerHTML =
    `<option value="">— Select person —</option>` +
    state.people
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === state.focusId ? "selected" : ""}>${escapeHtml(fullName(p))}</option>`
      )
      .join("");
}

export function renderDetail() {
  if (!state.selectedId) {
    el.detailTitle.textContent = "Details";
    el.detailContent.innerHTML = `<div class="empty-state"><p>Select a person to view and edit details, or create relationships.</p></div>`;
    return;
  }
  const p = state.people.find((x) => x.id === state.selectedId);
  if (!p) {
    state.selectedId = null;
    renderDetail();
    return;
  }
  el.detailTitle.textContent = "Person";
  const rels = getRelationsFor(p.id);
  el.detailContent.innerHTML = `
    <div class="detail-header">
      <div class="detail-avatar ${genderClass(p.gender)}">${initials(p)}</div>
      <div>
        <div class="detail-name">${escapeHtml(fullName(p))}</div>
        <div class="detail-meta">${escapeHtml(formatDates(p))}${p.gender ? " · " + p.gender : ""}</div>
      </div>
    </div>
    ${
      p.notes
        ? `<div class="detail-section"><h4>Notes</h4><div class="detail-notes">${escapeHtml(p.notes)}</div></div>`
        : ""
    }
    <div class="detail-section">
      <h4>Relationships (${rels.length})</h4>
      ${
        rels.length
          ? `<ul class="rel-list">${rels
              .map(
                (r) => `
            <li class="rel-item">
              <div>
                <div class="rel-label">${r.type}</div>
                <span class="rel-person" data-id="${r.person.id}">${escapeHtml(fullName(r.person))}</span>
              </div>
            </li>`
              )
              .join("")}</ul>`
          : `<p class="muted" style="font-size:0.85rem;color:var(--text-dim)">No relationships yet.</p>`
      }
    </div>
    <div class="detail-actions">
      <button type="button" class="btn btn-primary btn-sm" id="btn-add-rel">+ Relationship</button>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-edit-person">Edit</button>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-focus-this">Focus in tree</button>
      <button type="button" class="btn btn-danger btn-sm" id="btn-delete-person">Delete</button>
    </div>
  `;
  $("#btn-add-rel")?.addEventListener("click", () => handlers.onAddRel(p.id));
  $("#btn-edit-person")?.addEventListener("click", () => handlers.onEditPerson(p));
  $("#btn-focus-this")?.addEventListener("click", () => handlers.onFocusPerson(p.id));
  $("#btn-delete-person")?.addEventListener("click", () => handlers.onDeletePerson(p.id));
  el.detailContent.querySelectorAll(".rel-person").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedId = node.dataset.id;
      renderAll();
    });
  });
}

export function renderTree() {
  const root = state.focusId || (state.people.length ? state.people[0].id : null);
  const { nodes, links, NODE_W, NODE_H } = layoutTree(root);
  el.treeCanvas.querySelectorAll(".tree-node").forEach((n) => n.remove());
  if (!nodes.length) {
    el.treeEmpty.classList.remove("hidden");
    el.treeSvg.innerHTML = "";
    el.treeSvg.setAttribute("width", "0");
    el.treeSvg.setAttribute("height", "0");
    return;
  }
  el.treeEmpty.classList.add("hidden");
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  const pad = 80;
  const svgW = maxX - minX + pad * 2;
  const svgH = maxY - minY + pad * 2;
  const offsetX = -minX + pad;
  const offsetY = -minY + pad;
  el.treeSvg.setAttribute("width", svgW);
  el.treeSvg.setAttribute("height", svgH);
  el.treeSvg.style.width = svgW + "px";
  el.treeSvg.style.height = svgH + "px";
  let pathHtml = "";
  for (const L of links) {
    const x1 = L.from.x + NODE_W / 2 + offsetX;
    const y1 = L.from.y + NODE_H / 2 + offsetY;
    const x2 = L.to.x + NODE_W / 2 + offsetX;
    const y2 = L.to.y + NODE_H / 2 + offsetY;
    if (L.type === "spouse") {
      pathHtml += `<path class="link link-spouse" d="M${x1},${y1} L${x2},${y2}" />`;
    } else {
      const py = L.from.y + NODE_H + offsetY;
      const cy = L.to.y + offsetY;
      const midY = (py + cy) / 2;
      pathHtml += `<path class="link" d="M${x1},${py} C${x1},${midY} ${x2},${midY} ${x2},${cy}" />`;
    }
  }
  el.treeSvg.innerHTML = pathHtml;
  for (const n of nodes) {
    const p = n.person;
    const div = document.createElement("div");
    div.className = "tree-node" + (p.id === state.selectedId ? " selected" : "");
    div.dataset.id = p.id;
    div.style.left = n.x + offsetX + "px";
    div.style.top = n.y + offsetY + "px";
    div.innerHTML = `
      <div class="tn-avatar ${genderClass(p.gender)}">${initials(p)}</div>
      <div class="tn-name">${escapeHtml(fullName(p))}</div>
      <div class="tn-dates">${escapeHtml(formatDates(p))}</div>
    `;
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      state.selectedId = p.id;
      renderAll();
    });
    el.treeCanvas.appendChild(div);
  }
  el.treeCanvas.style.width = svgW + "px";
  el.treeCanvas.style.height = svgH + "px";
  applyTransform();
}

export function renderAll() {
  renderPeopleList();
  renderDetail();
  renderTree();
}
