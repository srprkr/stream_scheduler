import { gql } from "@apollo/client";
import { describe, expect, it } from "vitest";

import { createCache } from "../src/apollo";

const PLANS = gql`
  query Plans {
    providers {
      id
      slug
      plans {
        id
        monthlyCents
      }
    }
  }
`;

describe("the client cache", () => {
  // Regression: every service's "premium" plan once shared one cache entry,
  // and Peacock's Premium showed Netflix Premium's $26.99.
  it("keeps same-id plans of different services apart", () => {
    const cache = createCache();
    cache.writeQuery({
      query: PLANS,
      data: {
        providers: [
          {
            __typename: "Provider",
            id: "provider:peacock",
            slug: "peacock",
            plans: [{ __typename: "Plan", id: "premium", monthlyCents: 1299 }],
          },
          {
            __typename: "Provider",
            id: "provider:netflix",
            slug: "netflix",
            plans: [{ __typename: "Plan", id: "premium", monthlyCents: 2699 }],
          },
        ],
      },
    });

    const read = cache.readQuery<{
      providers: { slug: string; plans: { monthlyCents: number }[] }[];
    }>({ query: PLANS });
    expect(read?.providers.map((p) => [p.slug, p.plans[0]?.monthlyCents])).toEqual([
      ["peacock", 1299],
      ["netflix", 2699],
    ]);
  });
});
