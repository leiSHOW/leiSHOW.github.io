// 图表管理类
export class ChartManager {
  constructor() {
    this.charts = {};
    this.priority = "";
  }

  createCharts(canvasIds, labels, aspectRatios, indexLength, lineNums) {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js 未加载（CDN 不可达？），指标图表功能停用，其余功能不受影响");
      return;
    }
    canvasIds.forEach((id, index) => {
      const chart = createLineChart(
        id,
        [],
        labels[index],
        aspectRatios[index],
        indexLength,
        lineNums,
        // 图表标题取指标名（含单位的括号后缀会同时提取为 y 轴单位）
        labels[index],
        index
      );
      if (chart) this.charts[id] = chart;
    });
  }

  /**
   * 低层创建：自定义数据集/锁定Y轴上限/自定义标题，供 MAC 指标等多折线图使用。
   * config: { title, labels, datasets:[{label,data,borderColor,backgroundColor}],
   *          maxY(可选，锁定y轴), aspectRatio }
   */
  createCustomChart(id, config) {
    if (typeof Chart === "undefined") return null;
    const canvas = document.getElementById(id);
    if (!canvas || !config?.datasets?.length) return null;
    const options = cloneChartOptions();
    options.aspectRatio = config.aspectRatio ?? 1;
    options.plugins.legend.display = config.showLegend ?? (config.datasets.length > 1);
    options.plugins.title.text = config.title ?? "";
    if (config.yTitle) options.scales.y.title.text = config.yTitle;
    if (Number.isFinite(config.maxY)) {
      options.scales.y.max = config.maxY;
      options.scales.y.ticks.stepSize = undefined; // 交给 Chart.js 自动取整
    }
    const chart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: { labels: config.labels ?? [], datasets: config.datasets },
      options,
    });
    if (Number.isFinite(config.maxY)) chart.$lockedMaxY = true;
    this.charts[id] = chart;
    return chart;
  }

  destroyAll() {
    Object.values(this.charts).forEach((chart) => chart?.destroy());
    this.charts = {};
  }

  updateData(chartId, newData, newQosData) {
    const chart = this.charts[chartId];
    if (!chart) return;

    chart.data.datasets[0].data = Array.isArray(newData) ? newData : [];
    if (newQosData != null && chart.data.datasets[1]) {
      chart.data.datasets[1].data = newQosData;
    }

    updateYAxis(chart);
    chart.update();
  }

  /** 多数据集更新（按下标对齐），并刷新 y 轴 */
  updateDatasets(chartId, datasetsData) {
    const chart = this.charts[chartId];
    if (!chart) return;
    (datasetsData ?? []).forEach((data, i) => {
      if (chart.data.datasets[i]) {
        chart.data.datasets[i].data = Array.isArray(data)
          ? data
          : (data?.data ?? []);
      }
    });
    updateYAxis(chart);
    chart.update();
  }

  /** 整组替换数据集（标签/颜色随模式变化的多折线图使用），并刷新 y 轴 */
  setDatasets(chartId, datasets) {
    const chart = this.charts[chartId];
    if (!chart || !Array.isArray(datasets)) return;
    chart.data.datasets = datasets;
    updateYAxis(chart);
    chart.update();
  }
}

// 折线配色（按图序号轮换，深色底上足够醒目）
export const CHART_PALETTE = [
  "rgb(0, 229, 255)",   // 青
  "rgb(255, 179, 0)",   // 琥珀
  "rgb(255, 92, 138)",  // 玫红
  "rgb(140, 255, 92)",  // 荧光绿
  "rgb(171, 136, 255)", // 紫
];

