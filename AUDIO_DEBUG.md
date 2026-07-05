# Audio Debugging Guide 🔍

## Issue
The visualizer may not be receiving audio from the agent's TTS.

## How Audio Should Flow

```
TTS Response → WebSocket → useSocketChatStore → playAudioDirectly() → 
AudioContext → AnalyserNode → visualizerAnalyser → agentAnalyser → 
AudioVisualizerMoebius component
```

## Changes Made

### 1. Volume Fix
Added code to ensure volume is set to 1.0 when in visualizer mode:

```typescript
if (vrmDisplayMode === VRMDisplayEnums.VISUALIZER && volume === 0) {
  setVolume(1.0);
  console.log('[AgentChat] Set volume to 1.0 for visualizer mode');
}
```

**Why**: The audio graph needs volume > 0 to create the analyser node properly.

### 2. Better Logging
Added console logs to track when the visualizer analyser is set up:

```typescript
console.log('[AgentChat] Setting up visualizer analyser:', visualizerAnalyser);
```

## How to Debug

### Step 1: Check Browser Console
When the agent speaks, you should see these logs:

```
[AgentChat] Setting up visualizer analyser: AnalyserNode {...}
[AgentChat] Starting visualizer audio monitoring with 128 frequency bins
[AgentChat] Visualizer audio monitoring - hasData: true maxValue: 150
```

### Step 2: Check Audio is Playing
In `useSocketChatStore.ts`, the `playAudioDirectly` function should:
1. Create an AudioContext
2. Create an AnalyserNode with fftSize 256
3. Store it in `visualizerAnalyser`
4. Play the audio

Look for these logs:
```
✨ Audio analysis initialized successfully
```

### Step 3: Check the Analyser Exists
Open browser console and type:
```javascript
useSocketChatStore.getState().visualizerAnalyser
```

Should return an AnalyserNode object, not null.

### Step 4: Check Volume
```javascript
useSocketChatStore.getState().volume
```

Should be 1.0 (or higher), not 0.

### Step 5: Test the Visualizer
Send a message to the agent and watch for:
- Audio should play
- Console should show audio data being received
- Visualizer should pulse/react

## Common Issues

### Issue: Volume is 0
**Fix**: Make sure `vrmDisplayMode` is set to `VISUALIZER` before audio plays.

### Issue: visualizerAnalyser is null
**Cause**: Audio hasn't played yet, or audio context failed to initialize.
**Fix**: 
1. Check browser allows audio autoplay
2. Try clicking anywhere on the page first
3. Check console for audio context errors

### Issue: hasData is always false
**Cause**: Analyser exists but isn't connected to audio source.
**Fix**: Check `playAudioDirectly` in useSocketChatStore - the audio graph should be:
```
source → analyser → gainNode → destination
```

### Issue: Visualizer doesn't react
**Possible causes**:
1. Analyser not being passed to component
2. Update loop not running
3. Shader uniforms not updating

**Check**:
```javascript
// In AudioVisualizerMoebius component, add this in updateAudioAnalysis:
console.log('Audio values:', {
  bass: materialRef.current.uniforms.u_audioLow.value,
  mid: materialRef.current.uniforms.u_audioMid.value, 
  treble: materialRef.current.uniforms.u_audioHigh.value,
  overall: materialRef.current.uniforms.u_audioOverall.value
});
```

## Quick Test

1. **Refresh the page**
2. **Make sure visualizer mode is active**
3. **Send a message to the agent**
4. **Watch the console**

You should see logs like:
```
[AgentChat] Set volume to 1.0 for visualizer mode
[AgentChat] Setting up visualizer analyser: AnalyserNode
[AgentChat] Visualizer audio monitoring - hasData: true maxValue: 120
```

If you don't see these, the audio pipeline isn't working correctly.

## Manual Test

If you want to test without waiting for the agent:

```javascript
// In browser console:
const ctx = new AudioContext();
const osc = ctx.createOscillator();
const analyser = ctx.createAnalyser();
osc.connect(analyser);
analyser.connect(ctx.destination);
osc.start();

// Manually set the analyser
useSocketChatStore.setState({ visualizerAnalyser: analyser });
```

The visualizer should start reacting to the oscillator tone.

## Expected Behavior

When working correctly:
- ✅ Volume is automatically set to 1.0 in visualizer mode
- ✅ Each audio chunk creates a new analyser
- ✅ Analyser is stored in socket store
- ✅ Agent-chat picks up the analyser
- ✅ Passes it to AudioVisualizerMoebius
- ✅ Visualizer reads frequency data 60x per second
- ✅ Orb pulses and reacts to audio

---

**Next Steps**: Check the browser console when you send a message to see which logs appear!



