// Three.resetState scollega il framebuffer: MapLibre può renderizzare su un target
// intermedio durante le transizioni. Conserviamo quel target anche dentro Three.
export function renderCondiviso(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  renderer: { resetState(): void },
  disegna: () => void,
) {
  const gl2 = "DRAW_FRAMEBUFFER_BINDING" in gl ? gl as WebGL2RenderingContext : null
  const draw = gl.getParameter(gl2 ? gl2.DRAW_FRAMEBUFFER_BINDING : gl.FRAMEBUFFER_BINDING)
  const read = gl2 ? gl.getParameter(gl2.READ_FRAMEBUFFER_BINDING) : null
  const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array
  const ripristina = () => {
    if (gl2) {
      gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, draw)
      gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, read)
    } else gl.bindFramebuffer(gl.FRAMEBUFFER, draw)
    gl.viewport(viewport[0]!, viewport[1]!, viewport[2]!, viewport[3]!)
  }
  renderer.resetState()
  ripristina()
  try { disegna() }
  finally { renderer.resetState(); ripristina() }
}
