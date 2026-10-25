(() => {
  const appShell = document.querySelector(".app-shell");
  const sidebar = document.querySelector(".sidebar");
  const footer = document.querySelector(".footer");
  const sidebarButton = document.getElementById("sidebar-collapse-btn");
  const metricsButton = document.getElementById("metrics-collapse-btn");
  const storagePrefix = "multiuav-demo-layout-";

  const readState = (key, fallback = false) => {
    try {
      const value = localStorage.getItem(storagePrefix + key);
      return value == null ? fallback : value === "true";
    } catch {
      return fallback;
    }
  };

  const writeState = (key, value) => {
    try {
      localStorage.setItem(storagePrefix + key, String(value));
    } catch {
      // 浏览器禁用本地存储时不影响页面交互。
    }
  };

  function setSidebarCollapsed(collapsed, persist = true) {
    appShell?.classList.toggle("sidebar-collapsed", collapsed);
    sidebar?.classList.toggle("is-collapsed", collapsed);
    if (sidebarButton) {
      sidebarButton.textContent = collapsed ? "›" : "‹";
      sidebarButton.setAttribute("aria-expanded", String(!collapsed));
      sidebarButton.setAttribute("aria-label", collapsed ? "展开控制侧栏" : "收起控制侧栏");
      sidebarButton.title = collapsed ? "展开控制侧栏" : "收起控制侧栏";
    }
    if (persist) writeState("sidebar-collapsed", collapsed);
    window.dispatchEvent(new Event("resize"));
  }

  function setMetricsCollapsed(collapsed, persist = true) {
    appShell?.classList.toggle("metrics-collapsed", collapsed);
    footer?.classList.toggle("metrics-collapsed", collapsed);
    if (metricsButton) {
      metricsButton.textContent = collapsed ? "⌃" : "⌄";
      metricsButton.setAttribute("aria-expanded", String(!collapsed));
      metricsButton.setAttribute("aria-label", collapsed ? "展开指标看板" : "收起指标看板");
      metricsButton.title = collapsed ? "展开指标看板" : "收起指标看板";
    }
    if (persist) writeState("metrics-collapsed", collapsed);
    window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  }

  sidebarButton?.addEventListener("click", () => {
    setSidebarCollapsed(!sidebar?.classList.contains("is-collapsed"));
  });
  metricsButton?.addEventListener("click", () => {
    setMetricsCollapsed(!footer?.classList.contains("metrics-collapsed"));
  });

  document.querySelectorAll(".panel-collapse-button[data-panel-collapse]").forEach((button) => {
    const target = document.getElementById(button.dataset.panelCollapse);
    if (!target) return;
    const key = "panel-" + target.id;
    const setPanelCollapsed = (collapsed, persist = true) => {
      target.classList.toggle("is-collapsed", collapsed);
      button.textContent = collapsed ? "⌄" : "⌃";
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute("aria-label", collapsed ? `展开${target.getAttribute("aria-label") || "面板"}` : `收起${target.getAttribute("aria-label") || "面板"}`);
      button.title = button.getAttribute("aria-label");
      if (persist) writeState(key, collapsed);
    };
    setPanelCollapsed(readState(key, false), false);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setPanelCollapsed(!target.classList.contains("is-collapsed"));
    });
  });

  setSidebarCollapsed(readState("sidebar-collapsed", false), false);
  setMetricsCollapsed(readState("metrics-collapsed", false), false);
})();