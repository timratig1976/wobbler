# Wobbler — Max for Live / RNBO Architecture Plan

## Device Type
**Max Instrument** (`.amxd` in Ableton Live's Instruments folder)  
Receives MIDI input from Live track → outputs stereo audio to Live mixer.

---

## High-Level Structure

```
Live MIDI → [plugin~]
               ↓
         [rnbo~ wobbler-voice @polyphony 8]
               ↓ (stereo audio)
         [M4L FX wrapper: reverb + delay]
               ↓
         [live.gain~ / plugout~] → Live mixer
```

The `rnbo~` object contains the entire per-voice DSP **including reverb** (via `gen~.gigaverb` inside RNBO). The M4L patcher (`.amxd`) wraps it with:
- `midiin` → rightmost inlet of `rnbo~` (MIDI inlet)
- `live.dial` / `live.slider` / `live.menu` UI objects controlling RNBO params via messages
- `live.thisdevice` for safe LOM initialization
- Step sequencer abstraction (`wobbler-seq.maxpat`)

> **Important**: BPM sync is handled **inside RNBO** using `phasor~ @lock 1` and `metro @lock 1` — these automatically lock to the host transport (Live's tempo) with no param passing required.

---

## File Layout

Use a **Max Project** (`.maxproj`) to organise work — two main patches:

```
wobbler/
  max-for-live/
    WobblerProject.maxproj    ← Max Project file
    Wobbler.amxd              ← M4L device (hosts exported Max external)
    wobbler-voice-design.maxpat ← development patch (contains rnbo~ for editing)
    wobbler-voice.rnbo        ← RNBO voice patcher source
    exports/
      wobbler-voice.mxe64     ← exported Max external (used in .amxd)
    wobbler-seq.maxpat        ← step sequencer abstraction
    README.md
```

> **Workflow**: Design DSP in `wobbler-voice.rnbo` → export to `wobbler-voice.mxe64` (Max External) → the `.amxd` loads the external, NOT the raw `rnbo~`. This is the **recommended M4L distribution pattern** (faster load, IP protection, no compile on open).

---

## Web Audio → RNBO Object Mapping

| Web Audio API | RNBO Object | Notes |
|---|---|---|
| `OscillatorNode` (sine) | `cycle~` | |
| `OscillatorNode` (sawtooth) | `saw~` | |
| `OscillatorNode` (square) | `rect~` | duty=0.5 |
| `OscillatorNode` (triangle) | `tri~` | |
| Pulse (PeriodicWave) | `rect~` + `param pw` | duty cycle param |
| Supersaw (7× osc bank) | 7× `saw~` + mix in `codebox~` | detune offsets as params |
| `BiquadFilterNode` | `svf~` | LP/HP/BP/Notch modes |
| `GainNode` | `*~` or `gain~` | |
| `StereoPannerNode` | `pan~` | |
| `WaveShaperNode` | `codebox~` | tanh / hard-clip / fold / asym / fuzz |
| `DelayNode` | `delay~` | inside RNBO or M4L level |
| `ConvolverNode` (reverb) | `freeverb~` in M4L wrapper | IR convolution not in RNBO |
| ADSR scheduling | `adsr~` | RNBO built-in |
| `ConstantSourceNode` (TWE) | `sig~` | constant signal source |
| `AnalyserNode` | `scope~` in M4L wrapper | metering/visualisation |
| `createPeriodicWave` | `codebox~` (additive) | custom waveforms |

---

## RNBO Voice Patcher — `wobbler-voice.rnbo`

### MIDI Input
```
[notein] → pitch (MIDI note) + velocity
pitch → [mtof~] → frequency
velocity → [sig~] → [>~ 0.] → gate (1=noteOn, 0=noteOff)
gate → envelope trigger + thispoly~ busy state

Velocity scaling: [sig~] → [latch~] (gated by >~ 0.) → [/~ 127] → 0..1
```

> Feed `midiin` in the M4L wrapper to the **rightmost inlet** of `rnbo~` (the dedicated MIDI inlet). MIDI is automatically distributed to all `notein` objects anywhere in the RNBO patch and subpatches.

### Oscillator Section
Start from the **RNBO Synth Building Blocks** package (`Extras > synth-building-blocks`):
- `sbb.osc.analog` — provides sine/saw/triangle/square/pulse waveforms via `[param mode @enum noise sine saw triangle square pulse]`
- Load as: `[p @file sbb.osc.analog @title oscillator]`

Extensions for Wobbler:
- **Waveform select**: `[param waveform @enum sine saw square triangle pulse supersaw]` → `[selector~]`
- **Supersaw**: 7× `saw~` with individual detune offsets mixed in `codebox~`
- **Unison**: `[param uni_count @min 1 @max 8]`, `[param uni_detune @min 0 @max 100]`, `[param uni_spread @min 0 @max 1]`
  - Each voice gets `pan~` for stereo spread
- **Noise generator**: `noise~` (white) + `codebox~` for pink/brown/blue/violet
  - `[param noise_filter_mix @min 0 @max 1]` routes noise to filter or bypass

### Filter
Start from **Synth Building Blocks** `sbb.filter.lp` and `sbb.filter.hp`:
```
[param filterCutoff 800 @min 20 @max 20000 @unit hz]
[param filterQ 0.5 @min 0.01 @max 30]
[param filterType @enum lopass hipass bandpass notch bypass]
  → [selector~] selects between filter outputs

Smoothing: param → [append 40] → [line~] → filter inlet (40ms ramp)
Filter envelope: adsr~ output × [param filterEnvAmt @min -20000 @max 20000] → add to cutoff
Wet/dry: [param filterMix @min 0 @max 1]
```

### ADSR
Start from **Synth Building Blocks** `sbb.env.adsr` — load as `[p @file sbb.env.adsr @title envelope]`:
```
Left inlet: audio signal to envelope
Right inlet: gate signal (from >~ 0. applied to velocity)

[param attack  @min 1 @max 4000 @unit ms]
[param decay   @min 1 @max 4000 @unit ms]
[param sustain @min 0 @max 1]
[param release @min 1 @max 8000 @unit ms]

Outlet → thispoly~ (RNBO automatic voice busy/free management)
```

> With `@polyphony 8`, param names are prefixed `poly/` externally: e.g. send `poly/envelope/attack 100` to `rnbo~`.

### 5 LFOs
Each LFO implemented as a RNBO subpatcher `p lfoN`:
```
[param lfoN_wave @enum sine saw square tri samplehold stepped]
[param lfoN_rate @min 0.01 @max 20 @unit hz]
[param lfoN_depth]
[param lfoN_target @enum cutoff resonance volume pitch noiseAmt chorus]
[param lfoN_bpm_sync @enum free locked]
[param lfoN_sync_div]  ← in ticks; use [translate] object for note values

BPM sync implementation:
  FREE:   [phasor~] driven by lfoN_rate
  LOCKED: [phasor~ @lock 1] — automatically syncs to host transport (Live tempo)
          rate set via ticks: use [translate] to convert note divisions to ticks

Waveform shaping in codebox~ (stateful objects):
  @state myPhasor = new phasor();
  // advance .next(rate), then shape output per wave type
```

**LFO 5 (Meta-LFO)**: modulates LFO1–4 `rate` or `depth` param via `[param lfo5_meta_target]` and `[param lfo5_meta_lfo]`

### TWE — Temporal Wobble Engine
Most complex section. Implemented entirely in `codebox~` for sample-accurate timing:

```
[param twe_chaos @min 0 @max 1]
[param twe_amt   @min 0 @max 1]
```

Codebox~ structure (rnboscript, one per lane):
```js
// @state variables persist across samples
@state myPhasor = new phasor();   // for persistent LFO lanes
@state phase = 0.0;
@state envState = 0;  // 0=idle, 1=delay, 2=attack, 3=sustain, 4=decay, 5=done
@state envTime = 0;
@state delaySamples = 0;

// in1 = gate (1=noteOn, 0=noteOff), in2 = bpm, in3 = depth, in4 = rate
// out1 = modulation signal

if (in1 > 0 && envState == 0) {
  delaySamples = startBar * (samplerate * 60.0 / in2) * 4;
  envState = 1;  // start delay
}
// ... state machine for delay → attack → decay/sustain
// outputs shaped modulation depth × rand chaos factor
```

> `samplerate` is a built-in constant in rnboscript. BPM comes from the host transport via `tempo` object (no param needed).

### Distortion
```
codebox~ distortion
  ← param dist_form (0=soft,1=hard,2=fold,3=asym,4=fuzz)
  ← param dist_drive (0–1)
  ← param dist_tone  (Hz)
  ← param dist_mix   (0–1 wet/dry)
  ← param dist_vol   (output gain)

Shapes:
  soft: tanh(x·k) / tanh(k)
  hard: clamp(x·k, -1, 1)
  fold: wavefolder (reflect at ±1)
  asym: asymmetric tanh (2nd harmonic bias)
  fuzz: sign(x)·|x|^0.2
```

### 3-Band EQ
```
biquad~ (low shelf,  param eq_low_freq,  param eq_low_gain)
biquad~ (peaking,    param eq_mid_freq,  param eq_mid_gain,  param eq_mid_q)
biquad~ (high shelf, param eq_high_freq, param eq_high_gain)
param eq_bypass (bool)
```

### FX (Reverb + Delay)
**Reverb INSIDE RNBO** via `gen~.gigaverb` (copy from `Help > Examples > gen > gen~.gigaverb`):
```
[gen~ @title gigaverb]  ← paste gigaverb gen code inside
[param reverbTime 10 @min 0.1 @max 100] → [set revtime] → gen~
[param reverbMix 0 @min 0 @max 1]
[p @file sbb.util.xfade @title crossfade]  ← dry/wet crossfader from SBB package
```

**Delay INSIDE RNBO**:
```
[delay~ 4000]  ← RNBO delay object
[param delayTime @min 0 @max 2000 @unit ms]
[param delayFB   @min 0 @max 0.95]
[param delayMix  @min 0 @max 1]
```

> Both FX inside RNBO means the entire voice DSP is self-contained in a single exportable patch. This is the pattern used in the official RNBO MIDI Synthesizer tutorial.

---

## M4L Patcher (`Wobbler.amxd`) Structure

```
[plugin~] (no-op for instruments — MIDI comes via midiin)

[live.thisdevice] → initialization bang

[midiin] → rightmost inlet of [wobbler-voice] (MIDI inlet)

[wobbler-voice]  ← this is the EXPORTED MAX EXTERNAL (not raw rnbo~)
  ← params controlled via messages: "poly/oscillator/waveform 2"
  → outlet 1: left audio
  → outlet 2: right audio

[live.gain~] → [plugout~]
```

> During development, replace `[wobbler-voice]` with `[rnbo~ @patcher wobbler-voice @polyphony 8]`. For distribution, export to Max external and use that object name instead.

### Polyphony Configuration
- `rnbo~ @polyphony 8` — 8 voice instances; voice stealing automatic
- `notein` inside RNBO receives MIDI fed to the rightmost inlet from external `midiin`
- `thispoly~` connected to envelope output → auto busy/free
- **Param naming externally**: `poly/subpatcher/paramname` (e.g. `poly/envelope/attack`)
- **Setting all voices**: send `poly/envelope/attack 100` → sets all 8 voices at once
- **Export option**: enable `Link Polyphony to rnbo~` in Export Sidebar to match voice count

---

## Parameter UI — `live.dial` / `live.slider` Mapping

| Section | Object | Param | Range |
|---|---|---|---|
| OSC | `live.menu` | waveform | sine/saw/sqr/tri/pulse/supersaw |
| OSC | `live.dial` | pitch semitones | -24..+24 |
| OSC | `live.dial` | cent | -100..+100 |
| OSC | `live.dial` | volume | 0..1 |
| OSC | `live.dial` | PW | 0..1 |
| OSC | `live.numbox` | unison count | 1..8 |
| OSC | `live.dial` | unison detune | 0..100 ct |
| OSC | `live.dial` | unison spread | 0..1 |
| Filter | `live.menu` | filter_type | LP/HP/BP/Notch |
| Filter | `live.dial` | cutoff | 20..20000 Hz |
| Filter | `live.dial` | resonance | 0.1..30 |
| Filter | `live.dial` | env_amount | -20000..+20000 |
| Filter | `live.dial` | filter_mix | 0..1 |
| ADSR | `live.dial` | attack | 0.001..4 s |
| ADSR | `live.dial` | decay | 0.001..4 s |
| ADSR | `live.dial` | sustain | 0..1 |
| ADSR | `live.dial` | release | 0.001..8 s |
| LFO1-5 | `live.menu` | lfoN_wave | sine/saw/sq/tri/s&h/step |
| LFO1-5 | `live.dial` | lfoN_rate | 0.01..20 Hz |
| LFO1-5 | `live.dial` | lfoN_depth | 0..1 |
| LFO1-5 | `live.menu` | lfoN_target | cutoff/res/vol/pitch/noise/chorus |
| LFO1-5 | `live.toggle` | lfoN_bpm_sync | 0/1 |
| TWE | `live.dial` | twe_amt | 0..1 |
| TWE | `live.dial` | twe_chaos | 0..1 |
| Dist | `live.menu` | dist_form | soft/hard/fold/asym/fuzz |
| Dist | `live.dial` | dist_drive | 0..1 |
| Dist | `live.dial` | dist_mix | 0..1 |
| EQ | `live.dial` | eq_low/mid/high_gain | -15..+15 dB |
| FX | `live.dial` | reverb_mix | 0..1 |
| FX | `live.dial` | delay_mix | 0..1 |
| FX | `live.dial` | delay_time | 0..2 s |
| Global | `live.gain~` | master volume | -inf..+6 dB |

Connect each `live.dial` to its RNBO param using the `param_connect` attribute:  
`gen~_rnbo::cutoff` → sets bidirectional connection.

---

## BPM Sync

**No external BPM param needed.** Use RNBO's native transport locking:

```
Inside RNBO patcher:
  [phasor~ @lock 1]  ← automatically syncs to host transport (Live tempo)
  Standard Max Time Value Syntax works: 4n, 8n, 2n, etc.

  [metro @lock 1 500]  ← 500ms interval, locked to transport

  [transport]  ← query transport state (running/stopped)
  [tempo]      ← query/set global tempo value
  [beattime]   ← current beat position

Changing interval from external source:
  Use ticks (not symbol strings — RNBO doesn't support symbol messages)
  [translate] object converts note values ↔ ticks, responds to tempo changes
```

> RNBO objects with `@lock 1` maintain sync across all export targets — the host platform's transport drives them automatically.

---

## Step Sequencer — `wobbler-seq.maxpat`

Built as a Max abstraction (not RNBO) since it manages timing/scheduling:

```
[transport] → beat position → step index
[table notes 16] → MIDI note per step (C1–G2 range)
[table vels 16]  → velocity per step
[table gates 16] → on/off per step
step index → lookup → noteout → [rnbo~] via midinote messages
live.grid or live.numbox for UI
```

---

## RNBO Export Targets

All exports go via the **Cloud Compiler** (Cycling '74 manages the toolchain — no local SDKs needed).

From the RNBO Export Sidebar (`wobbler-voice.rnbo`):

| Target | Output | Category | Use |
|---|---|---|---|
| **Max External** | `.mxe64` / `.mxo` | Product | Primary M4L target — faster load, IP protection |
| **VST3 Plugin** | `.vst3` | Product | Standalone plugin, any DAW |
| **Audio Unit** | `.component` | Product | macOS AU plugin |
| **Web Export** | `.wasm` + `.js` | Code | Replaces Web Audio API implementation |
| **C++ Source** | `.cpp` / `.h` | Code | Link into JUCE plugin |
| **Raspberry Pi** | binary | Device | Embedded instrument |

**Key export settings**:
- Enable MIDI: ✓ (patch uses MIDI I/O)
- Link Polyphony to rnbo~: ✓
- Polyphony Voice Count: 8

**C++ export** is the convergence point: the same RNBO patch replaces the hand-written `src/dsp/` JUCE code, keeping web, M4L, and native VST in sync from a single source.

---

## Build Phases

### Phase 1 — Basic RNBO Voice (1–2 days)
- Install **RNBO Synth Building Blocks** package from Package Manager
- Single voice using SBB: `sbb.osc.analog` → `sbb.filter.lp` → `sbb.env.adsr` → stereo out
- `notein` → `mtof~` → frequency; velocity via `sig~` → `latch~` → `>~ 0.` → gate
- Velocity scaling: `latch~` + `/~ 127`
- Filter smoothing: `[append 40]` → `line~`
- 5 key params with `@min`/`@max`/`@unit`: `filterCutoff`, `filterQ`, `attack`, `decay`, `sustain`, `release`
- Test in Max with `rnbo~ @polyphony 8` + `midiin` → MIDI inlet

### Phase 2 — Full Oscillator Section (2–3 days)
- All 6 waveforms via `selector~`
- Supersaw 7-osc bank in `codebox~`
- Unison (up to 8) with detune + stereo spread
- Pulse width

### Phase 3 — Polyphony (1 day)
- Add `@polyphony 8` to `rnbo~`
- Connect `adsr~` → `thispoly~`
- Test voice stealing

### Phase 4 — LFOs + BPM Sync (2–3 days)
- 5 LFOs with all targets
- BPM sync via `transport`
- LFO5 meta-modulation

### Phase 5 — TWE (3–5 days, most complex)
- Main Core + Strike + Body + Tail in `codebox~`
- Sample-accurate envelopes
- startBar delay via sample counters
- Chaos/randomization

### Phase 6 — FX Chain (2 days)
- Distortion (`codebox~`)
- 3-band EQ (`biquad~`)
- Reverb + Delay in M4L wrapper

### Phase 7 — M4L UI + Presentation Mode (2–3 days)
- All `live.dial` / `live.slider` / `live.menu` objects
- `param_connect` to RNBO params
- Presentation mode layout matching web UI panel structure
- Step sequencer UI

### Phase 8 — RNBO Export (1 day)
- Export to VST3/AU via Export Sidebar
- Export to C++ for JUCE integration
- Test frozen M4L device

---

## Key Differences from Web Audio Prototype

| Feature | Web Audio | RNBO/M4L |
|---|---|---|
| Voice allocation | Manual (`WobblerVoice[]` array) | Automatic (`@polyphony 8`) |
| BPM sync | Internal `_bpm` variable | `transport` object → Live's host tempo |
| Reverb IR | `createBuffer` + `ConvolverNode` | `freeverb~` in M4L (or yafr2~) |
| Noise buffer | 4s pre-generated `AudioBuffer` | `noise~` + `codebox~` shaping (real-time) |
| Automation | Not applicable | Live clip envelopes on all `live.dial` params |
| Export | Browser only | VST3, AU, M4L, Web (same RNBO source) |
| Sequencer | Custom step sequencer in JS | Max `metro` + `transport` abstraction |
