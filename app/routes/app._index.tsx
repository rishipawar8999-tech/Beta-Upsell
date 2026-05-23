import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, redirect } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Button, Grid, Box } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  
  const shopDomain = session.shop;

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: { offers: true }
  });

  const totalOffers = store?.offers.length || 0;
  const activeOffers = store?.offers.filter(o => o.isActive).length || 0;

  // Aggregate real analytics from the database
  const analyticsData = await prisma.analyticsDaily.aggregate({
    where: { storeId: store?.id },
    _sum: {
      impressions: true,
      accepts: true,
      totalUpsellRevenue: true,
    }
  });

  const impressions = analyticsData._sum.impressions || 0;
  const accepts = analyticsData._sum.accepts || 0;
  const revenue = analyticsData._sum.totalUpsellRevenue || 0;
  const convRate = impressions > 0 ? ((accepts / impressions) * 100).toFixed(1) : "0.0";

  const analytics = {
    totalRevenue: `$${revenue.toFixed(2)}`,
    conversionRate: `${convRate}%`,
    upsellViews: impressions,
    acceptedOffers: accepts
  };

  return json({ totalOffers, activeOffers, analytics });
};

import { useState, useCallback } from "react";
import { Modal } from "@shopify/polaris";

export default function Dashboard() {
  const { totalOffers, activeOffers, analytics } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [isWizardOpen, setIsWizardOpen] = useState(totalOffers === 0);
  const handleWizardClose = useCallback(() => setIsWizardOpen(false), []);

  return (
    <Page
      title="Dashboard Overview"
      primaryAction={<Button variant="primary" onClick={() => navigate("/app/offers/new")}>Create Offer</Button>}
    >
      <BlockStack gap="500">
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">Extra Revenue</Text>
                <Text as="p" variant="heading3xl">{analytics.totalRevenue}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">Conversion Rate</Text>
                <Text as="p" variant="heading3xl">{analytics.conversionRate}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">Total Views</Text>
                <Text as="p" variant="heading3xl">{analytics.upsellViews}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">Accepted Offers</Text>
                <Text as="p" variant="heading3xl">{analytics.acceptedOffers}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Your Offers</Text>
                <Box paddingBlockEnd="200">
                  <Text as="p" variant="bodyMd">
                    You have {activeOffers} active offers out of {totalOffers} total created.
                  </Text>
                </Box>
                <div>
                  <Button onClick={() => navigate("/app/offers")}>View All Offers</Button>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card background="bg-surface-secondary">
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Need Help?</Text>
                <Text as="p" variant="bodyMd">
                  Our team is here to help you get the most out of Beta-Upsell. We usually respond within 24 hours.
                </Text>
                <Button url="mailto:support@betaupsell.com" target="_blank">
                  Email Support
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal
        open={isWizardOpen}
        onClose={handleWizardClose}
        title="Welcome to Beta-Upsell! 🎉"
        primaryAction={{
          content: 'Auto-suggest first offer',
          onAction: () => {
            handleWizardClose();
            navigate("/app/offers/new");
          },
        }}
        secondaryActions={[
          {
            content: 'Skip for now',
            onAction: handleWizardClose,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyLg">
              Let's get your first upsell live! We can automatically suggest a high-converting product pairing from your catalog to get you started.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
