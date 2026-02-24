# Implementation Plan: Redesign "Filme Adăugate Recent" Section

## Goal

Replace the current 15 movies in the "Filme adăugate recent" carousel with 20 top-grossing movies of all time. Each movie card will display:

- **Movie poster** (high-quality image)
- **IMDb rating** (★ score)
- **Release date** (formatted as DD.MM.YYYY)
- **Trailer** (YouTube embed via existing modal)
- **HD / 4K badge** (overlay in the corner of the poster)

---

## Current Architecture

| File | Role |
|---|---|
| `index.html` (lines 466–487) | Section shell with empty `#recent-movies-track` container |
| `script.js` (lines 411–518) | `recentMovies[]` data array — 15 objects with `title`, `query`, `poster`, `releaseDate`, `trailerUrl` |
| `script.js` (lines 523–571) | `renderRecentMovies()` — generates movie card HTML from the array |
| `script.js` (lines 677–801) | Infinite carousel logic, auto-scroll, drag, trailer modal |
| `style.css` | Styles for `.movie-card`, `.movie-card__poster`, etc. |
| `posters/` directory | 15 `.jpg` poster images (will be replaced with 20 new ones) |

---

## The 20 Movies — Data Reference

| # | Title | IMDb Rating | Release Date | YouTube Trailer ID |
|---|---|---|---|---|
| 1 | Avatar | 7.9 | 2009-12-18 | `5PSNL1qE6VY` |
| 2 | Avengers: Endgame | 8.4 | 2019-04-26 | `TcMBFSGVi1c` |
| 3 | Avatar: The Way of Water | 7.5 | 2022-12-16 | `d9MyW72ELq0` |
| 4 | Titanic | 7.9 | 1997-12-19 | `kVrqfYjkTdQ` |
| 5 | Ne Zha 2 | 7.1 | 2025-01-29 | `rMKmEj7jJXQ` |
| 6 | Star Wars: Episode VII – The Force Awakens | 7.8 | 2015-12-18 | `sGbxmsDFVnE` |
| 7 | Avengers: Infinity War | 8.4 | 2018-04-27 | `6ZfuNTqbHE8` |
| 8 | Spider-Man: No Way Home | 8.2 | 2021-12-17 | `JfVOs4VSpmA` |
| 9 | Zootopia 2 | N/A (TBD) | 2025-11-26 | `GsMmYPqYPpY` |
| 10 | Inside Out 2 | 7.6 | 2024-06-14 | `LEjhY15eCx0` |
| 11 | Jurassic World | 6.9 | 2015-06-12 | `RFinNxS5KN4` |
| 12 | The Lion King (2019) | 6.8 | 2019-07-19 | `7TavVZMewpY` |
| 13 | The Avengers | 8.0 | 2012-05-04 | `eOrNdBpGMv8` |
| 14 | Furious 7 | 7.1 | 2015-04-03 | `Skpu5HaVkOc` |
| 15 | Top Gun: Maverick | 8.2 | 2022-05-27 | `giXco2jaZ_4` |
| 16 | Frozen II | 6.8 | 2019-11-22 | `Zi4LMpSDccc` |
| 17 | Barbie | 6.8 | 2023-07-21 | `pBk4NYhWNMM` |
| 18 | Avengers: Age of Ultron | 7.3 | 2015-05-01 | `tmeOjFno6Do` |
| 19 | Avatar: Fire and Ash | N/A (TBD) | 2025-12-19 | `JiMZhsHPOI0` |
| 20 | The Super Mario Bros. Movie | 7.0 | 2023-04-05 | `KydqdKKyGEk` |

> [!NOTE]
> IMDb ratings and trailer IDs will need to be verified at implementation time. For unreleased movies (Ne Zha 2, Zootopia 2, Avatar: Fire and Ash), we'll use the latest available trailer and placeholder ratings if not yet rated.

---

## Proposed Changes

### 1. Poster Images — External TMDB URLs (High Quality)

✅ **Decision**: Use external TMDB poster URLs directly in the `poster` field of each movie object.

- **URL format**: `https://image.tmdb.org/t/p/w780/{poster_path}` — the `w780` size gives high-quality posters (780px wide, perfect for retina displays)
- **No local files needed** — the old 15 `.jpg` files in `posters/` will be deleted
- TMDB's CDN is fast, globally distributed, and the standard source used by all movie apps

---

### 2. JavaScript Changes — `script.js`

#### [MODIFY] [script.js](file:///e:/VSCode.Antigravity%20Projects/Website%20PixelMagix/script.js)

**a) Replace the `recentMovies` array (lines 412–518)**

Replace all 15 movie objects with 20 new ones. Each object will now include the new `imdbRating` field that the renderer already supports:

```javascript
const recentMovies = [
    {
        title: 'Avatar',
        query: 'Avatar 2009',
        poster: 'https://image.tmdb.org/t/p/w780/kyeqWdyUXW608qlYkRqosgbbJyK.jpg',
        releaseDate: '2009-12-18',
        imdbRating: 7.9,
        trailerUrl: 'https://www.youtube.com/watch?v=5PSNL1qE6VY'
    },
    // ... remaining 19 movies with w780 poster URLs
];
```

**b) Add HD/4K badge to the movie card template (inside `renderRecentMovies`, ~line 544)**

