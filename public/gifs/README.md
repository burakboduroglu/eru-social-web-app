# Shared GIF catalog

This directory bundles 14 unmodified animated GIF assets from **Google Noto Emoji**.
The catalog is available to every user without a catalog API, API key, or external
asset request. It supplements the user's personal Supabase GIF archive.

- Creator: Google Noto Emoji.
- Official collection and animation licensing documentation:
  https://googlefonts.github.io/noto-emoji-files/
- Official animation project: https://github.com/googlefonts/noto-emoji-animation
- License: Creative Commons Attribution 4.0 International (CC BY 4.0).
- License: https://creativecommons.org/licenses/by/4.0/
- Full license text: `LICENSE-CC-BY-4.0.txt`.
- Download date: 2026-09-30.
- Modifications: none. Original 512 pixel GIF files were copied and given local
  descriptive filenames; animation content was not edited.
- Combined GIF size: 4,946,061 bytes (approximately 4.72 MiB).

`sources.json` records each exact source URL, Unicode identifier, byte count,
and SHA-256 checksum. The picker displays the creator and license attribution.

The animation assets use CC BY 4.0, as documented by Google's animation site.
This is distinct from the SIL Open Font License covering Noto font files and
the Apache license covering other Noto image resources. No font files or flag
assets are included here.

## Runtime URLs

Thumbnails use `/gifs/<filename>.gif`. Selecting a GIF emits that path resolved
against the app's current origin so persisted posts contain an absolute URL.
The post media parser recognizes GIF paths only on the app's own origin.
