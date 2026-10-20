import { MonthlyPlanJar, MonthlyPlanResponse } from '../../../models/budget-plan.models';
import { JAR_COLOR_TOKEN } from '../../../shared/constants/jar-colors';

const DIGITS_ONLY = /^\d+$/;
const EXPECTED_JAR_COUNT = 7;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isPlanJar = (value: unknown): value is MonthlyPlanJar =>
  isRecord(value) &&
  typeof value['jarType'] === 'string' &&
  Object.hasOwn(JAR_COLOR_TOKEN, value['jarType']) &&
  typeof value['name'] === 'string' &&
  typeof value['percentage'] === 'number' &&
  value['percentage'] >= 0 &&
  value['percentage'] <= 100 &&
  typeof value['budgetVnd'] === 'string' &&
  DIGITS_ONLY.test(value['budgetVnd']);

/**
 * Integrity check for a 200 body before any amount is rendered: VND, digit-only money and seven distinct known jars.
 * It only inspects the shape. It never recomputes a budget, total or percentage.
 */
export const isValidMonthlyPlan = (value: unknown): value is MonthlyPlanResponse => {
  if (
    !isRecord(value) ||
    typeof value['year'] !== 'number' ||
    typeof value['month'] !== 'number' ||
    value['currency'] !== 'VND' ||
    typeof value['monthlyIncomeVnd'] !== 'string' ||
    !DIGITS_ONLY.test(value['monthlyIncomeVnd']) ||
    !Array.isArray(value['jars']) ||
    value['jars'].length !== EXPECTED_JAR_COUNT
  ) {
    return false;
  }
  const jars: unknown[] = value['jars'];
  return jars.every(isPlanJar) && new Set(jars.map((jar) => jar.jarType)).size === EXPECTED_JAR_COUNT;
};
