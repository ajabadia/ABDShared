/**
 * @file studioTopology.js
 * @brief Componente interactivo universal de interconexión y topología de estudio (ABDShared).
 * @details Provee renderizado vectorial SVG de cables Bézier con física catenaria por gravedad,
 *          tarjetas de hardware y puertos con soporte para arrastre libre y persistencia de posiciones.
 *          Basado fielmente en el motor oficial de ABDStudioTopology.
 * @author ABDSynths
 * @date 2026
 */

const CABLE_PHYSICS = {
  BASE_SAG: 85,
  SAG_FACTOR: 0.22,
  MAX_SAG: 260,
  STROKE_WIDTH: 4,
  PLUG_RADIUS: 5,
  SPREAD: 16
};

const SIGNAL_COLORS = {
  audioOut: '#f59e0b', // Ámbar (Audio Probe/Stimulus)
  audioIn:  '#10b981', // Verde esmeralda (Audio Return)
  midiOut:  '#a855f7', // Púrpura (MIDI Out)
  midiIn:   '#06b6d4'  // Cian (MIDI In)
};

const STORAGE_KEY = 'abd_studio_topology_positions_v1';

export class StudioTopology {
  /**
   * @param {HTMLElement|string} mountElement Contenedor donde se montará la topología
   * @param {object} initialData Datos iniciales { target, devices, connections }
   */
  constructor(mountElement, initialData = {}) {
    this.container = typeof mountElement === 'string' ? document.querySelector(mountElement) : mountElement;
    if (!this.container) return;

    this.data = {
      target: null,
      devices: [],
      connections: [],
      ...initialData
    };

    this.nodePositions = new Map();
    this.activeDrag = null;

    this._setupDom();
    this._attachResize();

    if (this.data.target || (this.data.devices && this.data.devices.length > 0)) {
      this.render();
    }
  }

  _setupDom() {
    this.container.innerHTML = `
      <div class="studio-topology-container" id="canvas-container">
        <!-- Barra de Cabecera -->
        <div class="header-bar">
          <div class="header-title-area">
            <div class="header-title">
              <svg class="header-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22v-5"/>
                <path d="M9 8V2"/>
                <path d="M15 2v6"/>
                <path d="M18 8v5a6 6 0 0 1-12 0V8z"/>
              </svg>
              <span>Entorno de Estudio &amp; Conexiones</span>
            </div>
            <div class="header-subtitle">
              Arrastra cualquier equipo libremente. Los cables se adaptan a tiempo real.
            </div>
          </div>
          <div class="header-legend">
            <div class="legend-item"><div class="legend-dot audio-out"></div><span>Audio Out (Probe)</span></div>
            <div class="legend-item"><div class="legend-dot audio-in"></div><span>Audio In (Return)</span></div>
            <div class="legend-item"><div class="legend-dot midi-out"></div><span>MIDI Out</span></div>
            <div class="legend-item"><div class="legend-dot midi-in"></div><span>MIDI In</span></div>
          </div>
        </div>

        <!-- Capa SVG de Cables Físicos -->
        <svg id="cables-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="cable-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.5"/>
            </filter>
          </defs>
          <g id="cables-group"></g>
          <g id="plugs-group"></g>
        </svg>

        <!-- Capa de Nodos HTML Arrastrables -->
        <div class="nodes-layer" id="nodes-layer"></div>
      </div>
    `;

    this.canvasContainer = this.container.querySelector('#canvas-container');
    this.nodesLayer = this.container.querySelector('#nodes-layer');
    this.cablesGroup = this.container.querySelector('#cables-group');
    this.plugsGroup = this.container.querySelector('#plugs-group');
  }

