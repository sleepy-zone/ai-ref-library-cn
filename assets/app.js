(function () {
"use strict";

var $ = function (s) { return document.querySelector(s); };
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
function trackEvent(name, params) { try { if (window.track) window.track(name, params); } catch (e) { } }
var searchTimer = null;
function trackSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(function () {
    if (S.q) trackEvent("search", { lib: S.lib, q: S.q.slice(0, 40) });
  }, 800);
}

/* 输入去抖：每次按键重建 1400+ 张卡会把 INP 顶到 300ms 以上 */
var qTimer = null;
function bindSearch() {
  $("#q").oninput = function (e) {
    var v = e.target.value.trim();
    clearTimeout(qTimer);
    qTimer = setTimeout(function () {
      S.q = v;
      SHOWN = PER_PAGE;
      render(true);
      trackSearch();
    }, 180);
  };
}

var LIB = {
  face: {
    key: "face", name: "脸库", file: "data/face.js", g: "LIB_FACE", total: 1499, unit: "张", size: "0.2",
    site: "https://ai-portrait-gallery.pages.dev/",
    remote: function (base) { return "https://ai-portrait-gallery.pages.dev/img/full/" + base + ".png"; }
  },
  pose: {
    key: "pose", name: "姿势库", file: "data/pose.js", g: "LIB_POSE", total: 288, unit: "个姿势", size: "0.17",
    site: "https://ai-pose-gallery.pages.dev/",
    remote: function (base) { return "https://ai-pose-gallery.pages.dev/img/" + base + ".png"; }
  },
  costume: {
    key: "costume", name: "服装库", file: "data/costume.js", g: "LIB_COSTUME", total: 1407, unit: "套", size: "0.3",
    site: "https://ai-costume-gallery.pages.dev/",
    remote: function (base) { return "https://ai-costume-gallery.pages.dev/png/" + base + ".png"; }
  }
};

var LOCAL = window.LOCAL_ORIGINALS || { face: "", pose: "", costume: "" };

var PER_PAGE = 200;   // 一次渲染的卡片上限，超出用「显示更多」追加
var SHOWN = PER_PAGE;

var S = {
  lib: "face", q: "",
  face: { sec: -1, hair: -1 },
  pose: { series: -1, cat: "", ang: "", view: "pose" },
  costume: { cat: -1 }
};

var cache = {};
var cur = null;      // 当前弹窗条目
var curLib = null;
var curAngle = "";   // 姿势库当前机位
var REF_MODE = "line";   // 全局：line | depth（姿势参考图形式）
try { REF_MODE = window.localStorage.getItem("refMode") || "line"; } catch (e) { }
var localOk = true;  // 本地原图是否可用（用于下载链接）

function data(lib) { return cache[lib].data; }
function imgMap(lib) { return cache[lib].img; }
function thumb(lib, base) { return imgMap(lib)[base] || ""; }

/* 首屏前 n 张图改成 eager，第一张抬到 high 优先级：
   全部 loading="lazy" 连视口内的图也降级，LCP 会被拖到 2.5s 以上 */
function eagerFirst(container, n) {
  if (!container) return;
  var imgs = container.querySelectorAll("img");
  for (var i = 0; i < Math.min(n, imgs.length); i++) {
    imgs[i].loading = "eager";
    imgs[i].decoding = "async";
  }
  if (imgs[0]) imgs[0].setAttribute("fetchpriority", "high");
}

/* 轻提示：点提示词框复制后给个反馈，否则用户不知道点成功了 */
function flash(msg) {
  var d = document.createElement("div");
  d.className = "toast";
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(function () { d.remove(); }, 1500);
}

function loadLib(lib) {
  if (cache[lib]) return Promise.resolve(cache[lib]);
  return new Promise(function (resolve, reject) {
    var s = document.createElement("script");
    s.src = LIB[lib].file;
    s.onload = function () {
      var g = window[LIB[lib].g];
      if (!g) { reject(new Error("数据加载失败")); return; }
      cache[lib] = g;
      resolve(g);
    };
    s.onerror = function () { reject(new Error("无法加载 " + LIB[lib].file)); };
    document.head.appendChild(s);
    $("#toolbar").innerHTML = '<div class="loading">正在载入' + LIB[lib].name + "（约 " + (LIB[lib].size || "0.2") + " MB）…</div>";
    $("#grid").innerHTML = "";
  });
}

/* ---------- 卡片 ---------- */
function faceCard(it) {
  var hair = it.h >= 0 ? data("face").hairs[it.h].name : "";
  var sec = data("face").sections[it.s].name;
  return '<article class="card" data-id="' + it.id + '">'
    + '<div class="ph r45"><img loading="lazy" decoding="async" src="' + thumb("face", it.id) + '" alt="' + it.id + '">'
    + '<div class="badge">' + it.id + "</div>" + (it.hot ? '<div class="fire" title="下载榜 Top10"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3 4 5 5.5 5 9a5 5 0 0 1-10 0c0-2 .8-3.2 2-4.5"/></svg></div>' : "") + "</div>"
    + '<div class="meta"><div class="tags"><span class="cat">' + esc(sec) + "</span>" + (hair ? '<span class="tag">' + esc(hair) + "</span>" : "") + "</div>"
    + (it.sz ? '<p class="en">' + esc(it.sz) + "</p>" : "") + "</div></article>";
}

function poseCard(p) {
  var main = p.ang[S.pose.ang] || p.ang["正面"] || p.ang[Object.keys(p.ang)[0]];
  var strip = Object.keys(p.ang).map(function (a) {
    return '<button data-k="' + esc(p.key) + '" data-a="' + esc(a) + '"' + (a === (S.pose.ang || "正面") ? ' class="on"' : "") + ' title="' + esc(a) + '"><img loading="lazy" decoding="async" src="' + thumb("pose", p.ang[a]) + '" alt="' + esc(a) + '"></button>';
  }).join("");
  return '<article class="card" data-k="' + esc(p.key) + '">'
    + '<div class="ph r34" data-a="' + esc(S.pose.ang || "正面") + '"><img loading="lazy" decoding="async" src="' + thumb("pose", main) + '" alt="' + esc(p.zh) + '"><div class="badge">' + p.id + "</div></div>"
    + '<div class="meta"><h3>' + esc(p.zh) + '</h3><p class="ja">' + esc(p.ja) + "</p>"
    + '<div class="tags"><span class="tag">' + esc(data("pose").series[p.s].name) + '</span><span class="tag">' + esc(p.cat) + "</span></div></div>"
    + (S.pose.view === "one" ? "" : '<div class="strip">' + strip + "</div>")
    + "</article>";
}

function costumeCard(it) {
  var c = data("costume").cats[it.c].name;
  var shown = it.zh.slice(0, 4), rest = it.zh.length - shown.length;
  return '<article class="card" data-id="' + it.id + '">'
    + '<div class="ph r23"><img loading="lazy" decoding="async" src="' + thumb("costume", it.id) + '" alt="' + it.id + '"><div class="badge">' + it.id + "</div></div>"
    + '<div class="meta"><div class="tags"><span class="cat">' + esc(c) + "</span>"
    + shown.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("")
    + (rest > 0 ? '<span class="more">+' + rest + "</span>" : "")
    + '</div><p class="en">' + esc(it.kw.join(" · ")) + "</p></div></article>";
}

/* ---------- 过滤 ---------- */
function faceMatch(it) {
  if (S.face.sec >= 0 && it.s !== S.face.sec) return false;
  if (S.face.hair >= 0 && it.h !== S.face.hair) return false;
  if (S.q) {
    var q = S.q.toLowerCase();
    var hay = (it.id + " " + data("face").sections[it.s].name + " " + (it.sz || "") + " " + (it.sj || "") + " " + (it.h >= 0 ? data("face").hairs[it.h].name : "")).toLowerCase();
    if (hay.indexOf(q) < 0) return false;
  }
  return true;
}
function poseMatch(p) {
  if (S.pose.series >= 0 && p.s !== S.pose.series) return false;
  if (S.pose.cat && p.cat !== S.pose.cat) return false;
  if (S.q) {
    var q = S.q.toLowerCase();
    var hay = (p.zh + " " + p.ja + " " + p.id + " " + p.cat + " " + data("pose").series[p.s].name).toLowerCase();
    if (hay.indexOf(q) < 0) return false;
  }
  return true;
}
function costumeMatch(it) {
  if (S.costume.cat >= 0 && it.c !== S.costume.cat) return false;
  if (S.q) {
    var q = S.q.toLowerCase();
    var hay = (it.id + " " + data("costume").cats[it.c].name + " " + it.kw.join(" ") + " " + it.zh.join(" ")).toLowerCase();
    if (hay.indexOf(q) < 0) return false;
  }
  return true;
}

/* ---------- 工具栏 ---------- */
function tabsHTML(items, active, attr) {
  return items.map(function (x, i) {
    return '<button class="tab' + (i === active ? " on" : "") + '" data-' + attr + '="' + i + '">' + esc(x.label) + "<b>" + x.n + "</b>" + (x.suffix ? "<i>" + x.suffix + "</i>" : "") + "</button>";
  }).join("");
}

function toolbarFace() {
  var d = data("face");
  var tabs = [{ label: "全部", n: d.items.length, suffix: "" }].concat(d.sections.map(function (s) { return { label: s.name, n: s.n, suffix: "" }; }));
  var all = '<button class="tab' + (S.face.sec < 0 ? " on" : "") + '" data-sec="-1">全部<b>' + d.items.length + '</b></button>';
  d.sections.forEach(function (s, i) {
    all += '<button class="tab' + (S.face.sec === i ? " on" : "") + '" data-sec="' + i + '">' + esc(s.name) + "<b>" + s.n + "</b></button>";
  });
  var counts = [0, 0, 0, 0];
  d.items.forEach(function (it) { if ((S.face.sec < 0 || it.s === S.face.sec) && it.h >= 0) counts[it.h]++; });
  var hair = '<button data-hair="-1"' + (S.face.hair < 0 ? ' class="on"' : "") + ">全部发长</button>";
  d.hairs.forEach(function (h, i) {
    hair += '<button data-hair="' + i + '"' + (S.face.hair === i ? ' class="on"' : "") + ">" + esc(h.name) + " " + counts[i] + "</button>";
  });
  $("#toolbar").innerHTML = '<div class="tabs">' + all + "</div>"
    + '<div class="row"><input id="q" type="search" placeholder="搜索：编号 / 造型（蝴蝶剪、狼尾、空气刘海）" autocomplete="off">'
    + '<div class="seg" id="hairseg">' + hair + '</div><button class="rndbtn" id="rnd2"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3 13 11"/><path d="M8 21H3v-5"/><path d="M3 21l8-8"/><path d="M21 16v5h-5"/><path d="m21 21-4-4"/><path d="M3 8V3h5"/><path d="m3 3 4 4"/></svg>随机一张</button><span id="count"></span></div>';
  $("#toolbar").querySelectorAll("[data-sec]").forEach(function (b) {
    b.onclick = function () { S.face.sec = +b.dataset.sec; S.q = ""; trackEvent("filter", { lib: "face", type: "section", value: b.dataset.sec }); render(); };
  });
  $("#toolbar").querySelectorAll("[data-hair]").forEach(function (b) {
    b.onclick = function () { S.face.hair = +b.dataset.hair; trackEvent("filter", { lib: "face", type: "hair", value: b.dataset.hair }); render(); };
  });
  $("#q").value = S.q;
  bindSearch();
}

function toolbarPose() {
  var d = data("pose");
  var all = '<button class="tab' + (S.pose.series < 0 ? " on" : "") + '" data-series="-1">全部<b>' + d.poses.length + '</b><i>个姿势</i></button>';
  d.series.forEach(function (s, i) {
    all += '<button class="tab' + (S.pose.series === i ? " on" : "") + '" data-series="' + i + '">' + esc(s.name) + "<b>" + s.n + "</b><i>个 / " + s.img + " 张</i></button>";
  });
  var cats = [];
  d.poses.forEach(function (p) { if ((S.pose.series < 0 || p.s === S.pose.series) && cats.indexOf(p.cat) < 0) cats.push(p.cat); });
  var sel = '<select id="cat"><option value="">全部分类</option>' + cats.map(function (c) {
    return '<option value="' + esc(c) + '"' + (S.pose.cat === c ? " selected" : "") + ">" + esc(c) + "</option>";
  }).join("") + "</select>";
  var angs = ["", "正面", "俯视", "仰视", "侧面", "斜45°"];
  var angHTML = angs.map(function (a) {
    return '<button data-ang="' + a + '"' + (S.pose.ang === a ? ' class="on"' : "") + ">" + (a || "全机位") + "</button>";
  }).join("");
  $("#toolbar").innerHTML = '<div class="tabs">' + all + "</div>"
    + '<div class="row"><input id="q" type="search" placeholder="搜索：中文名 / 日文名 / 编号（如 比心、P023、站立）" autocomplete="off">'
    + sel + '<div class="seg" id="angseg">' + angHTML + "</div>"
    + '<div class="seg" id="viewseg"><button data-view="pose"' + (S.pose.view === "pose" ? ' class="on"' : '') + '>按姿势</button><button data-view="one"' + (S.pose.view === "one" ? ' class="on"' : '') + '>按单张</button></div>' 
    + '<button class="rndbtn" id="rnd2"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3 13 11"/><path d="M8 21H3v-5"/><path d="M3 21l8-8"/><path d="M21 16v5h-5"/><path d="m21 21-4-4"/><path d="M3 8V3h5"/><path d="m3 3 4 4"/></svg>随机一张</button><span id="count"></span></div>';
  $("#toolbar").querySelectorAll("[data-series]").forEach(function (b) {
    b.onclick = function () { S.pose.series = +b.dataset.series; S.pose.cat = ""; trackEvent("filter", { lib: "pose", type: "series", value: b.dataset.series }); render(); };
  });
  $("#toolbar").querySelectorAll("[data-ang]").forEach(function (b) {
    b.onclick = function () { S.pose.ang = b.dataset.ang; trackEvent("filter", { lib: "pose", type: "angle", value: b.dataset.ang || "all" }); render(); };
  });
  $("#toolbar").querySelectorAll("[data-view]").forEach(function (b) {
    b.onclick = function () { S.pose.view = b.dataset.view; trackEvent("filter", { lib: "pose", type: "view", value: b.dataset.view }); render(); };
  });
  $("#cat").onchange = function (e) { S.pose.cat = e.target.value; trackEvent("filter", { lib: "pose", type: "cat", value: e.target.value || "all" }); render(); };
  $("#q").value = S.q;
  bindSearch();
}

function toolbarCostume() {
  var d = data("costume");
  var all = '<button class="tab' + (S.costume.cat < 0 ? " on" : "") + '" data-cat="-1">全部<b>' + d.items.length + "</b></button>";
  d.cats.forEach(function (c, i) {
    all += '<button class="tab' + (S.costume.cat === i ? " on" : "") + '" data-cat="' + i + '">' + esc(c.name) + "<b>" + c.n + "</b></button>";
  });
  $("#toolbar").innerHTML = '<div class="tabs">' + all + "</div>"
    + '<div class="row"><input id="q" type="search" placeholder="搜索：编号 / 中文（牛仔、蕾丝）/ 英文（denim、lace）" autocomplete="off"><button class="rndbtn" id="rnd2"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3 13 11"/><path d="M8 21H3v-5"/><path d="M3 21l8-8"/><path d="M21 16v5h-5"/><path d="m21 21-4-4"/><path d="M3 8V3h5"/><path d="m3 3 4 4"/></svg>随机一张</button><span id="count"></span></div>';
  $("#toolbar").querySelectorAll("[data-cat]").forEach(function (b) {
    b.onclick = function () { S.costume.cat = +b.dataset.cat; trackEvent("filter", { lib: "costume", type: "cat", value: b.dataset.cat }); render(); };
  });
  $("#q").value = S.q;
  bindSearch();
}

/* ---------- 渲染 ---------- */
function render(gridOnly) {
  if (!cache[S.lib]) return;
  if (!gridOnly) {
    if (S.lib === "face") toolbarFace();
    else if (S.lib === "pose") toolbarPose();
    else toolbarCostume();
  }
  if (S.lib === "face") renderFace();
  else if (S.lib === "pose") renderPose();
  else renderCostume();
}

/* 同时覆盖普通网格卡片和「随机组合」的三个 slot（默认落地页就是 combo，
   以前只匹配 #grid .card img，导致 combo 首屏三张图一直是 lazy）*/
function optimizeFirstScreen() {
  eagerFirst(document.getElementById("grid"), 8);
}

/* 大列表分页渲染：一次最多画 PER_PAGE 张，剩下的用「显示更多」追加，避免每次筛选都重建上千个节点 */
function appendMore(total, painted, redraw, unit) {
  if (painted >= total) return;
  var b = document.createElement("button");
  b.className = "more-btn";
  b.textContent = "显示更多（还有 " + (total - painted) + " " + (unit || "项") + "）";
  b.onclick = function () { SHOWN += PER_PAGE; redraw(); };
  var g = document.getElementById("grid");
  if (g) g.appendChild(b);
}

function renderFace() {
  var d = data("face");
  var list = d.items.filter(faceMatch);
  var shown = Math.min(SHOWN, list.length);
  $("#grid").className = "grid face";
  $("#grid").innerHTML = list.slice(0, shown).map(faceCard).join("");
  $("#count").textContent = "符合条件：" + list.length + " 张" + (shown < list.length ? "（已显示 " + shown + "）" : "");
  $("#grid").querySelectorAll(".card").forEach(function (c) { c.onclick = function () { openFace(c.dataset.id); }; });
  optimizeFirstScreen();
  appendMore(list.length, shown, renderFace, "张");
}

function renderPose() {
  var d = data("pose");
  var all = d.poses.filter(poseMatch);
  var list = all.slice(0, SHOWN);
  var html = "", shown = 0;
  if (S.pose.view === "one") {
    var angs = S.pose.ang ? [S.pose.ang] : ["正面", "俯视", "仰视", "侧面", "斜45°"];
    list.forEach(function (p) {
      angs.forEach(function (a) { if (p.ang[a]) { html += poseCardOne(p, a); shown++; } });
    });
  } else {
    html = list.map(poseCard).join("");
    shown = list.length;
  }
  $("#grid").className = "grid pose";
  $("#grid").innerHTML = html;
  $("#count").textContent = "符合条件：" + all.length + (S.pose.view === "one" ? " 个姿势 / " + shown + " 张" : " 个姿势") + (list.length < all.length ? "（已显示 " + list.length + " 个）" : "");
  $("#grid").querySelectorAll(".card").forEach(function (c) {
    var ph = c.querySelector(".ph");
    c.onclick = function () { openPose(c.dataset.k || c.dataset.key, ph.dataset.a || S.pose.ang || "正面"); };
    c.querySelectorAll(".strip button").forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); openPose(b.dataset.k, b.dataset.a); };
    });
  });
  optimizeFirstScreen();
  appendMore(all.length, list.length, renderPose, "个");
}

