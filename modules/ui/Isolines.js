"use strict";

function openIsolinesMenu() {
  if (customization) return;
  closeDialogs("#isolinesMenu, .stable");
  $("#isolinesMenu").dialog({
    title: "Isolines Options",
    resizable: false,
    width: 300,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  updateIsolinesMenu();
}

function updateIsolinesMenu() {
  const body = byId("isolinesBody");
  body.innerHTML = "";

  const isolineGroups = ["contours", "isobaths", "isohyets"];
  const isolinesLayer = d3.select("#isolines");
  const activeGroup = isolinesLayer.attr("data-active-group") || "contours";
  const isVisible = layerIsOn("toggleIsolines");
  
  isolineGroups.forEach(group => {
    const isActiveGroup = group === activeGroup;
    const line = `<div class="isolineGroup ${isActiveGroup ? 'active' : ''}" data-group="${group}">
      <span>${group.charAt(0).toUpperCase() + group.slice(1)}</span>
      <span class="icon-eye${isVisible && isActiveGroup ? '' : '-off'} pointer" data-tip="Toggle visibility"></span>
    </div>`;
    body.insertAdjacentHTML("beforeend", line);
  });

  // Add event listeners
  body.querySelectorAll(".isolineGroup").forEach(el => 
    el.addEventListener("click", selectIsolineGroup));
  body.querySelectorAll(".icon-eye, .icon-eye-off").forEach(el => 
    el.addEventListener("click", toggleIsolineVisibility));
}

function selectIsolineGroup(event) {
  const group = event.currentTarget.dataset.group;
  d3.select("#isolines").attr("data-active-group", group);
  updateIsolinesMenu();
  drawIsolines();
}

function toggleIsolineVisibility(event) {
  event.stopPropagation();
  toggleIsolines();
  updateIsolinesMenu();
}

function regenerateIsolines() {
  drawIsolines();
}

function goToIsolinesStyle() {
  $("#isolinesMenu").dialog("close");
  styleTab.click();
  styleElementSelect.value = "isolines";
  selectStyleElement();
}

function toggleIsolineLabels() {
  const labels = d3.select("#isolineLabels");
  const isVisible = labels.style("display") !== "none";
  labels.style("display", isVisible ? "none" : "block");
  byId("toggleIsolineLabels").classList.toggle("active", !isVisible);
}

// Event listeners
byId("editIsolinesButton").addEventListener("click", openIsolinesMenu);
byId("regenerateIsolines").addEventListener("click", regenerateIsolines);
byId("isolinesStyleButton").addEventListener("click", goToIsolinesStyle);
byId("toggleIsolineLabels").addEventListener("click", toggleIsolineLabels);

// Allow selecting isoline groups
byId("isolinesBody").addEventListener("click", (event) => {
  if (event.target.closest(".isolineGroup")) {
    const group = event.target.closest(".isolineGroup").dataset.group;
    const isolinesLayer = document.getElementById("isolines");
    if (isolinesLayer) {
      isolinesLayer.setAttribute("data-active-group", group);
      drawIsolines();
    }
    updateIsolinesMenu();
  }
});