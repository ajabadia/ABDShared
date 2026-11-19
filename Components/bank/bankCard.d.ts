export interface BankCardAction {
  id: string;
  label: string;
  kind?: 'primary' | 'export';
  title?: string;
  iconHtml?: string;
}

export interface BankCardData {
  slot: string | number;
  id?: string | number;
  slotLabel?: string;
  catClass?: string;
  catLabel?: string;
  paramId?: number;
  name?: string;
  title?: string;
  iconHtml?: string;
  thumbnailUrl?: string;
  badges?: string[];
  actions?: BankCardAction[];
  selected?: boolean;
  isFavorite?: boolean;
  hasAudition?: boolean;
  extraClass?: string;
}

export function bankCardHtml(card: BankCardData): string;

export function bindBankCards(
  container: HTMLElement,
  handlers?: {
    onCardClick?: (slot: number, id: string) => void;
    onCardDblClick?: (slot: number, id: string) => void;
    onAction?: (info: { slot: number; id: string; action: string }) => void;
    onAudition?: (info: { slot: number; id: string }) => void;
    onFavorite?: (info: { slot: number; id: string; button: HTMLElement }) => void;
  }
): () => void;
