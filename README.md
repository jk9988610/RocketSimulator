# RocketSimulator

2D 火箭模拟器 — 组装火箭、设计启动链、发射入轨。

## 平台

- **原型**：GitHub Pages（Web）
- **目标**：Android APK（平板横屏）
- **云端**：Supabase（存档与同步，后期）

## 核心玩法

1. **组装** — 在横屏组装区拖放部件（圆台、指令仓、燃料箱、引擎、连接器等），支持对称放置与网格吸附
2. **启动链** — 为引擎、连接器、降落伞配置分阶段启动顺序
3. **发射** — 发射台起飞，节流阀、引擎开关、左右倾控制
4. **轨道** — 地球/月球/太阳引力，大气与卡门线，地图模式显示轨道与近远点
5. **远期** — 自动驾驶

## 文档

- [项目大纲与任务计划](docs/OUTLINE.md)

## 开发环境

| 角色 | 工具 |
|------|------|
| 代码开发 | Cursor |
| APK 构建 | 安卓平板 + Termux |
| 云端 | Supabase |

## 仓库结构（规划）

```
RocketSimulator/
├── docs/          # 设计文档
├── web/           # Pages 原型（待建）
├── android/       # APK 壳（后期）
└── supabase/      # 数据库迁移（后期）
```

## 本地开发

```bash
cd web
npm install
npm run dev
```

浏览器访问 `http://localhost:5173/RocketSimulator/`（注意 base 路径）。

## 在线预览

GitHub Pages 部署后访问：`https://jk9988610.github.io/RocketSimulator/`

> 首次需在仓库 Settings → Pages 中选择 **GitHub Actions** 作为来源。

## 状态

- [x] M0：横屏布局骨架 + Pages CI
- [ ] M1：部件拖放与组装
