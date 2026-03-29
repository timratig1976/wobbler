# VOICE MODULE — AUSBAUPLAN
*Stand: März 2026 · Strategie: MVP jetzt → richtige Applikation danach*

---

## STRATEGIE

**Zwei Phasen, klare Grenze:**

  MVP (HTML/JS, lokal)              →    App (Next.js, deploybar, produktionsreif)
  ─────────────────────────────────────────────────────────────────────────────────
  Klingt gut, läuft stabil               Deploybar per URL, kein File-Download
  Alle Kernfeatures spielbar             API-Key sicher im Backend
  AI-Interface über Artifact-API         Cloud-Presets, wbuilder v3 Integration
  Zeitrahmen: Wochen                     Zeitrahmen: Monate

Der MVP ist kein Wegwerfprodukt — Algorithmen werden 1:1 portiert.
Nur Architektur (globaler State, eine Datei, kein Bundler) wird neu gebaut.


### WANN WECHSELN WIR ZUR APP?

Der Wechsel kommt wenn eines dieser Dinge eintritt:

  1. "Ich will das jemandem schicken → Link öffnen → fertig."
     Jetzt: File downloaden und im Browser öffnen → nicht akzeptabel für Nutzer.

  2. "Presets sollen zwischen Sessions und Geräten sync sein."
     Jetzt: localStorage → geht verloren beim Browser-Wechsel.

  3. "Das AI-Interface soll einen echten API-Key nutzen, nicht den Artifact-Key."
     Jetzt: Anthropic Artifact API → kostenlos aber rate-limited.

  4. "wbuilder v3 soll den Synth als Komponente einbetten."
     Braucht einen deployten Service mit stabiler URL.

Bis dahin: MVP ist schneller, direkter, kein Bundler-Overhead.


### DAS AI-INTERFACE IST TEIL DES MVP

Das ist die wichtigste Erkenntnis: Das AI-Interface lässt sich im MVP bauen.

Das Artifact-System hat bereits Anthropic API-Zugang (fetch auf /v1/messages).
Kein Backend nötig. Kein API-Key-Management.

Das bedeutet: Preset System (M1) bauen → AI-Interface (M2a) direkt danach.
Das AI-Interface IST ein Killer-Feature das den MVP von einem Synth zu einem
Sound-Design-Tool macht. Es gehört in den MVP, nicht in die App.

---

## IST-ZUSTAND (MVP)

**Fertig & funktionierend:**
- 3-Spalten OSC-Layout: SUB+NOISE | OSC1 | OSC2
- Per-OSC ADSR mit drawable Canvas-Handles (OSC1, OSC2, SUB)
- Filter: 3 Spalten — Controls | Curve (live) | ADSR
- TZFM / AM Modulation zwischen OSC1 und OSC2
- Unison (1–9 Stimmen) mit Spread + Stereo Width
- LFO / Mod Sequencer mit drawable Breakpoint-Kurve
- LFO Repeat: Straight / Triplet / Dotted Rows
- LFO Targets: CUTOFF, PITCH, TREMOLO, RESO, DRIVE
- Filter Viz live (pre/post/curve, bewegt sich mit LFO)
- FX Chain: Chorus, Delay, Reverb, Compressor, Comb, Formant
- Distortion: TAPE / TUBE / HARD / FOLD
- Wavetable Editor (drawable, FFT-basiert)
- AUTOPLAY (Drone) mit Tonsequenz + Crossfade-Rebuild
- Keyboard + MIDI Input
- Noise + Noise LFO
- Oscilloscope

**Bekannte Schwächen:**
- Alles in einer Datei (~4600 Zeilen, globaler State)
- Kein Preset Save/Load
- Kein MIDI Learn
- Per-OSC ADSR Release nicht vollständig auf noteOff verdrahtet
- Kein echtes Polyphonie-Management
- LFO ist monophon und UI-Thread-getaktet (Details unten)

---

## TECHNISCHE ANALYSE: LFO-ARCHITEKTUR

### Vital vs. unser Code — der fundamentale Unterschied

Vital verarbeitet Stimmen nicht einzeln — es nutzt SIMD (poly_float): 4 Stimmen
gleichzeitig in einem CPU-Register (SSE/AVX). Ein LFO-Tick berechnet 4 Phasenwerte
in einer einzigen Instruction. 24 Stimmen = 6 SIMD-Durchläufe.

Vital intern (vereinfacht):

  poly_float phase_;   // 4 Phasen gleichzeitig — 4 verschiedene Stimmen
  poly_float freq_;    // 4 Frequenzen gleichzeitig

  // Ein Tick verarbeitet 4 Stimmen auf einmal:
  poly_float out = lfo_table.lookup(phase_);  // 4 Lookups, 1 Instruction
  phase_ += freq_;                             // 4 Additionen, 1 Instruction

Unser Code:

  let lfoPos = 0;      // EIN globaler Phasenwert für ALLE Noten
  lfoPos += lfoSpeed;  // monophon, UI-Thread, ~60Hz Granularität
  lfoGain_filt.gain.setValueAtTime(val, AC.currentTime);  // kein Sample-Timing


### Was Vital besser macht — konkret

| Feature              | Vital                        | Unser MVP             | App-Ziel         |
|----------------------|------------------------------|-----------------------|------------------|
| Granularität         | Sample-accurate (44100Hz)    | Frame-accurate (~60Hz)| AudioWorklet     |
| Per-Voice Phase      | jede Note eigene Phase       | global geteilt        | Voice Pool       |
| Phase Reset noteOn   | Trigger/Sync/Env/Loop Modes  | nicht implementiert   | Voice Pool       |
| Anzahl LFOs          | 8 polyphon                   | 1 monophon            | 3 per Voice      |
| Keytrack Rate        | Rate folgt Tonhöhe           | nicht vorhanden       | Phase 2 App      |
| Audio-Rate Mod       | LFO als OSC-Modulator        | nicht vorhanden       | Phase 2 App      |
| Voice-Stealing       | Round-Robin mit State        | nicht implementiert   | Voice Pool       |
| SIMD                 | 4 Stimmen = 1 Instruction    | JS sequential         | nicht im Browser |


### Warum das in der App anders gelöst wird

Web Audio hat kein SIMD für JS — aber das ist kein Problem, weil:

