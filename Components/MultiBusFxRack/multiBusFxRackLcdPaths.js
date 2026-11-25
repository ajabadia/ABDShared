/**
 * ABDShared -- MultiBusFxRack/multiBusFxRackLcdPaths.js
 * Dynamic SVG signal-flow paths for all 10 routing topologies (0..9),
 * branch activity dimming, and bay-to-bay series chain vectors.
 * Strict line limit: < 140 lines. 100% CSS token colors.
 */

/**
 * ABDShared -- MultiBusFxRack/multiBusFxRackLcdPaths.js
 * Visual Topology Flow Diagram & Stage Router.
 * Clean, clear step-by-step routing block diagram on the right half of the LCD.
 * Strict line limit: < 140 lines. 100% CSS token colors.
 */

function box(x, y, label, active = true) {
  const stroke = active ? 'var(--color-accent)' : 'var(--color-panel-border-dim)';
  const bg = active ? 'color-mix(in srgb, var(--color-accent) 18%, var(--color-panel-surface))' : 'var(--color-bg-base)';
  const txtColor = active ? 'var(--color-accent)' : 'var(--color-text-dim)';
  return `
    <rect x="${x}" y="${y}" width="28" height="20" rx="3" fill="${bg}" stroke="${stroke}" stroke-width="1.2"/>
    <text x="${x + 14}" y="${y + 13}" fill="${txtColor}" font-size="8.5" font-weight="900" font-family="var(--font-mono)" text-anchor="middle">${label}</text>
  `;
}

function conn(d, active = true, arrow = true) {
  const stroke = active ? 'var(--color-accent)' : 'var(--color-panel-border-dim)';
  const mark = arrow ? ' marker-end="url(#arrow)"' : '';
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${active ? '1.4' : '1'}" opacity="${active ? '1' : '0.35'}"${mark}/>`;
}

