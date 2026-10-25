import * as THREE from "three";
import { createGround, GROUND_COLOR } from "./SceneSetting.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  showMenuClicked,
  showBaseInfo,
  showClusterInfo,
} from "./MenuSetting.js";
import { closeMenuButtonFun } from "./MenuSetting.js";
import { vector } from "../Data/ShowInfo.js";
import { DialogText } from "./Dialog.js";
import { loadModels,drageObject,createModel,loadObjByData } from "../Model/model.js";

import { QuestChartData, QuestMacChartData, QuestClusterChartData } from "../dataForm/chart.js";
import {loadSceneAndCamera} from "../Data/dataSave.js"
// 当前场景和相机列表及全局参数设置
export const scenes = []; //存储所有场景
const cameras = []; //存储所有相机
export const nodeDics = []; //存储所有场景的节点信息字典
export const hashIPDics = []; //存储所有场景的ip的hash表
export const pathDics = []; //存储所有连接路径字典
export const routeDics = []; //存储所有路由信息字典
export const clusterDics = []; //存储所有分簇信息字典
export const idDics = []; //存储所有id信息的hash表
export const macDics = []; // 存储mac层信息的表
export const clusterHeadList=[];//存储簇头簇成员对应的列表
// ===== 统一节点判定（鸭子类型） =====
// 说明：经 localStorage 存档恢复的网格，其 geometry 反序列化后不再是
// PlaneGeometry 实例；若用 instanceof 过滤会把"看板上明明有"的节点当成
// 不存在（搜索/悬停/计数/动画全部失效）。这里改按特征判定。
function isNodeMesh(obj) {
  return (
    !!obj &&
    !!obj.geometry &&
    !!obj.userData &&
    obj.userData.id !== undefined &&
    obj.userData.id !== null &&
    obj.userData.id !== "ground"
  );
}

// ===== 节点角色视觉：不同角色持久彩色边框 + 簇头金色光环 =====
const ROLE_COLORS = {
  head: 0xffb300,   // 簇头：琥珀金（最显眼）
  member: 0x0a84ff, // 簇成员：蓝
  guest: 0x9e9e9e,  // 访客：灰
  other: 0xaf52de,  // 其他/未知角色：紫
};
/**
 * 判定节点角色。优先使用后端 nodeStatus 字符串
 * （CLUSTER_HEAD/CLUSTER_MEMBER/CLUSTER_GUEST）；
 * 兼容无 nodeStatus 的旧数据：clusterHeadID 包含自身 id 视为簇头。
 */
function roleOf(node) {
  const status = String(node?.nodeStatus ?? "").toUpperCase();
  if (status === "CLUSTER_HEAD" || status === "CLUSTERHEAD") return "head";
  if (status === "CLUSTER_MEMBER") return "member";
  if (status === "CLUSTER_GUEST" || status === "GUEST") return "guest";
  if (Array.isArray(node?.clusterHeadID)) {
    const selfId = String(node?.nodeID ?? "");
    if (selfId && node.clusterHeadID.map(String).includes(selfId)) return "head";
  }
  return "other";
}
// 角色视觉注册表：sceneIndex -> Map(节点id字符串 -> {obj, box, ring, role})
const roleVisuals = new Map();

function createHeadRing(scene) {
  const geometry = new THREE.RingGeometry(20, 27, 48);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffc400,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(geometry, material);
  scene.add(ring);
  return ring;
}

function disposeRoleEntry(scene, entry) {
  if (entry.box) {
    scene.remove(entry.box);
    entry.box.geometry?.dispose();
    entry.box.material?.dispose();
  }
  if (entry.ring) {
    scene.remove(entry.ring);
    entry.ring.geometry.dispose();
    entry.ring.material.dispose();
  }
}

/**
 * 每帧调用：为当前场景所有节点维护角色边框与簇头光环。
 * 边框通过 BoxHelper.update() 跟随节点移动；节点消失/换场景时自动清理，
 * 节点对象被重建（如数据刷新）或角色变化时自动重建对应视觉元素。
 */