1. OscillatorNode läuft nativ im Audio-Thread. Die Node-Engine des Browsers ist
   bereits C++-optimiert. JS muss nur aus dem hot path raus.

2. AudioWorklet für LFO: sample-accurate, kein setTimeout-Drift, kein
   UI-Thread-Blocking. Das ist der entscheidende Schritt für stabile LFOs.

3. Voice Pool — alle Stimmen beim Start vorallokieren statt bei noteOn neu erstellen.
   24 prealloziierte Stimmen × (OscillatorNode + GainNode + Panner) = ~72 Nodes.
   Für moderne Browser kein Problem.


### LFO Phase-Reset — warum kritisch für DnB

In DnB bestimmt die LFO-Phase an einer Beat-Position die Wub-Charakteristik.
Wenn eine neue Note spielt und der LFO zufällig auf Position 0.75 steht (mitten im
Sweep), klingt der Sound anders als auf Position 0.0. Das macht Basslines
inkonsistent, besonders bei schnellen Riffs.

Vitals Lösung ist der Trigger-Mode: jede neue Note startet den LFO von Phase 0.
Das ist, was tight klingende Wobble-Basslines ausmacht.

---

## MVP — RESTLICHE FEATURES

*Ziel: Klingt professionell, alle Kernfeatures nutzbar. Kein Refactor.*

### M1 — Preset Save/Load  [SOFORT — Blocker]
- V-Objekt + LFO-Breakpoints + LFO-Configs → vollständiges JSON
- 8 sichtbare Slots (A1–A8), Rename, Export/Import als .json
- Reset-to-Default Button
- Das JSON-Format ist der Vertrag mit dem AI-Interface — muss vollständig sein

  Vollständiges Preset-JSON:
    {
      "name": "Neuro Wobble",
      "V": { ...alle Synth-Parameter... },
      "lfos": [
        { "points": [{x,y,hard,tension},...], "bars": 2, "mult": 1.333,
          "target": "filt", "depth": 0.65, "offset": 0.0, "mode": "normal" },
        { "points": [...], "bars": 2, "mult": 3, "target": "filt",
          "depth": 0.25, "offset": 0.5, "mode": "normal" },
        { "points": [...], "bars": 4, "mult": 1, "target": "amp",
          "depth": 0.8, "offset": 0.0, "mode": "inverse" }
      ],
      "osc1Adsr": {A, D, S, R},
      "osc2Adsr": {A, D, S, R},
      "subAdsr":  {A, D, S, R}
    }


### M2a — AI Sound Generation Interface  [DIREKT NACH M1 — Killer-Feature]

Ein Prompt-Feld im Synth. Du tippst: "neurofunk bass mit triplet wobble und
distortion, dark und aggressive". Claude antwortet mit einem vollständigen
Preset-JSON. Der Synth lädt es sofort.

Das funktioniert im MVP weil das Artifact-System Anthropic API-Zugang hat.

  System-Prompt für den AI-Call:
    Du bist ein DnB/Neurofunk Sound Designer. Antworte NUR mit einem JSON-Preset
    für einen Web Audio Synthesizer. Format: {name, V, lfos, osc1Adsr, ...}.
    Verfügbare LFO-Kurven: dnbsaw, neurozap, triplet, wubwub, breathe, ...
    Verfügbare Targets: filt, pitch, amp, res, drive.
    [vollständige Parameter-Dokumentation als Kontext]

  UI:
    Prompt-Feld (textarea, 1–2 Zeilen)
    [GENERATE] Button → API Call → JSON parsen → Preset laden → Synth spielt
    [SAVE] Button → in Preset-Slot speichern
    Loading-Indikator während AI antwortet

  Iteration:
    "Mach es aggressiver" → lädt aktuelles Preset als Kontext → regeneriert
    "Mehr Sub-Bassline" → modifiziert spezifische V-Parameter
    "Probiere 3 Varianten" → 3 JSON-Objekte → 3 temporäre Slots

  Warum das MVP und nicht App:
    Im Artifact hat Claude API-Zugang ohne Backend.
    In der App bräuchte man Route Handlers um den Key zu schützen.
    Das ist mehr Aufwand für dieselbe Funktionalität.
    MVP-Vorteil nutzen bevor wir auf Next.js wechseln.

### M2 — ADSR Release Fix  [SOFORT — Mini-Bug]
- noteOff muss osc1Envs, osc2Envs, subEnv pro Note releasen
- Aktuell: nur ampEnv released, per-OSC Gains bleiben auf Sustain offen
- Fix: Release mit V.osc1AmpR etc. auf envGain.gain schedulen

### M3 — LFO Phase Reset bei noteOn  [SOFORT — klanglich kritisch]
- lfoPos = 0 bei noteOn wenn Trigger-Mode aktiv
- Toggle: TRIGGER (reset bei jeder Note) / FREE (läuft durch)
- Default für DnB: TRIGGER
- Kleiner Eingriff, massiver klanglicher Unterschied

### M4 — Polyphonie 4–8 Stimmen  [bald]
- activeNotes von {freq: note} zu Voice-Array
- Voice-Stealing: erst Stimmen in Release-Phase, dann älteste
- Round-Robin als Fallback
- Nicht 24 Stimmen — das kommt in der App via Voice Pool

### M5 — MIDI Learn  [bald]
- Rechtsklick auf Slider/Button → "MIDI Learn"-Overlay
- Nächste CC-Nachricht → Parameter gebunden
- Bindings in localStorage persistieren

### M6 — 3 LFOs (noch monophon)  [mittelfristig]
- LFO1 (existiert), LFO2, LFO3 — jeder mit eigenem Target
- Jeder LFO: eigene drawable Kurve, Bars, Repeat, Depth
- UI: Tab-System (LFO 1 / 2 / 3) um Platz zu sparen
- Per-Voice LFO-Phase kommt erst in der App

### M7 — Modulation Matrix (vereinfacht)  [mittelfristig]
- 6 Slots: Source → Target → Depth
- Sources: LFO1/2/3, Velocity, Key
- Targets: Cutoff, Pitch, Volume, Drive, Reso, Detune
- Tabellarisches UI, kein Drag&Drop

