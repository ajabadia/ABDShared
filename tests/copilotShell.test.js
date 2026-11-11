import { describe, it, expect, vi } from 'vitest';
import { renderSafeCopilotMarkdown } from '../Components/CopilotShell/copilotMarkdown.js';
import { highlightUiTarget, clearUiHighlight } from '../Components/CopilotShell/uiSpotlight.js';
import { CopilotShell } from '../Components/CopilotShell/CopilotShell.js';
import { AiProviderSettingsPanel } from '../Components/CopilotShell/AiProviderSettingsPanel.js';

describe('CopilotShell UI Components', () => {
  it('renderSafeCopilotMarkdown sanitizes raw HTML and renders markdown links/code safely', () => {
    const raw = '<script>alert("xss")</script> **Texto negrita** [Mi Link](https://abdsynths.com) `codigo`';
    const html = renderSafeCopilotMarkdown(raw);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<strong>Texto negrita</strong>');
    expect(html).toContain('<a href="https://abdsynths.com" target="_blank" rel="noopener noreferrer">Mi Link</a>');
    expect(html).toContain('<code class="abd-copilot-code-inline">codigo</code>');
  });

  it('renders spot chip buttons for [spot:targetId|Label]', () => {
    const raw = 'Mira la seccion [spot:zone-inspector|Inspector de Zonas] para detalles.';
    const html = renderSafeCopilotMarkdown(raw);
    expect(html).toContain('class="abd-copilot-spot-chip"');
    expect(html).toContain('data-spot-target="zone-inspector"');
    expect(html).toContain('Inspector de Zonas');
  });

  it('CopilotShell initializes DOM and switches tabs correctly', () => {
    const container = document.createElement('div');
    const shell = new CopilotShell({
      container,
      kbArticles: [
        { id: '1', title: 'Como exportar SFZ', content: 'Para exportar a SFZ debes ir a la barra superior.', keywords: ['sfz', 'exportar'] }
      ]
    });

    expect(container.querySelector('#abd-copilot-panel')).not.toBeNull();
    expect(container.querySelector('#copilot-btn-send')).not.toBeNull();

    // Initial tab
    expect(shell.activeTab).toBe('assistant');

    // Switch to manual
    shell.setActiveTab('manual');
    expect(shell.activeTab).toBe('manual');
    expect(container.querySelector('#abd-copilot-tab-manual')?.classList.contains('is-hidden')).toBe(false);
    expect(container.querySelector('#abd-copilot-tab-assistant')?.classList.contains('is-hidden')).toBe(true);

    // Manual search
    shell.searchManual('sfz');
    const results = container.querySelector('#copilot-manual-results');
    expect(results?.innerHTML).toContain('Como exportar SFZ');
  });

  it('AiProviderSettingsPanel renders and updates configuration', () => {
    const container = document.createElement('div');
    let saved = null;
    const panel = new AiProviderSettingsPanel({
      container,
      onSave: (cfg) => { saved = cfg; }
    });

    expect(container.querySelector('#ai-local-provider')).not.toBeNull();
    expect(container.querySelector('#ai-byok-provider')).not.toBeNull();

    const saveBtn = container.querySelector('#btn-ai-save-settings');
    saveBtn?.dispatchEvent(new Event('click'));
    expect(saved).not.toBeNull();
  });
});