function updateRoleVisuals(elapsed) {
  if (flag.activeSceneIndex == null || !scenes[flag.activeSceneIndex]) return;
  const sceneIndex = flag.activeSceneIndex;
  const scene = scenes[sceneIndex].scene;
  let visuals = roleVisuals.get(sceneIndex);
  if (!visuals) {
    visuals = new Map();
    roleVisuals.set(sceneIndex, visuals);
  }

  const present = new Set();
  scene.children.forEach((obj) => {
    if (!isNodeMesh(obj)) return;
    const key = String(obj.userData.id);
    present.add(key);
    const node = nodeDics[sceneIndex]?.nodes?.[obj.userData.id];
    const role = roleOf(node);

    let entry = visuals.get(key);
    // 节点对象被重建、或角色发生变化时，销毁重建视觉元素
    if (entry && (entry.obj !== obj || entry.role !== role)) {
      disposeRoleEntry(scene, entry);
      visuals.delete(key);
      entry = null;
    }
    if (!entry) {
      const box = new THREE.BoxHelper(obj, ROLE_COLORS[role]);
      box.material.transparent = true;
      box.material.opacity = role === "head" ? 1.0 : 0.8;
      scene.add(box);
      const entryNew = { obj, box, ring: null, role };
      if (role === "head") entryNew.ring = createHeadRing(scene); // 簇头自带显眼光环
      visuals.set(key, entryNew);
      entry = entryNew;
    }
    // 每帧更新：边框跟随节点当前位置
    entry.box.update();
    if (entry.ring) {
      entry.ring.position.set(obj.position.x, obj.position.y, obj.position.z - 2);
      const pulse = 1 + 0.18 * Math.sin(elapsed * 3 + obj.position.x * 0.01);
      entry.ring.scale.set(pulse, pulse, 1);
    }
  });

  // 清理已不存在的节点的视觉元素
  for (const [key, entry] of Array.from(visuals)) {
    if (!present.has(key)) {
      disposeRoleEntry(scene, entry);
      visuals.delete(key);
    }
  }
}
export const DEFAULT_SCENE_NAME = "待修改场景名称";
export const SCENE_COUNT = 4;
const sceneStatusMessages = new Map();

function normalizeSceneIndex(value) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < SCENE_COUNT ? index : undefined;
}

export function updateSceneStatus(sceneIndex, message, state = "idle") {
  const index = normalizeSceneIndex(sceneIndex);
  if (index === undefined) return;
  const text = String(message || "等待仿真数据");
  sceneStatusMessages.set(index, { message: text, state });
  const status = sceneList?.querySelector(`[data-scene-index="${index}"] .scene-item-status`);
  if (!status) return;
  status.textContent = text;
  status.className = "scene-item-status";
  if (state) status.classList.add(`status-${state}`);
}

window.addEventListener("middleware:simulation-status", (event) => {
  const detail = event.detail || {};
  if (detail.sceneIndex === undefined || detail.sceneIndex === null) return;
  updateSceneStatus(detail.sceneIndex, detail.message, detail.state || "idle");
});
var ctreatModelFlag=false;
export const changePage=[0]//标识切换页面
var reloadScene=[0,0,0,0]
//mac数据格式是 macDics.push({ mac: { qos: {}, noQos: {} } });
//也就是 macDics[flag.activeSceneIndex].mac.qos或者noQos["优先级n/average"]
/**
 * {menuOpen: false ,//菜单打开时，其值为true，不允许场景拖动
 *  nullNumber:0, //当前场景未设置变量物体的个数
 *  newObjectName:0,//记录当前未知量的标签，nullNumber为0时重置该变量
 *  outlineBox:null,//该场景中的选中框
 *  activeObject:null,//当前场景中被选中的物体
 *  baseMenu:false,clusterMenu:false,position:null}//当前场景中三个菜单的开启情况及位置记录
 */
export const flags = []; //存储当前场景的展示情况
export const flag = { activeSceneIndex: null }; //记录当前页面的索引值

//组件绑定
const container = document.getElementById("three-container");
const sceneList = document.getElementById("scene-list");
//
const mouseStart = new THREE.Vector2();
const raycaster = new THREE.Raycaster(); // 创建射线投射器
let cameraPosition = new THREE.Vector3();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  1,
  500
);
camera.position.z = 0;
camera.near = 0.1;
camera.far = 100000;
camera.updateProjectionMatrix();
camera.position.set(0, 50, 500);

//监听事件绑定
// 事件在 renderer canvas 上直接监听，避免全局事件的 target/坐标不一致。

// 创建渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
container.appendChild(renderer.domElement);

function resizeRenderer() {
  const width = Math.max(container.clientWidth, 1);
  const height = Math.max(container.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeRenderer, false);
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(resizeRenderer).observe(container);
}
resizeRenderer();
renderer.domElement.addEventListener("contextmenu", onRightMouse, false);

renderer.domElement.addEventListener("mousemove", onMouseMove, false);

//场景的平移和缩放
var controls = new OrbitControls(camera, renderer.domElement);
//canves.addEventListener('wheel',(event)=>{})
controls.target.set(0, 10, 0);
controls.enablePan = true;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN, // 左键平移
  MIDDLE: THREE.MOUSE.DOLLY, // 中键缩放（可选）
};
controls.panSpeed = 0.5;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.update();