Add a badge overlay element inside `.movie-card__poster` — designed to feel integrated into the poster corner:

```diff
 <div class="movie-card__poster">
     <img src="${posterSrc}" alt="Poster ${movie.title}" loading="lazy"
         decoding="async" onerror="this.src='${placeholderPoster}'">
+    <span class="movie-card__quality-badge">HD/4K</span>
     <button class="movie-card__play" type="button" data-trailer-index="${index}"
         aria-label="Reda trailer pentru ${movie.title}">
         <i class="fas fa-play"></i>
     </button>
 </div>
```

---

### 3. CSS Changes — `style.css`

#### [MODIFY] [style.css](file:///e:/VSCode.Antigravity%20Projects/Website%20PixelMagix/style.css)

Add styles for the HD/4K quality badge — designed to feel like a natural part of the poster, not a floating sticker:

```css
.movie-card__quality-badge {
    position: absolute;
    top: 0;
    right: 0;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.55));
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    padding: 5px 10px;
    border-radius: 0 var(--card-radius, 12px) 0 8px; /* flush with top-right corner */
    text-transform: uppercase;
    letter-spacing: 1px;
    z-index: 2;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    pointer-events: none;
}
```

**Design rationale**: The badge sits flush in the **top-right corner** of the poster with no gap, matching the card's border-radius. It uses a frosted glass effect (`backdrop-filter: blur`) over the poster image with subtle border accents, so it feels like it's *part of* the poster rather than pasted on top. The dark semi-transparent background ensures "HD/4K" text is readable over any poster art.

---

### 4. Section Title Change — `index.html`

#### [MODIFY] [index.html](file:///e:/VSCode.Antigravity%20Projects/Website%20PixelMagix/index.html)

Since we're replacing the recently-added movies with the top-grossing blockbusters of all time, the title "Filme adăugate recent" no longer fits. Update the section header (lines 469–472):

```diff
 <div class="recent-movies-title">
-    <span class="section-tag">Filme noi in platforma</span>
-    <h2>Filme adaugate recent</h2>
-    <p>Ultimele titluri intrate in biblioteca, pregatite pentru seri de film.</p>
+    <span class="section-tag">Blockbustere disponibile acum</span>
+    <h2>Cele Mai Vizionate Filme</h2>
+    <p>Cele mai mari succese cinematografice, disponibile in HD si 4K pe platforma noastra.</p>
 </div>
```

This title better reflects the content — these are the biggest box-office hits ever, not just recently added titles.

---

### 5. Cleanup — Old Poster Files

#### [DELETE] Old posters in `posters/` directory

Remove the following 15 files that are no longer needed (posters now come from TMDB URLs):
- `dead-to-rights.jpg`, `gladiator-2.jpg`, `music-box-happy-and-you-know-it.jpg`, `not-without-hope.jpg`, `nuremberg.jpg`, `p77.jpg`, `preparation-for-the-next-life.jpg`, `prompt.jpg`, `ricky-gervais-mortality.jpg`, `shell.jpg`, `space-time.jpg`, `the-choral.jpg`, `the-history-of-sound.jpg`, `the-sound-of-balloons-2.jpg`, `the-strangers-chapter-2.jpg`

---

## Summary of All Changes

| File | What changes |
|---|---|
| `script.js` | Replace `recentMovies[]` array (15 → 20 movies) with full metadata + `imdbRating`. Add `movie-card__quality-badge` element to `renderRecentMovies()` template. All posters via external TMDB `w780` URLs. |
| `style.css` | Add `.movie-card__quality-badge` styles (flush top-right corner, frosted glass effect). |
| `index.html` | Update section title from "Filme adaugate recent" → **"Cele Mai Vizionate Filme"**, update subtitle and tag text. |
| `posters/` | Delete all 15 old `.jpg` files (no longer needed — posters served from TMDB CDN). |

---

## What Already Works (No Changes Needed)

- ✅ **Trailer modal** — already built into `index.html` (lines 885–898) and `script.js` (lines 720–765)
- ✅ **IMDb rating display** — the `renderRecentMovies()` function already reads `movie.imdbRating` and displays it with a ★ icon
- ✅ **Release date formatting** — the `formatReleaseDate()` function (line 713) already converts `YYYY-MM-DD` → `DD.MM.YYYY`
- ✅ **Carousel/slider** — infinite scroll with auto-play, drag, and prev/next buttons
- ✅ **Responsive layout** — existing CSS handles different screen sizes

---

## Verification Plan

### Browser Visual Testing
1. Run a local server: `npx -y serve .` from the project directory
2. Open the website in a browser
3. Scroll to the **"Cele Mai Vizionate Filme"** section
4. **Verify** all 20 movie cards display with:
   - Poster image loaded from TMDB (not broken)
   - IMDb rating shown (★ 7.9 etc.)
   - Release date in DD.MM.YYYY format
   - "HD/4K" frosted badge flush in the top-right corner of each poster
5. **Click** the play button on 2–3 random movies to verify trailer modal opens with correct YouTube video
6. **Test carousel**: click prev/next arrows, verify smooth scrolling through all 20 cards
7. **Test responsiveness**: resize browser window to mobile and verify cards stack/scroll properly
