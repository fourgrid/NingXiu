/* ============ 柠檬秀秀 - 相机（拍照直入编辑器） ============ */
(function (Cam) {
  const U = NX.util, C = NX.core;

  // 拍照风格预设（参考美颜相机：苹果模式/原生模式/质感/胶片）
  Cam.STYLES = [
    { id: 'none',    name: '原生模式', css: '' },
    { id: 'apple',   name: '苹果模式', css: 'contrast(1.05) saturate(1.05) brightness(1.02)' },
    { id: 'soft',    name: '柔肤',     css: 'brightness(1.08) contrast(0.92) saturate(1.05)' },
    { id: 'fresh',   name: '清新',     css: 'brightness(1.08) saturate(1.18)' },
    { id: 'film',    name: '胶片',     css: 'contrast(1.12) saturate(0.85) sepia(0.15)' },
    { id: 'bw',      name: '黑白',     css: 'grayscale(1) contrast(1.1)' },
  ];

  Cam.stream = null;
  Cam.facing = 'user';   // 前置优先（自拍场景）
  Cam.style = 'none';

  Cam.open = async function () {
    const page = U.$('#cameraPage');
    page.hidden = false;
    // 风格 chips
    U.$('#camStyles').innerHTML = Cam.STYLES.map(s =>
      `<button class="cam-style ${s.id === Cam.style ? 'active' : ''}" data-s="${s.id}">${s.name}</button>`).join('');
    U.$$('#camStyles .cam-style').forEach(b => b.addEventListener('click', () => {
      Cam.style = b.dataset.s;
      U.$$('#camStyles .cam-style').forEach(x => x.classList.toggle('active', x === b));
      Cam.applyStylePreview();
    }));
    await Cam.startStream();
  };

  Cam.startStream = async function () {
    if (Cam.stream) Cam.stream.getTracks().forEach(t => t.stop());
    try {
      Cam.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: Cam.facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
    } catch (e) {
      // 鸿蒙 ArkWeb 里若没有前置/权限失败，退回任意摄像头
      try {
        Cam.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (e2) {
        U.toast('相机不可用：' + U.fmtErr(e2));
        Cam.close();
        return;
      }
    }
    const v = U.$('#camVideo');
    v.srcObject = Cam.stream;
    Cam.applyStylePreview();
  };

  Cam.applyStylePreview = function () {
    const s = Cam.STYLES.find(x => x.id === Cam.style);
    U.$('#camVideo').style.filter = (s && s.css) || 'none';
    // 前置镜像
    U.$('#camVideo').style.transform = Cam.facing === 'user' ? 'scaleX(-1)' : 'none';
  };

  Cam.shoot = function () {
    const v = U.$('#camVideo');
    if (!Cam.stream || !v.videoWidth) { U.toast('相机还没准备好'); return; }
    const c = U.makeCanvas(v.videoWidth, v.videoHeight);
    const ctx = c.getContext('2d');
    // 前置镜像校正
    if (Cam.facing === 'user') { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    const s = Cam.STYLES.find(x => x.id === Cam.style);
    if (s && s.css && C.filterSupported) ctx.filter = s.css;
    ctx.drawImage(v, 0, 0);
    Cam.close();
    const img = new Image();
    img.onload = () => { C.setImage(img); U.toast('已拍照，开始 P 图吧 🍋'); };
    img.src = c.toDataURL('image/jpeg', 0.95);
  };

  Cam.flip = function () {
    Cam.facing = Cam.facing === 'user' ? 'environment' : 'user';
    Cam.startStream();
  };

  Cam.close = function () {
    if (Cam.stream) { Cam.stream.getTracks().forEach(t => t.stop()); Cam.stream = null; }
    U.$('#camVideo').srcObject = null;
    U.$('#cameraPage').hidden = true;
  };

  // 绑定
  document.getElementById('camShutter').addEventListener('click', Cam.shoot);
  document.getElementById('camClose').addEventListener('click', Cam.close);
  document.getElementById('camFlip').addEventListener('click', Cam.flip);
})(window.NX.camera = {});
