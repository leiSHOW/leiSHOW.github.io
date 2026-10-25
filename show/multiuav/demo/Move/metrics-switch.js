const toolbar = document.querySelector(".board-toolbar");
const macPriorityControls = document.getElementById("mac-priority-controls");

const views = {
  route: {
    tab: document.getElementById("route-metrics-tab"),
    panel: document.getElementById("route-metrics-panel"),
  },
  mac: {
    tab: document.getElementById("mac-metrics-tab"),
    panel: document.getElementById("mac-metrics-panel"),
  },
  cluster: {
    tab: document.getElementById("cluster-metrics-tab"),
    panel: document.getElementById("cluster-metrics-panel"),
  },
};

function setMetricsView(view) {
  if (!views[view]) return;
  Object.entries(views).forEach(([name, item]) => {
    const active = name === view;
    item.tab?.classList.toggle("is-active", active);
    item.tab?.setAttribute("aria-selected", String(active));
    item.panel?.classList.toggle("is-active", active);
    item.panel?.setAttribute("aria-hidden", String(!active));
  });

  toolbar?.classList.toggle("route-active", view === "route");
  toolbar?.classList.toggle("mac-active", view === "mac");
  toolbar?.classList.toggle("cluster-active", view === "cluster");
  macPriorityControls?.setAttribute("aria-hidden", String(view !== "mac"));

  window.requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

Object.entries(views).forEach(([name, item]) => {
  item.tab?.addEventListener("click", () => setMetricsView(name));
});
setMetricsView("route");
