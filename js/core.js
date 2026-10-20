/* ============ 柠檬秀秀 - 核心：状态 / 渲染管线 / 像素算法 / 历史 ============ */
(function (C) {
  const U = NX.util;
  const MAX_SIDE = 2500;          // 工作分辨率上限（手机内存友好）
  const MAX_HISTORY = 25;

  const canvas = U.$('#canvas');
  const ctx = canvas.getContext('2d');
  C.canvas = canvas;
  C.ctx = ctx;
  C.filterSupported = (typeof ctx.filter === 'string');

  C.state = {
    base: null,        // 已提交的像素（offscreen canvas）
    orig: null,        // 原图（用于"原图"重置）
    overlays: [],      // 文字/贴纸对象（未烘焙）
    adjust: null,      // 当前调节参数（见 defaultAdjust）
    filterName: 'none',
    hsl: null,         // HSL 分色调整
    tool: null,
    history: [],
    hIndex: -1,
    busy: false,
  };

  C.defaultAdjust = () => ({
    brightness: 0, contrast: 0, saturate: 0, temp: 0, hue: 0,
    sharpen: 0, clarity: 0, noise: 0, vignette: 0, fade: 0,
    highlight: 0, shadow: 0, tint: 0,
  });
  C.defaultHSL = () => ({ red: [0,0,0], orange: [0,0,0], yellow: [0,0,0], green: [0,0,0],
    cyan: [0,0,0], blue: [0,0,0], purple: [0,0,0], magenta: [0,0,0] });
  C.state.adjust = C.defaultAdjust();
  C.state.hsl = C.defaultHSL();

  /* ---------------- 滤镜库 ---------------- */
  // recipe: CSS filter 片段（用于预览与烘焙）；tint: 叠加色；vig: 暗角强度
  C.FILTERS = {
    none:   { name: '原图',   css: '' },
    fresh:  { name: '清新',   css: 'brightness(1.08) saturate(1.18) contrast(1.03)' },
    lemon:  { name: '柠檬黄', css: 'brightness(1.06) saturate(1.35) sepia(0.28) hue-rotate(-12deg)' },
    sunny:  { name: '暖阳',   css: 'brightness(1.05) saturate(1.25) sepia(0.32)' },
    retro:  { name: '复古',   css: 'sepia(0.55) contrast(0.92) brightness(0.97)' },
    film:   { name: '胶片',   css: 'contrast(1.12) saturate(0.82) sepia(0.15)', noise: 18 },
    lomo:   { name: 'LOMO',   css: 'contrast(1.3) saturate(1.45)', vig: 0.45 },
    bw:     { name: '黑白',   css: 'grayscale(1) contrast(1.08)' },
    silver: { name: '银盐',   css: 'grayscale(1) contrast(1.25) brightness(1.05)' },
    cool:   { name: '冷调',   css: 'saturate(0.92) brightness(1.03)', tint: ['#3D7BFF', 0.16] },
    peach:  { name: '蜜桃',   css: 'brightness(1.07) saturate(1.12) hue-rotate(-6deg)', tint: ['#FF9D7E', 0.12] },
    mint:   { name: '薄荷',   css: 'brightness(1.06) saturate(1.05)', tint: ['#5FD4A4', 0.14] },
    dream:  { name: '梦幻',   css: 'brightness(1.1) contrast(0.88) saturate(1.12) blur(0.6px)' },
    japan:  { name: '日系',   css: 'brightness(1.1) contrast(0.92) saturate(0.85) sepia(0.1)' },
    drama:  { name: '电影感', css: 'contrast(1.18) saturate(1.1) brightness(0.96) sepia(0.12)', vig: 0.3 },
    vivid:  { name: '鲜艳',   css: 'saturate(1.6) contrast(1.1)' },
  };

  /* ---------------- 载入 / 设置图片 ---------------- */
  C.setImage = function (img, pushHist) {
    let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const c = U.makeCanvas(w, h);
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    C.state.base = c;
    C.state.orig = U.cloneCanvas(c);
    C.state.overlays = [];
    C.state.adjust = C.defaultAdjust();
    C.state.hsl = C.defaultHSL();
    C.state.filterName = 'none';
    C.state.history = [];
    C.state.hIndex = -1;
    C.pushHistory();
    C.onImageReady();
  };

  C.onImageReady = function () {
    U.$('#dropzone').style.display = 'none';
    canvas.hidden = false;
    ['btnSave', 'btnUndo', 'btnRedo', 'btnReset'].forEach(id => U.$('#' + id).disabled = false);
    C.render();
    if (NX.main && NX.main.refreshPanel) NX.main.refreshPanel();
    U.toast('图片已加载 ' + C.state.base.width + '×' + C.state.base.height);
  };

  /* ---------------- 历史 ---------------- */
  C.pushHistory = function () {
    const s = C.state;
    s.history = s.history.slice(0, s.hIndex + 1);
    s.history.push({
      img: s.base.toDataURL('image/jpeg', 0.85),
      overlays: JSON.stringify(s.overlays),
      adjust: JSON.stringify(s.adjust),
      hsl: JSON.stringify(s.hsl),
      filterName: s.filterName,
    });
    if (s.history.length > MAX_HISTORY) s.history.shift();
    s.hIndex = s.history.length - 1;
    C.updateUndoBtns();
  };

  C.restore = function (idx) {
    const s = C.state;
    if (idx < 0 || idx >= s.history.length) return;
    s.hIndex = idx;
    const h = s.history[idx];
    const img = new Image();
    img.onload = () => {
      const c = U.makeCanvas(img.width, img.height);
      c.getContext('2d').drawImage(img, 0, 0);
      s.base = c;
      s.overlays = JSON.parse(h.overlays);
      s.adjust = JSON.parse(h.adjust);
      s.hsl = JSON.parse(h.hsl);
      s.filterName = h.filterName;
      C.render();
      if (NX.main && NX.main.refreshPanel) NX.main.refreshPanel();
    };
    img.src = h.img;
    C.updateUndoBtns();
  };

  C.undo = () => { if (C.state.hIndex > 0) C.restore(C.state.hIndex - 1); };
  C.redo = () => { if (C.state.hIndex < C.state.history.length - 1) C.restore(C.state.hIndex + 1); };
  C.updateUndoBtns = function () {
    U.$('#btnUndo').disabled = C.state.hIndex <= 0;
    U.$('#btnRedo').disabled = C.state.hIndex >= C.state.history.length - 1;
  };

  C.resetToOrig = function () {
    if (!C.state.orig) return;
    C.state.base = U.cloneCanvas(C.state.orig);
    C.state.overlays = [];
    C.state.adjust = C.defaultAdjust();
    C.state.hsl = C.defaultHSL();
    C.state.filterName = 'none';
    C.pushHistory();
    C.render();
    U.toast('已恢复原图');
  };

  /* ---------------- 滤镜/调节 → CSS filter 字符串 ---------------- */
  C.buildFilterCSS = function () {
    const a = C.state.adjust, f = C.FILTERS[C.state.filterName] || C.FILTERS.none;
    const parts = [];
    if (f.css) parts.push(f.css);
    if (a.brightness) parts.push(`brightness(${(100 + a.brightness) / 100})`);
    if (a.contrast) parts.push(`contrast(${(100 + a.contrast) / 100})`);
    if (a.saturate) parts.push(`saturate(${Math.max(0, (100 + a.saturate)) / 100})`);
    if (a.hue) parts.push(`hue-rotate(${a.hue}deg)`);
    if (a.temp > 0) parts.push(`sepia(${a.temp / 220})`);
    if (a.temp < 0) parts.push(`hue-rotate(${a.temp / 6}deg)`); // 冷调近似
    return parts.join(' ');
  };

  /* ---------------- 渲染 ---------------- */
  // 将 base + 滤镜调节 + 覆盖物 合成到显示画布
  C.render = function () {
    const s = C.state;
    if (!s.base) return;
    const w = s.base.width, h = s.base.height;
    canvas.width = w; canvas.height = h;

    ctx.save();
    if (C.filterSupported) ctx.filter = C.buildFilterCSS() || 'none';
    ctx.drawImage(s.base, 0, 0);
    ctx.restore();

    // 无 ctx.filter 环境的降级：CSS 预览仅影响显示（烘焙时用像素算法）
    if (!C.filterSupported) canvas.style.filter = C.buildFilterCSS() || 'none';
    else canvas.style.filter = 'none';

    // 色温冷调叠加 & 滤镜 tint
    const f = C.FILTERS[s.filterName] || {};
    if (f.tint) C.applyTint(ctx, w, h, f.tint[0], f.tint[1]);
    if (s.adjust.temp < 0) C.applyTint(ctx, w, h, '#3D7BFF', -s.adjust.temp / 600);

    // 暗角（滤镜自带 + 调节）
    const vig = (f.vig || 0) + s.adjust.vignette / 100;
    if (vig > 0.01) C.drawVignette(ctx, w, h, Math.min(1, vig));

    // 覆盖物（文字/贴纸）
    for (const o of s.overlays) C.drawOverlay(ctx, o);

    // 工具自己的可视化层（裁剪框、mask 等）
    const t = NX.tools[s.tool];
    if (t && t.draw) t.draw(ctx);
  };

  C.applyTint = function (c, w, h, color, alpha) {
    c.save();
    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = U.clamp(alpha, 0, 1);
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);
    c.restore();
  };

  C.drawVignette = function (c, w, h, strength) {
    const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.75 * strength})`);
    c.save(); c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
  };

  /* ---------------- 覆盖物（文字 / 贴纸） ---------------- */
  C.drawOverlay = function (c, o, selected) {
    c.save();
    c.translate(o.x, o.y);
    if (o.rotation) c.rotate(o.rotation);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (o.type === 'text') {
      c.font = `${o.bold ? 'bold ' : ''}${o.italic ? 'italic ' : ''}${o.size}px ${o.font || '"PingFang SC", sans-serif'}`;
      if (o.shadow) { c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = o.size / 8; c.shadowOffsetY = 2; }
      if (o.stroke) { c.lineWidth = Math.max(2, o.size / 10); c.strokeStyle = o.strokeColor || '#fff'; c.strokeText(o.text, 0, 0); }
      c.fillStyle = o.color;
      c.fillText(o.text, 0, 0);
    } else if (o.type === 'sticker') {
      c.font = `${o.size}px "Apple Color Emoji", sans-serif`;
      c.fillText(o.emoji, 0, 0);
    }
    c.restore();
    if (selected) {
      c.save();
      c.strokeStyle = '#F5B800'; c.setLineDash([6, 4]); c.lineWidth = 2;
      const hw = (o.width || o.size * (o.type === 'text' ? o.text.length * 0.6 : 1)) / 2 + 8;
      const hh = o.size / 2 + 8;
      c.strokeRect(o.x - hw, o.y - hh, hw * 2, hh * 2);
      c.restore();
    }
  };

  C.overlayHalfSize = function (o) {
    if (o.type === 'sticker') return { hw: o.size / 2 + 6, hh: o.size / 2 + 6 };
    const w = (o.width || o.size * Math.max(1, o.text.length) * 0.62);
    return { hw: w / 2 + 6, hh: o.size / 2 + 6 };
  };

  C.measureOverlay = function (o) {
    const m = U.makeCanvas(4, 4).getContext('2d');
    m.font = `${o.bold ? 'bold ' : ''}${o.size}px ${o.font || 'sans-serif'}`;
    o.width = m.measureText(o.text || o.emoji || '').width;
  };

  // 把覆盖物烘焙进 base（裁剪/导出/部分工具前调用）
  C.flattenOverlays = function () {
    const s = C.state;
    if (!s.overlays.length) return;
    const c = s.base.getContext('2d');
    for (const o of s.overlays) C.drawOverlay(c, o);
    s.overlays = [];
  };

  /* ---------------- 烘焙：滤镜+调节 → base ---------------- */
  // 全量应用（像素级），返回新 canvas
  C.bakeIntoBase = function () {
    const s = C.state;
    C.flattenOverlays();
    const css = C.buildFilterCSS();
    const f = C.FILTERS[s.filterName] || {};
    let out;

    if (C.filterSupported && css) {
      out = U.makeCanvas(s.base.width, s.base.height);
      const octx = out.getContext('2d');
      octx.filter = css;
      octx.drawImage(s.base, 0, 0);
    } else if (css) {
      out = U.cloneCanvas(s.base);
      NX.pixels.applyFilterFallback(out, s);
    } else {
      out = U.cloneCanvas(s.base);
    }
    const octx = out.getContext('2d');
    if (f.tint) C.applyTint(octx, out.width, out.height, f.tint[0], f.tint[1]);
    if (s.adjust.temp < 0) C.applyTint(octx, out.width, out.height, '#3D7BFF', -s.adjust.temp / 600);

    // 像素级调节：HSL / 锐化 / 清晰度 / 颗粒 / 高光阴影 / 褪色 / 色调
    NX.pixels.applyPixelAdjust(out, s.adjust, s.hsl);
    if (f.noise) NX.pixels.addNoise(out, f.noise);

    const vig = (f.vig || 0) + s.adjust.vignette / 100;
    if (vig > 0.01) C.drawVignette(octx, out.width, out.height, Math.min(1, vig));

    s.base = out;
    s.adjust = C.defaultAdjust();
    s.hsl = C.defaultHSL();
    s.filterName = 'none';
  };

  C.commitAdjustments = function () {
    const s = C.state;
    const dirty = s.filterName !== 'none' ||
      Object.values(s.adjust).some(v => v !== 0) ||
      Object.values(s.hsl).some(ch => ch.some(v => v !== 0));
    if (!dirty) return;
    C.bakeIntoBase();
    C.pushHistory();
    C.render();
    U.toast('已应用');
  };

  /* ---------------- 导出 ---------------- */
  C.exportImage = function (format, quality) {
    const s = C.state;
    if (!s.base) return;
    const out = U.makeCanvas(s.base.width, s.base.height);
    const octx = out.getContext('2d');
    const css = C.buildFilterCSS();
    if (C.filterSupported && css) octx.filter = css;
    octx.drawImage(s.base, 0, 0);
    if (!C.filterSupported && css) NX.pixels.applyFilterFallback(out, s);
    const f = C.FILTERS[s.filterName] || {};
    if (f.tint) C.applyTint(octx, out.width, out.height, f.tint[0], f.tint[1]);
    if (s.adjust.temp < 0) C.applyTint(octx, out.width, out.height, '#3D7BFF', -s.adjust.temp / 600);
    NX.pixels.applyPixelAdjust(out, s.adjust, s.hsl);
    if (f.noise) NX.pixels.addNoise(out, f.noise);
    const vig = (f.vig || 0) + s.adjust.vignette / 100;
    if (vig > 0.01) C.drawVignette(octx, out.width, out.height, Math.min(1, vig));
    for (const o of s.overlays) C.drawOverlay(octx, o);
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    U.downloadCanvas(out, `ningmeng_${Date.now()}.${format === 'jpg' ? 'jpg' : 'png'}`, mime, quality);
    U.toast('已导出 🍋');
  };

  /* ---------------- 坐标映射 & 指针调度 ---------------- */
  C.toImageCoords = function (e) {
    const r = canvas.getBoundingClientRect();
    const cx = (e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX));
    const cy = (e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY));
    return {
      x: (cx - r.left) * (canvas.width / r.width),
      y: (cy - r.top) * (canvas.height / r.height),
    };
  };

  let dragging = false;
  function dispatch(name, e) {
    const t = NX.tools[C.state.tool];
    if (!t || !t[name] || !C.state.base || C.state.busy) return;
    e.preventDefault();
    t[name](C.toImageCoords(e), e);
  }
  canvas.addEventListener('pointerdown', e => {
    if (!C.state.base) return;
    canvas.setPointerCapture(e.pointerId);
    dragging = true;
    dispatch('onDown', e);
  });
  canvas.addEventListener('pointermove', e => { if (dragging) dispatch('onMove', e); else dispatch('onHover', e); });
  canvas.addEventListener('pointerup', e => { if (dragging) { dragging = false; dispatch('onUp', e); } });
  canvas.addEventListener('dblclick', e => dispatch('onDblClick', e));

  /* ---------------- 文件载入入口 ---------------- */
  C.openFiles = function (files) {
    const file = files && files[0];
    if (!file) return;
    U.loadImageFromFile(file)
      .then(img => C.setImage(img))
      .catch(err => U.toast('打开失败: ' + U.fmtErr(err)));
  };

  U.$('#fileInput').addEventListener('change', e => { C.openFiles(e.target.files); e.target.value = ''; });
  U.$('#btnOpen').addEventListener('click', () => U.$('#fileInput').click());
  U.$('#dropzone').addEventListener('click', () => U.$('#fileInput').click());
  U.$('#btnSave').addEventListener('click', () => {
    const s = C.state; if (!s.base) return;
    C.exportImage('png');
  });
  U.$('#btnUndo').addEventListener('click', C.undo);
  U.$('#btnRedo').addEventListener('click', C.redo);
  U.$('#btnReset').addEventListener('click', C.resetToOrig);

  const stage = U.$('#stage');
  ['dragover', 'dragenter'].forEach(ev => stage.addEventListener(ev, e => { e.preventDefault(); U.$('#dropzone').classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => stage.addEventListener(ev, e => { e.preventDefault(); U.$('#dropzone').classList.remove('over'); }));
  stage.addEventListener('drop', e => C.openFiles(e.dataTransfer.files));
})(window.NX.core = {});
