/* ============ 柠檬秀秀 - 基础工具：滤镜/调节/HSL/裁剪/旋转/尺寸/边框/证件照 ============ */
(function () {
  const U = NX.util, C = NX.core, P = NX.pixels;
  const S = () => C.state;
  NX.tools = NX.tools || {};

  /* ================= 滤镜 ================= */
  NX.tools.filter = {
    panel() {
      const chips = Object.entries(C.FILTERS).map(([k, f]) => {
        return `<button class="chip ${S().filterName === k ? 'active' : ''}" data-filter="${k}"><span class="demo" data-thumb="${k}"></span>${f.name}</button>`;
      }).join('');
      return `<h3>🎨 滤镜</h3><div class="chip-grid">${chips}</div>
        ${U.sliderRow('filterIntensity', '强度', 10, 100, NX.core.state.filterIntensity)}
        <button class="btn block" id="filterApply">✅ 应用滤镜</button>
        <p class="hint">点击滤镜实时预览，可调强度；"应用滤镜"后进入下一段编辑。</p>`;
    },
    demoGradient(k) {
      const g = {
        none: '#ddd', fresh: 'linear-gradient(135deg,#a8e063,#56ab2f)', lemon: 'linear-gradient(135deg,#FFD93D,#F5B800)',
        sunny: 'linear-gradient(135deg,#f6d365,#fda085)', retro: 'linear-gradient(135deg,#d7a86e,#8e5b3a)',
        film: 'linear-gradient(135deg,#606c88,#3f4c6b)', lomo: 'linear-gradient(135deg,#642B73,#C6426E)',
        bw: 'linear-gradient(135deg,#eee,#333)', silver: 'linear-gradient(135deg,#fff,#757F9A)',
        cool: 'linear-gradient(135deg,#2193b0,#6dd5ed)', peach: 'linear-gradient(135deg,#ff9a9e,#fecfef)',
        mint: 'linear-gradient(135deg,#84fab0,#8fd3f4)', dream: 'linear-gradient(135deg,#a18cd1,#fbc2eb)',
        japan: 'linear-gradient(135deg,#ffecd2,#fcb69f)', drama: 'linear-gradient(135deg,#232526,#414345)',
        vivid: 'linear-gradient(135deg,#f093fb,#f5576c)',
        sunset: 'linear-gradient(135deg,#ff9966,#ff5e62)', milk: 'linear-gradient(135deg,#e0c3a5,#c8a882)',
        mist: 'linear-gradient(135deg,#cfd9df,#e2ebf0)', verdant: 'linear-gradient(135deg,#7CB342,#33691E)',
        matcha: 'linear-gradient(135deg,#a8c69f,#6b8f5e)', lavend: 'linear-gradient(135deg,#7C4DFF,#311B92)',
        softlit: 'linear-gradient(135deg,#fff3e0,#ffe0ec)', ink: 'linear-gradient(135deg,#666,#111)',
      };
      return g[k] || '#ccc';
    },
    bind() {
      U.$$('#panel [data-filter]').forEach(b => b.addEventListener('click', () => {
        S().filterName = b.dataset.filter;
        C.render();
        U.$$('#panel [data-filter]').forEach(x => x.classList.toggle('active', x === b));
      }));
      const deb = U.debounce(() => C.render(), 30);
      U.bindSlider('filterIntensity', v => { S().filterIntensity = v; deb(); });
      U.$('#filterApply').addEventListener('click', C.commitAdjustments);
      this.renderThumbs();
    },
    // 用当前图片生成每款滤镜的真实缩略图（美图式）
    renderThumbs() {
      const b = S().base;
      if (!b) return;
      const tw = 72, th = 54;
      for (const [k, f] of Object.entries(C.FILTERS)) {
        const el = U.$(`#panel [data-thumb="${k}"]`);
        if (!el) continue;
        try {
          const c = U.makeCanvas(tw, th);
          const ctx = c.getContext('2d');
          ctx.save();
          if (C.filterSupported && f.css) ctx.filter = f.css;
          const s = Math.max(tw / b.width, th / b.height);
          ctx.drawImage(b, (tw - b.width * s) / 2, (th - b.height * s) / 2, b.width * s, b.height * s);
          ctx.restore();
          if (f.tint) C.applyTint(ctx, tw, th, f.tint[0], f.tint[1]);
          if (f.vig) C.drawVignette(ctx, tw, th, f.vig);
          el.style.backgroundImage = `url(${c.toDataURL('image/jpeg', 0.7)})`;
          el.style.backgroundSize = 'cover';
        } catch (e) { /* 单个失败不影响 */ }
      }
    },
    leave() {},
  };

  /* ================= 调节 ================= */
  NX.tools.adjust = {
    defs: [
      ['brightness', '亮度', -100, 100], ['contrast', '对比度', -100, 100],
      ['saturate', '饱和度', -100, 100], ['temp', '色温', -100, 100],
      ['hue', '色调', -180, 180], ['highlight', '高光', -100, 100],
      ['shadow', '阴影', -100, 100], ['sharpen', '锐化', 0, 100],
      ['clarity', '清晰度', -100, 100], ['noise', '颗粒', 0, 100],
      ['vignette', '暗角', 0, 100], ['fade', '褪色', 0, 100],
    ],
    panel() {
      const rows = this.defs.map(([k, label, mn, mx]) => U.sliderRow('adj_' + k, label, mn, mx, S().adjust[k])).join('');
      return `<h3>🎚️ 调节</h3>${rows}
        <button class="btn block primary" id="adjApply">✅ 应用</button>
        <button class="btn block" id="adjReset">↺ 归零</button>
        <p class="hint">亮度/对比度/饱和度/色温实时预览；锐化、颗粒等在"应用"时生效。</p>`;
    },
    bind() {
      const rerender = U.debounce(() => C.render(), 30);
      this.defs.forEach(([k]) => U.bindSlider('adj_' + k, v => { S().adjust[k] = v; rerender(); }));
      U.$('#adjApply').addEventListener('click', C.commitAdjustments);
      U.$('#adjReset').addEventListener('click', () => {
        S().adjust = C.defaultAdjust(); C.render(); NX.main.refreshPanel();
      });
    },
    leave() {},
  };

  /* ================= HSL 分色（VIP） ================= */
  NX.tools.hsl = {
    channels: [['red','红'],['orange','橙'],['yellow','黄'],['green','绿'],['cyan','青'],['blue','蓝'],['purple','紫'],['magenta','洋红']],
    cur: 'red',
    panel() {
      const tabs = this.channels.map(([k, n]) =>
        `<button class="chip ${this.cur === k ? 'active' : ''}" data-ch="${k}">${n}</button>`).join('');
      const v = S().hsl[this.cur];
      return `<h3>🌈 HSL 分色</h3>
        <div class="chip-grid" style="grid-template-columns:repeat(4,1fr)">${tabs}</div>
        ${U.sliderRow('hsl_h', '色相', -100, 100, v[0])}
        ${U.sliderRow('hsl_s', '饱和度', -100, 100, v[1])}
        ${U.sliderRow('hsl_l', '明度', -100, 100, v[2])}
        <button class="btn block primary" id="hslApply">✅ 应用</button>
        <p class="hint">选中颜色通道后拖动滑杆，点"应用"烘焙。例：让天空更蓝 → 选"蓝"提饱和度。</p>`;
    },
    bind() {
      U.$$('#panel [data-ch]').forEach(b => b.addEventListener('click', () => { this.cur = b.dataset.ch; NX.main.refreshPanel(); }));
      const apply = () => { /* HSL 无法实时预览（太慢），仅记录 */ };
      U.bindSlider('hsl_h', v => { S().hsl[this.cur][0] = v; apply(); });
      U.bindSlider('hsl_s', v => { S().hsl[this.cur][1] = v; apply(); });
      U.bindSlider('hsl_l', v => { S().hsl[this.cur][2] = v; apply(); });
      U.$('#hslApply').addEventListener('click', () => {
        C.commitAdjustments();
      });
    },
    leave() {},
  };

  /* ================= 裁剪 ================= */
  NX.tools.crop = {
    rect: null, dragging: false, start: null, ratio: 0,
    enter() { this.rect = null; },
    panel() {
      return `<h3>✂️ 裁剪</h3>
        <div class="chip-grid" id="cropRatios">
          ${[['0','自由'],['1','1:1'],['4/3','4:3'],['3/4','3:4'],['16/9','16:9'],['9/16','9:16'],['1.414','证件照']].map(([v, n], i) =>
            `<button class="chip ${i === 0 ? 'active' : ''}" data-ratio="${v}">${n}</button>`).join('')}
        </div>
        <button class="btn block primary" id="cropApply">✅ 应用裁剪</button>
        <button class="btn block" id="cropCancel">取消</button>
        <p class="hint">在图片上拖出裁剪框。</p>`;
    },
    bind() {
      U.$$('#panel [data-ratio]').forEach(b => b.addEventListener('click', () => {
        this.ratio = parseFloat(b.dataset.ratio);
        U.$$('#panel [data-ratio]').forEach(x => x.classList.toggle('active', x === b));
        this.rect = null; C.render();
      }));
      U.$('#cropApply').addEventListener('click', () => this.apply());
      U.$('#cropCancel').addEventListener('click', () => { this.rect = null; C.render(); });
    },
    onDown(p) { this.dragging = true; this.start = p; this.rect = { x: p.x, y: p.y, w: 0, h: 0 }; },
    onMove(p) {
      if (!this.dragging) return;
      let x = Math.min(this.start.x, p.x), y = Math.min(this.start.y, p.y);
      let w = Math.abs(p.x - this.start.x), h = Math.abs(p.y - this.start.y);
      if (this.ratio > 0) { h = w / this.ratio; if (y + h > S().base.height) { h = S().base.height - y; w = h * this.ratio; } }
      this.rect = { x, y, w: Math.min(w, S().base.width - x), h: Math.min(h, S().base.height - y) };
      C.render();
    },
    onUp() { this.dragging = false; },
    draw(ctx) {
      if (!this.rect || this.rect.w < 2) return;
      const { x, y, w, h } = this.rect;
      const W = S().base.width, H = S().base.height;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(0, 0, W, y); ctx.fillRect(0, y + h, W, H - y - h);
      ctx.fillRect(0, y, x, h); ctx.fillRect(x + w, y, W - x - w, h);
      ctx.strokeStyle = '#FFD93D'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
      ctx.strokeRect(x, y, w, h);
      // 九宫格
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,217,61,.5)'; ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(x + w * i / 3, y); ctx.lineTo(x + w * i / 3, y + h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + h * i / 3); ctx.lineTo(x + w, y + h * i / 3); ctx.stroke();
      }
      ctx.restore();
    },
    apply() {
      if (!this.rect || this.rect.w < 4 || this.rect.h < 4) { U.toast('请先拖出裁剪区域'); return; }
      C.flattenOverlays();
      const { x, y, w, h } = this.rect;
      const c = U.makeCanvas(w, h);
      c.getContext('2d').drawImage(S().base, x, y, w, h, 0, 0, w, h);
      S().base = c;
      this.rect = null;
      C.pushHistory(); C.render();
      U.toast('已裁剪 ' + Math.round(w) + '×' + Math.round(h));
    },
    leave() { this.rect = null; },
  };

  /* ================= 旋转/翻转 ================= */
  NX.tools.rotate = {
    panel() {
      return `<h3>🔃 旋转 / 翻转</h3>
        <div class="chip-grid">
          <button class="chip" id="rotL">↺ 左转90°</button>
          <button class="chip" id="rotR">↻ 右转90°</button>
          <button class="chip" id="flipH">⇋ 水平翻转</button>
          <button class="chip" id="flipV">⇅ 垂直翻转</button>
          <button class="chip" id="rot180">🔄 旋转180°</button>
        </div>`;
    },
    bind() {
      const tf = (fn) => {
        C.flattenOverlays();
        const b = S().base;
        const c = U.makeCanvas(b.width, b.height);
        fn(c.getContext('2d'), b, c);
        S().base = c;
        C.pushHistory(); C.render();
      };
      U.$('#rotL').addEventListener('click', () => tf((ctx, b, c) => {
        c.width = b.height; c.height = b.width;
        ctx.translate(0, b.width); ctx.rotate(-Math.PI / 2); ctx.drawImage(b, 0, 0);
      }));
      U.$('#rotR').addEventListener('click', () => tf((ctx, b, c) => {
        c.width = b.height; c.height = b.width;
        ctx.translate(b.height, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(b, 0, 0);
      }));
      U.$('#rot180').addEventListener('click', () => tf((ctx, b) => {
        ctx.translate(b.width, b.height); ctx.rotate(Math.PI); ctx.drawImage(b, 0, 0);
      }));
      U.$('#flipH').addEventListener('click', () => tf((ctx, b) => {
        ctx.translate(b.width, 0); ctx.scale(-1, 1); ctx.drawImage(b, 0, 0);
      }));
      U.$('#flipV').addEventListener('click', () => tf((ctx, b) => {
        ctx.translate(0, b.height); ctx.scale(1, -1); ctx.drawImage(b, 0, 0);
      }));
    },
    leave() {},
  };

  /* ================= 尺寸 ================= */
  NX.tools.resize = {
    panel() {
      const b = S().base;
      return `<h3>📐 尺寸调整</h3>
        <div class="row"><label>宽</label><input type="number" id="rsW" value="${b.width}" min="1" max="8000"></div>
        <div class="row"><label>高</label><input type="number" id="rsH" value="${b.height}" min="1" max="8000"></div>
        <div class="row"><label>锁比例</label><input type="checkbox" id="rsLock" checked style="flex:none"></div>
        <div class="chip-grid">
          <button class="chip" data-pct="0.5">50%</button>
          <button class="chip" data-pct="0.75">75%</button>
          <button class="chip" data-pct="1.5">150%</button>
        </div>
        <button class="btn block primary" id="rsApply">✅ 应用</button>`;
    },
    bind() {
      const w = U.$('#rsW'), h = U.$('#rsH'), lock = U.$('#rsLock');
      const ratio = S().base.width / S().base.height;
      w.addEventListener('input', () => { if (lock.checked) h.value = Math.round(w.value / ratio); });
      h.addEventListener('input', () => { if (lock.checked) w.value = Math.round(h.value * ratio); });
      U.$$('#panel [data-pct]').forEach(b => b.addEventListener('click', () => {
        w.value = Math.round(S().base.width * parseFloat(b.dataset.pct));
        h.value = Math.round(S().base.height * parseFloat(b.dataset.pct));
      }));
      U.$('#rsApply').addEventListener('click', () => {
        const nw = U.clamp(parseInt(w.value) || S().base.width, 1, 8000);
        const nh = U.clamp(parseInt(h.value) || S().base.height, 1, 8000);
        C.flattenOverlays();
        const c = U.makeCanvas(nw, nh);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(S().base, 0, 0, nw, nh);
        S().base = c;
        C.pushHistory(); C.render();
        U.toast(`已调整 ${nw}×${nh}`);
      });
    },
    leave() {},
  };

  /* ================= 边框 ================= */
  NX.tools.frame = {
    panel() {
      return `<h3>🖼️ 边框</h3>
        ${U.sliderRow('frW', '宽度', 0, 200, 30)}
        <div class="row"><label>颜色</label><input type="color" id="frColor" value="#ffffff">
        <input type="color" id="frColor2" value="#FFD93D" title="内圈颜色"></div>
        <div class="chip-grid">
          <button class="chip active" data-style="solid">纯色</button>
          <button class="chip" data-style="double">双层</button>
          <button class="chip" data-style="film">胶片</button>
          <button class="chip" data-style="polaroid">拍立得</button>
        </div>
        <button class="btn block primary" id="frApply">✅ 应用边框</button>`;
    },
    style: 'solid',
    bind() {
      U.bindSlider('frW', () => {});
      U.$$('#panel [data-style]').forEach(b => b.addEventListener('click', () => {
        this.style = b.dataset.style;
        U.$$('#panel [data-style]').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.$('#frApply').addEventListener('click', () => this.apply());
    },
    apply() {
      const w = parseInt(U.$('#frW').value) || 0;
      if (w <= 0) { U.toast('宽度设为 0 无法加边框'); return; }
      C.flattenOverlays();
      const b = S().base;
      const color = U.$('#frColor').value, color2 = U.$('#frColor2').value;
      let extraBottom = this.style === 'polaroid' ? w * 2.6 : w;
      const c = U.makeCanvas(b.width + w * 2, b.height + w + extraBottom);
      const ctx = c.getContext('2d');
      ctx.fillStyle = color; ctx.fillRect(0, 0, c.width, c.height);
      if (this.style === 'double') {
        ctx.fillStyle = color2; ctx.fillRect(w * 0.4, w * 0.4, c.width - w * 0.8, c.height - w * 0.8);
      }
      if (this.style === 'film') {
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = '#eee';
        const hole = Math.max(6, w * 0.35);
        for (let x = w * 0.5; x < c.width - w * 0.5; x += w) {
          ctx.fillRect(x, w * 0.28, hole, hole);
          ctx.fillRect(x, c.height - w * 0.28 - hole, hole, hole);
        }
      }
      ctx.drawImage(b, w, w);
      S().base = c;
      C.pushHistory(); C.render();
      U.toast('边框已添加');
    },
    leave() {},
  };

  /* ================= 证件照 ================= */
  NX.tools.idphoto = {
    panel() {
      return `<h3>🪪 证件照</h3>
        <h4>尺寸</h4>
        <div class="chip-grid" id="idSize">
          <button class="chip active" data-size="295,413">一寸</button>
          <button class="chip" data-size="413,579">二寸</button>
          <button class="chip" data-size="390,567">小二寸</button>
        </div>
        <h4>底色</h4>
        <div class="swatch-row">
          <div class="swatch active" data-color="#ffffff" style="background:#fff" title="白底"></div>
          <div class="swatch" data-color="#438EDB" style="background:#438EDB" title="蓝底"></div>
          <div class="swatch" data-color="#D8352A" style="background:#D8352A" title="红底"></div>
        </div>
        <button class="btn block" id="idCrop">✂️ 按证件比例裁剪</button>
        <button class="btn block" id="idBg">🎨 替换底色(色键)</button>
        ${U.sliderRow('idTol', '容差', 5, 80, 30)}
        <p class="hint">先裁剪成证件比例，再换底色。换底色用色键抠图：原背景色接近所选底色边缘时效果最好；复杂背景建议用左侧「AI抠图」。</p>`;
    },
    bind() {
      U.$$('#idSize .chip').forEach(b => b.addEventListener('click', () =>
        U.$$('#idSize .chip').forEach(x => x.classList.toggle('active', x === b))));
      U.$$('#panel .swatch').forEach(s => s.addEventListener('click', () =>
        U.$$('#panel .swatch').forEach(x => x.classList.toggle('active', x === s))));
      U.$('#idCrop').addEventListener('click', () => {
        // 以中心按 295:413 裁剪
        C.flattenOverlays();
        const b = S().base, ratio = 295 / 413;
        let w = b.width, h = w / ratio;
        if (h > b.height) { h = b.height; w = h * ratio; }
        const c = U.makeCanvas(w, h);
        c.getContext('2d').drawImage(b, (b.width - w) / 2, (b.height - h) / 2, w, h, 0, 0, w, h);
        S().base = c;
        C.pushHistory(); C.render();
        U.toast('已按证件照比例裁剪');
      });
      U.$('#idBg').addEventListener('click', () => {
        C.flattenOverlays();
        const b = S().base;
        const corner = b.getContext('2d').getImageData(4, 4, 1, 1).data;
        const key = '#' + [corner[0], corner[1], corner[2]].map(v => v.toString(16).padStart(2, '0')).join('');
        P.chromaCutout(b, key, parseInt(U.$('#idTol').value));
        const color = U.$('#panel .swatch.active').dataset.color;
        S().base = P.replaceBackground(b, { color });
        C.pushHistory(); C.render();
        U.toast('底色已替换（以左上角取样）');
      });
    },
    leave() {},
  };
})();
