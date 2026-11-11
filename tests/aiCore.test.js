import { describe, it, expect, beforeEach } from 'vitest';
import {
  assertSafeLoopbackHttpUrl,
  assertSafeExternalHttpsUrl,
  redactUrlForLog,
  parseJsonObjectSafe,
  computeCanonicalAiHudStatus,
  searchKnowledgeBase,
  CopilotOrchestrator,
  LocalLlmClient,
  CloudByokClient,
} from '../Code/AiCore/index.ts';

describe('ABDShared AiCore Suite', () => {
  describe('SSRF & URL validation', () => {
    it('assertSafeLoopbackHttpUrl accepts valid local endpoints and blocks unsafe hosts', () => {
      expect(assertSafeLoopbackHttpUrl('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434');
      expect(assertSafeLoopbackHttpUrl('http://localhost:1234')).toBe('http://localhost:1234');
      expect(assertSafeLoopbackHttpUrl('http://127.0.0.1:8080/foo/bar')).toBe('http://127.0.0.1:8080');

      // Reject non-http
      expect(() => assertSafeLoopbackHttpUrl('https://127.0.0.1:11434')).toThrow(/Only HTTP is allowed/);
      // Reject external / lan
      expect(() => assertSafeLoopbackHttpUrl('http://192.168.1.10:11434')).toThrow(/Only 127.0.0.1 or localhost/);
      expect(() => assertSafeLoopbackHttpUrl('http://api.openai.com:11434')).toThrow(/Only 127.0.0.1 or localhost/);
      // Reject forbidden ports
      expect(() => assertSafeLoopbackHttpUrl('http://127.0.0.1:9099')).toThrow(/Port 9099 is not in allowed/);
      // Reject credentials
      expect(() => assertSafeLoopbackHttpUrl('http://user:pass@127.0.0.1:11434')).toThrow(/Credentials/);
    });

    it('assertSafeExternalHttpsUrl validates https and blocks private networks', () => {
      expect(assertSafeExternalHttpsUrl('https://api.openai.com/v1/chat')).toBe('https://api.openai.com/v1/chat');
      expect(() => assertSafeExternalHttpsUrl('http://api.openai.com')).toThrow(/Only HTTPS/);
      expect(() => assertSafeExternalHttpsUrl('https://127.0.0.1/evil')).toThrow(/Blocked unsafe/);
      expect(() => assertSafeExternalHttpsUrl('https://192.168.1.1')).toThrow(/Blocked unsafe/);
    });

    it('redactUrlForLog removes sensitive query parameters and fragments', () => {
      expect(redactUrlForLog('https://generativelanguage.googleapis.com/v1/models?key=AIzaSySecret123#frag')).toBe(
        'https://generativelanguage.googleapis.com/v1/models'
      );
    });
  });

  describe('JSON parsing defensiveness', () => {
    it('parseJsonObjectSafe handles raw JSON, markdown fences, and embedded objects', () => {
      expect(parseJsonObjectSafe('{"ok": true}')).toEqual({ ok: true });
      expect(parseJsonObjectSafe('```json\n{"action": "test"}\n```')).toEqual({ action: 'test' });
      expect(parseJsonObjectSafe('Leading text {"num": 42} trailing text')).toEqual({ num: 42 });
      expect(parseJsonObjectSafe('invalid [1, 2, 3]')).toBeNull();
      expect(parseJsonObjectSafe('')).toBeNull();
    });
  });

  describe('Knowledge Base BM25 search', () => {
    const articles = [
      {
        id: 'bucle',
        title: 'Expansión de bucles cortos y armónicos',
        tags: ['loop', 'sustain', 'bwe'],
        whatItMeans: 'Desenrolla bucles cortos sin zumbidos.',
        howToFixSteps: ['Ajustar crossfade', 'Usar zero crossing'],
      },
      {
        id: 'cobertura',
        title: 'Reparación de cobertura MIDI',
        tags: ['midi', 'zones', 'gaps'],
        whatItMeans: 'Soluciona huecos en 0..127.',
        howToFixSteps: ['Pulsar auto-reparar'],
      },
    ];

    it('finds articles ignoring accents and diacritics', () => {
      const res = searchKnowledgeBase(articles, 'armonicos');
      expect(res.length).toBeGreaterThan(0);
      expect(res[0].id).toBe('bucle');

      const res2 = searchKnowledgeBase(articles, 'HUECOS');
      expect(res2.length).toBeGreaterThan(0);
      expect(res2[0].id).toBe('cobertura');
    });
  });

  describe('Canonical AI HUD status', () => {
    it('derives accurate honest badge states', () => {
      expect(
        computeCanonicalAiHudStatus({
          enabled: false,
          activeTasksCount: 0,
          totalTasksCount: 5,
          localConnected: false,
          cloudConfigured: false,
        }).badgeText
      ).toBe('100% DETERMINISTA');

      expect(
        computeCanonicalAiHudStatus({
          enabled: true,
          activeTasksCount: 2,
          totalTasksCount: 5,
          localConnected: true,
          localEngineLabel: 'Ollama',
          cloudConfigured: false,
        }).badgeText
      ).toBe('IA LOCAL (2/5)');

      expect(
        computeCanonicalAiHudStatus({
          enabled: true,
          activeTasksCount: 3,
          totalTasksCount: 5,
          localConnected: true,
          cloudConfigured: true,
        }).badgeText
      ).toBe('HIBRIDO IA (3/5)');
    });
  });

  describe('CopilotOrchestrator validation', () => {
    let orchestrator;
    const dummyTool = {
      name: 'setFilter',
      description: 'Sets filter cutoff',
      params: {
        cutoffHz: { type: 'number', required: true, min: 20, max: 20000 },
        type: { type: 'string', required: true, enumValues: ['lpf', 'hpf'] },
      },
      execute: async () => ({ ok: true, summary: 'Filter set' }),
    };

    beforeEach(() => {
      const local = new LocalLlmClient();
      const cloud = new CloudByokClient();
      orchestrator = new CopilotOrchestrator(local, cloud);
      orchestrator.registerTool(dummyTool);
    });

    it('validateToolArguments strictly enforces parameter bounds and enums', () => {
      // Valid args
      const valid = orchestrator.validateToolArguments(dummyTool, { cutoffHz: 1000, type: 'lpf' });
      expect(valid.valid).toBe(true);
      expect(valid.sanitizedArgs).toEqual({ cutoffHz: 1000, type: 'lpf' });

      // Out of range
      const outOfRange = orchestrator.validateToolArguments(dummyTool, { cutoffHz: 50000, type: 'lpf' });
      expect(outOfRange.valid).toBe(false);

      // Invalid enum
      const badEnum = orchestrator.validateToolArguments(dummyTool, { cutoffHz: 1000, type: 'bandpass' });
      expect(badEnum.valid).toBe(false);

      // Missing required
      const missing = orchestrator.validateToolArguments(dummyTool, { cutoffHz: 1000 });
      expect(missing.valid).toBe(false);
    });
  });
});
