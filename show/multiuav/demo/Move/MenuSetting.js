import {
  flag,
  nodeDics,
  flags,
} from "./viewControl.js";

/**
 * 节点信息菜单（展示专用）
 * 说明：按需求已移除"删除节点"与"修改节点信息"功能，
 * 子菜单仅做只读展示；展示字段与后端 JSON 字段一一对应。
 */

// ===== 模块级元素绑定 =====
const menu = document.getElementById("menu");
const title = document.querySelector("h3");
const baseInfoMenu = document.getElementById("baseInfoMenu");
const clusterInfoMenu = document.getElementById("clusterInfoMenu");
const closeMenuButton = document.getElementById("closeMenu");
closeMenuButton.addEventListener("click", () => {
  closeMenuButtonFun();
});
var mouseClickPos = null; //存储第一次右击物体时的位置
var currentObjectId = null;

// 基础信息子菜单绑定
const nodeIdInput = document.getElementById("nodeID");
const positionInput = document.getElementById("position");
const nodeTypeInput = document.getElementById("NodeType");
const sizeInput = document.getElementById("size");
const vInput = document.getElementById("v");

// 分簇信息子菜单绑定（过期时间(entryTime)字段已按需求移除）
const energyInput = document.getElementById("energy");
const clusterHeadInput = document.getElementById("clusterHead");
const weightInput = document.getElementById("weight");
const nodeStateInput = document.getElementById("nodeState");
const ipInput = document.getElementById("ip");

// 主菜单按钮响应事件绑定
const baseInfoButton = document.getElementById("baseInfo"); //主菜单的基础信息菜单按钮
baseInfoButton.addEventListener("click", () => {
  showBaseInfo(flags[flag.activeSceneIndex].activeObject);
});
const clusterInfoButton = document.getElementById("clusterInfo"); //主菜单的分簇信息按钮
clusterInfoButton.addEventListener("click", () => {
  showClusterInfo(flags[flag.activeSceneIndex].activeObject);
});
const cancelBase = document.getElementById("cancelBase"); //基础菜单关闭按钮
cancelBase.addEventListener("click", () => {
  cancelBaseFun();
});
const cancelCluster = document.getElementById("cancelCluster"); //分簇菜单关闭按钮
cancelCluster.addEventListener("click", () => {
  cancelClusterFun();
});

// ===== 展示字段格式化（与后端 JSON 字段保持一致） =====

/** 向量 -> "x, y, z" 文本 */
function formatVector(value) {
  return ["x", "y", "z"]
    .map((key) => {
      const num = Number(value?.[key]);
      return Number.isFinite(num) ? num.toFixed(2) : "0.00";
    })
    .join(", ");
}

/**
 * 簇头ID 展示格式：
 * 后端 JSON 中 clusterHeadID 为 0 / [] 表示无簇头，其余为 id 或 id 数组。
 * 直接把数组赋给 input.value 会得到空字符串，造成"字段不匹配"的观感。
 */
function formatClusterHeads(value) {
  if (value == null || value === 0 || value === "0") return "无";
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "无";
  }
  return String(value);
}

// 基础子菜单关闭按钮
export function cancelBaseFun() {
  flags[flag.activeSceneIndex].baseMenu = false;
  baseInfoMenu.style.display = "none"; // 关闭菜单
}

// 分簇子菜单关闭按钮
export function cancelClusterFun() {
  flags[flag.activeSceneIndex].clusterMenu = false; //记录菜单状态关闭
  clusterInfoMenu.style.display = "none"; // 关闭菜单
}

