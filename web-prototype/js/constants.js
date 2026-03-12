// ─────────────────────────────────────────────────────────
//  Wobbler Bass — Audio Engine + UI  (Web Audio API)
// ─────────────────────────────────────────────────────────

// ── Utilities ─────────────────────────────────────────────
function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function midiToNote(m) { return NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1); }

const VOICE_COLORS   = ['#5dbfa8','#d88860','#9d7bc9'];
const VOICE_LABELS   = ['VOICE 1','VOICE 2','VOICE 3'];
const WAVE_TYPES     = ['sine','sawtooth','square','triangle','pulse','supersaw'];
const FILTER_TYPES   = ['lowpass','highpass','bandpass','notch'];
const FILTER_LABELS  = ['LP','HP','BP','NCH'];
const LFO_TARGETS    = ['cutoff','resonance','volume','pitch','noiseAmt','chorus'];
const LFO_TARGET_LBL = ['CUTOFF','RESON','VOLUME','PITCH','NOISE','CHORUS'];
const NOISE_TYPES    = ['white','pink','brown','blue','violet'];
const NOISE_LABELS   = ['White','Pink','Brown','Blue','Violet'];
// Bass range C1(24)–G2(43)
const SEQ_NOTES = Array.from({length:20}, (_,i) => ({midi:24+i, name:midiToNote(24+i)}));

// ─────────────────────────────────────────────────────────
//  _EnvTracker — pure-JS ADSR state machine
//  Computes envelope value mathematically so noteOn/noteOff
//  never need to read AudioParam.value mid-automation.
// ─────────────────────────────────────────────────────────
