import { describe, expect, it } from 'vitest';

import { JarType } from '../../models/budget-plan.models';
import { DEFAULT_JARS_FIXTURE, MONTHLY_PLAN_FIXTURE } from '../../testing/fixtures';
import { JAR_COLOR_TOKEN, jarColor } from './jar-colors';

const EXPECTED_TOKENS: Record<JarType, string> = {
  livingExpenses: '--f1-jar-living',
  food: '--f1-jar-food',
  children: '--f1-jar-children',
  emergencyFund: '--f1-jar-emergency',
  savings: '--f1-jar-savings',
  investment: '--f1-jar-investment',
  entertainmentAndTravel: '--f1-jar-travel'
};

describe('JAR_COLOR_TOKEN', () => {
  it('maps every jar type to its --f1-jar-* token', () => {
    expect(JAR_COLOR_TOKEN).toEqual(EXPECTED_TOKENS);
  });

  it('covers exactly the seven jar types the API returns', () => {
    const apiJarTypes = DEFAULT_JARS_FIXTURE.jars.map((jar) => jar.jarType).sort();

    expect(Object.keys(JAR_COLOR_TOKEN).sort()).toEqual(apiJarTypes);
    expect(apiJarTypes).toHaveLength(7);
  });

  it('has a token for every jar type of a plan response', () => {
    for (const jar of MONTHLY_PLAN_FIXTURE.jars) {
      expect(JAR_COLOR_TOKEN[jar.jarType]).toBeTruthy();
    }
  });

  it('uses a distinct CSS custom property name per jar', () => {
    const tokens = Object.values(JAR_COLOR_TOKEN);

    expect(new Set(tokens).size).toBe(tokens.length);
    for (const token of tokens) {
      expect(token).toMatch(/^--f1-jar-[a-z]+$/);
    }
  });
});

describe('jarColor', () => {
  it.each(Object.entries(EXPECTED_TOKENS) as [JarType, string][])(
    'wraps the %s token in var(...)',
    (jarType, token) => {
      expect(jarColor(jarType)).toBe(`var(${token})`);
    }
  );

  it('returns a CSS var() reference rather than a hardcoded color', () => {
    expect(jarColor('food')).toBe('var(--f1-jar-food)');
    expect(jarColor('food')).not.toMatch(/#|rgb|hsl/);
  });
});
