"use strict";

function extractCoordinates() {
  if (!pack.cells.p || pack.cells.p.length === 0) {
    console.error("pack.cells.p is missing or empty.");
    return;
  }

  // Initialize x and y arrays
  pack.cells.x = [];
  pack.cells.y = [];

  // Extract x and y coordinates from pack.cells.p
  for (const coord of pack.cells.p) {
    if (Array.isArray(coord) && coord.length === 2) {
      pack.cells.x.push(coord[0]); // x coordinate
      pack.cells.y.push(coord[1]); // y coordinate
    } else {
      console.error("Invalid coordinate format in pack.cells.p:", coord);
    }
  }

  console.log("Coordinates extracted:", {
    x: pack.cells.x.length,
    y: pack.cells.y.length
  });
}

function generateIsolines() {
  console.log("Generating isolines...");
  console.log("pack.cells.h:", pack.cells.h ? "present" : "missing");
  console.log("pack.cells.x:", pack.cells.x ? "present" : "missing");
  console.log("pack.cells.y:", pack.cells.y ? "present" : "missing");
  console.log("grid.cells.prec:", grid.cells.prec ? "present" : "missing");

  if (!pack.cells.h || !pack.cells.x || !pack.cells.y || !grid.cells.prec) {
    console.error("Required data for isoline generation is missing");
    return;
  }
  if (!pack.cells.isolines) pack.cells.isolines = {};

  const graphWidth = +svg.attr("width");
  const graphHeight = +svg.attr("height");

  // Generate elevation contours
  pack.cells.isolines.contours = generateIsolineGroup
  (pack.cells.h, pack.cells.x, pack.cells.y, { start: 20, interval: 20, precision: 2 });

  // Generate isobaths (underwater contours)
  pack.cells.isolines.isobaths = generateIsolineGroup
  (pack.cells.h, pack.cells.x, pack.cells.y, { start: 0, interval: 5, reverse: true, precision: 2 });

  // Generate precipitation isohyets
  const precipData = grid.cells.prec.map(prec => prec * 100); // Convert to mm
  pack.cells.isolines.isohyets = generateIsolineGroup
  (precipData, pack.cells.x, pack.cells.y, { start: 0, interval: 50, precision: 2 });

  console.log("Isolines generated:", pack.cells.isolines);
}

function generateIsolineGroup(data, x, y, options = {}) {
  console.log("Generating isoline group with options:", options);
  console.log("Data sample:", data.slice(0, 5));

  const {
    start = 0,
    interval = 20,
    reverse = false,
    minPoints = 10,
    smoothing = 0.2,
    precision = 2
  } = options;

  const isolines = [];
  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);

  console.log("Data range:", minValue, "to", maxValue);

  const effectiveMin = Math.max(minValue, start);
  const effectiveMax = maxValue;

  for (let value = effectiveMin; value <= effectiveMax; value += interval) {
    const isoline = {
      value: reverse ? maxValue - value + start : value,
      points: []
    };

    for (let i = 0; i < data.length; i++) {
      const h = data[i];
      if (h >= value && h < value + interval) {
        const neighbors = pack.cells.c[i];
        if (neighbors) {
          for (const j of neighbors) {
            if (j !== undefined && data[j] !== undefined && data[j] < value) {
              // Interpolate the point where the isoline crosses between cells
              const x1 = x[i], y1 = y[i];
              const x2 = x[j], y2 = y[j];
              const h1 = data[i], h2 = data[j];
              const t = (value - h2) / (h1 - h2);
              const ix = x1 * t + x2 * (1 - t);
              const iy = y1 * t + y2 * (1 - t);
              isoline.points.push([ix, iy]);
            }
          }
        }
      }
    }

    if (isoline.points.length >= minPoints) {
      // Sort points to form a continuous line
      isoline.points = sortPointsAlongPath(isoline.points);
      
      if (smoothing > 0) {
        isoline.points = smoothPoints(isoline.points, smoothing, precision);
      }
      isolines.push(isoline);
    }
  }

  console.log("Generated isolines:", isolines.length);
  return isolines;
}

function sortPointsAlongPath(points) {
  const sorted = [points[0]];
  const remaining = new Set(points.slice(1));

  while (remaining.size > 0) {
    const last = sorted[sorted.length - 1];
    let nearest = null;
    let minDist = Infinity;

    for (const point of remaining) {
      const dist = Math.hypot(point[0] - last[0], point[1] - last[1]);
      if (dist < minDist) {
        minDist = dist;
        nearest = point;
      }
    }

    if (nearest) {
      sorted.push(nearest);
      remaining.delete(nearest);
    } else {
      break;
    }
  }

  return sorted;
}

function smoothPoints(points, factor, precision) {
  return points.map((point, i, arr) => {
    if (i === 0 || i === arr.length - 1) return point;
    const prev = arr[i - 1];
    const next = arr[i + 1];
    return [
      reducePrecision(point[0] + (prev[0] + next[0] - 2 * point[0]) * factor, precision),
      reducePrecision(point[1] + (prev[1] + next[1] - 2 * point[1]) * factor, precision)
    ];
  });
}

