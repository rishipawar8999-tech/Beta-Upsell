import {
  reactExtension,
  useApi,
  Banner,
  BlockStack,
  Button,
  Image,
  InlineLayout,
  Text,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

export default reactExtension(
  'purchase.thank.you.block.render',
  () => <Extension />,
);

function Extension() {
  const { shop } = useApi();

  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [impressionTracked, setImpressionTracked] = useState(false);

  const shopDomain = shop.myshopifyDomain;
  const appUrl = `https://${shopDomain}/apps/beta-upsell/api`; 

  useEffect(() => {
    async function fetchOffer() {
      try {
        const res = await fetch(`${appUrl}/offers?shop=${shopDomain}&placement=thank_you`);
        const data = await res.json();
        
        if (data && data.offer) {
          setOffer(data.offer);
        }
      } catch (err) {
        console.error("Failed to fetch thank you offer", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOffer();
  }, [shopDomain, appUrl]);

  useEffect(() => {
    if (offer && !impressionTracked) {
      setImpressionTracked(true);
      fetch(`${appUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          eventType: 'shown',
          device: 'unknown'
        })
      }).catch(console.error);
    }
  }, [offer, impressionTracked, appUrl, shopDomain]);

  if (loading || !offer) return null;

  const handleAcceptOffer = () => {
    // Track click
    fetch(`${appUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop: shopDomain,
        offerId: offer.id,
        eventType: 'accepted',
        upsellRevenue: offer.originalPrice
      })
    }).catch(console.error);
    
    // Redirect to product page (optionally with a discount code appended in URL if we generated one)
    // For V1, we direct them back to the storefront to purchase the item
    // @ts-ignore
    window.open(`https://${shopDomain}/products/${offer.handle || offer.variantId}`, '_blank');
  };

  return (
    <BlockStack spacing="loose" padding="tight" border="base" cornerRadius="base">
      <Text size="base" emphasis="bold">Special Thank You Offer!</Text>
      
      <InlineLayout
        spacing="base"
        columns={['20%', 'fill', 'auto']}
        blockAlignment="center"
      >
        {offer.productImage && (
          <Image source={offer.productImage} />
        )}
        
        <BlockStack spacing="none">
          <Text size="base" emphasis="bold">{offer.productTitle}</Text>
          <Text size="small" appearance="subdued">
            {offer.discountType === 'percentage' 
              ? `Save ${offer.discountValue}% instantly!` 
              : `Save $${offer.discountValue} instantly!`}
          </Text>
        </BlockStack>
        
        <Button onPress={handleAcceptOffer}>
          Claim Offer
        </Button>
      </InlineLayout>
    </BlockStack>
  );
}
