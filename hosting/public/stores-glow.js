/*
 * A neon aurora behind the footer store badges, drawn with WebGL (one full-screen triangle and a
 * small fragment shader). It runs only while the badges are on screen, scales with the device
 * pixel ratio (capped at 1.5), and does nothing when WebGL is missing or reduced motion is set.
 */
(function () {
  'use strict';

  const host = document.querySelector('.footer-stores');
  if (!host) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'stores-glow';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return;

  const VERTEX = 'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }';
  const FRAGMENT = `
    precision mediump float;
    uniform vec2 uRes;
    uniform float uTime;

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
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float t = uTime * 0.12;
      vec2 p = vec2(uv.x * 2.6, uv.y * 1.4);
      float n = fbm(p + vec2(t, -t * 0.7));
      float n2 = fbm(p * 1.6 - vec2(t * 0.8, t * 0.4) + n * 1.5);

      vec3 cyan = vec3(0.0, 0.94, 1.0);
      vec3 magenta = vec3(1.0, 0.17, 0.84);
      vec3 violet = vec3(0.70, 0.42, 1.0);
      vec3 col = mix(cyan, magenta, smoothstep(0.3, 0.7, n2));
      col = mix(col, violet, smoothstep(0.5, 0.9, n));

      float band = 1.0 - abs(uv.y - 0.5) * 1.7;
      float edge = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x);
      float strength = smoothstep(0.25, 0.85, n2) * clamp(band, 0.0, 1.0) * edge;
      float alpha = clamp(strength * 0.95, 0.0, 0.9);

      gl_FragColor = vec4(col * alpha, alpha); // premultiplied alpha
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('stores-glow shader:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('stores-glow program:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // One triangle that covers the whole canvas.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, 'uRes');
  const uTime = gl.getUniformLocation(program, 'uTime');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const box = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }

  host.prepend(canvas);
  resize();
  window.addEventListener('resize', resize);

  let onScreen = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
    }).observe(canvas);
  }

  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());

  const start = performance.now();
  function frame(now) {
    if (onScreen) {
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
