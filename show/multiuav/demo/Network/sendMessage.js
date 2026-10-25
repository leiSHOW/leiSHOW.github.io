import { HttpClass } from "./httpClass.js";
import { WebSocketClass } from "./websocketClass.js";
import {
  nodeDics,
  routeDics,
  macDics,
  clusterDics,
  flag,
  changePage,
  removeNodeObject,
} from "../Move/viewControl.js";
import { QuestChartData, QuestMacChartData, QuestClusterChartData } from "../dataForm/chart.js";
import { ClusterNode, ClusterMetrics } from "../Data/ShowInfo.js";
import { normalizePublicAlgorithm } from "../Data/algorithmNames.js";
import { loadObjByData } from "../Model/model.js"
import {DialogLoadingOpen,DialogLoadingClose,DialogText} from '../Move/Dialog.js'

//标识是否收到对应的数据
export const dataFlag = {
  node: false,
  cluster: false,
  route: false,
  mac: false,
  basicInfo:false,
};

const latestSnapshotIds = new Map();
const latestClusterSnapshotIds = new Map();
const sceneDataFlags = new Map();

export function resetSceneDataFlags(sceneIndex) {
  sceneDataFlags.set(String(sceneIndex), { node: false, cluster: false, route: false, mac: false });
}

export function hasSceneDataFlag(sceneIndex, type) {
  return Boolean(sceneDataFlags.get(String(sceneIndex))?.[type]);
}

function markSceneData(sceneIndex, type) {
  const key = String(sceneIndex);
  if (!sceneDataFlags.has(key)) resetSceneDataFlags(sceneIndex);
  sceneDataFlags.get(key)[type] = true;
  dataFlag[type] = true;
  window.dispatchEvent(new CustomEvent("middleware:scene-data", {
    detail: { sceneIndex, type }
  }));
}
export function resetNodeSnapshotState(sceneIndex) {
  if (sceneIndex === undefined || sceneIndex === null) {
    latestSnapshotIds.clear();
    latestClusterSnapshotIds.clear();
    return;
  }
  const prefix = String(sceneIndex) + ":";
  for (const key of latestSnapshotIds.keys()) {
    if (String(key).startsWith(prefix)) latestSnapshotIds.delete(key);
  }
  for (const key of latestClusterSnapshotIds.keys()) {
    if (key.startsWith(prefix)) latestClusterSnapshotIds.delete(key);
  }
}

// 仅作为旧版消息（没有 sceneId）时的兼容索引。
// 新版消息必须依赖显式 sceneId，不能再把算法名称硬编码成场景编号，
// 因为同一种算法可以被提交到任意目标场景。
const sceneRouteBindings = new Map();

export function registerSceneRoute(sceneIndex, route) {
  const index = normalizeSceneIndex(sceneIndex);
  const rawName = String(route ?? "").trim();
  const name = normalizePublicAlgorithm(rawName) ?? rawName;
  if (index === undefined || !name) return;
  sceneRouteBindings.set(index, name);
}
// 簇节点 数据结构定义
class SendClusterNode {
  constructor() {
    this.data = []; // 初始化 data 为一个空数组
    this.type = null; // 定义通信形式http / ws
  }

  // 添加 ClusterNode 到数组的方法
  addClusterNode(node) {
    this.data.push(node);
  }

  // 指定方式
  specifiedType(type) {
    this.type = type;
  }

  clear() {
    this.data = [];
    this.type = null;
  }

  toJsons() {
    return JSON.stringify(this.data);
  }
}

// 路由指标 数据结构定义
class SendRoutingMetrics {
  constructor() {
    this.data = []; // 初始化 data 为一个空数组
    this.type = null; // 定义通信形式http / ws
  }

  // 添加 ClusterNode 到数组的方法
  addClusterNode(node) {
    this.data.push(node);
  }

  // 指定方式
  specifiedType(type) {
    this.type = type;
  }

  clear() {
    this.data = [];
    this.type = null;
  }

  toJsons() {
    return JSON.stringify(this.data);
  }
}

// 定义存储数据的全局变量
const sendClusterNode = new SendClusterNode();
const sendRoutingMetrics = new SendRoutingMetrics();
// const sendMacMetrics = new SendMacMetrics();
// 定义ws网络链接
let ws = null;
// 修复：native 中间件每条 WebSocket 连接只维护一个订阅（新的 wsN 会停掉
// 之前的订阅），因此节点(ws1)、路由指标(ws3)必须分两条连接分别订阅。
let wsRoute = null;
let wsFlat = null;
let wsClusterMetrics = null;
// MAC 指标通道（ws4）：与节点/路由指标同理，单独一条连接订阅
let wsMac = null;

