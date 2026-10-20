# 柠檬秀秀 🍋 NingXiu

对标美图秀秀的纯前端图片编辑器：**零依赖、零构建**，一个 HTML + 原生 JS/Canvas 搞定。
图片处理全部在本地完成；AI 功能走**用户自配置的 OpenAI 兼容接口**，没有 VIP 墙——你的 Key 你做主。

## 功能清单（对标美图秀秀，含其 VIP 功能）

| 分类 | 功能 |
| --- | --- |
| 相机 | **底部中央相机按钮（美图式）**：拍照直入编辑，6 款拍照风格（原生/苹果模式/柔肤/清新/胶片/黑白）、前置镜像校正、前后翻转 |
| 图片美化 | **24 款滤镜**（真图缩略图预览+强度滑杆）、全参数调节（亮度/对比度/饱和/色温/色调/高光/阴影/锐化/清晰度/颗粒/暗角/褪色/**去雾/光晕/HDR**）、HSL 分色、**曲线编辑器（明度/RGB 四通道，Catmull-Rom 平滑）**、**双重曝光**、**局部调整画笔**、裁剪（含证件比例）、旋转翻转、**校正（拉直/梯形透视/点选白平衡）**、尺寸调整、**画布缩放/平移（滚轮+双指捏合）** |
| 绘制装饰 | 涂鸦（自由笔+直线/箭头/矩形/圆形形状）、马赛克（方块/圆点）、文字（字体/描边/阴影/斜体/花字渐变/**竖排**）、emoji 贴纸 + 自定义图片贴纸（拖拽缩放）、边框（纯色/双层/胶片/拍立得）、水印（平铺/角落）、背景虚化（圆形/线性/涂抹保护） |
| 人像美容 | 一键美颜、磨皮、美白、亮眼、祛痘修复、白牙、祛黑眼圈、增高（腰线拉伸）、液化塑形（瘦脸/大眼/收缩）、美妆涂抹（口红/腮红/染发/眼影） |
| 证件照 | 裁剪比例、换底色（白/蓝/红）、**整版排版打印（一寸×6/×8、二寸×4）** |
| AI（需自配 API） | AI 消除、AI 抠图换背景、AI 扩图、AI 绘画（文生图/图生图）、AI 写真风格迁移、AI 画质修复 |
| 特色 | 证件照（换底色）、拼图（2-9 宫格/横竖长图）、海报模板一键套用、**批量处理**（多图统一滤镜/缩放/水印）、撤销/重做 25 步、导出 PNG |

未做：视频剪辑类（属剪映/Wink 品类）。

## 测试

```bash
./tests/run.sh    # headless Chrome 跑 37 项功能测试（tests/functional.html）
```

## macOS 本地运行

```bash
./scripts/start-mac.sh          # 默认端口 8964，自动打开浏览器
# 或指定端口
./scripts/start-mac.sh 8080
```

也可以直接双击 `index.html`（`file://` 协议下本地功能全部可用；个别 AI 接口对 `Origin: null` 有限制时改用本地服务即可）。

## 鸿蒙（HarmonyOS）打包

`harmony/` 是一个完整的 ArkWeb 壳工程（DevEco Studio 打开即用）：

```bash
# 1. 把最新 H5 同步进鸿蒙工程（改完网页代码都要跑一次）
./scripts/sync-web-to-harmony.sh

# 2. 用 DevEco Studio 打开 harmony/ 目录
# 3. File → Project Structure → Signing Configs 自动签名
# 4. Run → 选鸿蒙手机/模拟器，或 Build → Build Hap(s) 出包
```

壳工程要点：
- `entry/src/main/ets/pages/Index.ets` 用 `Web` 组件全屏加载 `rawfile/www/index.html`
- 已开启 `javaScriptEnabled` / `domStorageEnabled`（AI 配置持久化）/ `mixedMode`（H5 调 https AI 接口）
- `<input type="file">` 已桥接到系统文件选择器（`onShowFileSelector`）
- 已申请 `ohos.permission.INTERNET`（AI 功能需要）

## AI 配置

侧边栏「⚙️ AI设置」里填：

- **API 地址**：任何 OpenAI 兼容服务，如 `https://api.openai.com/v1`、SiliconFlow、自建中转
- **API Key**：只存本机 `localStorage`，不上传
- **模型**：图像编辑 / 文生图模型分开可配（默认 `gpt-image-1`）
- **自定义提示词**：消除/扩图/抠图/修复四个内置提示词可改

接口走标准的 `POST /images/edits` 与 `POST /images/generations`。

## 目录结构

```
NingXiu/
├── index.html          # 入口
├── style.css           # 柠檬主题（含移动端/鸿蒙竖屏适配）
├── js/
│   ├── util.js         # 工具函数
│   ├── pixels.js       # 像素算法（磨皮/液化/马赛克/HSL/抠图…）
│   ├── core.js         # 画布管线/渲染/撤销/滤镜库
│   ├── tools-basic.js  # 滤镜/调节/HSL/裁剪/旋转/尺寸/边框/证件照
│   ├── tools-draw.js   # 马赛克/涂鸦/文字/贴纸/虚化/美容/液化/美妆/消除
│   ├── tools-collage.js# 拼图/海报模板
│   ├── ai-config.js    # AI 配置中心 + API 调用层
│   ├── ai-features.js  # AI 消除/抠图/扩图/绘画/写真/修复
│   └── main.js         # 工具路由/快捷键
├── scripts/
│   ├── start-mac.sh            # macOS 本地运行
│   └── sync-web-to-harmony.sh  # H5 → 鸿蒙 rawfile 同步
└── harmony/            # HarmonyOS ArkWeb 壳工程（DevEco Studio）
```

## License

MIT
