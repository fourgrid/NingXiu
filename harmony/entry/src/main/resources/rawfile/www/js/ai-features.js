/* ============ 柠檬秀秀 - AI 功能：消除/抠图/扩图/绘画/写真/修复 ============ */
(function () {
  const U = NX.util, C = NX.core, P = NX.pixels, AI = NX.ai;
  const S = () => C.state;
  NX.tools = NX.tools || {};

  function needConfig() {
    if (AI.configured()) return false;
    U.toast('未配置 AI API，请先到「AI设置」填写');
    return true;
  }

  function setBusy(v, msg) {
    S().busy = v;
    if (msg) U.toast(msg, v ? 60000 : 2000);
  }

  // 把 AI 结果图铺回画布（尺寸不同时等比覆盖）
  function applyResultImage(img) {
    const b = S().base;
    const ctx = b.getContext('2d');
    const s = Math.max(b.width / img.width, b.height / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, (b.width - dw) / 2, (b.height - dh) / 2, dw, dh);
    C.pushHistory(); C.render();
  }

  /* ============ AI 消除（VIP） ============ */
  NX.tools['ai-erase'] = {
    size: 40, mask: null, painting: false,
    panel() {
      return `<h3>🤖 AI 消除 <span class="badge">VIP</span></h3>
        ${U.sliderRow('aeSize', '笔刷', 15, 120, this.size)}
        <button class="btn block ai" id="aeGo">✨ 开始 AI 消除</button>
        <button class="btn block" id="aeClear">🧽 重涂</button>
        <p class="panel-note ai">涂抹要消除的物体（红色区域），AI 会移除并智能补全背景。配置见左侧「AI设置」。</p>`;
    },
    bind() {
      U.bindSlider('aeSize', v => this.size = v);
      U.$('#aeGo').addEventListener('click', () => this.run());
      U.$('#aeClear').addEventListener('click', () => { this.mask = null; C.render(); });
    },
    ensureMask() {
      if (!this.mask || this.mask.width !== S().base.width || this.mask.height !== S().base.height) {
        this.mask = U.makeCanvas(S().base.width, S().base.height);
      }
    },
    onDown(p) { this.ensureMask(); this.painting = true; this.paint(p); },
    onMove(p) { if (this.painting) this.paint(p); },
    onUp() { this.painting = false; },
    paint(p) {
      const ctx = this.mask.getContext('2d');
      ctx.save(); ctx.fillStyle = 'rgba(255,60,60,1)';
      ctx.beginPath(); ctx.arc(p.x, p.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      C.render();
    },
    draw(ctx) {
      if (this.mask) { ctx.save(); ctx.globalAlpha = 0.5; ctx.drawImage(this.mask, 0, 0); ctx.restore(); }
    },
    async run() {
      if (needConfig()) return;
      if (!this.mask) { U.toast('请先涂抹要消除的区域'); return; }
      setBusy(true, '🤖 AI 消除中，约需几秒到几十秒…');
      try {
        const { canvas: smallImg } = AI.fitForAPI(S().base);
        const smallMask = U.makeCanvas(smallImg.width, smallImg.height);
        smallMask.getContext('2d').drawImage(this.mask, 0, 0, smallMask.width, smallMask.height);
        // OpenAI mask 约定：透明 = 待编辑区域
        const maskData = smallMask.getContext('2d').getImageData(0, 0, smallMask.width, smallMask.height);
        const md = maskData.data;
        for (let i = 0; i < md.length; i += 4) {
          if (md[i] > 30) { md[i + 3] = 0; }        // 涂过的地方 → 透明（编辑区）
          else { md[i] = 0; md[i + 1] = 0; md[i + 2] = 0; md[i + 3] = 255; } // 其余 → 不透明黑（保留区）
        }
        smallMask.getContext('2d').putImageData(maskData, 0, 0);
        const img = await AI.imageEdit(smallImg, smallMask, AI.cfg.prompts.erase);
        applyResultImage(img);
        this.mask = null;
        U.toast('AI 消除完成 ✨');
      } catch (e) {
        U.toast('AI 消除失败：' + U.fmtErr(e), 5000);
      } finally { setBusy(false); }
    },
    leave() { this.mask = null; },
  };

  /* ============ AI 抠图换背景（VIP） ============ */
  NX.tools['ai-cutout'] = {
    bgColor: '#FFFFFF', bgImage: null, fgCache: null,
    panel() {
      return `<h3>🤖 AI 抠图 <span class="badge">VIP</span></h3>
        <button class="btn block ai" id="coGo">✨ AI 一键抠图</button>
        <h4>换背景</h4>
        <div class="swatch-row">
          ${['#FFFFFF', '#FFD93D', '#438EDB', '#D8352A', '#7CB342', '#000000'].map(c =>
            `<div class="swatch ${this.bgColor === c ? 'active' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}
        </div>
        <div class="row"><label>自定义</label><input type="color" id="coColor" value="${this.bgColor}"></div>
        <button class="btn block" id="coBgImg">🖼 用图片做背景</button>
        <button class="btn block primary" id="coApply">✅ 合成并应用</button>
        <button class="btn block" id="coSaveFg">💾 下载透明 PNG</button>
        <p class="panel-note ai">AI 抠图需要配置 API。未配置时可用「证件照」里的色键抠图兜底。</p>`;
    },
    bind() {
      U.$$('#panel .swatch').forEach(s => s.addEventListener('click', () => {
        this.bgColor = s.dataset.c; U.$('#coColor').value = s.dataset.c;
        U.$$('#panel .swatch').forEach(x => x.classList.toggle('active', x === s));
      }));
      U.$('#coColor').addEventListener('input', e => this.bgColor = e.target.value);
      U.$('#coGo').addEventListener('click', () => this.run());
      U.$('#coBgImg').addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async (e) => {
          try { this.bgImage = await U.loadImageFromFile(e.target.files[0]); U.toast('背景图已加载'); }
          catch (err) { U.toast('背景图加载失败'); }
        };
        inp.click();
      });
      U.$('#coApply').addEventListener('click', () => {
        if (!this.fgCache) { U.toast('请先执行 AI 抠图'); return; }
        S().base = P.replaceBackground(this.fgCache, { color: this.bgImage ? null : this.bgColor, image: this.bgImage });
        this.fgCache = null; this.bgImage = null;
        C.pushHistory(); C.render();
        U.toast('背景已替换');
      });
      U.$('#coSaveFg').addEventListener('click', () => {
        if (this.fgCache) U.downloadCanvas(this.fgCache, 'cutout_' + Date.now() + '.png');
      });
    },
    async run() {
      if (needConfig()) return;
      setBusy(true, '🤖 AI 抠图中…');
      try {
        const { canvas: small } = AI.fitForAPI(S().base);
        const img = await AI.imageEdit(small, null, AI.cfg.prompts.cutout, { background: 'transparent' });
        // 结果缩回原尺寸
        const fg = U.makeCanvas(S().base.width, S().base.height);
        fg.getContext('2d').drawImage(img, 0, 0, fg.width, fg.height);
        this.fgCache = fg;
        // 预览：棋盘格上显示
        const preview = P.replaceBackground(fg, { color: this.bgColor });
        S().base.getContext('2d').drawImage(preview, 0, 0);
        C.render();
        U.toast('抠图完成，选背景色后点「合成并应用」');
      } catch (e) {
        U.toast('AI 抠图失败：' + U.fmtErr(e), 5000);
      } finally { setBusy(false); }
    },
    leave() { this.fgCache = null; this.bgImage = null; },
  };

  /* ============ AI 扩图（VIP） ============ */
  NX.tools['ai-expand'] = {
    ratio: '16/9',
    panel() {
      return `<h3>🤖 AI 扩图 <span class="badge">VIP</span></h3>
        <div class="chip-grid" id="exRatios">
          ${[['16/9', '16:9 横屏'], ['9/16', '9:16 竖屏'], ['4/3', '4:3'], ['1', '1:1 方形'], ['2', '宽幅 2:1'], ['0.5', '竖幅 1:2']].map(([v, n], i) =>
            `<button class="chip ${i === 0 ? 'active' : ''}" data-r="${v}">${n}</button>`).join('')}
        </div>
        <button class="btn block ai" id="exGo">✨ AI 扩图</button>
        <button class="btn block" id="exLocal">📏 本地边缘拉伸(兜底)</button>
        <p class="panel-note ai">把图片放入目标比例画布中央，透明区域由 AI 智能补全。</p>`;
    },
    bind() {
      U.$$('#exRatios .chip').forEach(b => b.addEventListener('click', () => {
        this.ratio = b.dataset.r;
        U.$$('#exRatios .chip').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.$('#exGo').addEventListener('click', () => this.run());
      U.$('#exLocal').addEventListener('click', () => this.localExpand());
    },
    buildExpanded() {
      const b = S().base;
      const ratio = parseFloat(this.ratio);
      let W = b.width, H = Math.round(W / ratio);
      if (H < b.height) { H = b.height; W = Math.round(H * ratio); }
      const canvas = U.makeCanvas(W, H);
      const x = Math.round((W - b.width) / 2), y = Math.round((H - b.height) / 2);
      canvas.getContext('2d').drawImage(b, x, y);
      return { canvas, x, y };
    },
    async run() {
      if (needConfig()) return;
      setBusy(true, '🤖 AI 扩图中…');
      try {
        const { canvas: big, x, y } = this.buildExpanded();
        // mask：原图区域不透明，扩展区透明
        const mask = U.makeCanvas(big.width, big.height);
        const mctx = mask.getContext('2d');
        mctx.fillStyle = '#000'; mctx.fillRect(0, 0, mask.width, mask.height);
        mctx.clearRect(x, y, S().base.width, S().base.height); // 透明 = 原图保留？OpenAI 约定：透明=编辑
        // 反过来：透明区域会被编辑 —— 我们要编辑"扩展区"，保留原图区
        mctx.clearRect(0, 0, mask.width, mask.height);
        mctx.fillStyle = 'rgba(0,0,0,1)';
        mctx.fillRect(x, y, S().base.width, S().base.height); // 保留区不透明
        // 需要 mask 与 image 同尺寸且 image 的扩展区 alpha<1 才会被重绘：把扩展区 alpha 置 0
        const { canvas: small } = AI.fitForAPI(big, 1024);
        const sctx = small.getContext('2d');
        const id = sctx.getImageData(0, 0, small.width, small.height);
        const sc = small.width / big.width;
        const rx = Math.round(x * sc), ry = Math.round(y * sc);
        const rw = Math.round(S().base.width * sc), rh = Math.round(S().base.height * sc);
        const d = id.data;
        for (let py = 0; py < small.height; py++) for (let px = 0; px < small.width; px++) {
          if (px < rx || px >= rx + rw || py < ry || py >= ry + rh) d[(py * small.width + px) * 4 + 3] = 0;
        }
        sctx.putImageData(id, 0, 0);
        const img = await AI.imageEdit(small, null, AI.cfg.prompts.expand);
        const out = U.makeCanvas(big.width, big.height);
        out.getContext('2d').drawImage(img, 0, 0, out.width, out.height);
        C.flattenOverlays();
        S().base = out;
        C.pushHistory(); C.render();
        U.toast('AI 扩图完成 ✨');
      } catch (e) {
        U.toast('AI 扩图失败：' + U.fmtErr(e), 5000);
      } finally { setBusy(false); }
    },
    localExpand() {
      // 兜底：镜像边缘拉伸
      const { canvas: big, x, y } = this.buildExpanded();
      const b = S().base, ctx = big.getContext('2d');
      const strip = Math.min(80, Math.min(b.width, b.height) >> 2);
      // 左右
      if (x > 0) {
        ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1);
        ctx.drawImage(b, 0, 0, strip, b.height, 0, y, x, b.height); ctx.restore();
        ctx.save(); ctx.translate(x + b.width * 2, 0); ctx.scale(-1, 1);
        ctx.drawImage(b, b.width - strip, 0, strip, b.height, x + b.width, y, big.width - x - b.width, b.height); ctx.restore();
      }
      // 上下
      if (y > 0) {
        ctx.save(); ctx.translate(0, y); ctx.scale(1, -1);
        ctx.drawImage(b, 0, 0, b.width, strip, x, 0, b.width, y); ctx.restore();
        ctx.save(); ctx.translate(0, y + b.height * 2); ctx.scale(1, -1);
        ctx.drawImage(b, 0, b.height - strip, b.width, strip, x, y + b.height, b.width, big.height - y - b.height); ctx.restore();
        // 四角用模糊填
        ctx.filter = 'blur(2px)';
      }
      P.boxBlur(big, 1);
      C.flattenOverlays();
      S().base = big;
      C.pushHistory(); C.render();
      U.toast('已用边缘镜像扩展（本地兜底）');
    },
    leave() {},
  };

  /* ============ AI 绘画（VIP） ============ */
  NX.tools['ai-draw'] = {
    style: '无',
    styles: ['无', '吉卜力动画风', '水彩插画', '油画质感', '赛博朋克', '国潮工笔', '3D 皮克斯', '像素艺术', '黑白线稿'],
    panel() {
      return `<h3>🤖 AI 绘画 <span class="badge">VIP</span></h3>
        <div class="row"><label>提示词</label><textarea id="drPrompt" placeholder="描述你想要的画面，如：一只柠檬味的猫在花园里"></textarea></div>
        <div class="chip-grid" id="drStyles">
          ${this.styles.map((s, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-s="${U.esc(s)}">${s}</button>`).join('')}
        </div>
        <div class="row"><label>尺寸</label><select id="drSize">
          <option value="1024x1024">方形 1024</option>
          <option value="1536x1024">横版 1536×1024</option>
          <option value="1024x1536">竖版 1024×1536</option>
        </select></div>
        <button class="btn block ai" id="drGo">🎨 生成图片</button>
        <button class="btn block" id="drImg2Img">🖼 以当前图为参考(图生图)</button>
        <p class="panel-note ai">生成的图会替换当前画布，记得先保存原图。</p>`;
    },
    bind() {
      U.$$('#drStyles .chip').forEach(b => b.addEventListener('click', () => {
        this.style = b.dataset.s;
        U.$$('#drStyles .chip').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.$('#drGo').addEventListener('click', () => this.run(false));
      U.$('#drImg2Img').addEventListener('click', () => this.run(true));
    },
    async run(img2img) {
      if (needConfig()) return;
      const prompt = (U.$('#drPrompt').value || '').trim();
      if (!prompt) { U.toast('请填写提示词'); return; }
      const full = this.style !== '无' ? `${prompt}，${this.style}` : prompt;
      setBusy(true, '🤖 AI 绘画中…');
      try {
        let img;
        if (img2img && S().base) {
          const { canvas: small } = AI.fitForAPI(S().base);
          img = await AI.imageEdit(small, null, 'Redraw this image: ' + full);
        } else {
          img = await AI.imageGen(full, { size: U.$('#drSize').value });
        }
        // 作为新图片载入
        C.setImage(img);
        U.toast('AI 绘画完成 🎨');
      } catch (e) {
        U.toast('AI 绘画失败：' + U.fmtErr(e), 5000);
      } finally { setBusy(false); }
    },
    leave() {},
  };

  /* ============ AI 写真 / 风格迁移（VIP） ============ */
  NX.tools['ai-portrait'] = {
    style: '日系写真',
    styles: ['日系写真', '港风复古', '韩式证件照', '动漫头像', '油画肖像', '童话绘本', '水墨国风', '美式复古海报'],
    panel() {
      return `<h3>🤖 AI 写真 <span class="badge">VIP</span></h3>
        <div class="chip-grid" id="ptStyles">
          ${this.styles.map((s, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-s="${U.esc(s)}">${s}</button>`).join('')}
        </div>
        <div class="row"><label>补充</label><input type="text" id="ptExtra" placeholder="可选：额外要求，如 微笑、侧光"></div>
        <button class="btn block ai" id="ptGo">✨ 生成写真</button>
        <p class="panel-note ai">基于当前照片做风格迁移，人脸特征会尽量保留（取决于所用模型能力）。</p>`;
    },
    bind() {
      U.$$('#ptStyles .chip').forEach(b => b.addEventListener('click', () => {
        this.style = b.dataset.s;
        U.$$('#ptStyles .chip').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.$('#ptGo').addEventListener('click', () => this.run());
    },
    async run() {
      if (needConfig()) return;
      setBusy(true, '🤖 AI 写真生成中…');
      try {
        const { canvas: small } = AI.fitForAPI(S().base);
        const extra = (U.$('#ptExtra').value || '').trim();
        const prompt = `Transform this photo into a ${this.style} style portrait, keep the person's identity and facial features recognizable, high quality, professional.` + (extra ? ' ' + extra : '');
        const img = await AI.imageEdit(small, null, prompt);
        applyResultImage(img);
        U.toast('写真已生成 ✨');
      } catch (e) {
        U.toast('AI 写真失败：' + U.fmtErr(e), 5000);
      } finally { setBusy(false); }
    },
    leave() {},
  };

  /* ============ AI 变清晰 / 画质修复（VIP） ============ */
  NX.tools['ai-upscale'] = {
    panel() {
      return `<h3>🤖 画质修复 <span class="badge">VIP</span></h3>
        <button class="btn block ai" id="upAI">✨ AI 变清晰</button>
        <button class="btn block" id="upLocal">🔍 本地锐化增强(兜底)</button>
        <p class="panel-note ai">AI 修复：去噪点、去压缩痕迹、增强细节（送 API 处理）。本地兜底：锐化+对比度。</p>`;
    },
    bind() {
      U.$('#upAI').addEventListener('click', async () => {
        if (needConfig()) return;
        setBusy(true, '🤖 AI 修复中…');
        try {
          const { canvas: small } = AI.fitForAPI(S().base);
          const img = await AI.imageEdit(small, null, AI.cfg.prompts.upscale);
          applyResultImage(img);
          U.toast('画质修复完成 ✨');
        } catch (e) {
          U.toast('AI 修复失败：' + U.fmtErr(e), 5000);
        } finally { setBusy(false); }
      });
      U.$('#upLocal').addEventListener('click', () => {
        C.commitAdjustments(); C.flattenOverlays();
        P.sharpen(S().base, 0.5);
        P.clarity(S().base, 0.3);
        C.pushHistory(); C.render();
        U.toast('本地增强完成');
      });
    },
    leave() {},
  };
})();