function poseCardOne(p, a) {
  return '<article class="card" data-key="' + esc(p.key) + '">'
    + '<div class="ph r34" data-a="' + esc(a) + '"><img loading="lazy" decoding="async" src="' + thumb("pose", p.ang[a]) + '" alt="' + esc(p.zh) + '"><div class="badge">' + p.id + " · " + esc(a) + "</div></div>"
    + '<div class="meta"><h3>' + esc(p.zh) + '</h3><p class="ja">' + esc(p.ja) + "</p>"
    + '<div class="tags"><span class="tag">' + esc(data("pose").series[p.s].name) + '</span><span class="tag">' + esc(p.cat) + "</span></div></div></article>";
}

function renderCostume() {
  var d = data("costume");
  var list = d.items.filter(costumeMatch);
  var shown = Math.min(SHOWN, list.length);
  $("#grid").className = "grid";
  $("#grid").innerHTML = list.slice(0, shown).map(costumeCard).join("");
  $("#count").textContent = "符合条件：" + list.length + " 套" + (shown < list.length ? "（已显示 " + shown + "）" : "");
  $("#grid").querySelectorAll(".card").forEach(function (c) { c.onclick = function () { openCostume(c.dataset.id); }; });
  optimizeFirstScreen();
  appendMore(list.length, shown, renderCostume, "套");
}

