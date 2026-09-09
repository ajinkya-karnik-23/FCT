import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * LiquidLogoSplash — Liquid Metal Logo Splash Screen based on paper-design/liquid-logo
 * (https://github.com/paper-design/liquid-logo.git)
 *
 * Renders the Finance Control Tower logo in a WebGL2 liquid shader with flowing metallic reflections,
 * edge detection, and Poisson field beveling.
 */

const MIN_SPLASH_MS = 3500

// GLSL Fragment Shader from paper-design/liquid-logo, tuned for gold metallic liquid
const liquidFragSource = /* glsl */ `#version 300 es
precision mediump float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_image_texture;
uniform float u_time;
uniform float u_ratio;
uniform float u_img_ratio;
uniform float u_patternScale;
uniform float u_refraction;
uniform float u_edge;
uniform float u_patternBlur;
uniform float u_liquid;
uniform vec3 u_color1;
uniform vec3 u_color2;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec3 mod289(vec3 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec2 mod289(vec2 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec3 permute(vec3 x) { return mod289(((x*34.)+1.)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1., 0.) : vec2(0., 1.);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.);
    m = m*m;
    m = m*m;
    vec3 x = 2. * fract(p * C.www) - 1.;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130. * dot(m, g);
}

vec2 get_img_uv() {
    vec2 img_uv = vUv;
    img_uv -= .5;
    if (u_ratio > u_img_ratio) {
        img_uv.x = img_uv.x * u_ratio / u_img_ratio;
    } else {
        img_uv.y = img_uv.y * u_img_ratio / u_ratio;
    }
    img_uv += .5;
    img_uv.y = 1. - img_uv.y;
    return img_uv;
}

vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float get_color_channel(float c1, float c2, float stripe_p, vec3 w, float extra_blur, float b) {
    float ch = c2;
    float blur = u_patternBlur + extra_blur;
    ch = mix(ch, c1, smoothstep(.0, blur, stripe_p));

    float border = w[0];
    ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripe_p));

    b = smoothstep(.2, .8, b);
    border = w[0] + .4 * (1. - b) * w[1];
    ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripe_p));

    border = w[0] + .5 * (1. - b) * w[1];
    ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripe_p));

    border = w[0] + w[1];
    ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripe_p));

    float gradient_t = (stripe_p - w[0] - w[1]) / w[2];
    float gradient = mix(c1, c2, smoothstep(0., 1., gradient_t));
    ch = mix(ch, gradient, smoothstep(border - blur, border + blur, stripe_p));

    return ch;
}

float get_img_frame_alpha(vec2 uv, float img_frame_width) {
    float img_frame_alpha = smoothstep(0., img_frame_width, uv.x) * smoothstep(1., 1. - img_frame_width, uv.x);
    img_frame_alpha *= smoothstep(0., img_frame_width, uv.y) * smoothstep(1., 1. - img_frame_width, uv.y);
    return img_frame_alpha;
}

void main() {
    vec2 uv = vUv;
    uv.y = 1. - uv.y;
    uv.x *= u_ratio;

    float diagonal = uv.x - uv.y;
    float t = .001 * u_time;

    vec2 img_uv = get_img_uv();
    vec4 img = texture(u_image_texture, img_uv);

    vec3 color = vec3(0.);
    float opacity = 1.;

    vec3 color1 = u_color1;
    vec3 color2 = u_color2;

    float edge = img.r;

    vec2 grad_uv = uv - .5;
    float dist = length(grad_uv + vec2(0., .2 * diagonal));
    grad_uv = rotate(grad_uv, (.25 - .2 * diagonal) * PI);

    float bulge = pow(1.8 * dist, 1.2);
    bulge = 1. - bulge;
    bulge *= pow(uv.y, .3);

    float cycle_width = u_patternScale;
    float thin_strip_1_ratio = .12 / cycle_width * (1. - .4 * bulge);
    float thin_strip_2_ratio = .07 / cycle_width * (1. + .4 * bulge);
    float wide_strip_ratio = (1. - thin_strip_1_ratio - thin_strip_2_ratio);

    float thin_strip_1_width = cycle_width * thin_strip_1_ratio;
    float thin_strip_2_width = cycle_width * thin_strip_2_ratio;

    opacity = 1. - smoothstep(.9 - .5 * u_edge, 1. - .5 * u_edge, edge);
    opacity *= get_img_frame_alpha(img_uv, 0.01);

    float noise = snoise(uv - t);
    edge += (1. - edge) * u_liquid * noise;

    float refr = clamp(1. - bulge, 0., 1.);
    float dir = grad_uv.x + diagonal;
    dir -= 2. * noise * diagonal * (smoothstep(0., 1., edge) * smoothstep(1., 0., edge));

    bulge *= clamp(pow(uv.y, .1), .3, 1.);
    dir *= (.1 + (1.1 - edge) * bulge);
    dir *= smoothstep(1., .7, edge);

    dir += .18 * (smoothstep(.1, .2, uv.y) * smoothstep(.4, .2, uv.y));
    dir += .03 * (smoothstep(.1, .2, 1. - uv.y) * smoothstep(.4, .2, 1. - uv.y));
    dir *= (.5 + .5 * pow(uv.y, 2.));
    dir *= cycle_width;
    dir -= t;

    float refr_r = refr + .03 * bulge * noise;
    float refr_b = 1.3 * refr;

    refr_r += 5. * (smoothstep(-.1, .2, uv.y) * smoothstep(.5, .1, uv.y)) * (smoothstep(.4, .6, bulge) * smoothstep(1., .4, bulge)) - diagonal;
    refr_b += (smoothstep(0., .4, uv.y) * smoothstep(.8, .1, uv.y)) * (smoothstep(.4, .6, bulge) * smoothstep(.8, .4, bulge)) - .2 * edge;

    refr_r *= u_refraction;
    refr_b *= u_refraction;

    vec3 w = vec3(thin_strip_1_width, thin_strip_2_width, wide_strip_ratio);
    w[1] -= .02 * smoothstep(.0, 1., edge + bulge);

    float stripe_r = mod(dir + refr_r, 1.);
    float r = get_color_channel(color1.r, color2.r, stripe_r, w, 0.02 + .03 * u_refraction * bulge, bulge);
    float stripe_g = mod(dir, 1.);
    float g = get_color_channel(color1.g, color2.g, stripe_g, w, 0.01 / (1. - diagonal), bulge);
    float stripe_b = mod(dir - refr_b, 1.);
    float b = get_color_channel(color1.b, color2.b, stripe_b, w, .01, bulge);

    color = vec3(r, g, b) * opacity;
    fragColor = vec4(color, opacity);
}
`

const vertexShaderSource = `#version 300 es
precision mediump float;
in vec2 a_position;
out vec2 vUv;
void main() {
    vUv = .5 * (a_position + 1.);
    gl_Position = vec4(a_position, 0.0, 1.0);
}`

/** Generate an offscreen ImageData mask of the Finance Control Tower logo */
function generateTowerLogoImageData(width = 600, height = 600): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Clear with transparent/white background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Draw black tower logo on white background
  ctx.fillStyle = '#000000'
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 14
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const cx = width / 2
  const cy = height / 2

  // Base line
  ctx.beginPath()
  ctx.roundRect(cx - 100, cy + 120, 200, 20, 10)
  ctx.fill()

  // Tower body
  ctx.beginPath()
  ctx.moveTo(cx - 50, cy + 110)
  ctx.lineTo(cx - 20, cy - 20)
  ctx.lineTo(cx + 20, cy - 20)
  ctx.lineTo(cx + 50, cy + 110)
  ctx.closePath()
  ctx.stroke()
  ctx.fill()

  // Beacon top circle
  ctx.beginPath()
  ctx.arc(cx, cy - 40, 24, 0, Math.PI * 2)
  ctx.fill()

  // Signal waves left & right
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(cx, cy - 40, 60, -Math.PI * 0.75, -Math.PI * 0.25)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy - 40, 100, -Math.PI * 0.75, -Math.PI * 0.25)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy - 40, 140, -Math.PI * 0.75, -Math.PI * 0.25)
  ctx.stroke()

  // Compute Poisson distance mask for soft liquid bevel edge
  const shapeData = ctx.getImageData(0, 0, width, height)
  const data = shapeData.data
  const shapeMask = new Array(width * height).fill(false)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx4 = (y * width + x) * 4
      const r = data[idx4]
      const g = data[idx4 + 1]
      const b = data[idx4 + 2]
      const a = data[idx4 + 3]
      if (a === 0 || (r > 200 && g > 200 && b > 200)) {
        shapeMask[y * width + x] = false
      } else {
        shapeMask[y * width + x] = true
      }
    }
  }

  // Poisson iteration distance relaxation
  const u = new Float32Array(width * height).fill(0)
  const newU = new Float32Array(width * height).fill(0)
  const C = 0.02
  const ITERATIONS = 120

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        if (!shapeMask[idx]) {
          newU[idx] = 0
          continue
        }
        const sumN = u[idx + 1] + u[idx - 1] + u[idx + width] + u[idx - width]
        newU[idx] = (C + sumN) / 4
      }
    }
    u.set(newU)
  }

  let maxVal = 0.0001
  for (let i = 0; i < u.length; i++) {
    if (u[i] > maxVal) maxVal = u[i]
  }

  const outImg = ctx.createImageData(width, height)
  for (let i = 0; i < u.length; i++) {
    const px = i * 4
    if (!shapeMask[i]) {
      outImg.data[px] = 255
      outImg.data[px + 1] = 255
      outImg.data[px + 2] = 255
      outImg.data[px + 3] = 255
    } else {
      const raw = u[i] / maxVal
      const gray = 255 * (1 - Math.pow(raw, 2.0))
      outImg.data[px] = gray
      outImg.data[px + 1] = gray
      outImg.data[px + 2] = gray
      outImg.data[px + 3] = 255
    }
  }

  return outImg
}

