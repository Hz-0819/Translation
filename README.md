# 纸上词间 · PaperLingo Demo

一个本地运行的英语试卷伴读 Demo，支持响应式平板布局、PDF/DOCX/图片上传、试卷手写层、完整离线英汉词典和划句翻译演示。

## 启动

```powershell
npm install
npm run dev
```

浏览器访问终端显示的本地地址。同一局域网中的平板也可以访问终端显示的 Network 地址；Windows 防火墙可能会询问是否允许 Node.js 使用专用网络。

## 当前支持

- 内置示例试卷，可体验手写、撤销、清空、点词和划句。
- PDF 使用兼容旧版 iPad Safari 的 PDF.js legacy 构建，在浏览器本地渲染并生成可选择的文字层。
- DOCX 在浏览器本地预览，不上传服务器。
- JPG/PNG 可作为试卷底图并手写。
- 笔迹使用归一化坐标保存，窗口缩放和横竖屏切换后仍保持对齐。
- 宽屏使用左侧工具栏和右侧查词卡；窄屏使用底部工具栏和底部释义抽屉。
- 完整 ECDICT 数据库包含 770,000 余行，提供中文释义、音标、英英释义、考试标签和词形变化。
- SQLite 词典留在运行网页的电脑上，平板每次只接收当前查询词条。

## 浏览器兼容范围

- 完整体验目标：近期版本的 Safari、Chrome、Edge、Firefox，以及 iOS/iPadOS 13+、Android 8+。
- PDF：使用官方 legacy 构建，并补充 Web Streams polyfill；文字层失败时保留页面和手写功能。
- 手写：优先使用 Pointer Events，并为旧 WebView/Safari 提供 Touch Events 和 Mouse Events 回退。
- 尺寸变化：优先使用 ResizeObserver，不支持时回退到 resize/orientationchange。
- 不支持 ES Modules 的古老浏览器会看到升级提示，不会出现空白页。

无法承诺所有历史设备上的全部功能完全一致。未来在线版本应增加服务端 PDF 转页图与 OCR，作为客户端 PDF 引擎完全不可用时的最终兜底。

## 词典数据

词典使用 [ECDICT](https://github.com/skywind3000/ECDICT)，数据库位于 `data/ecdict.sqlite`，上游 CSV 位于 `data/ecdict.csv`，许可证保存在 `data/ECDICT-LICENSE`。

重新生成数据库：

```powershell
npm run dict:build
```

当前 Demo 通过 Vite 本地中间件提供 `/api/dictionary`。未来部署为在线产品时，应把 `server/dictionary.js` 迁移到正式后端服务。

## Demo 限制

- 在线机器翻译、OCR、Word 服务端高保真转 PDF 尚未接入。
- 老式 `.doc` 需要先另存为 `.docx`；正式版本应在隔离的服务端转换。
- DOCX 浏览器预览适合交互验证，不代表最终高保真转换效果。
