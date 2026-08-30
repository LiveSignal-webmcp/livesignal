// The optional starter D1 example imports this helper. The production
// LiveSignal app currently has no persistence layer, so it fails only when an
// unused database example is invoked rather than coupling the whole app to a
// Cloudflare-only module at build time.
// The starter's optional D1 routes expect a query-builder shape, but this app
// deliberately has no database adapter. Keep the loose return type isolated to
// this throwing compatibility shim.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  throw new Error(
    "LiveSignal does not use a database in this prototype. Add a platform-specific database adapter before calling getDb()."
  );
}
