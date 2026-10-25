/***该文件对场景的基础设置，比如场景拖动等功能进行设置 */
import * as THREE from "three";

// 场景地面颜色。场景背景也使用同一颜色，避免极端缩放时出现背景穿透亮线。
export const GROUND_COLOR = 0x0d2a3d;

// 创建场景地面
export function createGround(size) {
  // 地面只是纯色平面，不需要 100 x 100 的细分。
  // 超大尺寸 + 大量细分在 WebGL 投影/裁剪时可能产生 1px 的网格缝隙。
  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({
    color: GROUND_COLOR,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "ground";
  mesh.userData.id = "ground";
  return mesh;
}

// 修复从 localStorage 加载出来的旧场景。
// 旧场景中可能仍保存着 100 x 100 分段的超大 PlaneGeometry。
export function normalizeSceneGround(scene, size = 1000000) {
  if (!scene) return;

  // 背景与地面保持一致。即使显卡在极端缩放下出现亚像素裁剪，也不会看到亮线。
  scene.background = new THREE.Color(GROUND_COLOR);

  const ground = scene.children.find(
    (obj) => obj?.userData?.id === "ground" || obj?.name === "ground"
  );

  if (!ground) return;

  // 用单个四边形替换旧的 100 x 100 分段地面。
  if (ground.geometry) {
    ground.geometry.dispose();
  }
  ground.geometry = new THREE.PlaneGeometry(size, size);
  ground.name = "ground";
  ground.userData.id = "ground";

  const materials = Array.isArray(ground.material)
    ? ground.material
    : [ground.material];

  materials.filter(Boolean).forEach((material) => {
    if (material.color) {
      material.color.setHex(GROUND_COLOR);
    }
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
  });
}