//设置菜单弹出位置及关闭场景拖动效果
export function showMenuClicked(event, id) {
  mouseClickPos = event; //便于确定子菜单弹出位置
  if (currentObjectId != null && currentObjectId != id) {
    //当切换物体后当前所有的子菜单关闭
    baseInfoMenu.style.display = "none";
    clusterInfoMenu.style.display = "none";
  }
  currentObjectId = id;
  title.textContent = `物体ID:${id}`;
  // 修复：菜单弹出位置做视口钳制。原先仅判断右侧空间且无垂直边界检查，
  // 右击屏幕下方/边缘的节点时菜单一部分会越出视口，
  // 导致"关闭当前菜单"按钮被挡住无法点击。
  menu.style.display = "block"; // 先显示才能测量实际尺寸
  var posx = event.x + 16;
  var posy = event.y - 12;
  const clamped = clampToViewport(menu, posx, posy);
  menu.style.left = `${clamped.x}px`;
  menu.style.top = `${clamped.y}px`;
  flags[flag.activeSceneIndex].menuOpen = true; //记录菜单状态为打开
  flags[flag.activeSceneIndex].position.x = event.x; //记录菜单打开的位置
  flags[flag.activeSceneIndex].position.y = event.y;
}

/**
 * 视口钳制：把定位点限制在视口内，保证面板完整可见。
 * 仅用于展示层定位，不涉及任何业务状态。
 */
const VIEWPORT_MARGIN = 8;
function clampToViewport(el, x, y) {
  const width = el.offsetWidth || 0;
  const height = el.offsetHeight || 0;
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
  return {
    x: Math.min(Math.max(x, VIEWPORT_MARGIN), maxX),
    y: Math.min(Math.max(y, VIEWPORT_MARGIN), maxY),
  };
}

/**
 * 子菜单定位：优先贴靠主菜单右侧，空间不足时翻到左侧，
 * 最后做视口钳制——保证子菜单不再叠在主菜单上遮住"关闭当前菜单"按钮。
 */
function placeSubMenu(subMenuEl) {
  subMenuEl.style.display = "block"; // 先显示才能测量实际尺寸
  const mainRect = menu.getBoundingClientRect();
  const gap = 8;
  let x = mainRect.right + gap;
  if (x + subMenuEl.offsetWidth > window.innerWidth - VIEWPORT_MARGIN) {
    x = mainRect.left - subMenuEl.offsetWidth - gap;
  }
  let y = mainRect.top;
  if (window.innerWidth <= 650) {
    x = VIEWPORT_MARGIN;
    y = mainRect.bottom + gap;
  }
  const clamped = clampToViewport(subMenuEl, x, y);
  subMenuEl.style.left = `${clamped.x}px`;
  subMenuEl.style.top = `${clamped.y}px`;
}

/**
 * 查看基础信息（展示专用）。
 * 展示字段与 ClusterNode/后端 JSON 的对应关系：
 *   节点   <- nodeID
 *   坐标   <- realPosition(p_x/p_y/p_z 映射为 x/y/z)
 *   角色   <- nodeStatus（CLUSTER_HEAD/CLUSTER_MEMBER/CLUSTER_GUEST 等）
 *   大小   <- 模型缩放（Three.js 对象属性，非后端字段）
 *   速度   <- velocity(v_x/v_y/v_z 映射为 x/y/z)
 */
export function showBaseInfo(object) {
  flags[flag.activeSceneIndex].baseMenu = true;
  //打开需要的子菜单，关闭其他子菜单
  baseInfoMenu.style.display = "block";
  clusterInfoMenu.style.display = "none";
  placeSubMenu(baseInfoMenu);

  // 修复：先整体复位再填充，避免残留上一个节点的数据造成字段错位
  nodeIdInput.value = "";
  positionInput.value = "";
  nodeTypeInput.value = "";
  sizeInput.value = "";
  vInput.value = "0.00, 0.00, 0.00";

  const sceneIndex = flag.activeSceneIndex;
  const id = object?.userData?.id;
  const node = id != null ? nodeDics[sceneIndex]?.nodes?.[id] : null;

  if (node) {
    nodeIdInput.value = `${node.nodeID ?? ""}`;
    const position = node.realPosition;
    if (position && Number.isFinite(Number(position.x))) {
      positionInput.value = formatVector(position);
    } else if (object?.position) {
      // 无后端位置数据时回退显示模型当前坐标
      positionInput.value = formatVector(object.position);
    }
    nodeTypeInput.value = `${node.nodeStatus ?? ""}`;
    if (object?.scale) sizeInput.value = object.scale.x.toFixed(2);
    const velocity = node.velocity;
    if (velocity && Number.isFinite(Number(velocity.x))) {
      vInput.value = formatVector(velocity);
    }
  } else if (object?.position) {
    // 场景中手动拖入、尚未关联后端数据的物体：仅展示模型自身信息
    nodeIdInput.value = `${id ?? ""}`;
    positionInput.value = formatVector(object.position);
    if (object.scale) sizeInput.value = object.scale.x.toFixed(2);
  }
}

