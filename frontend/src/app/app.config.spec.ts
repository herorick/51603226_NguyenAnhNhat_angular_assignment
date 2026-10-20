import { describe, expect, it } from 'vitest';

import { appConfig } from './app.config';

describe('appConfig', () => {
  it('registers application providers', () => {
    expect(appConfig.providers).toBeDefined();
    expect(appConfig.providers?.length).toBeGreaterThan(0);
  });
});