export function LiquidLogoSplash({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fading, setFading] = useState(false)
  const completeCalled = useRef(false)

  const finish = useCallback(() => {
    if (completeCalled.current) return
    completeCalled.current = true
    setFading(true)
    setTimeout(onComplete, 900)
  }, [onComplete])

  useEffect(() => {
    const timer = setTimeout(finish, MIN_SPLASH_MS)
    return () => clearTimeout(timer)
  }, [finish])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true })
    if (!gl) return

    function createShader(gl: WebGL2RenderingContext, source: string, type: number) {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vs = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER)
    const fs = createShader(gl, liquidFragSource, gl.FRAGMENT_SHADER)
    if (!vs || !fs) return

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return

    gl.useProgram(program)

    // Buffers
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // Uniforms
    const uTime = gl.getUniformLocation(program, 'u_time')
    const uRatio = gl.getUniformLocation(program, 'u_ratio')
    const uImgRatio = gl.getUniformLocation(program, 'u_img_ratio')
    const uScale = gl.getUniformLocation(program, 'u_patternScale')
    const uRefraction = gl.getUniformLocation(program, 'u_refraction')
    const uEdge = gl.getUniformLocation(program, 'u_edge')
    const uBlur = gl.getUniformLocation(program, 'u_patternBlur')
    const uLiquid = gl.getUniformLocation(program, 'u_liquid')
    const uColor1 = gl.getUniformLocation(program, 'u_color1')
    const uColor2 = gl.getUniformLocation(program, 'u_color2')
    const uTex = gl.getUniformLocation(program, 'u_image_texture')

    gl.uniform1f(uScale, 4.5)
    gl.uniform1f(uRefraction, 0.45)
    gl.uniform1f(uEdge, 0.3)
    gl.uniform1f(uBlur, 0.005)
    gl.uniform1f(uLiquid, 0.25)
    // Rich Metallic Gold Palette
    gl.uniform3f(uColor1, 0.94, 0.77, 0.35) // Gold #e8c36a
    gl.uniform3f(uColor2, 0.22, 0.15, 0.05) // Deep Amber Dark #38260d

    // Generate & bind texture
    const imgData = generateTowerLogoImageData(600, 600)
    const texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 600, 600, 0, gl.RGBA, gl.UNSIGNED_BYTE, imgData.data)
    gl.uniform1i(uTex, 0)

    function resize() {
      if (!canvas || !gl) return
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = w * window.devicePixelRatio
      canvas.height = h * window.devicePixelRatio
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1f(uRatio, w / h)
      gl.uniform1f(uImgRatio, 1.0)
    }

    resize()
    window.addEventListener('resize', resize)

    let animId: number
    let startTime = performance.now()

    function render(now: number) {
      const elapsed = (now - startTime) * 0.8
      gl!.uniform1f(uTime, elapsed)
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      gl.deleteTexture(texture)
      gl.deleteProgram(program)
    }
  }, [])

  return (
    <div
      onClick={finish}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#150d04',
        cursor: 'pointer',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* Title with liquid shimmer */}
      <div
        style={{
          position: 'absolute',
          bottom: '22%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          className="liquid-splash-title"
          style={{
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#EAE7E4',
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
            textShadow:
              '0 2px 20px rgba(232, 195, 106, 0.6), 0 0 60px rgba(232, 195, 106, 0.2)',
          }}
        >
          Finance Control Tower
        </div>
      </div>

      <style>{`
        .liquid-splash-title {
          background: linear-gradient(
            90deg,
            #EAE7E4 0%,
            #EAE7E4 30%,
            #f5d78e 50%,
            #EAE7E4 70%,
            #EAE7E4 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: liquid-shimmer 3s ease-in-out infinite;
        }
        @keyframes liquid-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  )
}
