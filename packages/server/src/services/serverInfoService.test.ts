import { describe, expect, it } from 'vitest';
import { serverInfoSchema } from '@ottlib/shared';
import { ServerInfoService } from './serverInfoService.js';

describe('ServerInfoService', () => {
  it('carries findHandoff: null by default', () => {
    const info = new ServerInfoService(3000).get();
    expect(serverInfoSchema.parse(info)).toMatchObject({ port: 3000, authRequired: false, findHandoff: null });
  });

  it('carries findHandoff: hashlark in Hashlark mode', () => {
    const info = new ServerInfoService(3000, () => true, () => 'hashlark').get();
    expect(serverInfoSchema.parse(info)).toMatchObject({ authRequired: true, findHandoff: 'hashlark' });
  });
});
