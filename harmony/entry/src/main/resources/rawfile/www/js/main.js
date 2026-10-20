/* ============ 柠檬秀秀 - 主入口：工具切换 / 面板路由 ============ */
(function (M) {
  const U = NX.util, C = NX.core;

  // 侧边栏工具顺序（data-tool 与 NX.tools 对应）
  const TOOL_DEFS = [
    ['filter', '🎨', '滤镜', ''],
    ['adjust', '🎚️', '调节', ''],
    ['hsl', '🌈', 'HSL', 'VIP'],
    ['beauty', '💆', '美容', ''],
    ['liquify', '🌀', '液化', 'VIP'],
    ['makeup', '💄', '美妆', 'VIP'],
    ['crop', '✂️', '裁剪', ''],
    ['rotate', '🔃', '旋转', ''],
    ['resize', '📐', '尺寸', ''],
    ['idphoto', '🪪', '证件照', ''],
    ['mosaic', '🔲', '马赛克', ''],
    ['doodle', '🖌️', '涂鸦', ''],
    ['erase', '🧹', '消除笔', ''],
    ['blurbg', '🌫️', '虚化', ''],
    ['text', '🔤', '文字', ''],
    ['sticker', '🌟', '贴纸', ''],
    ['frame', '🖼️', '边框', ''],
    ['collage', '🧩', '拼图', ''],
    ['template', '📰', '模板', 'VIP'],
    ['ai-erase', '🤖', 'AI消除', 'AI'],
    ['ai-cutout', '✂️', 'AI抠图', 'AI'],
    ['ai-expand', '🖼️', 'AI扩图', 'AI'],
    ['ai-draw', '🎨', 'AI绘画', 'AI'],
    ['ai-portrait', '📸', 'AI写真', 'AI'],
    ['ai-upscale', '🔍', 'AI修复', 'AI'],
    ['ai-settings', '⚙️', 'AI设置', ''],
  ];

  M.buildSidebar = function () {
    const nav = U.$('#sidebar');
    nav.innerHTML = TOOL_DEFS.map(([k, icon, name, badge]) =>
      `<button class="tool-btn" data-tool="${k}" title="${name}">${icon}<span>${name}${badge ? ` <i class="badge">${badge}</i>` : ''}</span></button>`
    ).join('');
    U.$$('#sidebar .tool-btn').forEach(b => b.addEventListener('click', () => M.switchTool(b.dataset.tool)));
  };

  M.switchTool = function (name) {
    if (!NX.tools[name]) { U.toast('功能未实现: ' + name); return; }
    const s = C.state;
    // 离开调节类工具时自动提交未保存的调节
    if (s.tool && s.tool !== name && ['filter', 'adjust', 'hsl'].includes(s.tool)) {
      C.commitAdjustments();
    }
    if (s.tool && NX.tools[s.tool] && NX.tools[s.tool].leave) NX.tools[s.tool].leave();
    s.tool = name;
    U.$$('#sidebar .tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === name));
    if (NX.tools[name].enter) NX.tools[name].enter();
    M.refreshPanel();
    C.render();
  };

  M.refreshPanel = function () {
    const t = NX.tools[C.state.tool];
    const panel = U.$('#panelContent');
    if (!t || !C.state.base) {
      panel.innerHTML = '<p class="hint">👈 打开图片后，从左侧选择功能</p>';
      return;
    }
    panel.innerHTML = t.panel();
    if (t.bind) t.bind();
  };

  // 快捷键
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? C.redo() : C.undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (C.state.base) C.exportImage('png'); }
  });

  // 启动
  M.buildSidebar();
})(window.NX.main = {});
