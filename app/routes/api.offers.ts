import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

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

  return corsResponse({ offer: store.offers[0] });
};

// Handle preflight requests
export const action = async () => {
  return corsResponse({});
};
