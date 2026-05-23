import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Button, Grid, Badge, List } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const billingCheck = await billing.check({
    plans: ["Basic Plan", "Pro Plan"],
    isTest: true,
  });

  const activePlan = billingCheck.hasActivePayment 
    ? billingCheck.appSubscriptions[0].name 
    : null;

  return json({ activePlan });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const planToSelect = formData.get("plan") as string;

  if (planToSelect !== "Basic Plan" && planToSelect !== "Pro Plan") {
    return json({ error: "Invalid plan selected" }, { status: 400 });
  }

  // Robust Trial Logic
  // Check if they ever had a subscription to prevent trial abuse
  const billingCheck = await billing.check({
    plans: ["Basic Plan", "Pro Plan"],
    isTest: true,
  });

  let trialDaysOverride = undefined;

  // If upgrading/downgrading or resubscribing, calculate if they get a trial
  if (billingCheck.appSubscriptions && billingCheck.appSubscriptions.length > 0) {
    const existingSub = billingCheck.appSubscriptions[0];
    
    if (existingSub.name === "Basic Plan") {
      // If they are on Basic and upgrading to Pro, or cancelling and resubscribing
      // If they are upgrading to Pro DURING a basic trial, we carry over the trial days
      if (planToSelect === "Pro Plan" && existingSub.trialDays && existingSub.createdAt) {
        const createdDate = new Date(existingSub.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        const remainingTrial = existingSub.trialDays - diffDays;
        
        if (remainingTrial > 0) {
          trialDaysOverride = remainingTrial;
        } else {
          trialDaysOverride = 0;
        }
      } else {
        // If they already used the Basic trial and are resubscribing to Basic, NO trial.
        trialDaysOverride = 0;
      }
    } else {
      // If they had Pro, they never get a trial on downgrade
      trialDaysOverride = 0;
    }
  }

  // Request the new charge
  await billing.request({
    plan: planToSelect,
    isTest: true,
    ...(trialDaysOverride !== undefined ? { trialDays: trialDaysOverride } : {})
  });

  return null;
};

export default function Pricing() {
  const { activePlan } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const handleSelectPlan = (plan: string) => {
    const formData = new FormData();
    formData.append("plan", plan);
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Plans & Pricing">
      <BlockStack gap="500">
        <Text as="p" variant="bodyLg">
          Choose the best plan for your store. Upgrade or downgrade at any time.
        </Text>

        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Basic Plan</Text>
                <Text as="h3" variant="heading3xl">$9 <Text as="span" variant="bodyMd" tone="subdued">/month</Text></Text>
                {activePlan === "Basic Plan" && <Badge tone="success">Active Plan</Badge>}
                
                <List>
                  <List.Item>Up to 2 Active Offers</List.Item>
                  <List.Item>Cart Drawer Upsells</List.Item>
                  <List.Item>Basic Analytics</List.Item>
                  <List.Item>3-Day Free Trial</List.Item>
                </List>

                <Button 
                  size="large" 
                  fullWidth 
                  disabled={activePlan === "Basic Plan" || isSubmitting}
                  onClick={() => handleSelectPlan("Basic Plan")}
                >
                  {activePlan === "Basic Plan" ? "Current Plan" : "Select Basic"}
                </Button>
              </BlockStack>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
            <Card background="bg-surface-active">
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Pro Plan</Text>
                <Text as="h3" variant="heading3xl">$29 <Text as="span" variant="bodyMd" tone="subdued">/month</Text></Text>
                {activePlan === "Pro Plan" && <Badge tone="success">Active Plan</Badge>}
                
                <List>
                  <List.Item>Unlimited Active Offers</List.Item>
                  <List.Item>Cart & Post-Purchase Upsells</List.Item>
                  <List.Item>Advanced AI Recommendations</List.Item>
                  <List.Item>Priority Support</List.Item>
                </List>

                <Button 
                  variant="primary" 
                  size="large" 
                  fullWidth 
                  disabled={activePlan === "Pro Plan" || isSubmitting}
                  onClick={() => handleSelectPlan("Pro Plan")}
                  loading={isSubmitting}
                >
                  {activePlan === "Pro Plan" ? "Current Plan" : "Upgrade to Pro"}
                </Button>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>
      </BlockStack>
    </Page>
  );
}
