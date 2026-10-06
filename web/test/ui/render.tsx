import { MockedProvider } from "@apollo/client/testing/react";
import type { MockLink } from "@apollo/client/testing";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";

import { createCache } from "../../src/apollo";
import { library } from "../../src/hooks/useLibrary";
import { subscriptions } from "../../src/hooks/useSubscriptions";

/**
 * Renders a page or component the way the app does: inside a router, and an
 * Apollo client with the app's own cache rules - so cache behaviour (merging
 * catalogue pages, what a skipped query keeps) is the real thing. Network
 * responses come from `mocks`, each reusable any number of times.
 *
 * The library and subscription stores live for the whole test file, so
 * they're re-read from the (cleared) storage before every render.
 */
export function renderApp(
  ui: ReactNode,
  { mocks = [], route = "/" }: { mocks?: MockLink.MockedResponse[]; route?: string } = {},
) {
  library.reload();
  subscriptions.reload();
  return render(
    <MockedProvider
      mocks={mocks.map((m) => ({ maxUsageCount: Number.POSITIVE_INFINITY, ...m }))}
      cache={createCache()}
    >
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </MockedProvider>,
  );
}
