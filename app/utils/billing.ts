/**
 * Calculates the remaining trial days when a merchant is upgrading or downgrading.
 *
 * @param planToSelect - The name of the plan the merchant wants to subscribe to
 * @param existingSubName - The name of the merchant's current/existing subscription
 * @param existingTrialDays - The total trial days initially granted to the existing subscription
 * @param existingCreatedAt - The date the existing subscription was created
 * @returns The number of trial days remaining, or 0 if no trial should be granted.
 */
export function calculateRemainingTrialDays(
  planToSelect: string,
  existingSubName: string | undefined,
  existingTrialDays: number | undefined,
  existingCreatedAt: string | Date | undefined
): number {
  if (!existingSubName) {
    // If they have no existing subscription, let the default billing config handle it.
    // However, if we must return a number, returning 7 for Basic Plan is our default.
    return planToSelect === "Basic Plan" ? 7 : 0;
  }

  if (existingSubName === "Basic Plan") {
    // If they are upgrading to Pro DURING a basic trial, we carry over the remaining trial days
    if (planToSelect === "Pro Plan" && existingTrialDays && existingCreatedAt) {
      const createdDate = new Date(existingCreatedAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      const remainingTrial = existingTrialDays - diffDays;
      
      return remainingTrial > 0 ? remainingTrial : 0;
    } else {
      // If they already used the Basic trial and are resubscribing to Basic, NO trial.
      return 0;
    }
  }

  // If they had Pro, they never get a trial on downgrade
  return 0;
}