### M8 — Macro Controls  [mittelfristig]
- 4 Knöpfe A–D, je ein Slider
- Jeder Macro steuert bis zu 4 Parameter gleichzeitig (via Mod Matrix)
- MIDI-assignable

### M9 — Preset Library  [mittelfristig]
- 20+ handgemachte Presets: NEURO / LIQUID / REESE / STAB
- Geladen über Preset-Selector, als .json nicht als hardcoded V-Objekte

---

## APP — ARCHITEKTUR (nach MVP)

*Sauberer Neuaufbau in Next.js + TypeScript. Algorithmen aus MVP portiert.*

### Technologie-Stack
- Next.js 15 (App Router)
- TypeScript
- Web Audio API + AudioWorklet
- Tailwind CSS
- Zustand (State Management)

### Audio-Architektur: Voice Pool + AudioWorklet LFO

Alle Stimmen beim Start anlegen, nicht bei noteOn:

  class VoicePool {
    voices: Voice[]          // 24 prealloziierte Stimmen
    active: Map<number, Voice>
    free: Voice[]

    noteOn(freq, vel) {
      const v = this.free.pop() ?? this.steal()
      v.noteOn(freq, vel)    // kein Node-Create, nur Parameter setzen
    }

    steal(): Voice {
      // 1. Stimme in Release-Phase → sofort nehmen
      // 2. Älteste aktive Stimme → fade-steal (10ms crossfade)
    }
  }

LFO als AudioWorkletProcessor — läuft im Audio-Thread:

  class LFOWorklet extends AudioWorkletProcessor {
    process(inputs, outputs, params) {
      const out = outputs[0][0]
      for (let i = 0; i < out.length; i++) {
        this.phase += this.phaseIncrement   // sample-accurate, kein setTimeout
        if (this.phase >= 1) this.phase -= 1
        out[i] = this.table[Math.floor(this.phase * TABLE_SIZE)]
      }
      return true
    }
  }
  // Output direkt als AudioNode connecten:
  lfoWorklet.connect(filterNode.frequency)  // kein JS im hot path mehr

Per-Voice LFO Phase:

  class Voice {
    lfoPhase: number = 0    // eigener Phase-State pro Stimme

    noteOn(freq, vel) {
      this.lfoPhase = 0     // Trigger-Mode: Phase Reset
      this.osc1.frequency.setValueAtTime(freq, AC.currentTime)
    }
  }


### State Management (Zustand)

  const useSynthStore = create((set) => ({
    osc: { wave1: 'sawtooth', osc1Voices: 1, ... },
    filter: { cutoff: 600, res: 5, type: 'lowpass', ... },
    lfo: [
      { points: [...], bars: 2, mult: 1.333, target: 'filt',  depth: 0.7 },
      { points: [...], bars: 4, mult: 1,     target: 'pitch', depth: 0.3 },
      { points: [...], bars: 1, mult: 6,     target: 'none',  depth: 0   },
    ],
    fx: { chorus: {...}, delay: {...}, reverb: {...} },

    setParam: (path, value) => {
      set(state => deepSet(state, path, value))
      audioEngine.applyParam(path, value)   // direkt an Audio Engine
    }
  }))


### Dateistruktur App

  bass-synth/
    src/
      engine/
        AudioEngine.ts          -- Web Audio context, node graph
        VoicePool.ts            -- 24 prealloziierte Stimmen, voice stealing
        OscChain.ts             -- buildOscChain, TZFM routing
        FilterChain.ts          -- filter + LFO + ADSR
        FXChain.ts              -- chorus/delay/reverb/comp
        worklets/
          LFOWorklet.ts         -- AudioWorklet, sample-accurate
          EnvelopeWorklet.ts    -- AudioWorklet, sample-accurate

      components/
        panels/
          OscPanel.tsx          -- SUB+NOISE | OSC1 | OSC2
          FilterPanel.tsx       -- Controls | Viz | ADSR
          LFOPanel.tsx          -- 3x LFO, drawable Kurven
          FXPanel.tsx
          ModMatrix.tsx         -- Modulation Matrix
          MacroPanel.tsx
        viz/
          Oscilloscope.tsx      -- rAF + Canvas
          Spectrogram.tsx       -- rAF + Canvas
          FilterResponse.tsx    -- live Frequenzkurve
          LFOCanvas.tsx         -- drawable Breakpoint-Editor
          ADSRCanvas.tsx        -- drawable ADSR-Editor

      store/
        synthStore.ts           -- Zustand store
        presetManager.ts        -- Load/Save/Export/Import

      app/
        page.tsx                -- Haupt-UI
        api/                    -- Preset-Sharing falls gewünscht


### wbuilder v3 Integration

  // Als Web Component:
  <bass-synth
    preset="neuro-wobble"
    bpm={174}
    onParamChange={(path, value) => handleMIDIOut(path, value)}
  />

  // PostMessage API für externe Steuerung aus wbuilder:
  window.addEventListener('message', (e) => {
    if (e.data.type === 'SET_PARAM') {
      synthStore.setParam(e.data.path, e.data.value)
    }
  })

---

## PRIORITÄTEN — GESAMTÜBERSICHT

### MVP (jetzt, diese Datei)

| #   | Feature                  | Aufwand | Warum                                       |
|-----|--------------------------|---------|---------------------------------------------|
| M1  | Preset Save/Load (JSON)  | Klein   | Blocker + Basis für AI-Interface            |
| M2  | ADSR Release Fix         | Mini    | Sound stimmt nicht ohne                     |
| M3  | LFO Phase Reset          | Mini    | DnB-Konsistenz, klanglich kritisch          |
| M2a | AI Sound Generation      | Mittel  | Killer-Feature, geht im Artifact ohne Backend |
| M4  | 3 parallele LFOs         | Mittel  | Call & Response, Sound Design Tiefe         |
| M5  | Polyphonie 4–8 Stimmen   | Mittel  | Spielbarkeit                                |
| M6  | MIDI Learn               | Mittel  | Live-Nutzung                                |
| M7  | Mod Matrix (einfach)     | Mittel  | Sound Design Tiefe                          |
| M8  | Macro Controls           | Klein   | Live-Performance                            |
| M9  | Preset Library 20+       | Klein   | Trainingsdaten für AI-Prompting             |

### App (danach, Neuaufbau)

