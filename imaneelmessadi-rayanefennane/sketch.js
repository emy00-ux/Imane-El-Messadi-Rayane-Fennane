const audioContext = new AudioContext();
let synthInstance;

// Hand detection
let video;
let handpose;
let predictions = [];

// Pinch / click state
let pinchThreshold = 30; // pixels

// ON/OFF du piano (nouveau)
let pianoOn = false;     // false = OFF, true = ON

// Play by moving hand across whole screen (true = use full-screen keyboard)
let useWholeScreenPiano = true;
const START_MIDI_NOTE = 36; // MIDI note for the left-most key (36 + 70 = 106 < 128)

// Cutoff control
const CUTOFF_MIN = 0;
const CUTOFF_MAX = 200;
let cutoffCandidates = ['FilterCutoff', 'Cutoff', 'filterCutoff', 'cutoff', 'PolyModFilterEnv', 'Filter.Frequency', 'freq'];
let activeCutoffParam = null;
let currentCutoffValue = 0;

// Piano
let pianoKeys = [];
const NUM_KEYS = 71;
let lastKeyIndex = -1;
let whiteKeys = [];
let blackKeys = [];

// Test rectangle
let x = 0;
let y = 0;
let vitesseX = 10;

async function setup() {
  createCanvas(windowWidth, windowHeight);

  // Canvas plein écran + au-dessus du DOM
  const cnv = document.querySelector('canvas');
  if (cnv) {
    cnv.style.position = 'fixed';
    cnv.style.top = '0px';
    cnv.style.left = '0px';
    cnv.style.width = '100%';
    cnv.style.height = '100%';
    cnv.style.zIndex = '1000';
    cnv.style.pointerEvents = 'auto';

    // Petit bouton pour activer / désactiver la souris (pass-through)
    if (!document.getElementById('mouse-toggle')) {
      const btn = document.createElement('button');
      btn.id = 'mouse-toggle';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="1" y="6" width="22" height="12" rx="2" ry="2" fill="#fff" stroke="#333"/>
          <rect x="3" y="8" width="3" height="8" fill="#000"/>
          <rect x="7" y="8" width="3" height="8" fill="#000"/>
          <rect x="11" y="8" width="3" height="8" fill="#000"/>
          <rect x="15" y="8" width="3" height="8" fill="#000"/>
        </svg>
        <span class="btn-label">Activer souris</span>`;
      btn.title = 'Activer/désactiver la souris (pass-through)';
      btn.setAttribute('aria-pressed', 'false');
      btn.style.position = 'fixed';
      btn.style.top = '10px';
      btn.style.right = '10px';
      btn.style.zIndex = '2000';
      btn.style.padding = '8px 12px';
      btn.style.background = '#ffffffcc';
      btn.style.border = '1px solid #888';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      document.body.appendChild(btn);

      btn.addEventListener('click', () => {
        const label = btn.querySelector('.btn-label');
        if (cnv.style.pointerEvents === 'none') {
          cnv.style.pointerEvents = 'auto';
          btn.title = 'Activer/désactiver la souris (pass-through)';
          btn.setAttribute('aria-pressed', 'false');
          btn.style.opacity = '1';
          if (label) label.textContent = 'Activer souris';
        } else {
          cnv.style.pointerEvents = 'none';
          btn.title = 'Souris désactivée (pass-through ON)';
          btn.setAttribute('aria-pressed', 'true');
          btn.style.opacity = '0.95';
          if (label) label.textContent = 'Souris activée';
        }
      });
    }
  }

  // Resize
  window.addEventListener('resize', () => {
    windowResized();
  });

  // === Camera + handpose ===
  video = createCapture({ video: { width: windowWidth, height: windowHeight } });
  video.size(width, height);

  handpose = ml5.handpose(video, { maxHands: 1 }, modelReady);
  handpose.on("predict", results => {
    predictions = results;
  });

  video.hide();

  // === Piano dans le canvas ===
  createPiano();

  // === Synthé WAM ===
  const hostGroupId = await setupWamHost();
  const wamURISynth = 'https://wam-4tt.pages.dev/Pro54/index.js';
  synthInstance = await loadDynamicComponent(wamURISynth, hostGroupId);

  const synthDiv = await synthInstance.createGui();
  showWam(synthDiv, 300, 10, 0.7);

  let state = await synthInstance.audioNode.getState();
  state.values.patchName = "SquarePad";
  await synthInstance.audioNode.setState(state);

  synthInstance.audioNode.setParameterValues({
    "PolyModFilterEnv": { value: 80 }
  });

  synthInstance.audioNode.connect(audioContext.destination);
}

function modelReady() {
  console.log("Handpose ready!");
}

async function setupWamHost() {
  const { default: initializeWamHost } =
    await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
  const [hostGroupId] = await initializeWamHost(audioContext);
  return hostGroupId;
}

async function loadDynamicComponent(wamURI, hostGroupId) {
  try {
    const { default: WAM } = await import(wamURI);
    const wamInstance = await WAM.createInstance(hostGroupId, audioContext);
    return wamInstance;
  } catch (error) {
    console.error('Erreur WAM :', error);
  }
}

function showWam(wamGUI, x, y, scale, width, height) {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.overflow = 'hidden';
  container.style.zIndex = '0';        // derrière le canvas
  container.id = 'wam-gui-container';

  container.appendChild(wamGUI);

  adjustPositionAndSize(container, x, y, scale);
  if (height !== undefined) container.style.height = height + "px";
  if (width !== undefined) container.style.width = width + "px";

  document.body.appendChild(container);
  window.wamContainer = container;
  requestAnimationFrame(() => {
    try {
      window.wamRect = container.getBoundingClientRect();
    } catch (e) {
      window.wamRect = undefined;
    }
  });
}

function adjustPositionAndSize(wamContainer, x, y, scale) {
  wamContainer.style.transformOrigin = '0 0';
  wamContainer.style.top = y + "px";
  wamContainer.style.left = x + "px";
  wamContainer.style.transform = `scale(${scale})`;
}

function draw() {
  // Fond vidéo
  image(video, 0, 0, width, height);

  // Laisser voir le WAM à travers une "fenêtre"
  if (window.wamRect) {
    const r = window.wamRect;
    try {
      drawingContext.clearRect(r.left, r.top, r.width, r.height);
    } catch (e) {}
  }

  // Bande sombre pour la zone piano
  fill(0, 0, 0, 80);
  noStroke();
  rect(0, height - 200, width, 200);

  // Piano
  drawPiano();

  // Mains + contrôle piano
  drawHands();

  // Bouton visuel PIANO ON/OFF
  drawPianoOnOffIndicator();

  // Texte d’aide
  fill(255);
  noStroke();
  textSize(20);
  textAlign(LEFT, TOP);
  text("➡ Mets ta main devant la caméra.\n   Main ouverte = OFF (bleu). Pinch pouce/index = ON (rouge).\n   Déplace ton index horizontalement au-dessus des touches pour jouer.", 20, 20);

  // Affichage cutoff
  if (activeCutoffParam) {
    push();
    fill(255);
    noStroke();
    textAlign(RIGHT, TOP);
    textSize(16);
    text(`Cutoff(${activeCutoffParam}): ${currentCutoffValue}`, width - 20, 20);
    pop();
  }

  // Param synth avec souris (optionnel)
  if (synthInstance && synthInstance.audioNode) {
    synthInstance.audioNode.setParameterValues({
      "PolyModFilterEnv": { value: map(mouseX, 0, width, 0, 200) }
    });
  }

  // Test rectangle
  fill("red");
  rect(x, 50, 80, 40);
  x += vitesseX;
  if ((x + 80 > width) || (x < 0)) {
    let note = 74;
    console.log("Note test:", note);
    noteOn(note);
    if (synthInstance && synthInstance.audioNode) {
      synthInstance.audioNode.scheduleEvents({
        type: 'wam-midi',
        time: audioContext.currentTime + 0.25,
        data: { bytes: new Uint8Array([0x80, note, 0]) }
      });
    }
    vitesseX = -vitesseX;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  createPiano();
  if (window.wamContainer) {
    try {
      window.wamRect = window.wamContainer.getBoundingClientRect();
    } catch (e) {
      window.wamRect = undefined;
    }
  }
}

/* ==================== PIANO ==================== */

function createPiano() {
  const keyHeight = 150;
  const pianoY = height - keyHeight - 10;
  const startMidiNote = START_MIDI_NOTE;

  const blackSet = new Set([1, 3, 6, 8, 10]);

  let whiteCount = 0;
  for (let i = 0; i < NUM_KEYS; i++) {
    const semitone = (startMidiNote + i) % 12;
    if (!blackSet.has(semitone)) whiteCount++;
  }

  const whiteKeyWidth = width / whiteCount;

  whiteKeys = [];
  blackKeys = [];

  let whiteIndex = 0;
  for (let i = 0; i < NUM_KEYS; i++) {
    const midi = startMidiNote + i;
    const semitone = midi % 12;
    if (!blackSet.has(semitone)) {
      const x = whiteIndex * whiteKeyWidth;
      const key = { x, y: pianoY, w: whiteKeyWidth, h: keyHeight, midi, pressed: false, type: 'white' };
      whiteKeys.push(key);
      whiteIndex++;
    } else {
      const bw = whiteKeyWidth * 0.6;
      const bh = keyHeight * 0.62;
      const x = (whiteIndex - 1) * whiteKeyWidth + whiteKeyWidth * 0.7 - bw / 2;
      const key = { x, y: pianoY, w: bw, h: bh, midi, pressed: false, type: 'black' };
      blackKeys.push(key);
    }
  }

  pianoKeys = whiteKeys.concat(blackKeys);
}

function drawPiano() {
  // touches blanches
  for (let i = 0; i < whiteKeys.length; i++) {
    const key = whiteKeys[i];
    if (key.pressed) {
      fill(230, 240, 255);
    } else {
      fill(255);
    }
    stroke(80);
    strokeWeight(1);
    rect(key.x, key.y, key.w, key.h, 4);
    stroke(120);
    line(key.x + key.w - 1, key.y + 6, key.x + key.w - 1, key.y + key.h - 6);
  }

  // touches noires
  for (let i = 0; i < blackKeys.length; i++) {
    const key = blackKeys[i];
    if (key.pressed) {
      fill(40, 40, 40);
    } else {
      fill(0);
    }
    noStroke();
    rect(key.x, key.y, key.w, key.h, 3);
  }
}

/* ==================== MAINS ==================== */

function drawHands() {
  for (let i = 0; i < predictions.length; i++) {
    const prediction = predictions[i];
    const landmarks = prediction.landmarks;

    // petits points verts
    for (let j = 0; j < landmarks.length; j++) {
      const [lx, ly, lz] = landmarks[j];
      fill(0, 255, 0);
      noStroke();
      ellipse(lx, ly, 8, 8);
    }

    if (!landmarks || landmarks.length <= 8) continue;
    const [ix, iy, iz] = landmarks[8];

    const videoW = (video && video.elt && video.elt.videoWidth) || video.width || width;
    const videoH = (video && video.elt && video.elt.videoHeight) || video.height || height;
    const fx = map(ix, 0, videoW, 0, width);
    const fy = map(iy, 0, videoH, 0, height);

    const [tx, ty] = landmarks[4] || [ix, iy];
    const ftx = map(tx, 0, videoW, 0, width);
    const fty = map(ty, 0, videoH, 0, height);

    // distance pouce-index
    const pinchDist = dist(fx, fy, ftx, fty);

    // === LOGIQUE ON / OFF ===
    const wasOn = pianoOn;
    if (pinchDist < pinchThreshold) {
      // pouce + index collés → ON
      pianoOn = true;
    } else if (pinchDist > pinchThreshold * 2) {
      // main ouverte (pouce loin) → OFF
      pianoOn = false;
    }

    // si on vient de passer ON -> OFF, stopper la note courante
    if (!pianoOn && wasOn && lastKeyIndex !== -1) {
      const midi = START_MIDI_NOTE + lastKeyIndex;
      noteOff(midi);
      lastKeyIndex = -1;
    }

    // couleur du doigt
    if (pianoOn) {
      fill(255, 60, 60);  // rouge = ON
    } else {
      fill(60, 120, 255); // bleu = OFF
    }
    noStroke();
    ellipse(fx, fy, 18, 18);

    // Ligne entre pouce et index (optionnel)
    stroke(pianoOn ? 'lime' : 'red');
    strokeWeight(2);
    line(fx, fy, ftx, fty);

    // Contrôle du cutoff (toujours actif même si piano OFF)
    if (synthInstance && synthInstance.audioNode) {
      const cutoffVal = map(fy, height, 0, CUTOFF_MIN, CUTOFF_MAX);
      currentCutoffValue = Math.round(cutoffVal);
      const setParam = (name) => {
        try {
          synthInstance.audioNode.setParameterValues({ [name]: { value: cutoffVal } });
          activeCutoffParam = name;
          return true;
        } catch (e) {
          return false;
        }
      };
      if (activeCutoffParam) {
        setParam(activeCutoffParam);
      } else {
        for (let i = 0; i < cutoffCandidates.length; i++) {
          if (setParam(cutoffCandidates[i])) break;
        }
      }
    }

    // Jeu du piano
    if (useWholeScreenPiano) {
      handleFingerOnPianoAnywhere(fx, fy);
      const keyWidth = width / NUM_KEYS;
      const idx = floor(constrain(fx, 0, width - 1) / keyWidth);
      if (idx >= 0 && idx < NUM_KEYS) {
        noStroke();
        fill(255, 200, 200, 60);
        rect(idx * keyWidth, 0, keyWidth, height);
      }
    } else {
      handleFingerOnPianoByX(fx);
    }
  }

  // plus de main → on coupe
  if (predictions.length === 0 && lastKeyIndex !== -1) {
    const midi = START_MIDI_NOTE + lastKeyIndex;
    noteOff(midi);
    lastKeyIndex = -1;
  }
}

/* 🎯 Piano par X dans la zone du clavier (ou main partout) */

function handleFingerOnPianoByX(fx) {
  if (!pianoOn) return; // OFF → rien

  let currentKey = null;
  // touche noire prioritaire
  for (let i = 0; i < blackKeys.length; i++) {
    const k = blackKeys[i];
    if (fx >= k.x && fx <= k.x + k.w) {
      currentKey = k;
      break;
    }
  }

  if (!currentKey) {
    for (let i = 0; i < whiteKeys.length; i++) {
      const k = whiteKeys[i];
      if (fx >= k.x && fx <= k.x + k.w) {
        currentKey = k;
        break;
      }
    }
  }

  const currentKeyIndex = currentKey ? currentKey.midi - START_MIDI_NOTE : -1;

  if (currentKeyIndex !== lastKeyIndex) {
    if (lastKeyIndex !== -1) {
      const prevMidi = START_MIDI_NOTE + lastKeyIndex;
      const prev = pianoKeys.find(k => k.midi === prevMidi) || {};
      if (prev.pressed) prev.pressed = false;
      noteOff(prevMidi);
    }

    if (currentKey) {
      currentKey.pressed = true;
      console.log("Touche :", currentKeyIndex, "MIDI:", currentKey.midi);
      noteOn(currentKey.midi);
    }

    lastKeyIndex = currentKeyIndex;
  }
}

function handleFingerOnPianoAnywhere(fx, fy) {
  if (!pianoOn) return; // OFF → rien

  const keyWidth = width / NUM_KEYS;
  let currentKeyIndex = floor(constrain(fx, 0, width - 1) / keyWidth);

  if (currentKeyIndex !== lastKeyIndex) {
    if (lastKeyIndex !== -1) {
      const midi = START_MIDI_NOTE + lastKeyIndex;
      noteOff(midi);
    }

    if (currentKeyIndex !== -1) {
      const midi = START_MIDI_NOTE + currentKeyIndex;
      noteOn(midi);
    }

    lastKeyIndex = currentKeyIndex;
  }
}

/* ============ INDICATEUR VISUEL PIANO ON/OFF ============ */

function drawPianoOnOffIndicator() {
  const w = 160;
  const h = 40;
  const x = 20;
  const y = height - 200 - 60; // au-dessus de la zone piano

  push();
  stroke(255);
  strokeWeight(2);
  fill(pianoOn ? color(0, 200, 80, 220) : color(200, 50, 50, 220));
  rect(x, y, w, h, 10);

  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(pianoOn ? "PIANO ON" : "PIANO OFF", x + w / 2, y + h / 2);
  pop();
}

/* ==================== MIDI ==================== */

function noteOn(midi) {
  if (!synthInstance || !synthInstance.audioNode) return;
  synthInstance.audioNode.scheduleEvents({
    type: 'wam-midi',
    time: audioContext.currentTime,
    data: { bytes: new Uint8Array([0x90, midi, 100]) }
  });
}

function noteOff(midi) {
  if (!synthInstance || !synthInstance.audioNode) return;
  synthInstance.audioNode.scheduleEvents({
    type: 'wam-midi',
    time: audioContext.currentTime,
    data: { bytes: new Uint8Array([0x80, midi, 0]) }
  });
}

// simulateClickAtCanvas existe encore mais n'est plus utilisé (pas grave)
function simulateClickAtCanvas(cx, cy) {
  const cnv = document.querySelector('canvas');
  if (!cnv) return;
  const rect = cnv.getBoundingClientRect();
  const clientX = rect.left + (cx / width) * rect.width;
  const clientY = rect.top + (cy / height) * rect.height;

  const prev = cnv.style.pointerEvents;
  try {
    cnv.style.pointerEvents = 'none';
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window, clientX, clientY };
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  } catch (e) {
    console.warn('simulateClickAtCanvas error', e);
  } finally {
    cnv.style.pointerEvents = prev || '';
  }
}

/* ==================== UNLOCK AUDIO + SOURIS ==================== */

function keyPressed() {
  audioContext.resume();
}

function mousePressed() {
  audioContext.resume();
  if (pianoKeys && pianoKeys.length > 0) {
    // touches noires
    for (let i = 0; i < blackKeys.length; i++) {
      const k = blackKeys[i];
      if (mouseX >= k.x && mouseX <= k.x + k.w && mouseY >= k.y && mouseY <= k.y + k.h) {
        k.pressed = true;
        noteOn(k.midi);
        lastKeyIndex = k.midi - START_MIDI_NOTE;
        return;
      }
    }
    // touches blanches
    for (let i = 0; i < whiteKeys.length; i++) {
      const k = whiteKeys[i];
      if (mouseX >= k.x && mouseX <= k.x + k.w && mouseY >= k.y && mouseY <= k.y + k.h) {
        k.pressed = true;
        noteOn(k.midi);
        lastKeyIndex = k.midi - START_MIDI_NOTE;
        break;
      }
    }
  }
}

function mouseReleased() {
  if (lastKeyIndex !== -1) {
    const midi = START_MIDI_NOTE + lastKeyIndex;
    noteOff(midi);
    const k = pianoKeys.find(k => k.midi === midi);
    if (k) k.pressed = false;
    lastKeyIndex = -1;
  }
}

function touchStarted() {
  mousePressed();
  return false;
}

function touchEnded() {
  mouseReleased();
  return false;
}

function mouseMoved() {
  audioContext.resume();
}
