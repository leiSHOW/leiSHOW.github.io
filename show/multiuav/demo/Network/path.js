import {
  pathDics,
  flag,
  nodeDics,
  hashIPDics,
  routeDics,
  clusterDics,
  idDics,
  flags,
  scenes,
  cameraCenter,
  activateScene
} from "../Move/viewControl.js";
import {
  wsClose,
  dataFlag,
  getClusterNode,
  getClusterMetrics,
  getRoutingMetrics,
  postSimulationConfig,
  getNodeEndpoint,
  resetNodeSnapshotState,
  resetSceneDataFlags,
  hasSceneDataFlag,
  basicConnect
} from "../Network/sendMessage.js";
import { macDics } from "../Move/viewControl.js";
// import { drawClusterForm } from "../dataForm/clusterForm.js";
import {DialogLoadingOpen,DialogLoadingClose,DialogText} from '../Move/Dialog.js'
import { QuestChartData, QuestClusterChartData } from "../dataForm/chart.js";
import { isSupportedClusterAlgorithm, normalizePublicAlgorithm } from "../Data/algorithmNames.js";

window.__middlewarePathLoaded = true;
const pathA = document.getElementById("pathRoot");
const pathB = document.getElementById("pathChild");
const pathEnsureButton = document.getElementById("pathEnsure");
const simulationSubmitButton = document.getElementById("submit-simulation-config");
// 页面重新打开时默认进入“连接服务器”，避免浏览器恢复上一次的刷新选项，
// 导致用户点击应用按钮时没有执行 WebSocket 连接。
if (pathB) pathB.value = "reload";
console.log("[middleware] path.js 已加载", {
  pathEnsure: Boolean(pathEnsureButton),
  pathRoot: Boolean(pathA),
  pathChild: Boolean(pathB),
  currentPath: pathA?.value || "",
  action: pathB?.value || ""
});
const connectionStatusElement = document.getElementById("connection-status");
const simulationStatusElement = document.getElementById("simulation-status");

function setVisibleStatus(element, state, message) {
  if (!element) return;
  element.classList.remove(
    "status-idle",
    "status-connecting",
    "status-connected",
    "status-running",
    "status-waiting",
    "status-success",
    "status-error"
  );
  element.classList.add("status-" + state);
  const label = element.querySelector("span");
  if (label) label.textContent = message;
  else element.textContent = message;
}

function updateConnectionStatus(state, message) {
  setVisibleStatus(connectionStatusElement, state, message);
}

function updateSimulationStatus(state, message) {
  setVisibleStatus(simulationStatusElement, state, message);
}

const sceneStatuses = new Map();
function updateSimulationStatusForScene(sceneIndex, state, message) {
  if (sceneIndex === undefined || sceneIndex === null) {
    updateSimulationStatus(state, message);
    return;
  }
  sceneStatuses.set(String(sceneIndex), { state, message });
  if (Number(sceneIndex) === Number(flag.activeSceneIndex)) {
    updateSimulationStatus(state, message);
  }
}

window.addEventListener("scene:active-changed", (event) => {
  const sceneIndex = event.detail?.sceneIndex;
  const saved = sceneStatuses.get(String(sceneIndex));
  if (saved) updateSimulationStatus(saved.state, saved.message);
});

const activeWebSocketChannels = new Set();
function webSocketChannelKey(detail) {
  return `${detail.url || ""}::${detail.subscribeType || "default"}`;
}

window.addEventListener("middleware:ws-status", (event) => {
  const detail = event.detail || {};
  const key = webSocketChannelKey(detail);
  if (detail.state === "connected") {
    activeWebSocketChannels.add(key);
    updateConnectionStatus("connected", "已连接");
  } else if (detail.state === "connecting") {
    if (activeWebSocketChannels.size === 0) {
      updateConnectionStatus("connecting", detail.message || "正在连接");
    }
  } else if (detail.state === "error") {
    activeWebSocketChannels.delete(key);
    if (activeWebSocketChannels.size === 0) {
      updateConnectionStatus("error", detail.message || "连接失败");
    } else {
      updateConnectionStatus("connected", "已连接");
    }
  } else if (detail.state === "reconnecting") {
    activeWebSocketChannels.delete(key);
    updateConnectionStatus(
      activeWebSocketChannels.size > 0 ? "connected" : "connecting",
      activeWebSocketChannels.size > 0 ? "已连接" : (detail.message || "正在重连")
    );
  } else if (detail.state === "disconnected") {
    activeWebSocketChannels.delete(key);
    updateConnectionStatus(
      activeWebSocketChannels.size > 0 ? "connected" : "idle",
      activeWebSocketChannels.size > 0 ? "已连接" : "未连接"
    );
  }
});