/* ---------- 弹窗 ---------- */
function resolveOriginal(lib, base, name) {
  var local = (location.protocol === "file:" && LOCAL[lib]) ? (LOCAL[lib] + base + ".png") : "";
  var remote = LIB[lib].remote(base);
  var im = $("#mimg");
  localOk = false;
  // 下载链接默认指向源站，避免本地路径 404 时点出错误页面
  setDownload(remote, name);
  im.onerror = function () {
    if (local && im.getAttribute("src") === local) {
      im.onerror = function () { im.onerror = null; im.src = thumb(lib, base); };
      im.src = remote;
    } else { im.onerror = null; im.src = thumb(lib, base); }
  };
  im.onload = function () {
    var d = im.naturalWidth + "×" + im.naturalHeight;
    var el = $("#mdim");
    if (el) el.textContent = d;
    if (local && im.getAttribute("src") === local) {
      localOk = true;
      setDownload(local, name);
    }
  };
  im.src = local || remote;
}

function showModal() { $("#modal").classList.add("on"); }
function hideModal() { $("#modal").classList.remove("on"); }

function setDownload(link, name) {
  $("#mdl").href = link;
  $("#mdl").setAttribute("download", name);
}

function showPan(lib) {
  var cfg = window.PAN_LINKS || {};
  var item = cfg[lib];
  var b = $("#mPanBaidu"), q = $("#mPanQuark");
  var has = !!(item && (item.baidu || item.quark));
  $("#mpan").hidden = !has;
  if (!has) return;
  b.href = item.baidu || "#";
  b.hidden = !item.baidu;
  q.href = item.quark || "#";
  q.hidden = !item.quark;
  /* 网盘等外链的点击不再自己埋点：Clarity 自带「出站点击」，
     在 Android 内置浏览器里手动埋点曾触发 Maximum call stack（2026-11-03 录制） */
}

