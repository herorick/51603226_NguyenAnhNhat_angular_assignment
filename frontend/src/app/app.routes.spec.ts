import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';

describe('routes', () => {
  it('defines the application navigation routes', () => {
    expect(routes).toEqual([
      expect.objectContaining({ path: '', redirectTo: 'dashboard' }),
      expect.objectContaining({ path: 'dashboard' }),
      expect.objectContaining({ path: 'monthly-planning' }),
      expect.objectContaining({ path: 'monthly-plans/:year/:month' }),
      expect.objectContaining({ path: 'expenses/new' }),
      expect.objectContaining({ path: '**', redirectTo: 'monthly-planning' })
    ]);
  });
});