window.addEventListener("middleware:simulation-status", (event) => {
  const detail = event.detail || {};
  if (detail.state === "running") {
    updateSimulationStatusForScene(detail.sceneIndex, "running", detail.message || "仿真已开始运行");
  }
});

function waitForWebSocketConnection(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.removeEventListener("middleware:ws-status", onStatus);
      clearTimeout(timer);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const onStatus = (event) => {
      const detail = event.detail || {};
      if (detail.url !== url) return;
      if (detail.state === "connected") {
        finish(resolve, true);
      }
    };
    const timer = setTimeout(() => {
      finish(reject, new Error(`无法连接 WebSocket：${url}`));
    }, timeoutMs);
    window.addEventListener("middleware:ws-status", onStatus);
  });
}

// 打印当前场景无人机数量
function printCurrentSceneUavCount() {
  const sceneIndex = flag.activeSceneIndex;

  if (sceneIndex == null || !nodeDics[sceneIndex] || !nodeDics[sceneIndex].nodes) {
    console.log("当前场景无人机数量: 0");
    return 0;
  }

  const uavCount = Object.keys(nodeDics[sceneIndex].nodes).length;
  console.log(`当前场景 ${sceneIndex} 无人机数量: ${uavCount}`);
  return uavCount;
}

if (pathEnsureButton) {
  pathEnsureButton.addEventListener("click", () => {
    console.log("[middleware] 点击应用连接配置", {
      action: pathB?.value || "",
      wsUrl: pathA?.value || "",
      httpUrl: document.getElementById("httpRoot")?.value || ""
    });
    void pathEnsure(); // 点击确认按钮后，直接读取当前界面中的地址
  });
} else {
  console.error("[middleware] 未找到应用连接配置按钮 #pathEnsure");
}

if (simulationSubmitButton) {
  simulationSubmitButton.addEventListener("click", () => {
    console.log("[middleware] 点击提交仿真配置");
    submitSimulationConfig();
  });
} else {
  console.error("[middleware] 未找到提交仿真配置按钮");
}

/**
 * 获取当前界面地址。
 * 不再因为 pathDics / localStorage 中保存了旧地址而覆盖输入框。
 */
function getCurrentPath() {
  return pathA.value.trim();
}

/**
 * 获取当前界面的 HTTP 地址。
 * 修复：HTTP 与 WebSocket 地址共用一个输入框时，协议校验互斥，
 * 每次切换数据刷新类型都要手改协议头。现使用独立的 #httpRoot 输入框。
 */
function getCurrentHttpPath() {
  const httpInput = document.getElementById("httpRoot");
  return (httpInput?.value || "").trim();
}

function pathEnsure() {
  const value = pathB.value;

  switch (value) {
    case "reload":
      changeServer(); // WebSocket 连接：直接使用当前输入框地址
      break;

    case "/data/GetClusternode": {
      const httpPath = modifyHttpPath();
      if (!httpPath) return;
      DialogLoadingOpen("正在刷新节点信息....");
      getClusterNode(httpPath, getNodeEndpoint());
      reloadNodeInfo();
      break;
    }

    case "/data/GetRoutingmetrics": {
      const httpPath = modifyHttpPath();
      if (!httpPath) return;
      DialogLoadingOpen("正在刷新路由状态....");
      getRoutingMetrics(httpPath, pathB.value);
      reloadRouteInfo();
      break;
    }

    case "/data/GetClustermetrics": {
      const httpPath = modifyHttpPath();
      if (!httpPath) return;
      DialogLoadingOpen("正在刷新分簇指标....");
      getClusterMetrics(httpPath, pathB.value);
      reloadClusterInfo();
      break;
    }

    case "closeWS":
      wsClose();
      break;
  }
}

/**
 * HTTP 请求读取当前界面的 HTTP 地址（#httpRoot）。
 * pathDics 只作为“最后一次使用地址”的记录，不再反向覆盖输入框。
 */
function modifyHttpPath() {
  const currentPath = getCurrentHttpPath();

  if (!/^https?:\/\//i.test(currentPath)) {
    DialogText("HTTP地址格式错误，请输入 http:// 或 https:// 开头的地址");
    return null;
  }

  if (flag.activeSceneIndex != null && pathDics[flag.activeSceneIndex]) {
    pathDics[flag.activeSceneIndex].pathHttpRoot = currentPath;
  }

  return currentPath;
}

