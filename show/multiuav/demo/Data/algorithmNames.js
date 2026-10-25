/**
 * 前端/中间件使用公开算法名称；NS-3 继续使用现有内部标识。
 * 旧 IWOA 名称只作为输入兼容别名，任何新请求和界面输出都使用 publicName。
 */
export const CLUSTER_ALGORITHMS = Object.freeze([
  Object.freeze({ publicName: "WOA", ns3Name: "woa" }),
  Object.freeze({ publicName: "DFP-LR-WOCA", ns3Name: "iwoa" }),
  Object.freeze({ publicName: "DFP-LR-WOCA-no-RK", ns3Name: "iwoa-nork" }),
]);

const LOOKUP = new Map([
  ["woa", CLUSTER_ALGORITHMS[0]],
  ["dfp-lr-woca", CLUSTER_ALGORITHMS[1]],
  ["iwoa", CLUSTER_ALGORITHMS[1]],
  ["dfp-lr-woca-no-rk", CLUSTER_ALGORITHMS[2]],
  ["iwoa-nork", CLUSTER_ALGORITHMS[2]],
  ["iwoa_nork", CLUSTER_ALGORITHMS[2]],
]);

export function findClusterAlgorithm(value) {
  return LOOKUP.get(String(value ?? "").trim().toLowerCase()) ?? null;
}

export function normalizePublicAlgorithm(value) {
  return findClusterAlgorithm(value)?.publicName ?? null;
}

export function toNs3Algorithm(value) {
  return findClusterAlgorithm(value)?.ns3Name ?? null;
}

export function isSupportedClusterAlgorithm(value) {
  return normalizePublicAlgorithm(value) !== null;
}
