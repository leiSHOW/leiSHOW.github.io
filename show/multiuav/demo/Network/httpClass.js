export class HttpClass {
  constructor(baseURL = "") {
    this.baseURL = baseURL;
  }

  async request(url, method, data = null, headers = {}) {
    // 修复：此前完全忽略 baseURL，导致 Live Server 场景下请求打到页面自身源
    // （如 http://127.0.0.1:5500/data/...）而 404。这里统一拼接基地址；
    // 传入完整 http(s) 地址时保持原样，便于调试直连。
    const requestUrl = /^https?:\/\//i.test(url)
      ? url
      : `${this.baseURL}${url}`;
    const options = {
      method,
      headers: { ...headers },
    };

    if (data != null) {
      if (!hasHeader(options.headers, "Content-Type")) {
        options.headers["Content-Type"] = "application/json";
      }
      // 调用方已经传入 JSON 字符串时不再二次 stringify。
      options.body = typeof data === "string" ? data : JSON.stringify(data);
    }

    try {
      const response = await fetch(requestUrl, options);
      const responseData = await parseResponse(response);

      if (!response.ok) {
        const message = responseData?.message || `HTTP error! status: ${response.status}`;
        throw new Error(message);
      }

      return responseData;
    } catch (error) {
      console.error(`Error Response (${method} ${requestUrl}):`, error.message);
      return { error: error.message };
    }
  }

  get(url = "", headers = {}) {
    return this.request(url, "GET", null, headers);
  }

  post(data, url = "", headers = {}) {
    return this.request(url, "POST", data, headers);
  }
}

function hasHeader(headers, targetName) {
  return Object.keys(headers).some(
    (name) => name.toLowerCase() === targetName.toLowerCase()
  );
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
