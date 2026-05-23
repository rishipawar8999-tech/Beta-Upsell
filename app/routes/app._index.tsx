import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineGrid,
  IndexTable,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: {
      offers: {
        include: {
          analytics: true
        }
      },
      analytics: {
        where: {
          date: {
            gte: new Date(new Date().setDate(new Date().getDate() - 30))
          }
        }
      }
    }
  });

  if (!store) {
    return {
      analytics: { totalRevenue: 0, acceptanceRate: 0, aovLift: 0 },
      topOffers: []
    };
  }

  // Calculate high level metrics
  let totalRevenue = 0;
  let totalImpressions = 0;
  let totalAccepts = 0;
  let totalAovLift = 0;

  store.analytics.forEach(day => {
    totalRevenue += day.totalUpsellRevenue;
    totalImpressions += day.impressions;
    totalAccepts += day.accepts;
    totalAovLift += day.avgOrderValueLift;
  });

  const acceptanceRate = totalImpressions > 0 ? ((totalAccepts / totalImpressions) * 100).toFixed(1) : 0;
  const aovLift = store.analytics.length > 0 ? (totalAovLift / store.analytics.length).toFixed(2) : 0;

  const topOffers = store.offers.map(offer => {
    let impressions = 0;
    let accepts = 0;
    let revenue = 0;

    offer.analytics.forEach(a => {
      impressions += a.impressions;
      accepts += a.accepts;
      revenue += a.totalUpsellRevenue;
    });

    return {
      id: offer.id,
      name: offer.name,
      type: offer.type,
      status: offer.isActive ? "Active" : "Paused",
      impressions,
      accepts,
      revenue
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    analytics: {
      totalRevenue,
      acceptanceRate,
      aovLift,
    },
    topOffers
  };
};

export default function Index() {
  const { analytics, topOffers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rowMarkup = topOffers.map(
    ({ id, name, type, impressions, accepts, revenue, status }, index) => (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{type}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={status === "Active" ? "success" : "critical"}>
            {status}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{impressions}</IndexTable.Cell>
        <IndexTable.Cell>{accepts}</IndexTable.Cell>
        <IndexTable.Cell>
          {((accepts / impressions) * 100).toFixed(1)}%
        </IndexTable.Cell>
        <IndexTable.Cell>${revenue.toLocaleString()}</IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page fullWidth>
      <TitleBar title="Overview">
        <button variant="primary" onClick={() => navigate("/app/offers/new")}>
          Create Offer
        </button>
      </TitleBar>

      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" tone="subdued">
                    Total Upsell Revenue (30d)
                  </Text>
                  <Text as="p" variant="headingLg">
                    ${analytics.totalRevenue.toLocaleString()}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" tone="subdued">
                    Average Acceptance Rate
                  </Text>
                  <Text as="p" variant="headingLg">
                    {analytics.acceptanceRate}%
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" tone="subdued">
                    AOV Lift
                  </Text>
                  <Text as="p" variant="headingLg" tone="success">
                    +${analytics.aovLift}
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>

          <Layout.Section>
            <Card padding="0">
              <BlockStack gap="400">
                <div style={{ padding: "16px 16px 0" }}>
                  <Text as="h2" variant="headingMd">
                    Top Performing Offers
                  </Text>
                </div>
                <IndexTable
                  resourceName={{ singular: "offer", plural: "offers" }}
                  itemCount={topOffers.length}
                  headings={[
                    { title: "Offer Name" },
                    { title: "Placement" },
                    { title: "Status" },
                    { title: "Impressions" },
                    { title: "Accepts" },
                    { title: "Conv. Rate" },
                    { title: "Revenue" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
