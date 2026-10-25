import { routeDics, macDics, clusterDics, flag } from "../Move/viewControl.js";
import {
  ChartManager,
  CHART_PALETTE,
} from "../dataForm/chartsClass.js";

const MAX_CHART_POINTS = 16;
const CANVAS_IDS = [
  "AverageDelay",
  "lossPacketRatio",
  "convergenceTime",
  "AvgThroughput",
];

// ===== 路由指标图表（原有） =====
export const chartManager = new ChartManager();

chartManager.createCharts(
  CANVAS_IDS,
  ["平均端到端时延(s)", "丢包率(%)", "收敛时间(s)", "平均吞吐量(Mbps)"],
  [1, 1, 1, 1],
  MAX_CHART_POINTS,
  1
);
chartManager.priority = "优先级1";

// 只截取最后 10 条用于显示，不再修改 routeDics，完整历史数据会保留下来供导出。
export const QuestChartData = () => {
  const sceneIndex = flag.activeSceneIndex;
  if (sceneIndex == null || !Array.isArray(routeDics[sceneIndex])) {
    updateCharts([]);
    return;
  }

  updateCharts(routeDics[sceneIndex].slice(-MAX_CHART_POINTS));
};

function updateCharts(routeData) {
  const dataArrays = Object.fromEntries(
    CANVAS_IDS.map((id) => [id, Array(MAX_CHART_POINTS).fill(null)])
  );

  routeData.forEach((item, index) => {
    dataArrays.AverageDelay[index] = item?.AverageDelay ?? null;
    dataArrays.lossPacketRatio[index] = item?.lossPacketRatio ?? null;
    dataArrays.convergenceTime[index] = item?.convergenceTime ?? null;
    dataArrays.AvgThroughput[index] = item?.AvgThroughput ?? null;
  });

  CANVAS_IDS.forEach((id) => chartManager.updateData(id, dataArrays[id], null));
}

// ===== MAC 指标图表（新增，风格/规格与路由指标一致） =====
// 展示口径与后端 MacMetrics JSON 一一对应：
//   delay(ms) / channelUtilization(0~1) / packetLossRatio(0~1) / throughput(kbps)
// eemac 只有 average 一条；qosmac 有 average + p1~p4。
const MAC_CANVAS_IDS = ["mac_chart1", "mac_chart2", "mac_chart3", "mac_chart4"];
export const macChartManager = new ChartManager();

const PRIORITY_KEYS = ["p1", "p2", "p3", "p4"];
const PRIORITY_LABELS = ["优先级1", "优先级2", "优先级3", "优先级4"];

function buildMacDatasets(history, mode) {
  // 时延图：平均模式只画 average；优先级模式画 p1~p4 四条
  const delayDatasets = [];
  if (mode === "average") {
    delayDatasets.push(
      makeDataset("平均时延(ms)", seriesOf(history, "average", "delay"), CHART_PALETTE[0])
    );
  } else {
    PRIORITY_KEYS.forEach((key, i) => {
      delayDatasets.push(
        makeDataset(PRIORITY_LABELS[i], seriesOf(history, key, "delay"), CHART_PALETTE[i % CHART_PALETTE.length])
      );
    });
  }
  if (!delayDatasets.length) {
    delayDatasets.push(makeDataset("时延(ms)", [], "#7f8fa6"));
  }

  return {
    delay: delayDatasets,
    utilization: [
      makeDataset("信道利用率(0~1)", seriesOf(history, "average", "utilization"), CHART_PALETTE[1], true),
    ],
    loss: [
      makeDataset("丢包率(0~1)", seriesOf(history, "average", "loss"), CHART_PALETTE[2], true),
    ],
    throughput: [
      makeDataset("吞吐量(kbps)", seriesOf(history, "average", "throughput"), CHART_PALETTE[3]),
    ],
  };
}

function makeDataset(label, data, color, lockedMaxOne = false) {
  const dataset = {
    pointRadius: 1.8,
    pointHoverRadius: 3.2,
    pointBackgroundColor: color,
    label,
    data,
    borderColor: color,
    backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.16)"),
    borderWidth: 1.8,
    tension: 0.25,
    fill: false,
  };
  void lockedMaxOne;
  return dataset;
}

/** 从历史快照中抽取某 priority 的某指标序列（不足 MAX 补 null 对齐右侧） */
function seriesOf(history, priority, metric) {
  const recent = history.slice(-MAX_CHART_POINTS);
  const values = recent.map((frame) => {
    const hit = (frame.entries ?? []).find((entry) => entry.priority === priority);
    const value = hit ? hit[metric] : null;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  });
  while (values.length < MAX_CHART_POINTS) values.unshift(null);
  return values;
}

