/**
 * Kinnect — Mobile / tablet panel drawers
 * Wires drawer toggles and selection behavior for smaller screens.
 */

function $(sel) {
  return document.querySelector(sel);
}

function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function isTabletOrBelow() {
  return window.matchMedia("(max-width: 1100px)").matches;
}

export function initMobilePanels() {
  const panelLeft = $("#panel-left");
  const panelRight = $("#panel-right");
  const backdrop = $("#drawer-backdrop");
  const btnTogglePeople = $("#btn-toggle-people");
  const btnToggleDetail = $("#btn-toggle-detail");
  const btnClosePeople = $("#btn-close-people");
  const btnCloseDetail = $("#btn-close-detail");

  function updateBackdrop() {
    if (!backdrop) return;
    const leftOpen = panelLeft?.classList.contains("open-mobile");
    const rightOpen = panelRight?.classList.contains("open-mobile");
    if (leftOpen || rightOpen) {
      backdrop.hidden = false;
      requestAnimationFrame(() => backdrop.classList.add("show"));
    } else {
      backdrop.classList.remove("show");
      setTimeout(() => {
        if (
          !panelLeft?.classList.contains("open-mobile") &&
          !panelRight?.classList.contains("open-mobile")
        ) {
          backdrop.hidden = true;
        }
      }, 250);
    }
  }

  function openPeoplePanel() {
    if (!panelLeft) return;
    closeDetailPanel(true);
    panelLeft.classList.add("open-mobile");
    btnTogglePeople?.setAttribute("aria-expanded", "true");
    updateBackdrop();
  }

  function closePeoplePanel(skip) {
    if (!panelLeft) return;
    panelLeft.classList.remove("open-mobile");
    btnTogglePeople?.setAttribute("aria-expanded", "false");
    if (!skip) updateBackdrop();
  }

  function openDetailPanel() {
    if (!panelRight) return;
    closePeoplePanel(true);
    panelRight.classList.add("open-mobile");
    btnToggleDetail?.setAttribute("aria-expanded", "true");
    updateBackdrop();
  }

  function closeDetailPanel(skip) {
    if (!panelRight) return;
    panelRight.classList.remove("open-mobile");
    btnToggleDetail?.setAttribute("aria-expanded", "false");
    if (!skip) updateBackdrop();
  }

  function closeAllPanels() {
    closePeoplePanel(true);
    closeDetailPanel(true);
    updateBackdrop();
  }

  function togglePeoplePanel() {
    if (panelLeft?.classList.contains("open-mobile")) closePeoplePanel();
    else openPeoplePanel();
  }

  function toggleDetailPanel() {
    if (panelRight?.classList.contains("open-mobile")) closeDetailPanel();
    else openDetailPanel();
  }

  btnTogglePeople?.addEventListener("click", togglePeoplePanel);
  btnToggleDetail?.addEventListener("click", toggleDetailPanel);
  btnClosePeople?.addEventListener("click", () => closePeoplePanel());
  btnCloseDetail?.addEventListener("click", () => closeDetailPanel());
  backdrop?.addEventListener("click", closeAllPanels);

  const peopleList = $("#people-list");
  peopleList?.addEventListener("click", (e) => {
    if (!e.target.closest(".person-card")) return;
    if (isMobile()) {
      closePeoplePanel(true);
      openDetailPanel();
    } else if (isTabletOrBelow()) {
      openDetailPanel();
    }
  });

  const treeCanvas = $("#tree-canvas");
  treeCanvas?.addEventListener("click", (e) => {
    if (!e.target.closest(".tree-node")) return;
    if (isTabletOrBelow()) openDetailPanel();
  });

  const detail = $("#detail-content");
  detail?.addEventListener("click", (e) => {
    if (!e.target.closest(".rel-person")) return;
    if (isTabletOrBelow()) openDetailPanel();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllPanels();
  });

  window.addEventListener("resize", () => {
    if (!isTabletOrBelow()) closeAllPanels();
    else if (!isMobile()) closePeoplePanel();
  });
}
