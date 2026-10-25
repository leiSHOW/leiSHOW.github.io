import { locateNodeById } from "./viewControl.js";
import { DialogText } from "./Dialog.js";

const sceneBtn = document.getElementById("scene-btn");
const serverBtn = document.getElementById("server-btn");
const basicBtn = document.getElementById("base-config-btn");
const baseConfigContainer = document.getElementById("base-config-container");
const sceneContainer = document.getElementById("scene-container");
const reloadContainer = document.getElementById("reload-container");

// 说明：定位搜索与 MAC 指标图表已并入底部指标看板（main.html 的 .footer），
// 侧边栏恢复为 场景/服务器/基础配置 三个页签。

sceneBtn.addEventListener("click", () => {
  sceneBtn.classList.add("siderbar-switch-btn-hover");
  serverBtn.classList.remove("siderbar-switch-btn-hover");
  basicBtn.classList.remove("siderbar-switch-btn-hover");
  sceneContainer.style.display = "block";
  reloadContainer.style.display = "none";
  baseConfigContainer.style.display = "none";
});

serverBtn.addEventListener("click", () => {
  sceneBtn.classList.remove("siderbar-switch-btn-hover");
  serverBtn.classList.add("siderbar-switch-btn-hover");
  basicBtn.classList.remove("siderbar-switch-btn-hover");
  sceneContainer.style.display = "none";
  reloadContainer.style.display = "block";
  baseConfigContainer.style.display = "none";
});

basicBtn.addEventListener("click", () => {
  sceneBtn.classList.remove("siderbar-switch-btn-hover");
  serverBtn.classList.remove("siderbar-switch-btn-hover");
  basicBtn.classList.add("siderbar-switch-btn-hover");
  sceneContainer.style.display = "none";
  reloadContainer.style.display = "none";
  baseConfigContainer.style.display = "block";
});

// ===== 底部看板：搜索定位交互 =====
// 修复：此前一轮重构遗漏了本绑定，导致"定位"按钮/回车完全无响应。
const locateInput = document.getElementById("locate-input");
const locateGo = document.getElementById("locate-go");

function runLocate() {
  const value = locateInput?.value;
  if (!value || !value.trim()) {
    DialogText("请输入要定位的节点ID");
    return;
  }
  const okLocate = locateNodeById(value);
  if (okLocate) DialogText(`已定位节点 ${value.trim()}`, 1500);
}

locateGo?.addEventListener("click", runLocate);
locateInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runLocate();
});