// 添加新场景的函数及添加工具栏
function addScene(e) {
  /*场景初始化*/
  var newScene = new THREE.Scene();
  newScene.name = ["协同巡航", "基础分簇", "消融观察", "大规模节点"][scenes.length] || DEFAULT_SCENE_NAME;
  newScene.background = new THREE.Color(GROUND_COLOR);
  //newScene.background = new THREE.Color(0x2b3e50);
  // 创建环境光
  var ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  newScene.add(ambientLight);
  // 设置场景
  var groundSize = 1000000;
  var ground = createGround(groundSize);
  ground.userData.id = "ground";
  buildGroundDecor(ground); // 挂载XY坐标网格/标尺（挂在ground下，场景刷新时不会被清掉）
  newScene.add(ground);
  //const axesHelper = new THREE.AxesHelper(100);
  //newScene.add(axesHelper);
  //初始化新场景保存数据的数组
  idDics.push({ ids: {} });
  nodeDics.push({ nodes: {} });
  routeDics.push([]);
  clusterDics.push([]);
  hashIPDics.push({ ips: {} });
  macDics.push({ mac: { qos: {}, noQos: {} }, history: [] }); // MAC指标历史（与场景索引对齐）
  pathDics.push({
    pathHttpRoot: "http://172.25.129.21:8088",
    pathWsRoot: "ws://172.25.129.21:12345",
    pathChild: "",
  });
  //pathDics.push({pathHttpRoot:"http://127.0.0.1:8080",pathWsRoot:"ws://localhost:8080",pathChild:""});
  flags.push({
    menuOpen: false,
    nullNumber: 0,
    newObjectName: 0,
    outlineBox: null,
    activeObject: null,
    baseMenu: false,
    clusterMenu: false,
    position: { x: 0, y: 0 },
  });
  // 添加场景和场景参数
  scenes.push({ scene: newScene });
  cameras.push(camera.clone());
  /*物体栏拖动逻辑 */
  drageObject(raycaster,renderer,camera);
  // 更新场景列表
  updateSceneList();
}

// 将画布事件坐标转换为 Three.js 归一化设备坐标。
function updatePointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  mouseStart.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseStart.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return true;
}

// 鼠标右击事件
function findNodeFromIntersections(intersections) {
  for (const intersection of intersections ?? []) {
    let object = intersection?.object;
    while (object) {
      if (isNodeMesh(object)) return object;
      object = object.parent;
    }
  }
  return null;
}

function getNodeAtEvent(event) {
  if (!updatePointerFromEvent(event)) return null;
  raycaster.setFromCamera(mouseStart, camera);

  if (flag.activeSceneIndex == null) return null;
  const scene = scenes[flag.activeSceneIndex]?.scene;
  return findNodeFromIntersections(
    raycaster.intersectObjects(scene?.children ?? [], true)
  );
}

function openNodeMenu(event) {
  const clickedObject = getNodeAtEvent(event);
  if (!clickedObject) return false;

  const scene = scenes[flag.activeSceneIndex].scene;
  const sceneFlags = flags[flag.activeSceneIndex];
  if (sceneFlags.outlineBox) {
    scene.remove(sceneFlags.outlineBox);
  }

  sceneFlags.outlineBox = new THREE.BoxHelper(clickedObject, 0xffffff);
  scene.add(sceneFlags.outlineBox);
  sceneFlags.activeObject = clickedObject;
  showMenuClicked(event, clickedObject.userData.id);
  return true;
}

function onRightMouse(event) {
  event.preventDefault();
  openNodeMenu(event);
}

//鼠标移动事件——悬停检测：鼠标移到簇头节点上时，显示该簇头到其所有簇成员的连线
function onMouseMove(event){
  if (!updatePointerFromEvent(event)) return;
  raycaster.setFromCamera(mouseStart, camera);

  // 修复：原实现每次鼠标移动都为同簇节点重建 BoxHelper 高亮框，
  // 且只在下一次鼠标移动时才移除——节点移动而鼠标静止时颜色框会卡死在原地。
  // 现改为：角色边框由 updateRoleVisuals 每帧统一维护（见 animate），
  // 鼠标移动只负责检测悬停的簇头并触发簇成员连线。
  let headId = null;
  if (flag.activeSceneIndex != null) {
    const intersects = raycaster.intersectObjects(
      scenes[flag.activeSceneIndex].scene.children
    );
    if (intersects.length > 0) {
      const hoveredObject = intersects[0].object;
      if (
        isNodeMesh(hoveredObject)
      ) {
        const node = nodeDics[flag.activeSceneIndex]?.nodes?.[hoveredObject.userData.id];
        if (node && roleOf(node) === "head") {
          headId = hoveredObject.userData.id;
        }
      }
    }
  }
  setHoveredHead(headId);
}

// ===== 悬停簇头 → 名下簇成员连线 =====
let hoveredHeadId = null;   // 当前悬停的簇头节点 id（非簇头时为 null）
let clusterLinkLines = null; // 复用的连线对象
let clusterLinkKey = "";     // 成员集合签名（成员集变化时重建几何）

function setHoveredHead(headId) {
  // 统一转成字符串比较，兼容 number/string 型 id
  const next = headId == null ? null : String(headId);
  const prev = hoveredHeadId == null ? null : String(hoveredHeadId);
  if (next === prev) return;
  hoveredHeadId = next;
  destroyClusterLines();
}

