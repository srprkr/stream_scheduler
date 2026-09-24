# Stream Scheduler

Track what's actually coming to a streaming service, so you can pause a
subscription through the dry months and resume for the good ones.

The MVP is read-only: upcoming Netflix season drops for the next 90 days, plus
the current film backlog, with trailers and synopses.

---

## Why GraphQL, and not a REST wrapper?

Fair question, since the MVP reads from one upstream API. Three answers, all
visible in the code:

**Aggregation.** `Provider` is a row of data, not a type. Nothing outside
`sources/tmdb/` names Netflix. Adding a second service means writing one more
`CatalogSource` implementation — no schema change, no resolver change.

**The server does real work.** `Release.bingeableFrom` reconciles episode-level
air dates into the one date the product actually needs.
`Release.daysUntilRelease(timezone:)` computes in the *caller's* calendar, which
a cached or precomputed field cannot do. `Release.watchTimeMinutes` unifies
season runtimes and film runtimes behind one field, resolving through DataLoader.

**A user layer is coming.** Watchlists, pause history and savings are private
data that will be joined to third-party catalogue data in a single query. See
`schema/schema_roadmap.graphql`.

---

## Architecture

```
schema/schema.graphql ──┬─→ server: typescript-resolvers (typed resolvers)
   one source of truth  └─→ web:    client-preset        (typed queries)

server/src/
  sources/types.ts      CatalogSource — the boundary. Knows nothing about TMDB.
  sources/fixture.ts    In-memory implementation. Runs with no network, no token.
  sources/tmdb/         TMDB implementation: client (HTTP, auth, cache, retry)
                        + source (mapping). Neither knows about the other's job.
  loaders.ts            DataLoader, built per request.
  resolvers/            One file per GraphQL type.
```

Rename a field in the SDL and **both** builds fail. That's the point.

### Things worth knowing

- **`Release` is an event, not a title.** "Lupin S3 arrives on Netflix on Oct 22"
  is the unit users track. One title can carry different dates on different
  services without a breaking change.
- **`MediaItem` is an interface, not a union.** `Movie` and `Series` share nearly
  every field; a union would force a type condition just to read `title`.
- **`availableFrom` ≠ `bingeableFrom`.** Netflix mostly full-drops, but not
  always — one sampled season spanned 63 days. Telling someone to resume on the
  premiere date of a weekly show wastes exactly the month this app exists to save.
- **DataLoader batches and dedupes, but TMDB has no batch endpoint.** The win
  here is per-request caching, deduplication, and bounded concurrency — not one
  combined round trip. `append_to_response` is what actually halves request count.
- **`Date` maps to `LocalDateResolver`, not `DateResolver`.** The latter parses
  arguments into JS `Date` objects at UTC midnight; everything downstream expects
  `YYYY-MM-DD` strings.

---

## Running it

Requires Node 24+ (`.tool-versions` pins 26.3.0) and a free
[TMDB API Read Access Token](https://www.themoviedb.org/settings/api).

```bash
npm install
cp server/.env.example server/.env    # then paste your token in
npm run codegen
```

Two terminals:

```bash
npm run dev        # GraphQL server  → http://localhost:4000
npm run dev:web    # React client    → http://localhost:5173
```

**No token?** The whole app runs against fixtures:

```bash
CATALOG_SOURCE=fixture npm run dev
```

Responses are cached to `server/.cache/` for 24h, so a cold first feed takes a
few hundred milliseconds and everything after is instant.

```bash
npm run typecheck    # both workspaces
npm test             # vitest
```

---

## Known limitations

These are deliberate, not oversights.

- **Films are "available now", not "coming soon".** TMDB doesn't publish future
  streaming dates. Series use the Netflix *network* plus future air dates, which
  is real upcoming data; films are the current catalogue ranked by popularity,
  so their `availableFrom` sits in the past.
- **A cold feed costs ~70 upstream requests.** Season air dates live only on the
  detail endpoint. The file cache hides this in development, but a deployed
  version needs a periodically refreshed cache rather than a per-request fan-out.
- **`watchTimeMinutes` is often null.** Unreleased episodes have no runtime yet,
  and partial data would understate a season, so it's all-or-nothing.
- **`episodeCount` can read `1`** for unannounced seasons — TMDB's placeholder.
- **US region only**, subscription offers only, no pagination, no auth.

---

## Not in scope yet

`schema/schema_roadmap.graphql` sketches the near-term schema work: regions,
offer types, cursor pagination and subscription plans.

The product goes further than that. Pausing is only half of it — the savings are
meant to be spent. A user's wishlist of physical media gets scored on hours of
entertainment per dollar, against what those months of subscription would have
cost them:

    months_of_viewing = total_hours / your_hours_per_month

A $45 box set holding 74 hours is 7.4 months of viewing at 10 h/month — about
$6 per month-equivalent against a $8/month subscription, and month eight costs
nothing. Subscriptions amortize to nothing; purchases amortize to zero cost per
hour. Both halves of that comparison are computable: episode runtimes come from
the same data that already powers `watchTimeMinutes`.

Both files are design sketches, not build targets.


---

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