function openFace(id) {
  curLib = "face"; cur = data("face").items.filter(function (x) { return x.id === id; })[0];
  if (!cur) return;
  trackEvent("item_open", { lib: "face", id: cur.id });
  var d = data("face");
  resolveOriginal("face", cur.id, cur.id + ".png");
  $("#mtitle").textContent = d.sections[cur.s].name + " · " + cur.id;
  $("#mfields").innerHTML = '<dt>编号</dt><dd>' + cur.id + "</dd><dt>类型</dt><dd>" + esc(d.sections[cur.s].name) + "</dd>"
    + "<dt>发长</dt><dd>" + (cur.h >= 0 ? esc(d.hairs[cur.h].name) : "—") + '</dd><dt>尺寸</dt><dd id="mdim">—</dd>';
  var chips = "";
  if (cur.sz) chips += '<span class="chip">' + esc(cur.sz) + "</span>";
  if (cur.sj) chips += '<span class="chip en">' + esc(cur.sj) + "</span>";
  $("#mextra").innerHTML = '<div class="sect">造型</div>' + (chips || '<span style="color:#9a9aa4;font-size:12px">无（正面向·纯色背景脸部特写）</span>');
  $("#mdepth").hidden = true;
  $("#mMode").hidden = true;
  $("#mdl").textContent = "下载原图（PNG 高清）";
  $("#mcopy").dataset.lib = "face";
  showPan("face");
  showModal();
}

function paintPoseImage(base, depthUrl) {
  var im = $("#mimg");
  if (REF_MODE === "depth") {
    im.referrerPolicy = "no-referrer";
    im.onerror = function () {
      im.onerror = null;
      resolveOriginal("pose", base, base + ".png");
    };
    im.onload = function () {
      var el = $("#mdim");
      if (el) el.textContent = im.naturalWidth + "×" + im.naturalHeight;
    };
    im.src = depthUrl;
  } else {
    im.referrerPolicy = "";
    resolveOriginal("pose", base, base + ".png");
  }
}

function syncModeUI() {
  document.querySelectorAll("#refModeSeg button, #mMode button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.mode === REF_MODE);
    b.setAttribute("aria-pressed", b.dataset.mode === REF_MODE ? "true" : "false");
  });
}

function setRefMode(m) {
  if (m === REF_MODE) return;
  REF_MODE = m;
  try { window.localStorage.setItem("refMode", m); } catch (e) { }
  trackEvent("ref_mode", { mode: m });
  syncModeUI();
  if (S.lib === "combo" && cache.face) renderCombo();
  if ($("#modal").classList.contains("on") && curLib === "pose" && cur) openPose(cur.key, curAngle);
}

function openPose(key, angle) {
  curLib = "pose";
  cur = data("pose").poses.filter(function (x) { return x.key === key; })[0];
  if (!cur) return;
  trackEvent("item_open", { lib: "pose", id: cur.id, series: data("pose").series[cur.s].name });
  curAngle = cur.ang[angle] ? angle : Object.keys(cur.ang)[0];
  var d = data("pose");
  var base = cur.ang[curAngle];
  resolveOriginal("pose", base, base + ".png");
  $("#mtitle").textContent = cur.zh;
  $("#mfields").innerHTML = '<dt>编号</dt><dd>' + cur.id + "</dd><dt>分组</dt><dd>" + esc(d.series[cur.s].name) + "</dd>"
    + "<dt>分类</dt><dd>" + esc(cur.cat) + '</dd><dt>机位</dt><dd id="mangn">' + esc(curAngle) + '</dd>';
  var angs = Object.keys(cur.ang);
  $("#mextra").innerHTML = '<div class="sect">其他机位</div><div class="mang" id="mang">' + angs.map(function (a) {
    return '<button data-a="' + esc(a) + '"' + (a === curAngle ? ' class="on"' : "") + '><img loading="lazy" src="' + thumb("pose", cur.ang[a]) + '" alt="' + esc(a) + '"></button>';
  }).join("") + "</div>";
  $("#mang").querySelectorAll("button").forEach(function (b) {
    b.onclick = function () { openPose(key, b.dataset.a); };
  });
  $("#mdl").textContent = "下载原图（PNG · 900×1200）";
  var depthUrl = "https://ai-pose-depth-gallery.pages.dev/img/" + base + ".png";
  $("#mdepth").href = depthUrl;
  $("#mdepth").hidden = false;
  $("#mdepth").onclick = function () { trackEvent("depth_link", { id: cur.id, angle: curAngle }); };
  $("#mMode").hidden = false;
  $("#mMode").querySelectorAll("button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.mode === REF_MODE);
    b.onclick = function () { setRefMode(b.dataset.mode); };
  });
  paintPoseImage(base, depthUrl);
  $("#mcopy").dataset.lib = "pose";
  showPan("pose");
  showModal();
}

function openCostume(id) {
  curLib = "costume"; cur = data("costume").items.filter(function (x) { return x.id === id; })[0];
  if (!cur) return;
  trackEvent("item_open", { lib: "costume", id: cur.id });
  var d = data("costume");
  resolveOriginal("costume", cur.id, cur.id + ".png");
  $("#mtitle").textContent = cur.id + " · " + d.cats[cur.c].name;
  $("#mfields").innerHTML = '<dt>编号</dt><dd>' + cur.id + "</dd><dt>分类</dt><dd>" + esc(d.cats[cur.c].name) + "</dd>"
    + "<dt>标签</dt><dd>" + cur.zh.length + ' 个</dd><dt>尺寸</dt><dd id="mdim">—</dd>';
  $("#mextra").innerHTML = '<div class="sect">中文标签</div>' + cur.zh.map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("")
    + '<div class="sect">英文标签（可直接搜）</div>' + cur.kw.map(function (t) { return '<span class="chip en">' + esc(t) + "</span>"; }).join("");
  $("#mdepth").hidden = true;
  $("#mMode").hidden = true;
  $("#mdl").textContent = "下载原图（PNG · 长边约 2048）";
  $("#mcopy").dataset.lib = "costume";
  showPan("costume");
  showModal();
}

function stepModal(delta) {
  if (!cur) return;
  var list;
  if (curLib === "face") { list = data("face").items.filter(faceMatch); }
  else if (curLib === "costume") { list = data("costume").items.filter(costumeMatch); }
  else { list = data("pose").poses.filter(poseMatch); }
  if (list.length < 2) return;
  var idx = list.findIndex(function (x) {
    return curLib === "pose" ? x.key === cur.key : x.id === cur.id;
  });
  idx = idx < 0 ? 0 : (idx + delta + list.length) % list.length;
  var n = list[idx];
  if (curLib === "face") openFace(n.id);
  else if (curLib === "costume") openCostume(n.id);
  else openPose(n.key, curAngle);
}

function stepAngle(delta) {
  if (curLib !== "pose" || !cur) return;
  var angs = Object.keys(cur.ang);
  var i = angs.indexOf(curAngle);
  curAngle = angs[(i + delta + angs.length) % angs.length];
  openPose(cur.key, curAngle);
}

$("#mimg").onclick = function () {
  if (!cur) return;
  var link = $("#mdl").getAttribute("href");
  if (link) window.open(link, "_blank");
};
$("#mprev").onclick = function () { if (curLib === "pose" && !S.pose.ang) stepAngle(-1); else stepModal(-1); };
$("#mnext").onclick = function () { if (curLib === "pose" && !S.pose.ang) stepAngle(1); else stepModal(1); };
$("#mclose").onclick = hideModal;
$("#modal").onclick = function (e) { if (e.target.id === "modal") hideModal(); };

