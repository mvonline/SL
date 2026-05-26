/** GitHub Pages build: no BFF — offline stations + browser calls to public SL/OSRM APIs */
export const isStaticMode =
  import.meta.env.VITE_STATIC_MODE === 'true' ||
  (import.meta.env.PROD && import.meta.env.VITE_STATIC_MODE !== 'false');
