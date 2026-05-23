import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";

function corsResponse(data: any, status = 200) {
  return json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const placement = url.searchParams.get("placement");

  if (!shop || !placement) {
    return corsResponse({ error: "Missing shop or placement parameter" }, 400);
  }

  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
    include: {
      offers: {
        where: { type: placement, isActive: true },
        orderBy: { priority: "desc" },
        take: 1,
      },
    },
  });

  if (!store || store.offers.length === 0) {
    return corsResponse({ offer: null });
  }

  const rawOffer = store.offers[0];

  try {
    const { admin } = await unauthenticated.admin(shop);
    const response = await admin.graphql(
      `query getProductData($id: ID!) {
        product(id: $id) {
          title
          featuredImage {
            url
          }
          variants(first: 1) {
            edges {
              node {
                id
                price
              }
            }
          }
        }
      }`,
      { variables: { id: rawOffer.upsellProductId } }
    );
    const data = await response.json();
    const product = data.data?.product;
    
    if (product) {
      const variant = product.variants.edges[0]?.node;
      
      const enrichedOffer = {
        ...rawOffer,
        productTitle: product.title,
        productImage: product.featuredImage?.url || null,
        variantId: variant?.id,
        originalPrice: variant?.price
      };
      return corsResponse({ offer: enrichedOffer });
    }
  } catch (error) {
    console.error("Error enriching offer:", error);
  }

  return corsResponse({ offer: rawOffer });
};

// Handle preflight requests
export const action = async () => {
  return corsResponse({});
};