function findNodeObject(scene, id) {
  const target = String(id);
  return scene.children.find(
    (obj) =>
isNodeMesh(obj) &&
      obj.userData.id !== "ground" &&
      String(obj.userData.id) === target
  );
}

export function removeNodeObject(sceneIndex, nodeId) {
  const scene = scenes[sceneIndex]?.scene;
  if (!scene) return false;
  const target = String(nodeId);
  const objects = scene.children.filter(
    (obj) => isNodeMesh(obj) && String(obj.userData.id) === target
  );
  for (const object of objects) {
    scene.remove(object);
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material?.dispose?.());
    } else {
      object.material?.dispose?.();
    }
  }

  const visuals = roleVisuals.get(sceneIndex);
  const visual = visuals?.get(target);
  if (visual) {
    visual.box?.parent?.remove(visual.box);
    visual.ring?.parent?.remove(visual.ring);
    visual.box?.geometry?.dispose?.();
    visual.ring?.geometry?.dispose?.();
    visual.box?.material?.dispose?.();
    visual.ring?.material?.dispose?.();
    visuals.delete(target);
  }

  const sceneFlags = flags[sceneIndex];
  if (sceneFlags?.activeObject &&
      String(sceneFlags.activeObject.userData?.id) === target) {
    sceneFlags.outlineBox?.parent?.remove(sceneFlags.outlineBox);
    sceneFlags.outlineBox = null;
    sceneFlags.activeObject = null;
  }
  if (String(hoveredHeadId) === target) {
    setHoveredHead(null);
  }
  return objects.length > 0;
}

/** 每帧调用：重建/刷新簇头→簇成员连线，端点取节点当前位置，保证随节点一起动 */
function updateClusterLinks() {
  const sceneIndex = flag.activeSceneIndex;
  if (sceneIndex == null || hoveredHeadId == null || !scenes[sceneIndex]) {
    destroyClusterLines();
    return;
  }
  const scene = scenes[sceneIndex].scene;
  const headObj = findNodeObject(scene, hoveredHeadId);
  if (!headObj) {
    destroyClusterLines();
    return;
  }

  // 收集该簇头名下的所有簇成员
  const memberObjs = [];
  scene.children.forEach((obj) => {
    if (!isNodeMesh(obj)) return;
    const nid = obj.userData.id;
    if (String(nid) === String(hoveredHeadId)) return;
    const node = nodeDics[sceneIndex]?.nodes?.[nid];
    if (!node) return;
    const heads = Array.isArray(node.clusterHeadID)
      ? node.clusterHeadID
      : node.clusterHeadID
      ? [node.clusterHeadID]
      : [];
    if (heads.map(String).includes(String(hoveredHeadId))) memberObjs.push(obj);
  });

  // 该簇头名下没有成员（或悬停的不是簇头）时，不保留连线对象
  if (memberObjs.length === 0) {
    destroyClusterLines();
    return;
  }

  // 成员集合变化时重建几何体
  const key = `${hoveredHeadId}|${memberObjs.map((o) => o.userData.id).join(",")}`;
  if (!clusterLinkLines || key !== clusterLinkKey) {
    destroyClusterLines();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(memberObjs.length * 6), 3)
    );
    const material = new THREE.LineBasicMaterial({
      color: 0xffc400,
      transparent: true,
      opacity: 0.9,
    });
    clusterLinkLines = new THREE.LineSegments(geometry, material);
    clusterLinkLines.frustumCulled = false;
    scene.add(clusterLinkLines);
    clusterLinkKey = key;
  }

  // 写入当前端点位置（簇头 z 略降避免与图标重叠闪烁）
  const attr = clusterLinkLines.geometry.attributes.position;
  let offset = 0;
  memberObjs.forEach((obj) => {
    attr.array[offset++] = headObj.position.x;
    attr.array[offset++] = headObj.position.y;
    attr.array[offset++] = headObj.position.z - 1;
    attr.array[offset++] = obj.position.x;
    attr.array[offset++] = obj.position.y;
    attr.array[offset++] = obj.position.z - 1;
  });
  attr.needsUpdate = true;
  clusterLinkLines.visible = memberObjs.length > 0;
}

