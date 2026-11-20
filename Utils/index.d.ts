// ─────────────────────────────────────────────────────────
// @abdsynths/shared — Utils type definitions
// ─────────────────────────────────────────────────────────

export function escText(s: unknown): string;
export function escAttr(s: unknown): string;
export function escHtml(s: unknown): string;
export function escapeHtml(s: unknown): string;
export function clamp01(v: unknown, fallback?: number): number;

export function enhanceRangeInputs(
  root?: ParentNode | null,
  options?: Record<string, unknown>
): void;
export function destroyEnhancedRangeInputs(root?: ParentNode | null): void;

export interface QuarantineVerdict {
  readonly retenido: boolean;
  readonly motivo: string | null;
  readonly faltaMotivo: boolean;
}

export interface QuarantineRule {
  readonly campoEstado: string;
  readonly valorEstado: string;
  readonly campoMotivo: string;
  readonly motivoPorDefecto?: string;
}

export const POLITICA: Readonly<QuarantineRule>;
export const POLITICAS: readonly QuarantineRule[];

export function veredicto(contrato: unknown): QuarantineVerdict;
export function esRetenido(contrato: unknown): boolean;
export function motivoDe(contrato: unknown): string | null;
export function motivoParaMostrar(contrato: unknown): string | null;
export function auditar(nombre: string, contrato: unknown): string[];
export function estadosDeclaradosPorElEsquema(esquema: unknown): string[] | null;
export function esquemaAplica(esquema: unknown): boolean;
export function ningunEsquemaAplica(esquemas: readonly unknown[]): boolean;
export function comprobarContraElEsquema(esquema: unknown): string[];
export function contratoDerivaIgual(derivadas: unknown): string[];