// 取得全局簇节点信息
export async function getClusterNode(basepath, par) {
  const http = new HttpClass(basepath);
  const info = await http.post({}, par);
  if (info?.code === 200) {
    // HTTP 刷新复用 WebSocket 的场景路由、快照去重与完整快照对账逻辑，
    // 避免把其他场景的最新快照误写到当前活动场景。
    wsHandleMessage({
      ...info,
      type: par?.toLowerCase().includes("flatnode") ? "flatnode" : "clusternode",
    });
    return info.data;
  }
  return "None";
}

// 推送全局节点数据
export async function postClusterNode(basepath, par) {
  sendClusterNode.clear();
  sendClusterNode.specifiedType("http");
  for (let [key, value] of Object.entries(
    nodeDics[flag.activeSceneIndex].nodes
  )) {
    sendClusterNode.addClusterNode(value);
  }

  const http = new HttpClass(basepath);
  const info = await http.post(JSON.stringify(sendClusterNode), par);
  if (info?.code === 200) {
    return info.data;
  }
}

// 取得全局分簇指标信息
export async function getClusterMetrics(basepath, par) {
  const http = new HttpClass(basepath);
  const info = await http.post({}, par);
  if (info?.code === 200) {
    wsHandleMessage({
      ...info,
      type: "clustermetrics",
      sceneId: info.sceneId ?? flag.activeSceneIndex,
      algorithm: info.algorithm ?? info.route ?? getRouteFromUI(),
    });
    return info.data;
  }
  return "None";
}
// // 发送全局簇指标信息
// export async function postClusterMetrics(basepath, par) {
//   sendClusterMetrics.clear();
//   sendClusterMetrics.specifiedType("http");
//   for (let [key, value] of Object.entries(
//     routeDics[flag.activeSceneIndex].route
//   )) {
//     sendClusterMetrics.addClusterNode(value);
//   }
//   const http = new HttpClass(basepath);
//   const info = await http.post(JSON.stringify(sendClusterMetrics), par);
//   if (info?.code === 200) {
//     return info.data;
//   }
// }

export function isFlatRoute(route = getRouteFromUI()) {
  return route === "FQ" || route === "RHAPMMGPSR";
}

export function getNodeEndpoint(route = getRouteFromUI()) {
  return isFlatRoute(route) ? "/data/GetFlatnode" : "/data/GetClusternode";
}

export async function postSimulationConfig(basepath, config) {
  registerSceneRoute(config?.sceneIndex, config?.algorithm);
  const http = new HttpClass(basepath);
  return await http.post({
    revision: Number(config.revision) || Date.now(),
    data: { ...config }
  }, "/control/simulation-config");
}
// 取得全局路由指标
export async function getRoutingMetrics(basepath, par) {
  const http = new HttpClass(basepath);
  // 修复：与 getClusterNode 一致，Get* 走 POST 空体
  const info = await http.post({}, par);
  if (info?.code === 200) {
    for (let i of info.data) {
      routeDics[flag.activeSceneIndex].push(i); // 指标有ID吗？暂时先用0存储
    }
    //console.log(routeDics[flag.activeSceneIndex]);
    dataFlag.route = true; //标识分簇信息成功接收
    return info.data;
  }
  return "None";
}
// 发送全局路由指标信息
export async function postRoutingMetrics(basepath, par) {
  sendRoutingMetrics.clear();
  sendRoutingMetrics.specifiedType("http");
  for (const value of routeDics[flag.activeSceneIndex] ?? []) {
    sendRoutingMetrics.addClusterNode(value);
  }
  const http = new HttpClass(basepath);
  const info = await http.post(JSON.stringify(sendRoutingMetrics), par);
  if (info?.code === 200) {
    return info.data;
  }
}

// getClusterNode('http://127.0.0.1:8080', '/clusternode');

// 建立ws链接（兼容入口：仅节点通道）
// 每种信息建立一个单独的ws，还是所有信息共用一个ws?
export function wsStart(basepath) {
  basicConnect(basepath);
}

// ws发送信息
export async function wsSendMessage(path = "") {
  sendClusterNode.clear();
  sendClusterNode.specifiedType("ws" + path);
  for (let [key, value] of Object.entries(
    nodeDics[flag.activeSceneIndex].nodes
  )) {
    sendClusterNode.addClusterNode(value);
  }
  ws.sendMessage(JSON.stringify(sendClusterNode), path);
}

