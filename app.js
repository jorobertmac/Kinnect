/**
 * Kinnect — Family Tree App
 * Loads people & relationships statically from data.json (read-only).
 * In-session edits stay in memory only; they are not written back to data.json.
 */

(() => {
  "use strict";

  // ---------- State ----------
  let people = []; // { id, firstName, lastName, birth, death, gender, notes }
  let relationships = []; // { id, fromId, toId, type }  type: parent|child|spouse|partner
  // Normalized: we store parent → child as type "parent", spouse as bidirectional pair conceptually
  let selectedId = null;
  let focusId = null;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let panStart = { x: 0, y: 0, panX: 0, panY: 0 };

  // ---------- DOM ----------
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
  };

  // ---------- Utils ----------
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

  // ---------- Data (static load from data.json) ----------
  function applyData(data) {
    people = Array.isArray(data.people) ? data.people : [];
    relationships = Array.isArray(data.relationships) ? data.relationships : [];
    focusId = data.focusId || people[0]?.id || null;
  }

  // No-op: data.json is read-only; session changes stay in memory only.
  function save() {}

  async function load() {
    try {
      const res = await fetch("data.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      applyData(data);
    } catch (e) {
      console.warn("Could not load data.json — serve this folder over HTTP (e.g. python -m http.server)", e);
      toast("Could not load data.json");
    }
  }

  // ---------- Relationship helpers ----------
  /** Returns normalized parent→child edges and spouse pairs */
  function getGraph() {
    const parents = new Map(); // childId -> [parentIds]
    const children = new Map(); // parentId -> [childIds]
    const spouses = new Map(); // id -> [spouseIds]

    const ensure = (m, k) => {
      if (!m.has(k)) m.set(k, []);
      return m.get(k);
    };

    for (const r of relationships) {
      if (r.type === "parent") {
        ensure(children, r.fromId).push(r.toId);
        ensure(parents, r.toId).push(r.fromId);
      } else if (r.type === "child") {
        // from is child of to → to is parent of from
        ensure(children, r.toId).push(r.fromId);
        ensure(parents, r.fromId).push(r.toId);
      } else if (r.type === "spouse" || r.type === "partner") {
        ensure(spouses, r.fromId).push(r.toId);
        ensure(spouses, r.toId).push(r.fromId);
      }
    }

    // dedupe
    for (const m of [parents, children, spouses]) {
      for (const [k, arr] of m) m.set(k, [...new Set(arr)]);
    }

    return { parents, children, spouses };
  }

  function getRelationsFor(personId) {
    const { parents, children, spouses } = getGraph();
    const rels = [];
    for (const pid of parents.get(personId) || []) {
      const p = people.find((x) => x.id === pid);
      if (p) rels.push({ type: "Parent", person: p });
    }
    for (const cid of children.get(personId) || []) {
      const p = people.find((x) => x.id === cid);
      if (p) rels.push({ type: "Child", person: p });
    }
    for (const sid of spouses.get(personId) || []) {
      const p = people.find((x) => x.id === sid);
      if (p) {
        const r = relationships.find(
          (x) =>
            ((x.type === "spouse" || x.type === "partner") &&
              ((x.fromId === personId && x.toId === sid) ||
                (x.toId === personId && x.fromId === sid)))
        );
        const label = r?.type === "partner" ? "Partner" : "Spouse";
        const dateNote = r?.date ? ` · ${r.date}` : "";
        rels.push({ type: label + dateNote, person: p, date: r?.date || "" });
      }
    }
    return rels;
  }

  // ---------- Tree layout (simple hierarchical) ----------
  function layoutTree(rootId) {
    if (!rootId || !people.length) return { nodes: [], links: [] };

    const { parents, children, spouses } = getGraph();
    const personMap = new Map(people.map((p) => [p.id, p]));
    if (!personMap.has(rootId)) return { nodes: [], links: [] };

    // Build generations upward and downward from focus
    const gen = new Map(); // id -> generation (0 = focus)
    const visited = new Set();

    // BFS down (children)
    const q = [[rootId, 0]];
    visited.add(rootId);
    gen.set(rootId, 0);

    while (q.length) {
      const [id, g] = q.shift();
      for (const cid of children.get(id) || []) {
        if (!visited.has(cid)) {
          visited.add(cid);
          gen.set(cid, g + 1);
          q.push([cid, g + 1]);
        }
      }
      // include spouses at same generation
      for (const sid of spouses.get(id) || []) {
        if (!visited.has(sid)) {
          visited.add(sid);
          gen.set(sid, g);
          q.push([sid, g]);
        }
      }
    }

    // BFS up (parents)
    const qu = [[rootId, 0]];
    while (qu.length) {
      const [id, g] = qu.shift();
      for (const pid of parents.get(id) || []) {
        if (!visited.has(pid)) {
          visited.add(pid);
          gen.set(pid, g - 1);
          qu.push([pid, g - 1]);
        }
      }
      for (const sid of spouses.get(id) || []) {
        if (!visited.has(sid)) {
          visited.add(sid);
          gen.set(sid, g);
          qu.push([sid, g]);
        }
      }
    }

    // If isolated focus with no connections, still show them
    if (visited.size === 0) {
      visited.add(rootId);
      gen.set(rootId, 0);
    }

    // Group by generation
    const byGen = new Map();
    for (const [id, g] of gen) {
      if (!byGen.has(g)) byGen.set(g, []);
      byGen.get(g).push(id);
    }

    const gens = [...byGen.keys()].sort((a, b) => a - b);
    const NODE_W = 140;
    const NODE_H = 90;
    const H_GAP = 40;
    const V_GAP = 100;

    const nodes = [];
    const pos = new Map(); // id -> {x,y}

    // Place each generation centered
    for (const g of gens) {
      const ids = byGen.get(g);
      // Try to keep spouses next to each other
      const ordered = orderWithSpouses(ids, spouses);
      const totalW = ordered.length * NODE_W + (ordered.length - 1) * H_GAP;
      const startX = -totalW / 2;
      const y = g * (NODE_H + V_GAP);

      ordered.forEach((id, i) => {
        const x = startX + i * (NODE_W + H_GAP);
        pos.set(id, { x, y });
        nodes.push({
          id,
          person: personMap.get(id),
          x,
          y,
          w: NODE_W,
          h: NODE_H,
        });
      });
    }

    // Links: parent-child and spouse
    const links = [];
    const linkSet = new Set();

    for (const id of visited) {
      for (const cid of children.get(id) || []) {
        if (visited.has(cid)) {
          const key = `pc-${id}-${cid}`;
          if (!linkSet.has(key)) {
            linkSet.add(key);
            links.push({
              type: "parent",
              from: pos.get(id),
              to: pos.get(cid),
              fromId: id,
              toId: cid,
            });
          }
        }
      }
      for (const sid of spouses.get(id) || []) {
        if (visited.has(sid) && id < sid) {
          const key = `sp-${id}-${sid}`;
          if (!linkSet.has(key)) {
            linkSet.add(key);
            links.push({
              type: "spouse",
              from: pos.get(id),
              to: pos.get(sid),
              fromId: id,
              toId: sid,
            });
          }
        }
      }
    }

    return { nodes, links, NODE_W, NODE_H };
  }

  function orderWithSpouses(ids, spouses) {
    const set = new Set(ids);
    const result = [];
    const used = new Set();

    for (const id of ids) {
      if (used.has(id)) continue;
      result.push(id);
      used.add(id);
      for (const sid of spouses.get(id) || []) {
        if (set.has(sid) && !used.has(sid)) {
          result.push(sid);
          used.add(sid);
        }
      }
    }
    return result;
  }

  // ---------- Render ----------
  function renderPeopleList() {
    const q = (el.search.value || "").trim().toLowerCase();
    const filtered = people.filter((p) => {
      if (!q) return true;
      return fullName(p).toLowerCase().includes(q);
    });

    el.peopleCount.textContent = people.length;
    el.peopleEmpty.hidden = people.length > 0;

    el.peopleList.innerHTML = filtered
      .map((p) => {
        const selected = p.id === selectedId ? " selected" : "";
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

    // Focus select
    const focusOpts =
      `<option value="">— Select person —</option>` +
      people
        .map(
          (p) =>
            `<option value="${p.id}" ${p.id === focusId ? "selected" : ""}>${escapeHtml(fullName(p))}</option>`
        )
        .join("");
    el.focusSelect.innerHTML = focusOpts;
  }

  function renderDetail() {
    if (!selectedId) {
      el.detailTitle.textContent = "Details";
      el.detailContent.innerHTML = `
        <div class="empty-state">
          <p>Select a person to view and edit details, or create relationships.</p>
        </div>`;
      return;
    }

    const p = people.find((x) => x.id === selectedId);
    if (!p) {
      selectedId = null;
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

    $("#btn-add-rel")?.addEventListener("click", () => openRelModal(p.id));
    $("#btn-edit-person")?.addEventListener("click", () => openPersonModal(p));
    $("#btn-focus-this")?.addEventListener("click", () => {
      focusId = p.id;
      save();
      renderAll();
    });
    $("#btn-delete-person")?.addEventListener("click", () => deletePerson(p.id));

    el.detailContent.querySelectorAll(".rel-person").forEach((node) => {
      node.addEventListener("click", () => {
        selectedId = node.dataset.id;
        renderAll();
      });
    });
  }

  function renderTree() {
    const root = focusId || (people.length ? people[0].id : null);
    const { nodes, links, NODE_W, NODE_H } = layoutTree(root);

    // Clear previous nodes (keep svg)
    el.treeCanvas.querySelectorAll(".tree-node").forEach((n) => n.remove());

    if (!nodes.length) {
      el.treeEmpty.classList.remove("hidden");
      el.treeSvg.innerHTML = "";
      el.treeSvg.setAttribute("width", "0");
      el.treeSvg.setAttribute("height", "0");
      return;
    }

    el.treeEmpty.classList.add("hidden");

    // Compute bounds
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

    // Draw links
    let pathHtml = "";
    for (const L of links) {
      const x1 = L.from.x + NODE_W / 2 + offsetX;
      const y1 = L.from.y + NODE_H / 2 + offsetY;
      const x2 = L.to.x + NODE_W / 2 + offsetX;
      const y2 = L.to.y + NODE_H / 2 + offsetY;

      if (L.type === "spouse") {
        pathHtml += `<path class="link link-spouse" d="M${x1},${y1} L${x2},${y2}" />`;
      } else {
        // Parent-child: curve from bottom of parent to top of child
        const py = L.from.y + NODE_H + offsetY;
        const cy = L.to.y + offsetY;
        const midY = (py + cy) / 2;
        pathHtml += `<path class="link" d="M${x1},${py} C${x1},${midY} ${x2},${midY} ${x2},${cy}" />`;
      }
    }
    el.treeSvg.innerHTML = pathHtml;

    // Nodes
    for (const n of nodes) {
      const p = n.person;
      const div = document.createElement("div");
      div.className = "tree-node" + (p.id === selectedId ? " selected" : "");
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
        selectedId = p.id;
        renderAll();
      });
      el.treeCanvas.appendChild(div);
    }

    // Size canvas
    el.treeCanvas.style.width = svgW + "px";
    el.treeCanvas.style.height = svgH + "px";

    applyTransform();
  }

  function applyTransform() {
    el.treeCanvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    $("#btn-zoom-reset").textContent = Math.round(scale * 100) + "%";
  }

  function renderAll() {
    renderPeopleList();
    renderDetail();
    renderTree();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, """);
  }

  // ---------- CRUD ----------
  function openPersonModal(person = null) {
    const isEdit = !!person;
    $("#modal-person-title").textContent = isEdit ? "Edit Person" : "Add Person";
    $("#person-id").value = person?.id || "";
    $("#person-first").value = person?.firstName || "";
    $("#person-last").value = person?.lastName || "";
    $("#person-birth").value = person?.birth || "";
    $("#person-death").value = person?.death || "";
    $("#person-gender").value = person?.gender || "";
    $("#person-notes").value = person?.notes || "";
    el.modalPerson.hidden = false;
    $("#person-first").focus();
  }

  function closePersonModal() {
    el.modalPerson.hidden = true;
    el.formPerson.reset();
  }

  function savePerson(e) {
    e.preventDefault();
    const id = $("#person-id").value || uid();
    const data = {
      id,
      firstName: $("#person-first").value.trim(),
      lastName: $("#person-last").value.trim(),
      birth: $("#person-birth").value || "",
      death: $("#person-death").value || "",
      gender: $("#person-gender").value || "",
      notes: $("#person-notes").value.trim(),
    };

    if (!data.firstName) {
      toast("First name is required");
      return;
    }

    const idx = people.findIndex((p) => p.id === id);
    if (idx >= 0) {
      people[idx] = data;
      toast("Person updated");
    } else {
      people.push(data);
      if (!focusId) focusId = id;
      selectedId = id;
      toast("Person added");
    }

    save();
    closePersonModal();
    renderAll();
  }

  function deletePerson(id) {
    if (!confirm("Delete this person and all their relationships?")) return;
    people = people.filter((p) => p.id !== id);
    relationships = relationships.filter((r) => r.fromId !== id && r.toId !== id);
    if (selectedId === id) selectedId = null;
    if (focusId === id) focusId = people[0]?.id || null;
    save();
    toast("Person deleted");
    renderAll();
  }

  function openRelModal(fromId) {
    const p = people.find((x) => x.id === fromId);
    if (!p) return;
    $("#rel-from-id").value = fromId;
    $("#rel-from-name").textContent = fullName(p);
    $("#rel-type").value = "";
    const dateEl = $("#rel-date");
    if (dateEl) dateEl.value = "";
    const others = people.filter((x) => x.id !== fromId);
    $("#rel-to").innerHTML =
      `<option value="">— Select person —</option>` +
      others
        .map((x) => `<option value="${x.id}">${escapeHtml(fullName(x))}</option>`)
        .join("");
    el.modalRel.hidden = false;
  }

  function closeRelModal() {
    el.modalRel.hidden = true;
    el.formRel.reset();
  }

  function saveRel(e) {
    e.preventDefault();
    const fromId = $("#rel-from-id").value;
    const type = $("#rel-type").value;
    const toId = $("#rel-to").value;
    if (!fromId || !type || !toId) return;

    // Prevent duplicate
    const exists = relationships.some(
      (r) =>
        (r.fromId === fromId && r.toId === toId && r.type === type) ||
        (r.type === "spouse" || r.type === "partner") &&
          ((r.fromId === fromId && r.toId === toId) ||
            (r.fromId === toId && r.toId === fromId))
    );
    if (exists) {
      toast("This relationship already exists");
      return;
    }

    // Normalize: store parent as from=parent, to=child
    let finalType = type;
    let a = fromId;
    let b = toId;
    if (type === "child") {
      // from is child of to → store as parent: to → from
      finalType = "parent";
      a = toId;
      b = fromId;
    }

    const dateVal = ($("#rel-date") && $("#rel-date").value) || "";
    const rel = { id: uid(), fromId: a, toId: b, type: finalType };
    if (dateVal && (finalType === "spouse" || finalType === "partner")) {
      rel.date = dateVal;
    }
    relationships.push(rel);
    save();
    closeRelModal();
    toast("Relationship added");
    renderAll();
  }

  // ---------- Pan / Zoom ----------
  function setupPanZoom() {
    const vp = el.treeViewport;

    vp.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const next = Math.min(2.5, Math.max(0.3, scale + delta));
      // Zoom toward cursor
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      panX = cx - (cx - panX) * (next / scale);
      panY = cy - (cy - panY) * (next / scale);
      scale = next;
      applyTransform();
    }, { passive: false });

    vp.addEventListener("mousedown", (e) => {
      if (e.target.closest(".tree-node")) return;
      isPanning = true;
      vp.classList.add("panning");
      panStart = { x: e.clientX, y: e.clientY, panX, panY };
    });

    window.addEventListener("mousemove", (e) => {
      if (!isPanning) return;
      panX = panStart.panX + (e.clientX - panStart.x);
      panY = panStart.panY + (e.clientY - panStart.y);
      applyTransform();
    });

    window.addEventListener("mouseup", () => {
      isPanning = false;
      vp.classList.remove("panning");
    });

    // Touch
    let lastTouch = null;
    vp.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX, panY };
      }
    }, { passive: true });

    vp.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1 && lastTouch) {
        panX = lastTouch.panX + (e.touches[0].clientX - lastTouch.x);
        panY = lastTouch.panY + (e.touches[0].clientY - lastTouch.y);
        applyTransform();
      }
    }, { passive: true });

    vp.addEventListener("touchend", () => (lastTouch = null));
  }

  function fitTree() {
    const canvas = el.treeCanvas;
    const vp = el.treeViewport;
    const cw = parseFloat(canvas.style.width) || 400;
    const ch = parseFloat(canvas.style.height) || 300;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    if (!cw || !ch) return;
    scale = Math.min(vw / (cw + 40), vh / (ch + 40), 1.2);
    scale = Math.max(0.3, scale);
    panX = (vw - cw * scale) / 2;
    panY = (vh - ch * scale) / 2;
    applyTransform();
  }

  // ---------- Export / Import ----------
  function exportData() {
    const data = { people, relationships, focusId, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kinnect-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Exported");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.people)) throw new Error("Invalid file");
        people = data.people;
        relationships = data.relationships || [];
        focusId = data.focusId || people[0]?.id || null;
        selectedId = null;
        save();
        renderAll();
        toast(`Imported ${people.length} people`);
      } catch (e) {
        toast("Import failed — invalid JSON");
      }
    };
    reader.readAsText(file);
  }

  // ---------- Theme ----------
  function initTheme() {
    const saved = localStorage.getItem("kinnect-theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "");
  }

  function toggleTheme() {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const next = isLight ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next === "light" ? "light" : "");
    localStorage.setItem("kinnect-theme", next);
  }

  // ---------- Events ----------
  function bindEvents() {
    $("#btn-add-person").addEventListener("click", () => openPersonModal());
    $("#modal-person-close").addEventListener("click", closePersonModal);
    $("#modal-person-cancel").addEventListener("click", closePersonModal);
    el.formPerson.addEventListener("submit", savePerson);

    $("#modal-rel-close").addEventListener("click", closeRelModal);
    $("#modal-rel-cancel").addEventListener("click", closeRelModal);
    el.formRel.addEventListener("submit", saveRel);

    el.search.addEventListener("input", () => renderPeopleList());

    el.peopleList.addEventListener("click", (e) => {
      const card = e.target.closest(".person-card");
      if (!card) return;
      selectedId = card.dataset.id;
      renderAll();
    });

    el.focusSelect.addEventListener("change", () => {
      focusId = el.focusSelect.value || null;
      save();
      renderTree();
    });

    $("#btn-zoom-in").addEventListener("click", () => {
      scale = Math.min(2.5, scale + 0.15);
      applyTransform();
    });
    $("#btn-zoom-out").addEventListener("click", () => {
      scale = Math.max(0.3, scale - 0.15);
      applyTransform();
    });
    $("#btn-zoom-reset").addEventListener("click", () => {
      scale = 1;
      panX = 40;
      panY = 40;
      applyTransform();
    });
    $("#btn-fit").addEventListener("click", fitTree);

    $("#btn-theme").addEventListener("click", toggleTheme);
    $("#btn-export").addEventListener("click", exportData);
    $("#btn-import").addEventListener("click", () => el.importFile.click());
    el.importFile.addEventListener("change", () => {
      if (el.importFile.files[0]) importData(el.importFile.files[0]);
      el.importFile.value = "";
    });

    // Close modals on overlay click
    el.modalPerson.addEventListener("click", (e) => {
      if (e.target === el.modalPerson) closePersonModal();
    });
    el.modalRel.addEventListener("click", (e) => {
      if (e.target === el.modalRel) closeRelModal();
    });

    // Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePersonModal();
        closeRelModal();
      }
    });

    setupPanZoom();
  }

  // ---------- Init ----------
  async function init() {
    initTheme();
    await load();
    if (!selectedId && people.length) {
      selectedId = focusId || people[0].id;
    }
    bindEvents();
    renderAll();
    requestAnimationFrame(() => {
      setTimeout(fitTree, 50);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
