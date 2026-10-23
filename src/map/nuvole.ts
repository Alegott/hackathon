import * as THREE from "three"
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js"

// Bordi sfumati, irregolarità a più scale e ombreggiatura degli sbuffi.
export function creaMaterialeNuvole() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `
      varying vec3 vP;
      varying vec3 vN;
      varying vec3 vVista;
      varying vec3 vColore;
      void main() {
        vP = position;
        float n = sin(position.x * 8.0 + position.z * 4.0) * sin(position.y * 7.0 - position.z * 5.0);
        vec3 p = position + normal * n * 0.065;
        vec4 vista = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelViewMatrix * instanceMatrix) * normal);
        vVista = -vista.xyz;
        vColore = instanceColor;
        gl_Position = projectionMatrix * vista;
      }
    `,
    fragmentShader: `
      varying vec3 vP;
      varying vec3 vN;
      varying vec3 vVista;
      varying vec3 vColore;
      float noise(vec3 p) {
        vec3 s = sin(p * vec3(1.3, 1.7, 1.1));
        return .5 + .5 * s.x * s.y * s.z;
      }
      void main() {
        float n = noise(vP * 4.5) * .7 + noise(vP * 13.0) * .3;
        float bordo = abs(dot(normalize(vN), normalize(vVista)));
        float alpha = smoothstep(.02, .48, bordo) * (.82 + n * .16);
        float luce = .64 + .28 * smoothstep(-.7, .9, vP.z) + n * .12;
        gl_FragColor = vec4(vColore * luce, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
}

// Una superficie unica di metaball: i lobi si fondono, senza sfere trasparenti sovrapposte.
export function creaGeometriaNuvola() {
  const materiale = new THREE.MeshBasicMaterial()
  const campo = new MarchingCubes(28, materiale, false, false, 8000)
  for (const [x, y, z, forza] of [[.27,.48,.5,1.1],[.43,.5,.5,1.5],[.6,.5,.5,1.6],[.75,.48,.5,.9],[.48,.62,.5,1.1],[.64,.59,.55,.8],[.36,.46,.63,.8]])
    campo.addBall(x!, y!, z!, forza!, 12)
  campo.update()
  const g = new THREE.BufferGeometry()
  const count = campo.geometry.drawRange.count
  for (const nome of ['position', 'normal']) {
    const a = campo.geometry.getAttribute(nome)
    g.setAttribute(nome, new THREE.BufferAttribute(new Float32Array(a.array.slice(0, count * 3)), 3))
  }
  g.rotateX(Math.PI / 2)
  g.computeBoundingBox()
  const box = g.boundingBox!, centro = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3())
  g.translate(-centro.x, -centro.y, -centro.z)
  g.scale(2 / size.x, 2 / size.y, 2 / size.z)
  campo.geometry.dispose()
  materiale.dispose()
  return g
}
