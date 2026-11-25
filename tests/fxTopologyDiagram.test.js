// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { FxTopologyDiagram, renderTopologySvg } from '../Components/MultiBusFxRack/FxTopologyDiagram.js';
import { TOPOLOGIES } from '../Components/MultiBusFxRack/multiBusFxRegistry.js';

describe('FxTopologyDiagram (ABDShared component)', () => {
  it('renders all 10 topologies without errors', () => {
    for (let i = 0; i < 10; i++) {
      const svg = renderTopologySvg(i, {
        slotActivity: [true, true, true, true],
        labels: ['1', '2', '3', '4'],
      });
      expect(svg).toContain('<svg');
      expect(svg).toContain('class="fx-topology-svg"');
      expect(svg).toContain('LIMITER');
      expect(svg).toContain('∑</text>');
    }
  });

  it('mounts into DOM container and updates dynamically', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const diagram = new FxTopologyDiagram(container, {
      topology: 0,
      labels: ['1', '2', '3', '4'],
    });

    expect(container.querySelector('.fx-topology-card')).toBeTruthy();
    expect(container.querySelector('.fx-topology-card-header')?.textContent).toContain('SERIES');

    // Switch to topology 1 (Parallel Pairs)
    diagram.setTopology(1);
    expect(container.querySelector('.fx-topology-card-header')?.textContent).toContain('PARALLEL PAIRS');
    expect(container.querySelector('.fx-topo-notation')?.textContent).toContain('(1||2) -> 3 -> 4');

    // Update slot activity
    diagram.setSlotActivity([true, false, true, true]);
    expect(diagram.slotActivity).toEqual([true, false, true, true]);

    container.remove();
  });

  it('provides identical literal nomenclature matching ABDEep', () => {
    expect(TOPOLOGIES[0].label).toBe('Series');
    expect(TOPOLOGIES[1].label).toBe('Parallel Pairs');
    expect(TOPOLOGIES[2].label).toBe('Series Chain');
    expect(TOPOLOGIES[3].label).toBe('Full Parallel');
    expect(TOPOLOGIES[4].label).toBe('Dual Series Parallel');
    expect(TOPOLOGIES[5].label).toBe('Series Split Mid');
    expect(TOPOLOGIES[6].label).toBe('Parallel Pairs Series');
    expect(TOPOLOGIES[7].label).toBe('Series Chain + Parallel');
    expect(TOPOLOGIES[8].label).toBe('Parallel Front Series');
    expect(TOPOLOGIES[9].label).toBe('Series with Feedback');
  });
});