| #   | Feature                  | Aufwand    | Warum                              |
|-----|--------------------------|------------|------------------------------------|
| A1  | Voice Pool 24 Stimmen    | Groß       | Stabilität, Performance            |
| A2  | AudioWorklet LFO         | Mittel     | Sample-accurate, kein Drift        |
| A3  | Per-Voice LFO Phase      | Mittel     | DnB Konsistenz polyphon            |
| A4  | Full Modulation Matrix   | Groß       | Sound Design Tiefe wie Vital       |
| A5  | Spectrogram              | Mittel     | Visualisierung                     |
| A6  | ADSR Live-Playhead       | Mittel     | Visualisierung                     |
| A7  | Dual Filter              | Mittel     | Sound Design                       |
| A8  | Step Sequencer           | Groß       | Bassline-Programmierung            |
| A9  | wbuilder Integration     | Mittel     | Deployment in wbuilder v3          |
| A10 | Preset Sharing / Cloud   | Groß       | Community, spätere Phase           |

---

## NÄCHSTE SESSION

MVP: M1 + M2 + M3 — Preset Save/Load, ADSR Release Fix, LFO Phase Reset.
Alle drei zusammen sind ~2 Stunden Arbeit, sofort spürbarer Qualitätssprung.

---

## KURVEN-BIBLIOTHEK — SYSTEMATIK

*Das Herzstück des Synths. Gute Kurven = guter Sound.*

---

### WIE KURVEN FUNKTIONIEREN (unser System)

Jede Kurve = Array von Breakpoints: { x: 0..1, y: 0..1, hard: bool, tension: -1..+1 }

  tension =  0   → linear
  tension =  1   → ease-out (konvex — schnell am Anfang, langsam am Ende)
  tension = -1   → ease-in  (konkav — langsam am Anfang, schnell am Ende)
  hard    = true → Sprung (keine Interpolation, sofortiger Wechsel)

Die Kurve wird in 512 Punkte (LFO_POINTS) gerendert und dann bei jedem Tick
per Index-Lookup abgerufen. Kein Rechenaufwand im hot path.

---

### IST-ZUSTAND (60 Presets)

Kategorien vorhanden:
- CLASSIC WAVEFORMS: sine, rise, fall, sawup, sawdn, square, bounce
- SHAPES: sawsoft, shark, asym, asyminv, doublepeak, doublea, expup, expdown
- STEPS: stair4, stair4dn, stairirr
- DnB: dnbsaw, dnbpump, dnbacid
- NEURO: neurozap, neuroglitch, ratchet
- LIQUID: halftime, halfswell, halfpump, liquid, breathe, flow, roll
- FILTER: pluck, duck, softduck, gate, wah, filtopen, filtpump, gate8, vinyl
- VOL/TIME: stutter, tremolo, revswell
- SUB WOBBLE: subpulse, subswell, substair, subnero, subbreath, subcrawl, subzap, subpump, subdrop
- MISC: fastsaw, step4, rubber, acid, neuro, triplet, wubwub, randomize

---

### ERWEITERUNG — KURVEN DIE NOCH FEHLEN

#### KATEGORIE: WOBBLE CLASSICS (Cutoff-Modulation)

Diese Kurven sind alle für Target=CUTOFF gedacht. Das ist der wichtigste Target
für DnB. Jede Kurve klingt anders je nach Bars (2/4/8) und Repeat-Multiplikator.

  reese_open    Langsam von unten nach oben — Reese-Bass der sich öffnet.
                mk(0,0,false,-1), mk(.7,.3,false,-1), mk(1,1)

  reese_pulse   Kurzer Öffnungs-Puls, dann schnell zu. Tight Reese.
                mk(0,0,true), mk(.05,1,true), mk(.15,0,true), mk(1,0,true)

  halfstep_dn   Zwei ungleiche Stufen fallend — klassische DnB Bassline-Bewegung.
                mk(0,1,true), mk(.5,1,true), mk(.5,.4,true), mk(1,.4,true)

  halfstep_up   Zwei ungleiche Stufen steigend.
                mk(0,.3,true), mk(.5,.3,true), mk(.5,1,true), mk(1,1,true)

  wub3          Drei gleichmäßige Wub-Bumps, smooth.
                mk(0,0), mk(.17,1,false,1), mk(.33,0), mk(.5,1,false,1),
                mk(.67,0), mk(.83,1,false,1), mk(1,0)

  wub4          Vier gleichmäßige Wub-Bumps — für schnelle Beats.
                mk(0,0), mk(.125,1,false,1), mk(.25,0), mk(.375,1,false,1),
                mk(.5,0), mk(.625,1,false,1), mk(.75,0), mk(.875,1,false,1), mk(1,0)

  vowel_ah_eh   Öffnet auf "ah", hält, schließt, öffnet wieder auf "eh".
                mk(0,.2,false,-1), mk(.2,.9,false,1), mk(.4,.9,true),
                mk(.4,.1,false,-1), mk(.6,.6,false,1), mk(.8,.6,true), mk(1,.2)

  gate_16th     16 gleichmäßige Gates (für Tremolo-Target). Step-Sequencer-Feeling.
                [16 Paare aus mk(x,1,true) mk(x+.03,0,true)]

  sidechain     Klassischer Sidechain-Kompressor Effekt — sofort auf 0, langsam hoch.
                mk(0,0,true), mk(0,0,false,-1), mk(.35,.7,false,-1), mk(.7,.95,false,-1), mk(1,1)

  breathe_fast  Wie breathe aber doppelt so schnell — Hyperventilations-Bassline.
                mk(0,0,false,-1), mk(.3,1,false,1), mk(.7,.3,false,1), mk(1,0,false,-1)


