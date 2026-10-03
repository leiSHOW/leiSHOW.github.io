const map = document.getElementById('flow-map');
const svg = document.getElementById('flow-lines');
const container = document.getElementById('flow-paths');
const dot = document.getElementById('flow-packet');
const halo = document.getElementById('flow-packet-halo');
const play = document.getElementById('flow-play');
const nodes = new Map([...map.querySelectorAll('[data-flow-node]')].map((n) => [n.dataset.flowNode, n]));
const plans = {
  sensing: { ids: ['sensors','mcu','lcd'], label: '传感器 → STM32 → LCD' },
  control: { ids: ['phone','cloud','wifi','mcu','driver','motor'], label: 'APP → 机智云 → WiFi → STM32 → 驱动 → 电机' },
  report: { ids: ['mcu','wifi','cloud','phone'], label: 'STM32 → WiFi → 机智云 → APP' }
};
const pairs = [['sensors','mcu'],['mcu','driver'],['driver','motor'],['mcu','lcd'],['mcu','wifi'],['wifi','cloud'],['cloud','phone']];
const edges = [];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let mode = 'sensing';
let playing = !reducedMotion.matches;
let visible = false;
let frame = 0;
let elapsed = 0;
let lastTime = 0;
for (const [a,b] of pairs) {
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.dataset.edge = `${a}-${b}`;
  container.append(path);
  edges.push({a,b,path,length:0});
}
function choose(id) {
  if (!plans[id]) return;
  mode = id; elapsed = 0; lastTime = 0;
  map.dataset.activeFlow = mode;
  const plan = plans[mode];
  document.querySelectorAll('[data-flow]').forEach((button) => button.setAttribute('aria-pressed',String(button.dataset.flow === mode)));
  nodes.forEach((node,id) => node.classList.toggle('is-active',plan.ids.includes(id)));
  edges.forEach((edge) => edge.path.classList.toggle('is-active',plan.ids.some((id,i) => i < plan.ids.length-1 && ((id===edge.a && plan.ids[i+1]===edge.b)||(id===edge.b && plan.ids[i+1]===edge.a)))));
  document.getElementById('flow-order').textContent = plan.label;
  resize(); schedule();
}
function resize() {
  const compact = map.clientWidth / parseFloat(getComputedStyle(document.documentElement).fontSize) < 17;
  map.classList.toggle('is-compact',compact);
  nodes.forEach((node,id)=>{node.style.order=compact?String(plans[mode].ids.indexOf(id)):'';});
  const bounds = map.getBoundingClientRect();
  svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
  const rectangles = new Map([...nodes].map(([id,node])=>{
    const r=node.getBoundingClientRect();
    return [id,{left:r.left-bounds.left,right:r.right-bounds.left,top:r.top-bounds.top,bottom:r.bottom-bounds.top,x:(r.left+r.right)/2-bounds.left,y:(r.top+r.bottom)/2-bounds.top}];
  }));
  for (const edge of edges) {
    const a=rectangles.get(edge.a), b=rectangles.get(edge.b);
    let d;
    if (Math.abs(a.x-b.x)<5) {
      const sy=b.y>a.y?a.bottom:a.top, ey=b.y>a.y?b.top:b.bottom;
      const middle=(sy+ey)/2;
      d=`M ${a.x} ${sy} C ${a.x} ${middle} ${b.x} ${middle} ${b.x} ${ey}`;
    } else {
      const sx=b.x>a.x?a.right:a.left, ex=b.x>a.x?b.left:b.right;
      const middle=(sx+ex)/2;
      d=`M ${sx} ${a.y} C ${middle} ${a.y} ${middle} ${b.y} ${ex} ${b.y}`;
    }
    edge.path.setAttribute('d',d);edge.length=edge.path.getTotalLength();
  }
  paint();
}
function paint() {
  const plan=plans[mode];
  const progress=(elapsed/1050)%(plan.ids.length-1);
  const step=Math.floor(progress), fraction=progress-step;
  const a=plan.ids[step],b=plan.ids[step+1];
  const edge=edges.find((edge)=>(edge.a===a&&edge.b===b)||(edge.a===b&&edge.b===a));
  if(!edge || !edge.length)return;
  const point=edge.path.getPointAtLength(edge.length*(edge.a===a?fraction:1-fraction));
  for(const circle of [dot,halo]){circle.setAttribute('cx',point.x);circle.setAttribute('cy',point.y);}
  nodes.forEach((node,id)=>node.classList.toggle('is-current',id===a));
}
function animate(time) {
  frame=0;
  if(!playing || !visible || document.hidden){lastTime=0;return;}
  if(lastTime)elapsed+=Math.min(time-lastTime,60);
  lastTime=time;paint();schedule();
}
function schedule(){if(playing&&visible&&!document.hidden&&!frame)frame=requestAnimationFrame(animate);}
function setPlaying(value){
  playing=value;play.setAttribute('aria-pressed',String(playing));play.textContent=playing?'暂停动画':'播放动画';
  lastTime=0;
  if(!playing&&frame){cancelAnimationFrame(frame);frame=0;}
  map.dataset.playing=String(playing);schedule();
}
document.querySelectorAll('[data-flow]').forEach((button)=>button.addEventListener('click',()=>choose(button.dataset.flow)));
play.addEventListener('click',()=>setPlaying(!playing));
new ResizeObserver(resize).observe(map);
new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;lastTime=0;if(visible)schedule();else if(frame){cancelAnimationFrame(frame);frame=0;}},{rootMargin:'50px'}).observe(map);
reducedMotion.addEventListener('change',()=>setPlaying(!reducedMotion.matches));
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}else schedule();});
choose('sensing');resize();setPlaying(playing);