function destroyClusterLines() {
  if (clusterLinkLines) {
    clusterLinkLines.parent?.remove(clusterLinkLines);
    clusterLinkLines.geometry.dispose();
    clusterLinkLines.material.dispose();
    clusterLinkLines = null;
  }
  clusterLinkKey = "";
}
// 更新场景列表
function syncSceneNameOptions() {
  const select = document.getElementById("base-config-scene");
  if (!select) return;
  for (let index = 0; index < SCENE_COUNT; index += 1) {
    const option = select.options[index] || select.appendChild(document.createElement("option"));
    option.value = String(index);
    option.textContent = `场景 ${index} · ${scenes[index]?.scene?.name || DEFAULT_SCENE_NAME}`;
  }
}
function updateSceneList() {
  if (!sceneList) return;
  sceneList.innerHTML = "";
  scenes.forEach((item, index) => {
    const li = document.createElement("li");
    li.dataset.sceneIndex = String(index);
    li.classList.add("view_item");
    li.addEventListener("click", () => setActiveScene(index));

    const sceneName = item.scene.name || DEFAULT_SCENE_NAME;
    if (!item.scene.name) item.scene.name = DEFAULT_SCENE_NAME;
    const copy = document.createElement("div");
    copy.className = "scene-item-copy";

    const title = document.createElement("div");
    title.className = "scene-item-title";
    title.textContent = `场景${index} · ${sceneName}`;
    copy.appendChild(title);

    const status = document.createElement("div");
    const savedStatus = sceneStatusMessages.get(index);
    status.className = "scene-item-status";
    status.textContent = savedStatus?.message || "等待仿真数据";
    if (savedStatus?.state) status.classList.add(`status-${savedStatus.state}`);
    copy.appendChild(status);
    li.appendChild(copy);

    const actions = document.createElement("div");
    actions.className = "scene-item-actions";

    const edit = document.createElement("span");
    edit.textContent = "✎";
    edit.title = "编辑场景名称";
    edit.classList.add("iconfont");
    edit.addEventListener("click", (event) => {
      event.stopPropagation();
      const input = document.createElement("input");
      input.type = "text";
      input.value = item.scene.name || DEFAULT_SCENE_NAME;
      input.setAttribute("aria-label", `编辑场景${index}名称`);
      input.addEventListener("click", (e) => e.stopPropagation());
      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        item.scene.name = input.value.trim() || DEFAULT_SCENE_NAME;
        updateSceneList();
      };
      input.addEventListener("blur", commit, { once: true });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") input.blur();
        if (e.key === "Escape") {
          committed = true;
          updateSceneList();
        }
      });
      copy.replaceChild(input, title);
      input.focus();
      input.select();
    });

    const deleteButton = document.createElement("span");
    deleteButton.textContent = "×";
    deleteButton.title = "删除场景";
    deleteButton.classList.add("iconfont");
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteScene(index);
    });

    actions.appendChild(edit);
    actions.appendChild(deleteButton);
    li.appendChild(actions);
    sceneList.appendChild(li);
  });
  syncSceneNameOptions();
}
// 删除场景
function deleteScene(index) {
  scenes.splice(index, 1);
  cameras.splice(index, 1);
  const nextSceneStatuses = new Map();
  sceneStatusMessages.forEach((value, key) => {
    if (key < index) nextSceneStatuses.set(key, value);
    else if (key > index) nextSceneStatuses.set(key - 1, value);
  });
  sceneStatusMessages.clear();
  nextSceneStatuses.forEach((value, key) => sceneStatusMessages.set(key, value));
  // 存储的数据的处理逻辑
  nodeDics.splice(index, 1);
  hashIPDics.splice(index, 1);
  pathDics.splice(index, 1);
  routeDics.splice(index, 1);
  clusterDics.splice(index, 1);
  macDics.splice(index, 1); // MAC指标历史与场景索引保持对齐
  idDics.splice(index, 1);
  flags.splice(index, 1);
  // 如果删除的是当前场景，重置为第一个场景
  if (flag.activeSceneIndex === index) {
    flag.activeSceneIndex = scenes.length > 0 ? 0 : null;
    // console.log(scenes.length);
  } else if (flag.activeSceneIndex > index) {
    flag.activeSceneIndex = flag.activeSceneIndex - 1;
  }
  updateSceneList();
}
// 切换场景
function setActiveScene(index) {
  ctreatModelFlag=true;
  //切换场景后加载当前场景数据以及处理数据
  flag.activeSceneIndex = index;
  window.dispatchEvent(new CustomEvent("scene:active-changed", { detail: { sceneIndex: index } }));
  changePage[0]=0;
  var groundx = scenes[index].scene.children[0];
  var amb = scenes[index].scene.children[1];
  scenes[index].scene.children = [];
  scenes[index].scene.children.push(groundx);
  scenes[index].scene.children.push(amb);
  //加载场景数据
  if(reloadScene[index]==0){
    Object.values(nodeDics[flag.activeSceneIndex].nodes).forEach((node) => {

      createModel(node); //创建物体
      idDics[index].ids[node.nodeID] = node.nodeID; //将id加入id查重表中
      hashIPDics[index].ips[node.nodeID] = node.nodeIP; //将ip加入ip查重表中
      //console.log(node)
    });
    ctreatModelFlag=false;
  }
 
  //加载场景菜单开启情况
  if (flags[index].menuOpen) {
    //主菜单
    var position = flags[index].position;
    var id = flags[index].activeObject.userData.id;
    showMenuClicked(position, id);
    if (flags[index].baseMenu) {
      //子菜单
      showBaseInfo(flags[index].activeObject);
    }
    if (flags[index].clusterMenu) {
      showClusterInfo(flags[index].activeObject);
    }
  } else {
    closeMenuButtonFun();
  }
  //界面切换后图表的数据也要切换
  QuestChartData();
  QuestMacChartData();
  QuestClusterChartData();
}
const clock = new THREE.Clock();
export function activateScene(index) {
  const sceneIndex = Number(index);
  if (!Number.isInteger(sceneIndex) || !scenes[sceneIndex]) return false;
  setActiveScene(sceneIndex);
  return true;
}

