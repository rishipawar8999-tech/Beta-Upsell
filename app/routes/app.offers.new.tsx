import { useState } from "react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate } from "@remix-run/react";

export default function NewOffer() {
  const navigate = useNavigate();
  const [offerName, setOfferName] = useState("");
  const [placement, setPlacement] = useState("post_purchase");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");

  const handleSave = () => {
    // In a real implementation, this would submit to an action function
    shopify.toast.show("Offer saved successfully!");
    navigate("/app");
  };

  return (
    <Page
      breadcrumbs={[{ content: "Dashboard", onAction: () => navigate("/app") }]}
      title="Create New Offer"
    >
      <TitleBar title="Create New Offer">
        <button variant="primary" onClick={handleSave}>
          Save Offer
        </button>
      </TitleBar>

      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
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
                    { label: "Checkout", value: "checkout" },
                    { label: "Product Page", value: "product_page" },
                  ]}
                  value={placement}
                  onChange={setPlacement}
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
              <Button variant="primary" onClick={handleSave}>
                Save Offer
              </Button>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
