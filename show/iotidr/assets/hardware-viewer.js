import { devices } from './hardware-data.js';

const $ = (id) => document.getElementById(id);
const layout = $('hardware-layout');
const host = $('hardware-scene');
const labelHost = $('hardware-labels');
const list = $('hardware-device-list');
let selected = devices[0].id;
let sceneSelect = () => {};
const text = (tag, value, className) => {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
};

// The same data powers model picking, keyboard buttons and the fallback view.
function selectDevice(id) {
  const index = devices.findIndex((device) => device.id === id);
  if (index < 0) return;
  const device = devices[index];
  selected = id;
  layout.dataset.selectedDevice = id;
  $('device-number').textContent = `DEVICE ${String(index + 1).padStart(2, '0')}`;
  $('device-kind').textContent = device.kind;
  $('device-title').textContent = device.name;
  $('device-description').textContent = device.description;
  $('device-note').textContent = device.note;
  $('device-specs').replaceChildren(...device.specs.map(([name, value]) => {
    const row = document.createElement('div');
    row.append(text('dt', name), text('dd', value));
    return row;
  }));
  const rows = [];
  let group = '';
  const grouped = new Set(device.ports.map((port) => port.group)).size > 1;
  for (const port of device.ports) {
    if (grouped && port.group !== group) {
      group = port.group;
      const row = document.createElement('tr');
      row.className = 'port-group';
      const heading = text('th', group);
      heading.colSpan = 3;
      heading.scope = 'colgroup';
      row.append(heading);
      rows.push(row);
    }
    const row = document.createElement('tr');
    row.append(text('td', port.mcu), text('td', port.target), text('td', port.use));
    rows.push(row);
  }
  $('device-pin-rows').replaceChildren(...rows);
  $('device-port-summary').textContent = `${device.ports.length} 项信号对应 · ${device.id === 'controller' ? '接口资源总览' : device.kind + '接口'}`;
  document.querySelectorAll('[data-device]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.device === id));
  });
  $('hardware-panel').scrollTop = 0;
  sceneSelect(id);
}

for (const [index, device] of devices.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'device-pick';
  button.dataset.device = device.id;
  button.setAttribute('aria-pressed', 'false');
  button.append(text('span', String(index + 1).padStart(2, '0'), 'device-index'), text('span', device.label));
  button.addEventListener('click', () => selectDevice(device.id));
  list.append(button);
}

const tabs = [$('tab-overview'), $('tab-ports')];
function setTab(index, focus = false) {
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = i !== index;
  });
  if (focus) tabs[index].focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => setTab(index));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setTab(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index, true);
  });
});
selectDevice(selected);

function fallback(message) {
  layout.classList.add('is-fallback');
  layout.dataset.renderState = 'fallback';
  $('hardware-state').hidden = false;
  $('hardware-state').textContent = message;
  labelHost.replaceChildren();
  host.querySelector('canvas')?.remove();
  $('view-top').disabled = true;
  $('view-reset').disabled = true;
}

