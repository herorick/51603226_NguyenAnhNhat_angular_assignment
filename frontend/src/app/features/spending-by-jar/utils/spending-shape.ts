import { SpendingByJar, SpendingByJarsResponse } from '../../../models/budget-plan.models';
import { JAR_COLOR_TOKEN } from '../../../shared/constants/jar-colors';

const DIGITS_ONLY = /^\d+$/;
export const EXPECTED_JAR_COUNT = 7;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// `percentageUsed` is deliberately not capped at 100: an over-budget jar is a valid state.
const isSpendingJar = (value: unknown): value is SpendingByJar =>
  isRecord(value) &&
  typeof value['jarType'] === 'string' &&
  Object.hasOwn(JAR_COLOR_TOKEN, value['jarType']) &&
  typeof value['jarName'] === 'string' &&
  typeof value['percentageUsed'] === 'number' &&
  Number.isFinite(value['percentageUsed']) &&
  value['percentageUsed'] >= 0 &&
  typeof value['plannedBudgetVnd'] === 'string' &&
  DIGITS_ONLY.test(value['plannedBudgetVnd']) &&
  typeof value['spentBudgetVnd'] === 'string' &&
  DIGITS_ONLY.test(value['spentBudgetVnd']);

/**
 * Integrity check for a 200 body before any amount is rendered: VND, digit-only money and seven distinct known jars.
 * It only inspects the shape. It never recomputes a percentage or a total, and never reorders the jars.
 */
export const isValidSpendingByJars = (value: unknown): value is SpendingByJarsResponse => {
  if (
    !isRecord(value) ||
    typeof value['year'] !== 'number' ||
    typeof value['month'] !== 'number' ||
    value['currency'] !== 'VND' ||
    !Array.isArray(value['jars']) ||
    value['jars'].length !== EXPECTED_JAR_COUNT
  ) {
    return false;
  }
  const jars: unknown[] = value['jars'];
  return jars.every(isSpendingJar) && new Set(jars.map((jar) => jar.jarType)).size === EXPECTED_JAR_COUNT;
};
