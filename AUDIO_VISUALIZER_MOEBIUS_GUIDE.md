# Audio Visualizer Moebius - Complete Technical Guide 🌊✨

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [How It Works](#how-it-works)
5. [Audio Integration](#audio-integration)
6. [Technical Details](#technical-details)
7. [Integration Points](#integration-points)
8. [Configuration](#configuration)
9. [Debug Mode](#debug-mode)

---

## Overview

The **AudioVisualizerMoebius** is a high-performance, shader-based audio visualizer featuring:
- 🎨 **Glass-like iridescent colors** (purple/cyan gradient)
- 🌊 **Real-time water ripple physics simulation**
- 🖱️ **Interactive mouse/touch controls** (creates ripples)
- 🎵 **Audio-reactive animations** with bouncy easing
- 💫 **Drop shadow effects** for depth
- 📱 **Mobile-optimized** (adaptive resolution)
- ⚡ **GPU-accelerated** (all effects run on shader)

**Performance**: 60fps on desktop, 30-60fps on mobile, ~5-10MB memory footprint

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION                          │
│  (Agent speaks via TTS / User moves mouse / User touches screen) │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AUDIO PIPELINE                              │
│  TTS Audio → WebSocket → useSocketChatStore → AudioContext      │
│           → AnalyserNode → visualizerAnalyser                    │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT LAYER                               │
│  agent-chat.tsx receives analyser → passes to visualizer        │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              AUDIO VISUALIZER MOEBIUS                            │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Three.js Renderer + Scene + Camera                │         │
│  │  ┌──────────────────────────────────────────────┐  │         │
│  │  │  Shader Material (Fragment + Vertex)        │  │         │
│  │  │  ┌────────────────────────────────────────┐ │  │         │
│  │  │  │  Water Simulation (CPU)                │ │  │         │
│  │  │  │  Audio Analysis (60fps)                │ │  │         │
│  │  │  │  Pattern Generation (GPU)              │ │  │         │
│  │  │  └────────────────────────────────────────┘ │  │         │
│  │  └──────────────────────────────────────────────┘  │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                   │
                   ▼
         [Rendered to Screen]
```

---

## File Structure

### Core Files

#### **1. `src/components/visualizers/audio-visualizer-moebius.tsx`** (824 lines)
**Location**: `src/components/visualizers/`
**Purpose**: Main visualizer component

**Key Responsibilities**:
- Three.js scene setup (renderer, camera, scene)
- Water simulation physics (CPU-based)
- Shader material creation and uniforms management
- Audio analysis (FFT processing)
- Mouse/touch event handling
- Animation loop (requestAnimationFrame)
- Debug visualization overlays

**Key Functions**:
```typescript
// Component props
type Props = {
  analyser?: AnalyserNode | null;  // Web Audio API analyser
  className?: string;               // CSS classes
  isDark?: boolean;                 // Theme mode
  volume?: number;                  // Volume level (0-1)
  debug?: boolean;                  // Enable debug overlays
  scale?: number;                   // Orb scale (0.1-2.0)
};

// Internal functions
- addRipple(x, y, strength)        // Creates water ripples
- updateWaterSimulation()          // Physics simulation
- updateAudioAnalysis()            // FFT → shader uniforms
- animate()                        // Main render loop
```

#### **2. `src/components/visualizers/index.tsx`** (4 lines)
**Location**: `src/components/visualizers/`
**Purpose**: Export barrel for visualizers

```typescript
export { default as AudioVisualizerMoebius } from './audio-visualizer-moebius';
```

#### **3. `src/components/agent/agent-chat.tsx`** (1122 lines)
**Location**: `src/components/agent/`
**Purpose**: Main chat interface that integrates the visualizer

**Integration Points** (3 instances):

1. **Mobile Draggable Orb** (Lines ~690-711)
```typescript
<DraggableVRMContainer className="...w-[225px] h-[225px]...">
  <AudioVisualizerMoebius
    analyser={agentAnalyser}
    isDark={isDark}
    volume={volume}
    className="w-full h-full"
  />
</DraggableVRMContainer>
```

2. **Desktop Left Panel** (Lines ~838-845)
```typescript
<div className="absolute w-1/2 h-full top-0 left-0 z-[40]">
  <AudioVisualizerMoebius
    analyser={agentAnalyser}
    isDark={isDark}
    volume={volume}
  />
</div>
```

3. **Fullscreen Visualizer Mode** (Lines ~930-940)
```typescript
<div className="w-full h-full min-h-[400px]">
  <AudioVisualizerMoebius
    analyser={analyser}
    isDark={isDark}
    volume={volume}
    className="w-full h-full"
  />
</div>
```

#### **4. `src/store/useSocketChatStore.ts`** (~1000 lines)
**Location**: `src/store/`
**Purpose**: Zustand store managing WebSocket, audio, and chat state

**Audio-Related State**:
```typescript
interface SocketChatStore {
  // Audio visualizer state
  visualizerAnalyser: AnalyserNode | null;    // FFT analyser
  visualizerGainNode: GainNode | null;         // Volume control
  volume: number;                               // Current volume (0-1)
  
  // Audio playback
  playAudioDirectly: (audioBuffer: ArrayBuffer, volume?: number) => Promise<void>;
}
```

**Key Function**: `playAudioDirectly` (Lines ~814-880)
```typescript
playAudioDirectly: async (audioBuffer: ArrayBuffer, volume = 1) => {
  // 1. Create AudioContext
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // 2. Decode audio buffer
  const audioBufferDecoded = await audioContext.decodeAudioData(audioBuffer);
  
  // 3. Create analyser node
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;  // 128 frequency bins
  analyser.smoothingTimeConstant = 0.8;
  
  // 4. Create gain node for volume
  const gainNode = audioContext.createGain();
  gainNode.gain.value = volume;
  
  // 5. Store analyser for visualizer
  set({ visualizerAnalyser: analyser, visualizerGainNode: gainNode });
  
  // 6. Connect audio graph: source → analyser → gain → destination
  const source = audioContext.createBufferSource();
  source.buffer = audioBufferDecoded;
  source.connect(analyser);
  analyser.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // 7. Play audio
  source.start(0);
}
```

---

## How It Works

### 1. Water Simulation (CPU)

**Algorithm**: Classic 2D wave equation with double buffering

**Grid Resolution**:
- Desktop: 256x256 (65,536 points)
- Mobile: 128x128 (16,384 points)

**Physics Update (60fps)**:
```javascript
// Wave equation: new = average(neighbors) - current
for each pixel (i, j):
  current[i,j] = (
    (previous[i-1,j] + previous[i+1,j] + 
     previous[i,j-1] + previous[i,j+1]) / 2
  ) - current[i,j]
  
  // Apply damping (energy loss)
  current[i,j] *= 0.96
  
  // Clamp to prevent explosion
  current[i,j] = clamp(current[i,j], -2.0, 2.0)

// Zero boundary conditions (edges are always flat)
edges = 0

// Swap buffers for next frame
[current, previous] = [previous, current]
```

**Ripple Creation**:
```javascript
function addRipple(x, y, strength) {
  // Convert screen coords to texture coords
  texX = (x / containerWidth) * resolution
  texY = (1.0 - y / containerHeight) * resolution
  
  // Apply gaussian-like falloff in radius
  for each point in circle(radius):
    distance = length(point - center)
    falloff = (1.0 - distance/radius)²
    rippleValue = cos((distance/radius) * π/2) * strength * falloff
    waterBuffer[point] += rippleValue
}
```

**Data Texture Upload**:
```javascript
// Upload water height map to GPU every frame
waterTexture.image.data = waterBuffers.current  // Float32Array
waterTexture.needsUpdate = true
```

---

### 2. Audio Analysis (CPU → GPU)

**FFT Processing** (60fps):
```javascript
function updateAudioAnalysis() {
  if (!analyser) {
    // Mock audio when silent
    mockAudio = (sin(time * 2) + 1) / 2 * 0.3
    return mockAudio
  }
  
  // Get frequency data (0-255 per bin)
  analyser.getByteFrequencyData(dataArray)  // Uint8Array[128]
  
  // Split into frequency bands
  bassEnd = floor(dataArray.length * 0.1)   // 0-10% (bass)
  midEnd = floor(dataArray.length * 0.5)    // 10-50% (mids)
  // 50-100% (treble)
  
  // Average each band
  bass = average(dataArray[0...bassEnd]) / 255
  mid = average(dataArray[bassEnd...midEnd]) / 255
  treble = average(dataArray[midEnd...end]) / 255
  overall = (bass + mid + treble) / 3
  
  // Smooth with attack/decay
  isRising = overall > currentOverall
  smoothing = isRising ? 0.3 : 0.75  // Fast attack, slow decay
  
  audioLow = lerp(audioLow, bass, 1 - smoothing)
  audioMid = lerp(audioMid, mid, 1 - smoothing)
  audioHigh = lerp(audioHigh, treble, 1 - smoothing)
  audioOverall = lerp(audioOverall, overall, 1 - smoothing)
  
  // Send to shader
  material.uniforms.u_audioLow.value = audioLow
  material.uniforms.u_audioMid.value = audioMid
  material.uniforms.u_audioHigh.value = audioHigh
  material.uniforms.u_audioOverall.value = audioOverall
}
```

---

### 3. Shader Rendering (GPU)

**Vertex Shader** (Simple passthrough):
```glsl
varying vec2 vUv;

void main() {
  vUv = uv;  // Pass texture coordinates to fragment shader
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

**Fragment Shader** (Complex pattern generation):
```glsl
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_color1, u_color2, u_color3;  // Purple, cyan, magenta
uniform sampler2D u_waterTexture;
uniform float u_waterStrength;
uniform float u_audioLow, u_audioMid, u_audioHigh, u_audioOverall;
uniform float u_offsetX, u_offsetY;  // Position in container
uniform float u_scale;  // Orb size

void main() {
  // 1. Convert to screen space (aspect-corrected)
  vec2 screenP = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  
  // 2. Apply position offset
  screenP.x -= u_offsetX;
  screenP.y -= u_offsetY;
  
  // 3. Sample water texture
  vec2 wCoord = gl_FragCoord.xy / u_resolution;
  float waterHeight = texture2D(u_waterTexture, wCoord).r;
  float waterInfluence = clamp(waterHeight * u_waterStrength, -0.5, 0.5);
  
  // 4. Calculate audio-reactive circle radius
  float baseRadius = 0.6 * u_scale;
  float easedAudio = u_audioOverall - (sin(u_audioOverall * π * 2.0) * 0.1 * (1.0 - u_audioOverall));
  float audioPulse = easedAudio * 0.25;  // Bouncy response
  float waterPulse = waterInfluence * 0.2;
  float circleRadius = baseRadius + audioPulse + waterPulse;
  
  // 5. Create circular mask
  float distFromCenter = length(screenP);
  float inCircle = smoothstep(circleRadius + 0.02, circleRadius - 0.02, distFromCenter);
  
  // 6. Drop shadow
  vec2 shadowOffset = vec2(0.03, -0.03);
  float shadowDist = length(screenP - shadowOffset);
  float shadowCircle = smoothstep(circleRadius + 0.18, circleRadius - 0.08, shadowDist);
  vec4 o = vec4(0.0);
  
  if (shadowCircle > 0.0 && inCircle < 0.5) {
    o = vec4(0.0, 0.0, 0.0, shadowCircle * 0.35);  // Black shadow
  }
  
  // 7. Inside circle: generate pattern
  if (inCircle > 0.0) {
    vec2 p = screenP * 1.1;
    
    // Audio influence
    float audioInfluence = (u_audioLow * 0.3 + u_audioMid * 0.4 + u_audioHigh * 0.3);
    
    // Rotation matrix based on distance + audio
    float angle = length(p) * 4.0 + audioInfluence * 2.0;
    mat2 R = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    p *= R;
    
    // Pattern generation (Moebius-inspired)
    float l = length(p) - 0.7 + waterInfluence * 0.5 + audioInfluence * 0.2;
    float t = u_time * u_speed + waterInfluence * 2.0 + audioInfluence * 1.5;
    float enhancedY = p.y + waterInfluence * 0.3 + audioInfluence * 0.2;
    
    // Three-phase pattern for depth
    float pattern1 = 0.5 + 0.5 * tanh(0.1 / max(l/0.1, -l) - sin(l + enhancedY * max(1.0, -l/0.1) + t));
    float pattern2 = 0.5 + 0.5 * tanh(0.1 / max(l/0.1, -l) - sin(l + enhancedY * max(1.0, -l/0.1) + t + 1.0));
    float pattern3 = 0.5 + 0.5 * tanh(0.1 / max(l/0.1, -l) - sin(l + enhancedY * max(1.0, -l/0.1) + t + 2.0));
    
    // Iridescent color mixing
    vec3 iridescent = mix(
      mix(u_color1, u_color2, pattern1),
      u_color3,
      pattern3
    );
    
    // Glossy highlights
    float glossiness = pow(pattern2, 2.0) * 0.3;
    vec3 highlight = vec3(1.0, 1.0, 1.0) * glossiness;
    
    // Combine
    float baseIntensity = 1.0 + waterInfluence * 0.2 + audioInfluence * 0.3;
    vec3 finalColor = (iridescent * baseIntensity) + highlight;
    
    o.rgb = finalColor;
    o.a = inCircle * 0.95;  // Glass effect
  }
  
  gl_FragColor = o;
}
```

**Color Scheme**:
```javascript
// Glass-like iridescent purple/cyan
color1 = [0.6, 0.4, 1.0]  // Purple
color2 = [0.4, 0.8, 1.0]  // Cyan
color3 = [0.8, 0.6, 1.0]  // Light magenta
```

---

### 4. Interactive Input

**Mouse Movement**:
```javascript
handleMouseMove(event) {
  // Throttle to 8ms (~120fps)
  if (now - lastThrottle < 8) return
  
  // Calculate velocity
  dx = currentX - lastX
  dy = currentY - lastY
  distance = sqrt(dx² + dy²)
  velocity = distance / 8
  
  // Velocity-based intensity
  velocityInfluence = min(velocity / 10, 2.0)
  baseIntensity = min(distance / 20, 1.0)
  fluidIntensity = baseIntensity * velocityInfluence * 0.3
  
  // Add random variation
  finalIntensity = fluidIntensity * random(0.7, 1.0)
  
  addRipple(x, y, finalIntensity)
}
```

**Click/Touch**:
```javascript
handleClick(event) {
  addRipple(x, y, 1.2)  // Stronger ripple
}

handleTouchMove(event) {
  // Throttle to 25ms (~40fps) on mobile
  // Similar to mouse but adjusted for touch sensitivity
}
```

---

## Audio Integration

### Data Flow Diagram

```
┌──────────────────────┐
│   Agent TTS Server   │
│  (generates audio)   │
└──────────┬───────────┘
           │ WebSocket
           ▼
┌──────────────────────────────────────────┐
│      useSocketChatStore.ts               │
│                                          │
│  socket.on('audio', (audioBuffer) => {   │
│    playAudioDirectly(audioBuffer)        │
│  })                                      │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│   playAudioDirectly Function             │
│                                          │
│  1. Create AudioContext                  │
│  2. Decode audio buffer                  │
│  3. Create AnalyserNode                  │
│     - fftSize: 256                       │
│     - smoothingTimeConstant: 0.8         │
│  4. Create GainNode (volume control)     │
│  5. Connect: source → analyser →         │
│              gain → destination          │
│  6. Store: visualizerAnalyser            │
│  7. Play audio                           │
└──────────┬───────────────────────────────┘
           │ State update
           ▼
┌──────────────────────────────────────────┐
│      agent-chat.tsx                      │
│                                          │
│  const { visualizerAnalyser } =          │
│    useSocketChatStore()                  │
│                                          │
│  const [agentAnalyser, setAgentAnalyser] │
│    = useState<AnalyserNode | null>(null) │
│                                          │
│  useEffect(() => {                       │
│    setAgentAnalyser(visualizerAnalyser)  │
│  }, [visualizerAnalyser])                │
└──────────┬───────────────────────────────┘
           │ Props
           ▼
┌──────────────────────────────────────────┐
│   AudioVisualizerMoebius                 │
│                                          │
│  props: { analyser: agentAnalyser }      │
│                                          │
│  useEffect(() => {                       │
│    analyser.fftSize = 256                │
│    analyserBuffer = new Uint8Array(128)  │
│                                          │
│    animate() {                           │
│      analyser.getByteFrequencyData(      │
│        analyserBuffer                    │
│      )                                   │
│      // Process frequency data           │
│      // Update shader uniforms           │
│    }                                     │
│  }, [analyser])                          │
└──────────────────────────────────────────┘
```

### Key Integration Points

1. **WebSocket → Store**
   - File: `src/store/useSocketChatStore.ts`
   - Function: `socket.on('audio', ...)`
   - Action: Receives audio chunks from server

2. **Store → Audio Context**
   - File: `src/store/useSocketChatStore.ts`
   - Function: `playAudioDirectly()`
   - Action: Creates analyser node, plays audio

3. **Store → Component**
   - File: `src/components/agent/agent-chat.tsx`
   - Hook: `useSocketChatStore()`
   - Action: Retrieves `visualizerAnalyser` from store

4. **Component → Visualizer**
   - File: `src/components/agent/agent-chat.tsx`
   - Props: `<AudioVisualizerMoebius analyser={agentAnalyser} />`
   - Action: Passes analyser to visualizer

5. **Visualizer → GPU**
   - File: `src/components/visualizers/audio-visualizer-moebius.tsx`
   - Function: `updateAudioAnalysis()`
   - Action: FFT → shader uniforms

---

## Technical Details

### Performance Characteristics

| Metric | Desktop | Mobile |
|--------|---------|--------|
| **Target FPS** | 60 | 30-60 |
| **Water Resolution** | 256x256 | 128x128 |
| **Water Points** | 65,536 | 16,384 |
| **FFT Size** | 256 | 256 |
| **Frequency Bins** | 128 | 128 |
| **Update Rate** | 60fps | 60fps |
| **Memory Usage** | ~5-10MB | ~3-5MB |
| **CPU Usage** | ~5-10% | ~10-15% |
| **GPU Usage** | Low | Low |

### Water Simulation Settings

```typescript
const waterSettings = {
  resolution: isMobile ? 128 : 256,  // Grid size
  damping: 0.96,                     // Energy loss per frame
  mouseIntensity: 0.3,               // Mouse ripple strength
  clickIntensity: 1.2,               // Click ripple strength
  rippleRadius: isMobile ? 12 : 20,  // Ripple spread radius (pixels)
};
```

### Shader Uniforms

```typescript
material.uniforms = {
  u_time: { value: 0.0 },                           // Elapsed time
  u_resolution: { value: [width, height] },         // Canvas size
  u_speed: { value: 0.8 },                          // Animation speed
  u_color1: { value: [0.6, 0.4, 1.0] },            // Purple
  u_color2: { value: [0.4, 0.8, 1.0] },            // Cyan
  u_color3: { value: [0.8, 0.6, 1.0] },            // Magenta
  u_waterTexture: { value: waterTexture },          // Water height map
  u_waterStrength: { value: 0.4 },                  // Water distortion
  u_audioLow: { value: 0.0 },                       // Bass (0-1)
  u_audioMid: { value: 0.0 },                       // Mids (0-1)
  u_audioHigh: { value: 0.0 },                      // Treble (0-1)
  u_audioOverall: { value: 0.0 },                   // Average (0-1)
  u_offsetX: { value: 0.8 },                        // Horizontal position
  u_offsetY: { value: 0.6 },                        // Vertical position
  u_scale: { value: 1.0 },                          // Orb size
};
```

### Audio Processing

**Frequency Bands**:
```
Bass:   Bins 0-12    (0-10% of spectrum)   ~20-200 Hz
Mid:    Bins 13-64   (10-50% of spectrum)  ~200-2000 Hz
Treble: Bins 65-127  (50-100% of spectrum) ~2000-20000 Hz
```

**Smoothing**:
```javascript
// Attack/Decay envelope
isRising = newValue > currentValue
smoothing = isRising ? 0.3 : 0.75

// Fast rise, slow fall for bouncy feel
newValue = currentValue * smoothing + newValue * (1 - smoothing)
```

---

## Integration Points

### Where to Find Things

#### 1. **Adding the Visualizer to a New Page**

```typescript
// Import
import { AudioVisualizerMoebius } from '@/components/visualizers';

// Usage
<AudioVisualizerMoebius
  analyser={yourAnalyserNode}
  isDark={isDark}
  volume={volume}
  className="w-full h-full"
  debug={false}  // Set to true for debugging
  scale={1.0}    // Adjust orb size
/>
```

#### 2. **Getting the Analyser Node**

```typescript
// From store
import useSocketChatStore from '@/store/useSocketChatStore';

const YourComponent = () => {
  const { visualizerAnalyser } = useSocketChatStore();
  
  // visualizerAnalyser is automatically created when audio plays
  // via playAudioDirectly() in the store
  
  return (
    <AudioVisualizerMoebius analyser={visualizerAnalyser} />
  );
};
```

#### 3. **Customizing Colors**

Edit `src/components/visualizers/audio-visualizer-moebius.tsx`, lines 143-146:

```typescript
// Glass-like iridescent purple-cyan color scheme
const color1 = [0.6, 0.4, 1.0];  // Purple
const color2 = [0.4, 0.8, 1.0];  // Cyan
const color3 = [0.8, 0.6, 1.0];  // Light purple/magenta
```

#### 4. **Adjusting Water Physics**

Edit `src/components/visualizers/audio-visualizer-moebius.tsx`, lines 68-74:

```typescript
const waterSettings = {
  resolution: isMobile ? 128 : 256,  // Lower = faster
  damping: 0.96,                      // Higher = waves last longer
  mouseIntensity: 0.3,                // Increase for stronger ripples
  clickIntensity: 1.2,                // Increase for bigger splashes
  rippleRadius: isMobile ? 12 : 20,   // Increase for wider ripples
};
```

#### 5. **Modifying Audio Sensitivity**

Edit `src/components/visualizers/audio-visualizer-moebius.tsx`, lines 560-576:

```typescript
// Adjust smoothing values
const attackSmoothing = 0.3;   // Lower = faster response (0.1-0.5)
const decaySmoothing = 0.75;   // Higher = slower decay (0.5-0.9)

// Adjust pulsing amount (line 198)
float audioPulse = easedAudio * 0.25;  // Increase for more pulsing
```

---

## Configuration

### Props

```typescript
type Props = {
  analyser?: AnalyserNode | null;  // Web Audio API analyser node
  className?: string;              // CSS classes for container
  isDark?: boolean;                // Theme mode (default: true)
  volume?: number;                 // Volume level 0-1 (default: 1)
  debug?: boolean;                 // Show debug overlays (default: false)
  scale?: number;                  // Orb scale factor (default: 1.0, range: 0.1-2.0)
};
```

### Default Values

```typescript
<AudioVisualizerMoebius
  analyser={null}     // Will show mock animation if null
  isDark={true}       // Purple/cyan colors
  volume={1}          // Full volume
  debug={false}       // No debug overlays
  scale={1.0}         // Normal size
/>
```

### Position & Scale

The orb position is controlled by shader uniforms:

```typescript
// Center horizontally, slightly up from center
u_offsetX: 0.8   // Range: -2.0 to 2.0 (negative = left, positive = right)
u_offsetY: 0.6   // Range: -2.0 to 2.0 (negative = down, positive = up)
u_scale: 1.0     // Range: 0.1 to 2.0 (orb size multiplier)
```

**Coordinate System**:
- `(0, 0)` = center of container
- `u_offsetX: 1.0` = move right by container height
- `u_offsetY: 1.0` = move up by container height
- Width-based positioning uses aspect ratio correction

---

## Debug Mode

### Enabling Debug Mode

```typescript
<AudioVisualizerMoebius
  analyser={analyser}
  debug={true}  // Enable debug overlays
/>
```

### Debug Features

When `debug={true}`, you get:

1. **Red Border** around container
2. **Debug Label** (top-left corner) showing:
   - Component name
   - Orb center position (pixels)
   - Orb radius (pixels)

3. **Lime Crosshair** at orb center
   - Horizontal and vertical lines
   - Center dot

4. **Yellow Dashed Circle** showing orb radius

5. **Cyan Corner Markers** showing container bounds

6. **Console Logs**:
   ```
   [AudioVisualizerMoebius] Initialized: { offsetX, offsetY }
   [AudioVisualizerMoebius] Container Info: { width, height, aspectRatio }
   [AudioVisualizerMoebius] Orb: { centerX, centerY, radiusPx }
   [AudioVisualizerMoebius] Resized: { ... }
   ```

### Debug Output Example

```javascript
{
  container: {
    width: 800,
    height: 600,
    aspectRatio: "1.33"
  },
  position: {
    top: 100,
    left: 50,
    right: 850,
    bottom: 700
  },
  orb: {
    centerX: "880.00",     // Pixels from left
    centerY: "240.00",     // Pixels from top
    radiusPx: "360.00",    // Radius in pixels
    shaderOffsetX: 0.8,
    shaderOffsetY: 0.6,
    shaderBaseRadius: 0.6
  },
  orbPercentages: {
    centerX: "110.0%",     // Of container width
    centerY: "40.0%",      // Of container height
    radiusOfHeight: "60.0%",
    radiusOfWidth: "45.0%"
  }
}
```

---

## Troubleshooting

### Issue: Visualizer not showing

**Check**:
1. Container has width and height (not 0x0)
2. z-index is high enough to be visible
3. No CSS hiding the element

**Fix**:
```typescript
// Ensure container has size
<div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
  <AudioVisualizerMoebius ... />
</div>
```

### Issue: No audio reactivity

**Check**:
1. `analyser` prop is not null
2. Audio is actually playing
3. Check browser console for errors

**Debug**:
```typescript
// In browser console
useSocketChatStore.getState().visualizerAnalyser  // Should be AnalyserNode
useSocketChatStore.getState().volume              // Should be > 0
```

**Enable debug mode**:
```typescript
<AudioVisualizerMoebius analyser={analyser} debug={true} />
```

### Issue: Ripples not working

**Check**:
1. Mouse events are reaching the container
2. `pointer-events` CSS is not set to `none`
3. No overlay blocking interaction

**Test**:
```javascript
// Add this temporarily
renderer.domElement.addEventListener('click', () => {
  console.log('Click detected!');
});
```

### Issue: Performance issues

**Solutions**:
1. Lower water resolution:
   ```typescript
   resolution: 128  // or even 64 for very old devices
   ```

2. Reduce ripple radius:
   ```typescript
   rippleRadius: 8  // smaller area to update
   ```

3. Increase throttle time:
   ```typescript
   if (now - mouseThrottleTimeRef.current < 16) return;  // 60fps → 30fps
   ```

4. Disable on low-end devices:
   ```typescript
   const isLowEnd = navigator.hardwareConcurrency <= 4;
   if (isLowEnd) return <SimpleFallbackVisualizer />;
   ```

---

## Summary

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/components/visualizers/audio-visualizer-moebius.tsx` | Main visualizer | 824 |
| `src/components/visualizers/index.tsx` | Export barrel | 4 |
| `src/components/agent/agent-chat.tsx` | Integration | 1122 |
| `src/store/useSocketChatStore.ts` | Audio pipeline | ~1000 |

### Data Flow

```
TTS Server → WebSocket → Store.playAudioDirectly() → AnalyserNode → 
Store.visualizerAnalyser → AgentChat.agentAnalyser → 
AudioVisualizerMoebius.analyser → FFT → Shader Uniforms → GPU
```

### Key Technologies

- **Three.js**: 3D rendering engine
- **WebGL/GLSL**: GPU shader programming
- **Web Audio API**: FFT analysis
- **React**: Component framework
- **TypeScript**: Type safety
- **Zustand**: State management

### Performance

- ✅ 60fps on modern desktops
- ✅ 30-60fps on mobile
- ✅ ~5-10MB memory footprint
- ✅ GPU-accelerated rendering
- ✅ Adaptive resolution
- ✅ Efficient water simulation

---

**Status**: ✅ Production Ready  
**Version**: 2.0.0 (Fluid Edition)  
**Last Updated**: December 2025

---

For questions or issues, refer to the source code comments or enable `debug={true}` mode for detailed logging.