export function buildTopologyPaths(topo, act = [true, true, true, true], chains = [], labels = ['A', 'B', 'C', 'D']) {
  const [a, b, c, d] = act.map(Boolean);
  const [lA, lB, lC, lD] = [labels[0] || 'A', labels[1] || 'B', labels[2] || 'C', labels[3] || 'D'];
  let svg = '<g class="fx-lcd-topo-diagram">';

  // Draw clean, visual mini-stage topology diagrams
  switch (Number(topo)) {
    case 0: // 1 -> 2 -> 3 -> 4
      svg += box(265, 60, lA, a) + conn('M 293 70 L 305 70', a && b)
           + box(305, 60, lB, b) + conn('M 333 70 L 345 70', b && c)
           + box(345, 60, lC, c) + conn('M 373 70 L 385 70', c && d)
           + box(385, 60, lD, d) + conn('M 413 70 L 440 70', d);
      break;

    case 2: // (1 || 2) || (3 || 4)
      svg += box(285, 30, lA, a) + box(285, 55, lB, b)
           + conn('M 313 40 L 330 40 L 330 70 L 440 70', a)
           + conn('M 313 65 L 330 65 L 330 70', b)
           + box(355, 75, lC, c) + box(355, 100, lD, d)
           + conn('M 383 85 L 400 85 L 400 70 L 440 70', c)
           + conn('M 383 110 L 400 110 L 400 70', d);
      break;

    case 3: // 1 || 2 || 3 || 4
      svg += box(300, 26, lA, a) + conn('M 328 36 L 440 70', a)
           + box(300, 56, lB, b) + conn('M 328 66 L 440 70', b)
           + box(300, 86, lC, c) + conn('M 328 96 L 440 70', c)
           + box(300, 116, lD, d) + conn('M 328 126 L 440 70', d);
      break;

    case 4: // (1 -> 2) || (3 -> 4)
      svg += box(275, 40, lA, a) + conn('M 303 50 L 320 50', a && b) + box(320, 40, lB, b) + conn('M 348 50 L 440 70', b)
           + box(275, 85, lC, c) + conn('M 303 95 L 320 95', c && d) + box(320, 85, lD, d) + conn('M 348 95 L 440 70', d);
      break;

    case 5: // 1 -> (2 || 3) -> 4
      svg += box(265, 60, lA, a)
           + conn('M 293 66 L 310 45', a && b) + box(310, 35, lB, b)
           + conn('M 293 74 L 310 95', a && c) + box(310, 85, lC, c)
           + conn('M 338 45 L 355 66', b && d) + conn('M 338 95 L 355 74', c && d)
           + box(355, 60, lD, d) + conn('M 383 70 L 440 70', d);
      break;

    case 6: // (1 || 2) -> (3 || 4)
      svg += box(270, 40, lA, a) + box(270, 85, lB, b)
           + conn('M 298 50 L 320 50', a) + conn('M 298 95 L 320 95', b)
           + conn('M 320 50 L 320 72', a) + conn('M 320 95 L 320 72', b)
           + conn('M 320 68 L 335 50', (a || b) && c) + box(335, 40, lC, c) + conn('M 363 50 L 440 70', c)
           + conn('M 320 76 L 335 95', (a || b) && d) + box(335, 85, lD, d) + conn('M 363 95 L 440 70', d);
      break;

    case 7: // (1 -> 2 -> 3) || 4
      svg += box(265, 42, lA, a) + conn('M 293 52 L 310 52', a && b)
           + box(310, 42, lB, b) + conn('M 338 52 L 355 52', b && c)
           + box(355, 42, lC, c) + conn('M 383 52 L 440 70', c)
           + box(310, 92, lD, d) + conn('M 338 102 L 440 70', d);
      break;

    case 8: // (1 || 2 Avg) -> 3 -> 4
      svg += box(265, 40, lA, a) + box(265, 85, lB, b)
           + conn('M 293 50 L 312 66', a) + conn('M 293 95 L 312 74', b)
           + box(315, 60, lC, c) + conn('M 343 70 L 360 70', c && d)
           + box(360, 60, lD, d) + conn('M 388 70 L 440 70', d);
      break;

    case 9: // 1 -> 2 -> 3 -> 4 (FB)
      svg += box(265, 60, lA, a) + conn('M 293 70 L 305 70', a && b)
           + box(305, 60, lB, b) + conn('M 333 70 L 345 70', b && c)
           + box(345, 60, lC, c) + conn('M 373 70 L 385 70', c && d)
           + box(385, 60, lD, d) + conn('M 413 70 L 440 70', d)
           + `<path d="M 399 60 L 399 24 L 279 24 L 279 60" fill="none" stroke="var(--color-warning)" stroke-width="1.2" stroke-dasharray="3,2" marker-end="url(#arrow-warn)"/>`;
      break;

    default: // 1: (1 || 2) -> 3 -> 4
      svg += box(265, 40, lA, a) + box(265, 85, lB, b)
           + conn('M 293 50 L 315 66', a) + conn('M 293 95 L 315 74', b)
           + box(315, 60, lC, c) + conn('M 343 70 L 360 70', c && d)
           + box(360, 60, lD, d) + conn('M 388 70 L 440 70', d);
      break;
  }

  svg += '</g>';

  let chainSvg = '';
  for (let i = 0; i < Math.min(2, chains.length); i++) {
    const ch = chains[i], y = 14 + i * 16;
    chainSvg += `<rect x="375" y="${y}" width="52" height="13" rx="2" fill="color-mix(in srgb, var(--color-warning) 16%, var(--color-panel-surface))" stroke="var(--color-warning)" stroke-width="0.8"/>`;
    chainSvg += `<text x="401" y="${y + 9.5}" fill="var(--color-warning)" font-size="6.5" font-weight="bold" font-family="var(--font-mono)" text-anchor="middle">B${ch.from + 1}→B${ch.to + 1}</text>`;
  }
  return svg + chainSvg;
}