#### KATEGORIE: NEURO & ZERSTÖRUNG (Cutoff + Drive)

  needle        Extrem kurzer Spike. Nur für hohe Repeat-Multiplikatoren (×8 ×16).
                mk(0,0,true), mk(0,0,true), mk(.04,1,true), mk(.06,0,true), mk(1,0,true)

  glitch_burst  3–4 unregelmäßige harte Spikes.
                mk(0,0,true), mk(.07,1,true), mk(.09,0,true),
                mk(.35,.7,true), mk(.37,0,true), mk(.6,1,true), mk(.62,0,true), mk(1,0,true)

  chaos4        4 zufällige Stufen, hart. Klingt engineered-chaotisch.
                mk(0,.3,true), mk(.25,.3,true), mk(.25,.8,true), mk(.4,.8,true),
                mk(.4,.1,true), mk(.65,.1,true), mk(.65,.6,true), mk(1,.6,true)

  fm_sweep      FM-artiger Sweep — beginnt tief, öffnet in der Mitte massiv, bricht zusammen.
                mk(0,.05,false,-1), mk(.3,.1,false,-1), mk(.5,1,false,-1),
                mk(.6,.9,false,1), mk(.75,.2,false,1), mk(1,0,false,1)

  reese_growl   Langsam öffnendes, unregelmäßiges Wachsen. Reese-Growl-Charakter.
                mk(0,.1,false,-1), mk(.2,.15,false,-1), mk(.4,.4,false,-1),
                mk(.55,.35,false,1), mk(.7,.65,false,-1), mk(.85,.55,false,1), mk(1,.9)

  neuro_kick    Startet oben, fällt wie ein Kick — kurze Energie, dann nichts.
                mk(0,1,true), mk(0,1,false,1), mk(.08,.5,false,1),
                mk(.2,.1,false,1), mk(.5,.02,false,1), mk(1,0)

  laserup       Schneller linearer Aufstieg in der zweiten Hälfte — Laser-Sound.
                mk(0,0,true), mk(.5,0,true), mk(.5,0,false,-1), mk(1,1)

  laserpulse    Mehrere schnell aufsteigende Laserartige Sweeps.
                mk(0,0,true), mk(0,0,false,-1), mk(.25,1,true),
                mk(.25,0,true), mk(.25,0,false,-1), mk(.5,1,true),
                mk(.5,0,true), mk(.5,0,false,-1), mk(.75,1,true), mk(.75,0,true)


#### KATEGORIE: LIQUID / ORGANISCH (weiche Filter-Bewegungen)

  tide          Sehr langsames Kommen und Gehen — für lange LFO-Zyklen (8–16 Bars).
                mk(0,.1,false,-1), mk(.3,.05,false,-1), mk(.5,.9,false,-1),
                mk(.7,.95,false,1), mk(1,.1,false,1)

  swell_in      Baut sehr langsam auf, bricht am Ende schnell zusammen.
                mk(0,0,false,-1), mk(.8,.9,false,1), mk(.9,1,false,1), mk(1,0,true)

  wander        Unregelmäßige, organische Wanderbewegung — nie vorhersehbar.
                mk(0,.4,false,-1), mk(.15,.6,false,1), mk(.3,.3,false,-1),
                mk(.5,.7,false,1), mk(.65,.4,false,-1), mk(.85,.8,false,1), mk(1,.5)

  melisma       Gesangsartiges Auf und Ab — leichte Wellenform für Pitch-Modulation.
                mk(0,.4), mk(.12,.6,false,1), mk(.25,.4,false,-1), mk(.4,.55,false,1),
                mk(.55,.35,false,-1), mk(.7,.5,false,1), mk(.85,.45,false,-1), mk(1,.4)

  inhale        Kurzes schnelles Einatmen am Anfang, dann langer Atem.
                mk(0,0,true), mk(0,0,false,-1), mk(.1,.8,false,1),
                mk(.3,.5,false,-1), mk(.7,.7,false,1), mk(1,.3)


#### KATEGORIE: RHYTHMISCH / SEQUENCER-ARTIG (Steps)

  gallop        Triolen-Feeling — 3 ungleiche Impulse wie ein galopierendes Pferd.
                mk(0,1,true), mk(.08,0,true), mk(.33,1,true), mk(.41,0,true),
                mk(.66,1,true), mk(.75,0,true), mk(1,0,true)

  shuffle       Shuffle-Feeling — erste Note länger, zweite kürzer.
                mk(0,1,true), mk(.65,1,true), mk(.65,0,true),
                mk(.75,1,true), mk(1,1,true)

  clave_32      Clave 3-2 Rhythmus als LFO-Form.
                mk(0,1,true), mk(.08,0,true), mk(.25,1,true), mk(.33,0,true),
                mk(.5,1,true), mk(.58,0,true), mk(.625,1,true), mk(.75,0,true),
                mk(.875,1,true), mk(1,0,true)

  binary        Binäres Muster — 0110 1001 — Computerrhythmus.
                mk(0,0,true), mk(.125,1,true), mk(.25,1,true), mk(.375,0,true),
                mk(.5,1,true), mk(.625,0,true), mk(.75,0,true), mk(.875,1,true), mk(1,0,true)

  euclidean_53  Euklid 5 über 3 — polyrhythmisches Muster.
                mk(0,1,true), mk(.067,0,true), mk(.2,1,true), mk(.267,0,true),
                mk(.4,1,true), mk(.467,0,true), mk(.6,1,true), mk(.667,0,true),
                mk(.8,1,true), mk(.867,0,true), mk(1,0,true)


#### KATEGORIE: SPEZIAL / EXOTISCH

  heartbeat     EKG-artiger Herzschlag. Zwei Spikes, dann Pause.
                mk(0,0,true), mk(.02,.7,false,1), mk(.04,0,true),
                mk(.07,.4,false,1), mk(.1,0,true), mk(1,0,true)

  spring        Federartiges Oszillieren — dämpft aus.
                mk(0,0,true), mk(0,0,false,-1), mk(.05,1,false,1), mk(.1,.2,false,-1),
                mk(.15,.8,false,1), mk(.2,.3,false,-1), mk(.25,.65,false,1),
                mk(.3,.4,false,-1), mk(.35,.55,false,1), mk(.4,.45), mk(.5,.5,false,-1), mk(1,.5)

  typewriter    Unregelmäßige kurze Impulse auf unterschiedlichen Höhen.
                mk(0,0,true), mk(.1,.6,true), mk(.11,0,true), mk(.25,.3,true),
                mk(.26,0,true), mk(.4,.8,true), mk(.41,0,true),
                mk(.6,.5,true), mk(.61,0,true), mk(.8,.9,true), mk(.81,0,true), mk(1,0,true)

  pendulum      Gleichmäßiges Pendeln mit physikalischer Kurve (etwas langsamer an den Enden).
                mk(0,0,false,1), mk(.5,1,false,-1), mk(1,0,false,1)

