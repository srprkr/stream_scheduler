import { graphql } from "../generated";

/*
 * Field lists several queries share, defined once. Codegen adds each
 * fragment's definition to every query that spreads it, so this module is
 * never imported at runtime; it only has to exist for codegen to find.
 * Fragment masking is off (codegen.ts), so results stay plain objects.
 */

/** What a service logo, and a filter by service, need. */
graphql(`
  fragment ServiceLogo on Provider {
    id
    slug
    name
    logoUrl(size: SMALL)
  }
`);

/** What seasonLine and readiness read. */
graphql(`
  fragment SeasonScheduleFields on SeasonSchedule {
    seasonNumber
    premieresOn
    fullyOutOn
    expectedFullyOutOn
    isFullDrop
  }
`);