$("#mcopy").onclick = function () {
  trackEvent("copy", { label: "modal_copy", lib: curLib || "" });
  var txt = "";
  if (curLib === "face") {
    var d = data("face");
    var desc = [d.sections[cur.s].name, cur.h >= 0 ? d.hairs[cur.h].name : "", cur.sz || ""].filter(Boolean).join("·");
    txt = "参考脸：" + cur.id + "（" + desc + "）。用图2这张脸作为图1角色的脸部参考，保持五官、脸型、骨相和发型一致；姿势、服装、场景、光线按需求重新生成。";
  } else if (curLib === "pose") {
    var dp = data("pose");
    txt = "参考姿势：" + cur.id + " " + cur.zh + "（" + dp.series[cur.s].name + "·" + cur.cat + "，机位：" + curAngle + "）。把图1中人物的姿势改成图2的姿势；保持脸、发型、服装、光线、画风完全不变，只改变身体姿态和四肢位置。";
  } else {
    var dc = data("costume");
    txt = "参考服装：" + cur.id + "（" + dc.cats[cur.c].name + "，" + cur.zh.slice(0, 6).join("·") + "）。把图1中人物的衣服换成图2的这套服装；保持脸、发型、体型、姿势、背景、光线和画风完全不变。";
  }
  var done = function () { $("#mcopy").textContent = "已复制 ✓"; setTimeout(function () { $("#mcopy").textContent = "复制作图指令"; }, 1600); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(function () { fallbackCopy(txt, done); });
  } else { fallbackCopy(txt, done); }
};
function fallbackCopy(txt, done, fail) {
  var t = document.createElement("textarea");
  t.value = txt;
  t.style.position = "fixed"; t.style.top = "-1000px"; t.style.opacity = "0";
  document.body.appendChild(t);
  t.focus(); t.select();
  var ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  t.remove();
  if (ok) { done(); return; }
  if (fail) { fail(); return; }
  if ($("#mcopy")) $("#mcopy").textContent = "复制失败，请手动选择";
}

document.addEventListener("keydown", function (e) {
  if (!$("#modal").classList.contains("on")) return;
  if (e.key === "Escape") hideModal();
  else if (e.key === "ArrowLeft") { e.preventDefault(); if (curLib === "pose") stepAngle(-1); else stepModal(-1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); if (curLib === "pose") stepAngle(1); else stepModal(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); if (curLib === "pose") stepModal(-1); }
  else if (e.key === "ArrowDown") { e.preventDefault(); if (curLib === "pose") stepModal(1); }
});

