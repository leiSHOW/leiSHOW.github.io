import { normalizePublicAlgorithm } from "./algorithmNames.js";

// 分簇节点
export class ClusterNode {
  constructor(node = {}) {
    this.nodeID = node.nodeID ?? "";
    this.nodeStatus = node.nodeStatus ?? node.Node_status ?? 0;
    this.energy = node.energy ?? node.Energy ?? 0;
    this.realPosition = toVector(node.realPosition, "p");
    this.velocity = toVector(node.velocity, "v");
    this.clusterHeadID = normalizeClusterHeadIds(node.clusterHeadID);
    this.weight = node.weight ?? 0;
    this.entryTime = node.entryTime ?? 0;
    this.nodeState = node.nodeState ?? node.Node_state ?? 0;
    this.nodeIP = node.nodeIP ?? node.Node_ip ?? node.ip ?? 0;
  }

  fromJson(json) {
    Object.assign(this, new ClusterNode(JSON.parse(json)));
    return this;
  }

  printNodeInfo() {
    console.log(`Node ID: ${this.nodeID}`);
    console.log(`Node Status: ${this.nodeStatus}`);
    console.log(`Energy: ${this.energy}`);
    console.log(`Position: ${JSON.stringify(this.realPosition)}`);
    console.log(`Velocity: ${JSON.stringify(this.velocity)}`);
    console.log(`Cluster Head ID: ${this.clusterHeadID}`);
    console.log(`Weight: ${this.weight}`);
    console.log(`Entry Time: ${this.entryTime}`);
    console.log(`Node State: ${this.nodeState}`);
    console.log(`Node IP: ${this.nodeIP}`);
  }
}

// 分簇指标
export class ClusterMetrics {
  constructor(metric = {}) {
    const rawAlgorithm = metric.algorithm ?? metric.route ?? "";
    this.sceneId = String(metric.sceneId ?? metric.sceneIndex ?? "0");
    this.algorithm = normalizePublicAlgorithm(rawAlgorithm) ?? String(rawAlgorithm);
    this.snapshotId = finiteNumber(metric.snapshotId, 0);
    this.sampleTime = finiteNumber(metric.sampleTime ?? metric.time, 0);
    this.avgCHLifetime = finiteNumber(metric.avgCHLifetime, 0);
    this.avgMemberLifetime = finiteNumber(metric.avgMemberLifetime, 0);
    this.clusterMaintenanceMessages = finiteNumber(
      metric.clusterMaintenanceMessages ?? metric.numClusterChangeMessages,
      0
    );
    this.clusterHeadClaimMessages = finiteNumber(
      metric.clusterHeadClaimMessages ?? metric.claims,
      0
    );
    this.guestMaintenanceMessages = finiteNumber(
      metric.guestMaintenanceMessages ?? metric.numGuestsMessages,
      0
    );
  }

  fromJson(json) {
    Object.assign(this, new ClusterMetrics(JSON.parse(json)));
    return this;
  }

  printMetrics() {
    console.log("Average Cluster Head Lifetime:", this.avgCHLifetime);
    console.log("Average Member Lifetime:", this.avgMemberLifetime);
    console.log("Cluster Maintenance Messages:", this.clusterMaintenanceMessages);
    console.log("Cluster Head Claim Messages:", this.clusterHeadClaimMessages);
    console.log("Guest Maintenance Messages:", this.guestMaintenanceMessages);
  }
}

// 路由指标
export class RoutingMetrics {
  constructor(AverageDelay, lossPacketRatio, convergenceTime, avgThroughput) {
    this.AverageDelay = AverageDelay;
    this.lossPacketRatio = lossPacketRatio;
    this.convergenceTime = convergenceTime;
    this.AvgThroughput = avgThroughput;
  }

  fromJson(json) {
    const data = JSON.parse(json);
    this.AverageDelay = data.AverageDelay;
    this.lossPacketRatio = data.lossPacketRatio;
    this.convergenceTime = data.convergenceTime;
    this.AvgThroughput = data.AvgThroughput ?? data.avgThroughput;
    return this;
  }

  printMetrics() {
    console.log(`Average Delay: ${this.AverageDelay} ms`);
    console.log(`Loss Packet Ratio: ${this.lossPacketRatio} %`);
    console.log(`Convergence Time: ${this.convergenceTime} s`);
    console.log(`Average Throughput: ${this.AvgThroughput} Mbps`);
  }
}

export class vector {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

function finiteNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeClusterHeadIds(value) {
  if (value == null || value === 0 || value === "0" || value === "") return 0;
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.includes(",")) {
    return value.split(",").map((item) => {
      const text = item.trim();
      const numberValue = Number(text);
      return Number.isFinite(numberValue) ? numberValue : text;
    });
  }
  return [value];
}

function toVector(value = {}, prefix) {
  return new vector(
    value.x ?? value[`${prefix}_x`] ?? 0,
    value.y ?? value[`${prefix}_y`] ?? 0,
    value.z ?? value[`${prefix}_z`] ?? 0
  );
}
