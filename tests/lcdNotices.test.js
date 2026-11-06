import { describe, it, expect } from 'vitest';
import { buildWriteCompletedNotice } from '../Components/index.js';

describe('ABDShared LCD notices (shared wording)', () => {
  it('is exported by the package barrel', () => {
    expect(typeof buildWriteCompletedNotice).toBe('function');
  });

  it('announces a write without knowing the program', () => {
    expect(buildWriteCompletedNotice()).toEqual({
      line1: 'WRITE COMPLETED',
      line2: 'PATCH SAVED',
    });
  });

  it('announces a write with program id and name', () => {
    expect(buildWriteCompletedNotice({ programId: 'A.01', programName: 'Stab Saw' })).toEqual({
      line1: 'WRITE COMPLETED',
      line2: 'SAVED TO A.01 (Stab Saw)',
    });
  });

  it('drops empty id and blank name instead of printing gaps', () => {
    expect(buildWriteCompletedNotice({ programId: 'C.07', programName: '  ' }).line2).toBe('SAVED TO C.07');
    expect(buildWriteCompletedNotice({ programId: '  ', programName: 'Pad' }).line2).toBe('PATCH SAVED');
    expect(buildWriteCompletedNotice({ programId: null, programName: null }).line2).toBe('PATCH SAVED');
  });
});
