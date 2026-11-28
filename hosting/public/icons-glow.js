/*
 * Neon halos around the feature icons, drawn with WebGL, in the style of stores-glow.js.
 *
 * One WebGL context for the whole grid: one canvas laid over the features grid, and one draw call
 * per frame with a small quad around each icon that is on screen. The quads keep the shader work to
 * the halo area only (a full-canvas pass would shade every pixel of the grid for 19 icons). Each
 * quad carries its icon's position, size, current neon colour (read from the CSS fs-neon
 * animation) and a seed, so the halos drift independently.
 *
 * The canvas lives in the page flow (absolute, inside the features section), so it scrolls with the
 * cards on the compositor and never lags behind them. On tall grids (phones) it covers only a window
 * of about 2.2 screen heights around the viewport and moves when the viewport nears its edge.
 *
 * It sits above the card backgrounds but below the icon tiles and the card text (style.css), runs
 * only while the grid is on screen at about 30 frames a second, caps the pixel ratio at 1.5, and
 * does nothing with reduced motion or without WebGL.
 */
(function () {
  'use strict';

  const section = document.getElementById('features');
  const grid = section && section.querySelector('.features-grid');
  if (!grid) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const MAX_ICONS = 19;
  const icons = Array.prototype.slice.call(grid.querySelectorAll('.feature-card > .feature-icon'), 0, MAX_ICONS);
  if (!icons.length) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'icons-glow';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return;

  const REACH = 26; // CSS px the halo reaches beyond the tile (the card padding is 28 px)
  const FRAME_MS = 30; // about 30 frames a second: the motion is slow, this halves the cost
  const FLOATS = 10; // per vertex: position (2), icon (local x, local y, half size, seed), colour (rgb, fade)

  const VERTEX = `
    attribute vec2 aPos;
    attribute vec4 aIcon;
    attribute vec4 aColor;
    uniform vec2 uSize;
    varying vec2 vLocal;
    varying float vHalf;
    varying float vSeed;
    varying vec4 vColor;
    void main() {
      vec2 clip = aPos / uSize * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      vLocal = aIcon.xy;
      vHalf = aIcon.z;
      vSeed = aIcon.w;
      vColor = aColor;
    }
  `;

  const FRAGMENT = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform float uTime;
    uniform float uReach;
    varying vec2 vLocal;
    varying float vHalf;
    varying float vSeed;
    varying vec4 vColor;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 3; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v / 0.875;
    }

    // Signed distance to the rounded icon tile (48 px, radius 12 px): negative inside.
    float tile(vec2 p, float h) {
      float r = h * 0.5;
      vec2 q = abs(p) - vec2(h - r);
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }

    void main() {
      float h = vHalf;
      float d = tile(vLocal, h);
      float t = uTime;
      vec2 q = vLocal / h;

      // Aurora: two layers of slow noise give the halo a soft, living edge.
      float n = fbm(q * 1.2 + vec2(vSeed * 17.0 + t * 0.09, vSeed * 5.0 - t * 0.07));
      float n2 = fbm(q * 2.0 + vec2(-t * 0.05, t * 0.06) + n * 1.4);

      // Halo outside the tile; inside it drops off fast, so the icon keeps a dark, clear centre.
      float shape = d >= 0.0
        ? exp(-d / (6.0 + 6.0 * n))
        : exp(d / 3.0) * 0.8 + 0.2 * smoothstep(-h, 0.0, d);
      float halo = shape * (0.3 + 0.4 * n2);
      float wisps = step(0.0, d) * smoothstep(0.55, 0.9, n2) * exp(-d / 12.0) * 0.35;

      // A thin neon tube along the tile edge.
      float rim = exp(-abs(d) / 1.3) * 0.45;

      // A soft light that travels slowly around the rim (about 14 seconds per lap).
      float ang = atan(vLocal.y, vLocal.x);
      float da = mod(ang - (t * 0.45 + vSeed * 6.2832) + 3.14159, 6.28318) - 3.14159;
      float sweep = exp(-da * da * 2.5) * exp(-abs(d) / 4.0) * 0.55;

      float edge = 1.0 - smoothstep(uReach * 0.5, uReach, max(d, 0.0));
      float a = clamp((halo + wisps + rim + sweep) * edge * vColor.a, 0.0, 0.85);
      // The neon colour stays; only the rim core and the travelling light run a little white-hot.
      vec3 col = mix(vColor.rgb, vec3(1.0), clamp(rim * 0.4 + sweep * 0.75, 0.0, 0.5));

      gl_FragColor = vec4(col * a, a); // premultiplied alpha
    }
  `;

  let maxDims = [4096, 4096];
  let program = null;
  let buffer = null;
  let uSize = null;
  let uTime = null;
  let uReach = null;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      console.warn('icons-glow shader:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  // Creates the program and the vertex buffer (again after a lost context comes back).
  function setup() {
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return false;
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (!gl.isContextLost()) console.warn('icons-glow program:', gl.getProgramInfoLog(program));
      return false;
    }
    gl.useProgram(program);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    const stride = FLOATS * 4;
    const attrs = [
      ['aPos', 2, 0],
      ['aIcon', 4, 2],
      ['aColor', 4, 6],
    ];
    attrs.forEach(([name, count, offset]) => {
      const loc = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, count, gl.FLOAT, false, stride, offset * 4);
    });

    uSize = gl.getUniformLocation(program, 'uSize');
    uTime = gl.getUniformLocation(program, 'uTime');
    uReach = gl.getUniformLocation(program, 'uReach');
    gl.uniform1f(uReach, REACH);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    maxDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [4096, 4096];
    bufW = 0; // forces the canvas size to be applied again
    return true;
  }

  const data = new Float32Array(MAX_ICONS * 6 * FLOATS);
  const colors = icons.map(() => [0, 0.94, 1]);
  const fadeFrom = icons.map(() => -1);
  const seeds = icons.map((_, i) => ((i * 0.618034) % 1) + 0.13);

  // Canvas size in CSS px, its drawing buffer size, and the top of its window inside the grid.
  let cssW = 0;
  let cssH = 0;
  let bufW = 0;
  let bufH = 0;
  let winTop = 0;
  let styleLeft = '';
  let styleTop = '';

  function viewportHeight() {
    return Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
  }

  // Sizes the canvas to the grid width and to the grid height or a window of 2.2 screens, whichever
  // is smaller. Small height changes (a phone's address bar) do not reallocate the canvas.
  function fit(gridW, gridH, vh) {
    const wantW = Math.max(1, Math.round(gridW));
    const fullH = Math.max(1, Math.floor(gridH));
    const wantH = Math.min(fullH, Math.round(vh * 2.2));
    const diff = Math.abs(wantH - cssH);
    if (wantW !== cssW || diff > 80 || (diff && (cssH > fullH || wantH === fullH))) {
      cssW = wantW;
      cssH = wantH;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
    }
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    dpr = Math.min(dpr, maxDims[0] / cssW, maxDims[1] / cssH);
    const w = Math.max(1, Math.round(cssW * dpr));
    const hgt = Math.max(1, Math.round(cssH * dpr));
    if (w !== bufW || hgt !== bufH) {
      bufW = w;
      bufH = hgt;
      canvas.width = w;
      canvas.height = hgt;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(uSize, cssW, cssH);
    }
  }

  function readColor(icon, out) {
    const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(icon).color);
    if (!m) return;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return;
    out[0] = parseFloat(parts[0]) / 255;
    out[1] = parseFloat(parts[1]) / 255;
    out[2] = parseFloat(parts[2]) / 255;
  }

  function put(offset, x, y, lx, ly, half, seed, c, fade) {
    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = lx;
    data[offset + 3] = ly;
    data[offset + 4] = half;
    data[offset + 5] = seed;
    data[offset + 6] = c[0];
    data[offset + 7] = c[1];
    data[offset + 8] = c[2];
    data[offset + 9] = fade;
  }

  const CORNERS = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
  const start = performance.now();
  let drewLast = false;

  function draw(now) {
    const g = grid.getBoundingClientRect();
    const s = section.getBoundingClientRect();
    const vh = viewportHeight();
    fit(g.width, g.height, vh);

    // Keep the canvas window around the viewport (it covers the whole grid when the grid is short).
    if (cssH >= g.height - 1) {
      winTop = 0;
    } else {
      const visTop = -g.top;
      const margin = vh * 0.25;
      if (visTop - margin < winTop || visTop + vh + margin > winTop + cssH) {
        winTop = Math.max(0, Math.min(g.height - cssH, visTop - (cssH - vh) / 2));
      }
    }
    const leftPx = Math.round(g.left - s.left);
    const topPx = Math.round(g.top - s.top + winTop);
    if (leftPx + 'px' !== styleLeft) canvas.style.left = styleLeft = leftPx + 'px';
    if (topPx + 'px' !== styleTop) canvas.style.top = styleTop = topPx + 'px';
    const originX = s.left + leftPx; // the canvas corner on screen
    const originY = s.top + topPx;

    const animated = grid.classList.contains('anim');
    let count = 0;
    for (let i = 0; i < icons.length; i++) {
      const icon = icons[i];
      const r = icon.getBoundingClientRect();
      if (!r.width) continue;
      const half = r.width / 2;
      const ext = half + REACH;
      if (r.bottom + REACH < 0 || r.top - REACH > vh) continue; // off screen

      // The halo fades in once the card has drawn its icon (site.js adds .is-in).
      if (fadeFrom[i] < 0 && (!animated || icon.parentElement.classList.contains('is-in'))) {
        fadeFrom[i] = animated ? now + 300 : now - 2000;
      }
      if (fadeFrom[i] < 0) continue;
      const k = Math.min(1, Math.max(0, (now - fadeFrom[i]) / 1400));
      const fade = k * k * (3 - 2 * k);
      if (fade <= 0) continue;

      readColor(icon, colors[i]);
      const cx = r.left + half - originX;
      const cy = r.top + r.height / 2 - originY;
      const base = count * 6 * FLOATS;
      for (let v = 0; v < 6; v++) {
        const lx = CORNERS[v * 2] * ext;
        const ly = CORNERS[v * 2 + 1] * ext;
        put(base + v * FLOATS, cx + lx, cy + ly, lx, ly, half, seeds[i], colors[i], fade);
      }
      count++;
    }

    if (!count && !drewLast) return;
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (count) {
      gl.uniform1f(uTime, ((now - start) / 1000) % 3600);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * 6 * FLOATS));
      gl.drawArrays(gl.TRIANGLES, 0, count * 6);
    }
    drewLast = count > 0;
  }

  let running = false;
  let lost = false;
  let rafId = 0;
  let last = 0;

  function frame(now) {
    rafId = 0;
    if (!running || lost) return;
    rafId = requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    draw(now);
  }

  function setRunning(on) {
    running = on;
    canvas.style.visibility = on ? 'visible' : 'hidden';
    if (on && !rafId && !lost) rafId = requestAnimationFrame(frame);
  }

  if (!setup()) return;
  section.prepend(canvas);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (!setup()) return;
    lost = false;
    drewLast = true;
    if (running && !rafId) rafId = requestAnimationFrame(frame);
  });

  if ('IntersectionObserver' in window) {
    setRunning(false);
    new IntersectionObserver(
      (entries) => {
        setRunning(entries[entries.length - 1].isIntersecting);
      },
      { rootMargin: '150px 0px' },
    ).observe(grid);
  } else {
    setRunning(true);
  }
})();
