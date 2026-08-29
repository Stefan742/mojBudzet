export interface SavingsGoal {
  id: string;

  name: string;

  targetAmount: number;

  currentAmount: number;

  deadline?: string;

  colorHex: string;
}

export const calculateGoalProgress = (
  currentAmount: number,
  targetAmount: number
) => {
  if (targetAmount <= 0) return 0;

  return Math.min(currentAmount / targetAmount, 1);
};