function normalizeSceneIndex(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).replace(/^scene[-_]/i, "");
  const index = Number(text);
  return Number.isInteger(index) && index >= 0 && index <= 3 ? index : undefined;
}

function resolveMessageSceneIndex(message, fallbackRoute) {
  const direct = normalizeSceneIndex(message?.sceneId ?? message?.sceneIndex);
  if (direct !== undefined) return direct;

  // 兼容旧版后端：只有当当前路由在前端注册后唯一对应一个场景时才回退。
  // 若多个场景使用同一算法，则不猜测，避免把场景 1 的指标写入场景 0。
  const candidates = Array.from(sceneRouteBindings.entries())
    .filter(([, route]) => route === fallbackRoute)
    .map(([sceneIndex]) => sceneIndex);
  if (candidates.length === 1) return candidates[0];
  // 没有 sceneId 且无法唯一推断时不再按当前活动场景猜测，避免串场。
  return undefined;
}

function normalizeMetricFrames(message, fallbackRoute) {
  const raw = Array.isArray(message?.data) ? message.data : [];
  if (!raw.length) {
    return [{
      envelope: message,
      data: [],
      route: resolveMessageRoute(message) ?? fallbackRoute,
      sceneId: message?.sceneId ?? message?.sceneIndex
    }];
  }

  return raw.map((item) => {
    if (item && typeof item === "object" && Array.isArray(item.data)) {
      return {
        envelope: item,
        data: item.data,
        route: resolveMessageRoute(item) ?? fallbackRoute,
        sceneId: item.sceneId ?? item.sceneIndex ?? message?.sceneId ?? message?.sceneIndex
      };
    }
    return {
      envelope: item && typeof item === "object" ? item : message,
      data: [item],
      route: resolveMessageRoute(item) ?? fallbackRoute,
      sceneId: item?.sceneId ?? item?.sceneIndex ?? message?.sceneId ?? message?.sceneIndex
    };
  });
}

function dispatchSceneRunning(sceneIndex, message) {
  window.dispatchEvent(new CustomEvent("middleware:simulation-status", {
    detail: { state: "running", sceneIndex, message }
  }));
}

