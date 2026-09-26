import { useSyncExternalStore } from "react";

import {
  localSubscriptions,
  SUBSCRIPTIONS_KEY,
  type Subscription,
} from "../lib/subscriptions";
import { browserStorage } from "./browserStorage";

/** The one set of subscriptions for this browser, shared by every page. */
export const subscriptions = localSubscriptions(browserStorage());

window.addEventListener("storage", (e) => {
  if (e.key === null || e.key === SUBSCRIPTIONS_KEY) subscriptions.reload();
});

export function useSubscriptions(): readonly Subscription[] {
  return useSyncExternalStore(subscriptions.subscribe, subscriptions.subscriptions);
}
