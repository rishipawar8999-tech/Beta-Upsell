import { Page, Layout, Card, BlockStack, Text, Button, Accordion, Box, Grid } from "@shopify/polaris";
import { useState } from "react";

export default function SupportPage() {
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  const faqs = [
    {
      id: "faq1",
      question: "How do I make my upsell widget appear on my store?",
      answer: "You must enable the Beta-Upsell 'App Embed' in your Shopify Theme Editor. Go to Online Store > Themes > Customize. On the left sidebar, click 'App embeds' and toggle Beta-Upsell to ON."
    },
    {
      id: "faq2",
      question: "Where does the 'Frequently Bought Together' widget show up?",
      answer: "It displays on your product pages. You can control exactly where it sits by going to your Theme Editor, navigating to your Default Product template, and dragging the 'FBT Upsell Block' wherever you want (usually right below the Add to Cart button)."
    },
    {
      id: "faq3",
      question: "Can I customize the colors of the widget?",
      answer: "Yes! Go to the 'Settings' tab in the app to change the primary button color, or use the block settings inside your Theme Editor to change the layout style, background colors, and border radius."
    },
    {
      id: "faq4",
      question: "Why can't I create more than 1 active offer?",
      answer: "The Free Plan is limited to 1 active offer at a time. To create unlimited offers and unlock the Post-Purchase checkout placement, please upgrade to the Pro plan on the 'Pricing' tab."
    },
    {
      id: "faq5",
      question: "What happens when a customer accepts an offer?",
      answer: "If they accept a Cart Drawer or Product Page offer, the upsell item is immediately added to their cart alongside their main item. If they accept a Post-Purchase offer, their credit card is charged for the extra item without them needing to re-enter their payment details."
    }
  ];

  return (
    <Page title="Support & FAQ">
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Need help?</Text>
              <Text as="p" variant="bodyMd">
                Can't find the answer you're looking for? Our dedicated support team is available to help you maximize your revenue. We typically respond within 24 hours.
              </Text>
              <Box paddingBlockStart="200">
                <Button url="mailto:hello@adloomx.com" target="_blank" variant="primary">
                  Email Support (hello@adloomx.com)
                </Button>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Frequently Asked Questions</Text>
              <Box>
                {faqs.map((faq) => (
                  <div key={faq.id} style={{ borderBottom: '1px solid #ebebeb', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div 
                      onClick={() => toggleFAQ(faq.id)}
                      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Text as="h3" variant="headingMd">{faq.question}</Text>
                      <Text as="span" variant="headingMd" tone="subdued">
                        {openFAQ === faq.id ? "−" : "+"}
                      </Text>
                    </div>
                    {openFAQ === faq.id && (
                      <Box paddingBlockStart="300">
                        <Text as="p" variant="bodyMd">{faq.answer}</Text>
                      </Box>
                    )}
                  </div>
                ))}
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
