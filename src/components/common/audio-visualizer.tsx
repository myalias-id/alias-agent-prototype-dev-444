/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

type Props = {
  analyser?: AnalyserNode | null;
  audioSensitivity?: number; // default 5
  audioReactivity?: number; // default 1
  resolution?: number; // default 32
  distortion?: number; // default 1
  className?: string;
  isDark?: boolean; // for theme-aware colors
};

export default function AudioVisualizer({
  analyser = null,
  audioSensitivity = 5,
  audioReactivity = 1,
  resolution = 32,
  distortion = 1,
  className,
  isDark = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const analyserBufferRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene, camera, renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0e17, 0.05);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.6;
    controls.enableZoom = false;

    // Theme-aware colors
    const primaryColor = isDark ? 0xff4e42 : 0xdc2626; // Brighter red for light mode
    const secondaryColor = isDark ? 0xc2362f : 0xb91c1c; // Darker red for light mode
    const accentColor = isDark ? 0xffb3ab : 0xfca5a5; // Lighter accent for light mode
    const fogColor = isDark ? 0x0a0e17 : 0xf8fafc; // Light fog for light mode

    // Update scene fog
    scene.fog = new THREE.FogExp2(fogColor, 0.05);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, isDark ? 0.8 : 1.2);
    scene.add(ambient);
    const point1 = new THREE.PointLight(primaryColor, 1, 20);
    point1.position.set(2, 2, 5);
    scene.add(point1);
    const point2 = new THREE.PointLight(secondaryColor, 0.8, 20);
    point2.position.set(-2, -2, -5);
    scene.add(point2);

    // Audio buffer setup
    if (analyser) {
      analyser.fftSize = analyser.fftSize || 2048;
      analyserBufferRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    const clock = new THREE.Clock();

    // Background particle field (shader points)
    function createBackgroundParticles() {
      const particleCount = 3000;
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);
      const color1 = new THREE.Color(primaryColor);
      const color2 = new THREE.Color(secondaryColor);
      const color3 = new THREE.Color(accentColor);

      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
        const choice = Math.random();
        const c = choice < 0.33 ? color1 : choice < 0.66 ? color2 : color3;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        sizes[i] = 0.05;
      }

      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: `
          attribute float size;
          varying vec3 vColor;
          uniform float time;
          void main(){
            vColor = color;
            vec3 pos = position;
            pos.x += sin(time * 0.1 + position.z * 0.2) * 0.05;
            pos.y += cos(time * 0.1 + position.x * 0.2) * 0.05;
            pos.z += sin(time * 0.1 + position.y * 0.2) * 0.05;
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = size * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main(){
            float r = distance(gl_PointCoord, vec2(0.5, 0.5));
            if(r > 0.5) discard;
            float glow = 1.0 - (r * 2.0);
            glow = pow(glow, 2.0);
            gl_FragColor = vec4(vColor, glow);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      });

      const points = new THREE.Points(geom, mat);
      scene.add(points);
      return (t: number) => {
        (mat.uniforms as any).time.value = t;
      };
    }

    const updateParticles = createBackgroundParticles();

    // --- Circular Audio Visualization ---
    function createCircularVisualization() {
      const group = new THREE.Group();
      const numRings = 3;
      const baseRadius = 3;
      const numPoints = 180;

      for (let ringIndex = 0; ringIndex < numRings; ringIndex++) {
        const ringRadius = baseRadius * (0.7 + ringIndex * 0.15);
        const _opacity = 0.8 - ringIndex * 0.2;

        // Create ring geometry
        const ringGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(numPoints * 3);
        const colors = new Float32Array(numPoints * 3);

        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          positions[i * 3] = Math.cos(angle) * ringRadius;
          positions[i * 3 + 1] = Math.sin(angle) * ringRadius;
          positions[i * 3 + 2] = 0;

          // Color based on ring
          let color;
          if (ringIndex === 0) {
            color = new THREE.Color(primaryColor);
          } else if (ringIndex === 1) {
            color = new THREE.Color(secondaryColor);
          } else {
            color = new THREE.Color(accentColor);
          }

          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }

        ringGeometry.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3)
        );
        ringGeometry.setAttribute(
          'color',
          new THREE.BufferAttribute(colors, 3)
        );

        const ringMaterial = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            audioLevel: { value: 0 },
            ringIndex: { value: ringIndex },
            numRings: { value: numRings },
            primaryColor: { value: new THREE.Color(primaryColor) },
            secondaryColor: { value: new THREE.Color(secondaryColor) },
            accentColor: { value: new THREE.Color(accentColor) },
          },
          vertexShader: `
            attribute vec3 color;
            varying vec3 vColor;
            varying float vRingIndex;
            uniform float time;
            uniform float audioLevel;
            uniform float ringIndex;
            uniform float numRings;
            
            void main() {
              vColor = color;
              vRingIndex = ringIndex;
              
              vec3 pos = position;
              
              // Add audio-reactive distortion
              float audioDistortion = audioLevel * (1.0 + ringIndex * 0.3);
              pos += normal * audioDistortion * 0.3;
              
              // Add rotation based on ring index
              float rotationSpeed = 0.5 + ringIndex * 0.2;
              float angle = time * rotationSpeed + ringIndex * 1.0;
              float cosA = cos(angle);
              float sinA = sin(angle);
              pos.xy = vec2(
                pos.x * cosA - pos.y * sinA,
                pos.x * sinA + pos.y * cosA
              );
              
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vColor;
            varying float vRingIndex;
            uniform float time;
            uniform float audioLevel;
            uniform vec3 primaryColor;
            uniform vec3 secondaryColor;
            uniform vec3 accentColor;
            
            void main() {
              vec3 finalColor = vColor;
              
              // Add pulsing effect
              float pulse = 0.8 + 0.2 * sin(time * 2.0 + vRingIndex);
              finalColor *= pulse;
              
              // Add audio reactivity
              float audioFactor = 1.0 + audioLevel * (1.0 + vRingIndex * 0.5);
              finalColor *= audioFactor;
              
              // Add glow effect
              float glow = 0.7 + audioLevel * 0.3;
              
              gl_FragColor = vec4(finalColor, glow * (0.6 - vRingIndex * 0.1));
            }
          `,
          transparent: true,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        });

        const ringLine = new THREE.Line(ringGeometry, ringMaterial);
        group.add(ringLine);
      }

      scene.add(group);

      return {
        group,
        update: (t: number, audioLevel: number) => {
          group.children.forEach((ringLine, _index) => {
            const material = (ringLine as THREE.Line)
              .material as THREE.ShaderMaterial;
            material.uniforms.time.value = t;
            material.uniforms.audioLevel.value = audioLevel;
          });
        },
      };
    }

    const circularViz = createCircularVisualization();

    // --- Anomaly sphere (outer wireframe + glow + audio rings) ---
    function createAnomaly() {
      const group = new THREE.Group();
      const radius = 2;

      const outerGeom = new THREE.IcosahedronGeometry(
        radius,
        Math.max(1, Math.floor(resolution / 8))
      );

      const vertexShader = `
        uniform float time;
        uniform float audioLevel;
        uniform float distortion;
        varying vec3 vNormal;
        varying vec3 vPosition;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          
          i = mod289(i);
          vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          
          vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          
          vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
        }
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          
          float slowTime = time * 0.3;
          vec3 pos = position;
          
          float noise = snoise(vec3(position.x * 0.5, position.y * 0.5, position.z * 0.5 + slowTime));
          pos += normal * noise * 0.2 * distortion * (1.0 + audioLevel);
          
          vPosition = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `;

      const fragmentShader = `
        uniform float time;
        uniform vec3 color;
        uniform float audioLevel;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = 1.0 - max(0.0, dot(viewDirection, vNormal));
          fresnel = pow(fresnel, 2.0 + audioLevel * 2.0);
          
          float pulse = 0.8 + 0.2 * sin(time * 2.0);
          
          vec3 finalColor = color * fresnel * pulse * (1.0 + audioLevel * 0.8);
          
          float alpha = fresnel * (0.7 - audioLevel * 0.3);
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `;

      const outerMat = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color: { value: new THREE.Color(primaryColor) },
          audioLevel: { value: 0 },
          distortion: { value: distortion },
        },
        vertexShader,
        fragmentShader,
        wireframe: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const outer = new THREE.Mesh(outerGeom, outerMat);
      group.add(outer);

      // Glow sphere (backside) — keep as additive
      const glowGeo = new THREE.SphereGeometry(radius * 1.2, 32, 32);
      const glowMat = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color: { value: new THREE.Color(primaryColor) },
          audioLevel: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform float audioLevel;
          void main(){
            vNormal = normalize(normalMatrix * normal);
            vPosition = position * (1.0 + audioLevel * 0.2);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vPosition;
          uniform vec3 color;
          uniform float time;
          uniform float audioLevel;
          void main(){
            vec3 viewDirection = normalize(cameraPosition - vPosition);
            float fresnel = 1.0 - max(0.0, dot(viewDirection, vNormal));
            fresnel = pow(fresnel, 3.0 + audioLevel * 3.0);
            float pulse = 0.5 + 0.5 * sin(time * 2.0);
            float audioFactor = 1.0 + audioLevel * 3.0;
            vec3 finalColor = color * fresnel * (0.8 + 0.2 * pulse) * audioFactor;
            float alpha = fresnel * (0.3 * audioFactor) * (1.0 - audioLevel * 0.2);
            gl_FragColor = vec4(finalColor, alpha);
          }
        `,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const glow = new THREE.Mesh(glowGeo, glowMat);
      group.add(glow);

      scene.add(group);

      return {
        group,
        update: (t: number, audioLevel: number) => {
          (outerMat.uniforms as any).time.value = t;
          (outerMat.uniforms as any).audioLevel.value = audioLevel;
          (outerMat.uniforms as any).distortion.value = distortion;
          (glowMat.uniforms as any).time.value = t;
          (glowMat.uniforms as any).audioLevel.value = audioLevel;

          const breathe = 1.0 + audioLevel * 0.04;
          group.scale.set(breathe, breathe, breathe);
        },
      };
    }

    const anomaly = createAnomaly();

    // Resize helper
    function onWindowResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onWindowResize);

    // Animation loop
    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      controls.update();
      const t = clock.getElapsedTime();

      let audioLevel = 0;
      if (analyser) {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        audioLevel = ((sum / buffer.length / 255) * audioSensitivity) / 5;
        audioLevel = Math.min(1, audioLevel * audioReactivity);
      }

      // rotate and pulse
      anomaly.group.rotation.y += 0.003 * (1 + audioLevel * 2);
      anomaly.group.rotation.x += 0.0015 * (1 + audioLevel * 1.5);

      anomaly.update(t, audioLevel);
      circularViz.update(t, audioLevel);
      updateParticles(t);

      renderer.render(scene, camera);
    }

    animate();

    // cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onWindowResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [
    analyser,
    audioSensitivity,
    audioReactivity,
    resolution,
    distortion,
    isDark,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
