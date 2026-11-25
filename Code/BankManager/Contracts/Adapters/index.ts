/**
 * Adapters barrel — concrete Import/Export/HardwareLink adapters.
 */

export { RolandJunoImportAdapter, RolandJunoExportAdapter, RolandJunoHardwareLink } from './rolandJunoAdapter';
export { KorgMs2000ImportAdapter, KorgMs2000ExportAdapter, KorgMs2000HardwareLink } from './korgMs2000Adapter';
export { YamahaDx7ImportAdapter, YamahaDx7ExportAdapter, YamahaDx7HardwareLink } from './yamahaDx7Adapter';
export { CasioCzImportAdapter, CasioCzExportAdapter, CasioCzHardwareLink } from './casioCzAdapter';
export { BehringerDm12ImportAdapter, BehringerDm12ExportAdapter, BehringerDm12HardwareLink } from './behringerDm12Adapter';
export { BehringerPro800ImportAdapter, BehringerPro800ExportAdapter, BehringerPro800HardwareLink } from './behringerPro800Adapter';
export { BehringerDm12HardwareLink as BehringerDeepMind12HardwareLink } from './behringerDm12Adapter';
export { RolandAiraImportAdapter, RolandAiraExportAdapter, RolandAiraHardwareLink } from './rolandAiraAdapter';
export { RolandD50ImportAdapter, RolandD50ExportAdapter, RolandD50HardwareLink } from './rolandD50Adapter';
export { RolandCm32ImportAdapter, RolandCm32ExportAdapter, RolandCm32HardwareLink } from './rolandCm32Adapter';
export {
  JsonContractImportAdapter,
  JsonContractExportAdapter,
  JsonContractHardwareLink,
  allJsonImportAdapters,
  allJsonExportAdapters,
  allJsonHardwareLinks,
} from './jsonContractAdapter';

import { RolandJunoImportAdapter, RolandJunoExportAdapter, RolandJunoHardwareLink } from './rolandJunoAdapter';
import { KorgMs2000ImportAdapter, KorgMs2000ExportAdapter, KorgMs2000HardwareLink } from './korgMs2000Adapter';
import { YamahaDx7ImportAdapter, YamahaDx7ExportAdapter, YamahaDx7HardwareLink } from './yamahaDx7Adapter';
import { CasioCzImportAdapter, CasioCzExportAdapter, CasioCzHardwareLink } from './casioCzAdapter';
import { BehringerDm12ImportAdapter, BehringerDm12ExportAdapter, BehringerDm12HardwareLink } from './behringerDm12Adapter';
import { BehringerPro800ImportAdapter, BehringerPro800ExportAdapter, BehringerPro800HardwareLink } from './behringerPro800Adapter';
import { RolandAiraImportAdapter, RolandAiraExportAdapter, RolandAiraHardwareLink } from './rolandAiraAdapter';
import { RolandD50ImportAdapter, RolandD50ExportAdapter, RolandD50HardwareLink } from './rolandD50Adapter';
import { RolandCm32ImportAdapter, RolandCm32ExportAdapter, RolandCm32HardwareLink } from './rolandCm32Adapter';
import { allJsonImportAdapters, allJsonExportAdapters } from './jsonContractAdapter';
import type { ImportAdapter } from '../ImportAdapter';
import type { ExportAdapter } from '../ExportAdapter';
import type { HardwareLinkContract } from '../HardwareLinkContract';

export const allImportAdapters: ImportAdapter[] = [
  new RolandAiraImportAdapter(),
  new RolandJunoImportAdapter(),
  new KorgMs2000ImportAdapter(),
  new YamahaDx7ImportAdapter(),
  new CasioCzImportAdapter(),
  new BehringerDm12ImportAdapter(),
  new BehringerPro800ImportAdapter(),
  new RolandD50ImportAdapter(),
  new RolandCm32ImportAdapter()
];

export const allExportAdapters: ExportAdapter[] = [
  new RolandAiraExportAdapter(),
  new RolandJunoExportAdapter(),
  new KorgMs2000ExportAdapter(),
  new YamahaDx7ExportAdapter(),
  new CasioCzExportAdapter(),
  new BehringerDm12ExportAdapter(),
  new BehringerPro800ExportAdapter(),
  new RolandD50ExportAdapter(),
  new RolandCm32ExportAdapter()
];

export const allHardwareLinks: HardwareLinkContract[] = [
  new RolandAiraHardwareLink(),
  new RolandJunoHardwareLink(),
  new KorgMs2000HardwareLink(),
  new YamahaDx7HardwareLink(),
  new CasioCzHardwareLink(),
  new BehringerDm12HardwareLink(),
  new BehringerPro800HardwareLink(),
  new RolandD50HardwareLink(),
  new RolandCm32HardwareLink()
];

export function getImportAdapter(modelId: string): ImportAdapter | undefined {
  return allImportAdapters.find(adapter => adapter.targetModelIds.includes(modelId))
    ?? allJsonImportAdapters.find(adapter => adapter.targetModelIds.includes(modelId));
}

export function getExportAdapter(modelId: string): ExportAdapter | undefined {
  return allExportAdapters.find(adapter => adapter.targetModelIds.includes(modelId))
    ?? allJsonExportAdapters.find(adapter => adapter.targetModelIds.includes(modelId));
}
