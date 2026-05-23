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
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate, useSubmit, useActionData, useNavigation, useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getRecommendationsForProduct } from "../recommendations.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, admin } = await authenticate.admin(request);
  
  // 1. Remove forced billing for Freemium model

  const billingCheck = await billing.check({
    plans: ["Basic Plan", "Pro Plan"],
    isTest: true,
  });

  const activePlan = billingCheck.hasActivePayment 
    ? billingCheck.appSubscriptions[0].name 
    : null;

  // 2. Fetch recommendations if triggerProductId is provided
  const url = new URL(request.url);
  const triggerProductId = url.searchParams.get("triggerProductId");
  
  let recommendations = [];
  if (triggerProductId) {
    recommendations = await getRecommendationsForProduct(admin, triggerProductId);
  }

  // 3. Check active offer count
  const shopDomain = admin.rest.session.shop;
  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: { offers: { where: { isActive: true } } }
  });
  
  const activeOfferCount = store?.offers.length || 0;

  return json({ recommendations, activePlan, activeOfferCount });
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
    return json({ error: "Offer name and Upsell Product are required." }, { status: 400 });
  }

  if (discountValue < 0) {
    return json({ error: "Discount value cannot be negative." }, { status: 400 });
  }

  if (discountType === "percentage" && discountValue > 100) {
    return json({ error: "Percentage discount cannot exceed 100%." }, { status: 400 });
  }

  const billingCheck = await billing.check({
    plans: ["Basic Plan", "Pro Plan"],
    isTest: true,
  });

  const activePlan = billingCheck.hasActivePayment ? billingCheck.appSubscriptions[0].name : null;

  let store = await prisma.store.findUnique({ where: { shopDomain }, include: { offers: { where: { isActive: true } } } });
  
  if (store && activePlan === "Basic Plan" && store.offers.length >= 2) {
    return json({ error: "Basic Plan limit reached. Upgrade to Pro to create more active offers." }, { status: 403 });
  }
  if (store && activePlan === null && store.offers.length >= 1) {
    return json({ error: "Free Plan limit reached (1 active offer max). Upgrade to Basic or Pro to create more." }, { status: 403 });
  }
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

    const enrichedOffers = await Promise.all(activeCartOffers.map(async (offer) => {
      const response = await admin.graphql(
        `query getProductHandle($id: ID!) {
          product(id: $id) {
            handle
          }
        }`,
        { variables: { id: offer.upsellProductId } }
      );
      const data = await response.json();
      return {
        ...offer,
        handle: data.data?.product?.handle || null
      };
    }));

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
            value: JSON.stringify(enrichedOffers),
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
  const [triggerProductTitle, setTriggerProductTitle] = useState("");
  const [upsellProductId, setUpsellProductId] = useState("");
  const [upsellProductTitle, setUpsellProductTitle] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");

  const selectProduct = async (setterId: (id: string) => void, setterTitle: (title: string) => void) => {
    // @ts-ignore
    const selected = await shopify.resourcePicker({ type: 'product', multiple: false, action: 'select' });
    if (selected && selected.length > 0) {
      setterId(selected[0].id);
      setterTitle(selected[0].title);
    }
  };

  // Debounce and fetch recommendations when trigger product changes
  useEffect(() => {
    if (triggerProductId && triggerProductId.includes("gid://shopify/Product/")) {
      const timeoutId = setTimeout(() => {
        fetcher.load(`?triggerProductId=${encodeURIComponent(triggerProductId)}`);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [triggerProductId]);

  const { recommendations = [], activePlan, activeOfferCount } = fetcher.data || useLoaderData<typeof loader>();

  const isLimitReached = (activePlan === "Basic Plan" && activeOfferCount >= 2) || (activePlan === null && activeOfferCount >= 1);

  const [formErrors, setFormErrors] = useState<string[]>([]);

  const handleSave = useCallback(() => {
    const errors: string[] = [];
    if (!offerName) errors.push("Offer Name is required.");
    if (!upsellProductId) errors.push("Upsell Product is required.");
    
    const parsedDiscount = parseFloat(discountValue);
    if (isNaN(parsedDiscount) || parsedDiscount < 0) errors.push("Discount must be a positive number.");
    if (discountType === "percentage" && parsedDiscount > 100) errors.push("Percentage discount cannot exceed 100%.");

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);

    const formData = new FormData();
    formData.append("offerName", offerName);
    formData.append("placement", placement);
    formData.append("triggerProductId", triggerProductId);
    formData.append("upsellProductId", upsellProductId);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);

    submit(formData, { method: "post" });
  }, [offerName, placement, triggerProductId, upsellProductId, discountType, discountValue, submit]);

  return (
    <Page
      breadcrumbs={[{ content: "Dashboard", onAction: () => navigate("/app") }]}
      title="Create New Offer"
    >
      <TitleBar title="Create New Offer">
        <button variant="primary" onClick={handleSave} disabled={isSaving || isLimitReached}>
          {isSaving ? "Saving..." : "Save Offer"}
        </button>
      </TitleBar>

      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {isLimitReached && (
              <Banner title="Offer Limit Reached" tone="warning" action={{ content: "Upgrade Plan", onAction: () => navigate("/app/pricing") }}>
                <p>
                  You have reached the maximum number of active offers for your current plan 
                  ({activePlan === "Basic Plan" ? "2 offers" : "1 offer"}). 
                  Please upgrade your plan to create more.
                </p>
              </Banner>
            )}

            {(actionData?.error || formErrors.length > 0) && (
              <Banner title="Please fix the following errors:" tone="critical">
                <List>
                  {actionData?.error && <List.Item>{actionData.error}</List.Item>}
                  {formErrors.map((err, i) => <List.Item key={i}>{err}</List.Item>)}
                </List>
              </Banner>
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
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="bold">Trigger Product (Optional)</Text>
                  <Text as="p" tone="subdued">Select a product that will trigger this upsell when added to cart or purchased.</Text>
                  <InlineStack gap="400" align="start">
                    <Button onClick={() => selectProduct(setTriggerProductId, setTriggerProductTitle)}>
                      {triggerProductId ? "Change Product" : "Browse Products"}
                    </Button>
                    {triggerProductTitle && (
                      <Badge tone="info">{triggerProductTitle}</Badge>
                    )}
                  </InlineStack>
                </BlockStack>
                
                {recommendations.length > 0 && (
                  <BlockStack gap="200">
                    <Text as="p" tone="subdued">AI Suggested Upsells for this product:</Text>
                    <InlineStack gap="200">
                      {recommendations.map((rec: any) => (
                        <Button 
                          key={rec.id} 
                          onClick={() => {
                            setUpsellProductId(rec.id);
                            setUpsellProductTitle(rec.title);
                          }}
                          pressed={upsellProductId === rec.id}
                        >
                          {rec.title} (Score: {rec.score})
                        </Button>
                      ))}
                    </InlineStack>
                  </BlockStack>
                )}

                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="bold">Upsell Product</Text>
                  <Text as="p" tone="subdued">Select the product you want to offer as an upsell.</Text>
                  <InlineStack gap="400" align="start">
                    <Button onClick={() => selectProduct(setUpsellProductId, setUpsellProductTitle)} variant="primary">
                      {upsellProductId ? "Change Upsell Product" : "Select Upsell Product"}
                    </Button>
                    {upsellProductTitle && (
                      <Badge tone="success">{upsellProductTitle}</Badge>
                    )}
                  </InlineStack>
                </BlockStack>
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
              <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isLimitReached}>
                Save Offer
              </Button>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
