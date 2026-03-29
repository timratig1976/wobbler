// ─────────────────────────────────────────────────────────
//  ai-interface.js — Claude API Sound Generation
//  Requires: presets.js (applyPresetToSynth), lfo-presets.js
// ─────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `Du bist ein DnB/Neurofunk Sound Designer für einen Web Audio Synthesizer.
Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt. Kein Text davor oder danach.

Das JSON-Format ist:
{
  "name": "Preset Name",
  "description": "Kurze Beschreibung",
  "osc1": {
    "waveform": "sawtooth",
    "pitch": 0,
    "cent": 0,
    "volume": 0.8,
    "unison": 1,
    "unisonDetune": 20,
    "spread": 0.5
  },
  "osc2": {
    "waveform": "sine",
    "oct": 0,
    "semi": 0,
    "detune": 7,
    "cents": 0,
    "volume": 0.5,
    "unison": 1
  },
  "osc1Active": true,
  "osc2Active": false,
  "subActive": false,
  "osc1ModTarget": "none",
  "osc1ModDepth": 0.5,
  "sub": {
    "waveform": "sine",
    "oct": -2,
    "volume": 0.6
  },
  "filter": {
    "type": "lowpass",
    "cutoff": 800,
    "resonance": 5
  },
  "adsr": {
    "attack": 0.005,
    "decay": 0.25,
    "sustain": 0.4,
    "release": 0.12
  },
  "dist": {
    "form": "soft",
    "drive": 0,
    "mix": 0
  },
  "fx": {
    "reverbMix": 0,
    "delayMix": 0
  },
  "lfos": [
    {
      "preset": "dnbsaw",
      "bars": 2,
      "mult": 1.333,
      "target": "cutoff",
      "depth": 0.65,
      "offset": 0,
      "mode": "normal"
    },
    {
      "preset": "none",
      "bars": 2, "mult": 1, "target": "none", "depth": 0,
      "offset": 0, "mode": "normal"
    },
    {
      "preset": "none",
      "bars": 4, "mult": 1, "target": "none", "depth": 0,
      "offset": 0, "mode": "normal"
    }
  ],
  "sequencer": {
    "patterns": [
      [{"active":true,"note":36,"accent":false}, {"active":false,"note":36,"accent":false}, {"active":false,"note":36,"accent":false}, {"active":false,"note":36,"accent":false},
       {"active":true,"note":36,"accent":false}, {"active":false,"note":36,"accent":false}, {"active":false,"note":36,"accent":false}, {"active":false,"note":36,"accent":false},
       {"active":true,"note":36,"accent":false}, {"active":false,"note":36,"accent":false}, {"active":false,"note":36,"accent":false}, {"active":false,"note":36,"accent":false},
       {"active":true,"note":36,"accent":false}, {"active":false,"note":36,"accent":false}, {"active":false,"note":36,"accent":false}, {"active":false,"note":36,"accent":false}]
    ]
  }
}

Verfügbare LFO-Preset-Namen (preset-Feld): sine, sawup, sawdn, square, triangle, dnbsaw, wubwub, triplet, acid, fastsaw, rubber, dnbpump, neurozap, neuroglitch, neuro, liquid, breathe, flow, halftime, stair4, stairirr, step4, pluck, gate, sidechain, wah, bounce, expup, expdown, shark

Für Call & Response: LFO 1 ist CALL (offset:0), LFO 2 ist RESPONSE (offset: 0.25..0.5), LFO 3 ist COUNTER (mode: "inverse").

Wähle Parameter die zum Prompt passen. DnB = 170-174 BPM Kontext.`;

// ─── generatePreset ───────────────────────────────────────
// Calls Claude API and returns a parsed preset JSON object.
// apiKey: Anthropic API key (from user input, never hardcoded).
async function generatePreset(prompt, apiKey, currentState = null) {
  if (!apiKey) throw new Error('API key required');

  const messages = [];

  if (currentState) {
    messages.push({
      role: 'user',
      content: `Aktueller Synthesizer-State als Kontext:\n${JSON.stringify(currentState, null, 2)}`
    });
    messages.push({
      role: 'assistant',
      content: 'Verstanden. Ich habe den aktuellen State als Basis.'
    });
  }

  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-opus-4-5',
      max_tokens: 2000,
      system:     AI_SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Strip possible markdown fences
  const clean = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean);
}

// ─── AI Bar UI ────────────────────────────────────────────
// Call this once after DOM is ready to wire up the AI bar.
function initAIBar(synth, seq) {
  const bar      = document.getElementById('ai-bar');
  const input    = document.getElementById('ai-prompt');
  const btn      = document.getElementById('ai-generate-btn');
  const status   = document.getElementById('ai-status');
  const keyInput = document.getElementById('ai-api-key');
  if (!bar || !btn) return;

  btn.addEventListener('click', async () => {
    const prompt = input?.value?.trim();
    if (!prompt) return;
    const apiKey = keyInput?.value?.trim() || '';
    if (!apiKey) { if (status) status.textContent = 'need API key'; return; }

    if (status) status.textContent = 'generating…';
    btn.disabled = true;

    try {
      const preset = await generatePreset(prompt, apiKey);
      applyPresetToSynth(preset, synth, seq);
      if (status) status.textContent = `✓ ${preset.name || 'done'}`;
    } catch (e) {
      if (status) status.textContent = 'error';
      console.error('AI generate failed:', e);
    } finally {
      btn.disabled = false;
    }
  });

  input?.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
}