---

### SYSTEMATIK — SO WERDEN KURVEN ZU KLANG

Dieselbe Kurve klingt völlig anders je nach:

  Target        Cutoff = Filter-Wobble · Pitch = Vibrato/Glide · 
                Tremolo = Volumen · Drive = Verzerrungsrhythmus

  Bars          2 Bars = Grundrhythmus · 4 Bars = halftime-feel · 
                8 Bars = atmosphärisch · 0.5 Bars = sehr tight

  ×Repeat       ×1 = eine Kurve pro Bars · ×4 = vier Wiederholungen pro Bars
                ×2D = dotted, "hinkt" leicht

  Depth         Niedrig (0.2–0.4) = subtil, Cutoff bewegt sich kaum
                Mittel (0.5–0.7)  = klassischer Wobble
                Hoch  (0.8–1.0)   = extremer Sweep, sehr aggressiv

  Cutoff-Center Tief (200–400Hz)  = dunkler Mud-Wobble
                Mitte (600–900Hz) = klassisch DnB
                Hoch (1k–2kHz)    = heller, agressiver


### KOMBINATIONEN FÜR KONKRETE SOUNDS

  Classic DnB Wobble
    Kurve: dnbsaw · Target: CUTOFF · Bars: 2 · ×Repeat: ×2 · Depth: 0.65
    Cutoff: 700Hz · Reso: 8

  Neurofunk Zap
    Kurve: neurozap · Target: CUTOFF · Bars: 1 · ×Repeat: ×4T · Depth: 0.85
    Cutoff: 500Hz · Reso: 14 · Drive: FOLD

  Liquid Breathe
    Kurve: breathe · Target: CUTOFF · Bars: 4 · ×Repeat: ×1 · Depth: 0.45
    Cutoff: 1200Hz · Reso: 3

  Reese Growl
    Kurve: reese_growl · Target: CUTOFF · Bars: 4 · ×Repeat: ×2D · Depth: 0.6
    Cutoff: 350Hz · Reso: 6 · OSC2 detune: 7ct

  Halftime Sidechain
    Kurve: sidechain · Target: TREMOLO · Bars: 4 · ×Repeat: ×1 · Depth: 0.9
    Gleichzeitig: dnbsaw auf CUTOFF · Bars: 2 · ×Repeat: ×4

  Step Bassline
    Kurve: stairirr · Target: CUTOFF · Bars: 2 · ×Repeat: ×1 · Depth: 0.7
    Zusätzlich: chaos4 auf PITCH · Bars: 2 · ×Repeat: ×1 · Depth: 0.1


### KURVEN-ERSTELLUNG — BEST PRACTICES

1. Beginne immer bei y=0 oder y=1 (klarer Start, kein undefinieter Einstieg)

2. Hard-Steps nur wenn wirklich ein Sprung gewünscht ist. Für DnB oft ja,
   für Liquid fast nie.

3. Tension nutzen statt mehr Punkte:
   Statt 5 Punkte für eine Kurve: 2 Punkte mit tension=1 und tension=-1

4. Asymmetrie macht Kurven lebendig:
   Attack-Zeit != Release-Zeit = organischer
   Ungleiche Stufen-Höhen = menschlicher

5. Die Sweep-Richtung entscheidet den Charakter:
   Oben → Unten = Energie verlieren, entspannend
   Unten → Oben = Energie aufbauen, treibend
   Mitte → Oben → Mitte = schwebend (Sinus-Charakter)

6. Für Neuro: harte Übergänge + unregelmäßige x-Positionen (nicht .25/.5/.75)
   Für Liquid: weiche tension-Werte, keine hard=true

7. Teste immer mit verschiedenen Repeat-Multiplikatoren — ×4T mit einer
   smooth Kurve klingt oft interessanter als eine speziell konstruierte Kurve

---

## CALL & RESPONSE — LFO PARALLELARCHITEKTUR

*Inspiriert durch den Step-Sequencer-Ansatz: mehrere unabhängige Stimmen
die miteinander kommunizieren statt eine monophone Modulation.*

---

### DAS KONZEPT

Im Step Sequencer haben wir Call & Response so gebaut:
- Stimme A spielt einen Riff → Stimme B antwortet zeitversetzt
- Stimmen wissen voneinander, können auf den Zustand der anderen reagieren

**Dasselbe Prinzip auf LFOs übertragen:**

  Statt: 1 LFO → 1 Target
  Ziel:  3–4 LFO-Instanzen laufen parallel, in musikalischer Beziehung zueinander

Jede LFO-Instanz hat:
- Eigene Kurve
- Eigenen Target (CUTOFF / PITCH / TREMOLO / OSC1 Vol / OSC2 Detune / ...)
- Eigene Phase, eigene Bars, eigene Repeat-Multiplikation
- Eine ROLE: CALL, RESPONSE, oder COUNTER

---

### DIE DREI ROLLEN

  CALL (Leader)
    Führt die Modulation an. Gibt den rhythmischen Impuls vor.
    Beispiel: dnbsaw auf CUTOFF, 2 Bars, ×2 — das ist der Hauptwobble.

  RESPONSE (Follower)
    Reagiert auf den CALL mit einem zeitversetzten Kommentar.
    Beispiel: triplet auf CUTOFF, 2 Bars, ×3T — setzt 1/3-Beat später ein,
    läuft über den CALL drüber. Ergibt polyrhythmische Filter-Bewegung.

  COUNTER (Gegenmodell)
    Läuft gegen den CALL — macht das Gegenteil, oder moduliert einen anderen
    Parameter in entgegengesetzter Richtung.
    Beispiel: wenn CALL Cutoff öffnet, macht COUNTER Pitch tiefer.
    Ergibt das klassische DnB-Gefühl von "Spannung durch Gegenläufigkeit".

---