async function startScene() {
  const THREE = await import('three');
  const { OrbitControls } = await import('./vendor/OrbitControls.js');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'IoTIDR 三维硬件系统。拖动旋转，滚轮缩放，点击设备查看详情；也可使用下方设备按钮。');
  canvas.setAttribute('role', 'img');
  host.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .12;
  controls.enablePan = false;
  controls.minZoom = .65;
  controls.maxZoom = 2.5;
  controls.minPolarAngle = .08;
  controls.maxPolarAngle = Math.PI * .44;
  controls.target.set(0, .25, 0);
  camera.position.set(8.5, 12, 14);
  controls.update();
  const homePosition = camera.position.clone();
  const homeTarget = controls.target.clone();
  let visible = true;
  let frame = 0;
  let budget = 0;
  const labels = [];
  const groups = new Map();
  const connections = new Map();
  const meshes = [];
  const rings = new Map();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const isNarrow = () => host.clientWidth < 540;
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .58, metalness: .12, ...options });
  const metal = material('#b4c0ce', { metalness: .7, roughness: .32 });
  const black = material('#172434');
  const gold = material('#d5b96e', { metalness: .65 });
  const pcb = material('#176b6c', { roughness: .7 });
  const pale = material('#ebeff5');
  const blue = material('#3a73b5');
  const screenMat = material('#102b48', { roughness: .28, metalness: .2 });
  const groundMaterial = material('#eef3fa', { roughness: 1, metalness: 0 });
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x9daec4, 2.5);
  scene.add(hemisphere);
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-5, 12, 8);
  light.castShadow = true;
  light.shadow.mapSize.set(1536, 1536);
  Object.assign(light.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: .5, far: 30 });
  light.shadow.normalBias = .06;
  light.shadow.bias = -.0002;
  scene.add(light);
  const fill = new THREE.DirectionalLight(0xbad7ff, 1.7);
  fill.position.set(8, 7, -7);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), groundMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.1;
  floor.receiveShadow = true;
  scene.add(floor);

  function addMesh(group, geometry, mat, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
    return mesh;
  }
  const box = (g, w, h, d, mat, x = 0, y = 0, z = 0) => addMesh(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const cylinder = (g, radius, height, mat, x = 0, y = 0, z = 0) => addMesh(g, new THREE.CylinderGeometry(radius, radius, height, 32), mat, x, y, z);
  function tile(g, w, d, h, mat, y = 0, radius = .12) {
    const x = -w / 2, z = -d / 2;
    const r = Math.min(radius, w / 4, d / 4);
    const shape = new THREE.Shape();
    shape.moveTo(x + r, z); shape.lineTo(x + w - r, z); shape.quadraticCurveTo(x + w, z, x + w, z + r);
    shape.lineTo(x + w, z + d - r); shape.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
    shape.lineTo(x + r, z + d); shape.quadraticCurveTo(x, z + d, x, z + d - r);
    shape.lineTo(x, z + r); shape.quadraticCurveTo(x, z, x + r, z);
    const mesh = addMesh(g, new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2, steps: 1 }), mat, 0, y);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }
  function chip(g, w, d, x, y, z) {
    box(g, w, .15, d, black, x, y, z);
    const count = 8;
    for (let i = 0; i < count; i++) {
      const off = (i / (count - 1) - .5);
      box(g, .065, .04, .17, metal, x + off * w * .9, y - .03, z + d / 2 + .04);
      box(g, .065, .04, .17, metal, x + off * w * .9, y - .03, z - d / 2 - .04);
      box(g, .17, .04, .065, metal, x + w / 2 + .04, y - .03, z + off * d * .9);
      box(g, .17, .04, .065, metal, x - w / 2 - .04, y - .03, z + off * d * .9);
    }
  }
  function pins(g, n, x, z, horizontal = true, pitch = .13) {
    for (let i = 0; i < n; i++) {
      box(g, .065, .2, .065, gold, x + (horizontal ? (i - (n - 1) / 2) * pitch : 0), .28, z + (horizontal ? 0 : (i - (n - 1) / 2) * pitch));
    }
  }
  function topText(g, label, w, d, x, y, z, ink = '#e2f2ef') {
    const surface = document.createElement('canvas');
    surface.width = 512; surface.height = 192;
    const ctx = surface.getContext('2d');
    ctx.clearRect(0, 0, 512, 192);
    ctx.fillStyle = ink; ctx.font = '500 56px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 96);
    const tex = new THREE.CanvasTexture(surface);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); g.add(mesh);
  }
  function base(g, w = 1.25, d = 1.3) {
    tile(g, w + .3, d + .3, .08, pale, -.01, .14);
    tile(g, w, d, .08, pcb, .1);
  }
  function makeDevice(device) {
    const g = new THREE.Group();
    g.userData.device = device.id;
    g.position.set(device.position[0], .03, device.position[1]);
    scene.add(g); groups.set(device.id, g);
    if (device.id === 'controller') {
      tile(g, 3.05, 2.45, .14, material('#173e56'), .12);
      chip(g, .98, .98, 0, .4, -.12);
      topText(g, 'STM32', .8, .3, 0, .49, -.12);
      for (const x of [-1.36, 1.36]) pins(g, 14, x, 0, false, .135);
      pins(g, 15, 0, -1.05, true, .13); pins(g, 15, 0, 1.05, true, .13);
      box(g, .48, .2, .35, metal, -.82, .34, .6);
      box(g, .28, .18, .18, black, .84, .33, .66);
      for (let i = 0; i < 5; i++) box(g, .16, .07, .09, pale, -.9 + i * .4, .29, -.73);
      topText(g, 'IoTIDR', .65, .25, .8, .3, .35);
    } else if (device.id === 'dht') {
      base(g, 1, 1.15);
      box(g, .75, 1.15, .52, blue, 0, .84, 0);
      for (let i = 0; i < 6; i++) box(g, .58, .045, .018, black, 0, .48 + i * .16, .27);
      pins(g, 3, 0, .45);
    } else if (device.id === 'light') {
      base(g, 1.1, 1.1);
      cylinder(g, .31, .09, material('#d2a86b'), 0, .43, -.12);
      for (let i = 0; i < 4; i++) box(g, .04, .012, .38, black, -.18 + i * .12, .482, -.12);
      box(g, .22, .1, .16, blue, 0, .28, .35);
      pins(g, 3, 0, .49);
    } else if (device.id === 'lcd') {
      base(g, 2.15, 1.65);
      tile(g, 1.95, 1.5, .15, black, .24);
      tile(g, 1.72, 1.27, .015, screenMat, .43, .035);
      topText(g, 'IoTIDR', 1.3, .3, 0, .495, -.33, '#9edfee');
      for (let i = 0; i < 3; i++) box(g, 1.3, .01, .1, material(i === 0 ? '#426f9b' : '#2b4d72'), 0, .49, -.03 + i * .27);
      pins(g, 12, 0, .79, true, .13);
    } else if (device.id === 'motor') {
      tile(g, 2, 1.55, .08, pale, .02);
      cylinder(g, .53, .62, metal, -.3, .51, -.05);
      cylinder(g, .54, .09, blue, -.3, .86, -.05);
      cylinder(g, .13, .32, metal, -.18, 1.05, -.05);
      box(g, 1.25, .09, .25, metal, -.3, .17, -.05);
      box(g, .58, .07, 1.05, pcb, .59, .16, .1);
      box(g, .31, .11, .54, black, .59, .26, .1);
      pins(g, 4, .59, .54, true, .1);
      for (let i = 0; i < 4; i++) box(g, .04, .04, .4, material(['#ce8452','#cc5a63','#668cce','#be9f47'][i]), .01 + i * .09, .2, .39);
    } else if (device.id === 'wifi') {
      base(g, 1.25, 1.55);
      box(g, .78, .14, .71, metal, 0, .34, .12);
      box(g, .62, .08, .3, black, 0, .31, -.51);
      for (let i = 0; i < 4; i++) box(g, .06, .01, .27, gold, -.24 + i * .16, .36, -.51);
      topText(g, 'WiFi', .54, .22, 0, .419, .12, '#46596f');
      pins(g, 6, 0, .68);
    } else if (device.id === 'ir') {
      base(g, 1, 1.05);
      box(g, .52, .7, .4, black, 0, .58, 0);
      const dome = addMesh(g, new THREE.SphereGeometry(.25, 24, 16), black, 0, .63, .19);
      dome.scale.z = .6;
      pins(g, 3, 0, .45);
    } else if (device.id === 'keys') {
      base(g, 1.6, .9);
      for (let i = 0; i < 3; i++) {
        box(g, .35, .12, .35, metal, -.53 + i * .53, .29, 0);
        cylinder(g, .11, .13, black, -.53 + i * .53, .41, 0);
      }
      pins(g, 4, 0, .42);
    } else if (device.id === 'led') {
      base(g, 1.2, .95);
      for (let i = 0; i < 2; i++) {
        const x = -.3 + i * .6;
        cylinder(g, .17, .24, material(i ? '#73a790' : '#bd656f'), x, .39, 0);
        addMesh(g, new THREE.SphereGeometry(.17, 24, 16), material(i ? '#73a790' : '#bd656f'), x, .51, 0);
        box(g, .12, .07, .28, pale, x, .24, .3);
      }
      pins(g, 3, 0, .43);
    } else if (device.id === 'buzzer') {
      base(g, 1.05, 1.05);
      cylinder(g, .37, .4, black, 0, .46, 0);
      cylinder(g, .085, .012, material('#050b12'), 0, .666, 0);
      pins(g, 3, 0, .47);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(device.id === 'controller' ? 1.96 : device.id === 'lcd' ? 1.52 : device.id === 'motor' ? 1.42 : 1.05, .017, 6, 64), new THREE.MeshBasicMaterial({ color: '#4264d4' }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .05; ring.visible = false; g.add(ring); rings.set(device.id, ring);
    // Generous transparent pick volume improves touch without obscuring the model.
    const hit = new THREE.Mesh(new THREE.BoxGeometry(device.id === 'controller' ? 3.1 : device.id === 'lcd' ? 2.2 : device.id === 'motor' ? 2 : 1.45, device.id === 'dht' ? 1.6 : 1, device.id === 'controller' ? 2.5 : device.id === 'lcd' ? 1.7 : 1.5), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    hit.position.y = .45; g.add(hit); meshes.push(hit);
    const label = document.createElement('button'); label.type = 'button'; label.className = 'hardware-label'; label.dataset.device = device.id;
    label.append(text('span', String(devices.indexOf(device) + 1).padStart(2, '0')), text('b', device.label));
    label.setAttribute('aria-pressed', 'false'); label.addEventListener('click', () => selectDevice(device.id)); labelHost.append(label);
    labels.push({ device, element: label, anchor: new THREE.Vector3(device.position[0], device.id === 'dht' ? 1.65 : 1, device.position[1]) });
  }
  devices.forEach(makeDevice);
  for (const device of devices.slice(1)) {
    const [sx, sz] = device.anchor;
    const [ex, ez] = device.position;
    const start = new THREE.Vector3(sx, .31, sz);
    const end = new THREE.Vector3(ex, .2, ez);
    const curve = new THREE.CatmullRomCurve3([start, new THREE.Vector3(sx * 1.28, .18, sz * 1.28), new THREE.Vector3((sx + ex) / 2, .06, (sz + ez) / 2), end]);
    const mat = new THREE.MeshStandardMaterial({ color: device.color, roughness: .6, transparent: true, opacity: .38 });
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, .023, 6, false), mat);
    wire.userData.device = device.id; scene.add(wire); meshes.push(wire);
    const terminal = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 10), material(device.color));
    terminal.position.copy(start); terminal.userData.device = device.id; scene.add(terminal); meshes.push(terminal);
    connections.set(device.id, { wire, terminal });
  }

  function invalidate() {
    budget = 32;
    if (visible && !frame) frame = requestAnimationFrame(render);
  }
  function positionLabels() {
    const width = host.clientWidth, height = host.clientHeight;
    const used = [];
    // Selected labels win collision checks; small displays keep only that label.
    const order = [...labels].sort((a, b) => Number(b.device.id === selected) - Number(a.device.id === selected));
    for (const label of order) {
      const p = label.anchor.clone().project(camera);
      const x = (p.x + 1) * width / 2, y = (1 - p.y) * height / 2 - 12;
      const el = label.element;
      const w = el.offsetWidth || 85, h = el.offsetHeight || 30;
      const rect = { x: x - w / 2, y: y - h, w, h };
      const intersects = used.some((u) => rect.x < u.x + u.w + 5 && rect.x + w + 5 > u.x && rect.y < u.y + u.h + 5 && rect.y + h + 5 > u.y);
      const show = p.z > -1 && p.z < 1 && rect.x > 5 && rect.x + w < width - 5 && rect.y > 58 && y < height - 35 && (!isNarrow() || label.device.id === selected) && (!intersects || label.device.id === selected);
      el.hidden = !show;
      if (show) { el.style.left = `${x}px`; el.style.top = `${y}px`; used.push(rect); }
    }
  }
  function render() {
    frame = 0;
    if (!visible) return;
    controls.update();
    renderer.render(scene, camera);
    positionLabels();
    if (--budget > 0 && !frame) frame = requestAnimationFrame(render);
  }
  sceneSelect = (id) => {
    rings.forEach((ring, key) => { ring.visible = key === id; });
    connections.forEach(({ wire, terminal }, key) => {
      const active = key === id || id === 'controller';
      wire.material.opacity = active ? .9 : .12;
      terminal.material.emissive.setHex(key === id ? 0x183e68 : 0x000000);
      wire.scale.setScalar(1);
    });
    invalidate();
  };
  controls.addEventListener('change', invalidate);
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    const half = Math.max(5.4, 6.9 / aspect);
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix(); renderer.setSize(w, h, false); invalidate();
    $('hardware-help').textContent = isNarrow() ? '单指旋转 · 双指缩放 · 点选下方设备' : '拖动旋转 · 滚轮缩放 · 点击设备';
  }
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) invalidate(); }, { rootMargin: '120px' }).observe(host);
  function reset(top = false) {
    camera.position.copy(top ? new THREE.Vector3(0, 18, .01) : homePosition);
    controls.target.copy(homeTarget); camera.zoom = 1; camera.updateProjectionMatrix(); controls.update(); invalidate();
  }
  $('view-reset').addEventListener('click', () => reset());
  $('view-top').addEventListener('click', () => reset(true));
  function applyTheme() {
    const dark = darkQuery.matches;
    const color = dark ? '#101e32' : '#eef3fa';
    scene.background = new THREE.Color(color);
    groundMaterial.color.set(color);
    hemisphere.intensity = dark ? 2.2 : 2.5;
    invalidate();
  }
  darkQuery.addEventListener('change', applyTheme);
  let pressed = null;
  let multiTouch = false;
  const pointers = new Set();
  function hit(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const intersection of raycaster.intersectObjects(meshes, false)) {
      let object = intersection.object;
      while (object && !object.userData.device) object = object.parent;
      if (object?.userData.device) return object.userData.device;
    }
    return null;
  }
  canvas.addEventListener('pointerdown', (event) => {
    pointers.add(event.pointerId);
    if (pointers.size > 1) { multiTouch = true; pressed = null; return; }
    multiTouch = false;
    pressed = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  canvas.addEventListener('pointerup', (event) => {
    const origin = pressed;
    pointers.delete(event.pointerId);
    if (origin && !multiTouch && origin.id === event.pointerId && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 6) {
      const id = hit(event); if (id) selectDevice(id);
    }
    pressed = null;
    if (!pointers.size) multiTouch = false;
  });
  canvas.addEventListener('pointercancel', (event) => { pointers.delete(event.pointerId); pressed = null; });
  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' && !pointers.size) canvas.style.cursor = hit(event) ? 'pointer' : 'grab';
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); visible = false;
    if (frame) cancelAnimationFrame(frame);
    controls.dispose(); renderer.dispose();
    fallback('三维显示暂时不可用，仍可选择下方设备查看信息和端口。');
  });
  applyTheme(); resize(); sceneSelect(selected);
  document.querySelectorAll('[data-device]').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.device === selected)));
  $('hardware-state').hidden = true;
  layout.dataset.renderState = 'ready';
}

startScene().catch((error) => {
  console.warn('IoTIDR 3D initialization:', error);
  fallback('当前浏览器暂不支持三维显示，仍可选择下方设备查看信息和端口。');
});
