/**
 * 本地原图目录（可选）。
 *
 * 留空字符串 = 不使用本地原图，弹窗大图与「下载原图」都会直接走作者源站。
 * 填了路径 = 优先读本地原图（快、离线可用），读不到自动回退源站。
 *
 * 仓库里默认填的是作者本机的相对路径，别人克隆后这些目录不存在，
 * 会自动、无感地回退到源站下载，不影响使用。
 *
 * 想改成自己的路径，直接把下面三项换成对应目录即可（结尾要有 /）。
 */
window.LOCAL_ORIGINALS = {
  face: "../脸库中文版/originals/",
  pose: "../姿势库中文版/originals/",
  costume: "../服装库中文版/originals/"
};

/**
 * 埋点配置（可选，填了才会上报）。可以同时接多家：
 *
 * provider 取值：
 *   "ga4"         → Google Analytics 4，id 形如 G-XXXXXXXXXX
 *   "baidu"       → 百度统计，id 是 hm.js? 后面那串
 *   "umami"       → Umami Cloud，id 是 website-id
 *   "clarity"     → Microsoft Clarity，id 是项目 ID（设置 → 概览里的那串）
 *   "cloudflare"  → Cloudflare Web Analytics，id 是 beacon token（只统计 PV，无自定义事件）
 *
 * 示例（同时开 Clarity 会话录制 + GA4 事件统计）：
 *   window.ANALYTICS = {
 *     providers: [
 *       { provider: "clarity", id: "abcdefghij" },
 *       { provider: "ga4",     id: "G-XXXXXXXXXX" }
 *     ]
 *   };
 *
 * 留空 / 不写 providers = 完全关闭，只写本地 window.__trackLog，不发任何请求。
 *
 * 调试：控制台执行 window.__trackDebug = true 后刷新，可看到每条事件；
 *      window.__trackLog 里始终保留最近 200 条。
 */
window.ANALYTICS = {
  providers: [
    { provider: "ga4", id: "G-0C99160522" },
    { provider: "clarity", id: "r1wmvdsf4a" }
    // { provider: "baidu", id: "你的百度统计 id" }
  ]
};

/**
 * 整库原图的网盘（可选）。留空字符串 = 不显示该入口。
 * 想换推广链接，直接改这里，不用动 app.js。
 */
window.PAN_LINKS = {
  face:    { baidu: "https://pan.baidu.com/s/1rxqVp0qkxCQf-8Z8DXI6HA?pwd=jR2P", quark: "https://pan.quark.cn/s/469084c4f0fa" },
  pose:    { baidu: "https://pan.baidu.com/s/1rY8E88d19xabnoBGhex4zg?pwd=vsf6", quark: "https://pan.quark.cn/s/6b1004add615" },
  costume: { baidu: "https://pan.baidu.com/s/1bsGuveiCBRbucS-17tpTrg?pwd=s39e", quark: "https://pan.quark.cn/s/492b9782ab78" }
};
