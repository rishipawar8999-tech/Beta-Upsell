import { AdminApiContext } from "@shopify/shopify-app-remix/server";

export async function getRecommendationsForProduct(admin: AdminApiContext, productId: string) {
  try {
    // 1. Fetch the trigger product's collections and price
    const triggerProductQuery = `
      query getTriggerProduct($id: ID!) {
        product(id: $id) {
          id
          title
          collections(first: 5) {
            edges {
              node {
                id
                products(first: 20) {
                  edges {
                    node {
                      id
                      title
                      variants(first: 1) {
                        edges {
                          node {
                            price
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
        }
      }
    `;

    const response = await admin.graphql(triggerProductQuery, {
      variables: { id: productId },
    });
    
    const { data } = await response.json();
    if (!data?.product) return [];

    const triggerPrice = parseFloat(data.product.variants.edges[0]?.node?.price || "0");
    
    const candidates = new Map<string, any>();

    // 2. Extract candidate products from the same collections
    data.product.collections.edges.forEach((collectionEdge: any) => {
      collectionEdge.node.products.edges.forEach((productEdge: any) => {
        const candidateNode = productEdge.node;
        
        // Don't suggest the product itself
        if (candidateNode.id === productId) return;

        if (!candidates.has(candidateNode.id)) {
          candidates.set(candidateNode.id, {
            id: candidateNode.id,
            title: candidateNode.title,
            price: parseFloat(candidateNode.variants.edges[0]?.node?.price || "0"),
            same_collection_score: 1 // Found in same collection
          });
        }
      });
    });

    // 3. Score the candidates
    // score = (co_purchase_freq * 0.5) + (same_collection * 0.3) + (price_delta_score * 0.2)
    // For V1 MVP, co_purchase is mocked to 0.5 if it's cheaper.
    const scoredCandidates = Array.from(candidates.values()).map(candidate => {
      let score = 0;
      
      // same_collection weight
      score += candidate.same_collection_score * 0.3;

      // price_delta_score weight (Ideal upsells are 10% - 50% of the original item's price)
      const priceRatio = candidate.price / (triggerPrice || 1);
      if (priceRatio > 0.1 && priceRatio < 0.5) {
        score += 0.2; // Perfect price range for impulse buy
      } else if (priceRatio >= 0.5 && priceRatio < 1.0) {
        score += 0.1; // Acceptable price range
      }

      // Mock co-purchase frequency based on price (cheaper items bought more often together)
      const mockCoPurchaseFreq = candidate.price < triggerPrice ? 0.8 : 0.2;
      score += mockCoPurchaseFreq * 0.5;

      return {
        ...candidate,
        score: parseFloat(score.toFixed(2))
      };
    });

    // 4. Return Top 3
    return scoredCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

  } catch (err) {
    console.error("Error fetching recommendations:", err);
    return [];
  }
}
