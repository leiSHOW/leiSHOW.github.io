import {
  scenes,
  nodeDics,
  hashIPDics,
  pathDics,
  routeDics,
  clusterDics,
  macDics,
  flags,
  flag,
  idDics,
  clusterHeadList,
} from "../Move/viewControl.js";
import * as THREE from "three";

const STORAGE_KEYS = {
  scenes: "multiuav-demo-scenes",
  nodeDics: "multiuav-demo-nodeDics",
  hashIPDics: "multiuav-demo-hashIPDics",
  pathDics: "multiuav-demo-pathDics",
  routeDics: "multiuav-demo-routeDics",
  clusterDics: "multiuav-demo-clusterDics",
  macDics: "multiuav-demo-macDics",
  flags: "multiuav-demo-flags",
  flag: "multiuav-demo-flag",
  idDics: "multiuav-demo-idDics",
  clusterHeadList: "multiuav-demo-clusterHeadList",
};

const saveButton = document.getElementById("save_scene");
if (saveButton) {
  saveButton.addEventListener("click", saveAllSceneAndCamera);
  // 恢复场景页原有的 JSON / CSV 导出入口，和保存按钮并列。
  initExportButtons(saveButton);

}

// 保存场景数据到 localStorage。
export function saveAllSceneAndCamera() {
  try {
    const scenesStore = scenes.map(({ scene }) => JSON.stringify(scene.toJSON()));

    localStorage.setItem(STORAGE_KEYS.scenes, JSON.stringify(scenesStore));
    localStorage.setItem(STORAGE_KEYS.nodeDics, JSON.stringify(nodeDics));
    localStorage.setItem(STORAGE_KEYS.hashIPDics, JSON.stringify(hashIPDics));
    localStorage.setItem(STORAGE_KEYS.pathDics, JSON.stringify(pathDics));
    localStorage.setItem(STORAGE_KEYS.routeDics, JSON.stringify(routeDics));
    localStorage.setItem(STORAGE_KEYS.clusterDics, JSON.stringify(clusterDics));
    localStorage.setItem(STORAGE_KEYS.macDics, JSON.stringify(macDics));
    localStorage.setItem(STORAGE_KEYS.flags, JSON.stringify(getSerializableFlags()));
    localStorage.setItem(STORAGE_KEYS.flag, JSON.stringify(flag));
    localStorage.setItem(STORAGE_KEYS.idDics, JSON.stringify(idDics));
    localStorage.setItem(STORAGE_KEYS.clusterHeadList, JSON.stringify(clusterHeadList));
  } catch (error) {
    console.error("保存场景数据失败:", error);
  }
}

// 加载场景数据。
export function loadSceneAndCamera() {
  const loader = new THREE.ObjectLoader();
  const scenesStore = readStorage(STORAGE_KEYS.scenes, []);

  scenes.length = 0;
  scenesStore.forEach((sceneJson) => {
    if (!sceneJson) return;
    try {
      const sceneData = typeof sceneJson === "string" ? JSON.parse(sceneJson) : sceneJson;
      scenes.push({ scene: loader.parse(sceneData) });
    } catch (error) {
      console.error("场景数据解析失败:", error);
    }
  });

  replaceArray(nodeDics, readStorage(STORAGE_KEYS.nodeDics, []));
  // 修复旧代码误把 nodeDics 写入 hashIPDics 的问题。
  replaceArray(hashIPDics, readStorage(STORAGE_KEYS.hashIPDics, []));
  replaceArray(pathDics, readStorage(STORAGE_KEYS.pathDics, []));
  replaceArray(routeDics, readStorage(STORAGE_KEYS.routeDics, []));
  replaceArray(clusterDics, readStorage(STORAGE_KEYS.clusterDics, []));
  replaceArray(macDics, readStorage(STORAGE_KEYS.macDics, []));
  replaceArray(flags, normalizeLoadedFlags(readStorage(STORAGE_KEYS.flags, [])));
  replaceArray(idDics, readStorage(STORAGE_KEYS.idDics, []));
  replaceArray(clusterHeadList, readStorage(STORAGE_KEYS.clusterHeadList, []));

  const savedFlag = readStorage(STORAGE_KEYS.flag, null);
  if (savedFlag && typeof savedFlag.activeSceneIndex !== "undefined") {
    flag.activeSceneIndex = savedFlag.activeSceneIndex;
  }

  ensureSceneData();
  rebuildIpIndexes();
}

// 导出全部场景、节点、路由和分簇数据为 JSON。
export function exportAllData() {
  if (!scenes.length && !nodeDics.length && !routeDics.length) {
    console.warn("当前没有可导出的数据");
    return;
  }

  const exportData = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    activeSceneIndex: flag.activeSceneIndex,
    scenes: scenes.map(({ scene }, index) => ({
      index,
      name: scene.name || `场景${index}`,
      scene: scene.toJSON(),
    })),
    nodeDics,
    hashIPDics,
    pathDics,
    routeDics,
    clusterDics,
    macDics,
    idDics,
    clusterHeadList,
  };

  downloadBlob(
    JSON.stringify(exportData, null, 2),
    `simulation-data-${formatTimestamp()}.json`,
    "application/json;charset=utf-8"
  );
}

