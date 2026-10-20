/* ============ 柠檬秀秀 - AI 服务配置（cc-switch 风格厂商管理） ============ */
(function (AI) {
  const U = NX.util;
  const LS_KEY = 'ningmeng_ai_config_v2';

  /* ---------- 厂商预置（OpenAI 兼容图像接口；模型名可按厂商文档改） ---------- */
  AI.PRESETS = [
    { id: 'siliconflow', emoji: '🌊', name: '硅基流动 SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1',
      modelEdit: 'Qwen/Qwen-Image-Edit-2509', modelDraw: 'Qwen/Qwen-Image', note: '聚合平台，一个 Key 用多家模型' },
    { id: 'aliyun', emoji: '☁️', name: '阿里百炼（通义万相）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      modelEdit: 'qwen-image-edit-plus', modelDraw: 'wanx2.1-t2i-turbo' },
    { id: 'volces', emoji: '🌋', name: '火山方舟（豆包 Seedream）', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      modelEdit: 'doubao-seedream-4-0-250828', modelDraw: 'doubao-seedream-4-0-250828' },
    { id: 'zhipu', emoji: '🧠', name: '智谱 BigModel（GLM）', baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      modelEdit: 'cogview-4-250304', modelDraw: 'cogview-4-250304' },
    { id: 'baidu', emoji: '🐻', name: '百度千帆（文心）', baseUrl: 'https://qianfan.baidubce.com/v2',
      modelEdit: 'ernie-irag-edit', modelDraw: 'ernie-irag' },
    { id: 'hunyuan', emoji: '🐧', name: '腾讯混元', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
      modelEdit: 'hunyuan-image', modelDraw: 'hunyuan-image' },
    { id: 'minimax', emoji: '🌀', name: 'MiniMax', baseUrl: 'https://api.minimaxi.com/v1',
      modelEdit: 'image-01', modelDraw: 'image-01' },
    { id: 'xfyun', emoji: '🔊', name: '讯飞星火', baseUrl: 'https://spark-api-open.xf-yun.com/v1',
      modelEdit: 'spark-image', modelDraw: 'spark-image' },
    { id: 'kimi', emoji: '🌙', name: '月之暗面 Kimi', baseUrl: 'https://api.moonshot.cn/v1',
      modelEdit: 'kimi-latest', modelDraw: 'kimi-latest',
      note: 'Kimi 擅长文本/图像理解；若图像生成接口未开放，绘画类功能请切别家' },
    { id: 'deepseek', emoji: '🐋', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1',
      modelEdit: 'deepseek-vl2', modelDraw: 'deepseek-vl2',
      note: '同理：文本强，图像生成视模型开放情况' },
    { id: 'openai', emoji: '🌍', name: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1',
      modelEdit: 'gpt-image-1', modelDraw: 'gpt-image-1' },
  ];

  /* ---------- 配置结构 ----------
   * cfg = {
   *   activeId: 'siliconflow',
   *   providers: { id: { baseUrl, apiKey, modelEdit, modelDraw, customName?, customEmoji? } },
   *   prompts: { erase, expand, cutout, upscale }
   * }
   */
  AI.cfg = {
    activeId: '',
    providers: {},
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
        AI.cfg.activeId = saved.activeId || '';
        AI.cfg.providers = saved.providers || {};
        AI.cfg.prompts = Object.assign({}, AI.cfg.prompts, saved.prompts || {});
        return;
      }
      // 迁移 v1 配置
      const v1 = localStorage.getItem('ningmeng_ai_config_v1');
      if (v1) {
        const o = JSON.parse(v1);
        if (o.apiKey) {
          AI.cfg.providers['custom1'] = {
            customName: '我的服务', customEmoji: '⭐',
            baseUrl: o.baseUrl || '', apiKey: o.apiKey,
            modelEdit: o.modelEdit || '', modelDraw: o.modelDraw || '',
          };
          AI.cfg.activeId = 'custom1';
          Object.assign(AI.cfg.prompts, o.prompts || {});
        }
      }
    } catch (e) { /* 配置损坏则用默认 */ }
  };

  AI.save = function () {
    localStorage.setItem(LS_KEY, JSON.stringify(AI.cfg));
  };

  AI.active = function () {
    if (!AI.cfg.activeId) return null;
    const info = AI.providerInfo(AI.cfg.activeId);
    if (!info.apiKey && !info.baseUrl) return null;
    return info;
  };

  AI.configured = function () {
    const a = AI.active();
    return !!(a && a.baseUrl && a.apiKey);
  };

  AI.providerInfo = function (id) {
    const preset = AI.PRESETS.find(x => x.id === id) || {};
    const p = AI.cfg.providers[id] || {};
    return {
      id,
      emoji: preset.emoji || p.customEmoji || '🔧',
      name: preset.name || p.customName || '自定义服务',
      note: preset.note || '',
      baseUrl: p.baseUrl || preset.baseUrl || '',
      apiKey: p.apiKey || '',
      modelEdit: p.modelEdit || preset.modelEdit || '',
      modelDraw: p.modelDraw || preset.modelDraw || '',
      isCustom: !preset.id,
      active: AI.cfg.activeId === id,
      hasKey: !!(p.apiKey),
    };
  };

  AI.load();

  /* ---------- API 调用 ---------- */
  function canvasToBlob(canvas, type) {
    return new Promise(res => canvas.toBlob(res, type || 'image/png'));
  }

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
    if (!item) throw new Error('API 未返回图像数据（该厂商/模型可能不支持此能力）');
    let url;
    if (item.b64_json) url = 'data:image/png;base64,' + item.b64_json;
    else if (item.url) url = item.url;
    else throw new Error('API 返回格式不支持');
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('结果图加载失败（跨域被拒绝）'));
      img.src = url;
    });
  }

  AI.imageEdit = async function (imageCanvas, maskCanvas, prompt, opts) {
    const a = AI.active();
    if (!a || !a.baseUrl || !a.apiKey) throw new Error('请先在「我的 → AI 服务配置」里选择厂商并填 Key');
    opts = opts || {};
    const fd = new FormData();
    fd.append('model', opts.model || a.modelEdit);
    fd.append('image', await canvasToBlob(imageCanvas), 'image.png');
    if (maskCanvas) fd.append('mask', await canvasToBlob(maskCanvas), 'mask.png');
    if (opts.background) fd.append('background', opts.background);
    fd.append('prompt', prompt);
    const resp = await fetch(a.baseUrl.replace(/\/$/, '') + '/images/edits', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + a.apiKey },
      body: fd,
    });
    return parseImageResponse(resp);
  };

  AI.imageGen = async function (prompt, opts) {
    const a = AI.active();
    if (!a || !a.baseUrl || !a.apiKey) throw new Error('请先在「我的 → AI 服务配置」里选择厂商并填 Key');
    opts = opts || {};
    const resp = await fetch(a.baseUrl.replace(/\/$/, '') + '/images/generations', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + a.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: opts.model || a.modelDraw, prompt, n: 1, size: opts.size || '1024x1024' }),
    });
    return parseImageResponse(resp);
  };

  AI.testConnection = async function (providerId) {
    const info = AI.providerInfo(providerId);
    if (!info.baseUrl || !info.apiKey) throw new Error('先填 API 地址和 Key');
    const resp = await fetch(info.baseUrl.replace(/\/$/, '') + '/models', {
      headers: { 'Authorization': 'Bearer ' + info.apiKey },
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
    const json = await resp.json().catch(() => ({}));
    const n = json && json.data ? json.data.length : 0;
    return '连接成功' + (n ? `，可见 ${n} 个模型` : '');
  };

  /* ---------- 设置页渲染（下拉框选厂商，单家配置） ---------- */
  AI.selectedId = AI.selectedId || '';

  AI.renderSettings = function (el) {
    // 默认选中：当前启用的厂商，否则第一家
    if (!AI.selectedId || (!AI.PRESETS.find(x => x.id === AI.selectedId) && !AI.cfg.providers[AI.selectedId])) {
      AI.selectedId = AI.cfg.activeId || AI.PRESETS[0].id;
    }
    const ids = [...AI.PRESETS.map(x => x.id)];
    for (const id in AI.cfg.providers) {
      if (!AI.PRESETS.find(x => x.id === id)) ids.push(id);   // 自定义厂商追加在下拉尾部
    }
    const options = ids.map(id => {
      const info = AI.providerInfo(id);
      const mark = info.active ? ' ✓使用中' : (info.hasKey ? ' ·已填Key' : '');
      return `<option value="${id}" ${id === AI.selectedId ? 'selected' : ''}>${info.emoji} ${U.esc(info.name)}${mark}</option>`;
    }).join('');

    const a = AI.active();
    el.innerHTML = `
      <div class="set-section-title">AI 服务厂商 · 选一个填 Key 即可</div>
      ${a && a.apiKey
        ? `<div class="panel-note ai" style="margin:0 0 10px">当前使用：${a.emoji} ${U.esc(a.name)}</div>`
        : `<div class="panel-note" style="margin:0 0 10px">⚠️ 还没有可用的 AI 服务：选厂商 → 填 Key → 保存 → 启用。本地功能无需配置。</div>`}
      <div class="provider-card">
        <div class="row"><label>厂商</label><select id="pvSelect">${options}</select></div>
        <div id="pvForm"></div>
        <button class="btn block" id="pvAdd">➕ 添加自定义厂商（任何 OpenAI 兼容服务）</button>
      </div>
      <div class="set-section-title">高级 · 自定义提示词</div>
      <div class="provider-card">
        <div class="row"><label>消除</label><textarea id="aiPE">${U.esc(AI.cfg.prompts.erase)}</textarea></div>
        <div class="row"><label>扩图</label><textarea id="aiPX">${U.esc(AI.cfg.prompts.expand)}</textarea></div>
        <div class="row"><label>抠图</label><textarea id="aiPC">${U.esc(AI.cfg.prompts.cutout)}</textarea></div>
        <div class="row"><label>修复</label><textarea id="aiPU">${U.esc(AI.cfg.prompts.upscale)}</textarea></div>
        <button class="btn block primary" id="aiSavePrompts">💾 保存提示词</button>
      </div>
      <div class="set-about">🍋 柠檬秀秀 v2.1<br>Key 只保存在本机 localStorage · 图像接口兼容 OpenAI /images 规范<br>github.com/fourgrid/NingXiu</div>`;
    AI.bindSettings(el);
    AI.renderProviderForm(el, AI.selectedId);
  };

  AI.renderProviderForm = function (el, id) {
    const info = AI.providerInfo(id);
    const form = U.$('#pvForm', el);
    form.innerHTML = `
      <div class="pv-url" style="margin:4px 0 8px">${U.esc(info.baseUrl)}${info.note ? `<br>💡 ${U.esc(info.note)}` : ''}</div>
      ${info.isCustom ? `
        <div class="row"><label>名称</label><input type="text" data-f="customName" value="${U.esc(info.name)}"></div>
        <div class="row"><label>地址</label><input type="text" data-f="baseUrl" value="${U.esc(info.baseUrl)}" placeholder="https://.../v1"></div>` : ''}
      <div class="row"><label>API Key</label><input type="password" data-f="apiKey" value="${U.esc(info.apiKey)}" placeholder="填这家厂商的 Key 就行"></div>
      <div class="row"><label>编辑模型</label><input type="text" data-f="modelEdit" value="${U.esc(info.modelEdit)}"></div>
      <div class="row"><label>绘画模型</label><input type="text" data-f="modelDraw" value="${U.esc(info.modelDraw)}"></div>
      <div class="pv-actions">
        <button class="btn" data-act="save">💾 保存</button>
        <button class="btn" data-act="test">🔌 测试连接</button>
        <button class="btn ${info.active ? 'primary' : 'ai'}" data-act="use">${info.active ? '✓ 使用中' : '启用这家'}</button>
        ${info.isCustom ? '<button class="btn warn" data-act="del">🗑</button>' : ''}
      </div>
      <div class="ai-status" data-role="status" hidden></div>`;

    const collect = () => {
      const p = AI.cfg.providers[id] || {};
      U.$$('input[data-f]', form).forEach(inp => { p[inp.dataset.f] = inp.value.trim(); });
      AI.cfg.providers[id] = p;
      return p;
    };
    form.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
      const act = btn.dataset.act;
      const st = form.querySelector('[data-role="status"]');
      if (act === 'save') {
        collect(); AI.save();
        U.toast('已保存 ✅');
        AI.renderSettings(el);
      } else if (act === 'use') {
        collect();
        if (!(AI.cfg.providers[id] || {}).apiKey) { U.toast('先填 Key 再启用'); return; }
        AI.cfg.activeId = id; AI.save();
        U.toast('已切换到：' + AI.providerInfo(id).name);
        AI.renderSettings(el);
      } else if (act === 'test') {
        collect(); AI.save();
        st.hidden = false; st.textContent = '⏳ 测试中…';
        try { st.textContent = '✅ ' + await AI.testConnection(id); }
        catch (e) { st.textContent = '❌ ' + U.fmtErr(e); }
      } else if (act === 'del') {
        delete AI.cfg.providers[id];
        if (AI.cfg.activeId === id) AI.cfg.activeId = '';
        if (AI.selectedId === id) AI.selectedId = '';
        AI.save(); AI.renderSettings(el);
      }
    }));
  };

  AI.bindSettings = function (el) {
    U.$('#aiSavePrompts', el).addEventListener('click', () => {
      AI.cfg.prompts.erase = U.$('#aiPE', el).value;
      AI.cfg.prompts.expand = U.$('#aiPX', el).value;
      AI.cfg.prompts.cutout = U.$('#aiPC', el).value;
      AI.cfg.prompts.upscale = U.$('#aiPU', el).value;
      AI.save();
      U.toast('提示词已保存 ✅');
    });
    U.$('#pvAdd', el).addEventListener('click', () => {
      const id = 'custom_' + Date.now();
      AI.cfg.providers[id] = { customName: '自定义服务', customEmoji: '⭐', baseUrl: '', apiKey: '', modelEdit: 'gpt-image-1', modelDraw: 'gpt-image-1' };
      AI.selectedId = id;
      AI.save();
      AI.renderSettings(el);
    });
    U.$('#pvSelect', el).addEventListener('change', (e) => {
      // 切换前先收集当前表单未保存的输入
      const form = U.$('#pvForm', el);
      const p = AI.cfg.providers[AI.selectedId] || {};
      U.$$('input[data-f]', form).forEach(inp => { p[inp.dataset.f] = inp.value.trim(); });
      AI.cfg.providers[AI.selectedId] = p;
      AI.save();
      AI.selectedId = e.target.value;
      AI.renderSettings(el);
    });
  };
})(window.NX.ai = {});