// 动画循环,物体移动部分在该处实现
function animate() {
  requestAnimationFrame(animate);
  // 防止模型被拉伸变形
  const canvas = renderer.domElement;
  const width = Math.max(canvas.clientWidth, 1);
  const height = Math.max(canvas.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  // 计算帧时间差（以秒为单位
  const deltaTime = clock.getDelta();
  const elapsed = clock.elapsedTime;
  if (flag.activeSceneIndex !== null) {
    const { scene } = scenes[flag.activeSceneIndex];
    //camera = cameras[activeSceneIndex];
    renderer.render(scene, camera);

    // 更新外框的位置和大小
    if (
      flags[flag.activeSceneIndex].outlineBox &&
      flags[flag.activeSceneIndex].activeObject
    ) {
      flags[flag.activeSceneIndex].outlineBox.update();
    }
    // 角色边框 + 簇头光环：每帧跟随节点当前位置（修复边框卡死不动的问题）
    updateRoleVisuals(elapsed);
    // 悬停簇头时的簇成员连线：每帧刷新端点，保证随节点一起动
    updateClusterLinks();
    // 搜索定位闪烁效果
    updateLocateEffect(elapsed);
    // 底部看板：真实节点计数（500ms 节流）
    updateNodeCountUi(elapsed);
    // 节点移动：每次收到新位置都从当前可见位置向新位置插值。
    // 不再依赖后端 velocity，也不会因为批量消息或速度为 0 而闪现或停住。
    scenes[flag.activeSceneIndex].scene.children.forEach((obj) => {
      if (!isNodeMesh(obj) || obj.userData.id === "ground") return;

      const node = nodeDics[flag.activeSceneIndex]?.nodes?.[obj.userData.id];
      const x = Number(node?.realPosition?.x);
      const y = Number(node?.realPosition?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const motion = obj.userData.motion ?? (obj.userData.motion = {});
      const target = motion.to;
      const targetChanged =
        !target ||
        Math.abs(target.x - x) > 0.001 ||
        Math.abs(target.y - y) > 0.001;

      if (targetChanged) {
        motion.from = obj.position.clone();
        motion.to = new THREE.Vector3(x, y, 15);
        motion.elapsed = 0;
        const distance = motion.from.distanceTo(motion.to);
        // 距离越远动画略长，但每次更新最多约 1.2 秒，避免落后于实时数据。
        motion.duration = Math.min(1.2, Math.max(0.25, 0.45 + distance / 1800));
      }

      if (!motion.from || !motion.to) return;
      motion.elapsed = Math.min(
        motion.duration,
        motion.elapsed + Math.min(Math.max(deltaTime, 0), 0.1)
      );
      const progress = motion.duration > 0 ? motion.elapsed / motion.duration : 1;
      const eased = 1 - Math.pow(1 - Math.min(progress, 1), 3);
      obj.position.lerpVectors(motion.from, motion.to, eased);
      if (progress >= 1) obj.position.copy(motion.to);
    });
  } else {
    renderer.clear();
  }
}

animate();
function main() {
  // 调用主初始化函数
  //加载模型
  loadModels().catch((error) => {
    console.error("模型资源加载失败:", error);
    DialogText("模型资源加载失败，请检查 image 目录和本地静态服务器。");
  });
  // 新建场景入口已移除，固定使用预置的四个场景



  flag.activeSceneIndex = 0;
  loadSceneAndCamera();
  scenes.forEach(({ scene }) => {
    if (scene && !scene.name) scene.name = DEFAULT_SCENE_NAME;
  });
  updateSceneList();
  if (!scenes.length) {
    addScene();
    addScene();
    addScene();
    addScene();
    console.log("初始化场景成功");
    flag.activeSceneIndex = 0;
  } else {
    addScene();
    deleteScene(scenes.length - 1);
    while (scenes.length < SCENE_COUNT) addScene();
    scenes.forEach(({ scene }) => {
      if (scene && !scene.name) scene.name = DEFAULT_SCENE_NAME;
    });
    updateSceneList();
    flag.activeSceneIndex = 0;
  }
}

main();

// ===== XY 坐标网格与标尺（低存在感的看板参照系） =====
// 节点坐标直接使用仿真回传的原始 x/y（米），网格每格 100m，
// 主刻度 500m；整体挂在 ground 下，场景节点刷新时不会被清空。
function makeAxisLabelSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  ctx.font = "28px Arial";
  ctx.fillStyle = "rgba(110,140,175,0.9)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 24);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(90, 34, 1);
  return sprite;
}

export function buildGroundDecor(ground) {
  if (!ground || ground.userData.hasDecor) return;
  ground.userData.hasDecor = true;

  // 网格：4000x4000，每格100米（GridHelper 默认在XZ平面，旋转到与地面一致的XY平面）
  const grid = new THREE.GridHelper(4000, 40, 0x6f8ba6, 0x8fa8bf);
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  grid.rotation.x = Math.PI / 2;
  grid.position.z = 0.4;
  ground.add(grid);

  // X/Y 坐标轴线（过原点，弱化配色）
  const axisMaterial = new THREE.LineBasicMaterial({
    transparent: true,
    opacity: 0.35,
  });
  const axisGeometryX = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-2000, 0, 0.6),
    new THREE.Vector3(3000, 0, 0.6),
  ]);
  const axisX = new THREE.Line(axisGeometryX, axisMaterial);
  ground.add(axisX);
  const axisGeometryY = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -2000, 0.6),
    new THREE.Vector3(0, 3000, 0.6),
  ]);
  const axisY = new THREE.Line(axisGeometryY, axisMaterial.clone());
  ground.add(axisY);

  // 刻度标注：沿正轴每 500m 一个
  for (let v = 500; v <= 3000; v += 500) {
    const labelX = makeAxisLabelSprite(`${v}`);
    labelX.position.set(v, 26, 0.8);
    ground.add(labelX);
    const labelY = makeAxisLabelSprite(`${v}`);
    labelY.position.set(30, v, 0.8);
    ground.add(labelY);
  }
  const labelOrigin = makeAxisLabelSprite("0");
  labelOrigin.position.set(-34, -30, 0.8);
  ground.add(labelOrigin);
  const labelAxisX = makeAxisLabelSprite("X/m");
  labelAxisX.position.set(3080, 40, 0.8);
  ground.add(labelAxisX);
  const labelAxisY = makeAxisLabelSprite("Y/m");
  labelAxisY.position.set(46, 3080, 0.8);
  ground.add(labelAxisY);
}

