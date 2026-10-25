import { scenes, flag, nodeDics, flags, idDics } from "../Move/viewControl.js";
import { objectInit } from "./node.js";
import * as THREE from "three";

const UAVSize = document.getElementById("uavSize");
if (UAVSize) {
  UAVSize.addEventListener("change", (event) => {
    const value = Number.parseFloat(event.target.value);
    if (!Number.isFinite(value) || value <= 0 || flag.activeSceneIndex == null) return;

    scenes[flag.activeSceneIndex]?.scene?.children.forEach((obj) => {
      if (obj.geometry instanceof THREE.PlaneGeometry && obj.userData.id !== "ground") {
        obj.scale.set(value, value, value);
      }
    });
  });
}

const modelsPath = {
  uavBlue: "./image/uavBlue.png",
  uavGray: "./image/uavGray.png",
  uavWhite: "./image/uavWhite.png",
  fourUAVGray: "./image/fourUAVGray.png",
  fourUAVBlue: "./image/fourUAVBlue.png",
  fourUAVWhite: "./image/fourUAVWhite.png",
};

export const models = Object.fromEntries(
  Object.keys(modelsPath).map((key) => [key, null])
);

let dragEventsInitialized = false;

export function createModel(objInfo, isHead = false) {
  const modelId = isHead ? "fourUAVBlue" : "fourUAVWhite";
  const template = models[modelId];
  if (!template || flag.activeSceneIndex == null) {
    console.warn(`模型 ${modelId} 尚未加载完成，暂时无法创建节点`);
    return null;
  }

  const plane = template.clone();
  plane.geometry = template.geometry.clone();
  plane.material = template.material.clone();
  plane.position.set(objInfo.realPosition.x, objInfo.realPosition.y, 15);
  plane.userData.id = objInfo.nodeID;
  scenes[flag.activeSceneIndex].scene.add(plane);
  return plane;
}

function loadTextureAsync(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

export async function loadModels() {
  const geometry = new THREE.PlaneGeometry(30, 30);
  try {
    await Promise.all(
      Object.entries(modelsPath).map(async ([key, url]) => {
        const texture = await loadTextureAsync(url);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
        });
        models[key] = new THREE.Mesh(geometry.clone(), material);
      })
    );
  } catch (error) {
    console.error("纹理加载失败:", error);
    throw error;
  } finally {
    geometry.dispose();
  }
}

export function loadObjByData(node) {
  if (flag.activeSceneIndex == null) return;
  if (nodeDics[flag.activeSceneIndex]?.nodes?.[node.nodeID] === undefined) {
    createModel(node, false);
  }
}

export function drageObject(raycaster, renderer, camera) {
  if (dragEventsInitialized) return;
  dragEventsInitialized = true;

  const mouse = new THREE.Vector2();
  let selectedModel = null;

  document.querySelectorAll("#addModel img").forEach((img) => {
    img.addEventListener("dragstart", function (event) {
      if (flag.activeSceneIndex == null) return;
      const template = models[this.id];
      if (!template) {
        console.warn(`模型 ${this.id} 尚未加载完成`);
        event.preventDefault();
        return;
      }
      selectedModel = template.clone();
      selectedModel.geometry = template.geometry.clone();
      selectedModel.material = template.material.clone();
      event.dataTransfer.setData("text", this.id);
    });
  });

  const container = document.getElementById("three-container");
  if (!container) return;

  container.addEventListener("dragover", (event) => event.preventDefault());
  container.addEventListener("drop", (event) => {
    event.preventDefault();
    if (flag.activeSceneIndex == null || !selectedModel) return;

    mouse.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const ground = scenes[flag.activeSceneIndex].scene.children.find(
      (child) => child.userData?.id === "ground"
    );
    if (!ground) return;

    const intersects = raycaster.intersectObject(ground);
    if (!intersects.length) return;

    selectedModel.position.copy(intersects[0].point);
    selectedModel.position.z = 15;
    scenes[flag.activeSceneIndex].scene.add(selectedModel);

    const sceneFlags = flags[flag.activeSceneIndex];
    sceneFlags.nullNumber += 1;
    sceneFlags.newObjectName = sceneFlags.nullNumber === 1 ? 1 : sceneFlags.newObjectName + 1;
    selectedModel.userData.id = `未知${sceneFlags.newObjectName}`;
    idDics[flag.activeSceneIndex].ids[selectedModel.userData.id] = true;
    objectInit(selectedModel.userData.id, selectedModel.position);
    selectedModel = null;
  });
}
