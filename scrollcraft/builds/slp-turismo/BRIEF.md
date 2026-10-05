# BRIEF: Visit San Luis Potosí ("Cuatro mundos")

Self-authored under explicit creative delegation, then approved by the client
on 2026-10-04 with the decisions recorded at the end of this file.
Client words are quoted; everything else is an authored decision marked
[authored]. Facts are never asserted here: anything geographic, temporal,
official or numeric is **pending** until verified against an official source.

## What it is, who it is for

A premium tourism website for the state of San Luis Potosí, Mexico. Currently
an academic MVP that must already feel like a real tourism site.
Audience [authored]: domestic travelers and international independent
travelers who do not know the state's municipalities. Spanish first,
English second.

## What the visitor must believe by the end

"San Luis Potosí is not a single destination, but four completely different
worlds inside one state."

## The one action

**Planea tu viaje** (EN: Plan your trip). One label, used everywhere.

## 1. Vibe

Client: "cinematic, immersive, editorial, premium, exploratory."
References outside the web [authored]: Ron Fricke's *Baraka* (patience and
scale); an INEGI topographic sheet (contours, cartographic restraint); Las Pozas
in Xilitla (the human and the surreal swallowed by jungle).
Client UX references, for behavior only: Japan Travel (IA), Visit Finland
Lapland (regional pages), Black Tomato (storytelling), MySwitzerland (seasonal,
exploration), New Zealand (planning), Remote Lands (itineraries, conversion).

## 2. Scroll journey

Client: CURIOSITY → DISCOVERY → WONDER → EXPLORATION → DESIRE → PLANNING →
ACTION. "The visitor should feel as if they are travelling deeper into San Luis
Potosí while scrolling." [authored] "Deeper" is literal: the page descends from
the high desert to the jungle river.

## 3. Energy curve

Calm open, authored silence, loudest at the regions, steadier through
exploration, quiet and practical through planning, warm firm close.
"Rich and immersive, but controlled."

## 4. Feeling curve (home)

| # | Section | Feeling | Cause on screen |
|---|---|---|---|
| 1 | Hero | Curiosity | A desert held at dawn; the headline between far sierra and near stone; a line along the horizon falls away to the right |
| 2 | Introduction | Discovery | Ivory paper, one sentence, the whole line draws once: the state descends |
| 3 | The Descent | **Wonder (peak)** | The land drops under the hand and the world beneath the line cuts four times |
| 4 | Must-see | Longing | Named real places, captions set like museum labels |
| 5 | Explore by interest | Recognition | Pick "cascadas" or "cielo nocturno" and the line lights where they are |
| 6 | Map | Orientation | The state stops being abstract; filters answer |
| 7 | Experiences + guides | Anticipation | Hands and people doing things; guides named |
| 8 | Itineraries | Possibility | Days travel sideways along a route |
| 9 | Now | Urgency | What is on, what is in season |
| 10 | Stories | Intimacy | One first-person editorial voice |
| 11 | Plan your trip | Confidence | Stays, access, mobility, guides, effortless |
| 12 | FAQ | Reassurance | Short answers, fast |
| 13 | Close | Resolution | The bottom of the line, river at dusk, your saved places stamped on it |

## The peak

Act 3, The Descent. "You scroll and the desert just drops away, and the world
under the line changes four times until you're at the river in the jungle."
(The altitude figures join this sentence only once INEGI data is verified.)

## Tell-someone sentence

It's the site where you scroll down a mountain: the line of the land falls from
the desert to the jungle and the world beneath it changes four times.

## Authored silence

Act 2 (Introduction): ivory ground, no photography, one sentence, the line
drawing itself. Intentional. Not dead scroll.

## 5. Signature move

The state's elevation profile is the navigation. One continuous line is the
hero horizon, the frame of the four worlds, the regional progress system, the
menu, the map's companion, the Mi Ruta record and the closing route.
One San Luis Potosí = the continuous terrain line. Four worlds = distinct
hard-cut regional transitions. No continuous morph.

## 6. Aesthetic range

Editorial with cinematic photography. "Not ultra-minimal." "70%
cinematic/editorial, 30% functional."

## 7. Structure

One continuous line, four distinct worlds. Hard cuts between regions; continuity
carried by the line and by one day of light (dawn Altiplano, morning Centro,
midday Zona Media, late afternoon Huasteca, dusk at the close).

## 8. Assets

Client library in preparation (photos, drone, video, shot lists). No AI
imagery. Designed placeholders that state slot ID, aspect, region, subject and
media type until real assets arrive.

## Grammar: Altitude atlas (new)

- Sequence is geography: the cinematic part is ordered west to east, high to low.
- The line is the chrome.
- Hero = an establishing position at the top of the line.
- Ending = arrival at the lowest point plus the visitor's route.
- Bans: drift across a region boundary, chained flights between regions, card
  grids as structure, magnet, centred hero copy, a region's accent outside its
  region, more than two scrubs, counters with unverified numbers.

## Score (home, cinematic acts)

| Beat | Device | Why |
|---|---|---|
| Hero | layered parallax (sticky) | Depth and scale before a single word is read |
| Introduction | flow, line drawn from `--sc-p` | Silence; the fact arrives as a drawing |
| The Descent | pin + bespoke terrain mask + reveal cuts | The scroll is the descent; cuts are the four worlds |
| The Drop | scrub (one clip, Huasteca) | The only video on the page goes to the peak |
| Itineraries | pan | Days run sideways |
| Close | short pin, holds | Resolution |

## Approved decisions (2026-10-04)

1. Home 18 → 14 sections, regional 16 → 14. All content and function preserved.
2. The Descent approved. No AI-style continuous morph.
3. Spanish primary, English secondary, ES/EN architecture from day one.
4. No unverified geographic or tourism fact is hardcoded. Fact<T> with
   pending/verified status. Sources: INEGI, Gobierno del Estado de SLP,
   Secretaría de Turismo de SLP, SECTUR/DataTur, municipal and protected-area
   sources. The Descent runs on a schematic profile with numeric altitudes
   disabled until INEGI data is verified.
5. MVP: home (14 sections) + Huasteca on a reusable regional template; data
   structures for Altiplano, Centro, Zona Media, Huasteca.
6. Academic project: Git, GitHub-ready, GitHub Pages compatible, no paid
   services, no external hosting, no deploy or push without instruction.
7. MapLibre + PMTiles are in the MVP, lazy loaded. Demo geographic data is
   allowed only when clearly labeled as demo.