function readNumberInput(id, label, options = {}) {
  const value = Number(document.getElementById(id)?.value);
  const integer = options.integer === true;
  const min = options.min ?? -Infinity;
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < min) {
    throw new Error(label + "填写不正确");
  }
  return value;
}

function readSimulationConfig() {
  const sceneIndex = readNumberInput("base-config-scene", "展示场景", { integer: true, min: 0 });
  if (sceneIndex > 3) throw new Error("展示场景无效");
  const size = readNumberInput("base-config-node-num", "节点数量", { integer: true, min: 2 });
  const config = {
    sceneIndex,
    sceneId: String(sceneIndex),
    size,
    algorithm: document.getElementById("base-config-deal")?.value,
    mac: document.getElementById("base-config-mac")?.value,
    mobility: document.getElementById("base-config-mobility")?.value,
    simTime: readNumberInput("base-config-sim-time", "仿真时长", { min: 0.001 }),
    seed: readNumberInput("base-config-seed", "随机种子", { integer: true, min: 0 }),
    scope: readNumberInput("base-config-scope", "区域边长", { min: 1 }),
    commRange: readNumberInput("base-config-comm-range", "通信半径", { min: 1 }),
    srcNode: readNumberInput("base-config-src-node", "源节点", { integer: true, min: 0 }),
    dstNode: readNumberInput("base-config-dst-node", "目的节点", { integer: true, min: -1 }),
    packetSize: readNumberInput("base-config-packet-size", "UDP 包大小", { integer: true, min: 1 }),
    maxPackets: readNumberInput("base-config-max-packets", "最大发包数", { integer: true, min: 1 }),
    interval: readNumberInput("base-config-interval", "发包间隔", { min: 0.001 }),
    initialEnergyJ: readNumberInput("base-config-initial-energy", "初始能量", { min: 0.001 }),
    anim: Boolean(document.getElementById("base-config-anim")?.checked),
  };
  if (!isSupportedClusterAlgorithm(config.algorithm)) {
    throw new Error("分簇算法不受支持");
  }
  config.algorithm = normalizePublicAlgorithm(config.algorithm);
  if (!["eemac", "qosmac"].includes(config.mac)) {
    throw new Error("MAC 协议不受支持");
  }
  if (!["RandomWaypointMobilityModel", "RandomWalk2dMobilityModel", "GaussMarkovMobilityModel"].includes(config.mobility)) {
    throw new Error("移动模型不受支持");
  }
  if (config.srcNode >= config.size ||
      (config.dstNode >= config.size && config.dstNode !== -1)) {
    throw new Error("源节点或目的节点超出节点数量");
  }
  if (config.dstNode === config.srcNode) {
    throw new Error("源节点和目的节点不能相同");
  }
  config.revision = Date.now();
  return config;
}

function resetRuntimeScene(sceneIndex) {
  const scene = scenes[sceneIndex]?.scene;
  if (!scene) return;
  const ground = scene.children[0];
  const ambient = scene.children[1];
  scene.children = [];
  if (ground) scene.children.push(ground);
  if (ambient) scene.children.push(ambient);
  nodeDics[sceneIndex] = { nodes: {} };
  macDics[sceneIndex] = { mac: { qos: {}, noQos: {} }, history: [] };
  hashIPDics[sceneIndex] = { ips: {} };
  idDics[sceneIndex] = { ids: {} };
  routeDics[sceneIndex] = [];
  clusterDics[sceneIndex] = [];
  resetNodeSnapshotState(sceneIndex);
  flags[sceneIndex].menuOpen = false;
  flags[sceneIndex].nullNumber = 0;
  flags[sceneIndex].newObjectName = 0;
  flags[sceneIndex].outlineBox = null;
  flags[sceneIndex].activeObject = null;
  flags[sceneIndex].baseMenu = false;
  flags[sceneIndex].clusterMenu = false;
  resetSceneDataFlags(sceneIndex);
}

