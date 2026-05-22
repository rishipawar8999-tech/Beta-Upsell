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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // Mock data for V1 dashboard
  const analytics = {
    totalRevenue: 12450.0,
    acceptanceRate: 18.5,
    aovLift: 12.3,
  };

  const topOffers = [
    {
      id: "1",
      name: "Post-Purchase Sneaker Care Kit",
      type: "Post-purchase",
      impressions: 1200,
      accepts: 250,
      revenue: 4500,
      status: "Active",
    },
    {
      id: "2",
      name: "Cart Drawer Socks Pack",
      type: "Cart",
      impressions: 3400,
      accepts: 850,
      revenue: 6800,
      status: "Active",
    },
    {
      id: "3",
      name: "Checkout Priority Shipping",
      type: "Checkout",
      impressions: 800,
      accepts: 115,
      revenue: 1150,
      status: "Paused",
    },
  ];

  return { analytics, topOffers };
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
