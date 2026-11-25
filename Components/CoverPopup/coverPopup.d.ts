/**
 * ABDShared — Components/CoverPopup/coverPopup.d.ts
 * TypeScript definitions for the canonical CoverPopup hover preview and lightbox modal.
 * Strictly < 200 lines.
 */

export interface CoverArtOptions {
  coverHtml?: string;
  coverUrl?: string;
  title?: string;
  fallbackSvg?: string;
  size?: number;
  width?: number;
  height?: number;
  accentToken?: string;
  fit?: 'cover' | 'contain';
}

export interface CoverPopupSecondaryCard {
  title: string;
  subtitle?: string;
  coverHtml?: string;
  coverUrl?: string;
  fallbackSvg?: string;
  accentToken?: string;
  fit?: 'cover' | 'contain';
  size?: number;
  width?: number;
  height?: number;
}

export interface CoverPopupPrimaryAction {
  label: string;
  onClick: () => void;
}

export interface CoverPopupData {
  title: string;
  modalTitle?: string;
  subtitle?: string;
  category?: string;
  badge?: string;
  description?: string;
  extraDescription?: string;
  filename?: string;
  pills?: string[];
  metaRows?: Array<{ k: string; v: string } | [string, string]>;
  coverHtml?: string;
  modalCoverHtml?: string;
  coverUrl?: string;
  fallbackSvg?: string;
  accentToken?: string;
  fit?: 'cover' | 'contain';
  hoverSize?: number;
  hoverWidth?: number;
  hoverHeight?: number;
  modalSize?: number;
  modalWidth?: number;
  modalHeight?: number;
  secondaryCard?: CoverPopupSecondaryCard;
  primaryAction?: CoverPopupPrimaryAction;
  popoverClass?: string;
  backdropClass?: string;
  modalClass?: string;
  closeAct?: string;
  closeLabel?: string;
}

export interface AttachCoverPopupOptions {
  hover?: boolean;
  click?: boolean;
  stopPropagation?: boolean;
  onClick?: (data: CoverPopupData, ev: Event) => void;
}

export declare function renderCoverArtHtml(opts?: CoverArtOptions): string;
export declare function showCoverHoverPopover(anchorEl: HTMLElement | null, data: CoverPopupData | null | undefined): HTMLElement | null;
export declare function hideCoverHoverPopover(): void;
export declare function openCoverModal(data: CoverPopupData | null | undefined): HTMLElement | null;
export declare function closeCoverModal(): void;
export declare function closeAllCoverPopups(): void;
export declare function attachCoverPopup(
  el: HTMLElement | null,
  getDataFn: () => CoverPopupData | null | undefined,
  options?: AttachCoverPopupOptions
): () => void;
