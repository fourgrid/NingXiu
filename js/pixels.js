/* ============ 柠檬秀秀 - 像素算法库 ============ */
(function (P) {
  const U = NX.util;
  const clamp = U.clamp;

  /* ---- 无 ctx.filter 时的降级：手动实现常用滤镜原语 ---- */
  P.applyFilterFallback = function (canvas, s) {
    const a = s.adjust, f = NX.core.FILTERS[s.filterName] || {};
    const id = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    // 解析 CSS 片段中的数值（滤镜 recipe + 调节合并为总系数）
    let bright = 1, contrast = 1, sat = 1, sepia = 0, gray = 0, hue = 0;
    const parse = (css) => {
      if (!css) return;
      let m;
      if (m = css.match(/brightness\(([\d.]+)\)/)) bright *= parseFloat(m[1]);
      if (m = css.match(/contrast\(([\d.]+)\)/)) contrast *= parseFloat(m[1]);
      if (m = m = css.match(/saturate\(([\d.]+)\)/)) sat *= parseFloat(m[1]);
      if (m = css.match(/sepia\(([\d.]+)\)/)) sepia = Math.min(1, sepia + parseFloat(m[1]));
      if (m = css.match(/grayscale\(([\d.]+)\)/)) gray = Math.min(1, gray + parseFloat(m[1]));
      if (m = css.match(/hue-rotate\((-?[\d.]+)deg\)/)) hue += parseFloat(m[1]);
    };
    parse(f.css);
    if (a.brightness) bright *= (100 + a.brightness) / 100;
    if (a.contrast) contrast *= (100 + a.contrast) / 100;
    if (a.saturate) sat *= Math.max(0, (100 + a.saturate)) / 100;
    if (a.hue) hue += a.hue;
    if (a.temp > 0) sepia = Math.min(1, sepia + a.temp / 220);
    if (a.temp < 0) hue += a.temp / 6;

    const cosH = Math.cos(hue * Math.PI / 180), sinH = Math.sin(hue * Math.PI / 180);
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      // hue rotate（近似矩阵）
      if (hue) {
        const nr = (0.213 + cosH * 0.787 - sinH * 0.213) * r + (0.715 - cosH * 0.715 - sinH * 0.715) * g + (0.072 - cosH * 0.072 + sinH * 0.928) * b;
        const ng = (0.213 - cosH * 0.213 + sinH * 0.143) * r + (0.715 + cosH * 0.285 + sinH * 0.140) * g + (0.072 - cosH * 0.072 - sinH * 0.283) * b;
        const nb = (0.213 - cosH * 0.213 - sinH * 0.787) * r + (0.715 - cosH * 0.715 + sinH * 0.715) * g + (0.072 + cosH * 0.928 + sinH * 0.072) * b;
        r = nr; g = ng; b = nb;
      }
      // saturate
      if (sat !== 1) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      }
      // grayscale
      if (gray) { const l = 0.299 * r + 0.587 * g + 0.114 * b; r += (l - r) * gray; g += (l - g) * gray; b += (l - b) * gray; }
      // sepia
      if (sepia) {
        const sr = r * 0.393 + g * 0.769 + b * 0.189, sg = r * 0.349 + g * 0.686 + b * 0.168, sb = r * 0.272 + g * 0.534 + b * 0.131;
        r += (sr - r) * sepia; g += (sg - g) * sepia; b += (sb - b) * sepia;
      }
      // brightness / contrast
      r = (r - 128) * contrast + 128; g = (g - 128) * contrast + 128; b = (b - 128) * contrast + 128;
      d[i] = clamp(r * bright, 0, 255); d[i + 1] = clamp(g * bright, 0, 255); d[i + 2] = clamp(b * bright, 0, 255);
    }
    canvas.getContext('2d').putImageData(id, 0, 0);
  };

  /* ---- 像素级调节（烘焙时执行） ---- */
  P.applyPixelAdjust = function (canvas, a, hsl) {
    const needHSL = hsl && Object.values(hsl).some(ch => ch.some(v => v !== 0));
    if (a.sharpen) P.sharpen(canvas, a.sharpen / 100);
    if (a.clarity) P.clarity(canvas, a.clarity / 100);
    if (a.highlight || a.shadow) P.highlightsShadows(canvas, a.highlight / 100, a.shadow / 100);
    if (a.fade) P.fade(canvas, a.fade / 100);
    if (a.tint) P.splitTint(canvas, a.tint / 100);
    if (needHSL) P.hslAdjust(canvas, hsl);
    if (a.noise) P.addNoise(canvas, a.noise);
  };

  P.convolve3 = function (canvas, kernel, mix) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);
    const s = src.data, o = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const px = clamp(x + kx, 0, w - 1), py = clamp(y + ky, 0, h - 1);
            const idx = (py * w + px) * 4, kv = kernel[(ky + 1) * 3 + (kx + 1)];
            r += s[idx] * kv; g += s[idx + 1] * kv; b += s[idx + 2] * kv;
          }
        }
        const i = (y * w + x) * 4;
        o[i] = clamp(s[i] + (r - s[i]) * mix, 0, 255);
        o[i + 1] = clamp(s[i + 1] + (g - s[i + 1]) * mix, 0, 255);
        o[i + 2] = clamp(s[i + 2] + (b - s[i + 2]) * mix, 0, 255);
        o[i + 3] = s[i + 3];
      }
    }
    ctx.putImageData(out, 0, 0);
  };

  P.sharpen = function (canvas, amt) {
    P.convolve3(canvas, [0, -1, 0, -1, 5, -1, 0, -1, 0], clamp(amt, 0, 1));
  };

  // 清晰度 ≈ 高反差保留叠加（简化为更强锐化 + 微对比）
  P.clarity = function (canvas, amt) {
    amt = clamp(amt, -1, 1);
    if (amt > 0) P.convolve3(canvas, [0, -0.5, 0, -0.5, 3, -0.5, 0, -0.5, 0], amt * 0.6);
    else P.convolve3(canvas, [1/9,1/9,1/9,1/9,1/9,1/9,1/9,1/9,1/9], -amt * 0.7);
  };

  P.highlightsShadows = function (canvas, hi, sh) {
    const ctx = canvas.getContext('2d');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      let f = 0;
      if (l > 0.5) f = hi * (l - 0.5) * 2 * 40;       // 高光
      else f = sh * (0.5 - l) * 2 * 40;               // 阴影
      d[i] = clamp(d[i] + f, 0, 255);
      d[i + 1] = clamp(d[i + 1] + f, 0, 255);
      d[i + 2] = clamp(d[i + 2] + f, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
  };

  P.fade = function (canvas, amt) {
    const ctx = canvas.getContext('2d');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v = d[i + c] / 255;
        d[i + c] = clamp((v * (1 - amt * 0.5) + amt * 0.12) * 255, 0, 255);
      }
    }
    ctx.putImageData(id, 0, 0);
  };

  // 色调分离倾向：正值偏绿-品红轴（简化）
  P.splitTint = function (canvas, amt) {
    const ctx = canvas.getContext('2d');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(d[i] - amt * 18, 0, 255);
      d[i + 1] = clamp(d[i + 1] + amt * 10, 0, 255);
      d[i + 2] = clamp(d[i + 2] - amt * 18, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
  };

  /* ---- HSL 分色 ---- */
  const HSL_RANGES = {
    red: [[345, 360], [0, 15]], orange: [[15, 45]], yellow: [[45, 75]],
    green: [[75, 155]], cyan: [[155, 195]], blue: [[195, 255]],
    purple: [[255, 295]], magenta: [[295, 345]],
  };
  P.hslAdjust = function (canvas, hsl) {
    const ctx = canvas.getContext('2d');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h = 0, s = 0;
      if (max !== min) {
        const dl = max - min;
        s = l > 0.5 ? dl / (2 - max - min) : dl / (max + min);
        if (max === r) h = ((g - b) / dl + (g < b ? 6 : 0)) * 60;
        else if (max === g) h = ((b - r) / dl + 2) * 60;
        else h = ((r - g) / dl + 4) * 60;
      }
      for (const key in HSL_RANGES) {
        const adj = hsl[key];
        if (!adj || (!adj[0] && !adj[1] && !adj[2])) continue;
        const inRange = HSL_RANGES[key].some(([a, b2]) => h >= a && h <= b2);
        if (!inRange) continue;
        h = (h + adj[0] + 360) % 360;
        s = clamp(s * (1 + adj[1] / 100), 0, 1);
        // l 调整放到最后
        const [nr, ng, nb] = P.hslToRgb(h, s, clamp(l + adj[2] / 200, 0, 1));
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
        break;
      }
    }
    ctx.putImageData(id, 0, 0);
  };

  P.hslToRgb = function (h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  };

  P.addNoise = function (canvas, amount) {
    const ctx = canvas.getContext('2d');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount * 2.5;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
  };

  /* ---- 美容算法 ---- */
  // 快速盒式模糊（3 次近似高斯）
  P.boxBlur = function (canvas, radius) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const tmp = new Uint8ClampedArray(d.length);
    for (let pass = 0; pass < 3; pass++) {
      // 水平
      for (let y = 0; y < h; y++) {
        let r = 0, g = 0, b = 0, a = 0;
        const row = y * w;
        for (let x = -radius; x <= radius; x++) {
          const i = (row + clamp(x, 0, w - 1)) * 4;
          r += d[i]; g += d[i + 1]; b += d[i + 2]; a += d[i + 3];
        }
        const n = radius * 2 + 1;
        for (let x = 0; x < w; x++) {
          const o = (row + x) * 4;
          tmp[o] = r / n; tmp[o + 1] = g / n; tmp[o + 2] = b / n; tmp[o + 3] = a / n;
          const iAdd = (row + clamp(x + radius + 1, 0, w - 1)) * 4;
          const iSub = (row + clamp(x - radius, 0, w - 1)) * 4;
          r += d[iAdd] - d[iSub]; g += d[iAdd + 1] - d[iSub + 1];
          b += d[iAdd + 2] - d[iSub + 2]; a += d[iAdd + 3] - d[iSub + 3];
        }
      }
      // 垂直
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let y = -radius; y <= radius; y++) {
          const i = (clamp(y, 0, h - 1) * w + x) * 4;
          r += tmp[i]; g += tmp[i + 1]; b += tmp[i + 2]; a += tmp[i + 3];
        }
        const n = radius * 2 + 1;
        for (let y = 0; y < h; y++) {
          const o = (y * w + x) * 4;
          d[o] = r / n; d[o + 1] = g / n; d[o + 2] = b / n; d[o + 3] = a / n;
          const iAdd = (clamp(y + radius + 1, 0, h - 1) * w + x) * 4;
          const iSub = (clamp(y - radius, 0, h - 1) * w + x) * 4;
          r += tmp[iAdd] - tmp[iSub]; g += tmp[iAdd + 1] - tmp[iSub + 1];
          b += tmp[iAdd + 2] - tmp[iSub + 2]; a += tmp[iAdd + 3] - tmp[iSub + 3];
        }
      }
    }
    ctx.putImageData(id, 0, 0);
  };

  // 磨皮：保边平滑（表面模糊简化版：模糊后按色差混合）
  P.smoothSkin = function (canvas, strength) {
    strength = clamp(strength, 0, 1);
    if (strength <= 0) return;
    const blurred = U.cloneCanvas(canvas);
    P.boxBlur(blurred, Math.max(2, Math.round(canvas.width / 300)));
    const ctx = canvas.getContext('2d');
    const a = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const b = blurred.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const da = a.data, db = b.data;
    for (let i = 0; i < da.length; i += 4) {
      const diff = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
      const edge = clamp(diff / 90, 0, 1);            // 边缘保护
      const mix = strength * (1 - edge * 0.85);
      da[i] += (db[i] - da[i]) * mix;
      da[i + 1] += (db[i + 1] - da[i + 1]) * mix;
      da[i + 2] += (db[i + 2] - da[i + 2]) * mix;
    }
    ctx.putImageData(a, 0, 0);
  };

  // 美白
  P.whiten = function (canvas, strength) {
    strength = clamp(strength, 0, 1);
    if (strength <= 0) return;
    const ctx = canvas.getContext('2d');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // 主要提亮中间调，不过曝高光
      const t = 1 - Math.abs(l - 140) / 140;
      const boost = strength * 26 * clamp(t, 0, 1);
      d[i] = clamp(d[i] + boost, 0, 255);
      d[i + 1] = clamp(d[i + 1] + boost, 0, 255);
      d[i + 2] = clamp(d[i + 2] + boost, 0, 255);
      // 轻微去黄
      d[i + 2] = clamp(d[i + 2] + strength * 5, 0, 255);
    }
    ctx.putImageData(id, 0, 0);
  };

  // 亮眼（局部提锐+提饱和），p={x,y,r}
  P.brightenEyes = function (canvas, p, amt) {
    const ctx = canvas.getContext('2d');
    const r = Math.round(p.r);
    const x0 = clamp(p.x - r, 0, canvas.width), y0 = clamp(p.y - r, 0, canvas.height);
    const w = clamp(p.x + r, 0, canvas.width) - x0, h = clamp(p.y + r, 0, canvas.height) - y0;
    if (w <= 0 || h <= 0) return;
    const id = ctx.getImageData(x0, y0, w, h);
    const d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + x0 - p.x, dy = y + y0 - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) / r;
      if (dist > 1) continue;
      const fall = (1 - dist * dist) * amt;
      const i = (y * w + x) * 4;
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = clamp(d[i] + (d[i] - lum) * 0.5 * fall + 12 * fall, 0, 255);
      d[i + 1] = clamp(d[i + 1] + (d[i + 1] - lum) * 0.5 * fall + 12 * fall, 0, 255);
      d[i + 2] = clamp(d[i + 2] + (d[i + 2] - lum) * 0.5 * fall + 12 * fall, 0, 255);
    }
    ctx.putImageData(id, x0, y0);
  };

  // 局部修复（祛痘）：用周围环形区域的平均纹理填充
  P.healSpot = function (canvas, p) {
    const ctx = canvas.getContext('2d');
    const r = Math.round(p.r);
    // 取下方偏移一块作为源
    const sy = clamp(p.y + r * 2.2, 0, canvas.height - 1);
    const src = U.makeCanvas(r * 2, r * 2);
    src.getContext('2d').drawImage(canvas, p.x - r, sy - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
    P.boxBlur(src, 2);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.clip();
    // 羽化
    ctx.filter = C_filterSafe('blur(2px)');
    ctx.drawImage(src, p.x - r, p.y - r);
    ctx.restore();
    function C_filterSafe(f) { return NX.core.filterSupported ? f : 'none'; }
  };

  // 白牙：局部提亮 + 去黄去饱和，p={x,y,r}
  P.whitenTeeth = function (canvas, p, amt) {
    const ctx = canvas.getContext('2d');
    const r = Math.round(p.r);
    const x0 = clamp(p.x - r, 0, canvas.width), y0 = clamp(p.y - r, 0, canvas.height);
    const w = clamp(p.x + r, 0, canvas.width) - x0, h = clamp(p.y + r, 0, canvas.height) - y0;
    if (w <= 0 || h <= 0) return;
    const id = ctx.getImageData(x0, y0, w, h);
    const d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + x0 - p.x, dy = y + y0 - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) / r;
      if (dist > 1) continue;
      const fall = (1 - dist * dist) * amt;
      const i = (y * w + x) * 4;
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // 去黄：降红绿差；去饱和；提亮
      d[i]     = clamp(d[i]     + (l - d[i])     * 0.45 * fall + 22 * fall, 0, 255);
      d[i + 1] = clamp(d[i + 1] + (l - d[i + 1]) * 0.45 * fall + 24 * fall, 0, 255);
      d[i + 2] = clamp(d[i + 2] + (l - d[i + 2]) * 0.35 * fall + 26 * fall, 0, 255);
    }
    ctx.putImageData(id, x0, y0);
  };

  // 祛黑眼圈：局部柔化 + 温和提亮（保纹理），p={x,y,r}
  P.removeEyeCircle = function (canvas, p, amt) {
    const ctx = canvas.getContext('2d');
    const r = Math.round(p.r);
    const patch = U.makeCanvas(r * 2, r * 2);
    patch.getContext('2d').drawImage(canvas, p.x - r, p.y - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
    P.boxBlur(patch, Math.max(2, r >> 3));
    const blurD = patch.getContext('2d').getImageData(0, 0, r * 2, r * 2).data;
    const x0 = clamp(p.x - r, 0, canvas.width), y0 = clamp(p.y - r, 0, canvas.height);
    const w = clamp(p.x + r, 0, canvas.width) - x0, h = clamp(p.y + r, 0, canvas.height) - y0;
    if (w <= 0 || h <= 0) return;
    const id = ctx.getImageData(x0, y0, w, h);
    const d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + x0 - p.x, dy = y + y0 - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) / r;
      if (dist > 1) continue;
      const fall = (1 - dist * dist) * amt;
      const i = (y * w + x) * 4;
      const bi = (y * r * 2 + x) * 4;   // 注意 patch 宽高=r*2
      for (let c = 0; c < 3; c++) {
        // 只向"更亮"的方向修复：暗部提亮，亮部不动
        const target = blurD[bi + c] * 0.55 + d[i + c] * 0.45 + 14;
        if (target > d[i + c]) d[i + c] = clamp(d[i + c] + (target - d[i + c]) * fall, 0, 255);
      }
    }
    ctx.putImageData(id, x0, y0);
  };

  // 增高：y0 以下纵向拉伸 k 倍（1.0~1.35），返回新 canvas
  P.stretchBelow = function (canvas, y0, k) {
    const w = canvas.width, h = canvas.height;
    y0 = clamp(Math.round(y0), 0, h - 1);
    k = clamp(k, 1, 1.35);
    const legH = h - y0;
    const newLegH = Math.round(legH * k);
    const out = U.makeCanvas(w, y0 + newLegH);
    const ctx = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0, w, y0, 0, 0, w, y0);                 // 上半身原样
    ctx.drawImage(canvas, 0, y0, w, legH, 0, y0, w, newLegH);        // 腿拉伸
    return out;
  };

  /* ---- 液化（瘦脸/大眼/增高） ---- */
  // mode: 'push' | 'bulge'(放大) | 'pinch'(收缩)
  P.liquify = function (canvas, p, mode, dx, dy) {
    const ctx = canvas.getContext('2d');
    const r = Math.round(p.r);
    const x0 = clamp(Math.floor(p.x - r), 0, canvas.width);
    const y0 = clamp(Math.floor(p.y - r), 0, canvas.height);
    const x1 = clamp(Math.ceil(p.x + r), 0, canvas.width);
    const y1 = clamp(Math.ceil(p.y + r), 0, canvas.height);
    const w = x1 - x0, h = y1 - y0;
    if (w <= 1 || h <= 1) return;
    const src = ctx.getImageData(x0, y0, w, h);
    const out = ctx.createImageData(w, h);
    const s = src.data, o = out.data;
    const cx = p.x - x0, cy = p.y - y0;
    const strength = p.strength || 0.5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ddx = x - cx, ddy = y - cy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        let sx = x, sy = y;
        if (dist < r && dist > 0.01) {
          const t = 1 - dist / r;
          const fall = t * t * (3 - 2 * t); // smoothstep
          if (mode === 'push') {
            sx = x - dx * fall * strength;
            sy = y - dy * fall * strength;
          } else if (mode === 'bulge') {
            const k = 1 - fall * strength * 0.6;
            sx = cx + ddx * k; sy = cy + ddy * k;
          } else if (mode === 'pinch') {
            const k = 1 + fall * strength * 0.6;
            sx = cx + ddx * k; sy = cy + ddy * k;
          }
        }
        // 双线性采样
        sx = clamp(sx, 0, w - 1.001); sy = clamp(sy, 0, h - 1.001);
        const ix = Math.floor(sx), iy = Math.floor(sy);
        const fx = sx - ix, fy = sy - iy;
        const i00 = (iy * w + ix) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
        const oi = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          o[oi + c] = s[i00 + c] * (1 - fx) * (1 - fy) + s[i10 + c] * fx * (1 - fy) +
                      s[i01 + c] * (1 - fx) * fy + s[i11 + c] * fx * fy;
        }
      }
    }
    ctx.putImageData(out, x0, y0);
  };

  /* ---- 马赛克 ---- */
  P.mosaicAt = function (canvas, p, blockSize, style) {
    const ctx = canvas.getContext('2d');
    const r = Math.round(p.r);
    const x0 = clamp(Math.floor(p.x - r), 0, canvas.width);
    const y0 = clamp(Math.floor(p.y - r), 0, canvas.height);
    const x1 = clamp(Math.ceil(p.x + r), 0, canvas.width);
    const y1 = clamp(Math.ceil(p.y + r), 0, canvas.height);
    const id = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    const d = id.data, w = id.width, h = id.height;
    const bs = Math.max(4, blockSize);
    for (let by = 0; by < h; by += bs) {
      for (let bx = 0; bx < w; bx += bs) {
        // 块平均色
        let rS = 0, gS = 0, bS = 0, cnt = 0;
        for (let y = by; y < Math.min(by + bs, h); y++) {
          for (let x = bx; x < Math.min(bx + bs, w); x++) {
            const i = (y * w + x) * 4;
            rS += d[i]; gS += d[i + 1]; bS += d[i + 2]; cnt++;
          }
        }
        rS /= cnt; gS /= cnt; bS /= cnt;
        for (let y = by; y < Math.min(by + bs, h); y++) {
          for (let x = bx; x < Math.min(bx + bs, w); x++) {
            const gx = x0 + x, gy = y0 + y;
            const ddx = gx - p.x, ddy = gy - p.y;
            if (Math.sqrt(ddx * ddx + ddy * ddy) > r) continue; // 圆形笔刷
            const i = (y * w + x) * 4;
            if (style === 'dot') {
              // 圆点马赛克：块中心亮，边缘暗
              const cxx = bx + bs / 2, cyy = by + bs / 2;
              const dd = Math.sqrt((x - cxx) ** 2 + (y - cyy) ** 2) / (bs / 2);
              if (dd > 1) continue;
            }
            d[i] = rS; d[i + 1] = gS; d[i + 2] = bS;
          }
        }
      }
    }
    ctx.putImageData(id, x0, y0);
  };

  /* ---- 色键抠图（AI 未配置时的兜底） ---- */
  P.chromaCutout = function (canvas, keyColor, tolerance) {
    const ctx = canvas.getContext('2d');
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = id.data;
    const { r, g, b } = U.hexToRgb(keyColor);
    const tol = tolerance * 4.4;
    for (let i = 0; i < d.length; i += 4) {
      const dist = Math.sqrt((d[i] - r) ** 2 + (d[i + 1] - g) ** 2 + (d[i + 2] - b) ** 2);
      if (dist < tol) d[i + 3] = 0;
      else if (dist < tol * 1.4) d[i + 3] = Math.round(255 * (dist - tol) / (tol * 0.4));
    }
    ctx.putImageData(id, 0, 0);
  };

  // 提取 alpha 为透明 PNG dataURL（供 AI 抠图结果叠加背景）
  P.replaceBackground = function (fgCanvas, bg) {
    const out = U.makeCanvas(fgCanvas.width, fgCanvas.height);
    const ctx = out.getContext('2d');
    if (bg.color) { ctx.fillStyle = bg.color; ctx.fillRect(0, 0, out.width, out.height); }
    if (bg.image) {
      const img = bg.image;
      const s = Math.max(out.width / img.width, out.height / img.height);
      ctx.drawImage(img, (out.width - img.width * s) / 2, (out.height - img.height * s) / 2, img.width * s, img.height * s);
    }
    ctx.drawImage(fgCanvas, 0, 0);
    return out;
  };
})(window.NX.pixels = {});
