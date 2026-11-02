# AI 作图素材库 · 中文版（脸 / 姿势 / 服装）

<img width="2404" height="1728" alt="Image" src="https://github.com/user-attachments/assets/6a53ac45-4c89-48fd-a7b4-2e6788a5294a" />

基于 **あぎ / ギア（[@giaaibusi](https://x.com/giaaibusi)）** 公开的三套 AI 作图参考素材的中文版网站。

* 分类与标签全部译成中文
* 中英双语搜索
* 一键复制作图指令
* 三库统一入口，姿势库已支持 depth
* **随机组合生成提示词**。

**在线访问**：<https://sleepyzone.online/ai-ref-library-cn/>

## 目录

- [随机组合](#随机组合)：一次抽齐脸 / 服装 / 姿势，并生成提示词
  - [两种参考图形式](#两种参考图形式)：链接版 vs 单张三联图
- [本地开发](#本地开发)
- [原图下载](#原图下载)
- [埋点](#埋点)
- [授权](#授权)
- [免责](#免责)

## 随机组合

点顶部 **🎲 随机组合**：从脸库、服装库、姿势库各随机抽一条，三张参考图并排，并自动生成现成的提示词。

- **单独「换一个」**：只换某一张，另外两张不动，方便先定脸再挑衣服
- **限定范围**：姿势可只取标准系 / 上半身 / 双人互动，服装可只取春 / 夏 / 秋 / 冬 / 内衣 / 派对 / 泳装 / 性感

### 两种参考图形式

| 模式 | 适用场景 | 你能拿到什么 |
| --- | --- | --- |
| **参考图 = 链接** | 能联网取图的 Agent（Claude / GPT + 浏览器工具 / 有 shell 的编码 Agent） | 提示词里带三张图的源站直链 + curl 取图命令，开头写明「先取图、不许凭描述生成」 |
| **参考图 = 一张三联图** | 只能贴图、不能读 URL 的模型（多数对话式图像模型） | 一键生成 2828×1380 的三联参考图（左①脸 / 中②服装 / 右③姿势，带编号标注），可下载或直接复制到剪贴板 |

<img width="1574" height="1628" alt="Image" src="https://github.com/user-attachments/assets/a698df0d-9fc6-48c2-a824-086736eb2e72" />

<img width="1620" height="1854" alt="Image" src="https://github.com/user-attachments/assets/17454dd8-3e23-47cc-8f6c-f3607bf7df6b" />

## 本地开发

    python3 -m http.server 8080

然后访问 http://localhost:8080

## 原图下载

注：仅用于本地预览高清图

**AI 作图脸库**

[https://pan.baidu.com/s/1rxqVp0qkxCQf-8Z8DXI6HA?pwd=jR2P](https://pan.baidu.com/s/1rxqVp0qkxCQf-8Z8DXI6HA?pwd=jR2P)

[https://pan.quark.cn/s/469084c4f0fa](https://pan.quark.cn/s/469084c4f0fa)

**AI 服装库**

[https://pan.baidu.com/s/1bsGuveiCBRbucS-17tpTrg?pwd=s39e](https://pan.baidu.com/s/1bsGuveiCBRbucS-17tpTrg?pwd=s39e)

[https://pan.quark.cn/s/492b9782ab78](https://pan.quark.cn/s/492b9782ab78)

**AI 作图姿势库**

[https://pan.quark.cn/s/6b1004add615](https://pan.quark.cn/s/6b1004add615)

[https://pan.baidu.com/s/1rY8E88d19xabnoBGhex4zg?pwd=vsf6](https://pan.baidu.com/s/1rY8E88d19xabnoBGhex4zg?pwd=vsf6)

## 埋点

**本站当前已开启：GA4 `G-0C99160522` + Microsoft Clarity `r1wmvdsf4a`。**

## 授权

| 库 | 授权 | 能否再分发图片 |
| --- | --- | --- |
| 脸库 | **CC0**（放弃著作权） | ✅ 可以 |
| 姿势库 | 免费商用、可修改、可参考 | ❌ 禁止再分发图片本体（含改过的版本） |
| 服装库 | 同上 | ❌ 禁止再分发图片本体 |

- 三个库都**不涉及真实人物**（全部 AI 生成）
- 服装库作者做过品牌相似度检查，但**不保证不侵权**，商用前请自行判断
- 本仓库只收录缩略图用于检索，原图请走源站下载；**请勿把原图打包再分发**

| 库 | 内容 | 数量 | 源站 |
| --- | --- | --- | --- |
| 脸库 | 正面向、纯色背景的头部参考（脸部特写 893 / 造型 606） | 1,499 张 | <https://ai-portrait-gallery.pages.dev/> |
| 姿势库 | 无脸灰色人偶线稿，每姿势 5 个机位 | 288 姿势 / 1,439 图 | <https://ai-pose-gallery.pages.dev/> |
| 服装库 | 无人物、只有服装的参考图（8 个分类） | 1,407 套 | <https://ai-costume-gallery.pages.dev/> |

## 免责

素材版权归原作者所有，本仓库仅为个人使用的中文检索界面，按原样提供、无担保。

---

[↑ 回到目录](#目录)