/* ---------- 随机组合 ---------- */
var COMBO = { face: null, costume: null, pose: null, poseSeries: -1, costumeCat: -1 };
var COMBO_ANGLE = "正面";
var NL = String.fromCharCode(10);
var EN = {
  sec: { "脸部特写": "face close-up", "造型": "styled portrait" },
  hair: { "短发": "short hair", "中发": "medium hair", "中长发": "medium-long hair", "长发": "long hair" },
  cat: { "春": "spring", "夏": "summer", "秋": "autumn", "冬": "winter", "内衣": "lingerie", "派对": "party", "泳装": "swimwear", "性感": "sexy" }
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function loadAll() {
  return Promise.all(["face", "pose", "costume"].map(function (k) { return loadLib(k); }));
}
function poolPose() {
  var arr = data("pose").poses.filter(function (p) { return COMBO.poseSeries < 0 || p.s === COMBO.poseSeries; });
  return arr.length ? arr : data("pose").poses;
}
function poolCostume() {
  var arr = data("costume").items.filter(function (it) { return COMBO.costumeCat < 0 || it.c === COMBO.costumeCat; });
  return arr.length ? arr : data("costume").items;
}
function comboReroll(which) {
  if (which === "face") COMBO.face = pick(data("face").items);
  else if (which === "costume") COMBO.costume = pick(poolCostume());
  else COMBO.pose = pick(poolPose());
  trackEvent("combo_reroll", { target: which, face: COMBO.face.id, costume: COMBO.costume.id, pose: COMBO.pose.id });
  renderCombo();
}
/* reason: "init" = 进页面自动抽一组（基线），"user" = 用户点「全部换一组」 */
function comboAll(reason) {
  COMBO.face = pick(data("face").items);
  COMBO.costume = pick(poolCostume());
  COMBO.pose = pick(poolPose());
  trackEvent(reason === "init" ? "combo_init" : "combo_reroll", {
    target: "all",
    face: COMBO.face.id,
    costume: COMBO.costume.id,
    pose: COMBO.pose.id,
    pose_series: data("pose").series[COMBO.pose.s].name
  });
  renderCombo();
}

function comboParts() {
  var f = COMBO.face, c = COMBO.costume, p = COMBO.pose;
  var fd = data("face"), cd = data("costume"), pd = data("pose");
  var fDesc = [fd.sections[f.s].name, f.h >= 0 ? fd.hairs[f.h].name : "", f.sz || ""].filter(Boolean).join(" · ");
  var pBase = p.ang[COMBO_ANGLE] || p.ang[Object.keys(p.ang)[0]];
  return {
    f: f, c: c, p: p,
    fDesc: fDesc,
    fDescEn: [EN.sec[fd.sections[f.s].name] || "", f.h >= 0 ? (EN.hair[fd.hairs[f.h].name] || "") : ""].filter(Boolean).join(", "),
    cCat: cd.cats[c.c].name,
    cCatEn: EN.cat[cd.cats[c.c].name] || cd.cats[c.c].name,
    cZh: c.zh.slice(0, 8).join(" · "),
    cEn: c.kw.slice(0, 10).join(", "),
    pSer: pd.series[p.s].name,
    pBase: pBase,
    depth: REF_MODE === "depth",
    urls: {
      face: LIB.face.remote(f.id),
      costume: LIB.costume.remote(c.id),
      pose: REF_MODE === "depth" ? ("https://ai-pose-depth-gallery.pages.dev/img/" + pBase + ".png") : LIB.pose.remote(pBase)
    }
  };
}

var COMBO_MODE = "links";

function linksZh(x) {
  return [
    "【角色生成任务】",
    "",
    "工作方式（重要，先看这一段）",
    "1. 下面「参考图」里的三个链接就是三张参考图，请先用你能用的手段（网页抓取 / 下载 / 读图工具）把图片真正取到本地或上下文里。",
    "2. 不要跳过取图，也不要只看链接文字、凭描述直接生成。",
    "3. 如果某一链接打不开：明确说明缺的是哪一张（脸 / 服装 / 姿势），用剩下的图继续，并在交付时注明缺了哪张。",
    "4. 三张都拿到之后，再按最后的「要求」执行。",
    "",
    "参考图",
    "1) 脸：" + x.f.id + "（" + x.fDesc + "）",
    "   " + x.urls.face,
    "2) 服装：" + x.c.id + "（" + x.cCat + "：" + x.cZh + "）",
    "   " + x.urls.costume,
    "3) 姿势：" + x.p.id + " " + x.p.zh + "（" + x.pSer + "·" + x.p.cat + "，" + COMBO_ANGLE + "机位）",
    "   " + x.urls.pose,
    "",
    "取图命令（有 shell 权限的直接跑）",
    "curl -L -o ref_face.png \"" + x.urls.face + "\"",
    "curl -L -o ref_outfit.png \"" + x.urls.costume + "\"",
    "curl -L -o ref_pose.png \"" + x.urls.pose + "\"",
    "",
    "要求",
    "1. 人物以图1为唯一脸部依据：五官、脸型、骨相、发型保持一致，是同一个人（不要换脸）。",
    "2. 服装整套换成图2：保留单品、配色、材质与配饰细节。",
    "3. 姿势按图3摆放：注意机位与透视关系，四肢自然、手指正常、不穿模。",
    "4. 画面：3:4 竖构图，全身入镜，干净背景，柔和影棚光，写实摄影质感。",
    "5. 不要出现文字、水印或多余人物。",
    "",
    "素材编号：脸 " + x.f.id + " / 服装 " + x.c.id + " / 姿势 " + x.p.id
  ].join(NL);
}

function singleZh(x) {
  return [
    "【角色生成任务 · 单图参考】",
    "",
    "我随这条消息附了 1 张参考图，是一张「三联图」，从左到右依次是：",
    "① 左：脸 —— " + x.f.id + "（" + x.fDesc + "）",
    "② 中：服装 —— " + x.c.id + "（" + x.cCat + "：" + x.cZh + "）",
    "③ 右：姿势 —— " + x.p.id + " " + x.p.zh + "（" + x.pSer + "·" + x.p.cat + "，" + COMBO_ANGLE + "机位）",
    "",
    "要求",
    "1. 三联图只是素材：不要原样输出这张拼图，也不要保留它的分格、边框和文字标注。",
    "2. 人物以「左格」的脸为唯一依据：五官、脸型、骨相、发型保持一致，是同一个人。",
    "3. 服装整套换成「中格」的造型：保留单品、配色、材质与配饰。",
    "4. 姿势按「右格」摆放：注意机位与透视，四肢自然、手指正常、不穿模。",
    "5. 画面：3:4 竖构图，全身入镜，干净背景，柔和影棚光，写实摄影质感。",
    "6. 不要出现文字、水印或多余人物。",
    "",
    "素材编号：脸 " + x.f.id + " / 服装 " + x.c.id + " / 姿势 " + x.p.id
  ].join(NL);
}

function linksEn(x) {
  return [
    "TASK: generate one 3:4 portrait from three reference images.",
    "",
    "HOW TO WORK (read this first)",
    "1. The three links below ARE the three reference images. Fetch them first with whatever you have (web fetch / download / image input) so the actual pixels are in your context.",
    "2. Do not skip the fetch step, and do not just read the link text and generate from description alone.",
    "3. If a link fails: say which one is missing (face / outfit / pose), continue with the rest, and note the missing reference in your delivery.",
    "4. Only after all three images are in hand, follow REQUIREMENTS.",
    "",
    "REFERENCES",
    "1) face: " + x.f.id + " (" + x.fDescEn + ") " + x.urls.face,
    "2) outfit: " + x.c.id + " (" + x.cCatEn + ": " + x.cEn + ") " + x.urls.costume,
    "3) pose: " + x.p.id + " " + x.p.zh + " (" + x.pSer + " / " + x.p.cat + ", " + COMBO_ANGLE + " view) " + x.urls.pose,
    "",
    "SHELL (run these if you have a shell)",
    "curl -L -o ref_face.png \"" + x.urls.face + "\"",
    "curl -L -o ref_outfit.png \"" + x.urls.costume + "\"",
    "curl -L -o ref_pose.png \"" + x.urls.pose + "\"",
    "",
    "REQUIREMENTS",
    "1. Use image 1 as the ONLY face reference: keep the same identity, facial features, bone structure and hairstyle.",
    "2. Replace the outfit with the full look in image 2: keep items, colours, fabrics and accessories.",
    "3. Match the body pose in image 3: correct camera angle and perspective, natural limbs, correct fingers, no interpenetration.",
    "4. Output: 3:4 vertical, full body in frame, clean background, soft studio light, photorealistic.",
    "5. No text, no watermark, no extra people.",
    "",
    "IDs: face " + x.f.id + " / outfit " + x.c.id + " / pose " + x.p.id
  ].join(NL);
}

function singleEn(x) {
  return [
    "TASK: generate one 3:4 portrait. The single attached image is a three-panel reference sheet.",
    "",
    "PANELS (left to right)",
    "1) LEFT = face: " + x.f.id + " (" + x.fDescEn + ")",
    "2) MIDDLE = outfit: " + x.c.id + " (" + x.cCatEn + ": " + x.cEn + ")",
    "3) RIGHT = pose: " + x.p.id + " " + x.p.zh + " (" + x.pSer + " / " + x.p.cat + ", " + COMBO_ANGLE + " view)",
    "",
    "REQUIREMENTS",
    "1. The sheet is reference material only: do not reproduce the collage, its frames or its labels.",
    "2. Use the LEFT panel as the ONLY face reference: same identity, facial features, bone structure and hairstyle.",
    "3. Replace the outfit with the MIDDLE panel: keep items, colours, fabrics and accessories.",
    "4. Match the pose in the RIGHT panel: correct camera angle, natural limbs, correct fingers.",
    "5. Output: 3:4 vertical, full body in frame, clean background, soft studio light, photorealistic.",
    "6. No text, no watermark, no extra people.",
    "",
    "IDs: face " + x.f.id + " / outfit " + x.c.id + " / pose " + x.p.id
  ].join(NL);
}

function promptZh() {
  var x = comboParts();
  var t = COMBO_MODE === "single" ? singleZh(x) : linksZh(x);
  return x.depth ? t + NL + NL + "注：姿势参考图是 depth（深度）版，白=近、黑=远；四肢的前后遮挡关系以它为准。" : t;
}
function promptEn() {
  var x = comboParts();
  var t = COMBO_MODE === "single" ? singleEn(x) : linksEn(x);
  return x.depth ? t + NL + NL + "NOTE: the pose reference is a DEPTH map (white = near, black = far). Follow its occlusion ordering." : t;
}

function comboUrls() {
  var x = comboParts();
  return [
    "取三张参考图（curl）：",
    "curl -L -o ref_face.png \"" + x.urls.face + "\"",
    "curl -L -o ref_outfit.png \"" + x.urls.costume + "\"",
    "curl -L -o ref_pose.png \"" + x.urls.pose + "\"",
    "",
    "链接：",
    "脸 " + x.urls.face,
    "服装 " + x.urls.costume,
    "姿势 " + x.urls.pose
  ].join(NL);
}

function copyBtnText(btn, text, label) {
  trackEvent("copy", { label: label });
  var done = function () {
    btn.textContent = "已复制 ✓";
    setTimeout(function () { btn.textContent = label; }, 1600);
  };
  var fail = function () {
    btn.textContent = "复制失败，请手动全选";
    setTimeout(function () { btn.textContent = label; }, 2400);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done, fail); });
  } else {
    fallbackCopy(text, done, fail);
  }
}

function loadImage(url, cors) {
  return new Promise(function (resolve, reject) {
    var im = new Image();
    if (cors) im.crossOrigin = "anonymous";
    im.onload = function () { resolve(im); };
    im.onerror = function () { reject(new Error("load failed")); };
    im.src = url;
  });
}