function waitForSceneData(sceneIndex, type, timeoutMs = 10000) {
  if (hasSceneDataFlag(sceneIndex, type)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const onData = (event) => {
      const detail = event.detail || {};
      if (Number(detail.sceneIndex) !== Number(sceneIndex) || detail.type !== type) return;
      cleanup();
      resolve(true);
    };
    const timer = setInterval(() => {
      if (Date.now() - startedAt > timeoutMs) {
        cleanup();
        resolve(false);
      }
    }, 100);
    const cleanup = () => {
      clearInterval(timer);
      window.removeEventListener("middleware:scene-data", onData);
    };
    window.addEventListener("middleware:scene-data", onData);
  });
}
async function submitSimulationConfig() {
  let config;
  try {
    config = readSimulationConfig();
  } catch (error) {
    updateSimulationStatus("error", error.message || "仿真配置不完整");
    DialogText(error.message || "仿真配置不完整");
    return;
  }

  const httpPath = modifyHttpPath();
  if (!httpPath) return;
  const wsPath = getCurrentPath();
  if (!(wsPath.startsWith("ws://") || wsPath.startsWith("wss://"))) {
    updateSimulationStatus("error", "WebSocket 地址格式错误");
    DialogText("请先填写有效的 WebSocket 地址，再提交仿真配置");
    return;
  }

  updateSimulationStatusForScene(config.sceneIndex, "connecting", "场景 " + (config.sceneIndex) + " 正在提交仿真配置...");
  DialogLoadingOpen("仿真配置提交中...");
  try {
    const response = await postSimulationConfig(httpPath, config);
    if (Number(response?.code) !== 200 || response?.status !== "accepted") {
      throw new Error(response?.message || "中间件未接受仿真配置");
    }

    resetRuntimeScene(config.sceneIndex);
    activateScene(config.sceneIndex);
    dataFlag.node = false;
    dataFlag.route = false;
    dataFlag.cluster = false;
    updateSimulationStatusForScene(config.sceneIndex, "waiting", "场景 " + (config.sceneIndex) + " 配置已接受，正在等待 ns-3 启动...");
    updateConnectionStatus("connecting", "正在连接数据通道");
    basicConnect(wsPath);

    DialogLoadingOpen("配置已接受，等待 ns-3 首个节点快照...");
    const [nodeReady, clusterReady] = await Promise.all([
      reloadNodeInfo(config.sceneIndex),
      reloadClusterInfo(config.sceneIndex)
    ]);
    if (!nodeReady || !clusterReady) {
      throw new Error("配置已接受，但暂未收到 ns-3 数据，请确认 ns-3 正在运行");
    }
    updateSimulationStatusForScene(config.sceneIndex, "running", "场景 " + (config.sceneIndex) + " 仿真已开始运行，节点和分簇指标正在同步");
    DialogText("仿真已开始运行，节点和分簇指标数据已同步", 1800);
  } catch (error) {
    DialogLoadingClose();
    updateSimulationStatusForScene(config?.sceneIndex, "error", error.message || "仿真配置提交失败");
    DialogText(error.message || "仿真配置提交失败");
    console.error("仿真配置提交失败:", error);
  }
}
// 重新连接服务器：始终读取当前界面 pathRoot 的 WebSocket 地址
async function changeServer() {
  const currentPath = getCurrentPath();

  if (!/^wss?:\/\//i.test(currentPath)) {
    updateConnectionStatus("error", "WebSocket 地址格式错误");
    DialogText("WebSocket地址格式错误，请输入 ws:// 或 wss:// 开头的地址");
    return;
  }

  console.log("[middleware] 准备连接 WebSocket：", currentPath);
  updateConnectionStatus("connecting", "正在连接");
  wsClose(); // 关闭当前连接

  // 仅记录本次界面输入的地址，后续不再用旧值覆盖当前输入框
  if (flag.activeSceneIndex != null && pathDics[flag.activeSceneIndex]) {
    pathDics[flag.activeSceneIndex].pathWsRoot = currentPath;
  }

  // 先注册等待，再创建连接，避免连接很快成功时状态监听错过事件。
  const connectionReady = waitForWebSocketConnection(currentPath);
  try {
    basicConnect(currentPath);
    await connectionReady;
  } catch (error) {
    updateConnectionStatus("error", error.message || "WebSocket 连接失败");
    DialogLoadingClose();
    DialogText(error.message || "WebSocket 连接失败");
    console.error("WebSocket 连接失败:", error);
    return;
  }

  updateConnectionStatus("connected", "已连接");
  DialogText("WebSocket 已连接", 1400);

  // 重新加载全局信息；没有 ns-3 数据时只提示数据未到达，不影响连接状态。
  DialogLoadingOpen("正在等待节点和指标数据....");
  void reloadNodeInfo();
  void reloadClusterInfo();
}