function createLineChart(canvasId, data, label, aspectRatio, indexLength, lineNums, text, paletteIndex = 0) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn(`未找到图表 canvas: ${canvasId}`);
    return null;
  }

  const ctx = canvas.getContext("2d");
  const options = cloneChartOptions();
  options.aspectRatio = aspectRatio;
  options.scales.x.max = Math.max(indexLength - 1, 0);
  // 路由四图每张只有一条线，卡片标题已经说明指标，不再占用图例空间。
  options.plugins.legend.display = false;
  // 每张图的醒目标题（指标名）
  options.plugins.title.text = text || label;
  // 从指标名的括号后缀提取纵轴单位，如 "平均端到端时延(s)" -> "单位: s"
  const unitMatch = /\(([^()]+)\)\s*$/.exec(label || "");
  if (unitMatch) {
    options.scales.y.title.text = `单位: ${unitMatch[1]}`;
  }

  const color = CHART_PALETTE[paletteIndex % CHART_PALETTE.length];

  return new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({ length: indexLength }, (_, i) => i),
      datasets: [
        {
          pointRadius: 1.8,
          pointHoverRadius: 3.2,
          pointBackgroundColor: color,
          label,
          data: Array.from({ length: indexLength }, () => 0),
          borderColor: color,
          backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.16)"),
          borderWidth: 1.8,
          tension: 0.25,
          fill: false,
        },
      ],
    },
    options,
  });
}

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  borderWidth: 1,
  font: { family: "Arial, sans-serif", size: 11 },
  layout: { padding: { top: 2, right: 8 } },
  scales: {
    x: {
      min: 0,
      max: 15,
      // 横轴：帧序号（每帧约5秒），刻度数字加大到可读
      title: {
        display: true,
        text: "采样帧（约5s/帧）",
        font: { size: 9, weight: "bold" },
        color: "#9fc3e8",
        padding: { top: 2 },
      },
      ticks: {
        stepSize: 1,
        font: { size: 9 },
        color: "#e6f1ff",
        maxRotation: 0,
        autoSkip: true,
        maxTicksLimit: 6,
      },
      grid: { color: "rgba(140, 170, 200, 0.18)" },
    },
    y: {
      min: 0,
      max: 10,
      // 纵轴：单位随图表传入（见各 create 调用）
      title: {
        display: true,
        font: { size: 9, weight: "bold" },
        color: "#9fc3e8",
      },
      ticks: {
        stepSize: 10,
        font: { size: 9 },
        color: "#e6f1ff",
        maxTicksLimit: 6,
      },
      grid: { color: "rgba(140, 170, 200, 0.18)" },
    },
  },
  animation: { duration: 0 },
  aspectRatio: 1,
  plugins: {
    legend: {
      position: "top",
      align: "end",
      labels: {
        boxWidth: 14,
        boxHeight: 4,
        font: { size: 9 },
        color: "#eaf3ff",
      },
    },
    title: {
      display: true,
      font: { size: 11, weight: "bold" },
      color: "#f2f7ff",
      padding: { bottom: 6 },
    },
    tooltip: {
      titleFont: { size: 9 },
      bodyFont: { size: 9 },
      backgroundColor: "rgba(12, 22, 36, 0.95)",
      borderColor: "rgba(120, 165, 210, 0.4)",
      borderWidth: 1,
      padding: 6,
      cornerRadius: 4,
      caretPadding: 4,
      displayColors: false,
    },
  },
};

function cloneChartOptions() {
  const options = JSON.parse(JSON.stringify(CHART_OPTIONS));
  options.scales.y.ticks.stepSize = undefined;
  options.scales.y.ticks.maxTicksLimit = 5;
  options.scales.y.ticks.font.size = 10;
  options.scales.x.ticks.font.size = 10;
  // 图卡已经提供紧凑的指标标题，关闭 Chart.js 重复的大标题和轴标题，
  // 把更多空间留给实际折线；单位保留在卡片标题中。
  options.plugins.title.display = false;
  options.scales.x.title.display = false;
  options.scales.y.title.display = false;
  return options;
}

function updateYAxis(chart) {
  // 锁定了 y 上限的图（如利用率/丢包率 0~1）不自动扩轴
  if (chart.$lockedMaxY) return;

  const values = chart.data.datasets.flatMap((dataset) =>
    (Array.isArray(dataset.data) ? dataset.data : [])
      .map(Number)
      .filter((value) => Number.isFinite(value))
  );

  const maxValue = values.length ? Math.max(...values) : 0;
  const paddedMax = maxValue > 0 ? maxValue * 1.1 : 1;
  chart.options.scales.y.min = 0;
  chart.options.scales.y.max = paddedMax;
}
