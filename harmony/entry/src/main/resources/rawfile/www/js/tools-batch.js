/* ============ 柠檬秀秀 - 批量处理 & 水印 ============ */
(function () {
  const U = NX.util, C = NX.core, P = NX.pixels;
  const S = () => C.state;
  NX.tools = NX.tools || {};

  /* ============ 批量处理 ============ */
  NX.tools.batch = {
    files: [], results: [], running: false,
    panel() {
      return `<h3>📦 批量处理</h3>
        <button class="btn block primary" id="bpAdd">📂 选择多张图片（已选 ${this.files.length}）</button>
        <h4>统一操作</h4>
        <div class="row"><label>滤镜</label><select id="bpFilter">
          ${Object.entries(C.FILTERS).map(([k, f]) => `<option value="${k}">${f.name}</option>`).join('')}
        </select></div>
        <div class="row"><label>缩放</label><select id="bpScale">
          <option value="1">原尺寸</option><option value="0.5">50%</option>
          <option value="0.75">75%</option><option value="wx">最长边 1080</option>
        </select></div>
        <div class="row"><label>水印</label><input type="text" id="bpWm" placeholder="可选，如 @柠檬"></div>
        <button class="btn block primary" id="bpGo">🚀 开始批量处理</button>
        <div id="bpList"></div>
        <p class="hint">处理结果在下方逐个生成下载链接，逐个点击保存（浏览器会拦截批量自动下载）。</p>`;
    },
    bind() {
      U.$('#bpAdd').addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
        inp.onchange = (e) => { this.files = [...e.target.files]; NX.main.refreshPanel(); };
        inp.click();
      });
      U.$('#bpGo').addEventListener('click', () => this.run());
    },
    async run() {
      if (this.running) return;
      if (!this.files.length) { U.toast('先选择图片'); return; }
      this.running = true;
      const list = U.$('#bpList');
      list.innerHTML = '';
      const filterKey = U.$('#bpFilter').value;
      const scaleOpt = U.$('#bpScale').value;
      const wm = U.$('#bpWm').value.trim();
      for (let i = 0; i < this.files.length; i++) {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<label>${i + 1}.</label><span style="font-size:12px;flex:1">⏳ ${U.esc(this.files[i].name)}</span>`;
        list.appendChild(row);
        try {
          const img = await U.loadImageFromFile(this.files[i]);
          const c = U.makeCanvas(img.width, img.height);
          c.getContext('2d').drawImage(img, 0, 0);
          // 滤镜
          const f = C.FILTERS[filterKey];
          if (f && f.css && C.filterSupported) {
            const c2 = U.makeCanvas(c.width, c.height);
            const x2 = c2.getContext('2d');
            x2.filter = f.css;
            x2.drawImage(c, 0, 0);
            c.width = c2.width; c.height = c2.height;
            c.getContext('2d').drawImage(c2, 0, 0);
            if (f.tint) C.applyTint(c.getContext('2d'), c.width, c.height, f.tint[0], f.tint[1]);
            if (f.noise) P.addNoise(c, f.noise);
            if (f.vig) C.drawVignette(c.getContext('2d'), c.width, c.height, f.vig);
          }
          // 缩放
          let out = c;
          if (scaleOpt !== '1') {
            let s = parseFloat(scaleOpt);
            if (scaleOpt === 'wx') s = Math.min(1, 1080 / Math.max(c.width, c.height));
            const cs = U.makeCanvas(c.width * s, c.height * s);
            cs.getContext('2d').drawImage(c, 0, 0, cs.width, cs.height);
            out = cs;
          }
          // 水印
          if (wm) NX.tools.watermark.applyTo(out, { text: wm, opacity: 30, size: 4, angle: -20 });
          // 生成下载链接
          const url = out.toDataURL('image/jpeg', 0.9);
          row.innerHTML = `<label>${i + 1}.</label><a href="${url}" download="nx_${i + 1}.jpg" style="font-size:12px;color:var(--accent)">💾 ${U.esc(this.files[i].name)}（点击保存）</a>`;
        } catch (e) {
          row.innerHTML = `<label>${i + 1}.</label><span style="font-size:12px;color:var(--danger)">❌ ${U.esc(this.files[i].name)}: ${U.fmtErr(e)}</span>`;
        }
      }
      this.running = false;
      U.toast('批量处理完成 📦');
    },
    leave() {},
  };

  /* ============ 水印 ============ */
  NX.tools.watermark = {
    text: '@柠檬秀秀', opacity: 30, size: 4, angle: -20, color: '#FFFFFF',
    panel() {
      return `<h3>©️ 水印</h3>
        <div class="row"><label>文字</label><input type="text" id="wmText" value="${U.esc(this.text)}"></div>
        ${U.sliderRow('wmOp', '透明度', 5, 80, this.opacity)}
        ${U.sliderRow('wmSize', '大小', 2, 10, this.size)}
        ${U.sliderRow('wmAngle', '角度', -45, 45, this.angle)}
        <div class="row"><label>颜色</label><input type="color" id="wmColor" value="${this.color}"></div>
        <div class="chip-grid">
          <button class="chip active" data-pos="tile">平铺全图</button>
          <button class="chip" data-pos="br">右下角</button>
          <button class="chip" data-pos="bl">左下角</button>
        </div>
        <button class="btn block primary" id="wmApply">✅ 添加水印</button>`;
    },
    pos: 'tile',
    bind() {
      U.$('#wmText').addEventListener('input', e => this.text = e.target.value);
      U.bindSlider('wmOp', v => this.opacity = v);
      U.bindSlider('wmSize', v => this.size = v);
      U.bindSlider('wmAngle', v => this.angle = v);
      U.$('#wmColor').addEventListener('input', e => this.color = e.target.value);
      U.$$('#panel [data-pos]').forEach(b => b.addEventListener('click', () => {
        this.pos = b.dataset.pos;
        U.$$('#panel [data-pos]').forEach(x => x.classList.toggle('active', x === b));
      }));
      U.$('#wmApply').addEventListener('click', () => {
        C.commitAdjustments(); C.flattenOverlays();
        this.applyTo(S().base, { text: this.text, opacity: this.opacity, size: this.size, angle: this.angle, color: this.color, pos: this.pos });
        C.pushHistory(); C.render();
        U.toast('水印已添加 ©️');
      });
    },
    applyTo(canvas, opt) {
      const ctx = canvas.getContext('2d');
      const fontSize = Math.round(canvas.width * opt.size / 100);
      ctx.save();
      ctx.font = `bold ${fontSize}px "PingFang SC", sans-serif`;
      ctx.fillStyle = opt.color || '#FFFFFF';
      ctx.globalAlpha = (opt.opacity || 30) / 100;
      const tw = ctx.measureText(opt.text).width;
      if ((opt.pos || 'tile') === 'tile') {
        const gapX = tw + fontSize * 2.5, gapY = fontSize * 4;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((opt.angle || 0) * Math.PI / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        const ext = Math.max(canvas.width, canvas.height);
        for (let y = -ext; y < canvas.height + ext; y += gapY)
          for (let x = -ext; x < canvas.width + ext; x += gapX)
            ctx.fillText(opt.text, x, y);
      } else {
        const x = opt.pos === 'br' ? canvas.width - tw - fontSize : fontSize;
        const y = canvas.height - fontSize * 1.5;
        ctx.fillText(opt.text, x, y);
      }
      ctx.restore();
    },
    leave() {},
  };
})();