function reducePrecision(num, precision = 2) {
  return Number(num.toFixed(precision));
}

function openIsolinesMenu() {
  if (customization) return;
  closeDialogs("#isolinesMenu, .stable");
  if (!layerIsOn("toggleIsolines")) toggleIsolines();

  generateIsolines(); // Generate isolines if they don't exist

  const body = byId("isolinesBody");
  updateIsolinesMenu();
  $("#isolinesMenu").dialog({
    title: "Isolines Overview",
    resizable: false,
    width: fitContent(),
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });

  if (modules.overviewIsolines) return;
  modules.overviewIsolines = true;

  // add listeners
  const refreshButton = byId("isolinesOverviewRefresh");
  const createNewButton = byId("isolinesCreateNew");
  const exportButton = byId("isolinesExport");
  const removeAllButton = byId("isolinesRemoveAll");

  if (refreshButton) refreshButton.addEventListener("click", updateIsolinesMenu);
  if (createNewButton) createNewButton.addEventListener("click", addIsolineGroup);
  if (exportButton) exportButton.addEventListener("click", downloadIsolinesData);
  if (removeAllButton) removeAllButton.addEventListener("click", triggerAllIsolinesRemove);
}

function updateIsolinesMenu() {
  const body = byId("isolinesBody");
  body.innerHTML = "";
  let lines = "";

  const isolinesLayer = d3.select("#isolines");
  const isVisible = layerIsOn("toggleIsolines");

  for (const [group, isolines] of Object.entries(pack.cells.isolines)) {
    const groupElement = isolinesLayer.select(`.${group}`);
    const groupVisible = groupElement.size() > 0 ? groupElement.style("display") !== "none" : false;

    lines += `<div class="isolineGroup" data-group="${group}">
        <span>${group.charAt(0).toUpperCase() + group.slice(1)}</span>
        <span class="icon-eye${groupVisible ? '' : '-off'} pointer" data-tip="Toggle visibility"></span>
      </div>`;

    for (let i = 0; i < isolines.length; i++) {
      const isoline = isolines[i];
      const name = `${group} ${i + 1}`;
      const value = isoline.value;

      lines += `<div class="states" data-id="${group}_${i}" data-name="${name}" data-group="${group}" data-value="${value}">
          <span data-tip="Click to focus on isoline" class="icon-dot-circled pointer"></span>
          <div data-tip="Isoline name" style="width: 15em; margin-left: 0.4em;">${name}</div>
          <div data-tip="Isoline value" style="width: 6em;">${value}</div>
          <span data-tip="Edit isoline" class="icon-pencil"></span>
          <span data-tip="Remove isoline" class="icon-trash-empty"></span>
        </div>`;
    }
  }
  body.insertAdjacentHTML("beforeend", lines);

  // Add event listeners for isoline visibility toggles
  body.querySelectorAll(".isolineGroup .icon-eye, .isolineGroup .icon-eye-off").forEach(el =>
    el.addEventListener("click", toggleIsolineGroupVisibility));

  // Add event listeners
  /* body.querySelectorAll(".isolineGroup").forEach(el => 
    el.addEventListener("click", selectIsolineGroup)); 
  body.querySelectorAll(".icon-pencil").forEach(el => 
    el.addEventListener("click", openIsolineEditor));
  body.querySelectorAll(".icon-trash-empty").forEach(el => 
    el.addEventListener("click", triggerIsolineRemove));
  */

  // Add event listeners
  body.querySelectorAll(".isolineGroup .icon-eye, .isolineGroup .icon-eye-off").forEach(el =>
    el.addEventListener("click", toggleIsolineGroupVisibility));
  body.querySelectorAll(".icon-dot-circled").forEach(el =>
    el.addEventListener("click", zoomToIsoline));
  body.querySelectorAll(".icon-pencil").forEach(el =>
    el.addEventListener("click", editIsoline));
  body.querySelectorAll(".icon-trash-empty").forEach(el =>
    el.addEventListener("click", removeIsoline));
}

function selectIsolineGroup(event) {
  const group = event.currentTarget.dataset.group;
  d3.select("#isolines").attr("data-active-group", group);
  updateIsolinesMenu();
  drawIsolines();
}

function toggleIsolineGroupVisibility(event) {
  const group = event.target.closest('.isolineGroup').dataset.group;
  const groupElement = isolines.select(`.${group}`);
  const isVisible = groupElement.style("display") !== "none";

  groupElement.style("display", isVisible ? "none" : null);
  event.target.classList.toggle("icon-eye");
  event.target.classList.toggle("icon-eye-off");
}

