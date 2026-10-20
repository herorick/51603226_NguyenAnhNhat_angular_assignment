import { JarType } from '../../models/budget-plan.models';

/** Presentation only: the one jar constant the frontend may own. Names, rates and order come from the API. */
export const JAR_COLOR_TOKEN: Record<JarType, string> = {
  livingExpenses: '--f1-jar-living',
  food: '--f1-jar-food',
  children: '--f1-jar-children',
  emergencyFund: '--f1-jar-emergency',
  savings: '--f1-jar-savings',
  investment: '--f1-jar-investment',
  entertainmentAndTravel: '--f1-jar-travel'
};

export const jarColor = (jarType: JarType): string => `var(${JAR_COLOR_TOKEN[jarType]})`;
