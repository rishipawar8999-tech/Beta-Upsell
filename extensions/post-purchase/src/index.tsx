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
    
    if (data.offer && data.offer.variantId) {
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
  const [errorText, setErrorText] = useState("");

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

  const originalPrice = parseFloat(offer.originalPrice || "0");
  let discountAmount = 0;
  
  if (offer.discountType === "percentage") {
    discountAmount = (originalPrice * offer.discountValue) / 100;
  } else {
    discountAmount = offer.discountValue;
  }
  
  const finalPrice = Math.max(0, originalPrice - discountAmount);
  const formattedFinalPrice = `$${finalPrice.toFixed(2)}`;
  const formattedOriginalPrice = `$${originalPrice.toFixed(2)}`;

  const handleAccept = async () => {
    setIsAccepting(true);
    setErrorText("");
    
    try {
      // 1. Calculate Changeset
      const changes = await calculateChangeset({ 
        changes: [
          { 
            type: "add_variant", 
            variantId: offer.variantId, 
            quantity: 1, 
            discount: { 
              value: offer.discountValue, 
              valueType: offer.discountType === "percentage" ? "percentage" : "fixed_amount",
              title: "Special Offer"
            } 
          }
        ] 
      });

      if (changes.errors && changes.errors.length > 0) {
        throw new Error(changes.errors[0].message);
      }

      // 2. Apply Changeset (This actually charges the card!)
      const applyResult = await applyChangeset(changes.calculatedPurchase?.token);
      
      if (applyResult.status === "success") {
        // 3. Track success in our analytics
        fetch(`${APP_URL}/api/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: shopDomain,
            offerId: offer.id,
            eventType: "accepted",
            upsellRevenue: finalPrice
          })
        }).catch(e => console.error(e));
        
        done();
      } else {
        throw new Error("Payment could not be processed for the upsell.");
      }
    } catch (err) {
      console.error(err);
      setErrorText("There was an issue processing your request. Please try again.");
      setIsAccepting(false);
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
    } catch (err) {
      console.error(err);
    } finally {
      done();
    }
  };

  return (
    <BlockStack spacing="loose">
      <CalloutBanner title="Wait! We have a special offer just for you.">
        Add this item to your order with 1-click. No need to re-enter your payment details.
      </CalloutBanner>
      
      {errorText && (
        <TextBlock color="critical">{errorText}</TextBlock>
      )}

      <Layout
        maxInlineSize={0.95}
        media={[
          { viewportSize: "small", sizes: [1, 30, 1] },
          { viewportSize: "medium", sizes: [300, 30, 0.5] },
          { viewportSize: "large", sizes: [400, 30, 0.33] },
        ]}
      >
        <View>
          <Image source={offer.productImage || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"} />
        </View>
        <View />
        <BlockStack spacing="xloose">
          <TextContainer>
            <Heading>{offer.productTitle || offer.name}</Heading>
            <TextBlock>
              Get it now for only <TextBlock emphasized>{formattedFinalPrice}</TextBlock> (was {formattedOriginalPrice})!
            </TextBlock>
          </TextContainer>
          <BlockStack spacing="tight">
            <Button submit onPress={handleAccept} loading={isAccepting} disabled={isDeclining}>
              Pay {formattedFinalPrice} Now
            </Button>
            <Button onPress={handleDecline} disabled={isAccepting || isDeclining} plain>
              No thanks, decline offer
            </Button>
          </BlockStack>
        </BlockStack>
      </Layout>
    </BlockStack>
  );
}