// ===== 搜索定位：输入节点ID → 相机居中 + 闪烁标识 =====
let locateEffect = null; // {key, until, ring}

/** 归一化用户输入为候选ID集合："物体ID:12"、全角空格、纯数字等都能命中 */
function buildIdCandidates(rawId) {
  const raw = String(rawId ?? "").trim();
  const set = new Set();
  if (!raw) return set;
  set.add(raw);
  // 提取其中的数字部分（兼容 "物体ID:12"、"node-12"、前后杂散字符）
  const numMatch = raw.match(/-?\d+(?:\.\d+)?/);
  if (numMatch) {
    set.add(numMatch[0]);
    set.add(String(Number(numMatch[0])));
  }
  return set;
}

/**
 * 在指定场景的"已渲染物体"中查找节点（所见即所搜：
 * 直接扫描画板上的网格对象，不经过任何字典/配置，杜绝看得见却搜不到）。
 */
function findRenderedObject(scene, candidates) {
  return scene.children.find(
    (obj) =>
isNodeMesh(obj) &&
      obj.userData.id !== "ground" &&
      candidates.has(String(obj.userData.id))
  );
}

/**
 * 定位指定 id 的节点：相机聚焦到该节点并闪烁约 3 秒。
 * 匹配优先级：
 *   1. 当前场景中已渲染的节点（看板上能看到的，一定搜得到）；
 *   2. 其他场景中已渲染的节点（自动切换过去）；
 *   3. 仅存在于其他场景字典、尚未渲染的节点（切换后自动加载再定位）。
 * @returns {boolean} 是否定位成功
 */
export function locateNodeById(rawId) {
  if (flag.activeSceneIndex == null || !scenes.length) return false;
  const candidates = buildIdCandidates(rawId);
  if (candidates.size === 0) return false;

  let targetScene = flag.activeSceneIndex;
  let targetObj = findRenderedObject(scenes[targetScene].scene, candidates);

  if (!targetObj) {
    // 其他场景中已渲染的
    for (let i = 0; i < scenes.length && !targetObj; i++) {
      if (i === targetScene || !scenes[i]) continue;
      targetObj = findRenderedObject(scenes[i].scene, candidates);
      if (targetObj) {
        setActiveScene(i);
        targetScene = i;
      }
    }
  }
  if (!targetObj) {
    // 兜底：字典里存在但该场景尚未渲染（切过去后 setActiveScene 会自动加载模型）
    for (let i = 0; i < scenes.length && !targetObj; i++) {
      if (i === targetScene) continue;
      const dict = nodeDics[i]?.nodes ?? {};
      const hit = [...candidates].some((c) => c in dict);
      if (hit) {
        setActiveScene(i);
        targetScene = i;
        targetObj = findRenderedObject(scenes[i].scene, candidates);
      }
    }
  }

  if (!targetObj) {
    // 给出当前看板实际存在的节点ID样例，便于用户对照输入
    const renderedIds = [];
    scenes[flag.activeSceneIndex].scene.children.forEach((obj) => {
      if (
  isNodeMesh(obj) &&
        obj.userData.id !== "ground"
      ) {
        renderedIds.push(String(obj.userData.id));
      }
    });
    const sample =
      renderedIds.length > 0
        ? `当前画板节点ID: [${renderedIds.slice(0, 12).join(", ")}${renderedIds.length > 12 ? ", ..." : ""}]`
        : "当前画板上还没有渲染任何节点";
    DialogText(`未找到节点「${String(rawId).trim()}」。${sample}`);
    return false;
  }

  // 相机居中（保持当前视角距离）
  cameraCenter(targetObj.position.x, targetObj.position.y);

  // 闪烁标识环（白色高亮，快速脉冲）
  destroyLocateEffect();
  const geometry = new THREE.RingGeometry(24, 38, 48);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.frustumCulled = false;
  scenes[targetScene].scene.add(ring);
  locateEffect = {
    key: String(targetObj.userData.id),
    sceneIndex: targetScene,
    until: clock.elapsedTime + 3.2,
    ring,
  };
  return true;
}

