/* ============ 柠檬秀秀 - 专业工具：曲线 / 校正（透视/拉直/白平衡） ============ */
(function () {
  const U = NX.util, C = NX.core, P = NX.pixels;
  const S = () => C.state;
  NX.tools = NX.tools || {};

  /* ============ 曲线 ============ */
  NX.tools.curves = {
    channel: 'all',
    points: { all: [[0, 0], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] },
    live: true, dragIdx: -1, scratch: null,
    CW: 260, CH: 160,
    panel() {
      return `<h3>📈 曲线</h3>
        <div class="chip-grid" style="grid-template-columns:repeat(4,1fr)" id="cvCh">
          ${[['all','明度'],['r','红'],['g','绿'],['b','蓝']].map(([k, n]) =>
            `<button class="chip ${this.channel === k ? 'active' : ''}" data-ch="${k}">${n}</button>`).join('')}
        </div>
        <canvas id="cvCanvas" width="${this.CW}" height="${this.CH}"
          style="width:100%;background:#1c1c1e;border-radius:10px;touch-action:none;cursor:crosshair"></canvas>
        <div class="row"><label>实时预览</label><input type="checkbox" id="cvLive" ${this.live ? 'checked' : ''} style="flex:none"></div>
        <button class="btn block primary" id="cvApply">✅ 应用曲线</button>
        <button class="btn block" id="cvReset">↺ 重置本通道</button>
        <p class="hint">拖动打点调曲线；双击删除点。横轴=原亮度，纵轴=输出亮度。</p>`;
    },
    bind() {
      U.$$('#cvCh [data-ch]').forEach(b => b.addEventListener('click', () => {
        this.channel = b.dataset.ch;
        U.$$('#cvCh [data-ch]').forEach(x => x.classList.toggle('active', x === b));
        this.drawEditor();
      }));
      U.$('#cvLive').addEventListener('change', e => { this.live = e.target.checked; C.render(); });
      U.$('#cvApply').addEventListener('click', () => this.apply());
      U.$('#cvReset').addEventListener('click', () => {
        this.points[this.channel] = [[0, 0], [255, 255]];
        this.drawEditor(); this.preview();
      });
      const cv = U.$('#cvCanvas');
      cv.addEventListener('pointerdown', e => this.onEditorDown(e));
      cv.addEventListener('pointermove', e => this.onEditorMove(e));
      cv.addEventListener('pointerup', e => { this.dragIdx = -1; });
      cv.addEventListener('dblclick', e => this.onEditorDbl(e));
      this.drawEditor();
    },
    toXY(e) {
      const r = U.$('#cvCanvas').getBoundingClientRect();
      return {
        x: U.clamp((e.clientX - r.left) / r.width * 255, 0, 255),
        y: U.clamp(255 - (e.clientY - r.top) / r.height * 255, 0, 255),
      };
    },
    pts() { return this.points[this.channel]; },
    findPt(p) {
      const pts = this.pts();
      for (let i = 0; i < pts.length; i++)
        if (Math.abs(pts[i][0] - p.x) < 14 && Math.abs(pts[i][1] - p.y) < 14) return i;
      return -1;
    },
    onEditorDown(e) {
      e.preventDefault();
      const p = this.toXY(e);
      const i = this.findPt(p);
      if (i >= 0) { this.dragIdx = i; return; }
      const pts = this.pts();
      pts.push([p.x, p.y]);
      pts.sort((a, b) => a[0] - b[0]);
      this.dragIdx = pts.findIndex(pt => pt[0] === p.x && pt[1] === p.y);
      this.drawEditor(); this.preview();
    },
    onEditorMove(e) {
      if (this.dragIdx < 0) return;
      const p = this.toXY(e);
      const pts = this.pts();
      const i = this.dragIdx;
      // 端点只能上下动
      const minX = i > 0 ? pts[i - 1][0] + 1 : 0;
      const maxX = i < pts.length - 1 ? pts[i + 1][0] - 1 : 255;
      pts[i] = [U.clamp(p.x, minX, maxX), p.y];
      if (i === 0) pts[i][0] = 0;
      if (i === pts.length - 1) pts[i][0] = 255;
      this.drawEditor();
      this.preview();
    },
    onEditorDbl(e) {
      const p = this.toXY(e);
      const i = this.findPt(p);
      const pts = this.pts();
      if (i > 0 && i < pts.length - 1) { pts.splice(i, 1); this.drawEditor(); this.preview(); }
    },
    drawEditor() {
      const cv = U.$('#cvCanvas');
      if (!cv) return;
      const ctx = cv.getContext('2d');
      const W = this.CW, H = this.CH;
      ctx.clearRect(0, 0, W, H);
      // 网格
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(W * i / 4, 0); ctx.lineTo(W * i / 4, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, H * i / 4); ctx.lineTo(W, H * i / 4); ctx.stroke();
      }
      // 对角线
      ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, 0); ctx.stroke();
      ctx.setLineDash([]);
      // 曲线
      const lut = P.buildCurveLUT(this.pts());
      const colors = { all: '#FFD93D', r: '#FF5A5A', g: '#5AD85A', b: '#5A9CFF' };
      ctx.strokeStyle = colors[this.channel]; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < 256; x++) {
        const px = x / 255 * W, py = H - lut[x] / 255 * H;
        x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
      // 控制点
      for (const [px, py] of this.pts()) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px / 255 * W, H - py / 255 * H, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = colors[this.channel];
        ctx.beginPath(); ctx.arc(px / 255 * W, H - py / 255 * H, 3, 0, Math.PI * 2); ctx.fill();
      }
    },
    isIdentity() {
      return Object.values(this.points).every(pts =>
        pts.length === 2 && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 255 && pts[1][1] === 255);
    },
    preview: null,  // 下面赋值防抖
    _doPreview() {
      if (!this.live || !S().base) { C.render(); return; }
      if (this.isIdentity()) { this.scratch = null; C.render(); return; }
      this.scratch = U.cloneCanvas(S().base);
      P.applyLUT(this.scratch, {
        all: P.buildCurveLUT(this.points.all),
        r: P.buildCurveLUT(this.points.r),
        g: P.buildCurveLUT(this.points.g),
        b: P.buildCurveLUT(this.points.b),
      });
      C.render();
    },
    draw(ctx) {
      if (this.scratch && this.live && !this.isIdentity()) {
        ctx.save(); ctx.drawImage(this.scratch, 0, 0); ctx.restore();
      }
    },
    apply() {
      if (this.isIdentity()) { U.toast('曲线未调整'); return; }
      C.commitAdjustments(); C.flattenOverlays();
      P.applyLUT(S().base, {
        all: P.buildCurveLUT(this.points.all),
        r: P.buildCurveLUT(this.points.r),
        g: P.buildCurveLUT(this.points.g),
        b: P.buildCurveLUT(this.points.b),
      });
      this.points = { all: [[0, 0], [255, 255]], r: [[0, 0], [255, 255]], g: [[0, 0], [255, 255]], b: [[0, 0], [255, 255]] };
      this.scratch = null;
      C.pushHistory(); C.render();
      this.drawEditor();
      U.toast('曲线已应用 📈');
    },
    enter() { this.scratch = null; },
    leave() { this.scratch = null; },
  };
  NX.tools.curves.preview = U.debounce(() => NX.tools.curves._doPreview(), 250);

  /* ============ 校正（旋转拉直 / 透视 / 白平衡） ============ */
  NX.tools.correct = {
    wbMode: false,
    panel() {
      return `<h3>📐 校正</h3>
        ${U.sliderRow('crRot', '旋转拉直', -45, 45, 0, 0.5)}
        ${U.sliderRow('crVK', '垂直透视', -50, 50, 0)}
        ${U.sliderRow('crHK', '水平透视', -50, 50, 0)}
        <button class="btn block primary" id="crApply">✅ 应用校正</button>
        <h4>白平衡</h4>
        <button class="btn block" id="crWB">💧 点选白平衡（点画面中的灰/白色）</button>
        <p class="hint">透视用于校正拍歪的建筑/文档（梯形畸变）；旋转拉直画布会自适应扩大。</p>`;
    },
    bind() {
      U.bindSlider('crRot', () => {}); U.bindSlider('crVK', () => {}); U.bindSlider('crHK', () => {});
      U.$('#crApply').addEventListener('click', () => {
        const rot = parseFloat(U.$('#crRot').value);
        const vk = parseInt(U.$('#crVK').value) / 100;
        const hk = parseInt(U.$('#crHK').value) / 100;
        if (!rot && !vk && !hk) { U.toast('没有调整'); return; }
        C.commitAdjustments(); C.flattenOverlays();
        let out = S().base;
        if (rot) out = P.rotateFree(out, rot);
        if (vk || hk) out = P.keystone(out, vk, hk);
        S().base = out;
        C.pushHistory(); C.render();
        U.toast('校正完成 📐');
        NX.main.refreshPanel();
      });
      U.$('#crWB').addEventListener('click', () => {
        this.wbMode = !this.wbMode;
        U.$('#crWB').textContent = this.wbMode ? '💧 点画面中的中性色…' : '💧 点选白平衡（点画面中的灰/白色）';
      });
    },
    onDown(p) {
      if (!this.wbMode) return;
      const gains = P.whiteBalanceAt(S().base, Math.round(p.x), Math.round(p.y));
      if (!gains) { U.toast('该点太暗，换个亮点'); return; }
      C.commitAdjustments(); C.flattenOverlays();
      P.applyWB(S().base, gains);
      C.pushHistory(); C.render();
      this.wbMode = false;
      NX.main.refreshPanel();
      U.toast('白平衡已校正 💧');
    },
    leave() { this.wbMode = false; },
  };
})();
