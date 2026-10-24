/** Modals, CRUD, import/export */

import { state, el, save } from "./state.js";
import { $, uid, fullName, escapeHtml, toast } from "./utils.js";
import { renderAll } from "./render.js";

export function openPersonModal(person = null) {
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

export function closePersonModal() {
  el.modalPerson.hidden = true;
  el.formPerson.reset();
}

export function savePerson(e) {
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
  const idx = state.people.findIndex((p) => p.id === id);
  if (idx >= 0) {
    state.people[idx] = data;
    toast("Person updated");
  } else {
    state.people.push(data);
    if (!state.focusId) state.focusId = id;
    state.selectedId = id;
    toast("Person added");
  }
  save();
  closePersonModal();
  renderAll();
}

export function deletePerson(id) {
  if (!confirm("Delete this person and all their relationships?")) return;
  state.people = state.people.filter((p) => p.id !== id);
  state.relationships = state.relationships.filter(
    (r) => r.fromId !== id && r.toId !== id
  );
  if (state.selectedId === id) state.selectedId = null;
  if (state.focusId === id) state.focusId = state.people[0]?.id || null;
  save();
  toast("Person deleted");
  renderAll();
}

export function openRelModal(fromId = null) {
  const fromSelect = $("#rel-from");
  const fromIdInput = $("#rel-from-id");
  const fromNameEl = $("#rel-from-name");
  if (fromSelect) {
    fromSelect.innerHTML = state.people
      .map(
        (p) =>
          `<option value="${p.id}" ${p.id === fromId ? "selected" : ""}>${escapeHtml(fullName(p))}</option>`
      )
      .join("");
  } else if (fromIdInput && fromId) {
    const p = state.people.find((x) => x.id === fromId);
    fromIdInput.value = fromId;
    if (fromNameEl && p) fromNameEl.textContent = fullName(p);
  }
  const others = fromId ? state.people.filter((x) => x.id !== fromId) : state.people;
  $("#rel-to").innerHTML =
    `<option value="">— Select person —</option>` +
    others.map((p) => `<option value="${p.id}">${escapeHtml(fullName(p))}</option>`).join("");
  if ($("#rel-type")) $("#rel-type").value = $("#rel-type").options[0]?.value || "parent";
  if ($("#rel-date")) $("#rel-date").value = "";
  el.modalRel.hidden = false;
}

export function closeRelModal() {
  el.modalRel.hidden = true;
  el.formRel.reset();
}

export function saveRel(e) {
  e.preventDefault();
  const fromId =
    ($("#rel-from") && $("#rel-from").value) ||
    ($("#rel-from-id") && $("#rel-from-id").value) ||
    "";
  const toId = $("#rel-to") ? $("#rel-to").value : "";
  const type = $("#rel-type") ? $("#rel-type").value : "";
  const date = $("#rel-date") ? $("#rel-date").value : "";
  if (!fromId || !toId || !type) {
    toast("Please fill required fields");
    return;
  }
  if (fromId === toId) {
    toast("Cannot relate a person to themselves");
    return;
  }
  state.relationships.push({
    id: uid(),
    fromId,
    toId,
    type,
    date: date || "",
  });
  save();
  closeRelModal();
  toast("Relationship added");
  renderAll();
}

export function exportData() {
  const payload = {
    people: state.people,
    relationships: state.relationships,
    focusId: state.focusId,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kinnect-export.json";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Exported");
}

export function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state.people = Array.isArray(data.people) ? data.people : [];
      state.relationships = Array.isArray(data.relationships) ? data.relationships : [];
      state.focusId = data.focusId || state.people[0]?.id || null;
      state.selectedId = state.focusId || state.people[0]?.id || null;
      save();
      renderAll();
      toast("Imported " + state.people.length + " people");
    } catch (err) {
      console.warn(err);
      toast("Invalid JSON file");
    }
  };
  reader.readAsText(file);
}
