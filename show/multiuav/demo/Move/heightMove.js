const divider = document.querySelector(".divider");
const view = document.querySelector(".view");
const model = document.querySelector(".model");
const sceneList = document.getElementById("scene-list");

let isDragging = false;

// 旧版支持场景/组件高度拖动；新版布局没有分隔拖杆时安全跳过，避免
// 一个可选的 UI 行为阻断整个模块加载。
if (divider && view && model) {
  divider.addEventListener("mousedown", (event) => {
    isDragging = true;
    document.body.style.cursor = "row-resize";
    event.preventDefault();
  });

  document.addEventListener("mousemove", (event) => {
    if (!isDragging) return;

    event.preventDefault();
    event.stopPropagation();

    const sidebarHeight = divider.parentElement.offsetHeight;
    const contentHeight = sceneList?.scrollHeight ?? 0;
    const minHeight = Math.max(contentHeight, 100);
    const maxHeight = sidebarHeight - divider.offsetHeight - 50;
    const newHeight = event.clientY - view.getBoundingClientRect().top;

    if (newHeight > minHeight && newHeight < maxHeight) {
      view.style.flex = `0 0 ${newHeight}px`;
      model.style.flex = "1";
      view.style.overflowY = contentHeight > newHeight ? "auto" : "hidden";
    }
  });

  document.addEventListener("mouseup", (event) => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.cursor = "default";
    event.preventDefault();
  });

  divider.addEventListener("selectstart", (event) => event.preventDefault());
}

const addModelButton = document.querySelector("#add_model");
const modelContainer = document.getElementById("model-container");

if (addModelButton && modelContainer) {
  addModelButton.addEventListener("click", () => {
    const collapsed = modelContainer.hasAttribute("hidden");
    modelContainer.toggleAttribute("hidden", !collapsed);
    addModelButton.textContent = collapsed ? "⌃" : "⌄";
    addModelButton.setAttribute("aria-expanded", String(collapsed));
  });
}
