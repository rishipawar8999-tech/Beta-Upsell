import React, { useState } from 'react';
import {
  extend,
  render,
  BlockStack,
  Button,
  CalloutBanner,
  Heading,
  Image,
  Layout,
  TextBlock,
  TextContainer,
  View,
  useExtensionInput
} from "@shopify/post-purchase-ui-extensions-react";

const APP_URL = "https://beta-upsell-production.up.railway.app";

extend("Checkout::PostPurchase::ShouldRender", async ({ inputData, storage }) => {
  const shopDomain = inputData.shop.domain;
  
  try {
    const response = await fetch(`${APP_URL}/api/offers?shop=${shopDomain}&placement=post_purchase`);
    if (!response.ok) throw new Error("Failed to fetch offer");
    
    const data = await response.json();
    
    if (data.offer) {
      await storage.update({ offer: data.offer });
      return { render: true };
    }
  } catch (err) {
    console.error("Error fetching offer:", err);
  }

  return { render: false };
});

render("Checkout::PostPurchase::Render", App);

export function App({ extensionPoint, storage }) {
  const { inputData, calculateChangeset, applyChangeset, done } = useExtensionInput();
  const offer = storage.initialData?.offer;
  const shopDomain = inputData.shop.domain;
  
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Send an impression event when the component mounts
  React.useEffect(() => {
    if (offer) {
      fetch(`${APP_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          eventType: "shown"
        })
      }).catch(console.error);
    }
  }, [offer, shopDomain]);

  if (!offer) {
    return null; // Should not happen since ShouldRender guards this
  }

  // Calculate the discount visually (simplified for MVP)
  // In a real app, we would query the Storefront API for the upsell product's actual price and image
  const discountText = offer.discountType === "percentage" 
    ? `${offer.discountValue}% OFF` 
    : `$${offer.discountValue} OFF`;

  const handleAccept = async () => {
    setIsAccepting(true);
    
    try {
      // 1. Send accept event to analytics
      await fetch(`${APP_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          eventType: "accepted",
          upsellRevenue: 0 // In real app, calculate actual revenue added
        })
      });

      // 2. Add item to order via Shopify's applyChangeset API
      // Note: In MVP we are skipping the strict changeset calculation to keep it simple, 
      // but typically we'd request to add a variant ID here.
      // const changes = await calculateChangeset({ changes: [{ type: "add_variant", variantId: ... }] });
      // await applyChangeset(changes.calculatedPurchase);

      // Finish extension
      done();
    } catch (err) {
      console.error(err);
      done();
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await fetch(`${APP_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          eventType: "declined"
        })
      });
      done();
    } catch (err) {
      done();
    }
  };

  return (
    <BlockStack spacing="loose">
      <CalloutBanner title="Special Offer Unlocked!">
        Add this item to your order with one click. No need to re-enter payment details.
      </CalloutBanner>
      <Layout
        maxInlineSize={0.95}
        media={[
          { viewportSize: "small", sizes: [1, 30, 1] },
          { viewportSize: "medium", sizes: [300, 30, 0.5] },
          { viewportSize: "large", sizes: [400, 30, 0.33] },
        ]}
      >
        <View>
          {/* Placeholder image, ideally fetched from Storefront API based on offer.upsellProductId */}
          <Image source="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png" />
        </View>
        <View />
        <BlockStack spacing="xloose">
          <TextContainer>
            <Heading>{offer.name}</Heading>
            <TextBlock>
              Exclusive discount: {discountText}
            </TextBlock>
          </TextContainer>
          <BlockStack spacing="tight">
            <Button submit onPress={handleAccept} loading={isAccepting}>
              Accept Offer
            </Button>
            <Button onPress={handleDecline} disabled={isAccepting} plain>
              Decline
            </Button>
          </BlockStack>
        </BlockStack>
      </Layout>
    </BlockStack>
  );
}