// placeholder functions
function zoomToIsoline(event) {
  const [group, index] = event.target.closest('.states').dataset.id.split("_");
  console.log(`Zoom to isoline: ${group} ${index}`);
  // Implement zoom functionality
}

function editIsoline(event) {
  const [group, index] = event.target.closest('.states').dataset.id.split("_");
  console.log(`Edit isoline: ${group} ${index}`);
  // Implement edit functionality
}

function removeIsoline(event) {
  const [group, index] = event.target.closest('.states').dataset.id.split("_");
  console.log(`Remove isoline: ${group} ${index}`);
  // Implement remove functionality
}

// placeholder functions end

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

function toggleIsolineGroupVisibility(event) {
  const group = event.target.closest('.isolineGroup').dataset.group;
  const groupElement = isolines.select(`.${group}`);
  const isVisible = groupElement.style("display") !== "none";

  groupElement.style("display", isVisible ? "none" : null);
  event.target.classList.toggle("icon-eye");
  event.target.classList.toggle("icon-eye-off");
}

function zoomToIsoline(event) {
  const [group, index] = event.target.closest('.states').dataset.id.split("_");
  console.log(`Zoom to isoline: ${group} ${index}`);
  // Implement zoom functionality
}

function editIsoline(event) {
  const [group, index] = event.target.closest('.states').dataset.id.split("_");
  console.log(`Edit isoline: ${group} ${index}`);
  // Implement edit functionality
}

function removeIsoline(event) {
  const [group, index] = event.target.closest('.states').dataset.id.split("_");
  console.log(`Remove isoline: ${group} ${index}`);
  // Implement remove functionality
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

function openIsolineEditor(event) {
  event.stopPropagation();
  const [group, index] = event.target.closest('.isolineGroup').dataset.id.split("_");
  const isoline = pack.cells.isolines[group][index];
  // Implement isoline editing functionality here
  console.log(`Edit isoline: ${group} ${index}`);
}

function triggerIsolineRemove(event) {
  event.stopPropagation();
  const [group, index] = event.target.closest('.isolineGroup').dataset.id.split("_");
  confirmationDialog({
    title: "Remove isoline",
    message: "Are you sure you want to remove this isoline? This action cannot be undone.",
    confirm: "Remove",
    onConfirm: () => {
      pack.cells.isolines[group].splice(index, 1);
      if (pack.cells.isolines[group].length === 0) {
        delete pack.cells.isolines[group];
      }
      updateIsolinesMenu();
      drawIsolines();
    }
  });
}

function downloadIsolinesData() {
  let data = "Group,Name,Value\n"; // headers

  for (const [group, isolines] of Object.entries(pack.cells.isolines)) {
    for (let i = 0; i < isolines.length; i++) {
      const name = `${group} ${i + 1}`;
      const value = isolines[i].value || "";
      data += `${group},${name},${value}\n`;
    }
  }

  const name = getFileName("Isolines") + ".csv";
  downloadFile(data, name);
}

function triggerAllIsolinesRemove() {
  alertMessage.innerHTML = "Are you sure you want to remove all isolines? This action cannot be undone";
  $("#alert").dialog({
    resizable: false,
    title: "Remove all isolines",
    buttons: {
      Remove: function () {
        pack.cells.isolines = {};
        updateIsolinesMenu();
        drawIsolines();
        $(this).dialog("close");
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
}

function addIsolineGroup() {
  prompt("Enter new isoline group name:", group => {
    if (!group) return;
    group = group.toLowerCase().replace(/\s+/g, '_');
    if (!pack.cells.isolines) pack.cells.isolines = {};
    if (pack.cells.isolines[group]) {
      alert("This group already exists");
      return;
    }
    pack.cells.isolines[group] = [];
    updateIsolinesMenu();
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
  byId("editIsolinesButton").addEventListener("click", openIsolinesMenu);
  byId("regenerateIsolines").addEventListener("click", regenerateIsolines);
  byId("isolinesStyleButton").addEventListener("click", goToIsolinesStyle);
  byId("toggleIsolineLabels").addEventListener("click", toggleIsolineLabels);

  const isolinesMenu = byId("isolinesMenu");
  if (isolinesMenu) {
    isolinesMenu.addEventListener("click", function (event) {
      if (event.target.id === "isolinesOverviewRefresh") updateIsolinesMenu();
      if (event.target.id === "isolinesCreateNew") addIsolineGroup();
      if (event.target.id === "isolinesExport") downloadIsolinesData();
      if (event.target.id === "isolinesRemoveAll") triggerAllIsolinesRemove();
    });
  }

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
});

function addIsolineGroup() {
  prompt("Enter new isoline group name:", group => {
    if (!group) return;
    group = group.toLowerCase().replace(/\s+/g, '_');
    if (!pack.cells.isolines) pack.cells.isolines = {};
    if (pack.cells.isolines[group]) {
      alert("This group already exists");
      return;
    }
    pack.cells.isolines[group] = [];
    updateIsolinesMenu();
  });
}