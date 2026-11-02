import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// After a new deploy, an open tab may request old page files that no longer
// exist. Reload once to pick up the fresh version instead of showing a blank screen.
function installStaleChunkReload() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __staleChunkReload?: boolean };
  if (w.__staleChunkReload) return;
  w.__staleChunkReload = true;
  const reloadOnce = () => {
    const key = "stale-chunk-reload-at";
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < 10_000) return; // avoid reload loops
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadOnce();
  });
  // An old tab running a previously deployed bundle can hit a TanStack route
  // error like "Cannot read properties of undefined (reading 'component')".
  // Reload once so the tab picks up the current bundle, then never again.
  window.addEventListener("error", (event) => {
    if (!/Cannot read properties of undefined \(reading 'component'\)/.test(event.message ?? "")) return;
    if (sessionStorage.getItem("component-error-reload-at")) {
      event.preventDefault?.();
      return;
    }
    sessionStorage.setItem("component-error-reload-at", String(Date.now()));
    event.preventDefault?.();
    window.location.reload();
  });
  window.addEventListener("unhandledrejection", (event) => {
    const msg = String((event.reason as Error | undefined)?.message ?? event.reason ?? "");
    if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg)) {
      reloadOnce();
    }
  });
}

export const getRouter = () => {
  installStaleChunkReload();
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
