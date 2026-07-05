/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

type Props = {
  analyser?: AnalyserNode | null;
  audioSensitivity?: number; // default 5
  audioReactivity?: number; // default 1
  resolution?: number; // default 32
  distortion?: number; // default 1
  className?: string;
  isDark?: boolean; // for theme-aware colors
  volume?: number; // volume control (0-1)
};

export default function AudioVisualizer6({
  analyser = null,
  audioSensitivity = 5,
  audioReactivity = 1,
  resolution = 32,
  distortion = 1,
  className,
  isDark = true,
  volume = 1,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const analyserBufferRef = useRef<Uint8Array | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wait for container to have valid dimensions
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    // Scene, camera, renderer - exact setup from the repo
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // Transparent background
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.background = 'transparent';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      // keep encoding consistent with renderer
      colorSpace: THREE.SRGBColorSpace,
      depthBuffer: true,
      stencilBuffer: false,
    });

    // Bloom effect setup - purple color scheme
    // Pure white color with reduced glow
    const params = {
      red: 1.0,
      green: 1.0,
      blue: 1.0,
      threshold: 0.5,
      strength: 0.25,
      radius: 0.5,
    };

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      params.strength,
      params.radius,
      params.threshold
    );

    const bloomComposer = new EffectComposer(renderer, renderTarget);
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);

    const outputPass = new OutputPass();
    bloomComposer.addPass(outputPass);
    composerRef.current = bloomComposer;

    // Responsive camera position based on mobile detection
    const cameraZ = 6;
    camera.position.set(0, -2, cameraZ);
    camera.lookAt(0, 0, 0);

    // Shader uniforms - exact from repo
    const uniforms = {
      u_time: { type: 'f', value: 0.0 },
      u_frequency: { type: 'f', value: 0.0 },
      u_red: { type: 'f', value: params.red },
      u_green: { type: 'f', value: params.green },
      u_blue: { type: 'f', value: params.blue },
    };

    // Perlin noise vertex shader - exact from repo
    const vertexShader = `
      uniform float u_time;
      uniform float u_frequency;

      vec3 mod289(vec3 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 mod289(vec4 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 permute(vec4 x) {
        return mod289(((x*34.0)+10.0)*x);
      }
      
      vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
      }
      
      vec3 fade(vec3 t) {
        return t*t*t*(t*(t*6.0-15.0)+10.0);
      }

      // Classic Perlin noise, periodic variant
      float pnoise(vec3 P, vec3 rep) {
        vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
        vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
        Pi0 = mod289(Pi0);
        Pi1 = mod289(Pi1);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 * (1.0 / 7.0);
        vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 * (1.0 / 7.0);
        vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
        return 2.2 * n_xyz;
      }

      void main() {
        float noise = 3.0 * pnoise(position + u_time, vec3(10.0));
        float displacement = (u_frequency / 60.) * (noise / 20.);
        vec3 newPosition = position + normal * displacement;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;

    // Fragment shader - exact from repo
    const fragmentShader = `
      uniform float u_red;
      uniform float u_blue;
      uniform float u_green;
      void main() {
        gl_FragColor = vec4(vec3(u_red, u_green, u_blue), 1.);
      }
    `;

    // Material and geometry - exact from repo
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    // Responsive geometry based on mobile detection
    const subdivisions = 8;
    const radius = 1.68; // 16% smaller than original (2 * 0.84)

    const geo = new THREE.IcosahedronGeometry(radius, subdivisions);
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    mesh.material.wireframe = true;

    const geo2 = new THREE.IcosahedronGeometry(radius, subdivisions);
    const mesh2 = new THREE.Mesh(geo2, mat);
    scene.add(mesh2);
    mesh2.material.wireframe = true;

    // Create glow effect around the visualizer
    const glowGeometry = new THREE.IcosahedronGeometry(
      radius * 1.5,
      subdivisions
    );
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_red: { value: params.red },
        u_green: { value: params.green },
        u_blue: { value: params.blue },
      },
      vertexShader: `
         varying vec3 vNormal;
         void main() {
           vNormal = normalize(normalMatrix * normal);
           gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
         }
       `,
      fragmentShader: `
         uniform float u_red;
         uniform float u_blue;
         uniform float u_green;
         varying vec3 vNormal;
         void main() {
           float intensity = pow(0.15 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0) * 0.6;
           gl_FragColor = vec4(u_red, u_green, u_blue, 1.0) * intensity;
         }
       `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });

    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowMesh);

    // Audio buffer setup
    if (analyser) {
      analyser.fftSize = analyser.fftSize || 32;
      analyserBufferRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    // Mouse tracking disabled to maintain consistent size
    const handleMouseMove = () => {};
    container.addEventListener('mousemove', handleMouseMove);

    const clock = new THREE.Clock();

    // Animation loop - exact from repo
    function animate() {
      rafRef.current = requestAnimationFrame(animate);

      // Camera stays fixed for consistent size
      camera.lookAt(scene.position);

      uniforms.u_time.value = clock.getElapsedTime();

      // Audio frequency - adapted for our analyser
      let frequency = 0;
      if (analyser && analyserBufferRef.current) {
        const buffer = new Uint8Array(analyserBufferRef.current);
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;

        // If average is very low (no audio), fall back to mock animation
        if (average < 2) {
          // Enhanced mock frequency for demo - more dynamic and noticeable
          const time = clock.getElapsedTime();
          const baseFreq = Math.sin(time * 2) * 25 + 35;
          const highFreq = Math.sin(time * 3) * 20;
          const lowFreq = Math.sin(time * 0.8) * 15;
          frequency = baseFreq + highFreq + lowFreq;

          // Debug logging for mock data
          if (Math.floor(clock.getElapsedTime() * 60) % 60 === 0) {
            console.log(
              '[AudioVisualizer6] Using mock frequency (no audio detected):',
              {
                frequency,
                average,
                hasAnalyser: !!analyser,
              }
            );
          }
        } else {
          frequency = average * audioSensitivity;

          // Debug logging every 60 frames
          if (Math.floor(clock.getElapsedTime() * 60) % 60 === 0) {
            console.log('[AudioVisualizer6] Frequency data:', {
              sum,
              average,
              frequency,
              audioSensitivity,
              hasAnalyser: !!analyser,
            });
          }
        }
      } else {
        // Enhanced mock frequency for demo - more dynamic and noticeable
        const time = clock.getElapsedTime();
        const baseFreq = Math.sin(time * 2) * 25 + 35;
        const highFreq = Math.sin(time * 3) * 20;
        const lowFreq = Math.sin(time * 0.8) * 15;
        frequency = baseFreq + highFreq + lowFreq;

        // Debug logging for mock data
        if (Math.floor(clock.getElapsedTime() * 60) % 60 === 0) {
          console.log(
            '[AudioVisualizer6] Using mock frequency (no analyser):',
            {
              frequency,
              hasAnalyser: !!analyser,
              hasBuffer: !!analyserBufferRef.current,
            }
          );
        }
      }

      uniforms.u_frequency.value = frequency;
      renderer.render(scene, camera);
    }

    animate();

    // Resize handler - handles both window and container resize
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      // Skip if dimensions are invalid
      if (newWidth === 0 || newHeight === 0) return;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      renderTarget.setSize(newWidth, newHeight);
      if (composerRef.current) {
        composerRef.current.setSize(newWidth, newHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Add ResizeObserver to handle container size changes (e.g., when banners are dismissed)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Call resize immediately to ensure correct sizing after mount
    requestAnimationFrame(() => {
      handleResize();
    });

    // Cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      container.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      bloomComposer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    analyser,
    audioSensitivity,
    audioReactivity,
    resolution,
    distortion,
    isDark,
    volume,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