//刷新节点信息
async function reloadNodeInfo(sceneIndex = flag.activeSceneIndex) {
  if (sceneIndex == null || !scenes[sceneIndex]) return false;
  console.log("刷新场景 " + sceneIndex + " 节点信息");

  const scene = scenes[sceneIndex].scene;
  const groundx = scene.children[0];
  const amb = scene.children[1];
  scene.children = [];
  if (groundx) scene.children.push(groundx);
  if (amb) scene.children.push(amb);

  nodeDics[sceneIndex] = { nodes: {} };
  macDics[sceneIndex] = { mac: { qos: {}, noQos: {} }, history: [] };
  hashIPDics[sceneIndex] = { ips: {} };
  idDics[sceneIndex] = { ids: {} };
  flags[sceneIndex].menuOpen = false;
  flags[sceneIndex].nullNumber = 0;
  flags[sceneIndex].newObjectName = 0;
  flags[sceneIndex].outlineBox = null;
  flags[sceneIndex].activeObject = null;
  flags[sceneIndex].baseMenu = false;
  flags[sceneIndex].clusterMenu = false;

  const nodeOk = await waitForSceneData(sceneIndex, "node");
  if (!nodeOk) {
    DialogLoadingClose();
    updateSimulationStatusForScene(sceneIndex, "error", "场景 " + (sceneIndex) + " 未收到节点信息");
    DialogText("未收到场景 " + (sceneIndex) + " 节点信息，请确认对应 ns-3 已运行");
    console.warn("刷新节点信息超时，场景 " + sceneIndex + " 未收到数据");
    return false;
  }

  console.log("场景 " + sceneIndex + " 节点信息接收成功");
  if (flag.activeSceneIndex === sceneIndex) {
    let adjustCamera = 1;
    Object.values(nodeDics[sceneIndex].nodes).forEach((node) => {
      idDics[sceneIndex].ids[node.nodeID] = node.nodeID;
      hashIPDics[sceneIndex].ips[node.nodeID] = node.nodeIP;
      if (adjustCamera === 1) {
        cameraCenter(node.realPosition.x, node.realPosition.y);
        adjustCamera++;
      }
    });
    printCurrentSceneUavCount();
  }

  DialogLoadingClose();
  console.log("场景 " + sceneIndex + " 节点加载成功");
  return true;
}

export async function postNodeNumInfo() {
  return submitSimulationConfig();
}

// 刷新路由信息
async function reloadRouteInfo(sceneIndex = flag.activeSceneIndex) {
  if (sceneIndex == null) return false;
  routeDics[sceneIndex] = [];
  console.log("刷新场景 " + sceneIndex + " 路由信息");

  const routeOk = await waitForSceneData(sceneIndex, "route");
  if (!routeOk) {
    DialogLoadingClose();
    updateSimulationStatusForScene(sceneIndex, "error", "场景 " + (sceneIndex) + " 未收到路由指标");
    DialogText("未收到场景 " + (sceneIndex) + " 路由指标，请确认对应 ns-3 已运行");
    console.warn("刷新路由信息超时，场景 " + sceneIndex + " 未收到数据");
    return false;
  }

  console.log("场景 " + sceneIndex + " 路由信息接收成功");
  if (flag.activeSceneIndex === sceneIndex) {
    QuestChartData();
  }
  DialogLoadingClose();
  return true;
}

// 刷新分簇指标
async function reloadClusterInfo(sceneIndex = flag.activeSceneIndex) {
  if (sceneIndex == null) return false;
  clusterDics[sceneIndex] = [];
  console.log("刷新场景 " + sceneIndex + " 分簇指标");

  const clusterOk = await waitForSceneData(sceneIndex, "cluster");
  if (!clusterOk) {
    DialogLoadingClose();
    updateSimulationStatusForScene(
      sceneIndex,
      "error",
      "场景 " + sceneIndex + " 未收到分簇指标"
    );
    DialogText("未收到场景 " + sceneIndex + " 分簇指标，请确认对应 ns-3 已运行");
    console.warn("刷新分簇指标超时，场景 " + sceneIndex + " 未收到数据");
    return false;
  }

  if (flag.activeSceneIndex === sceneIndex) {
    QuestClusterChartData();
  }
  DialogLoadingClose();
  return true;
}

/* 以下是等待四个数据类型接收成功的函数 */

function productWaitForFlag(name) {
  return async function () {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (dataFlag.name) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100); // 每100ms检查一次
    });
  };
}

//节点信息延迟（返回 true=收到数据，false=超时）
async function waitForFlagNode(timeoutMs = 10000) {
  console.log(dataFlag.node);
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const checkInterval = setInterval(() => {
      if (dataFlag.node) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startedAt > timeoutMs) {
        // 修复：后端不可达时原先会永久挂起，这里超时放行并报告失败
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100); // 每100ms检查一次
  });
}

export async function waitForFlagRoute(timeoutMs = 10000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const checkInterval = setInterval(() => {
      //console.log(dataFlag.route);
      if (dataFlag.route) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startedAt > timeoutMs) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100); // 每100ms检查一次
  });
}