/**
 * 查看分簇信息（展示专用）。
 * 展示字段与 ClusterNode/后端 JSON 的对应关系：
 *   能量值   <- energy
 *   簇头ID   <- clusterHeadID（0/[]=无）
 *   节点权重 <- weight
 *   节点状态 <- nodeState
 *   节点IP   <- nodeIP
 * （过期时间 entryTime 已按需求移除）
 */
export function showClusterInfo(object) {
  //打开需要的子菜单，其余子菜单关闭
  flags[flag.activeSceneIndex].clusterMenu = true;
  clusterInfoMenu.style.display = "block";
  baseInfoMenu.style.display = "none";
  placeSubMenu(clusterInfoMenu);

  // 先整体复位再填充
  energyInput.value = "";
  clusterHeadInput.value = "无";
  weightInput.value = "";
  nodeStateInput.value = "";
  ipInput.value = "";

  const sceneIndex = flag.activeSceneIndex;
  const id = object?.userData?.id;
  const node = id != null ? nodeDics[sceneIndex]?.nodes?.[id] : null;
  if (!node) return;

  energyInput.value = `${node.energy ?? ""}`;
  clusterHeadInput.value = formatClusterHeads(node.clusterHeadID);
  weightInput.value = `${node.weight ?? ""}`;
  nodeStateInput.value = `${node.nodeState ?? ""}`;
  ipInput.value = `${node.nodeIP ?? ""}`;
}

function refreshCurrentNodeDetail(detail) {
  const sceneIndex = Number(detail?.sceneIndex);
  if (sceneIndex !== flag.activeSceneIndex) return;
  const sceneFlags = flags[sceneIndex];
  if (!sceneFlags?.menuOpen || String(currentObjectId) !== String(detail?.nodeId)) return;
  if (detail.removed) {
    closeMenuButtonFun();
    return;
  }
  if (sceneFlags.baseMenu && sceneFlags.activeObject) {
    showBaseInfo(sceneFlags.activeObject);
  } else if (sceneFlags.clusterMenu && sceneFlags.activeObject) {
    showClusterInfo(sceneFlags.activeObject);
  }
}

window.addEventListener("middleware:node-updated", (event) => {
  refreshCurrentNodeDetail(event.detail);
});
window.addEventListener("middleware:node-removed", (event) => {
  refreshCurrentNodeDetail({ ...event.detail, removed: true });
});
//关闭所有菜单
export function closeMenuButtonFun() {
  baseInfoMenu.style.display = "none";
  clusterInfoMenu.style.display = "none";
  menu.style.display = "none";
  flags[flag.activeSceneIndex].menuOpen = false;
  flags[flag.activeSceneIndex].baseMenu = false;
  flags[flag.activeSceneIndex].clusterMenu = false;
}

// Esc 键关闭菜单（纯交互便利：仅在菜单处于打开状态时生效）
window.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    flag.activeSceneIndex != null &&
    flags[flag.activeSceneIndex]?.menuOpen
  ) {
    closeMenuButtonFun();
  }
});
