/* ───────────────────────────────────────────────────────────────
   GM service-hover cubes — UX + Motion faces (section-5)
   Reuses the live hosted cube engine's globals (THREE / gmDV / gmUW),
   parametrised by face image. Builds on real card hover only; bounds
   live WebGL contexts to one card's worth at a time.
   Depends on: window.THREE (r128), window.gmDV, window.gmUW
   ─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* === CONFIG: face image URLs (Webflow CDN, CORS-clean) ========== */
  var FACES = {
    'ux-cube':     'https://cdn.prod.website-files.com/6166559d0e98ddef18bde8c3/6a38091f4e7e069355cfcda0_cube-face-uxui.png',
    'motion-cube': 'https://cdn.prod.website-files.com/6166559d0e98ddef18bde8c3/6a38091f83e3f7b26ef8a4b3_cube-face-motion.png'
  };
  /* ================================================================ */

  if (window.__gmSvcCubesInit) return;
  window.__gmSvcCubesInit = true;

  var faceCache = {};   // src -> {top,left,right} baked canvases (context-independent)

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

  // Build one cube into `wrap` using face image `src`. Returns a handle.
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

    // soft contact shadow (matches engine footprint)
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

    // input — identical to engine: per-tile cachedRect, only the hovered
    // cube leans toward the cursor; eases to neutral on leave.
    var mx = { x: 0, y: 0 }, tg = { x: 0, y: 0 }, wT = 0, bT = 0, cachedRect = null, rectTimer = 0;
    function onEnter() { rectTimer = setTimeout(function () { cachedRect = wrap.getBoundingClientRect(); }, 350); }
    function onLeave() { clearTimeout(rectTimer); cachedRect = null; mx.x = 0; mx.y = 0; tg.x = 0; tg.y = 0; }
    function onMove(e) {
      if (!cachedRect) return;
      mx.x = ((e.clientX - cachedRect.left) / cachedRect.width  - 0.5) * 2;
      mx.y = ((e.clientY - cachedRect.top)  / cachedRect.height - 0.5) * 2;
    }
    wrap.addEventListener('mouseenter', onEnter);
    wrap.addEventListener('mouseleave', onLeave);
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
      clearTimeout(rectTimer);
      wrap.removeEventListener('mouseenter', onEnter);
      wrap.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mousemove', onMove);
      try { r.dispose(); r.forceContextLoss && r.forceContextLoss(); } catch (e) {}
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    }
    resume();
    return { dispose: dispose, pause: pause, resume: resume };
  }

  // ── wiring: one cube per .ux-cube / .motion-cube tile, on card hover ──
  var groups = {};   // key -> { card, tiles:[handle], built:bool }

  function buildGroup(key) {
    var g = groups[key];
    if (!g || g.built) return;
    g.built = true;
    g.handles = [].map.call(g.card.querySelectorAll('.' + key), function (tile) {
      // guard: never double-build a tile
      if (tile.__gmCube) return tile.__gmCube;
      var h = buildCube(tile, FACES[key]);
      tile.__gmCube = h;
      return h;
    });
  }
  function disposeGroup(key) {
    var g = groups[key]; if (!g || !g.built) return;
    (g.handles || []).forEach(function (h) { try { h.dispose(); } catch (e) {} });
    [].forEach.call(g.card.querySelectorAll('.' + key), function (t) { t.__gmCube = null; });
    g.built = false; g.handles = null;
  }
  function pauseGroup(key)  { var g = groups[key]; if (g && g.built) (g.handles||[]).forEach(function(h){h.pause();}); }
  function resumeGroup(key) { var g = groups[key]; if (g && g.built) (g.handles||[]).forEach(function(h){h.resume();}); }

  function findCard(key) {
    var tile = document.querySelector('.cube-image-container.' + key);
    return tile ? tile.closest('.service-container') : null;
  }

  function init() {
    if (typeof window.THREE === 'undefined' || typeof window.gmDV !== 'function' || typeof window.gmUW !== 'function') {
      return requestAnimationFrame(init);
    }
    ['ux-cube', 'motion-cube'].forEach(function (key) {
      var card = findCard(key);
      if (!card || groups[key]) return;
      groups[key] = { card: card, built: false, handles: null };
      var leaveTimer = 0;

      card.addEventListener('mouseenter', function () {
        clearTimeout(leaveTimer);
        // bound contexts: dispose the *other* group when this one activates
        var other = key === 'ux-cube' ? 'motion-cube' : 'ux-cube';
        disposeGroup(other);
        buildGroup(key);
        resumeGroup(key);
      });
      card.addEventListener('mouseleave', function () {
        clearTimeout(leaveTimer);
        // pause immediately (idle, keep context); dispose shortly after to free GPU
        pauseGroup(key);
        leaveTimer = setTimeout(function () { disposeGroup(key); }, 800);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