### TIMING-MODI

  FREE      Alle LFOs starten gleichzeitig, gleiche Phase.
            Ergebnis: additive Modulation, klingt wie ein komplexerer LFO.

  OFFSET    LFO 2 startet X Schläge nach LFO 1 (konfigurierbar: 0.5 / 1 / 1.5 Bars).
            Das ist echter Call & Response — LFO 1 ruft, LFO 2 antwortet.

  INVERSE   LFO 2 hat Phase = LFO 1 + 0.5 (genau gegenläufig).
            Wenn LFO 1 oben ist, ist LFO 2 unten.
            Für Stereo: LFO 1 → linker Kanal, LFO 2 → rechter Kanal.

  DIVIDE    LFO 2 läuft halb so schnell wie LFO 1 (oder doppelt so schnell).
            Ergibt polyrhythmische Schichtung — 2:1, 3:2, 4:3 Verhältnisse.

  TRIGGER   LFO 2 startet neu (Phase 0) jedes Mal wenn LFO 1 einen Threshold
            überschreitet (z.B. bei y > 0.8). LFO 1 triggert LFO 2.


---

### KONKRETE KOMBINATIONEN

#### Wobble + Gegenrhythmus (klassisch DnB)

  LFO 1 (CALL)      dnbsaw    → CUTOFF      Bars:2   ×2     Depth:0.65
  LFO 2 (RESPONSE)  triplet   → CUTOFF      Bars:2   ×3T    Depth:0.25
  LFO 3 (COUNTER)   sidechain → TREMOLO     Bars:4   ×1     Depth:0.8

  LFO 2 läuft im Triolen-Offset über LFO 1.
  LFO 3 pumpt das Volumen sidechain-artig gegen den Hauptrhythmus.
  → Ergebnis: klassischer DnB-Sound mit echter Tiefe statt flachem Wobble.

#### Neuro Chaos + Stabiler Boden

  LFO 1 (CALL)      neurozap  → CUTOFF      Bars:1   ×4T    Depth:0.9
  LFO 2 (RESPONSE)  shark     → DRIVE       Bars:2   ×2     Depth:0.6
  LFO 3 (COUNTER)   expdown   → OSC2 Vol    Bars:2   ×1     Depth:0.7
  Timing: LFO 2 = OFFSET +0.5 Bars, LFO 3 = INVERSE

  LFO 1 zerschneidet den Filter.
  LFO 2 treibt den Distortion-Charakter in einem langsameren Rhythmus.
  LFO 3 blendet OSC2 gegenläufig — wenn LFO 1 voll auf ist, ist OSC2 leiser.
  → Ergebnis: Neurofunk mit Struktur trotz Chaos.

#### Liquid Stereo-Wobble

  LFO 1 (CALL)      breathe   → CUTOFF (L)  Bars:4   ×1D    Depth:0.5
  LFO 2 (RESPONSE)  breathe   → CUTOFF (R)  Bars:4   ×1D    Depth:0.5
  LFO 3 (COUNTER)   wander    → OSC1 Det    Bars:8   ×1     Depth:0.2
  Timing: LFO 2 = INVERSE (Phase +0.5)

  LFO 1 und 2 sind dieselbe Kurve aber gegenläufig in Phase.
  Links atmet ein, rechts atmet aus. Echter Stereo-Wobble.
  LFO 3 moduliert Detune sehr langsam für subtiles Pitch-Wandern.
  → Ergebnis: breiter, lebendiger Liquid-Sound.

#### Halftime Call & Response (Frage-Antwort)

  LFO 1 (CALL)      pluck     → CUTOFF      Bars:2   ×1     Depth:0.75
  LFO 2 (RESPONSE)  subdrop   → CUTOFF      Bars:2   ×1     Depth:0.6
  Timing: LFO 2 = OFFSET +1 Bar

  LFO 1 macht einen scharfen Pluck auf Bar 1.
  LFO 2 antwortet auf Bar 2 mit einem langen fallenden Sweep.
  → Klassisches musikalisches Frage-Antwort-Prinzip als LFO.

#### Polyrhythmischer Breakdown

  LFO 1 (CALL)      dnbsaw    → CUTOFF      Bars:3   ×1     Depth:0.7
  LFO 2 (COUNTER)   stairirr  → PITCH       Bars:4   ×1     Depth:0.15
  LFO 3 (COUNTER)   gate8     → TREMOLO     Bars:2   ×1     Depth:0.9

  3 gegeneinander laufende Bar-Längen (3:4:2 Verhältnis).
  Alle resynchronisieren sich nach 12 Bars (kgV von 3,4,2).
  → Polyrhythmische Komplexität, die sich periodisch auflöst.


---

### IMPLEMENTIERUNG — MVP (monophone LFOs, synchronisiert)

Im MVP können wir 3 LFOs implementieren ohne per-Voice-Phase.
Call & Response funktioniert hier durch Phasen-Offset im globalen lfoPos:

  // Drei parallele LFO-Instanzen
  const LFOS = [
    { pos: 0, points: [...], bars: 2, mult: 2,     target: 'filt',   depth: 0.65, role: 'call' },
    { pos: 0, points: [...], bars: 2, mult: 3,     target: 'filt',   depth: 0.25, role: 'response', offset: 0.5 },
    { pos: 0, points: [...], bars: 4, mult: 1,     target: 'amp',    depth: 0.8,  role: 'counter',  mode: 'inverse' },
  ];

  function tickAllLFOs() {
    const t = AC.currentTime;
    LFOS.forEach((lfo, i) => {
      const barDur = 60 / V.bpm * 4;
      const cycleDur = lfo.bars * barDur;
      const advance = 16 / 1000 / cycleDur;  // 16ms tick

      // Phase offset für Call & Response
      let phase = lfo.pos;
      if (lfo.mode === 'inverse') phase = (phase + 0.5) % 1;

      lfo.pos = (lfo.pos + advance) % 1;

      const scaledPos = (phase * lfo.mult) % 1;
      const val = sampleLFO(lfo.points, scaledPos);

      applyLFOValue(lfo.target, val, lfo.depth);
    });
    drawAllLFOPlayheads();
  }


---

### IMPLEMENTIERUNG — APP (per-Voice, AudioWorklet)

