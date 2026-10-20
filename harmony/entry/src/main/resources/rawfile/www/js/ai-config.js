/* ============ 柠檬秀秀 - AI 配置中心 & API 调用层 ============ */
(function (AI) {
  const U = NX.util;
  const LS_KEY = 'ningmeng_ai_config_v1';

  AI.cfg = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    // 各能力使用的模型（OpenAI 兼容 /images 接口）
    modelEdit: 'gpt-image-1',      // 图像编辑（消除/扩图/写真/修复/抠图）
    modelDraw: 'gpt-image-1',      // 文生图
    // 高级：自定义各功能提示词前缀
    prompts: {
      erase: 'Remove the masked object completely and fill the area with a natural, seamless background that matches the surroundings.',
      expand: 'Extend the image naturally into the transparent masked areas, keeping the original scene, lighting and style consistent.',
      cutout: 'Keep only the main subject with a fully transparent background, preserving fine edge details like hair.',
      upscale: 'Enhance this image to high quality: sharpen details, remove noise and compression artifacts, keep colors and composition identical.',
    },
  };

  AI.load = function () {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(AI.cfg, saved);
        AI.cfg.prompts = Object.assign({ erase: '', expand: '', cutout: '', upscale: '' }, AI.cfg.prompts, saved.prompts || {});
      }
    } catch (e) { /* 忽略损坏配置 */ }
  };
  AI.save = function () {
    localStorage.setItem(LS_KEY, JSON.stringify(AI.cfg));
    U.toast('AI 配置已保存 ✅');
  };
  AI.configured = () => !!(AI.cfg.baseUrl && AI.cfg.apiKey);
  AI.load();

  /* ---------- 通用请求 ---------- */
  function canvasToBlob(canvas, type) {
    return new Promise(res => canvas.toBlob(res, type || 'image/png'));
  }

  // 限制送 API 的尺寸（控制 token/耗时），返回 {canvas, scale}
  AI.fitForAPI = function (canvas, maxSide) {
    maxSide = maxSide || 1024;
    const w = canvas.width, h = canvas.height;
    const s = Math.min(1, maxSide / Math.max(w, h));
    if (s >= 1) return { canvas, scale: 1 };
    const c = U.makeCanvas(w * s, h * s);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return { canvas: c, scale: s };
  };

  async function parseImageResponse(resp) {
    const json = await resp.json().catch(() => null);
    if (!resp.ok) {
      const msg = json && json.error && json.error.message ? json.error.message : ('HTTP ' + resp.status);
      throw new Error(msg);
    }
    const item = json && json.data && json.data[0];
    if (!item) throw new Error('API 未返回图像数据');
    let url;
    if (item.b64_json) url = 'data:image/png;base64,' + item.b64_json;
    else if (item.url) url = item.url;
    else throw new Error('API 返回格式不支持');
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('结果图加载失败'));
      img.src = url;
    });
  }

  // 图像编辑（multipart: image[, mask], prompt）→ HTMLImageElement
  AI.imageEdit = async function (imageCanvas, maskCanvas, prompt, opts) {
    if (!AI.configured()) throw new Error('请先在「AI设置」中填写 API 地址和 Key');
    opts = opts || {};
    const fd = new FormData();
    fd.append('model', opts.model || AI.cfg.modelEdit);
    fd.append('image', await canvasToBlob(imageCanvas), 'image.png');
    if (maskCanvas) fd.append('mask', await canvasToBlob(maskCanvas), 'mask.png');
    if (opts.background) fd.append('background', opts.background); // 'transparent'
    fd.append('prompt', prompt);
    const resp = await fetch(AI.cfg.baseUrl.replace(/\/$/, '') + '/images/edits', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AI.cfg.apiKey },
      body: fd,
    });
    return parseImageResponse(resp);
  };

  // 文生图 → HTMLImageElement
  AI.imageGen = async function (prompt, opts) {
    if (!AI.configured()) throw new Error('请先在「AI设置」中填写 API 地址和 Key');
    opts = opts || {};
    const resp = await fetch(AI.cfg.baseUrl.replace(/\/$/, '') + '/images/generations', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + AI.cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model || AI.cfg.modelDraw,
        prompt,
        n: 1,
        size: opts.size || '1024x1024',
      }),
    });
    return parseImageResponse(resp);
  };

  // 连接测试：GET /models
  AI.testConnection = async function () {
    if (!AI.configured()) throw new Error('请先填写 API 地址和 Key');
    const resp = await fetch(AI.cfg.baseUrl.replace(/\/$/, '') + '/models', {
      headers: { 'Authorization': 'Bearer ' + AI.cfg.apiKey },
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
    const json = await resp.json().catch(() => ({}));
    const n = json && json.data ? json.data.length : 0;
    return '连接成功' + (n ? `，可见 ${n} 个模型` : '');
  };

  /* ---------- AI 设置面板（作为一个"工具"注册） ---------- */
  NX.tools = NX.tools || {};
  NX.tools['ai-settings'] = {
    panel() {
      const c = AI.cfg;
      return `<h3>⚙️ AI 设置</h3>
        <div class="row"><label>API地址</label><input type="text" id="aiBase" value="${U.esc(c.baseUrl)}" placeholder="https://api.openai.com/v1"></div>
        <div class="row"><label>API Key</label><input type="password" id="aiKey" value="${U.esc(c.apiKey)}" placeholder="sk-..."></div>
        <div class="row"><label>编辑模型</label><input type="text" id="aiME" value="${U.esc(c.modelEdit)}"></div>
        <div class="row"><label>绘画模型</label><input type="text" id="aiMD" value="${U.esc(c.modelDraw)}"></div>
        <button class="btn block primary" id="aiSave">💾 保存配置</button>
        <button class="btn block" id="aiTest">🔌 测试连接</button>
        <div class="ai-status" id="aiStatus">${AI.configured() ? '✅ 已配置' : '⚠️ 未配置：AI 功能暂不可用，本地功能不受影响'}</div>
        <h4>自定义提示词（高级）</h4>
        <div class="row"><label>消除</label><textarea id="aiPE">${U.esc(c.prompts.erase)}</textarea></div>
        <div class="row"><label>扩图</label><textarea id="aiPX">${U.esc(c.prompts.expand)}</textarea></div>
        <div class="row"><label>抠图</label><textarea id="aiPC">${U.esc(c.prompts.cutout)}</textarea></div>
        <div class="row"><label>修复</label><textarea id="aiPU">${U.esc(c.prompts.upscale)}</textarea></div>
        <p class="panel-note ai">兼容 OpenAI /images 接口的任何服务：OpenAI 官方、SiliconFlow、各类中转站。配置只存在本机 localStorage，不会上传。</p>`;
    },
    bind() {
      U.$('#aiSave').addEventListener('click', () => {
        AI.cfg.baseUrl = U.$('#aiBase').value.trim();
        AI.cfg.apiKey = U.$('#aiKey').value.trim();
        AI.cfg.modelEdit = U.$('#aiME').value.trim() || 'gpt-image-1';
        AI.cfg.modelDraw = U.$('#aiMD').value.trim() || 'gpt-image-1';
        AI.cfg.prompts.erase = U.$('#aiPE').value;
        AI.cfg.prompts.expand = U.$('#aiPX').value;
        AI.cfg.prompts.cutout = U.$('#aiPC').value;
        AI.cfg.prompts.upscale = U.$('#aiPU').value;
        AI.save();
        NX.main.refreshPanel();
      });
      U.$('#aiTest').addEventListener('click', async () => {
        const st = U.$('#aiStatus');
        // 先读最新输入
        AI.cfg.baseUrl = U.$('#aiBase').value.trim();
        AI.cfg.apiKey = U.$('#aiKey').value.trim();
        st.innerHTML = '<span class="spinner">⏳</span> 测试中…';
        try {
          st.textContent = '✅ ' + await AI.testConnection();
        } catch (e) {
          st.textContent = '❌ ' + U.fmtErr(e);
        }
      });
    },
    leave() {},
  };
})(window.NX.ai = {});
