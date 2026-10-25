// Illustrative field values; transformations follow the current source contracts.
const node = { nodeID: 7, nodeStatus: 'CLUSTER_HEAD', energy: 68.4, realPosition: { p_x: 120, p_y: 80, p_z: 15 }, velocity: { v_x: 2, v_y: 1, v_z: 0 }, clusterHeadID: [7] };
const snapshot = { type: 'http', sceneId: '0', algorithm: 'DFP-LR-WOCA', route: 'DFP-LR-WOCA', snapshot: true, snapshotId: '42', sampleTime: 12.5, data: [node] };
const response = { ...snapshot, code: 200, type: 'clusternode' };
const config = { sceneId: '0', algorithm: 'DFP-LR-WOCA', size: 24, mac: 'qosmac', simTime: 100 };
const request = { revision: 101, data: config };
const accepted = { code: 200, status: 'accepted', sceneId: '0', revision: 101, data: { ...config, ns3Algorithm: 'iwoa' } };
const storedDevice = { sceneName: 'Scenes0', data: { id: '7', name: 'UAV-7', position: { x: 120, y: 80, z: 15 } } };
const step = (id, lane, row, title, format, description, payload, transform) => ({ id, lane, row, title, format, description, payload, transform });

export const flows = {
  telemetry: {
    title: '状态上报', color: '#4bc2df', direction: 'ns-3 → HTTP → 中间件 → RabbitMQ → WebSocket → 前端',
    summary: '以一个节点快照为例：结构化状态转成 JSON，经过消息队列缓冲，再按场景还原为节点与图表数据。',
    note: 'Protobuf 在这里定义数据字段；接口实际传输的是 JSON 文本。节点、路由、MAC、分簇指标使用各自的接口与队列，具体上报类别随仿真模块启用。',
    steps: [
      step('sim', 1, 1, '仿真产生状态', 'C++ 状态对象', 'ns-3 运行移动与协议模型，接口模块采集节点状态和指标。', { nodeID: 7, position: [120, 80, 15], clusterHead: 7 }, '仿真对象 → 节点／指标结构'),
      step('pack', 1, 2, '封装快照', 'Protobuf → JSON', 'Connector 按消息定义填充 data，并附加场景、算法、快照编号和采样时间。', snapshot, 'MessageToJsonString：字段结构 → JSON 文本'),
      step('upload', 1, 3, '异步 HTTP 上报', 'HTTP POST', '仿真线程将发送任务交给后台 worker，经 /data/SendClusternode 提交 JSON。', { method: 'POST', path: '/data/SendClusternode', contentType: 'application/json', body: snapshot }, '后台 worker 发送，不让网络请求阻塞仿真线程'),
      step('ingress', 2, 3, '接入与分类', 'JSON 对象', '中间件解析请求，依据接口选择队列，并保留 sceneId、algorithm 与 data 的外层关系。', { endpoint: 'SendClusternode', queue: 'Clusternode', preserved: ['sceneId', 'algorithm', 'snapshotId', 'data'] }, 'HTTP 请求体 → JSON 解析与算法名称归一化'),
      step('queue', 2, 2, '消息队列缓冲', 'AMQP / JSON', '中间件将完整 JSON 消息发布到 RabbitMQ，生产与消费通过队列衔接。', { routingKey: 'Clusternode', contentType: 'application/json', body: snapshot }, '同一业务消息保留元数据后入队'),
      step('publish', 2, 1, '取消息并重封装', 'WebSocket JSON', '订阅线程消费队列。节点按场景和算法整理快照，添加 code 与消息 type，发送给浏览器。', response, '队列 JSON → 快照整理 → WebSocket 响应'),
      step('decode', 3, 1, '解封与分发', 'JavaScript 对象', '前端解析 JSON，依据 type 识别数据、sceneId 确定场景，用 snapshotId 排除过期节点快照。', { type: 'clusternode', targetScene: 0, snapshotId: 42, node: { nodeID: 7, realPosition: { x: 120, y: 80, z: 15 } } }, 'JSON.parse → 字段归一化（p_x → x）→ 场景字典'),
      step('render', 3, 2, '更新场景与指标', '节点／指标视图', '节点位置插值到新坐标，详情面板同步状态；指标消息进入对应场景的历史数组并更新曲线。', { scene: 0, nodeDictionary: 'nodeDics[0]', nodeID: 7, position: { x: 120, y: 80, z: 15 }, metricViews: ['路由', 'MAC', '分簇'] }, '业务状态 → Three.js / Chart.js 展示'),
    ],
  },
  control: {
    title: '仿真配置', color: '#d9ae69', direction: '前端 → HTTP → 中间件暂存 → ns-3 HTTP 领取 → 启动仿真',
    summary: '配置与状态上报分开：用户提交参数，中间件保存待领取配置，ns-3 再主动取走并应用。',
    note: '这条配置链路使用 HTTP 与中间件进程内的场景配置表，不经过 RabbitMQ，也不自动写入数据库。命令行模式仍可独立启动仿真。',
    steps: [
      step('form', 3, 1, '选择仿真参数', '表单参数', '用户选择目标场景、算法、节点规模、MAC 和仿真参数，提交时才触发请求。', config, '界面输入 → 参数检查'),
      step('config-json', 3, 2, '封装配置请求', 'HTTP POST / JSON', '前端用 revision 标识这次提交，将参数放入 data，发送到配置接口。', { method: 'POST', path: '/control/simulation-config', body: request }, '表单对象 → { revision, data }'),
      step('validate', 2, 2, '校验并映射', '规范化配置', '中间件检查场景和参数，把公开算法名映射到 ns-3 内部标识，并返回 accepted。', accepted, 'DFP-LR-WOCA → ns3Algorithm: iwoa'),
      step('cache', 2, 1, '按场景等待领取', '进程内配置表', '以 sceneId 暂存配置和 revision，记录 consumed 状态，供等待中的 ns-3 进程领取。', { sceneId: '0', revision: 101, consumed: false, config: accepted.data }, '配置对象 → 场景索引与领取状态'),
      step('claim', 1, 1, '轮询并领取配置', 'HTTP GET / JSON', 'ns-3 请求 consume=1，可指定场景；领取成功后，中间件将配置标记为已消费。', { request: 'GET /control/simulation-config?consume=1&sceneId=0', response: { ...accepted, status: 'claimed' } }, 'JSON 响应 → ns-3 参数读取'),
      step('run', 1, 2, '应用参数并运行', 'C++ 仿真参数', '主程序读取配置，设置节点规模、算法、业务和能量等参数，带着同一 sceneId 开始仿真。', { sceneId: '0', algorithm: 'iwoa', nodes: 24, mac: 'qosmac', simTime: 100 }, '配置字段 → 仿真实例 → 后续状态上报'),
    ],
  },
  storage: {
    title: '设备存取', color: '#9e9af3', direction: '调用端 → HTTP → 中间件数据库接口 → MariaDB → HTTP 回包',
    summary: '数据库提供独立的设备信息存取接口。用一条设备记录展示 JSON、SQL 行与 JSON 响应之间的转换。',
    note: '本图展示已实现的设备存取接口，不表示每条 WebSocket 消息都会自动入库。现有演示中的“保存”使用浏览器 localStorage，JSON／CSV 导出也在浏览器完成。',
    steps: [
      step('db-request', 3, 1, '调用存储接口', 'HTTP POST / JSON', '调用端明确提交 sceneName 和设备 data，通过独立数据库接口发起存储。', { method: 'POST', path: '/database/device-info', body: storedDevice }, '设备对象 → JSON 请求体'),
      step('db-route', 2, 1, '解析场景与字段', 'JSON 对象', '中间件校验场景，把 Scenes0 映射到 DeviceInfo0，并提取设备属性。', { sceneName: 'Scenes0', table: 'DeviceInfo0', fields: ['id', 'name', 'position'] }, 'sceneName → 表名；data → 设备字段'),
      step('db-sql', 2, 2, '转换并写入', 'SQL / MariaDB', '结构化 position 等字段转为 JSON 文本，字符串转义后通过 MySQL/MariaDB C API 写入。', { table: 'DeviceInfo0', id: '7', name: 'UAV-7', position: '{"x":120,"y":80,"z":15}' }, 'JSON 属性 → SQL 行'),
      step('db-read', 2, 3, '按场景查询', 'SQL 行 → JSON', '调用端以 GET 查询设备信息，中间件读取记录，并将结构化字段的 JSON 文本还原为对象。', { request: 'GET /database/device-info?sceneName=Scenes0', row: storedDevice.data }, '数据库列 → 设备对象数组'),
      step('db-response', 3, 3, '接收查询结果', 'HTTP JSON', '返回 code、sceneName 和 data；调用端据此继续处理设备信息。', { code: 200, message: 'success', sceneName: 'Scenes0', data: [storedDevice.data] }, '设备对象数组 → 标准 HTTP 回包'),
      step('db-use', 3, 2, '按需使用记录', '调用端对象', '数据可用于设备信息查看或进一步处理；这一路径与实时节点订阅、浏览器本地保存分开。', { sceneName: 'Scenes0', device: storedDevice.data, usage: '设备信息查询' }, 'JSON.parse → 调用端业务数据'),
    ],
  },
};
