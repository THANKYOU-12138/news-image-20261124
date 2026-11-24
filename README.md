# news-image-20261124 — The World in One Picture

A hand-drawn world-map front page summing up Tuesday 24 November 2026:
ten stories, each pinned on the map where it happened, with a short
headline list below.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node 22, standard library only, no network. Writes `out/entry.png`
(1024×1024 PNG, well under 1 MiB). Two runs produce byte-identical output.

## How it is drawn

`main.ts` is written from scratch: a small software rasteriser
(pixels, lines, circles, scanline polygon fill), a hand-written 5×7
bitmap font covering A–Z, 0–9 and common punctuation, and a hand-written
PNG encoder (CRC32 + Node stdlib zlib for DEFLATE). The continents are
coarse hand-drawn polygons in equirectangular projection; the ten
numbered gold dots mark where each story happened.

## The ten stories (24 Nov 2026)

1. Hormuz — 3 tankers hit mines
2. Korea — Russian jets enter Korea zone
3. Indonesia — factory fire toll 26
4. Ukraine — Kyiv defends Libya strike
5. Gaza — Israeli strikes kill 6
6. DR Congo — fighting traps Ebola teams
7. Iraq — Baghdad seizes Kurdish oilfields
8. EU — 22nd sanctions, flag ban
9. NVIDIA — cools after +31% day
10. Myanmar — UK sanctions 5 generals

Sources: Reuters, AP, IRNA, Yonhap, Al Jazeera, UN News, SCMP, Irrawaddy.
