# Brand assets

The social-web mark uses two overlapping conversation shapes in lavender (`#b8abff`) and light ink (`#eeedf5`) on the app's dark background. It is native SVG geometry with no font or image service dependency.

- `public/assets/social-web-mark.svg`: compact 96 × 96 mark; used in the shared Brand component and favicon.
- `public/assets/social-web-wordmark.svg`: optional horizontal lockup. Its text uses system fonts; the application itself uses live text for accessible, responsive branding.
- `src/brand.tsx`: shared accessible navigation brand for the auth screens and app sidebar.

Source brief and SVGs were prepared in the studio workspace with a Luna subagent. Affinity and raster image generation were not used. Exported project assets are stored in this repository and do not depend on the studio workspace at runtime.
