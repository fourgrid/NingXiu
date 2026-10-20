/* ============ 柠檬秀秀 - 绘制/美容工具：马赛克/涂鸦/文字/贴纸/虚化/美容/液化/美妆/消除 ============ */
(function () {
  const U = NX.util, C = NX.core, P = NX.pixels;
  const S = () => C.state;
  NX.tools = NX.tools || {};

  /* ============ 马赛克 ============ */
  NX.tools.mosaic = {
    size: 30, block: 14, style: 'square', painting: false,
    panel() {
      return `<h3>🔲 马赛克</h3>
        ${U.sliderRow('moSize', '笔刷', 10, 120, this.size)}
        ${U.sliderRow('moBlock', '颗粒', 6, 40, this.block)}
        <div class="chip-grid">
          <button class="chip ${this.style === 'square' ? 'active' : ''}" data-st="square">方块</button>
          <button class="chip ${this.style === 'dot' ? 'active' : ''}" data-st="dot">圆点</button>
        </div>
        <p class="hint">在图片上涂抹需要打码的区域。</p>`;
    },
    bind() {
      U.bindSlider('moSize', v => this.size = v);
      U.bindSlider('moBlock', v => this.block = v);
      U.$$('#panel [data-st]').forEach(b => b.addEventListener('click', () => {
        this.style = b.dataset.st;
        U.$$('#panel [data-st]').forEach(x => x.classList.toggle('active', x === b));
      }));
    },
    onDown(p) { C.commitAdjustments(); this.painting = true; this.paint(p); },
    onMove(p) { if (this.painting) this.paint(p); },
    onUp() { if (this.painting) { this.painting = false; C.pushHistory(); } },
    paint(p) {
      P.mosaicAt(S().base, { x: p.x, y: p.y, r: this.size }, this.block, this.style);
      C.render();
    },
    leave() {},
  };

  /* ============ 涂鸦 ============ */
  NX.tools.doodle = {
    color: '#FF3B30', width: 8, painting: false, last: null,
    panel() {
      return `<h3>🖌️ 涂鸦</h3>
        <div class="row"><label>颜色</label><input type="color" id="ddColor" value="${this.color}">
          <div class="swatch-row" style="margin:0">
            ${['#FF3B30','#FF9500','#FFD93D','#4CD964','#007AFF','#AF52DE','#000000','#FFFFFF'].map(c =>
              `<div class="swatch" data-c="${c}" style="background:${c};width:22px;height:22px"></div>`).join('')}
          </div></div>
        ${U.sliderRow('ddW', '粗细', 2, 60, this.width)}
        <p class="hint">自由涂画；画错用顶部"撤销"。</p>`;
    },
    bind() {
      U.$('#ddColor').addEventListener('input', e => this.color = e.target.value);
      U.$$('#panel .swatch').forEach(s => s.addEventListener('click', () => {
        this.color = s.dataset.c; U.$('#ddColor').value = s.dataset.c;
      }));
      U.bindSlider('ddW', v => this.width = v);
    },
    onDown(p) { C.commitAdjustments(); this.painting = true; this.last = p; this.dot(p); },
    onMove(p) {
      if (!this.painting) return;
      const ctx = S().base.getContext('2d');
      ctx.save();
      ctx.strokeStyle = this.color; ctx.lineWidth = this.width;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(this.last.x, this.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.restore();
      this.last = p;
      C.render();
    },
    onUp() { if (this.painting) { this.painting = false; C.pushHistory(); } },
    dot(p) {
      const ctx = S().base.getContext('2d');
      ctx.save(); ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, this.width / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      C.render();
    },
    leave() {},
  };

  /* ============ 文字 ============ */
  NX.tools.text = {
    opts: { text: '柠檬你好', size: 48, color: '#FFFFFF', font: '"PingFang SC", sans-serif', bold: true, italic: false, stroke: true, strokeColor: '#333333', shadow: true },
    selected: -1, dragOff: null,
    panel() {
      const sel = S().overlays[this.selected];
      const o = sel && sel.type === 'text' ? sel : this.opts;
      return `<h3>🔤 文字</h3>
        <div class="row"><label>内容</label><input type="text" id="txText" value="${U.esc(o.text || '')}"></div>
        ${U.sliderRow('txSize', '字号', 12, 200, o.size)}
        <div class="row"><label>颜色</label><input type="color" id="txColor" value="${o.color}">
          <label style="width:auto">描边</label><input type="color" id="txStrokeC" value="${o.strokeColor || '#333333'}"></div>
        <div class="row"><label>字体</label><select id="txFont">
          ${[['"PingFang SC", sans-serif', '系统黑体'], ['"Songti SC", serif', '宋体'],
             ['"Kaiti SC", cursive', '楷体'], ['cursive', '手写体'], ['monospace', '等宽']].map(([v, n]) =>
            `<option value="${U.esc(v)}" ${o.font === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select></div>
        <div class="row">
          <label><input type="checkbox" id="txBold" ${o.bold ? 'checked' : ''}> 粗体</label>
          <label><input type="checkbox" id="txItalic" ${o.italic ? 'checked' : ''}> 斜体</label>
          <label><input type="checkbox" id="txStroke" ${o.stroke ? 'checked' : ''}> 描边</label>
          <label><input type="checkbox" id="txShadow" ${o.shadow ? 'checked' : ''}> 阴影</label>
        </div>
        <button class="btn block primary" id="txAdd">➕ ${sel ? '更新选中文字' : '点击画面放置'}</button>
        <button class="btn block warn" id="txDel" ${this.selected < 0 ? 'disabled' : ''}>🗑 删除选中</button>
        <p class="hint">点击画面放置；拖动移动；双击文字重新编辑。</p>`;
    },
    readPanel() {
      return {
        type: 'text',
        text: U.$('#txText').value || '文字',
        size: parseInt(U.$('#txSize').value),
        color: U.$('#txColor').value,
        font: U.$('#txFont').value,
        bold: U.$('#txBold').checked,
        italic: U.$('#txItalic').checked,
        stroke: U.$('#txStroke').checked,
        strokeColor: U.$('#txStrokeC').value,
        shadow: U.$('#txShadow').checked,
      };
    },
    bind() {
      U.bindSlider('txSize', () => {});
      U.$('#txAdd').addEventListener('click', () => {
        const o = this.readPanel();
        if (this.selected >= 0 && S().overlays[this.selected]) {
          const old = S().overlays[this.selected];
          Object.assign(old, o, { x: old.x, y: old.y });
          C.measureOverlay(old);
        } else {
          this.pendingPlace = o;
          U.toast('点击画面放置文字');
        }
        C.render();
      });
      U.$('#txDel').addEventListener('click', () => {
        if (this.selected >= 0) { S().overlays.splice(this.selected, 1); this.selected = -1; C.render(); NX.main.refreshPanel(); }
      });
      // 面板编辑实时更新选中项
      ['txText', 'txSize', 'txColor', 'txFont', 'txBold', 'txItalic', 'txStroke', 'txStrokeC', 'txShadow'].forEach(id => {
        const el = U.$('#' + id);
        el.addEventListener('input', () => {
          if (this.selected >= 0 && S().overlays[this.selected]) {
            const old = S().overlays[this.selected];
            const keep = { x: old.x, y: old.y };
            Object.assign(old, this.readPanel(), keep);
            C.measureOverlay(old);
            C.render();
          }
        });
      });
    },
    hitTest(p) {
      const ovs = S().overlays;
      for (let i = ovs.length - 1; i >= 0; i--) {
        const o = ovs[i];
        const { hw, hh } = C.overlayHalfSize(o);
        if (Math.abs(p.x - o.x) < hw && Math.abs(p.y - o.y) < hh) return i;
      }
      return -1;
    },
    onDown(p) {
      const i = this.hitTest(p);
      if (i >= 0) {
        this.selected = i;
        const o = S().overlays[i];
        this.dragOff = { dx: p.x - o.x, dy: p.y - o.y };
        C.render(); NX.main.refreshPanel();
      } else if (this.pendingPlace) {
        const o = Object.assign({}, this.pendingPlace, { x: p.x, y: p.y });
        C.measureOverlay(o);
        S().overlays.push(o);
        this.pendingPlace = null;
        this.selected = S().overlays.length - 1;
        C.render(); NX.main.refreshPanel();
      } else {
        this.selected = -1; C.render(); NX.main.refreshPanel();
      }
    },
    onMove(p) {
      if (this.selected >= 0 && this.dragOff) {
        const o = S().overlays[this.selected];
        o.x = p.x - this.dragOff.dx; o.y = p.y - this.dragOff.dy;
        C.render();
      }
    },
    onUp() {
      if (this.dragOff) { this.dragOff = null; C.pushHistory(); }
    },
    onDblClick(p) {
      const i = this.hitTest(p);
      if (i >= 0 && S().overlays[i].type === 'text') {
        this.selected = i;
        NX.main.refreshPanel();
      }
    },
    draw(ctx) {
      // 选中框
      if (this.selected >= 0 && S().overlays[this.selected]) {
        C.drawOverlay(ctx, S().overlays[this.selected], true);
      }
    },
    leave() { this.selected = -1; this.pendingPlace = null; },
  };

  /* ============ 贴纸 ============ */
  NX.tools.sticker = {
    emojis: ['🍋','🍋‍🟩','🌸','🌺','⭐','✨','❤️','🧡','💛','💚','💙','💜','🖤','🤍','😎','🥰','😺','🐶','🐱','🦄','🎀','🎈','🎉','🌈','☀️','🌙','⛅','🍓','🍑','🥑','🍉','🍒','🌻','🌷','🍀','🦋','🐝','👑','💎','🔥'],
    emoji: '🍋', size: 80, selected: -1, dragOff: null,
    panel() {
      return `<h3>🌟 贴纸</h3>
        <div class="emoji-grid">${this.emojis.map(e =>
          `<button class="${e === this.emoji ? 'active' : ''}" data-e="${e}">${e}</button>`).join('')}</div>
        ${U.sliderRow('stSize', '大小', 24, 300, this.size)}
        <button class="btn block warn" id="stDel" ${this.selected < 0 ? 'disabled' : ''}>🗑 删除选中</button>
        <p class="hint">选 emoji → 点画面放置；拖动移动；滑杆调整"下一个"大小，也可实时改选中的。</p>`;
    },
    bind() {
      U.$$('#panel .emoji-grid button').forEach(b => b.addEventListener('click', () => {
        this.emoji = b.dataset.e;
        U.$$('#panel .emoji-grid button').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.bindSlider('stSize', v => {
        this.size = v;
        if (this.selected >= 0 && S().overlays[this.selected]) {
          S().overlays[this.selected].size = v; C.render();
        }
      });
      U.$('#stDel').addEventListener('click', () => {
        if (this.selected >= 0) { S().overlays.splice(this.selected, 1); this.selected = -1; C.render(); NX.main.refreshPanel(); }
      });
    },
    hitTest(p) { return NX.tools.text.hitTest(p); },
    onDown(p) {
      const i = this.hitTest(p);
      if (i >= 0) {
        this.selected = i;
        const o = S().overlays[i];
        this.dragOff = { dx: p.x - o.x, dy: p.y - o.y };
        C.render(); NX.main.refreshPanel();
      } else {
        S().overlays.push({ type: 'sticker', emoji: this.emoji, size: this.size, x: p.x, y: p.y });
        this.selected = S().overlays.length - 1;
        C.render(); NX.main.refreshPanel();
      }
    },
    onMove(p) {
      if (this.selected >= 0 && this.dragOff) {
        const o = S().overlays[this.selected];
        o.x = p.x - this.dragOff.dx; o.y = p.y - this.dragOff.dy;
        C.render();
      }
    },
    onUp() { if (this.dragOff) { this.dragOff = null; C.pushHistory(); } },
    draw(ctx) { NX.tools.text.draw(ctx); },
    leave() { this.selected = -1; },
  };

  /* ============ 背景虚化 ============ */
  NX.tools.blurbg = {
    strength: 12, mode: 'radial', protect: null, painting: false, erasing: false,
    panel() {
      return `<h3>🌫️ 背景虚化</h3>
        <div class="chip-grid">
          ${[['radial','圆形'],['linear','线性'],['mask','涂抹保护']].map(([v, n]) =>
            `<button class="chip ${this.mode === v ? 'active' : ''}" data-m="${v}">${n}</button>`).join('')}
        </div>
        ${U.sliderRow('bgStr', '强度', 2, 30, this.strength)}
        <button class="btn block primary" id="bgApply">✅ 应用虚化</button>
        <p class="hint">圆形/线性：拖动定位清晰区。涂抹保护：先涂出要保持清晰的主体，再应用。</p>`;
    },
    bind() {
      U.$$('#panel [data-m]').forEach(b => b.addEventListener('click', () => {
        this.mode = b.dataset.m;
        if (this.mode === 'mask' && !this.protect) this.protect = U.makeCanvas(S().base.width, S().base.height);
        U.$$('#panel [data-m]').forEach(x => x.classList.toggle('active', x === b));
        C.render();
      }));
      U.bindSlider('bgStr', v => this.strength = v);
      U.$('#bgApply').addEventListener('click', () => this.apply());
    },
    center: null,
    onDown(p) {
      if (this.mode === 'mask') {
        this.painting = true; this.paintMask(p);
      } else { this.center = p; C.render(); }
    },
    onMove(p) {
      if (this.mode === 'mask' && this.painting) this.paintMask(p);
      else if (this.center) { this.center = p; C.render(); }
    },
    onUp() {
      if (this.painting) { this.painting = false; }
    },
    paintMask(p) {
      const ctx = this.protect.getContext('2d');
      ctx.save();
      ctx.fillStyle = 'rgba(255,0,0,.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 40, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      C.render();
    },
    draw(ctx) {
      const b = S().base;
      if (this.mode === 'radial' && this.center) {
        ctx.save();
        ctx.strokeStyle = '#FFD93D'; ctx.setLineDash([8, 5]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(this.center.x, this.center.y, b.width * 0.22, b.height * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      } else if (this.mode === 'linear' && this.center) {
        ctx.save();
        ctx.strokeStyle = '#FFD93D'; ctx.setLineDash([8, 5]); ctx.lineWidth = 2;
        const bw = b.width * 0.2;
        ctx.beginPath(); ctx.moveTo(this.center.x - bw, 0); ctx.lineTo(this.center.x - bw, b.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.center.x + bw, 0); ctx.lineTo(this.center.x + bw, b.height); ctx.stroke();
        ctx.restore();
      } else if (this.mode === 'mask' && this.protect) {
        ctx.save(); ctx.globalAlpha = 0.45; ctx.drawImage(this.protect, 0, 0); ctx.restore();
      }
    },
    apply() {
      C.flattenOverlays();
      const b = S().base;
      // 1) 全图模糊副本做底
      const out = U.cloneCanvas(b);
      P.boxBlur(out, Math.round(this.strength));
      // 2) 生成"清晰区"蒙版（白=保持清晰）
      const mask = U.makeCanvas(b.width, b.height);
      const mctx = mask.getContext('2d');
      if (this.mode === 'radial' && this.center) {
        const g = mctx.createRadialGradient(this.center.x, this.center.y, b.width * 0.14,
          this.center.x, this.center.y, b.width * 0.3);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        mctx.fillStyle = g; mctx.fillRect(0, 0, mask.width, mask.height);
      } else if (this.mode === 'linear' && this.center) {
        const bw = b.width * 0.2;
        const g = mctx.createLinearGradient(this.center.x - bw * 1.8, 0, this.center.x + bw * 1.8, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,255,255,1)');
        g.addColorStop(0.65, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        mctx.fillStyle = g; mctx.fillRect(0, 0, mask.width, mask.height);
      } else if (this.mode === 'mask' && this.protect) {
        mctx.drawImage(this.protect, 0, 0);
      } else {
        U.toast('先拖动定位清晰区（或涂抹保护区）'); return;
      }
      // 3) 原图按蒙版抠出清晰区，盖到模糊底上
      const sharp = U.cloneCanvas(b);
      const sctx = sharp.getContext('2d');
      sctx.globalCompositeOperation = 'destination-in';
      sctx.drawImage(mask, 0, 0);
      out.getContext('2d').drawImage(sharp, 0, 0);
      S().base = out;
      this.protect = null; this.center = null;
      C.pushHistory(); C.render();
      U.toast('背景虚化完成');
    },
    leave() { this.protect = null; this.center = null; },
  };

  /* ============ 人像美容 ============ */
  NX.tools.beauty = {
    smooth: 40, whiten: 30,
    panel() {
      return `<h3>💆 人像美容</h3>
        ${U.sliderRow('btSmooth', '磨皮', 0, 100, this.smooth)}
        ${U.sliderRow('btWhiten', '美白', 0, 100, this.whiten)}
        <button class="btn block primary" id="btOne">✨ 一键美颜</button>
        <button class="btn block" id="btApply">✅ 应用当前参数</button>
        <h4>局部</h4>
        <button class="btn block" id="btEye">👁 亮眼（点按眼睛）</button>
        <p class="hint">磨皮/美白全图生效；亮眼为点按局部生效。瘦脸大眼请用左侧「液化」。</p>`;
    },
    eyeMode: false,
    bind() {
      U.bindSlider('btSmooth', v => this.smooth = v);
      U.bindSlider('btWhiten', v => this.whiten = v);
      U.$('#btOne').addEventListener('click', () => {
        C.commitAdjustments(); C.flattenOverlays();
        U.toast('美颜中…');
        setTimeout(() => {
          P.smoothSkin(S().base, 0.6);
          P.whiten(S().base, 0.45);
          P.sharpen(S().base, 0.15);
          C.pushHistory(); C.render();
          U.toast('一键美颜完成 ✨');
        }, 30);
      });
      U.$('#btApply').addEventListener('click', () => {
        C.commitAdjustments(); C.flattenOverlays();
        U.toast('处理中…');
        setTimeout(() => {
          P.smoothSkin(S().base, this.smooth / 100);
          P.whiten(S().base, this.whiten / 100);
          C.pushHistory(); C.render();
          U.toast('已应用');
        }, 30);
      });
      U.$('#btEye').addEventListener('click', () => {
        this.eyeMode = !this.eyeMode;
        U.$('#btEye').textContent = this.eyeMode ? '👁 亮眼已开启（点眼睛）' : '👁 亮眼（点按眼睛）';
      });
    },
    onDown(p) {
      if (this.eyeMode) {
        C.flattenOverlays();
        P.brightenEyes(S().base, { x: p.x, y: p.y, r: S().base.width * 0.05 }, 0.8);
        C.pushHistory(); C.render();
      }
    },
    leave() { this.eyeMode = false; },
  };

  /* ============ 液化（瘦脸/大眼/增高） VIP ============ */
  NX.tools.liquify = {
    mode: 'push', radius: 60, strength: 50, painting: false, last: null,
    panel() {
      return `<h3>🌀 液化塑形</h3>
        <div class="chip-grid">
          ${[['push','推移(瘦脸)'],['bulge','放大(大眼)'],['pinch','收缩(窄鼻)']].map(([v, n]) =>
            `<button class="chip ${this.mode === v ? 'active' : ''}" data-m="${v}">${n}</button>`).join('')}
        </div>
        ${U.sliderRow('lqR', '笔刷', 20, 200, this.radius)}
        ${U.sliderRow('lqS', '力度', 10, 100, this.strength)}
        <p class="hint">推移：按住向想瘦的方向拖；放大/收缩：按住不动持续作用。小幅度多次效果最自然。</p>`;
    },
    bind() {
      U.$$('#panel [data-m]').forEach(b => b.addEventListener('click', () => {
        this.mode = b.dataset.m;
        U.$$('#panel [data-m]').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.bindSlider('lqR', v => this.radius = v);
      U.bindSlider('lqS', v => this.strength = v);
    },
    onDown(p) {
      C.commitAdjustments(); C.flattenOverlays();
      this.painting = true; this.last = p;
      if (this.mode !== 'push') this.warp(p, 0, 0);
    },
    onMove(p) {
      if (!this.painting) return;
      if (this.mode === 'push') {
        this.warp(p, p.x - this.last.x, p.y - this.last.y);
        this.last = p;
      } else {
        this.warp(p, 0, 0);
      }
    },
    onUp() { if (this.painting) { this.painting = false; C.pushHistory(); } },
    warp(p, dx, dy) {
      P.liquify(S().base, { x: p.x, y: p.y, r: this.radius, strength: this.strength / 100 }, this.mode, dx * 0.4, dy * 0.4);
      C.render();
    },
    leave() {},
  };

  /* ============ 美妆（涂抹上色） VIP ============ */
  NX.tools.makeup = {
    color: '#E23A5A', blend: 'multiply', size: 30, alpha: 40, painting: false, last: null,
    presets: [['#E23A5A','口红'],['#FF8FA3','腮红'],['#8B5A2B','染发-棕'],['#2B2B2B','染发-黑'],['#C0C0C0','染发-银'],['#5B3A8E','眼影']],
    panel() {
      return `<h3>💄 美妆</h3>
        <div class="chip-grid" style="grid-template-columns:repeat(3,1fr)">
          ${this.presets.map(([c, n]) => `<button class="chip" data-c="${c}" style="border-bottom:4px solid ${c}">${n}</button>`).join('')}
        </div>
        <div class="row"><label>颜色</label><input type="color" id="mkColor" value="${this.color}"></div>
        ${U.sliderRow('mkSize', '笔刷', 8, 100, this.size)}
        ${U.sliderRow('mkAlpha', '浓度', 5, 100, this.alpha)}
        <div class="chip-grid">
          ${[['multiply','叠色(口红/染发)'],['soft-light','柔光(腮红)'],['source-over','覆盖']].map(([v, n]) =>
            `<button class="chip ${this.blend === v ? 'active' : ''}" data-b="${v}">${n}</button>`).join('')}
        </div>
        <p class="hint">在需要上妆的区域涂抹。涂错可撤销。</p>`;
    },
    bind() {
      U.$$('#panel [data-c]').forEach(b => b.addEventListener('click', () => {
        this.color = b.dataset.c; U.$('#mkColor').value = b.dataset.c;
      }));
      U.$('#mkColor').addEventListener('input', e => this.color = e.target.value);
      U.bindSlider('mkSize', v => this.size = v);
      U.bindSlider('mkAlpha', v => this.alpha = v);
      U.$$('#panel [data-b]').forEach(b => b.addEventListener('click', () => {
        this.blend = b.dataset.b;
        U.$$('#panel [data-b]').forEach(x => x.classList.toggle('active', x === b));
      }));
    },
    onDown(p) { C.commitAdjustments(); C.flattenOverlays(); this.painting = true; this.last = p; this.paint(p); },
    onMove(p) {
      if (!this.painting) return;
      const ctx = S().base.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = this.blend;
      ctx.globalAlpha = this.alpha / 100 * 0.5;
      ctx.strokeStyle = this.color; ctx.lineWidth = this.size * 2;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(this.last.x, this.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.restore();
      this.last = p;
      C.render();
    },
    onUp() { if (this.painting) { this.painting = false; C.pushHistory(); } },
    paint(p) {
      const ctx = S().base.getContext('2d');
      ctx.save();
      ctx.globalCompositeOperation = this.blend;
      ctx.globalAlpha = this.alpha / 100 * 0.5;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, this.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      C.render();
    },
    leave() {},
  };

  /* ============ 消除笔（本地修复 + AI） ============ */
  NX.tools.erase = {
    size: 30, painting: false,
    panel() {
      return `<h3>🧹 消除笔</h3>
        ${U.sliderRow('erSize', '笔刷', 10, 100, this.size)}
        <button class="btn block ai" id="erAI">🤖 切换 AI 消除（更智能）</button>
        <p class="hint">本地模式：点按小瑕疵（痘痘/污点）自动取样修复。<br>大面积消除（路人/物体）建议用 AI 模式。</p>`;
    },
    bind() {
      U.bindSlider('erSize', v => this.size = v);
      U.$('#erAI').addEventListener('click', () => NX.main.switchTool('ai-erase'));
    },
    onDown(p) {
      C.commitAdjustments(); C.flattenOverlays();
      P.healSpot(S().base, { x: p.x, y: p.y, r: this.size });
      C.pushHistory(); C.render();
    },
    leave() {},
  };
})();