// 导出当前场景的完整路由指标为 CSV，便于 Excel / Python 分析。
export function exportCurrentRouteCsv() {
  const sceneIndex = flag.activeSceneIndex;
  const routeData = sceneIndex == null ? null : routeDics[sceneIndex];
  if (!Array.isArray(routeData) || routeData.length === 0) {
    console.warn("当前场景没有路由指标可导出");
    return;
  }

  const headers = [
    "index",
    "AverageDelay",
    "lossPacketRatio",
    "convergenceTime",
    "AvgThroughput",
  ];
  const rows = routeData.map((item, index) => [
    index + 1,
    item?.AverageDelay ?? "",
    item?.lossPacketRatio ?? "",
    item?.convergenceTime ?? "",
    item?.AvgThroughput ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  const sceneName = sanitizeFilename(
    scenes[sceneIndex]?.scene?.name || `scene-${sceneIndex}`
  );
  downloadBlob(
    `\ufeff${csv}`,
    `${sceneName}-routing-metrics-${formatTimestamp()}.csv`,
    "text/csv;charset=utf-8"
  );
}

// 导出当前场景的五项分簇指标。
export function exportCurrentClusterCsv() {
  const sceneIndex = flag.activeSceneIndex;
  const metrics = sceneIndex == null ? null : clusterDics[sceneIndex];
  if (!Array.isArray(metrics) || metrics.length === 0) {
    console.warn("当前场景没有分簇指标可导出");
    return;
  }

  const headers = [
    "sceneId",
    "algorithm",
    "sampleTime",
    "snapshotId",
    "avgCHLifetime",
    "avgMemberLifetime",
    "clusterMaintenanceMessages",
    "clusterHeadClaimMessages",
    "guestMaintenanceMessages",
  ];
  const rows = metrics.map((item) => [
    item?.sceneId ?? sceneIndex,
    item?.algorithm ?? "",
    item?.sampleTime ?? "",
    item?.snapshotId ?? "",
    item?.avgCHLifetime ?? "",
    item?.avgMemberLifetime ?? "",
    item?.clusterMaintenanceMessages ?? "",
    item?.clusterHeadClaimMessages ?? "",
    item?.guestMaintenanceMessages ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  const sceneName = sanitizeFilename(
    scenes[sceneIndex]?.scene?.name || "scene-" + sceneIndex
  );
  downloadBlob(
    "\ufeff" + csv,
    sceneName + "-cluster-metrics-" + formatTimestamp() + ".csv",
    "text/csv;charset=utf-8"
  );
}

function initExportButtons(referenceButton) {
  if (document.getElementById("export_scene_data")) return;

  const jsonButton = createExportButton("export_scene_data", "导出JSON", exportAllData);
  const csvButton = createExportButton("export_route_csv", "导出路由CSV", exportCurrentRouteCsv);
  const clusterCsvButton = createExportButton(
    "export_cluster_csv",
    "导出分簇CSV",
    exportCurrentClusterCsv
  );
  referenceButton.insertAdjacentElement("afterend", jsonButton);
  jsonButton.insertAdjacentElement("afterend", csvButton);
  csvButton.insertAdjacentElement("afterend", clusterCsvButton);
}

function createExportButton(id, text, handler) {
  const button = document.createElement("button");
  button.id = id;
  button.type = "button";
  button.className = "data-export-button";
  button.textContent = text;
  button.addEventListener("click", handler);
  return button;
}

function getSerializableFlags() {
  return flags.map((item = {}) => ({
    menuOpen: false,
    nullNumber: item.nullNumber ?? 0,
    newObjectName: item.newObjectName ?? 0,
    outlineBox: null,
    activeObject: null,
    baseMenu: false,
    clusterMenu: false,
    position: item.position ?? { x: 0, y: 0 },
  }));
}

function normalizeLoadedFlags(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item = {}) => ({
    menuOpen: false,
    nullNumber: item.nullNumber ?? 0,
    newObjectName: item.newObjectName ?? 0,
    outlineBox: null,
    activeObject: null,
    baseMenu: false,
    clusterMenu: false,
    position: item.position ?? { x: 0, y: 0 },
  }));
}


function ensureSceneData() {
  for (let index = 0; index < scenes.length; index += 1) {
    nodeDics[index] ??= { nodes: {} };
    hashIPDics[index] ??= { ips: {} };
    pathDics[index] ??= { pathHttpRoot: "", pathWsRoot: "", pathChild: "" };
    routeDics[index] ??= [];
    clusterDics[index] ??= [];
    macDics[index] ??= { mac: { qos: {}, noQos: {} } };
    idDics[index] ??= { ids: {} };
    flags[index] ??= {
      menuOpen: false,
      nullNumber: 0,
      newObjectName: 0,
      outlineBox: null,
      activeObject: null,
      baseMenu: false,
      clusterMenu: false,
      position: { x: 0, y: 0 },
    };
  }
}

function rebuildIpIndexes() {
  for (let index = 0; index < scenes.length; index += 1) {
    const ips = {};
    Object.values(nodeDics[index]?.nodes ?? {}).forEach((node) => {
      const nodeIp = node?.nodeIP ?? node?.Node_ip ?? node?.ip;
      if (
        nodeIp !== undefined &&
        nodeIp !== null &&
        nodeIp !== "" &&
        String(nodeIp) !== "0"
      ) {
        ips[String(nodeIp)] = node.nodeID;
      }
    });
    hashIPDics[index] = { ips };
  }
}

function replaceArray(target, source) {
  target.length = 0;
  if (Array.isArray(source)) target.push(...source);
}

function readStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`读取 localStorage[${key}] 失败:`, error);
    return fallback;
  }
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sanitizeFilename(name) {
  return String(name).replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-");
}

function formatTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