In der App läuft jede LFO-Instanz als eigener AudioWorkletProcessor.
Jede Stimme hat eigene Phase-States für alle 3 LFOs.

  class MultiLFOWorklet extends AudioWorkletProcessor {
    // 3 LFOs × 24 Stimmen = 72 parallele Phase-Werte
    // SIMD würde hier helfen — aber auch sequentiell machbar
    phases = new Float32Array(72);

    process(inputs, outputs, params) {
      // LFO 1: output[0] → filt.frequency
      // LFO 2: output[1] → filt.frequency (addiert)
      // LFO 3: output[2] → tremolo.gain
      // Alle gleichzeitig, sample-accurate, kein UI-Thread
    }
  }

  // Offset wird als Phase-Verschiebung bei noteOn gesetzt:
  voice.noteOn(freq, vel) {
    voice.lfoPhases[0] = 0;                    // CALL: startet bei 0
    voice.lfoPhases[1] = lfo2Config.offset;    // RESPONSE: startet bei 0.5
    voice.lfoPhases[2] = lfo3Config.offset;    // COUNTER: startet bei 0.5
  }


---

### UI-KONZEPT FÜR 3 LFOs

Nicht 3 separate LFO-Panels (zu viel Platz) — sondern:

  [ LFO 1 CALL ] [ LFO 2 RESPONSE ] [ LFO 3 COUNTER ]   ← Tab-Auswahl

  Aktiver Tab zeigt die drawable Kurve + Bars + Repeat.

  Darunter eine SYNC-Sektion die für alle 3 gilt:

  SYNC MODE:  [ FREE ] [ OFFSET ] [ INVERSE ] [ DIVIDE ] [ TRIGGER ]
  LFO 2 Offset: [ 0 ] [ 0.5 ] [ 1 ] [ 1.5 ]  Bars
  LFO 3 Offset: [ 0 ] [ 0.5 ] [ 1 ] [ 2   ]  Bars

  LFO ROLES:
  LFO 1 → TARGET: CUTOFF   DEPTH: [═══════] 65%
  LFO 2 → TARGET: CUTOFF   DEPTH: [═══] 25%
  LFO 3 → TARGET: TREMOLO  DEPTH: [════════] 80%

  One-Click PRESETS:
  [ WOBBLE+COUNTER ] [ NEURO CHAOS ] [ LIQUID STEREO ] [ POLYRHYTHM ]
  Jeder Preset lädt alle 3 LFOs gleichzeitig mit passenden Kurven + Sync.


---

## OSC ENGINE — VOICE MODULE ERSETZT WOBBLER OSC

### Das Problem

Der Wobbler Web Prototype klingt flach weil:

  _mainOsc:      1 OscillatorNode, direkt auf Distortion
  _unisonExtraOscs: 7 fest auf Sawtooth, Spread = ±10.5ct hard-coded
  _ssOscBank:    Supersaw 7 Oscs, kein Sub, kein OSC2
  Kein OSC2, kein Sub, kein TZFM, kein per-OSC ADSR

Unser Voice Module klingt besser durch:
  OSC1 + OSC2 völlig unabhängig (Wave, Oct, Semi, Det, Vol, ADSR)
  Sub OSC mit eigenem Octave-Schalter (-2/-1/0)
  TZFM: OSC1 → OSC2.frequency × depth × carrierFreq (pitch-invariant)
  Per-OSC Unison: 1–9 Stimmen mit echtem StereoPannerNode-Spread
  Per-OSC ADSR mit drawable Breakpoint-Kurven
  Wavetable (custom, drawable, FFT-basiert)
  Noise Generator (white/pink, mit THRU FILT / BYPASS)


### Entscheidung: buildOscChain aus Voice Module wird die OSC-Engine

Die WobblerVoice-DSP-Chain bleibt (Filter, Distortion, EQ, Reverb, Delay).
Aber der OSC-Block wird komplett durch buildOscChain ersetzt:

  Wobbler vorher:
    _mainOsc → _distPre → filter → envGain → output

  Wobbler nachher (mit Voice Module OSC Engine):
    buildOscChain(freq, t, ampEnv)
      → OSC1 (1–9 Stimmen, Unison, ADSR)
      → OSC2 (1–9 Stimmen, Unison, ADSR, TZFM von OSC1)
      → Sub OSC (mono, eigene ADSR)
      → Noise (white/pink, thru filter oder bypass)
    → ampEnv → [Wobbler DSP Chain: Dist → Filter → EQ → FX] → output

Das ist das Beste aus beiden Welten:
  Klangqualität von unserem Voice Module
  Architektur (persistent Nodes, Voice Pool) vom Wobbler
  LFO (Breakpoint-Kurven, 5 Slots, Call & Response) von unserem System
  Sequencer, Analyzer, AI-Interface als neue Schicht


### Konkrete Migration in dsp.js

  // ENTFERNEN aus WobblerVoice constructor:
  this._mainOsc, this._mainOscG, this._mainUniPanner
  this._pulseOsc, this._pulseOscG
  this._ssOscBank, this._ssG
  this._unisonExtraOscs
  this.tweMain, this.tweBody, this.tweStrikeOsc, this.tweTailOsc
  this._tweAuxOscs

  // HINZUFÜGEN:
  // buildOscChain() aus voice-module-final.html (portiert als Methode)
  // osc1Envs[], osc2Envs[], subEnvGain — per-note im activeNotes tracking
  // tickAllLFOs() statt _tickTWE()
  // lfoBreakpoints[5][512] statt p.lfos[].waveform


### Was bleibt vom Wobbler unverändert

  Filter chain (BiquadFilter + wet/dry mix) — sehr sauber implementiert
  Distortion (soft/hard/fold mit wet/dry) — besser als unser buildDist
  3-Band EQ (low/mid/high shelf) — fehlt in unserem MVP komplett
  Reverb + Delay als Sends — sauberer als unsere FX-Chain
  _EnvTracker — mathematisch exaktes ADSR ohne Web Audio scheduling drift
  Panner, outputGain, analyser
  3-Voice Architektur (CALL/RESPONSE/COUNTER ready)
  Sequencer (16-Step, 3 Voices, BPM-sync)
  Auto-Save localStorage
  Web MIDI

### Was wir hinzufügen

  buildOscChain() als WobblerVoice-Methode (OSC1 + OSC2 + Sub + Noise)
  tickAllLFOs() mit Breakpoint-Kurven (5 Slots, phase-offset, modes)
  Breakpoint-Canvas-Editor für jede LFO-Slot
  Spectrogram + erweiterter Oscilloscope
  AI Sound Generation Interface
  Preset System mit vollständigem JSON

