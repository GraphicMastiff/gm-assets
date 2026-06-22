/* ───────────────────────────────────────────────────────────────
   GM service-hover cubes — UX + Motion faces (section-5)   v1.1.0
   Reuses the live cube engine globals (THREE / gmDV / gmUW).
   v1.1 changes:
     • Trigger moved to DOCUMENT-LEVEL DELEGATION (capture phase) —
       immune to gmsvchover re-processing/cloning the card nodes,
       which was stripping the per-card listeners in v1.0.
     • IntersectionObserver on the services section disposes all cube
       loops when it scrolls out of view, so no WebGL rAF runs during
       scroll (protects the snap engine + perf). Rebuilds on next hover.
     • Mouse-look gated by pointer-inside-tile (matches brand: only the
       hovered cube leans), with no node listeners to lose.
   Depends on: window.THREE (r128), window.gmDV, window.gmUW
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* === CONFIG: face image URLs (Webflow CDN, CORS-clean) ========== */
  var FACES = {
    'ux-cube':     'https://cdn.prod.website-files.com/6166559d0e98ddef18bde8c3/6a38091f4e7e069355cfcda0_cube-face-uxui.png',
    'motion-cube': 'https://cdn.prod.website-files.com/6166559d0e98ddef18bde8c3/6a38091f83e3f7b26ef8a4b3_cube-face-motion.png'
  };
  var KEYS = ['ux-cube', 'motion-cube'];
  /* ================================================================ */

  if (window.__gmSvcCubesInit) return;
  window.__gmSvcCubesInit = true;

  var faceCache = {};
  var groups = {};
  var active = null;
  var leaveTimer = 0;

  function ready() {
    return typeof window.THREE !== 'undefined' &&
           typeof window.gmDV === 'function' &&
           typeof window.gmUW === 'function';
  }

  function flatTex(hex) {
    var c = document.createElement('canvas'); c.width = c.height = 4;
    var x = c.getContext('2d'); x.fillStyle = hex; x.fillRect(0, 0, 4, 4);
    return new THREE.CanvasTexture(c);
  }

  function bakeFaces(img) {
    var V = window.gmDV(img), T = 1024;
    return {
      top:   window.gmUW(img, T, V.L, V.C, V.T,  { i: 4, b: 1.00, bg: '#F5F1EC' }),
      left:  window.gmUW(img, T, V.L, V.C, V.BL, { i: 4, b: 1.18, bg: '#EFEAE4' }),
      right: window.gmUW(img, T, V.C, V.R, V.B,  { i: 4, b: 1.04, bg: '#E9E3DD' })
    };
  }

  function buildCube(wrap, src) {
    var S = Math.min(wrap.offsetWidth, wrap.offsetHeight) || 160;
    var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    var cv = document.createElement('canvas');
    cv.width = S * DPR; cv.height = S * DPR;
    cv.style.cssText = 'width:' + S + 'px;height:' + S + 'px;display:block;';
    wrap.appendChild(cv);

    var r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    r.setPixelRatio(DPR); r.setClearColor(0x000000, 0); r.setSize(S, S, false);

    var FR = 2.2, CS = 1.5;
    var sc = new THREE.Scene();
    var cam = new THREE.OrthographicCamera(-FR, FR, FR, -FR, -100, 100);
    cam.position.set(5, 5, 5); cam.lookAt(0, 0, 0);

    var tT = flatTex('#F5F1EC'), lT = flatTex('#EFEAE4'), rT = flatTex('#E9E3DD');
    var fb = new THREE.MeshBasicMaterial({ color: 0xc8c0b8 });
    var grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(CS, CS, CS), [
      new THREE.MeshBasicMaterial({ map: rT }), fb,
      new THREE.MeshBasicMaterial({ map: tT }), fb,
      new THREE.MeshBasicMaterial({ map: lT }), fb
    ]));
    sc.add(grp);

    (function () {
      var SZ = 256, c = document.createElement('canvas'); c.width = c.height = SZ;
      var x = c.getContext('2d');
      var g = x.createRadialGradient(SZ/2, SZ/2, 0, SZ/2, SZ/2, SZ/2);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.5, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, SZ, SZ);
      var sh = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.6),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.35 }));
      sh.rotation.x = -Math.PI/2; sh.rotation.z = Math.PI/4; sh.position.set(0.7, -1.1, 0.7);
      sc.add(sh);
    })();

    function applyBaked(b) {
      tT.image = b.top;   tT.needsUpdate = true;
      lT.image = b.left;  lT.needsUpdate = true;
      rT.image = b.right; rT.needsUpdate = true;
    }
    if (faceCache[src]) {
      applyBaked(faceCache[src]);
    } else {
      var img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = function () { faceCache[src] = bakeFaces(img); applyBaked(faceCache[src]); };
      img.onerror = function () { console.warn('[gm-svc-cubes] face load failed:', src); };
      img.src = src;
    }

    var mx = { x: 0, y: 0 }, tg = { x: 0, y: 0 }, wT = 0, bT = 0;
    function onMove(e) {
      var R = cv.getBoundingClientRect();
      if (e.clientX >= R.left && e.clientX <= R.right && e.clientY >= R.top && e.clientY <= R.bottom) {
        mx.x = ((e.clientX - R.left) / R.width  - 0.5) * 2;
        mx.y = ((e.clientY - R.top)  / R.height - 0.5) * 2;
      } else { mx.x = 0; mx.y = 0; }
    }
    document.addEventListener('mousemove', onMove);
    function lerp(a, b, t) { return a + (b - a) * t; }

    var running = false, raf = 0;
    function frame() {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      wT += 0.016; bT += 0.016;
      tg.x = lerp(tg.x, mx.x, 0.06);
      tg.y = lerp(tg.y, mx.y, 0.06);
      grp.rotation.set(-tg.y * 0.085, Math.sin(wT * 1.15) * 0.038 + tg.x * 0.13, 0);
      grp.position.y = Math.sin(bT * 0.4) * 0.04;
      r.render(sc, cam);
    }
    function resume() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
    function pause()  { running = false; if (raf) cancelAnimationFrame(raf); r.render(sc, cam); }
    function dispose() {
      running = false; if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', onMove);
      try { r.dispose(); r.forceContextLoss && r.forceContextLoss(); } catch (e) {}
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    }
    resume();
    return { dispose: dispose, pause: pause, resume: resume };
  }

  function tilesFor(key) { return [].slice.call(document.querySelectorAll('.cube-image-container.' + key)); }

  function build(key) {
    if (!ready()) return;
    var g = groups[key];
    if (g && g.built) return;
    var tiles = tilesFor(key);
    if (!tiles.length) return;
    groups[key] = { built: true, handles: tiles.map(function (t) {
      if (t.__gmCube) return t.__gmCube;
      var h = buildCube(t, FACES[key]);
      t.__gmCube = h;
      return h;
    }) };
  }
  function dispose(key) {
    var g = groups[key]; if (!g || !g.built) return;
    (g.handles || []).forEach(function (h) { try { h.dispose(); } catch (e) {} });
    tilesFor(key).forEach(function (t) { t.__gmCube = null; });
    groups[key] = { built: false, handles: null };
    if (active === key) active = null;
  }
  function pause(key)  { var g = groups[key]; if (g && g.built) (g.handles || []).forEach(function (h) { h.pause(); }); }
  function resume(key) { var g = groups[key]; if (g && g.built) (g.handles || []).forEach(function (h) { h.resume(); }); }

  function activate(key) {
    clearTimeout(leaveTimer);
    KEYS.forEach(function (k) { if (k !== key) dispose(k); });
    build(key);
    resume(key);
    active = key;
  }
  function deactivate() {
    if (!active) return;
    var k = active;
    pause(k);
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(function () { dispose(k); }, 800);
  }

  function keyForEvent(e) {
    var el = e.target;
    if (!el || !el.closest) return null;
    var card = el.closest('.service-container');
    if (!card) return null;
    if (card.querySelector('.cube-image-container.ux-cube')) return 'ux-cube';
    if (card.querySelector('.cube-image-container.motion-cube')) return 'motion-cube';
    return '__other__';
  }

  document.addEventListener('mouseover', function (e) {
    var key = keyForEvent(e);
    if (key === 'ux-cube' || key === 'motion-cube') activate(key);
    else if (key === '__other__') deactivate();
  }, true);

  document.addEventListener('mouseout', function (e) {
    if (!active) return;
    var to = e.relatedTarget;
    var stillInActive = to && to.closest && (function () {
      var c = to.closest('.service-container');
      return c && c.querySelector('.cube-image-container.' + active);
    })();
    if (!stillInActive) deactivate();
  }, true);

  function watchSection() {
    var sec = document.getElementById('section-5');
    if (!sec) {
      var t = document.querySelector('.cube-image-container.ux-cube');
      sec = t ? t.closest('section') : null;
    }
    if (!sec || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { active = null; KEYS.forEach(dispose); }
      });
    }, { threshold: 0 }).observe(sec);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchSection);
  } else {
    watchSection();
  }
})();
