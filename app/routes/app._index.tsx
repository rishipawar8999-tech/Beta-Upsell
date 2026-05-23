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

  // Mock analytics for the dashboard
  const analytics = {
    totalRevenue: "$1,240.50",
    conversionRate: "4.2%",
    upsellViews: 1250,
    acceptedOffers: 52
  };

  return json({ totalOffers, activeOffers, analytics });
};

export default function Dashboard() {
  const { totalOffers, activeOffers, analytics } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

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
        </Layout>
      </BlockStack>
    </Page>
  );
}
