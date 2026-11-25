// ─────────────────────────────────────────────────────────
// ABDShared — Instrument Name Classification Hints
// ─────────────────────────────────────────────────────────

export function classifyInstrumentAndParameterSet(name: string): {
  category: string;
  parameterSet: number;
} {
  const n = String(name || '').toLowerCase();
  if (/drum|kit|snare|kick|hihat|hat|tom|cymbal|conga|bongo|timpani|taiko|djembe|cajon|perc/.test(n)) {
    return { category: 'Drums & Percussion Kit', parameterSet: 8 };
  }
  if (/violin|viola|cello|contrabass|string|orchestra|ensemble|arco|pizz|quartet|symphon/.test(n)) {
    return { category: 'Orchestral & Strings', parameterSet: 1 };
  }
  if (/rhodes|wurli|clav|epiano|tine|fm piano|dx7/.test(n)) {
    return { category: 'Electric Pianos & Tines', parameterSet: 5 }; // Neuron 5 = Piano etc.
  }
  if (/piano|grand|upright|organ|harpsi|spinel|accord/.test(n)) {
    return { category: 'Keyboards & Acoustic Pianos', parameterSet: 5 };
  }
  if (/\bbass\b|sub|808|fretless|slap|contrabass|upright bass|synth bass|acid/.test(n)) {
    return { category: 'Bass & Low End', parameterSet: 3 }; // Neuron 3 = Plucked & Picked
  }
  if (/guitar|harp|banjo|mandolin|lute|sitar|koto|shamisen|oud|pipa|ukulele|pluck/.test(n)) {
    return { category: 'Plucked & Ethnic / World', parameterSet: 3 };
  }
  if (/sax|flute|oboe|clarinet|bassoon|wind|reed|harmonica|pipe|panflute|recorder|bagpipe/.test(n)) {
    return { category: 'Woodwinds & Reeds', parameterSet: 6 }; // Neuron 6 = Woodwinds
  }
  if (/trumpet|trombone|tuba|cornet|french horn|brass|fanfare/.test(n)) {
    return { category: 'Brass & Horns', parameterSet: 6 };
  }
  if (/choir|voice|vocal|vox|aah|ooh|soprano voice|tenor voice|opera|acapella|chant/.test(n)) {
    return { category: 'Vocal & Choir', parameterSet: 4 }; // Neuron 4 = Carpet Shop
  }
  if (/bell|marimba|vibes|vibraphone|xylophone|glock|kalimba|chime|mallet|gong|tubular|celesta|music box/.test(n)) {
    return { category: 'Mallets & Chromatic Perc', parameterSet: 2 }; // Neuron 2 = Plucked & Bells
  }
  if (/pad|atmos|ambient|sweep|warm|halo|shimmer|ethereal|soundscape/.test(n)) {
    return { category: 'Pads & Atmospheres', parameterSet: /atmos|morph|shimmer|ethereal|soundscape/.test(n) ? 7 : 4 };
  }
  if (/arp|loop|groove|beat|sequence|riff|phrase/.test(n)) {
    return { category: 'Arpeggiated & Sequences', parameterSet: 8 }; // Neuron 8 = Loop Factory
  }
  if (/lead|solo|mono|saw lead|square lead|sync lead|screamer/.test(n)) {
    return { category: 'Synth Leads & Solos', parameterSet: 0 };
  }
  if (/sfx|fx|noise|laser|riser|hit|impact|glitch|drone|cinematic|experimental|drop/.test(n)) {
    return { category: 'SFX, Drones & Cinematic', parameterSet: 9 }; // Neuron 9 = Multipurpose
  }
  return { category: 'Synth & Neutral', parameterSet: 0 };
}