  _attachResize() {
    this._resizeHandler = () => {
      if (this.data && this.data.target) {
        this.updateCables();
      }
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  destroy() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  update(newData) {
    if (!newData) return;
    this.data = { ...this.data, ...newData };
    this.render();
  }

  render() {
    if (!this.canvasContainer || !this.nodesLayer) return;
    this.nodesLayer.innerHTML = '';

    const width = this.canvasContainer.clientWidth || 720;
    const height = this.canvasContainer.clientHeight || 480;

    const centerX = width / 2;
    const centerY = height / 2 + 10;

    let savedPositions = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) savedPositions = JSON.parse(raw);
    } catch (_) {}

    // 1. Posicionar Target
    if (this.data.target) {
      if (!this.nodePositions.has('target')) {
        if (savedPositions['target'] && typeof savedPositions['target'].x === 'number') {
          this.nodePositions.set('target', { x: savedPositions['target'].x, y: savedPositions['target'].y });
        } else {
          this.nodePositions.set('target', { x: centerX, y: centerY + 15 });
        }
      }
    }

    // 2. Posicionar dispositivos
    const devices = this.data.devices || [];
    const connectedDevs = devices.filter(d => d.assigned);
    const unassignedDevs = devices.filter(d => !d.assigned);

    const cornerSlots = [
      { x: width * 0.22, y: height * 0.28 },
      { x: width * 0.78, y: height * 0.28 },
      { x: width * 0.16, y: height * 0.58 },
      { x: width * 0.84, y: height * 0.58 },
      { x: width * 0.32, y: height * 0.24 },
      { x: width * 0.68, y: height * 0.24 }
    ];

    connectedDevs.forEach((dev, idx) => {
      if (!this.nodePositions.has(dev.id)) {
        if (savedPositions[dev.id] && typeof savedPositions[dev.id].x === 'number') {
          this.nodePositions.set(dev.id, { x: savedPositions[dev.id].x, y: savedPositions[dev.id].y });
        } else {
          const slot = cornerSlots[idx % cornerSlots.length];
          this.nodePositions.set(dev.id, {
            x: Math.max(100, Math.min(width - 100, slot.x)),
            y: Math.max(80, Math.min(height - 80, slot.y))
          });
        }
      }
    });

    const unassignedSlots = [
      { x: width * 0.20, y: height * 0.82 },
      { x: width * 0.50, y: height * 0.84 },
      { x: width * 0.80, y: height * 0.82 }
    ];

    unassignedDevs.forEach((dev, idx) => {
      if (!this.nodePositions.has(dev.id)) {
        if (savedPositions[dev.id] && typeof savedPositions[dev.id].x === 'number') {
          this.nodePositions.set(dev.id, { x: savedPositions[dev.id].x, y: savedPositions[dev.id].y });
        } else {
          const slot = unassignedSlots[idx % unassignedSlots.length];
          this.nodePositions.set(dev.id, {
            x: Math.max(100, Math.min(width - 100, slot.x)),
            y: Math.max(80, Math.min(height - 80, slot.y))
          });
        }
      }
    });

    // 3. Relaxation Pass (resolución de colisiones)
    const allNodeKeys = Array.from(this.nodePositions.keys());
    const minSeparationX = 220;
    const minSeparationY = 170;

    for (let iter = 0; iter < 8; ++iter) {
      for (let i = 0; i < allNodeKeys.length; ++i) {
        for (let j = i + 1; j < allNodeKeys.length; ++j) {
          const idA = allNodeKeys[i];
          const idB = allNodeKeys[j];
          const posA = this.nodePositions.get(idA);
          const posB = this.nodePositions.get(idB);

          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);

          if (absX < minSeparationX && absY < minSeparationY) {
            const overlapX = minSeparationX - absX;
            const overlapY = minSeparationY - absY;
            const shiftFactor = 0.5;
            const signX = dx >= 0 ? 1 : -1;
            const signY = dy >= 0 ? 1 : -1;

            if (idA === 'target') {
              posB.x += signX * overlapX;
              posB.y += signY * overlapY;
            } else if (idB === 'target') {
              posA.x -= signX * overlapX;
              posA.y -= signY * overlapY;
            } else {
              posA.x -= signX * overlapX * shiftFactor;
              posA.y -= signY * overlapY * shiftFactor;
              posB.x += signX * overlapX * shiftFactor;
              posB.y += signY * overlapY * shiftFactor;
            }
          }
        }
      }
    }

    // 4. Renderizar nodos
    if (this.data.target) {
      this._renderNode('target', this.data.target, true);
    }
    connectedDevs.forEach(dev => this._renderNode(dev.id, dev, false));
    unassignedDevs.forEach(dev => this._renderNode(dev.id, dev, false));

