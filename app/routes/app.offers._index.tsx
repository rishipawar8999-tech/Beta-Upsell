import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Button, IndexTable, Badge } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  
  // Enforce Billing
  await billing.require({
    plans: ["Basic Plan", "Pro Plan"],
    isTest: true,
    onFailure: async () => {
      throw new Response("", {
        status: 302,
        headers: { Location: "/app/pricing" }
      });
    },
  });

  const shopDomain = session.shop;

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: {
      offers: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  return json({ offers: store?.offers || [] });
};

export default function OffersIndex() {
  const { offers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const rowMarkup = offers.map(
    ({ id, name, type, isActive, discountType, discountValue }, index) => (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">{name}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {type === 'post_purchase' ? 'Post-Purchase' : 'Cart Drawer'}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {discountValue} {discountType === 'percentage' ? '%' : '$'}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={isActive ? "success" : "critical"}>
            {isActive ? "Active" : "Draft"}
          </Badge>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Upsell Offers"
      primaryAction={<Button variant="primary" onClick={() => navigate("/app/offers/new")}>Create Offer</Button>}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={{ singular: 'offer', plural: 'offers' }}
              itemCount={offers.length}
              headings={[
                { title: 'Name' },
                { title: 'Placement' },
                { title: 'Discount' },
                { title: 'Status' },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
