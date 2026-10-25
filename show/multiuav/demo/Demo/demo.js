import { wsHandleMessage, resetNodeSnapshotState } from '../Network/sendMessage.js';
import { scenes, flag, flags, nodeDics, routeDics, clusterDics, macDics, activateScene, updateSceneStatus } from '../Move/viewControl.js';
import { QuestChartData, QuestMacChartData, QuestClusterChartData } from '../dataForm/chart.js';
import { models } from '../Model/model.js';
import { showMenuClicked } from '../Move/MenuSetting.js';

// This branch is an offline portfolio exhibit. No fetch, WebSocket or simulator
// is started; deterministic fixtures enter the existing message handling path.
window.__middlewarePathLoaded = true;
const presets = [
  { name: '协同巡航', algorithm: 'DFP-LR-WOCA', size: 24, mac: 'qosmac', scope: 1000, initialEnergyJ: 70 },
  { name: '基础分簇', algorithm: 'WOA', size: 30, mac: 'qosmac', scope: 1000, initialEnergyJ: 70 },
  { name: '消融观察', algorithm: 'DFP-LR-WOCA-no-RK', size: 36, mac: 'qosmac', scope: 1000, initialEnergyJ: 70 },
  { name: '大规模节点', algorithm: 'DFP-LR-WOCA', size: 48, mac: 'eemac', scope: 1500, initialEnergyJ: 70 },
];
let tick = 36;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const envelope = (sceneId, type, data, extra = {}) => ({ code: 200, sceneId: String(sceneId), algorithm: presets[sceneId].algorithm, route: presets[sceneId].algorithm, type, data, ...extra });
const wave = (t, s, n = 0) => Math.sin(t * .24 + s * 1.7 + n * .83);

function nodesFor(s, t) {
  const cfg = presets[s];
  return Array.from({ length: cfg.size }, (_, i) => {
    const group = Math.floor(i / 6);
    const head = group * 6 + 1;
    const phase = i * 2.39996 + s * .8;
    const radius = 38 + 112 * Math.sqrt((i + 1) / cfg.size);
    return {
      nodeID: i + 1,
      nodeStatus: i % 6 === 0 ? 'CLUSTER_HEAD' : i % 11 === 0 ? 'CLUSTER_GUEST' : 'CLUSTER_MEMBER',
      realPosition: { x: Math.cos(phase + t * .006) * radius + 8 * wave(t, s, i), y: Math.sin(phase + t * .006) * radius * .7 + 5 * wave(t + 3, s, i), z: 15 },
      velocity: { x: +(1.5 * wave(t, s, i)).toFixed(2), y: +(1.8 * wave(t + 2, s, i)).toFixed(2), z: 0 },
      energy: +(cfg.initialEnergyJ * (.72 + .23 * (i + 1) / cfg.size) - t * .004).toFixed(2),
      clusterHeadID: [head], weight: +(.3 + (i % 7) * .08).toFixed(2),
      nodeState: 1, entryTime: t, nodeIP: `10.${s + 1}.0.${i + 1}`,
    };
  });
}

function feedMetrics(s, t) {
  const a = wave(t, s);
  const b = wave(t * .7, s, 2);
  wsHandleMessage(envelope(s, 'routingmetrics', [{
    sceneId: String(s), sampleTime: t,
    AverageDelay: +(.025 + s * .003 + .009 * (1 + a)).toFixed(4),
    lossPacketRatio: +(1.4 + s * .35 + .7 * (1 + b)).toFixed(2),
    convergenceTime: +(.3 + .08 * s + .07 * (1 + a)).toFixed(3),
    AvgThroughput: +(1.7 + s * .12 + .24 * a).toFixed(3),
  }]));
  wsHandleMessage(envelope(s, 'clustermetrics', [{
    sceneId: String(s), snapshotId: t + 1, sampleTime: t,
    avgCHLifetime: +(12 + t * .3 + 2 * a + s).toFixed(2),
    avgMemberLifetime: +(9 + t * .22 + 1.5 * b + s).toFixed(2),
    clusterMaintenanceMessages: Math.round(28 + t * 1.5 + s * 4),
    clusterHeadClaimMessages: Math.round(7 + t * .4 + s * 2),
    guestMaintenanceMessages: Math.round(4 + t * .18 + s),
  }], { snapshotId: t + 1 }));
  const priorities = presets[s].mac === 'qosmac' ? ['average', 'p1', 'p2', 'p3', 'p4'] : ['average'];
  wsHandleMessage(envelope(s, 'macmetrics', priorities.map((priority, p) => ({
    sceneId: String(s), priority,
    datas: { delay: +(3 + p * 2.2 + .8 * (1 + a)).toFixed(2), channelUtilization: +(.55 + .12 * b).toFixed(3), packetLossRatio: +(.012 + .005 * (1 + a)).toFixed(4), throughput: +(1250 + s * 80 + 140 * b).toFixed(1) },
  }))));
  // Message ingestion intentionally uses the production parser; histories are
  // capped here so an unattended public exhibit cannot grow without bound.
  if (routeDics[s].length > 120) routeDics[s].splice(0, routeDics[s].length - 120);
}

