# 技术方案与模块边界

## 推荐技术栈
- Electron
- Vue 3
- Element Plus
- ExcelJS
- JSON 本地配置
- 自定义日志模块
- electron-builder

## 目录建议
```text
excel-tools/
├── package.json
├── electron-builder.json
├── main/
│   ├── main.js
│   ├── ipc.js
│   └── window.js
├── renderer/
│   ├── index.html
│   ├── main.js
│   ├── views/
│   ├── components/
│   └── stores/
├── services/
│   ├── split/
│   ├── merge/
│   └── common/
├── config/
│   └── defaultRules.json
├── logs/
└── output/
```

## 核心模块
- `splitService`：拆分业务入口
- `splitEngine`：拆分核心算法
- `excelReader`：读取层
- `excelWriter`：写入层
- `styleCopier`：格式复制层
- `logger`：日志层
- `ruleManager`：配置管理层

## AI/Agent 协作要求
- 必须模块化
- 禁止 UI/业务/Excel 引擎混写
- 先确定配置结构与模块边界
- 代码为后续功能预留扩展点