// MAC 指标四图创建（时延支持多折线；利用率/丢包率锁定 0~1 轴）
export function initMacCharts() {
  const recentEmpty = [];
  const frameLabels = Array.from({ length: MAX_CHART_POINTS }, (_, i) => i);
  macChartManager.createCustomChart("mac_chart1", {
    title: "MAC 时延（平均 / 优先级）",
    labels: frameLabels,
    datasets: buildMacDatasets(recentEmpty, "priority").delay,
  });
  macChartManager.createCustomChart("mac_chart2", {
    title: "信道利用率",
    yTitle: "单位: 比例(0~1)",
    labels: frameLabels,
    datasets: buildMacDatasets(recentEmpty, "average").utilization,
    maxY: 1,
  });
  macChartManager.createCustomChart("mac_chart3", {
    title: "丢包率",
    yTitle: "单位: 比例(0~1)",
    labels: frameLabels,
    datasets: buildMacDatasets(recentEmpty, "average").loss,
    maxY: 1,
  });
  macChartManager.createCustomChart("mac_chart4", {
    title: "吞吐量",
    labels: frameLabels,
    datasets: buildMacDatasets(recentEmpty, "average").throughput,
  });

  // 平均/优先级切换
  document.querySelectorAll('input[name="priority"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      QuestMacChartData();
    });
  });
}
// 模块加载即创建 MAC 四图（module script 为 deferred，DOM 已就绪）
initMacCharts();

/** 当前选中的时延展示模式："优先级" 或 "average" */
function currentMacMode() {
  const checked = document.querySelector('input[name="priority"]:checked');
  return checked?.value === "average" ? "average" : "priority";
}

/** 刷新 MAC 指标四图（ws 收到新帧或切换场景/模式时调用） */
export const QuestMacChartData = () => {
  const sceneIndex = flag.activeSceneIndex;
  const history =
    sceneIndex != null && Array.isArray(macDics[sceneIndex]?.history)
      ? macDics[sceneIndex].history
      : [];

  const datasets = buildMacDatasets(history, currentMacMode());
  // 时延图：整体替换数据集（平均/优先级模式的折线数量与配色不同）
  macChartManager.setDatasets("mac_chart1", datasets.delay);

  // 利用率/丢包率锁定 0~1 轴，直接整组更新
  const utilChart = macChartManager.charts["mac_chart2"];
  if (utilChart) {
    utilChart.data.datasets[0].data = datasets.utilization[0].data;
    updateYAxisSafe(utilChart);
    utilChart.update();
  }
  const lossChart = macChartManager.charts["mac_chart3"];
  if (lossChart) {
    lossChart.data.datasets[0].data = datasets.loss[0].data;
    updateYAxisSafe(lossChart);
    lossChart.update();
  }
  macChartManager.updateDatasets("mac_chart4", [
    datasets.throughput[0].data,
  ]);
};

/** y 轴刷新的本地兜底：锁定轴不扩，其余自动 */
function updateYAxisSafe(chart) {
  if (chart.$lockedMaxY) return;
  const values = chart.data.datasets.flatMap((dataset) =>
    (Array.isArray(dataset.data) ? dataset.data : [])
      .map(Number)
      .filter((value) => Number.isFinite(value))
  );
  const maxValue = values.length ? Math.max(...values) : 0;
  chart.options.scales.y.min = 0;
  chart.options.scales.y.max = maxValue > 0 ? maxValue * 1.1 : 1;
}


// ===== 分簇指标图表 =====
const CLUSTER_MAX_CHART_POINTS = 60;
const CLUSTER_CANVAS_IDS = [
  "avgCHLifetime",
  "avgMemberLifetime",
  "clusterMaintenanceMessages",
  "clusterHeadClaimMessages",
  "guestMaintenanceMessages",
];
const CLUSTER_FIELDS = [...CLUSTER_CANVAS_IDS];

export const clusterChartManager = new ChartManager();
clusterChartManager.createCharts(
  CLUSTER_CANVAS_IDS,
  [
    "平均簇首生命周期(s)",
    "平均成员生命周期(s)",
    "簇维护消息(条)",
    "簇首声明消息(条)",
    "Guest维护消息(条)",
  ],
  [1, 1, 1, 1, 1],
  CLUSTER_MAX_CHART_POINTS,
  1
);

export const QuestClusterChartData = () => {
  const sceneIndex = flag.activeSceneIndex;
  const history =
    sceneIndex != null && Array.isArray(clusterDics[sceneIndex])
      ? clusterDics[sceneIndex].slice(-CLUSTER_MAX_CHART_POINTS)
      : [];

  CLUSTER_CANVAS_IDS.forEach((canvasId, fieldIndex) => {
    const values = history.map((item) => {
      const value = Number(item?.[CLUSTER_FIELDS[fieldIndex]]);
      return Number.isFinite(value) ? value : null;
    });
    while (values.length < CLUSTER_MAX_CHART_POINTS) values.unshift(null);
    clusterChartManager.updateData(canvasId, values, null);
  });
};
