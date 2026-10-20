/* ============ 柠檬秀秀 - 双重曝光 / 局部调整画笔 / 证件照排版 ============ */
(function () {
  const U = NX.util, C = NX.core, P = NX.pixels;
  const S = () => C.state;
  NX.tools = NX.tools || {};

  /* ============ 双重曝光 ============ */
  NX.tools.doubleexp = {
    second: null, mode: 'screen', opacity: 70,
    modes: [['screen', '滤色（经典双重曝光）'], ['lighten', '变亮'], ['multiply', '正片叠底'], ['overlay', '叠加'], ['soft-light', '柔光'], ['difference', '差值（艺术）']],
    panel() {
      return `<h3>🎭 双重曝光</h3>
        <button class="btn block primary" id="deAdd">📂 选择第二张图${this.second ? '（已选 ✓）' : ''}</button>
        <div class="row"><label>混合</label><select id="deMode">
          ${this.modes.map(([v, n]) => `<option value="${v}" ${this.mode === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select></div>
        ${U.sliderRow('deOp', '浓度', 10, 100, this.opacity)}
        <button class="btn block primary" id="deApply" ${this.second ? '' : 'disabled'}>✨ 合成</button>
        <p class="hint">第二张图会等比铺满当前画布。经典玩法：人像 + 风景，选"滤色"。</p>`;
    },
    bind() {
      U.$('#deAdd').addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async (e) => {
          try { this.second = await U.loadImageFromFile(e.target.files[0]); NX.main.refreshPanel(); }
          catch (err) { U.toast('图片加载失败'); }
        };
        inp.click();
      });
      U.$('#deMode').addEventListener('change', e => this.mode = e.target.value);
      U.bindSlider('deOp', v => this.opacity = v);
      U.$('#deApply').addEventListener('click', () => this.apply());
    },
    apply() {
      if (!this.second) return;
      C.commitAdjustments(); C.flattenOverlays();
      const b = S().base;
      const top = U.makeCanvas(b.width, b.height);
      const s = Math.max(b.width / this.second.width, b.height / this.second.height);
      top.getContext('2d').drawImage(this.second, (b.width - this.second.width * s) / 2, (b.height - this.second.height * s) / 2, this.second.width * s, this.second.height * s);
      const ctx = b.getContext('2d');
      ctx.save();
      ctx.globalAlpha = this.opacity / 100;
      ctx.globalCompositeOperation = this.mode;
      ctx.drawImage(top, 0, 0);
      ctx.restore();
      C.pushHistory(); C.render();
      this.second = null;
      U.toast('双重曝光完成 🎭');
      NX.main.refreshPanel();
    },
    leave() { this.second = null; },
  };

  /* ============ 局部调整画笔（Snapseed 画笔） ============ */
  NX.tools.brushadj = {
    size: 50, strength: 40, param: 'brightness', painting: false, last: null,
    params: [['brightness', '加光'], ['darken', '减光'], ['saturate', '加饱和'], ['desaturate', '减饱和'], ['warm', '加温'], ['cool', '降温']],
    // 笔画的增量记录到暂存画布，松手一次性混合（避免反复叠加过曝）
    mask: null,
    panel() {
      return `<h3>🖌 局部调整</h3>
        <div class="chip-grid" id="baParams">
          ${this.params.map(([v, n]) => `<button class="chip ${this.param === v ? 'active' : ''}" data-p="${v}">${n}</button>`).join('')}
        </div>
        ${U.sliderRow('baSize', '笔刷', 15, 150, this.size)}
        ${U.sliderRow('baStr', '强度', 5, 100, this.strength)}
        <p class="hint">涂抹要调整的区域，松手生效。例如"加光"涂暗部、"减饱和"涂杂色背景。</p>`;
    },
    bind() {
      U.$$('#baParams [data-p]').forEach(b => b.addEventListener('click', () => {
        this.param = b.dataset.p;
        U.$$('#baParams [data-p]').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.bindSlider('baSize', v => this.size = v);
      U.bindSlider('baStr', v => this.strength = v);
    },
    onDown(p) {
      C.commitAdjustments(); C.flattenOverlays();
      this.mask = U.makeCanvas(S().base.width, S().base.height);
      this.painting = true;
      this.paint(p);
    },
    onMove(p) { if (this.painting) this.paint(p); },
    onUp() {
      if (!this.painting) return;
      this.painting = false;
      this.applyMask();
      this.mask = null;
      C.pushHistory(); C.render();
    },
    paint(p) {
      const ctx = this.mask.getContext('2d');
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath(); ctx.arc(p.x, p.y, this.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      C.render();
    },
    draw(ctx) {
      if (this.mask) { ctx.save(); ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.drawImage(this.mask, 0, 0); ctx.restore(); }
    },
    applyMask() {
      const b = S().base;
      const k = this.strength / 100;
      const mctx = this.mask.getContext('2d');
      const md = mctx.getImageData(0, 0, this.mask.width, this.mask.height).data;
      const id = b.getContext('2d').getImageData(0, 0, b.width, b.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const m = md[i + 3] / 255;
        if (m < 0.01) continue;
        const w = m * k;
        const r = d[i], g = d[i + 1], bl = d[i + 2];
        const l = 0.299 * r + 0.587 * g + 0.114 * bl;
        switch (this.param) {
          case 'brightness':
            d[i] += 40 * w; d[i + 1] += 40 * w; d[i + 2] += 40 * w; break;
          case 'darken':
            d[i] -= 40 * w; d[i + 1] -= 40 * w; d[i + 2] -= 40 * w; break;
          case 'saturate':
            d[i] = l + (r - l) * (1 + w); d[i + 1] = l + (g - l) * (1 + w); d[i + 2] = l + (bl - l) * (1 + w); break;
          case 'desaturate':
            d[i] = r + (l - r) * w; d[i + 1] = g + (l - g) * w; d[i + 2] = bl + (l - bl) * w; break;
          case 'warm':
            d[i] += 24 * w; d[i + 2] -= 24 * w; break;
          case 'cool':
            d[i] -= 24 * w; d[i + 2] += 24 * w; break;
        }
        d[i] = U.clamp(d[i], 0, 255); d[i + 1] = U.clamp(d[i + 1], 0, 255); d[i + 2] = U.clamp(d[i + 2], 0, 255);
      }
      b.getContext('2d').putImageData(id, 0, 0);
    },
    leave() { this.mask = null; this.painting = false; },
  };

  /* ============ 证件照排版（一版多张） ============ */
  NX.tools.idlayout = {
    panel() {
      return `<h3>🖨 证件照排版</h3>
        <div class="chip-grid" id="ilLayout">
          <button class="chip active" data-l="1x6">一寸×6（5寸相纸）</button>
          <button class="chip" data-l="1x8">一寸×8（6寸相纸）</button>
          <button class="chip" data-l="2x4">二寸×4（5寸相纸）</button>
        </div>
        <button class="btn block primary" id="ilGo">🖨 生成排版</button>
        <p class="hint">先用「证件照」裁好单人照，再在这里排版成可打印的整版。</p>`;
    },
    layout: '1x6',
    bind() {
      U.$$('#ilLayout [data-l]').forEach(b => b.addEventListener('click', () => {
        this.layout = b.dataset.l;
        U.$$('#ilLayout [data-l]').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.$('#ilGo').addEventListener('click', () => this.generate());
    },
    generate() {
      C.flattenOverlays();
      const photo = S().base;
      // 300dpi: 一寸 295×413，5 寸相纸 1500×1050
      const specs = {
        '1x6': { pw: 295, ph: 413, paper: [1500, 1050], cols: 3, rows: 2 },
        '1x8': { pw: 295, ph: 413, paper: [1800, 1200], cols: 4, rows: 2 },
        '2x4': { pw: 413, ph: 579, paper: [1500, 1050], cols: 2, rows: 2 },
      };
      const sp = specs[this.layout];
      const [W, H] = sp.paper;
      const c = U.makeCanvas(W, H);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      const gapX = (W - sp.cols * sp.pw) / (sp.cols + 1);
      const gapY = (H - sp.rows * sp.ph) / (sp.rows + 1);
      for (let r = 0; r < sp.rows; r++)
        for (let col = 0; col < sp.cols; col++) {
          const x = gapX + col * (sp.pw + gapX), y = gapY + r * (sp.ph + gapY);
          ctx.drawImage(photo, x, y, sp.pw, sp.ph);
          ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.strokeRect(x, y, sp.pw, sp.ph);
        }
      const img = new Image();
      img.onload = () => { C.setImage(img); U.toast('排版完成，直接保存打印 🖨'); };
      img.src = c.toDataURL('image/jpeg', 0.95);
    },
    leave() {},
  };
})();
