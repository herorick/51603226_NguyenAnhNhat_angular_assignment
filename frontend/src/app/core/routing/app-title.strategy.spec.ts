import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { APP_NAME, AppTitleStrategy } from './app-title.strategy';

describe('AppTitleStrategy', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'expenses/new', title: 'Add expense', children: [] },
          { path: 'monthly-plans', title: 'All months', children: [{ path: ':year', title: 'Year', children: [] }] },
          { path: 'untitled', children: [] }
        ]),
        { provide: TitleStrategy, useClass: AppTitleStrategy }
      ]
    });
  });

  const navigate = async (url: string): Promise<string> => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Title).getTitle();
  };

  it('uses the app name constant', () => {
    expect(APP_NAME).toBe('Family Finance');
  });

  it('suffixes the route title with the app name', async () => {
    expect(await navigate('/expenses/new')).toBe('Add expense · Family Finance');
    expect(document.title).toBe('Add expense · Family Finance');
  });

  it('uses the deepest route title', async () => {
    expect(await navigate('/monthly-plans/2026')).toBe('Year · Family Finance');
  });

  it('falls back to the bare app name when the route has no title', async () => {
    expect(await navigate('/untitled')).toBe('Family Finance');
  });

  it('updates the title on every navigation', async () => {
    const harness = await RouterTestingHarness.create();
    const title = TestBed.inject(Title);

    await harness.navigateByUrl('/expenses/new');
    expect(title.getTitle()).toBe('Add expense · Family Finance');

    await harness.navigateByUrl('/untitled');
    expect(title.getTitle()).toBe('Family Finance');
  });
});