    requestAnimationFrame(() => {
      this.updateCables();
    });
  }

  _renderNode(id, dev, isTarget) {
    const pos = this.nodePositions.get(id);
    if (!pos) return;

    const nodeEl = document.createElement('div');
    nodeEl.id = `node-${id}`;
    nodeEl.className = `device-node ${isTarget ? 'target-hero' : 'interface-node'} ${!isTarget && !dev.assigned ? 'unassigned' : ''}`;
    nodeEl.style.left = `${pos.x}px`;
    nodeEl.style.top = `${pos.y}px`;

    // Badge
    const badge = document.createElement('div');
    badge.className = `node-badge ${isTarget ? 'target-badge' : (dev.assigned ? 'connected' : 'unassigned-badge')}`;
    badge.textContent = isTarget ? 'TARGET DE MEDICIÓN' : (dev.assigned ? 'CONECTADA' : 'NO ASIGNADA');
    nodeEl.appendChild(badge);

    // Imagen
    const imgContainer = document.createElement('div');
    imgContainer.className = 'node-image-container';
    const img = document.createElement('img');
    img.className = 'node-image';
    img.src = dev.image || '';
    img.alt = dev.name || 'Device';
    img.onerror = () => {
      img.style.display = 'none';
      imgContainer.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:var(--color-text-dim, #94a3b8); font-size:10px; font-weight:700; text-transform:uppercase;">${isTarget ? 'HARDWARE TARGET' : 'AUDIO / MIDI I/O'}</div>`;
    };
    imgContainer.appendChild(img);
    nodeEl.appendChild(imgContainer);

    // Título y categoría
    const title = document.createElement('div');
    title.className = 'node-title';
    title.textContent = dev.name;
    title.title = dev.name;
    nodeEl.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'node-subtitle';
    subtitle.textContent = dev.details || dev.category || (isTarget ? 'Hardware Bajo Prueba' : 'Dispositivo I/O');
    nodeEl.appendChild(subtitle);

    // Conectores Jacks
    const jacks = document.createElement('div');
    jacks.className = 'node-jacks';

    if (dev.ports && Array.isArray(dev.ports) && dev.ports.length > 0) {
      dev.ports.forEach(port => {
        const jackEl = document.createElement('div');
        const typeClass = (port.type || 'audio-out').replace(/([A-Z])/g, '-$1').toLowerCase();
        jackEl.className = `jack-point ${typeClass} ${port.connected ? 'active' : ''}`;
        jackEl.title = `${port.name || port.id} (${port.type})`;
        jackEl.id = `jack-${id}-${port.id}`;
        jacks.appendChild(jackEl);
      });
    } else {
      const jackTypes = [];
      if (dev.hasAudio !== false) {
        jackTypes.push({ type: 'audioOut', title: 'Audio Out' });
        jackTypes.push({ type: 'audioIn',  title: 'Audio In' });
      }
      if (dev.hasMidi !== false) {
        jackTypes.push({ type: 'midiOut',  title: 'MIDI Out' });
        jackTypes.push({ type: 'midiIn',   title: 'MIDI In' });
      }

      jackTypes.forEach(j => {
        const jackEl = document.createElement('div');
        jackEl.className = `jack-point ${j.type.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        jackEl.title = j.title;
        jackEl.id = `jack-${id}-${j.type}`;
        jacks.appendChild(jackEl);
      });
    }

    nodeEl.appendChild(jacks);

    // Drag & Drop con Pointer Events y Pointer Capture
    nodeEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.activeDrag = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        origNodeX: pos.x,
        origNodeY: pos.y
      };
      nodeEl.classList.add('dragging');
      nodeEl.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });

    nodeEl.addEventListener('pointermove', (e) => {
      if (!this.activeDrag || this.activeDrag.id !== id) return;
      const dx = e.clientX - this.activeDrag.startX;
      const dy = e.clientY - this.activeDrag.startY;

      const containerW = this.canvasContainer.clientWidth || 720;
      const containerH = this.canvasContainer.clientHeight || 480;

      const newX = Math.max(70, Math.min(containerW - 70, this.activeDrag.origNodeX + dx));
      const newY = Math.max(50, Math.min(containerH - 50, this.activeDrag.origNodeY + dy));

      pos.x = newX;
      pos.y = newY;
      nodeEl.style.left = `${newX}px`;
      nodeEl.style.top = `${newY}px`;

      this.updateCables();
    });

    const endDrag = (e) => {
      if (this.activeDrag && this.activeDrag.id === id) {
        nodeEl.classList.remove('dragging');
        try { nodeEl.releasePointerCapture(e.pointerId); } catch (_) {}
        this.activeDrag = null;

        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const current = raw ? JSON.parse(raw) : {};
          current[id] = { x: pos.x, y: pos.y };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        } catch (_) {}
      }
    };

    nodeEl.addEventListener('pointerup', endDrag);
    nodeEl.addEventListener('pointercancel', endDrag);

    this.nodesLayer.appendChild(nodeEl);
  }

  computeBundleSpread(x1, y1, x2, y2, position, groupSize) {
    if (groupSize <= 1) return { x: 0, y: 0 };
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const offset = (position - (groupSize - 1) / 2) * CABLE_PHYSICS.SPREAD;
    return { x: nx * offset, y: ny * offset };
  }

  calculateCablePath(x1, y1, x2, y2, position, groupSize) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);

    const sag = Math.min(CABLE_PHYSICS.BASE_SAG + dist * CABLE_PHYSICS.SAG_FACTOR, CABLE_PHYSICS.MAX_SAG);
    const spread = this.computeBundleSpread(x1, y1, x2, y2, position, groupSize);
    const vertDrop = Math.max(30, sag * 0.45);

    const cx1 = x1 + spread.x;
    const cy1 = y1 + vertDrop + sag * 0.7 + spread.y;
    const cx2 = x2 + spread.x;
    const cy2 = y2 + vertDrop + sag * 0.7 + spread.y;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  }

  updateCables() {
    if (!this.cablesGroup || !this.plugsGroup || !this.canvasContainer) return;

    this.cablesGroup.innerHTML = '';
    this.plugsGroup.innerHTML = '';

    const connections = this.data.connections || [];
    const containerRect = this.canvasContainer.getBoundingClientRect();

    const pairGroups = new Map();
    connections.forEach((conn, idx) => {
      const pairKey = [conn.from, conn.to].sort().join('<->');
      if (!pairGroups.has(pairKey)) pairGroups.set(pairKey, []);
      pairGroups.get(pairKey).push({ conn, idx });
    });

    pairGroups.forEach((group) => {
      const groupSize = group.length;

      group.forEach(({ conn }, posInGroup) => {
        const pFrom = this.nodePositions.get(conn.from);
        const pTo = this.nodePositions.get(conn.to);
        if (!pFrom || !pTo) return;

        const jackFromEl = (conn.fromPort ? this.canvasContainer.querySelector(`#jack-${conn.from}-${conn.fromPort}`) : null)
                        || this.canvasContainer.querySelector(`#jack-${conn.from}-${conn.type}`);
        const jackToEl   = (conn.toPort ? this.canvasContainer.querySelector(`#jack-${conn.to}-${conn.toPort}`) : null)
                        || this.canvasContainer.querySelector(`#jack-${conn.to}-${conn.type}`);

        let x1 = pFrom.x, y1 = pFrom.y + 40;
        let x2 = pTo.x,   y2 = pTo.y + 40;

        if (jackFromEl) {
          const r = jackFromEl.getBoundingClientRect();
          x1 = r.left - containerRect.left + r.width / 2;
          y1 = r.top - containerRect.top + r.height / 2;
          jackFromEl.classList.add('active');
        }
        if (jackToEl) {
          const r = jackToEl.getBoundingClientRect();
          x2 = r.left - containerRect.left + r.width / 2;
          y2 = r.top - containerRect.top + r.height / 2;
          jackToEl.classList.add('active');
        }

        const pathD = this.calculateCablePath(x1, y1, x2, y2, posInGroup, groupSize);
        const color = SIGNAL_COLORS[conn.type] || '#38bdf8';

        // 1. Path del Cable
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', pathD);
        pathEl.setAttribute('class', 'patch-cable pulse-anim');
        pathEl.setAttribute('stroke', color);
        pathEl.setAttribute('filter', 'url(#cable-shadow)');
        this.cablesGroup.appendChild(pathEl);

        // 2. Plugs / Jacks
        [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach(pt => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', pt.x);
          circle.setAttribute('cy', pt.y);
          circle.setAttribute('r', CABLE_PHYSICS.PLUG_RADIUS);
          circle.setAttribute('class', 'cable-plug');
          circle.setAttribute('stroke', color);
          this.plugsGroup.appendChild(circle);
        });
      });
    });
  }
}