function feedNodes(s, t) {
  wsHandleMessage(envelope(s, 'clusternode', nodesFor(s, t), { snapshot: true, snapshotId: t + 1 }));
  updateSceneStatus(s, `${presets[s].algorithm} · ${presets[s].size} 节点 · 模拟数据`, 'running');
}

function renderStatus() {
  $('demo-play').textContent = paused ? '继续演示' : '暂停演示';
  $('demo-play').setAttribute('aria-pressed', String(!paused));
  $('demo-time').textContent = `${String(tick).padStart(3, '0')} s`;
  const i = Number(flag.activeSceneIndex ?? 0);
  const cfg = presets[i];
  $('demo-active').textContent = `场景 ${i} · ${cfg.algorithm}`;
  $('mac-qos-badge').dataset.qos = cfg.mac === 'qosmac' ? 'yes' : 'no';
  $('mac-qos-badge').textContent = cfg.mac === 'qosmac' ? 'QoS (qosmac)' : '无QoS (eemac)';
}

function syncConfig() {
  const s = Number($('base-config-scene').value);
  const cfg = presets[s];
  $('base-config-deal').value = cfg.algorithm;
  $('base-config-node-num').value = cfg.size;
  $('base-config-mac').value = cfg.mac;
  $('base-config-scope').value = cfg.scope;
}

function refresh() {
  presets.forEach((_, s) => feedNodes(s, tick));
  QuestChartData(); QuestMacChartData(); QuestClusterChartData(); renderStatus();
}

$('demo-play').addEventListener('click', () => { paused = !paused; renderStatus(); });
$('demo-reset').addEventListener('click', () => {
  Object.keys(localStorage).filter(key => key.startsWith('multiuav-demo-')).forEach(key => localStorage.removeItem(key));
  location.reload();
});
$('base-config-scene').addEventListener('change', syncConfig);
$('pathEnsure').addEventListener('click', () => {
  const disconnected = $('pathChild').value === 'closeWS';
  paused = disconnected;
  $('connection-status').className = 'status-chip status-connected';
  $('connection-status').querySelector('span').textContent = disconnected ? '演示已暂停' : '本地模拟';
  refresh();
});
$('submit-simulation-config').addEventListener('click', () => {
  const s = Number($('base-config-scene').value);
  const count = Number($('base-config-node-num').value);
  const energy = Number($('base-config-initial-energy').value);
  const duration = Number($('base-config-sim-time').value);
  const scope = Number($('base-config-scope').value);
  if (!Number.isInteger(count) || count < 2 || count > 120 || !Number.isFinite(energy) || energy <= 0 || duration <= 0 || scope <= 0) {
    $('simulation-status').textContent = '请填写有效参数；静态演示支持 2–120 个节点。'; return;
  }
  Object.assign(presets[s], { size: count, algorithm: $('base-config-deal').value, mac: $('base-config-mac').value, scope, initialEnergyJ: energy });
  resetNodeSnapshotState(s);
  routeDics[s] = []; clusterDics[s] = []; macDics[s].history = [];
  for (let t = Math.max(0, tick - 35); t <= tick; t++) feedMetrics(s, t);
  feedNodes(s, tick);
  activateScene(s);
  $('simulation-status').className = 'simulation-status status-success';
  $('simulation-status').textContent = `场景 ${s} 演示配置已应用 · ${count} 节点 · ${presets[s].algorithm}。其他参数仅预览，不启动真实仿真。`;
  renderStatus();
});
$('demo-inspect').addEventListener('click', () => {
  const s = Number(flag.activeSceneIndex);
  const id = $('locate-input').value.trim() || '1';
  const object = scenes[s].scene.children.find(o => String(o.userData?.id) === id);
  if (!object) { $('demo-active').textContent = '未找到节点，请输入当前场景中的节点 ID'; return; }
  flags[s].activeObject = object;
  showMenuClicked({ x: Math.max(12, innerWidth / 2 - 120), y: Math.min(160, innerHeight / 3) }, id);
});
window.addEventListener('scene:active-changed', () => { renderStatus(); });

async function boot() {
  // Wait for the real image models to be usable before feeding the first nodes.
  for (let attempt = 0; !models.fourUAVWhite || scenes.length !== 4; attempt++) {
    if (attempt > 200) throw new Error('演示资源未能载入，请刷新页面。');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  presets.forEach((_, s) => {
    routeDics[s] = []; clusterDics[s] = []; macDics[s].history = [];
    for (let t = 0; t <= tick; t++) feedMetrics(s, t);
    feedNodes(s, tick);
  });
  activateScene(0);
  $('connection-status').className = 'status-chip status-connected';
  $('connection-status').querySelector('span').textContent = '本地模拟';
  $('simulation-status').textContent = '四个场景已载入模拟数据，可预览配置与指标。';
  syncConfig(); renderStatus();
  document.documentElement.dataset.demoReady = 'true';
  setInterval(() => {
    if (paused || document.hidden) return;
    tick++;
    if (tick > 600) { location.reload(); return; }
    presets.forEach((_, s) => { feedMetrics(s, tick); feedNodes(s, tick); });
    renderStatus();
  }, 1500);
}
boot().catch(error => { $('demo-active').textContent = error.message; console.error(error); });