function makeSheet() {
  return new Promise(function (resolve, reject) {
    var x = comboParts();
    var panels = [
      { url: x.urls.face, fb: thumb("face", x.f.id), label: "① 脸 · " + x.f.id, sub: x.fDesc },
      { url: x.urls.costume, fb: thumb("costume", x.c.id), label: "② 服装 · " + x.c.id, sub: x.cCat + " · " + x.c.zh.slice(0, 4).join(" ") },
      { url: x.urls.pose, fb: thumb("pose", x.pBase), label: "③ 姿势" + (x.depth ? " · depth" : "") + " · " + x.p.id, sub: x.p.zh }
    ];
    var loaded = [];
    var i = 0;
    function step() {
      if (i >= panels.length) { draw(); return; }
      var it = panels[i++];
      loadImage(it.url, true).then(function (im) {
        loaded.push({ img: im, it: it }); step();
      }).catch(function () {
        loadImage(it.fb, false).then(function (im) {
          loaded.push({ img: im, it: it }); step();
        }).catch(function () {
          loaded.push({ img: null, it: it }); step();
        });
      });
    }
    function draw() {
      var PW = 900, PH = 1200, GAP = 24, PAD = 40, LAB = 100;
      var W = PAD * 2 + PW * 3 + GAP * 2, H = PAD + PH + LAB + PAD;
      var c = document.createElement("canvas");
      c.width = W; c.height = H;
      var g = c.getContext("2d");
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
      loaded.forEach(function (o, k) {
        var ox = PAD + k * (PW + GAP);
        if (o.img) {
          var s = Math.min(PW / o.img.width, PH / o.img.height);
          var w = o.img.width * s, h = o.img.height * s;
          g.drawImage(o.img, ox + (PW - w) / 2, PAD + (PH - h) / 2, w, h);
        } else {
          g.fillStyle = "#f2f2f4"; g.fillRect(ox, PAD, PW, PH);
        }
        g.fillStyle = "#1b1b1f";
        g.font = "600 34px -apple-system, 'PingFang SC', sans-serif";
        g.fillText(o.it.label, ox, PAD + PH + 46);
        g.fillStyle = "#6b6b76";
        g.font = "26px -apple-system, 'PingFang SC', sans-serif";
        g.fillText(o.it.sub, ox, PAD + PH + 84);
      });
      c.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error("toBlob failed"));
      }, "image/png");
    }
    step();
  });
}

function saveBlob(blob, name) {
  var u = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = u; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 3000);
}

function sheetName() {
  var x = comboParts();
  return "refs_" + x.f.id + "_" + x.c.id + "_" + x.p.id + ".png";
}

function downloadSheet(btn) {
  var label = btn.textContent;
  btn.textContent = "生成中…";
  trackEvent("combo_sheet", { action: "download" });
  makeSheet().then(function (blob) {
    saveBlob(blob, sheetName());
    btn.textContent = "已下载 ✓";
    setTimeout(function () { btn.textContent = label; }, 1600);
  }).catch(function () {
    btn.textContent = "生成失败，试试逐张下载";
    setTimeout(function () { btn.textContent = label; }, 2400);
  });
}

function copySheet(btn) {
  var label = btn.textContent;
  btn.textContent = "生成中…";
  trackEvent("combo_sheet", { action: "copy" });
  makeSheet().then(function (blob) {
    if (navigator.clipboard && window.ClipboardItem) {
      return navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(function () {
        btn.textContent = "已复制图片 ✓";
        setTimeout(function () { btn.textContent = label; }, 1600);
      });
    }
    saveBlob(blob, sheetName());
    btn.textContent = "已下载 ✓";
    setTimeout(function () { btn.textContent = label; }, 1600);
  }).catch(function () {
    btn.textContent = "失败";
    setTimeout(function () { btn.textContent = label; }, 2000);
  });
}

function renderCombo() {
  var fd = data("face"), cd = data("costume"), pd = data("pose");
  var poseOpts = '<option value="-1">全部</option>' + pd.series.map(function (s, i) {
    return '<option value="' + i + '"' + (COMBO.poseSeries === i ? " selected" : "") + ">" + esc(s.name) + "</option>";
  }).join("");
  var costOpts = '<option value="-1">全部</option>' + cd.cats.map(function (c, i) {
    return '<option value="' + i + '"' + (COMBO.costumeCat === i ? " selected" : "") + ">" + esc(c.name) + "</option>";
  }).join("");
  $("#toolbar").innerHTML = '<div class="row">'
    + '<span class="filter-label">姿势范围</span><select id="poseRange">' + poseOpts + "</select>"
    + '<span class="filter-label">服装范围</span><select id="costRange">' + costOpts + "</select>"
    + '<button class="rndbtn" id="rerollAll"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5"/><path d="M21 3 13 11"/><path d="M8 21H3v-5"/><path d="M3 21l8-8"/><path d="M21 16v5h-5"/><path d="m21 21-4-4"/><path d="M3 8V3h5"/><path d="m3 3 4 4"/></svg>全部换一组</button>'
    + '<span id="count"></span></div>';
  $("#poseRange").onchange = function (e) { COMBO.poseSeries = +e.target.value; comboReroll("pose"); };
  $("#costRange").onchange = function (e) { COMBO.costumeCat = +e.target.value; comboReroll("costume"); };
  $("#rerollAll").onclick = function () { comboAll("user"); };
  $("#count").textContent = "已随机一组 · 每格可单独换";

  var x = comboParts();
  function slot(lib, title, base, desc, ratio, src) {
    return '<div class="slot"><div class="slot-h"><span>' + title + '</span><button data-reroll="' + lib + '"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>换一个</button></div>'
      + '<div class="ph ' + ratio + '" data-open="' + lib + '"><img loading="lazy" src="' + (src || thumb(lib, base)) + '" alt="">'
      + '<div class="badge">' + base + "</div></div>"
      + '<div class="slot-m"><b>' + esc(desc) + "</b></div></div>";
  }
  var html = slot("face", "① 脸", x.f.id, x.fDesc, "r45")
    + slot("costume", "② 服装", x.c.id, x.cCat + " · " + x.c.zh.slice(0, 4).join(" "), "r23")
    + slot("pose", "③ 姿势" + (REF_MODE === "depth" ? " · depth" : ""), x.pBase, x.p.zh + " · " + x.p.cat, "r34", REF_MODE === "depth" ? x.urls.pose : "");

  var modeSeg = '<div class="seg" id="modeSeg">'
    + '<button data-mode="links"' + (COMBO_MODE === "links" ? ' class="on"' : "") + ">参考图 = 链接</button>"
    + '<button data-mode="single"' + (COMBO_MODE === "single" ? ' class="on"' : "") + ">参考图 = 一张三联图</button></div>";

  html += '<div class="prompt"><div class="prompt-h"><b>提示词'
    + '<span class="prompt-hint">' + (COMBO_MODE === "single"
      ? "单图模式：先「下载三联图」，把这张图随提示词一起发给模型"
      : "链接模式：已写明「先取图再生成」，并附 curl 取图命令") + "</span></b>"
    + '<div class="prompt-btns">' + modeSeg
    + (COMBO_MODE === "links" ? '<button class="primary" id="copyZh">复制中文提示词</button>' : '<button id="copyZh">复制中文提示词</button>')
    + '<button id="copyEn">复制英文提示词</button>'
    + (COMBO_MODE === "links"
      ? '<button id="copyUrls">复制取图命令</button>'
      : '<button class="primary" id="sheetSave">下载三联图</button><button id="sheetCopy">复制三联图</button>')
    + "</div></div>"
    + '<textarea id="promptText" readonly></textarea>'
    + '<div class="prompt-links"><span>原图：</span>'
    + '<a href="' + x.urls.face + '" target="_blank" rel="noopener">脸</a>'
    + '<a href="' + x.urls.costume + '" target="_blank" rel="noopener">服装</a>'
    + '<a href="' + x.urls.pose + '" target="_blank" rel="noopener">姿势</a></div></div>';

  $("#grid").className = "combo";
  $("#grid").innerHTML = html;
  $("#promptText").value = promptZh();
  optimizeFirstScreen();

  /* 点提示词框 = 全选并复制：很多人第一反应是点它，之前点了没反应（无效点击） */
  var pt = $("#promptText");
  if (pt) {
    pt.onclick = function () {
      this.select();
      var text = this.value;
      trackEvent("copy", { label: "prompt_box_click", lib: "combo" });
      var ok = function () { flash("已复制提示词"); };
      var fail = function () { flash("已全选，按 Ctrl/⌘+C 复制"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok).catch(function () { fallbackCopy(text, ok, fail); });
      } else {
        fallbackCopy(text, ok, fail);
      }
    };
  }

  $("#grid").querySelectorAll("[data-reroll]").forEach(function (b) {
    b.onclick = function () { comboReroll(b.dataset.reroll); };
  });
  $("#grid").querySelectorAll("[data-open]").forEach(function (el) {
    el.onclick = function () {
      if (el.dataset.open === "face") openFace(COMBO.face.id);
      else if (el.dataset.open === "costume") openCostume(COMBO.costume.id);
      else openPose(COMBO.pose.key, Object.prototype.hasOwnProperty.call(COMBO.pose.ang, COMBO_ANGLE) ? COMBO_ANGLE : "正面");
    };
  });
  $("#grid").querySelectorAll("[data-mode]").forEach(function (b) {
    b.onclick = function () { COMBO_MODE = b.dataset.mode; trackEvent("combo_mode", { mode: b.dataset.mode }); renderCombo(); };
  });
  $("#copyZh").onclick = function () { copyBtnText(this, promptZh(), "复制中文提示词"); };
  $("#copyEn").onclick = function () { copyBtnText(this, promptEn(), "复制英文提示词"); };
  if ($("#copyUrls")) $("#copyUrls").onclick = function () { copyBtnText(this, comboUrls(), "复制取图命令"); };
  if ($("#sheetSave")) $("#sheetSave").onclick = function () { downloadSheet(this); };
  if ($("#sheetCopy")) $("#sheetCopy").onclick = function () { copySheet(this); };
}

