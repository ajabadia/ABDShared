import { describe, it, expect, vi } from 'vitest';
import { renderSafeCopilotMarkdown } from '../Components/CopilotShell/copilotMarkdown.js';
import { highlightUiTarget, clearUiHighlight } from '../Components/CopilotShell/uiSpotlight.js';
import { CopilotShell } from '../Components/CopilotShell/CopilotShell.js';
import { AiProviderSettingsPanel } from '../Components/CopilotShell/AiProviderSettingsPanel.js';
import { UnifiedAiSettingsPanel } from '../Components/CopilotShell/UnifiedAiSettingsPanel.js';
import { CloudByokClient } from '../Code/AiCore/CloudByokClient.js';

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

  it('AiProviderSettingsPanel writes API keys into the matching provider keyField', () => {
    const container = document.createElement('div');
    const byokClient = new CloudByokClient();
    byokClient.clearConfig();

    new AiProviderSettingsPanel({ container, byokClient });

    const provSel = container.querySelector('#ai-byok-provider');
    const keyInput = container.querySelector('#ai-byok-key');
    provSel.value = 'claude';
    keyInput.value = 'sk-ant-test-key';

    container.querySelector('#btn-ai-save-settings')?.dispatchEvent(new Event('click'));
    expect(byokClient.getActiveApiKey('claude')).toBe('sk-ant-test-key');
  });

  it('UnifiedAiSettingsPanel enforces PRÓXIMAMENTE disabled state, unused provider dimming, and custom model folder creation', async () => {
    const container = document.createElement('div');
    const setWorkdirSpy = vi.fn(async (nextPath) => ({
      ok: true,
      workdir: {
        models_root: nextPath,
        source: 'custom',
        exists: true,
        writable: true,
        free_gb: 120.5,
      },
      models: [
        {
          id: 'htdemucs',
          name: 'HT-Demucs v4',
          filename: 'htdemucs_f7e0c4bc.th',
          default_url: 'https://example.com/ht.th',
          url: 'https://example.com/ht.th',
          size_mb: 80.2,
          used_by: ['abdneumodmakr'],
          inference_wired: false,
          coming_soon: true,
          supported_in_app: false,
          installed: false,
          folder_path: `${nextPath}/htdemucs`,
          description_es: 'Stems',
          description_en: 'Stems',
        },
      ],
    }));

    const panel = new UnifiedAiSettingsPanel({
      container,
      appId: 'abdaudiolab',
      locale: 'es',
      supportedByokCapabilities: ['text'],
      tasksConfig: { enabled: true, tasks: { nonlinearModeling: 'deterministic-dsp' } },
      taskDescriptors: [
        {
          id: 'nonlinearModeling',
          title: 'Modelado No Lineal',
          options: [
            { value: 'deterministic-dsp', label: 'DSP Puro', comingSoon: false },
            { value: 'python-local-rtneural', label: 'Entrenamiento RTNeural', comingSoon: true },
          ],
        },
      ],
      modelStoreBridge: {
        getStatus: async () => ({
          workdir: { models_root: 'D:/Default/Models', source: 'dev_resources', exists: true, writable: true },
          models: [],
        }),
        setWorkdir: setWorkdirSpy,
        downloadModel: async () => ({ ok: true }),
        deleteModel: async () => ({ ok: true }),
      },
    });

    // 1. Task tab checks: comingSoon option must be disabled and badged
    const soonRadio = container.querySelector('input[value="python-local-rtneural"]');
    expect(soonRadio?.disabled).toBe(true);
    expect(container.textContent).toContain('PRÓXIMAMENTE');

    // 2. Cloud BYOK tab: Replicate should render dimmed with "No usado en esta app"
    panel.setActiveTab('cloud-byok');
    expect(container.textContent).toContain('No usado en esta app');
    const replicateInput = container.querySelector('#abd-byok-key-replicate');
    expect(replicateInput?.disabled).toBe(true);

    // 3. Local Models tab: saving custom folder path invokes setWorkdir and displays catalog badges
    panel.setActiveTab('local-models');
    const pathInput = container.querySelector('#abd-ai-workdir-input');
    expect(pathInput).not.toBeNull();
    pathInput.value = 'D:/Custom/AIModels';
    container.querySelector('#abd-ai-workdir-save')?.dispatchEvent(new Event('click'));

    await vi.waitFor(() => {
      expect(setWorkdirSpy).toHaveBeenCalledWith('D:/Custom/AIModels');
    });
    expect(container.textContent).toContain('HT-Demucs v4');
    expect(container.textContent).toContain('abdneumodmakr');

    panel.destroy();
  });

  it('UnifiedAiSettingsPanel supports English localization and live setLocale switching without Spanish leaks', async () => {
    const container = document.createElement('div');
    const panel = new UnifiedAiSettingsPanel({
      container,
      appId: 'abdaudiolab',
      locale: 'en',
      supportedByokCapabilities: ['text'],
      tasksConfig: { enabled: true, tasks: { nonlinearModeling: 'deterministic-dsp' } },
      taskDescriptors: [
        {
          id: 'nonlinearModeling',
          title: 'Non-Linear Modeling',
          options: [
            { value: 'deterministic-dsp', label: 'Pure DSP', comingSoon: false },
            { value: 'python-local-rtneural', label: 'RTNeural Training', comingSoon: true },
          ],
        },
      ],
      modelStoreBridge: {
        getStatus: async () => ({
          workdir: { models_root: 'D:/Default/Models', source: 'custom', exists: true, writable: true, free_gb: 42.5 },
          models: [
            {
              id: 'htdemucs',
              name: 'HT-Demucs v4',
              filename: 'htdemucs_f7e0c4bc.th',
              size_mb: 80.2,
              used_by: ['abdneumodmakr'],
              inference_wired: false,
              coming_soon: true,
              supported_in_app: false,
              installed: false,
              folder_path: 'D:/Default/Models/htdemucs',
              description_es: 'Separación de stems',
              description_en: 'Audio stem separation',
            },
          ],
        }),
      },
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Local models: 0/1');
    });

    expect(container.textContent).toContain('AI Tasks & Routing');
    expect(container.textContent).toContain('Pure DSP');
    expect(container.textContent).not.toContain('deterministic-dsp');
    expect(container.textContent).toContain('COMING SOON');
    expect(container.textContent).not.toContain('PRÓXIMAMENTE');

    panel.setActiveTab('cloud-byok');
    expect(container.textContent).toContain('Not used in this app');
    expect(container.textContent).toContain('(text, image)');

    panel.setActiveTab('local-models');
    expect(container.textContent).toContain('42.5 GB free');
    expect(container.textContent).not.toContain('GB libre');
    expect(container.textContent).toContain('Audio stem separation');
    expect(container.textContent).toContain('abdneumodmakr');

    panel.setLocale('es');
    expect(container.textContent).toContain('42.5 GB libres');
    expect(container.textContent).toContain('Modelos Locales & Carpeta');

    panel.destroy();
  });
});