export function wsHandleMessage(rawMessage) {
  let message = rawMessage;
  if (typeof message === "string") {
    try {
      message = JSON.parse(message);
    } catch (error) {
      console.warn("消息不是有效的 JSON 格式:", message);
      return rawMessage;
    }
  }
  if (!message || typeof message !== "object") return message;
  if (Number(message.code) !== 200) {
    console.log("收到服务器错误消息:", message);
    return message;
  }

  const route = resolveMessageRoute(message);

  if (message.type === "clusternode" || message.type === "flatnode") {
    const sceneIndex = resolveMessageSceneIndex(message, route);
    if (sceneIndex === undefined) {
      console.warn("节点消息缺少有效 sceneId/route:", message);
      return message;
    }

    const nodeList = Array.isArray(message.data) ? message.data : [];
    const nodes = nodeDics[sceneIndex] ?? (nodeDics[sceneIndex] = { nodes: {} });
    if (!nodes.nodes) nodes.nodes = {};

    const publicAlgorithm = normalizePublicAlgorithm(route) ?? String(route ?? "");
    const snapshotKey = String(sceneIndex) + ":" + publicAlgorithm;
    const snapshotId = Number(message.snapshotId);
    const previousSnapshotId = latestSnapshotIds.get(snapshotKey) ?? 0;
    if (
      message.snapshot === true &&
      Number.isFinite(snapshotId) &&
      snapshotId <= previousSnapshotId
    ) {
      console.debug("忽略过期节点快照", { sceneIndex, snapshotId, previousSnapshotId });
      return message;
    }
    if (message.snapshot === true && Number.isFinite(snapshotId)) {
      latestSnapshotIds.set(snapshotKey, snapshotId);
    }

    if (message.snapshot === true) {
      const incomingNodeIds = new Set(
        nodeList
          .filter((item) => item?.nodeID !== undefined && item?.nodeID !== null)
          .map((item) => String(item.nodeID))
      );
      for (const existingNodeId of Object.keys(nodes.nodes)) {
        if (incomingNodeIds.has(existingNodeId)) continue;
        delete nodes.nodes[existingNodeId];
        removeNodeObject(sceneIndex, existingNodeId);
        window.dispatchEvent(new CustomEvent("middleware:node-removed", {
          detail: { sceneIndex, nodeId: existingNodeId }
        }));
      }
    }

    for (const item of nodeList) {
      if (!item || item.nodeID === undefined || item.nodeID === null) continue;
      const key = String(item.nodeID);
      const node = new ClusterNode(item);
      if (flag.activeSceneIndex === sceneIndex) loadObjByData(node);
      nodes.nodes[key] = node;
      window.dispatchEvent(new CustomEvent("middleware:node-updated", {
        detail: { sceneIndex, nodeId: key, node }
      }));
    }

    changePage[0] = 0;
    markSceneData(sceneIndex, "node");
    markBasicInfoReady();
    dispatchSceneRunning(sceneIndex, "场景 " + sceneIndex + " 已收到节点快照");
    console.log(
      "收到 " + message.type + " 快照：" + nodeList.length +
      " 个节点，场景 " + sceneIndex + "，算法 " + route
    );
    return message;
  }

  if (message.type === "clustermetrics") {
    const frames = normalizeMetricFrames(message, route);
    const handledScenes = new Set();

    for (const frame of frames) {
      const publicAlgorithm =
        normalizePublicAlgorithm(
          frame.envelope?.algorithm ?? frame.route ?? route
        ) ?? String(frame.envelope?.algorithm ?? frame.route ?? route ?? "");
      const sceneIndex = resolveMessageSceneIndex(frame, publicAlgorithm);
      if (sceneIndex === undefined) {
        console.warn("分簇指标消息缺少有效 sceneId/algorithm:", frame);
        continue;
      }

      const snapshotId = Number(
        frame.envelope?.snapshotId ??
        frame.data?.[0]?.snapshotId ??
        message.snapshotId
      );
      const snapshotKey = String(sceneIndex) + ":" + publicAlgorithm;
      const previousSnapshotId = latestClusterSnapshotIds.get(snapshotKey) ?? 0;
      if (Number.isFinite(snapshotId) && snapshotId <= previousSnapshotId) {
        console.debug("忽略过期分簇指标快照", {
          sceneIndex,
          publicAlgorithm,
          snapshotId,
          previousSnapshotId,
        });
        continue;
      }
      if (Number.isFinite(snapshotId)) {
        latestClusterSnapshotIds.set(snapshotKey, snapshotId);
      }

      if (!Array.isArray(clusterDics[sceneIndex])) clusterDics[sceneIndex] = [];
      const metrics = (Array.isArray(frame.data) ? frame.data : [])
        .filter((item) => item && typeof item === "object")
        .map((item) => new ClusterMetrics({
          ...item,
          sceneId: frame.sceneId ?? String(sceneIndex),
          algorithm: publicAlgorithm,
          snapshotId: Number.isFinite(snapshotId) ? snapshotId : item.snapshotId,
          sampleTime: item.sampleTime ?? frame.envelope?.sampleTime,
        }));
      if (!metrics.length) continue;

      clusterDics[sceneIndex].push(...metrics);
      if (clusterDics[sceneIndex].length > 120) {
        clusterDics[sceneIndex].splice(0, clusterDics[sceneIndex].length - 120);
      }
      handledScenes.add(sceneIndex);
      markSceneData(sceneIndex, "cluster");
      if (flag.activeSceneIndex === sceneIndex) QuestClusterChartData();
    }

    for (const sceneIndex of handledScenes) {
      markBasicInfoReady();
      dispatchSceneRunning(sceneIndex, "场景 " + sceneIndex + " 已收到分簇指标");
    }
    console.log("分簇指标已按 sceneId 分发到场景:", Array.from(handledScenes));
    return message;
  }

  if (message.type === "routingmetrics") {
    const frames = normalizeMetricFrames(message, route);
    const handledScenes = new Set();
    for (const frame of frames) {
      const frameRoute = frame.route || route;
      const sceneIndex = resolveMessageSceneIndex(frame, frameRoute);
      if (sceneIndex === undefined) continue;
      if (!Array.isArray(routeDics[sceneIndex])) routeDics[sceneIndex] = [];
      routeDics[sceneIndex].push(...(Array.isArray(frame.data) ? frame.data : []));
      handledScenes.add(sceneIndex);
      markSceneData(sceneIndex, "route");
      if (flag.activeSceneIndex === sceneIndex) QuestChartData();
    }
    for (const sceneIndex of handledScenes) {
      markBasicInfoReady();
      dispatchSceneRunning(sceneIndex, "场景 " + sceneIndex + " 已收到路由指标");
    }
    console.log("路由指标已按 sceneId 分发到场景:", Array.from(handledScenes));
    return message;
  }

  if (message.type === "macmetrics") {
    const frames = normalizeMetricFrames(message, route);
    const handledScenes = new Set();
    const toNum = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    for (const frame of frames) {
      const sceneIndex = resolveMessageSceneIndex(frame, frame.route || route);
      if (sceneIndex === undefined) continue;
      if (!macDics[sceneIndex] || typeof macDics[sceneIndex] !== "object") {
        macDics[sceneIndex] = { mac: { qos: {}, noQos: {} }, history: [] };
      }
      if (!macDics[sceneIndex].mac) {
        macDics[sceneIndex].mac = { qos: {}, noQos: {} };
      }
      if (!Array.isArray(macDics[sceneIndex].history)) {
        macDics[sceneIndex].history = [];
      }

      const entries = Array.isArray(frame.data) ? frame.data : [];
      const snapshot = entries.map((entry) => {
        const datas = entry?.datas ?? entry?.allocatedDatas ?? {};
        return {
          priority: String(entry?.priority ?? "average"),
          delay: toNum(datas.delay),
          utilization: toNum(datas.channelUtilization ?? datas.ChannelUtilization),
          loss: toNum(datas.packetLossRatio ?? datas.PacketLossRatio),
          throughput: toNum(datas.throughput ?? datas.Throughput),
        };
      });
      const bucket = snapshot.some((item) => /^p[1-4]$/i.test(item.priority))
        ? "qos"
        : "noQos";
      snapshot.forEach((item) => {
        macDics[sceneIndex].mac[bucket][item.priority] = item;
      });
      macDics[sceneIndex].history.push({
        time: Date.now(),
        entries: snapshot
      });
      if (macDics[sceneIndex].history.length > 60) {
        macDics[sceneIndex].history.shift();
      }
      handledScenes.add(sceneIndex);
      markSceneData(sceneIndex, "mac");

      if (flag.activeSceneIndex === sceneIndex) {
        QuestMacChartData();
        const badge = document.getElementById("mac-qos-badge");
        if (badge) {
          badge.dataset.qos = bucket === "qos" ? "yes" : "no";
          badge.textContent = bucket === "qos" ? "QoS (qosmac)" : "无QoS (eemac)";
        }
      }
    }

    for (const sceneIndex of handledScenes) {
      markBasicInfoReady();
      dispatchSceneRunning(sceneIndex, "场景 " + sceneIndex + " 已收到 MAC 指标");
    }
    console.log("MAC指标已按 sceneId 分发到场景:", Array.from(handledScenes));
    return message;
  }

  console.log("收到未处理的服务器消息:", message);
  return message;
}
export function wsClose() {
  // 同时关闭分簇节点、平面节点、路由指标和 MAC 指标四条通道。
  for (const socket of [ws, wsFlat, wsClusterMetrics, wsRoute, wsMac]) {
    if (socket != null) {
      socket.isManualClose = true;
      socket.close();
    }
  }
  ws = null;
  wsFlat = null;
  wsClusterMetrics = null;
  wsRoute = null;
  wsMac = null;
  connectedBasePath = null;
}