function destroyLocateEffect() {
  if (locateEffect?.ring) {
    locateEffect.ring.parent?.remove(locateEffect.ring);
    locateEffect.ring.geometry.dispose();
    locateEffect.ring.material.dispose();
  }
  locateEffect = null;
}

/** 每帧调用：定位闪烁动画（约 5Hz 亮灭 + 缩放脉冲），到期自动移除 */
function updateLocateEffect(elapsed) {
  if (!locateEffect) return;
  if (elapsed > locateEffect.until) {
    destroyLocateEffect();
    return;
  }
  const obj = findRenderedObject(
    scenes[locateEffect.sceneIndex].scene,
    new Set([locateEffect.key])
  );
  if (!obj) {
    destroyLocateEffect();
    return;
  }
  locateEffect.ring.position.set(obj.position.x, obj.position.y, obj.position.z - 1);
  const strobeOn = Math.floor(elapsed * 5) % 2 === 0;
  locateEffect.ring.visible = strobeOn;
  const pulse = 1 + 0.22 * Math.sin(elapsed * 10);
  locateEffect.ring.scale.set(pulse, pulse, 1);
}

// ===== 展示画板真实节点计数 =====
let nodeCountUiTimer = null;
/**
 * 统计当前活动场景中实际渲染的节点物体数量
 * （直接数 Three.js 场景里的网格对象，排除地面——不是任何配置/字典的"应有"数量）
 */
export function countRenderedNodes(sceneIndex = flag.activeSceneIndex) {
  if (sceneIndex == null || !scenes[sceneIndex]) return 0;
  let count = 0;
  scenes[sceneIndex].scene.children.forEach((obj) => {
    if (
isNodeMesh(obj) &&
      obj.userData.id !== "ground"
    ) {
      ++count;
    }
  });
  return count;
}

/** 刷新底部看板上的节点计数显示（500ms 节流，由 animate 驱动） */
function updateNodeCountUi(elapsed) {
  if (nodeCountUiTimer != null && elapsed - nodeCountUiTimer < 0.5) return;
  nodeCountUiTimer = elapsed;
  const el = document.getElementById("scene-node-count");
  if (!el) return;
  const idx = flag.activeSceneIndex;
  const sceneName =
    idx != null && scenes[idx]?.scene?.name ? `「${scenes[idx].scene.name}」` : "";
  el.textContent =
    idx == null
      ? "展示画板节点数: 0"
      : `展示画板节点数: ${countRenderedNodes(idx)} （场景${idx}${sceneName}）`;
}

// 摄像机聚焦到指定无人机位置
// 保留当前相机与视觉中心之间的距离和角度，只平移视觉中心。
export function cameraCenter(x, y) {
  if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) {
    console.warn("cameraCenter: 无效的无人机坐标", x, y);
    return;
  }

  const targetPosition = new THREE.Vector3(Number(x), Number(y), 15);

  // 保存当前相机相对于 OrbitControls 视觉中心的偏移量。
  // 这样聚焦后不会突然改变缩放距离和观察角度。
  const cameraOffset = camera.position.clone().sub(controls.target);

  // 将视觉中心移动到无人机位置。
  controls.target.copy(targetPosition);

  // 相机同步平移，保持原来的相对距离。
  camera.position.copy(targetPosition).add(cameraOffset);
  camera.lookAt(targetPosition);

  // OrbitControls 修改 target 后必须 update。
  controls.update();

  console.log(
    `视觉中心已聚焦到第一架无人机: (${targetPosition.x}, ${targetPosition.y})`
  );
}

export async function waitForFlagRoute() {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      //console.log(dataFlag.route);
      if (ctreatModelFlag) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100); // 每100ms检查一次
  });
}