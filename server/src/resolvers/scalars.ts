import { LocalDateResolver, URLResolver } from "graphql-scalars";

/**
 * LocalDate, not graphql-scalars' `DateResolver`: that one parses input into
 * a JS Date at UTC midnight, while everything downstream expects a
 * YYYY-MM-DD string. It is registered under the schema's own name, `Date`.
 */

export const DateScaler = LocalDateResolver;
export const URLScaler = URLResolver;