/* ---------- 主切换 ---------- */
function switchLib(lib, opts) {
  S.lib = lib; S.q = "";
  SHOWN = PER_PAGE;
  trackEvent("lib_view", { lib: lib });
  document.querySelectorAll(".nav button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.lib === lib);
  });
  if (lib === "combo") {
    $("#toolbar").innerHTML = '<div class="loading">正在载入三套素材（约 0.7 MB，首次约 1–3 秒）…</div>';
    $("#grid").className = "grid";
    $("#grid").innerHTML = "";
    loadAll().then(function () {
      if (!COMBO.face) comboAll("init");
      else if (opts && opts.reroll) comboAll("user");   // 点导航「随机组合」= 重新抽一组
      else renderCombo();
    }).catch(function (err) {
      $("#toolbar").innerHTML = '<div class="empty">' + esc(err.message) + "</div>";
    });
    return;
  }
  loadLib(lib).then(function () {
    render();
  }).catch(function (err) {
    $("#toolbar").innerHTML = '<div class="empty">' + esc(err.message) + "<br>请确认 data/ 目录与 index.html 在同一层，并用浏览器直接打开（file:// 或 http）。</div>";
    $("#grid").innerHTML = "";
  });
}

document.querySelectorAll(".nav button").forEach(function (b) {
  b.onclick = function () {
    switchLib(b.dataset.lib, { reroll: b.dataset.lib === "combo" });
  };
});
function randomOpen() {
  if (S.lib === "combo") { if (COMBO.face) comboAll("user"); return; }
  if (!cache[S.lib]) return;
  var list;
  if (S.lib === "face") list = data("face").items.filter(faceMatch);
  else if (S.lib === "pose") list = data("pose").poses.filter(poseMatch);
  else list = data("costume").items.filter(costumeMatch);
  if (!list.length) return;
  var x = list[Math.floor(Math.random() * list.length)];
  if (S.lib === "face") openFace(x.id);
  else if (S.lib === "pose") openPose(x.key, "正面");
  else openCostume(x.id);
}
document.addEventListener("click", function (e) {
  if (e.target && e.target.id === "rnd2") randomOpen();
  if (e.target && e.target.id === "mdl") {
    trackEvent("original_download", { lib: curLib || S.lib, id: cur ? (cur.id || cur.key) : "" });
  }
});

/* ---------- 悬浮面板（使用说明 / 赞赏）：hover 展开，点击兜底 ---------- */
(function () {
  var pairs = [["tipsHover", "tipsTrigger"], ["gratHover", "gratTrigger"], ["panHover", "panTrigger"]];
  var wraps = [];
  pairs.forEach(function (pair) {
    var wrap = document.getElementById(pair[0]);
    var btn = document.getElementById(pair[1]);
    if (!wrap || !btn) return;
    wraps.push(wrap);
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = !wrap.classList.contains("open");
      wraps.forEach(function (w) { w.classList.remove("open"); });
      wrap.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
  document.addEventListener("click", function (e) {
    if (!wraps.some(function (w) { return w.contains(e.target); })) {
      wraps.forEach(function (w) { w.classList.remove("open"); });
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") wraps.forEach(function (w) { w.classList.remove("open"); });
  });
})();

/* ---------- 首次访问的赞赏提示：9s 后自动展开一次，8s 后自动收起 ---------- */
(function () {
  try {
    var grat = document.getElementById("gratHover");
    var gbtn = document.getElementById("gratTrigger");
    if (!grat || !gbtn) return;
    if (window.localStorage.getItem("gratNudge")) return;
    window.localStorage.setItem("gratNudge", "1");
    setTimeout(function () {
      if (grat.matches(":hover") || grat.classList.contains("open")) return;
      grat.classList.add("open");
      gbtn.setAttribute("aria-expanded", "true");
      setTimeout(function () {
        if (!grat.matches(":hover")) {
          grat.classList.remove("open");
          gbtn.setAttribute("aria-expanded", "false");
        }
      }, 8000);
    }, 9000);
  } catch (e) { }
})();

/* ---------- 全局参考图形式（线稿 / depth） ---------- */
function renderPanTop() {
  var cfg = window.PAN_LINKS || {};
  var defs = [
    { key: "face", name: "脸库", count: "1,499 张" },
    { key: "pose", name: "姿势库", count: "1,439 张" },
    { key: "costume", name: "服装库", count: "1,407 套" }
  ];
  var html = defs.map(function (d) {
    var item = cfg[d.key] || {};
    var links = "";
    if (item.baidu) links += '<a href="' + item.baidu + '" target="_blank" rel="sponsored noopener" data-pan="' + d.key + '_baidu">百度网盘</a>';
    if (item.quark) links += '<a href="' + item.quark + '" target="_blank" rel="sponsored noopener" data-pan="' + d.key + '_quark">夸克</a>';
    if (!links) return "";
    return '<div class="pantop-row"><span class="pantop-name">' + d.name + '<em>' + d.count + '</em></span><span class="pantop-links">' + links + "</span></div>";
  }).join("");
  var box = document.getElementById("panRows");
  if (!box) return;
  box.innerHTML = html || '<p class="pantop-note">暂无网盘链接</p>';
}

renderPanTop();

document.querySelectorAll("#refModeSeg button").forEach(function (b) {
  b.onclick = function () { setRefMode(b.dataset.mode); };
});
syncModeUI();

/* ---------- 姊妹站点击埋点（同域，Clarity 的「出站点击」抓不到，保留手动埋点） ---------- */
(function () {
  var link = document.getElementById("sisterLink");
  if (link) link.addEventListener("click", function () { trackEvent("ref_click", { source: "sister_top" }); });
})();

switchLib("combo");
})();
