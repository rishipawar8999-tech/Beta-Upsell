import {
  reactExtension,
  useApi,
  useCartLines,
  useApplyCartLinesChange,
  Banner,
  BlockStack,
  Button,
  Image,
  InlineLayout,
  Text,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

export default reactExtension(
  'purchase.checkout.block.render',
  () => <Extension />,
);

function Extension() {
  const { query, shop, extension } = useApi();
  const applyCartLinesChange = useApplyCartLinesChange();
  const cartLines = useCartLines();

  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [impressionTracked, setImpressionTracked] = useState(false);

  // Note: For a production app, the shop domain can be retrieved from shop.myshopifyDomain
  const shopDomain = shop.myshopifyDomain;
  // Construct proxy URL or fallback to the app URL
  // We'll use the Shopify App Proxy to hit our backend securely. If proxy isn't set up, we could use an absolute URL.
  const appUrl = `https://${shopDomain}/apps/beta-upsell/api`; 

  useEffect(() => {
    // Check if the cart already has an item with our offer ID property to avoid showing it if already added
    const hasUpsellInCart = cartLines.some(line => 
      line.attributes?.some(attr => attr.key === '_upsell_offer_id')
    );

    if (hasUpsellInCart) {
      setLoading(false);
      return;
    }

    async function fetchOffer() {
      try {
        const res = await fetch(`${appUrl}/offers?shop=${shopDomain}&placement=checkout`);
        const data = await res.json();
        
        if (data && data.offer) {
          // Check if the upsell product is already in the cart naturally
          const alreadyInCart = cartLines.some(line => line.merchandise.id.includes(data.offer.variantId));
          if (!alreadyInCart) {
            setOffer(data.offer);
          }
        }
      } catch (err) {
        console.error("Failed to fetch checkout offer", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOffer();
  }, [shopDomain, cartLines, appUrl]);

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
          device: 'unknown' // Checkout UI extensions don't expose device easily
        })
      }).catch(console.error);
    }
  }, [offer, impressionTracked, appUrl, shopDomain]);

  if (loading || !offer) return null;

  async function handleAddOffer() {
    setAdding(true);
    setHasError(false);

    try {
      const result = await applyCartLinesChange({
        type: 'addCartLine',
        merchandiseId: `gid://shopify/ProductVariant/${offer.variantId}`,
        quantity: 1,
        attributes: [
          { key: '_upsell_offer_id', value: offer.id }
        ]
      });

      if (result.type === 'error') {
        setHasError(true);
        setAdding(false);
      } else {
        // Track success
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
        
        // Hide offer by clearing state
        setOffer(null);
      }
    } catch (err) {
      console.error(err);
      setHasError(true);
      setAdding(false);
    }
  }

  return (
    <BlockStack spacing="loose" padding="tight" border="base" cornerRadius="base">
      <Text size="base" emphasis="bold">Wait! Complete your order with this special offer</Text>
      
      {hasError && (
        <Banner status="critical">
          There was an issue adding this item to your order.
        </Banner>
      )}

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
        
        <Button
          loading={adding}
          onPress={handleAddOffer}
        >
          Add to order
        </Button>
      </InlineLayout>
    </BlockStack>
  );
}
