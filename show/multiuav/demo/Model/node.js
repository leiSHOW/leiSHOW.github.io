import { ClusterNode } from "../Data/ShowInfo.js";
import { nodeDics, flag } from "../Move/viewControl.js";

function addNode(data, nodeID) {
  nodeDics[flag.activeSceneIndex].nodes[nodeID] = new ClusterNode(data);
}

// 物体信息初始化：字段名与 ClusterNode / 后端数据保持一致。
export function objectInit(nodeID, position) {
  const data = {
    nodeID,
    nodeStatus: 0,
    energy: 0,
    realPosition: {
      p_x: position.x,
      p_y: position.y,
      p_z: position.z,
    },
    velocity: { v_x: 0, v_y: 0, v_z: 0 },
    clusterHeadID: 0,
    weight: 0,
    entryTime: 0,
    nodeState: 0,
    nodeIP: 0,
  };
  addNode(data, nodeID);
}
