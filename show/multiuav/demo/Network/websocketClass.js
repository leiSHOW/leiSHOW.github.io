import { wsHandleMessage } from "./sendMessage.js";
import {DialogLoadingOpen} from '../Move/Dialog.js'
export class WebSocketClass {
  /**
   * @param {string} basePath WebSocket 基础地址
   * @param {string|null} subscribeType 订阅类型：ws1=节点 / ws2=分簇指标 /
   *   ws3=路由指标 / ws4=MAC 指标；传 null 时不自动订阅。
   *   修复：native 中间件每条连接只支持一个订阅，必须一类一连接。
   */
  constructor(basePath, subscribeType = null) {
    this.basePath = basePath; // 基础链接
    this.subscribeType = subscribeType; // 本连接订阅的数据类型
    this.ws = null; // WebSocket 实例
    this.reconnectDelay = 3000; // 重连延迟，默认 3 秒
    this.isConnected = false; // 是否连接成功标志
    this.basicConnected = false; // 标志是否基础链接过
    this.isManualClose = false; // 是否主动断开ws连接
    this.reconnectTimer = null;
    this.connectionGeneration = 0;
    this.connect(this.basePath); // 初始化时使用基础链接尝试连接
  }

  // 建立 WebSocket 连接的方法
  connect(url) {
    const generation = ++this.connectionGeneration;
    window.dispatchEvent(new CustomEvent("middleware:ws-status", {
      detail: {
        state: "connecting",
        url,
        subscribeType: this.subscribeType,
        message: "正在建立 WebSocket 连接"
      }
    }));
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        if (generation !== this.connectionGeneration) return;
        console.log("WebSocket 已连接:", url);
        this.isConnected = true;
        console.log('readyState',this.ws.readyState)
        window.dispatchEvent(new CustomEvent("middleware:ws-status", {
          detail: {
            state: "connected",
            url,
            subscribeType: this.subscribeType
          }
        }));
        // 按本连接的类型订阅对应数据通道
        if (this.subscribeType) {
          this.sendMessage({ type: this.subscribeType });
        }

      };

      this.ws.onmessage = (event) => {
        if (generation !== this.connectionGeneration) return;
        // console.log('接收到消息:', event.data);
          this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        if (generation !== this.connectionGeneration) return;
        console.error("WebSocket 错误:", error);
        window.dispatchEvent(new CustomEvent("middleware:ws-status", {
          detail: {
            state: "error",
            url,
            subscribeType: this.subscribeType,
            message: `WebSocket 连接失败：${url}`
          }
        }));
      };

      this.ws.onclose = (event) => {
        if (generation !== this.connectionGeneration) return;
        console.log("WebSocket 已关闭", {
          url,
          code: event.code,
          reason: event.reason || ""
        });
        this.isConnected = false;
        window.dispatchEvent(new CustomEvent("middleware:ws-status", {
          detail: {
            state: this.isManualClose ? "disconnected" : "reconnecting",
            url,
            subscribeType: this.subscribeType,
            message: this.isManualClose
              ? "WebSocket 已断开"
              : `WebSocket 已关闭（${event.code}），正在重连`
          }
        }));
        console.log(this.isManualClose);
        if (!this.isManualClose) {
          this.reconnect(url);
        }
      };
    } catch (error) {
      console.error("连接 WebSocket 时出错:", error);
      window.dispatchEvent(new CustomEvent("middleware:ws-status", {
        detail: {
          state: "error",
          url,
          subscribeType: this.subscribeType,
          message: `WebSocket 创建失败：${error?.message || error}`
        }
      }));
      this.reconnect(url);
    }
  }

  // 重连方法
  reconnect(url) {
    if (this.isConnected || this.isManualClose || this.reconnectTimer) return;

    console.log(`正在尝试重新连接，等待 ${this.reconnectDelay / 1000} 秒...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isManualClose) this.connect(url);
    }, this.reconnectDelay);
  }

  // 判断是否为JSON
  isJSON(message) {
    try {
      JSON.parse(message);
      return true;
    } catch (error) {
      return false;
    }
  }

  // 发送消息的方法
  sendMessage(message) {
    try {
      if (this.isConnected) {
        const messageToSend = this.isJSON(message)
          ? message
          : JSON.stringify({ data: message });
        console.log("发送到:", this.basePath);
        this.ws.send(messageToSend);
        console.log("发送消息:", messageToSend);
      } else {
        console.warn("WebSocket 未连接，消息未发送");
      }
    } catch (error) {
      console.error("发送消息时出错:", error);
    }
  }

  // 处理接收到的消息，可根据需求自定义处理逻辑
  handleMessage(message) {
    try {
      // console.log('处理消息:', message);
      wsHandleMessage(message);
      return message;
    } catch (error) {
      console.error("处理消息时出错:", error);
    }
  }

  // 关闭 WebSocket 连接的方法
  close() {
    try {
      this.isManualClose = true;
      this.connectionGeneration += 1;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      if (this.ws) {
        this.ws.close();
        this.ws = null;
        console.log("WebSocket 手动关闭");
      }
    } catch (error) {
      console.error("关闭 WebSocket 时出错:", error);
    }
  }
}


