import { useState, useCallback, useEffect } from "react";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Select,
  Button,
  InlineStack,
  Text,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate, useSubmit, useActionData, useNavigation, useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getRecommendationsForProduct } from "../recommendations.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, admin } = await authenticate.admin(request);
  
  // 1. Enforce Billing
  await billing.require({
    plans: ["Flat Premium Plan"],
    isTest: true,
    onFailure: async () => billing.request({
      plan: "Flat Premium Plan",
      isTest: true,
    }),
  });

  // 2. Fetch recommendations if triggerProductId is provided
  const url = new URL(request.url);
  const triggerProductId = url.searchParams.get("triggerProductId");
  
  if (triggerProductId) {
    const recommendations = await getRecommendationsForProduct(admin, triggerProductId);
    return json({ recommendations });
  }

  return json({ recommendations: [] });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const offerName = formData.get("offerName") as string;
  const placement = formData.get("placement") as string;
  const triggerProductId = formData.get("triggerProductId") as string;
  const upsellProductId = formData.get("upsellProductId") as string;
  const discountType = formData.get("discountType") as string;
  const discountValue = parseFloat(formData.get("discountValue") as string) || 0;

  if (!offerName || !upsellProductId) {
    return json({ error: "Offer name and Upsell Product ID are required." }, { status: 400 });
  }

  let store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) {
    store = await prisma.store.create({
      data: {
        shopDomain,
        accessToken: session.accessToken,
      },
    });
  }

  const newOffer = await prisma.offer.create({
    data: {
      storeId: store.id,
      name: offerName,
      type: placement,
      triggerProductIds: triggerProductId ? [triggerProductId] : [],
      upsellProductId: upsellProductId,
      discountType,
      discountValue,
      isActive: true,
    },
  });

  if (placement === "cart") {
    const activeCartOffers = await prisma.offer.findMany({
      where: { storeId: store.id, type: "cart", isActive: true },
      select: { id: true, name: true, upsellProductId: true, discountType: true, discountValue: true }
    });

    const metafieldsSetMutation = `
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key value }
        }
      }
    `;

    const shopQuery = await admin.graphql(`{ shop { id } }`);
    const shopData = await shopQuery.json();
    
    await admin.graphql(metafieldsSetMutation, {
      variables: {
        metafields: [
          {
            namespace: "beta_upsell",
            key: "active_offers",
            type: "json",
            value: JSON.stringify(activeCartOffers),
            ownerId: shopData.data.shop.id
          }
        ]
      }
    });
  }

  return redirect("/app");
};

export default function NewOffer() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const fetcher = useFetcher<typeof loader>();

  const [offerName, setOfferName] = useState("");
  const [placement, setPlacement] = useState("post_purchase");
  const [triggerProductId, setTriggerProductId] = useState("");
  const [upsellProductId, setUpsellProductId] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");

  // Debounce and fetch recommendations when trigger product changes
  useEffect(() => {
    if (triggerProductId && triggerProductId.includes("gid://shopify/Product/")) {
      const timeoutId = setTimeout(() => {
        fetcher.load(`?triggerProductId=${encodeURIComponent(triggerProductId)}`);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [triggerProductId]);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("offerName", offerName);
    formData.append("placement", placement);
    formData.append("triggerProductId", triggerProductId);
    formData.append("upsellProductId", upsellProductId);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);

    submit(formData, { method: "post" });
  }, [offerName, placement, triggerProductId, upsellProductId, discountType, discountValue, submit]);

  const recommendations = fetcher.data?.recommendations || [];

  return (
    <Page
      breadcrumbs={[{ content: "Dashboard", onAction: () => navigate("/app") }]}
      title="Create New Offer"
    >
      <TitleBar title="Create New Offer">
        <button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Offer"}
        </button>
      </TitleBar>

      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {actionData?.error && (
              <Text as="p" tone="critical">
                {actionData.error}
              </Text>
            )}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Offer Details
                </Text>
                <TextField
                  label="Offer Name"
                  value={offerName}
                  onChange={setOfferName}
                  autoComplete="off"
                  helpText="Internal name to identify this offer."
                />
                <Select
                  label="Placement"
                  options={[
                    { label: "Post-Purchase (1-Click)", value: "post_purchase" },
                    { label: "Cart Drawer", value: "cart" },
                  ]}
                  value={placement}
                  onChange={setPlacement}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Products
                </Text>
                <TextField
                  label="Trigger Product ID (Optional)"
                  value={triggerProductId}
                  onChange={setTriggerProductId}
                  autoComplete="off"
                  helpText="e.g. gid://shopify/Product/123456789. If blank, triggers on all products."
                />
                
                {recommendations.length > 0 && (
                  <BlockStack gap="200">
                    <Text as="p" tone="subdued">AI Suggested Upsells for this product:</Text>
                    <InlineStack gap="200">
                      {recommendations.map((rec: any) => (
                        <Button 
                          key={rec.id} 
                          onClick={() => setUpsellProductId(rec.id)}
                          pressed={upsellProductId === rec.id}
                        >
                          {rec.title} (Score: {rec.score})
                        </Button>
                      ))}
                    </InlineStack>
                  </BlockStack>
                )}

                <TextField
                  label="Upsell Product ID"
                  value={upsellProductId}
                  onChange={setUpsellProductId}
                  autoComplete="off"
                  helpText="e.g. gid://shopify/Product/987654321"
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Discount Configuration
                </Text>
                <InlineStack gap="400">
                  <Select
                    label="Discount Type"
                    options={[
                      { label: "Percentage (%)", value: "percentage" },
                      { label: "Fixed Amount ($)", value: "fixed_amount" },
                    ]}
                    value={discountType}
                    onChange={setDiscountType}
                  />
                  <TextField
                    label="Discount Value"
                    type="number"
                    value={discountValue}
                    onChange={setDiscountValue}
                    autoComplete="off"
                  />
                </InlineStack>
              </BlockStack>
            </Card>

            <InlineStack align="end">
              <Button variant="primary" onClick={handleSave} loading={isSaving}>
                Save Offer
              </Button>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
