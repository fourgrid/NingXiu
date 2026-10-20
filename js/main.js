/* ============ 柠檬秀秀 - 主导航：底部 Tab + 二级功能条 ============ */
(function (M) {
  const U = NX.util, C = NX.core;

  // 分类 → 子功能（参考美图秀秀的合并方式）
  const CATEGORIES = [
    { id: 'beautify', icon: '✨', name: '美化', tools: [
      ['filter', '🎨', '滤镜'], ['adjust', '🎚️', '调节'], ['hsl', '🌈', 'HSL'], ['blurbg', '🌫️', '背景虚化'],
    ]},
    { id: 'portrait', icon: '💆', name: '美容', tools: [
      ['beauty', '✨', '一键美颜'], ['liquify', '🌀', '瘦脸大眼'], ['makeup', '💄', '美妆'], ['erase', '🧹', '消除笔'],
    ]},
    { id: 'edit', icon: '✂️', name: '编辑', tools: [
      ['crop', '✂️', '裁剪'], ['rotate', '🔃', '旋转'], ['resize', '📐', '尺寸'], ['idphoto', '🪪', '证件照'],
    ]},
    { id: 'deco', icon: '🖌️', name: '装饰', tools: [
      ['text', '🔤', '文字'], ['sticker', '🌟', '贴纸'], ['doodle', '🖌️', '涂鸦'], ['mosaic', '🔲', '马赛克'], ['frame', '🖼️', '边框'], ['watermark', '©️', '水印'],
    ]},
    { id: 'ai', icon: '🤖', name: 'AI', tools: [
      ['ai-erase', '🧹', 'AI消除', 1], ['ai-cutout', '✂️', 'AI抠图', 1], ['ai-expand', '🖼️', 'AI扩图', 1],
      ['ai-draw', '🎨', 'AI绘画', 1], ['ai-portrait', '📸', 'AI写真', 1], ['ai-upscale', '🔍', '画质修复', 1],
    ]},
    { id: 'collage', icon: '🧩', name: '拼图', tools: [
      ['collage', '🧩', '拼图'], ['template', '📰', '海报模板'], ['batch', '📦', '批量处理'],
    ]},
  ];

  let curCat = 'beautify';

  M.buildNav = function () {
    // 美图式布局：tab 中间插入凸起相机按钮
    const half = Math.ceil(CATEGORIES.length / 2);
    const mkBtn = c => `<button class="tab-btn ${c.id === curCat ? 'active' : ''}" data-cat="${c.id}">${c.icon}<span>${c.name}</span></button>`;
    const camBtn = `<button class="tab-cam" id="tabCam" title="拍照"><span class="cam-disc">📷</span></button>`;
    U.$('#tabbar').innerHTML =
      CATEGORIES.slice(0, half).map(mkBtn).join('') + camBtn + CATEGORIES.slice(half).map(mkBtn).join('');
    U.$$('#tabbar .tab-btn').forEach(b => b.addEventListener('click', () => M.switchTab(b.dataset.cat)));
    U.$('#tabCam').addEventListener('click', () => NX.camera.open());
  };

  M.switchTab = function (catId) {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return;
    curCat = catId;
    U.$$('#tabbar .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === catId));

    M.closeSettings();

    // 渲染二级功能条
    const sub = U.$('#subbar');
    sub.hidden = false;
    sub.innerHTML = cat.tools.map(([k, icon, name, isAI]) =>
      `<button class="sub-chip" data-tool="${k}">${icon} ${name}${isAI ? ' <i class="ai-dot">◆</i>' : ''}</button>`
    ).join('');
    U.$$('#subbar .sub-chip').forEach(b => b.addEventListener('click', () => M.switchTool(b.dataset.tool)));

    if (!C.state.base) {
      U.$('#panel').hidden = true;
      U.$('#panelContent').innerHTML = '<p class="hint">📂 先点右上角「打开图片」</p>';
      U.$('#panel').hidden = false;
      return;
    }
    // 默认选中第一个功能
    M.switchTool(cat.tools[0][0]);
  };

  M.switchTool = function (name) {
    if (!NX.tools[name]) { U.toast('功能未实现: ' + name); return; }
    if (!C.state.base) { U.toast('先打开一张图片'); return; }
    M.closeSettings();
    const s = C.state;
    // 离开调节类工具时自动提交未保存的调节
    if (s.tool && s.tool !== name && ['filter', 'adjust', 'hsl'].includes(s.tool)) {
      C.commitAdjustments();
    }
    if (s.tool && NX.tools[s.tool] && NX.tools[s.tool].leave) NX.tools[s.tool].leave();
    s.tool = name;
    U.$$('#subbar .sub-chip').forEach(b => b.classList.toggle('active', b.dataset.tool === name));
    if (NX.tools[name].enter) NX.tools[name].enter();
    M.refreshPanel();
    C.render();
  };

  M.refreshPanel = function () {
    const t = NX.tools[C.state.tool];
    const panel = U.$('#panel');
    const pc = U.$('#panelContent');
    if (!t || !C.state.base) { pc.innerHTML = '<p class="hint">👆 打开图片后，从下方选择功能</p>'; panel.hidden = !C.state.base; return; }
    panel.hidden = false;
    pc.innerHTML = t.panel();
    if (t.bind) t.bind();
  };

  /* ---------- 设置页 ---------- */
  M.openSettings = function () {
    U.$('#settings').hidden = false;
    U.$('#subbar').hidden = true;
    U.$('#panel').hidden = true;
    NX.ai.renderSettings(U.$('#settingsBody'));
  };
  M.closeSettings = function () {
    U.$('#settings').hidden = true;
  };

  U.$('#btnSettings').addEventListener('click', () => M.openSettings());

  U.$('#setBack').addEventListener('click', () => {
    M.closeSettings();
    // 回到美化 tab
    const firstAI = !NX.ai.configured();
    M.switchTab('beautify');
    if (firstAI) U.toast('提示：本地功能开箱即用，AI 功能配好 Key 即可用');
  });

  // 快捷键
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? C.redo() : C.undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (C.state.base) C.exportImage('png'); }
  });

  // 启动
  M.buildNav();
  M.switchTab('beautify');
})(window.NX.main = {});