// ws重新链接
let connectedBasePath = null;

export function basicConnect(basepath) {
  currentRoute = getRouteFromUI();
  dataFlag.basicInfo = false;

  // 多个场景共用同一个 middleware 数据通道；只有地址变化时才重建连接。
  if (
    connectedBasePath === basepath &&
    ws != null &&
    wsFlat != null &&
    wsClusterMetrics != null &&
    wsRoute != null &&
    wsMac != null
  ) {
    return;
  }

  wsClose();
  connectedBasePath = basepath;
  ws = new WebSocketClass(basepath, "ws1");
  wsFlat = new WebSocketClass(basepath, "ws5");
  wsClusterMetrics = new WebSocketClass(basepath, "ws2");
  wsRoute = new WebSocketClass(basepath, "ws3");
  wsMac = new WebSocketClass(basepath, "ws4");

  console.log("已建立并行数据订阅连接:", {
    route: currentRoute,
    subscriptions: ["ws1", "ws5", "ws2", "ws3", "ws4"]
  });
}
// 仅在兼容缺少算法元数据的旧消息时，使用建连时的界面选项作为回退。
let currentRoute = null;

function getRouteFromUI() {
  const routeSelect = document.getElementById("base-config-deal");
  return routeSelect?.value?.trim() || null;
}

function resolveMessageRoute(message) {
  const rawName = message?.algorithm ?? message?.route ?? currentRoute ?? getRouteFromUI();
  return normalizePublicAlgorithm(rawName) ?? rawName ?? null;
}

function markBasicInfoReady() {
  dataFlag.basicInfo = true;
  DialogLoadingClose();
}
