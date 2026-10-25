import { flows } from './flow-data.js';

const root = document.getElementById('system-data-flow');
const map = document.getElementById('transport-map');
const svg = document.getElementById('transport-lines');
const paths = document.getElementById('transport-paths');
const dot = document.getElementById('transport-packet');
const halo = document.getElementById('transport-halo');
const play = document.getElementById('transport-play');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const owners = ['ns-3 后端', '中间件', '前端／调用端'];
let mode = 'telemetry', stepIndex = 0, elapsed = 0, previous = 0, frame = 0;
let playing = !motion.matches, visible = false, edges = [];
const period = 2600;
const field = id => document.getElementById(id);

function showStep(index) {
  stepIndex = index % flows[mode].steps.length;
  const step = flows[mode].steps[stepIndex];
  map.querySelectorAll('.transport-node').forEach((node, i) => node.setAttribute('aria-pressed', String(i === stepIndex)));
  field('packet-index').textContent = `STEP ${String(stepIndex + 1).padStart(2, '0')} / ${String(flows[mode].steps.length).padStart(2, '0')} · ${owners[step.lane - 1]}`;
  field('packet-title').textContent = step.title;
  field('packet-description').textContent = step.description;
  field('packet-transform').textContent = step.transform;
  field('packet-format').textContent = step.format;
  const code = field('packet-payload');
  code.replaceChildren();
  const serialized = JSON.stringify(step.payload, null, 2);
  // Build token spans via text nodes; payload text is never inserted as HTML.
  const tokens = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|\b(-?\d+(?:\.\d+)?|true|false|null)\b/g;
  let last = 0;
  for (const match of serialized.matchAll(tokens)) {
    code.append(document.createTextNode(serialized.slice(last, match.index)));
    const span = document.createElement('span');
    span.className = match[1] ? 'flow-key' : match[2] ? 'flow-string' : 'flow-number';
    span.textContent = match[0]; code.append(span); last = match.index + match[0].length;
  }
  code.append(document.createTextNode(serialized.slice(last)));
  edges.forEach((edge, i) => { edge.path.classList.toggle('is-traversed', i < stepIndex); edge.path.classList.toggle('is-current', i === stepIndex); });
  root.dataset.step = String(stepIndex);
  paint();
}

function resize() {
  const bounds = map.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  const nodes = [...map.querySelectorAll('.transport-node')];
  edges.forEach((edge, i) => {
    const ra = nodes[i].getBoundingClientRect(), rb = nodes[i + 1].getBoundingClientRect();
    const a = { x: (ra.left + ra.right) / 2 - bounds.left, y: (ra.top + ra.bottom) / 2 - bounds.top, left: ra.left - bounds.left, right: ra.right - bounds.left, top: ra.top - bounds.top, bottom: ra.bottom - bounds.top };
    const b = { x: (rb.left + rb.right) / 2 - bounds.left, y: (rb.top + rb.bottom) / 2 - bounds.top, left: rb.left - bounds.left, right: rb.right - bounds.left, top: rb.top - bounds.top, bottom: rb.bottom - bounds.top };
    let d;
    if (Math.abs(a.x - b.x) < 5) {
      const sy = b.y > a.y ? a.bottom : a.top, ey = b.y > a.y ? b.top - 6 : b.bottom + 6;
      const middle = (sy + ey) / 2;
      d = `M${a.x},${sy} C${a.x},${middle} ${b.x},${middle} ${b.x},${ey}`;
    } else {
      const sx = b.x > a.x ? a.right : a.left, ex = b.x > a.x ? b.left - 6 : b.right + 6, middle = (sx + ex) / 2;
      d = `M${sx},${a.y} C${middle},${a.y} ${middle},${b.y} ${ex},${b.y}`;
    }
    edge.path.setAttribute('d', d); edge.length = edge.path.getTotalLength();
  });
  paint();
}

function paint() {
  const edge = edges[stepIndex];
  dot.style.display = halo.style.display = edge ? '' : 'none';
  if (!edge?.length) return;
  const point = edge.path.getPointAtLength(edge.length * Math.min(elapsed / period, 1));
  for (const element of [dot, halo]) { element.setAttribute('cx', point.x); element.setAttribute('cy', point.y); }
}

function choose(modeName) {
  if (!flows[modeName]) return;
  mode = modeName; elapsed = 0; previous = 0;
  root.dataset.mode = mode;
  field('transport-box').style.setProperty('--flow-color', flows[mode].color);
  field('flow-summary').textContent = flows[mode].summary;
  field('transport-direction').textContent = flows[mode].direction;
  field('flow-note').textContent = flows[mode].note;
  root.querySelectorAll('[data-transport-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.transportMode === mode)));
  map.querySelectorAll('.transport-node').forEach(node => node.remove()); paths.replaceChildren();
  flows[mode].steps.forEach((step, i) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'transport-node'; button.dataset.node = step.id;
    button.style.gridColumn = String(step.lane); button.style.gridRow = String(step.row);
    button.setAttribute('aria-controls', 'packet-inspector');
    for (const [tag, cls, text] of [['span', 'transport-step', `${String(i + 1).padStart(2, '0')} · ${owners[step.lane - 1]}`], ['strong', '', step.title], ['small', '', step.format]]) {
      const child = document.createElement(tag); child.className = cls; child.textContent = text; button.append(child);
    }
    button.addEventListener('click', () => { setPlaying(false); elapsed = 0; showStep(i); });
    map.append(button);
  });
  edges = flows[mode].steps.slice(1).map(() => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('marker-end', 'url(#transport-arrow)'); paths.append(path); return { path, length: 0 };
  });
  showStep(0); resize(); schedule();
}

function animate(time) {
  frame = 0;
  if (!playing || !visible || document.hidden) { previous = 0; return; }
  if (previous) elapsed += Math.min(time - previous, 80);
  previous = time;
  if (elapsed >= period) { elapsed %= period; showStep(stepIndex + 1); }
  paint(); schedule();
}
function schedule() { if (playing && visible && !document.hidden && !frame) frame = requestAnimationFrame(animate); }
function setPlaying(value) {
  playing = value; previous = 0;
  play.textContent = playing ? '暂停动画' : '播放动画'; play.setAttribute('aria-pressed', String(playing));
  root.dataset.playing = String(playing);
  if (!playing && frame) { cancelAnimationFrame(frame); frame = 0; }
  schedule();
}
root.querySelectorAll('[data-transport-mode]').forEach(button => button.addEventListener('click', () => choose(button.dataset.transportMode)));
play.addEventListener('click', () => setPlaying(!playing));
field('transport-next').addEventListener('click', () => { setPlaying(false); elapsed = 0; showStep(stepIndex + 1); });
new ResizeObserver(resize).observe(map);
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; previous = 0; if (visible) schedule(); else if (frame) { cancelAnimationFrame(frame); frame = 0; } }, { rootMargin: '80px' }).observe(map);
document.addEventListener('visibilitychange', () => { previous = 0; if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; } else schedule(); });
motion.addEventListener('change', () => setPlaying(!motion.matches));
choose('telemetry'); setPlaying(playing);
