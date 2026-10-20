/* ============ 柠檬秀秀 - 拼图 & 海报模板 ============ */
(function () {
  const U = NX.util, C = NX.core;
  const S = () => C.state;
  NX.tools = NX.tools || {};

  /* ============ 拼图 ============ */
  NX.tools.collage = {
    images: [],          // HTMLImageElement[]
    layout: 'grid2h', gap: 12, radius: 0, bg: '#FFFFFF',
    layouts: [
      ['grid2h', '左右两格', 2], ['grid2v', '上下两格', 2],
      ['grid3h', '三横格', 3], ['grid3v', '三竖格', 3],
      ['grid4', '四宫格', 4], ['grid6', '六宫格(2×3)', 6], ['grid9', '九宫格', 9],
      ['long-h', '横向长图', 0], ['long-v', '竖向长图', 0],
    ],
    panel() {
      return `<h3>🧩 拼图</h3>
        <button class="btn block primary" id="clAdd">📂 添加图片（已选 ${this.images.length} 张）</button>
        <div class="chip-grid" id="clLayouts">
          ${this.layouts.map(([k, n]) => `<button class="chip ${this.layout === k ? 'active' : ''}" data-l="${k}">${n}</button>`).join('')}
        </div>
        ${U.sliderRow('clGap', '间距', 0, 60, this.gap)}
        <div class="row"><label>底色</label><input type="color" id="clBg" value="${this.bg}"></div>
        <button class="btn block primary" id="clGen">🧩 生成拼图</button>
        <button class="btn block" id="clClear">清空选择</button>
        <p class="hint">生成后拼图成为当前图片，可继续加滤镜/文字/贴纸。长图模式按选中顺序依次拼接。</p>`;
    },
    bind() {
      const fileInput = U.$('#collageFiles');
      U.$('#clAdd').addEventListener('click', () => fileInput.click());
      fileInput.onchange = async (e) => {
        for (const f of e.target.files) {
          try { this.images.push(await U.loadImageFromFile(f)); } catch (err) { /* skip */ }
        }
        fileInput.value = '';
        NX.main.refreshPanel();
        U.toast(`已选 ${this.images.length} 张`);
      };
      U.$$('#clLayouts .chip').forEach(b => b.addEventListener('click', () => {
        this.layout = b.dataset.l;
        U.$$('#clLayouts .chip').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.bindSlider('clGap', v => this.gap = v);
      U.$('#clBg').addEventListener('input', e => this.bg = e.target.value);
      U.$('#clGen').addEventListener('click', () => this.generate());
      U.$('#clClear').addEventListener('click', () => { this.images = []; NX.main.refreshPanel(); });
    },
    cellCount() {
      const lay = this.layouts.find(l => l[0] === this.layout);
      return lay[2] || this.images.length;
    },
    generate() {
      const n = this.cellCount();
      if (this.images.length < 2) { U.toast('请至少添加 2 张图片'); return; }
      const imgs = this.images.slice(0, n);
      const gap = this.gap;
      let W, H, cells = [];
      const coverDraw = (ctx, img, x, y, w, h) => {
        const s = Math.max(w / img.width, h / img.height);
        const dw = img.width * s, dh = img.height * s;
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
        ctx.restore();
      };
      // 统一基准边长
      const base = 900;
      switch (this.layout) {
        case 'grid2h': W = base * 2 + gap * 3; H = base + gap * 2;
          cells = [[gap, gap, base, base], [base + gap * 2, gap, base, base]]; break;
        case 'grid2v': W = base + gap * 2; H = base * 2 + gap * 3;
          cells = [[gap, gap, base, base], [gap, base + gap * 2, base, base]]; break;
        case 'grid3h': W = base * 3 + gap * 4; H = base + gap * 2;
          cells = [0, 1, 2].map(i => [gap + i * (base + gap), gap, base, base]); break;
        case 'grid3v': W = base + gap * 2; H = base * 3 + gap * 4;
          cells = [0, 1, 2].map(i => [gap, gap + i * (base + gap), base, base]); break;
        case 'grid4': W = base * 2 + gap * 3; H = base * 2 + gap * 3;
          cells = [[0,0],[1,0],[0,1],[1,1]].map(([cx, cy]) => [gap + cx * (base + gap), gap + cy * (base + gap), base, base]); break;
        case 'grid6': W = base * 2 + gap * 3; H = base * 3 + gap * 4;
          cells = [];
          for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 2; c2++) cells.push([gap + c2 * (base + gap), gap + r * (base + gap), base, base]);
          break;
        case 'grid9': W = base * 3 + gap * 4; H = base * 3 + gap * 4;
          cells = [];
          for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 3; c2++) cells.push([gap + c2 * (base + gap), gap + r * (base + gap), base, base]);
          break;
        case 'long-h': {
          H = base; W = gap;
          cells = imgs.map(img => { const w = base * img.width / img.height; const cell = [W, gap, w, base]; W += w + gap; return cell; });
          W += 0; break;
        }
        case 'long-v': {
          W = base + gap * 2; H = gap;
          cells = imgs.map(img => { const h = base * img.height / img.width; const cell = [gap, H, base, h]; H += h + gap; return cell; });
          break;
        }
      }
      const c = U.makeCanvas(W, H);
      const ctx = c.getContext('2d');
      ctx.fillStyle = this.bg; ctx.fillRect(0, 0, W, H);
      cells.forEach((cell, i) => { if (imgs[i]) coverDraw(ctx, imgs[i], cell[0], cell[1], cell[2], cell[3]); });
      // 作为当前图片载入
      const img = new Image();
      img.onload = () => { C.setImage(img); U.toast('拼图已生成 🧩'); };
      img.src = c.toDataURL('image/png');
      this.images = [];
    },
    leave() {},
  };

  /* ============ 海报模板 ============ */
  NX.tools.template = {
    templates: [
      { name: '柠檬日记', filter: 'lemon', frame: { w: 40, color: '#FFFFFF' }, text: { text: '今日份小确幸', pos: 'bottom', size: 56, color: '#F5B800', sub: '' } },
      { name: '胶片回忆', filter: 'film', frame: { w: 26, color: '#111111' }, text: { text: 'MEMORIES', pos: 'bottom', size: 44, color: '#FFFFFF', sub: '' } },
      { name: '清新周末', filter: 'fresh', frame: { w: 30, color: '#FFFFFF' }, text: { text: 'Weekend Vibes', pos: 'top', size: 48, color: '#7CB342', sub: '' } },
      { name: '电影海报', filter: 'drama', frame: { w: 0 }, text: { text: 'A FILM BY YOU', pos: 'bottom', size: 40, color: '#FFD93D', sub: '' } },
      { name: '日签问候', filter: 'japan', frame: { w: 36, color: '#FFF8E1' }, text: { text: '早安，新的一天', pos: 'top', size: 52, color: '#5D4037', sub: '' } },
      { name: 'LOMO街头', filter: 'lomo', frame: { w: 20, color: '#000000' }, text: { text: 'STREET', pos: 'bottom', size: 46, color: '#FFFFFF', sub: '' } },
    ],
    panel() {
      return `<h3>📰 海报模板</h3>
        <div class="chip-grid">
          ${this.templates.map((t, i) => `<button class="chip" data-t="${i}">${t.name}</button>`).join('')}
        </div>
        <div class="row"><label>标题</label><input type="text" id="tpText" placeholder="留空用模板默认文案"></div>
        <button class="btn block primary" id="tpApply">✨ 一键套用</button>
        <p class="hint">模板 = 滤镜 + 边框 + 文字排版 的组合，一键套用后可继续微调。</p>`;
    },
    bind() {
      let cur = 0;
      U.$$('#panel [data-t]').forEach(b => b.addEventListener('click', () => {
        cur = parseInt(b.dataset.t);
        U.$$('#panel [data-t]').forEach(x => x.classList.toggle('active', x === b));
        U.toast('已选模板：' + this.templates[cur].name);
      }));
      U.$('#tpApply').addEventListener('click', () => {
        const t = this.templates[cur];
        const custom = U.$('#tpText').value.trim();
        // 1) 滤镜
        S().filterName = t.filter;
        C.commitAdjustments();
        // 2) 边框
        if (t.frame.w > 0) {
          const b = S().base, w = t.frame.w;
          const c = U.makeCanvas(b.width + w * 2, b.height + w * 2);
          const ctx = c.getContext('2d');
          ctx.fillStyle = t.frame.color; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(b, w, w);
          S().base = c;
        }
        // 3) 文字
        const b = S().base;
        const scale = b.width / 1000;
        const o = {
          type: 'text',
          text: custom || t.text.text,
          size: Math.round(t.text.size * scale),
          color: t.text.color,
          font: '"PingFang SC", sans-serif',
          bold: true, italic: false, stroke: false, shadow: true,
          x: b.width / 2,
          y: t.text.pos === 'bottom' ? b.height * 0.92 : b.height * 0.09,
        };
        C.measureOverlay(o);
        S().overlays.push(o);
        C.pushHistory(); C.render();
        U.toast('模板已套用，文字可拖动 ✨');
      });
    },
    leave() {},
  };
})();
