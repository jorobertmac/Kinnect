/** Graph helpers and tree layout */

import { state } from "./state.js";

export function getGraph() {
  const parents = new Map();
  const children = new Map();
  const spouses = new Map();
  const ensure = (m, k) => {
    if (!m.has(k)) m.set(k, []);
    return m.get(k);
  };
  for (const r of state.relationships) {
    if (r.type === "parent") {
      ensure(children, r.fromId).push(r.toId);
      ensure(parents, r.toId).push(r.fromId);
    } else if (r.type === "child") {
      ensure(children, r.toId).push(r.fromId);
      ensure(parents, r.fromId).push(r.toId);
    } else if (r.type === "spouse" || r.type === "partner") {
      ensure(spouses, r.fromId).push(r.toId);
      ensure(spouses, r.toId).push(r.fromId);
    }
  }
  for (const m of [parents, children, spouses]) {
    for (const [k, arr] of m) m.set(k, [...new Set(arr)]);
  }
  return { parents, children, spouses };
}

export function getRelationsFor(personId) {
  const { parents, children, spouses } = getGraph();
  const rels = [];
  for (const pid of parents.get(personId) || []) {
    const p = state.people.find((x) => x.id === pid);
    if (p) rels.push({ type: "Parent", person: p });
  }
  for (const cid of children.get(personId) || []) {
    const p = state.people.find((x) => x.id === cid);
    if (p) rels.push({ type: "Child", person: p });
  }
  for (const sid of spouses.get(personId) || []) {
    const p = state.people.find((x) => x.id === sid);
    if (p) {
      const r = state.relationships.find(
        (x) =>
          (x.type === "spouse" || x.type === "partner") &&
          ((x.fromId === personId && x.toId === sid) ||
            (x.toId === personId && x.fromId === sid))
      );
      const label = r?.type === "partner" ? "Partner" : "Spouse";
      const dateNote = r?.date ? ` · ${r.date}` : "";
      rels.push({ type: label + dateNote, person: p, date: r?.date || "" });
    }
  }
  return rels;
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

export function layoutTree(rootId) {
  if (!rootId || !state.people.length) return { nodes: [], links: [] };
  const { parents, children, spouses } = getGraph();
  const personMap = new Map(state.people.map((p) => [p.id, p]));
  if (!personMap.has(rootId)) return { nodes: [], links: [] };

  const gen = new Map();
  const visited = new Set();
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
    for (const sid of spouses.get(id) || []) {
      if (!visited.has(sid)) {
        visited.add(sid);
        gen.set(sid, g);
        q.push([sid, g]);
      }
    }
  }

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

  if (visited.size === 0) {
    visited.add(rootId);
    gen.set(rootId, 0);
  }

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
  const pos = new Map();

  for (const g of gens) {
    const ids = byGen.get(g);
    const ordered = orderWithSpouses(ids, spouses);
    const totalW = ordered.length * NODE_W + (ordered.length - 1) * H_GAP;
    const startX = -totalW / 2;
    const y = g * (NODE_H + V_GAP);
    ordered.forEach((id, i) => {
      const x = startX + i * (NODE_W + H_GAP);
      pos.set(id, { x, y });
      nodes.push({ id, person: personMap.get(id), x, y, w: NODE_W, h: NODE_H });
    });
  }

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
