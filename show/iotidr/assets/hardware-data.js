export const devices = [
  {
    "id": "controller",
    "name": "STM32F103ZE 主控",
    "label": "STM32 主控",
    "kind": "主控",
    "color": "#4264d4",
    "description": "汇集传感器数据，管理机械参考与运动状态，协调本地操作和物联网指令。",
    "specs": [
      [
        "内核",
        "Cortex-M3"
      ],
      [
        "系统时钟",
        "72 MHz"
      ],
      [
        "存储资源",
        "512 KB Flash / 64 KB SRAM"
      ],
      [
        "固件",
        "C / STM32 HAL"
      ]
    ],
    "ports": [
      {
        "mcu": "TIM2 / EXTI11",
        "target": "DHT11",
        "use": "微秒计时与边沿采集",
        "group": "信号接口"
      },
      {
        "mcu": "ADC3_CH6",
        "target": "光敏传感器",
        "use": "模拟采样",
        "group": "信号接口"
      },
      {
        "mcu": "TIM3",
        "target": "步进驱动",
        "use": "1 ms 节拍",
        "group": "信号接口"
      },
      {
        "mcu": "TIM4_CH4",
        "target": "红外接收",
        "use": "输入捕获",
        "group": "信号接口"
      },
      {
        "mcu": "USART3",
        "target": "WiFi 模块",
        "use": "9600 8N1",
        "group": "信号接口"
      },
      {
        "mcu": "FSMC",
        "target": "TFTLCD",
        "use": "16 位显示总线",
        "group": "信号接口"
      }
    ],
    "note": "选择外设，查看主控引脚与设备信号的逐项对应。",
    "position": [
      0,
      0
    ],
    "anchor": [
      0,
      0
    ]
  },
  {
    "id": "dht",
    "name": "DHT11 温湿度传感器",
    "label": "DHT11",
    "kind": "感知",
    "color": "#087f96",
    "description": "采集环境温度与相对湿度，为屏幕、Android 应用和环境保护策略提供数据。",
    "specs": [
      [
        "数据",
        "温度 °C / 湿度 %RH"
      ],
      [
        "采集间隔",
        "至少约 2 s"
      ],
      [
        "通信",
        "单总线时序"
      ],
      [
        "采样处理",
        "边沿采集、解码与校验"
      ],
      [
        "时序资源",
        "TIM2 / EXTI11"
      ]
    ],
    "ports": [
      {
        "mcu": "PG11",
        "target": "DATA",
        "use": "双向数据；开漏输出",
        "group": "信号接口"
      }
    ],
    "note": "数据线使用项目板卡上的外部上拉；有效数据更新后再参与状态上报与保护判断。",
    "position": [
      -3.5,
      -2.2
    ],
    "anchor": [
      -1.55,
      -0.75
    ]
  },
  {
    "id": "light",
    "name": "光敏传感器",
    "label": "相对光照",
    "kind": "感知",
    "color": "#087f96",
    "description": "将光敏电路的模拟输出转换为相对光照值。多次采样平均后用于环境展示与白天保护条件。",
    "specs": [
      [
        "采样外设",
        "ADC3"
      ],
      [
        "输入通道",
        "通道 6"
      ],
      [
        "处理",
        "10 次采样平均"
      ],
      [
        "展示范围",
        "0–100 相对刻度"
      ]
    ],
    "ports": [
      {
        "mcu": "PF8",
        "target": "光敏模拟输出",
        "use": "ADC3_CH6 模拟输入",
        "group": "信号接口"
      }
    ],
    "note": "相对刻度随亮度增加而升高，不能作为 lux 照度测量。",
    "position": [
      -4.15,
      0.25
    ],
    "anchor": [
      -1.55,
      0
    ]
  },
  {
    "id": "lcd",
    "name": "TFTLCD 与电阻触摸",
    "label": "LCD / 触摸",
    "kind": "交互",
    "color": "#6452b9",
    "description": "显示环境、网络和电机状态，触摸界面提供档位、灯光及配网入口。显示与触摸使用各自独立的信号接口。",
    "specs": [
      [
        "屏幕",
        "2.8 寸 / 240 × 320"
      ],
      [
        "显示接口",
        "FSMC / 16 位 8080"
      ],
      [
        "触摸接口",
        "GPIO 模拟 SPI"
      ],
      [
        "触摸处理",
        "五点校准、按下与松开事件"
      ]
    ],
    "ports": [
      {
        "mcu": "PG12",
        "target": "CS / NE4",
        "use": "LCD 片选",
        "group": "显示控制"
      },
      {
        "mcu": "PG0",
        "target": "RS / A10",
        "use": "区分命令与数据",
        "group": "显示控制"
      },
      {
        "mcu": "PD5",
        "target": "WR / NWE",
        "use": "写使能",
        "group": "显示控制"
      },
      {
        "mcu": "PD4",
        "target": "RD / NOE",
        "use": "读使能",
        "group": "显示控制"
      },
      {
        "mcu": "PB0",
        "target": "BL",
        "use": "背光控制",
        "group": "显示控制"
      },
      {
        "mcu": "RESET 网络",
        "target": "RST",
        "use": "与主控共用复位",
        "group": "显示控制"
      },
      {
        "mcu": "PD14",
        "target": "D0",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PD15",
        "target": "D1",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PD0",
        "target": "D2",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PD1",
        "target": "D3",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PE7",
        "target": "D4",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PE8",
        "target": "D5",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PE9",
        "target": "D6",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PE10",
        "target": "D7",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PE11",
        "target": "D8",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PE12",
        "target": "D9",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PE13",
        "target": "D10",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PE14",
        "target": "D11",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PE15",
        "target": "D12",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PD8",
        "target": "D13",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PD9",
        "target": "D14",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PD10",
        "target": "D15",
        "use": "FSMC 16 位数据总线",
        "group": "显示数据"
      },
      {
        "mcu": "PB1",
        "target": "T_SCK",
        "use": "模拟 SPI 时钟",
        "group": "电阻触摸"
      },
      {
        "mcu": "PB2",
        "target": "T_MISO",
        "use": "触摸数据输入",
        "group": "电阻触摸"
      },
      {
        "mcu": "PF9",
        "target": "T_MOSI",
        "use": "采样命令输出",
        "group": "电阻触摸"
      },
      {
        "mcu": "PF10",
        "target": "T_PEN",
        "use": "按压检测，低有效",
        "group": "电阻触摸"
      },
      {
        "mcu": "PF11",
        "target": "T_CS",
        "use": "触摸片选，低有效",
        "group": "电阻触摸"
      }
    ],
    "note": "显示器支持 ILI9341 / ST7789 的识别分支，实际控制器以读取的 ID 为准。触摸校准参数保存在 RAM。",
    "position": [
      0,
      -3.35
    ],
    "anchor": [
      0,
      -1.25
    ]
  },
  {
    "id": "motor",
    "name": "28BYJ48 与 ULN2003",
    "label": "步进电机",
    "kind": "执行",
    "color": "#b66313",
    "description": "主控通过 ULN2003 控制四相线圈，按目标档位与软件位置差执行晾衣架运动。",
    "specs": [
      [
        "驱动器",
        "ULN2003"
      ],
      [
        "电机",
        "28BYJ48"
      ],
      [
        "相序",
        "单相四拍"
      ],
      [
        "节拍",
        "TIM3 / 每步 3 ms"
      ]
    ],
    "ports": [
      {
        "mcu": "PF0",
        "target": "ULN2003 IN1",
        "use": "第一相控制",
        "group": "信号接口"
      },
      {
        "mcu": "PF1",
        "target": "ULN2003 IN2",
        "use": "第二相控制",
        "group": "信号接口"
      },
      {
        "mcu": "PF2",
        "target": "ULN2003 IN3",
        "use": "第三相控制",
        "group": "信号接口"
      },
      {
        "mcu": "PF3",
        "target": "ULN2003 IN4",
        "use": "第四相控制",
        "group": "信号接口"
      }
    ],
    "note": "GPIO 连接驱动器输入，驱动器再连接电机线圈；运动前需确认机械参考，位置按软件步数估计。",
    "position": [
      3.45,
      -2.5
    ],
    "anchor": [
      1.55,
      -0.75
    ]
  },
  {
    "id": "wifi",
    "name": "ATK-MW8266D WiFi 模块",
    "label": "WiFi 模块",
    "kind": "联网",
    "color": "#4264d4",
    "description": "运行 GAgent 固件，通过串口与主控交换机智云协议数据，连接 Android 控制端与云平台。",
    "specs": [
      [
        "串口",
        "USART3"
      ],
      [
        "格式",
        "9600 / 8N1"
      ],
      [
        "模块固件",
        "GAgent"
      ],
      [
        "配网",
        "AirLink / SoftAP"
      ]
    ],
    "ports": [
      {
        "mcu": "PB10 / TX",
        "target": "模块 RX",
        "use": "STM32 发送至模块",
        "group": "信号接口"
      },
      {
        "mcu": "PB11 / RX",
        "target": "模块 TX",
        "use": "STM32 接收模块数据",
        "group": "信号接口"
      }
    ],
    "note": "TX 与 RX 交叉连接。图中显示串口信号关系，模块电源与复位以对应硬件规格为准。",
    "position": [
      4.05,
      0.15
    ],
    "anchor": [
      1.55,
      0
    ]
  },
  {
    "id": "ir",
    "name": "红外接收器",
    "label": "红外接收",
    "kind": "交互",
    "color": "#6452b9",
    "description": "接收红外遥控器的脉宽信号，解码为档位、配网与复位等操作请求。",
    "specs": [
      [
        "接收接口",
        "PB9"
      ],
      [
        "计时通道",
        "TIM4_CH4"
      ],
      [
        "计时分辨率",
        "1 μs"
      ],
      [
        "档位控制",
        "数字 1–4"
      ]
    ],
    "ports": [
      {
        "mcu": "PB9",
        "target": "接收器 OUT",
        "use": "TIM4_CH4 输入捕获",
        "group": "信号接口"
      }
    ],
    "note": "数字键对应 1/4、1/2、3/4 与全开。控制请求进入统一的设备状态检查。",
    "position": [
      -3.15,
      2.8
    ],
    "anchor": [
      -1.55,
      0.75
    ]
  },
  {
    "id": "keys",
    "name": "三路实体按键",
    "label": "实体按键",
    "kind": "交互",
    "color": "#6452b9",
    "description": "为本地页面操作提供单次按键事件。三路按键分别去抖，便于导航和操作反馈。",
    "specs": [
      [
        "按键",
        "KEY0 / KEY1 / WK_UP"
      ],
      [
        "去抖",
        "各路独立 30 ms"
      ],
      [
        "事件",
        "按下一次产生一次事件"
      ],
      [
        "接口",
        "GPIO 输入"
      ]
    ],
    "ports": [
      {
        "mcu": "PE4",
        "target": "KEY0",
        "use": "上拉输入，低有效",
        "group": "信号接口"
      },
      {
        "mcu": "PE3",
        "target": "KEY1",
        "use": "上拉输入，低有效",
        "group": "信号接口"
      },
      {
        "mcu": "PA0",
        "target": "WK_UP",
        "use": "下拉输入，高有效",
        "group": "信号接口"
      }
    ],
    "note": "按键触发后的业务行为由应用层处理，蜂鸣器可提供短提示。",
    "position": [
      -0.8,
      3.35
    ],
    "anchor": [
      -0.65,
      1.25
    ]
  },
  {
    "id": "led",
    "name": "两路 LED 灯光",
    "label": "LED 灯光",
    "kind": "执行",
    "color": "#b66313",
    "description": "两路独立灯光输出，通过 LCD 和 Android 应用控制，并回显实际 GPIO 状态。",
    "specs": [
      [
        "通道",
        "LED0 / LED1"
      ],
      [
        "有效电平",
        "低电平点亮"
      ],
      [
        "初始状态",
        "默认全灭"
      ],
      [
        "控制方式",
        "LCD / Android"
      ]
    ],
    "ports": [
      {
        "mcu": "PB5",
        "target": "LED0",
        "use": "低有效输出",
        "group": "信号接口"
      },
      {
        "mcu": "PE5",
        "target": "LED1",
        "use": "低有效输出",
        "group": "信号接口"
      }
    ],
    "note": "三维模型中的颜色用于区分器件，页面不表示设备的实时灯光状态。",
    "position": [
      1.75,
      3.05
    ],
    "anchor": [
      0.65,
      1.25
    ]
  },
  {
    "id": "buzzer",
    "name": "蜂鸣器",
    "label": "蜂鸣器",
    "kind": "执行",
    "color": "#b66313",
    "description": "在本地操作时提供短音提示。定时结束后关闭输出，让主循环继续服务采集和通信。",
    "specs": [
      [
        "信号",
        "PB8"
      ],
      [
        "有效电平",
        "高有效"
      ],
      [
        "控制",
        "开 / 关 / 定时短音"
      ],
      [
        "调度",
        "主循环 Process"
      ]
    ],
    "ports": [
      {
        "mcu": "PB8",
        "target": "蜂鸣器控制",
        "use": "GPIO 推挽输出，高有效",
        "group": "信号接口"
      }
    ],
    "note": "蜂鸣器在网页中仅作结构展示，不播放提示音。",
    "position": [
      4.1,
      2.85
    ],
    "anchor": [
      1.55,
      0.75
    ]
  }
];
