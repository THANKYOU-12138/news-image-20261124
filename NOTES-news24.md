# NOTES-news24 — news-image-20261124

## Design

"World map centre" front page, deliberately different from yesterday's
newspaper front page. Deep navy background with cream/gold type.

- Header: the date is the biggest thing on the page — "24 NOVEMBER 2026"
  at 7x font scale, "TUESDAY" in gold at 5x, flanked by gold rules.
- Middle: a hand-drawn world map (coarse equirectangular continent
  polygons + graticule) with ten numbered gold dots at the location of
  each story.
- Below: a numbered list — one short headline plus one very short
  subline per story, gold number badges matching the map dots.
- Footer: the source list (Reuters, AP, IRNA, Yonhap, Al Jazeera,
  UN News, SCMP, Irrawaddy).

## Implementation (all written fresh in this session)

- `main.ts`: software rasteriser (pixel/line/circle/scanline polygon
  fill), hand-written 5x7 bitmap font (A-Z, 0-9, punctuation), hand-written
  PNG encoder (CRC32; DEFLATE via Node stdlib zlib level 9). Node 22
  stdlib only, no network, no randomness, no runtime date — deterministic.
- Nothing was copied from yesterday's newsimage-bot: no file of it was
  opened or read. Only the shared technique (rasterise + bitmap font +
  PNG encode) was reused, with all code written anew.

## News sources (each story cross-checked against at least two sources)

1. HORMUZ — 3 tankers hit mines in the Strait of Hormuz (IRNA, Reuters)
2. KOREA — Russian jets enter Korea air defence zone; false "suspected
   North Korean aircraft" alert near Ulleung Island (Yonhap, AP)
3. INDONESIA — candy factory fire death toll rises to 26 (AP, Channel
   News Asia, Xinhua)
4. UKRAINE — Kyiv defends Libya strike as self-defence; Zelenskyy
   confirms a separate strike on a Russian cargo ship in the Gulf of
   Finland (Reuters, 24 Nov)
5. GAZA — Israeli strikes kill at least 6 (Reuters)
6. DR CONGO — fighting traps Ebola response teams (UN News, WHO)
7. IRAQ — PM orders federal takeover of Kurdish oilfields and ports
   (Al Jazeera, Arab News)
8. EU — proposed 22nd sanctions round, incl. a ban on the Russian flag
   at sporting events (SCMP)
9. NVIDIA — cools after a +31% Monday surge (Al Jazeera, Le Monde)
10. MYANMAR — UK sanctions 5 generals after the ICJ genocide ruling
    (SCMP, Irrawaddy)

No numbers or details beyond the brief were added to the image.

## Verification

- Two runs after the Asia-polygon fix, both byte-identical:
  sha256 `e208906da5c5c0e2407884b0c9932f95cc46362320cf90c5295b403b98efb602`
  (23,234 bytes; 1024x1024 RGB PNG, well under the 1 MiB cap).
- First build had the same sha256 across runs too
  (`9ee3fa85…`, 23,482 bytes) but its Asia polygon drew a diagonal
  wedge across Siberia — fixed, re-ran twice, re-verified.
- Visual check (full size): date dominates; all ten headlines and
  sublines legible; all continents recognisable; all ten dots sit on
  the right coasts/regions; no overlaps or garbled text.
- Visual check (300 px nearest-neighbour thumbnail): "24 NOVEMBER 2026"
  and "TUESDAY" stay clearly readable; the map with gold dots and the
  numbered list structure remain recognisable; sublines are too small
  to read at that size, as expected — the headlines and date carry it.
