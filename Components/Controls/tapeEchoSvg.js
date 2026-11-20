export const TAPE_SYNC_DIVISIONS = ['1/1', '1/2', '1/4', '1/4T', '1/8', '1/8T', '1/16', '1/16T', '1/32'];

export function buildTapeEchoSvg(width, height) {
  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="width: 100%; height: 100%; display: block;">
      <rect id="peak-led" x="2" y="4" width="32" height="17" fill="none" stroke="none" opacity="0" />
      <path id="tape-path" d="M 28 38 Q 60 30 95 42 L 135 42 Q 165 30 192 38" fill="none" stroke="var(--color-text-dim)" stroke-width="2.5" stroke-dasharray="4 3"/>
      <g id="reel-left">
        <circle cx="28" cy="48" r="22" fill="var(--color-bg-base)" stroke="var(--color-border)" stroke-width="1.5"/>
        <circle cx="28" cy="48" r="7" fill="var(--color-panel-surface)" stroke="var(--color-border-subtle)" stroke-width="1"/>
        <circle cx="28" cy="48" r="3" fill="var(--color-text-dim)"/>
        <line x1="28" y1="28" x2="28" y2="68" stroke="var(--color-border)" stroke-width="1.5"/>
        <line x1="8" y1="48" x2="48" y2="48" stroke="var(--color-border)" stroke-width="1.5"/>
        <line x1="14" y1="34" x2="42" y2="62" stroke="var(--color-border)" stroke-width="1.5"/>
        <line x1="14" y1="62" x2="42" y2="34" stroke="var(--color-border)" stroke-width="1.5"/>
      </g>
      <g id="reel-right">
        <circle cx="192" cy="48" r="22" fill="var(--color-bg-base)" stroke="var(--color-border)" stroke-width="1.5"/>
        <circle cx="192" cy="48" r="7" fill="var(--color-panel-surface)" stroke="var(--color-border-subtle)" stroke-width="1"/>
        <circle cx="192" cy="48" r="3" fill="var(--color-text-dim)"/>
        <line x1="192" y1="28" x2="192" y2="68" stroke="var(--color-border)" stroke-width="1.5"/>
        <line x1="172" y1="48" x2="212" y2="48" stroke="var(--color-border)" stroke-width="1.5"/>
        <line x1="178" y1="34" x2="206" y2="62" stroke="var(--color-border)" stroke-width="1.5"/>
        <line x1="178" y1="62" x2="206" y2="34" stroke="var(--color-border)" stroke-width="1.5"/>
      </g>
      <g id="playback-heads">
        <rect x="103" y="26" width="24" height="24" rx="2" fill="var(--color-panel-bg)" stroke="var(--color-border-subtle)" stroke-width="1" class="heads-bezel"/>
        <rect id="head-h1" x="107" y="30" width="5" height="16" rx="1" fill="var(--color-text-dim)" stroke="var(--color-border)" stroke-width="0.5"/>
        <rect id="head-h2" x="115" y="30" width="5" height="16" rx="1" fill="var(--color-text-dim)" stroke="var(--color-border)" stroke-width="0.5"/>
        <rect id="head-h3" x="123" y="30" width="5" height="16" rx="1" fill="var(--color-text-dim)" stroke="var(--color-border)" stroke-width="0.5"/>
        <text x="115" y="58" text-anchor="middle" fill="var(--color-text-dim)" font-family="monospace" font-size="6">H1 H2 H3</text>
      </g>
      <circle id="capstan" cx="152" cy="48" r="5" fill="var(--color-panel-surface)" stroke="var(--color-text-dim)" stroke-width="1"/>
      <circle cx="162" cy="48" r="3.5" fill="var(--color-panel-bg)" stroke="var(--color-border)" stroke-width="0.8"/>
      <circle cx="52" cy="42" r="3" fill="var(--color-panel-bg)" stroke="var(--color-border)" stroke-width="0.8"/>
      <circle cx="170" cy="42" r="3" fill="var(--color-panel-bg)" stroke="var(--color-border)" stroke-width="0.8"/>
      <text x="110" y="78" text-anchor="middle" fill="var(--color-text-dim)" font-family="Microgramma, monospace" font-size="8" letter-spacing="3">TAPE ECHO</text>
      <text id="svg-sync-indicator" x="115" y="20" text-anchor="middle" fill="var(--color-text-dim)" font-family="Microgramma, monospace" font-size="6" letter-spacing="1" class="svg-sync-hidden">SYNC 1/4</text>
      <text id="svg-bpm-indicator" x="${width - 28}" y="${height - 2}" text-anchor="end" fill="var(--color-text-dim)" font-family="Microgramma, monospace" font-size="7" letter-spacing="2" class="svg-bpm-hidden"></text>
    </svg>
  `;
}
