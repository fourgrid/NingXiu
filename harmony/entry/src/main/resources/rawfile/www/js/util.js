/* ============ 柠檬秀秀 - 工具函数 ============ */
window.NX = window.NX || {};

(function (U) {
  U.$ = (sel, el) => (el || document).querySelector(sel);
  U.$$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  let toastTimer = null;
  U.toast = function (msg, ms) {
    const t = U.$('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2200);
  };

  U.loadImageFromFile = function (file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('不是图片文件'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
      img.src = url;
    });
  };

  U.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };

  U.cloneCanvas = function (src) {
    const c = U.makeCanvas(src.width, src.height);
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  };

  U.downloadCanvas = function (canvas, name, type, quality) {
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name || ('ningmeng_' + Date.now() + '.png');
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, type || 'image/png', quality == null ? 0.92 : quality);
  };

  U.debounce = function (fn, ms) {
    let t; return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  };

  U.hexToRgb = function (hex) {
    const m = hex.replace('#', '');
    const v = parseInt(m.length === 3 ? m.split('').map(x => x + x).join('') : m, 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  };

  // 滑杆行 HTML 生成
  U.sliderRow = function (id, label, min, max, val, step) {
    return `<div class="row"><label>${label}</label>` +
      `<input type="range" id="${id}" min="${min}" max="${max}" value="${val}" step="${step || 1}">` +
      `<span class="val" id="${id}_v">${val}</span></div>`;
  };
  U.bindSlider = function (id, onChange, onCommit) {
    const el = U.$('#' + id), val = U.$('#' + id + '_v');
    if (!el) return;
    el.addEventListener('input', () => { val.textContent = el.value; onChange(parseFloat(el.value)); });
    if (onCommit) el.addEventListener('change', () => onCommit(parseFloat(el.value)));
  };

  U.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // dataURL <-> Blob
  U.dataURLtoBlob = function (dataURL) {
    const [head, body] = dataURL.split(',');
    const mime = (head.match(/:(.*?);/) || [])[1] || 'image/png';
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  U.fmtErr = function (e) {
    if (!e) return '未知错误';
    return (e.message || String(e)).slice(0, 300);
  };
})(window.NX.util = {});
