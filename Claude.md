# GottaGo — Claude Code Briefing Document

## What is GottaGo?
GottaGo is a community-driven bathroom finder app — think Yelp for public restrooms. Users can find nearby bathrooms, see cleanliness ratings, filter by amenities, leave reviews, and add new bathrooms. The core value proposition is crowdsourced real-time cleanliness scores displayed prominently on both a list and map view.

The app was built from scratch by a first-time developer (Steven, no prior coding experience) with Claude's assistance over many sessions. Every decision has been made deliberately and should be respected unless explicitly asked to change.

---

## Tech Stack
- **Framework:** React Native + Expo (managed workflow)
- **Router:** Expo Router (file-based routing)
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth (email/password)
- **Maps:** Google Maps via react-native-maps
- **Location:** expo-location
- **Haptics:** expo-haptics
- **OSM Integration:** Overpass API for seeding bathroom locations
- **Reverse Geocoding:** expo-location reverseGeocodeAsync
- **Distance Calculation:** Custom Haversine formula (utils/distance.ts)
- **Target Platform:** Android (Google Play Store — not yet published)
- **Development Environment:** Windows, VS Code, Expo Go on Android for testing

---

## Project Structure
```
GottaGo/
├── app/
│   ├── _layout.tsx          # Root layout — auth routing, StatusBar
│   ├── login.tsx            # Login/signup screen with kawaii hero
│   ├── review.tsx           # Leave a review screen
│   ├── add-bathroom.tsx     # Add a new bathroom screen
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar layout (List + Map tabs)
│       ├── index.tsx        # List screen (main screen)
│       └── map.tsx          # Map screen
├── utils/
│   ├── distance.ts          # Haversine distance calculation + formatting
│   └── overpass.ts          # OpenStreetMap Overpass API integration
├── firebaseConfig.js        # Firebase initialization
├── .env                     # API keys (never commit)
└── CLAUDE.md                # This file
```

---

## Environment & Configuration
- `.env` contains all API keys — never modify or expose these
- `EXPO_PUBLIC_GOOGLE_MAPS_KEY` — Google Maps API key (restricted to Android app)
- `EXPO_PUBLIC_FIREBASE_*` — Firebase config values
- Firebase project ID: `gottago-33de3`
- Android package: `com.anonymous.GottaGo`
- `app.json` contains Google Maps API key injection and Android config
- `android/local.properties` contains Android SDK path

---

## Firebase Structure

### `bathrooms` collection
```
{
  name: string,
  address: string,
  floor: string,
  cleanliness: number,       // 0 = unrated, otherwise average of all reviews
  reviewCount: number,
  accessible: boolean,
  genderNeutral: boolean,
  free: boolean,
  babyChanging: boolean,
  singleStall: boolean,
  verified: boolean,         // true once at least one review has been left
  source: 'osm' | 'user_submitted' | 'seeded',
  osmId: number,             // only for OSM-sourced bathrooms
  lastCleaned: string,
  distance: string,          // legacy field, now calculated live
  latitude: number,
  longitude: number,
  createdAt: string,
  addedBy: string | null,    // userId
  addedByEmail: string | null
}
```

### `reviews` collection
```
{
  bathroomId: string,
  userId: string,
  userEmail: string,
  rating: number,            // 1-5
  comment: string,
  createdAt: string
}
```

---

## Color Theme
The app uses a consistent navy + teal dark theme throughout:
```
Background:        #0f172a  (deep navy)
Card background:   #1e293b  (slate)
Border:            #334155  (muted border)
Primary accent:    #0d9488  (teal — buttons, active states)
Text primary:      #f8fafc  (near white)
Text secondary:    #64748b  (muted)
Text tertiary:     #475569  (very muted)
Verified badge:    #134e4a bg, #2dd4bf text
Filter badge:      #0f2744 bg, #7dd3fc text

Cleanliness colors:
  Spotless (≥4.5): #22c55e (green)
  Decent (≥3.5):   #f59e0b (amber)
  Rough (<3.5):    #f43f5e (red)
```

---

## Key Product Decisions

### Authentication Philosophy
"Zero friction to view. Accountability to contribute."
- Anyone can browse the map and list without an account
- Account required to leave reviews or add bathrooms
- Login screen has a "Browse without account" option
- Unauthenticated users tapping review/add are redirected to login

### Bathroom States
- **Unrated (cleanliness: 0):** Shows "New" on pins and cards, "Not yet rated" label
- **Verified (cleanliness > 0):** Shows color-coded score, "✓ Verified" badge
- OSM bathrooms are seeded automatically when the map loads

### Distance
- Calculated live using Haversine formula from user's GPS
- Uses `getLastKnownPositionAsync` for instant display, then refines with `getCurrentPositionAsync`
- Formatted as "Here now", "< 0.2 mi", or "X.X mi"
- List is sorted nearest-first by default

### Map Pins
- Double-wrapped View approach for border rendering (Android clips borderWidth on markers)
- Outer View provides colored border effect via background color
- Inner View provides dark background
- No `borderWidth` used on pins — causes clipping on Android

### OSM Integration
- Overpass API queried on map load for bathrooms within 5km
- Duplicate prevention via osmId field
- Reverse geocoding via expo-location for real addresses
- Required attribution: "© OpenStreetMap Contributors" shown on map

---

## Screen-by-Screen Notes

### app/(tabs)/index.tsx — List Screen
- Single control row combining sort pills + icon-only filter pills
- Sort options: 📍 Nearest (default), ⭐ Top Rated
- Filter pills (icon only in main row): 🆓 Free, ♿ Accessible, 👶 Baby
- Expanded panel (tap ⚙): Gender Neutral, Verified, clear all
- Pull to refresh with teal RefreshControl
- Loading skeletons instead of spinner
- useFocusEffect refreshes on tab focus

### app/(tabs)/map.tsx — Map Screen
- Waits for GPS before rendering map (no hardcoded fallback)
- Uses lastKnown position for fast initial render
- Custom map pins (double-wrapped, no borderWidth)
- Bottom card slides up on pin tap
- OSM attribution bottom-left corner
- Seeding runs silently on load

### app/login.tsx — Login Screen
- Dark gradient background (navy to teal)
- Large 🚽 emoji hero with sparkles
- "GottaGo" title, "When nature calls, we answer 🌟" tagline
- Email/password auth
- Toggle between Sign In and Sign Up
- "Browse without account" guest option

### app/review.tsx — Review Screen
- Large star rating (1-5) with emoji labels
- Optional comment field
- Recalculates bathroom's cleanliness average on submit
- Sets verified: true on first review
- Updates lastCleaned timestamp

### app/add-bathroom.tsx — Add Bathroom Screen
- Name, address, floor/location fields
- Amenity toggles (accessible, gender neutral, free, baby changing, single stall)
- GPS captured at submission time
- Saves with source: 'user_submitted', verified: false, cleanliness: 0

---

## Haptic Feedback Pattern
Consistent throughout the app:
- `ImpactFeedbackStyle.Light` — filter pills, toggles, back buttons, minor actions
- `ImpactFeedbackStyle.Medium` — card taps, primary buttons, navigation
- `NotificationFeedbackType.Success` — successful form submission
- `NotificationFeedbackType.Error` — validation errors, failed submissions

---

## utils/distance.ts
```typescript
export function getDistanceMiles(lat1, lon1, lat2, lon2): number
export function formatDistance(miles: number): string
// Returns: "Here now" | "< 0.2 mi" | "X.X mi"
```

## utils/overpass.ts
```typescript
export async function fetchAndSeedNearbyBathrooms(latitude: number, longitude: number): Promise<void>
// Queries Overpass API, reverse geocodes addresses, saves to Firebase
// Skips duplicates via osmId field
```

---

## Known Issues & Workarounds
- **Map pin right border clipping:** Android clips `borderWidth` on MapView markers. Fixed by using double-wrapped Views with background color instead of actual borders. Do not add `borderWidth` to pin styles.
- **GPS delay:** Mitigated by using `getLastKnownPositionAsync` first, then refining with `getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })`
- **Async state after unmount:** All location useEffects use a `cancelled` ref pattern to prevent setState calls after unmount
- **edgeToEdgeEnabled:** Set to false in app.json to avoid status bar issues on Android

---

## Completed Features

### Foundation (Web Chat Sessions)
- First working screen
- Map screen with GPS and colored pins
- Firebase Firestore connection
- Directions integration (list + map)
- Firebase Auth (sign in, sign out, persistence)
- Leave a review with real-time score updates
- Add bathroom with GPS coordinates
- OpenStreetMap integration for automatic bathroom seeding
- OSM attribution on map screen
- New/Not yet rated states for unreviewed bathrooms
- Review count display
- Community verified badge
- Navy + teal theme across all screens
- Empty states (list + map)
- Expandable filter panel
- Loading skeletons on list screen
- Real distance calculation + nearest-first sorting
- Map centering on user GPS (lastKnown fast path)
- Haptic feedback throughout
- Real addresses via reverse geocoding (OSM bathrooms)
- Pull to refresh on list screen
- Sort options + redesigned single-row control bar

### Claude Code Sessions
- Screen transition animations (fade, slide_from_bottom)
- Location permission error handling across all screens
- Star display instead of numbers (list + map cards)
- Animated score bar fill on list cards (bar matches star rounding)
- Better empty states (no bathrooms vs filtered out, motivating copy)
- First-time onboarding flow (3 slides, AsyncStorage, skip button)
- Last verified relative timestamp (2h ago, Yesterday, etc.)
- Bathroom detail full screen
- Review history on detail screen (masked email: stev••••)
- Content reporting (report listing + report review → Firestore reports collection)
- Return-to-destination login flow (report → sign in → back to detail)

---

## Remaining Task List

### Blockers (shelved):
- App icon + splash screen (artwork needed first)
- Privacy policy (on hold — owner considering LLC vs personal)
- Status bar color (stubborn Android issue)
- Play Store listing content

### V3 Remaining:
- Seed database with real reviews before launch — **20 min**

### V4 Features:
- Review success celebration screen — **15 min**
- One review per user per bathroom — **15 min**
- Share a bathroom via link — **20 min**
- Save favorite bathrooms — **25 min**
- Photo uploads on reviews — **60 min**
- Better empty state for no bathrooms *(pending real-world test)*

### Future:
- User profiles with review history
- Push notifications
- Offline mode
- Apple App Store version
- Web version

---

## Coding Conventions
- TypeScript throughout — always add proper types
- StyleSheet.create for all styles — no inline style objects except for dynamic values
- Always use the navy+teal color theme — never introduce new colors without asking
- Haptic feedback on every interactive element — see pattern above
- Full file replacements preferred over surgical edits when making significant changes
- Always add `let cancelled = false` cleanup pattern to async useEffects
- Never hardcode GPS coordinates — always use live location
- Never expose API keys — always use EXPO_PUBLIC_ env vars

---

## GitHub
Repository: github.com/s42r11/GottaGo
Branch: master
All work committed regularly with descriptive commit messages.

---

## Developer Notes
- Steven is a first-time developer — explain things clearly when introducing new concepts
- Prefer sending complete file contents over surgical diffs — easier to copy/paste correctly
- Always remind to copy before scrolling on long code blocks
- The app is tested exclusively on a Google Pixel via Expo Go
- Windows development environment — use Windows-compatible commands
- Git commands with parentheses in paths need quoting: `git checkout -- "app/(tabs)/map.tsx"`

---

## Why These Technologies Were Chosen

### Expo Managed vs Bare
Chosen because Steven is a first-time developer. Managed workflow handles native build complexity automatically. Bare workflow was never seriously considered — the simplicity of managed was essential for a beginner getting started fast.

### Firebase vs Supabase
Supabase was evaluated early on but Firebase was chosen for its simpler React Native integration and better Expo compatibility. A Supabase project was actually created during evaluation but never used — it was later archived. Firebase Auth + Firestore covered all needs without additional complexity.

### React Native + Expo vs Other Frameworks
Flutter and native Android were briefly considered. React Native + Expo was chosen because JavaScript/TypeScript is more widely documented, Claude can assist more effectively with it, and Expo Go allows instant testing on a physical device without a build step.

### Google Maps vs Apple Maps vs OpenStreetMap Tiles
Google Maps chosen for Android because it's the native expected experience. OSM is used only as a data source via Overpass API — not for map tile rendering. Apple Maps was never considered since target platform is Android only.

### expo-location vs react-native-geolocation
expo-location chosen because it's the Expo-recommended package and works without ejecting. Includes both foreground permissions and reverse geocoding in one package.

---

## Explicitly Rejected Decisions

### Hardcoded fallback GPS coordinates
Early map implementation used `33.7748, -84.3642` (Atlanta area) as a fallback while waiting for GPS. This was rejected because it caused the map to always open centered on a cluster of seeded test bathrooms rather than the user's actual location. Fixed by waiting for real GPS before rendering the map at all.

### borderWidth on map pins
Originally used `borderWidth: 2.5` on map marker Views. Android's Google Maps implementation clips the right border of custom markers, making pins look broken. Rejected in favor of a double-wrapped View approach where the outer View's background color creates the border effect visually.

### localStorage / AsyncStorage for bathroom data
Considered caching bathrooms locally to speed up load times. Rejected in favor of always fetching fresh from Firebase, supplemented by the `getLastKnownPositionAsync` pattern for GPS speed.

### Supabase as backend
Created a Supabase project early on but abandoned it in favor of Firebase before any real integration work began.

### Dark mode toggle
Was on the v3 feature list but deprioritized. The app is dark-mode first by design — the navy theme IS the dark mode. A light mode would require a complete redesign and was deemed not worth the effort for v1.

### useState for auth redirect (vs useRef)
Originally used `useState(false)` to track whether auth redirect had happened. Caused an infinite redirect loop. Fixed by switching to `useRef(false)` which doesn't trigger re-renders.

### Overpass API bulk import
Considered importing a large dataset of bathroom locations from OSM in bulk. Rejected in favor of on-demand seeding triggered by the user's GPS location, to avoid filling Firebase with irrelevant global data.

---

## "Browse Without Account" UX Flow — Detailed

### Login Screen
- Shows "Browse without account" button below the divider
- Tapping it calls `router.replace('/(tabs)')` — navigates directly to the app
- `auth.currentUser` will be `null` for this session

### Auth State
- `onAuthStateChanged` in `_layout.tsx` handles persistent login
- Uses `useRef(false)` (not useState) to prevent re-render loops
- If user has a saved session, routes to `/(tabs)` automatically
- If no session, routes to `/login`

### What Anonymous Users CAN Do
- View the full bathroom list
- See all scores, badges, and amenity info
- View the map with all pins
- Tap pins to see bathroom detail cards
- Get directions to any bathroom

### What Anonymous Users CANNOT Do
- Leave a review
- Add a new bathroom

### How Blocking Works
Every action that requires auth checks `auth.currentUser`:
```typescript
if (!auth.currentUser) {
  router.push('/login');
} else {
  // proceed with action
}
```
This check exists in:
- List screen "Leave a Review" button
- List screen "+ Add" header button
- Map screen "Leave a Review" button
- Map screen empty state "+ Add a Bathroom" button
- add-bathroom.tsx itself (redundant safety check)

The redirect pushes to `/login` (not replace) so the user can go back after signing in. The review and add-bathroom screens are not directly accessible via URL — they're always reached via button press which includes the auth check.

## Claude Code Q&A — Additional Clarifications

### Data & Logic

**1. source: 'osm' vs source: 'seeded'**
These are effectively the same thing and the inconsistency is a known artifact. Early seeded records (added via a one-time seedDatabase.js script) have source: 'seeded'. Records added via the Overpass API integration have source: 'osm'. In practice, treat both identically — unverified, no cleanliness score, community-contributed. The osmId field is only present on source: 'osm' records and is used for duplicate prevention. source: 'seeded' records have no osmId.

**2. verified: true — client-side or Cloud Function?**
Entirely client-side. Set directly in review.tsx during the review submission flow via updateDoc. There are no Firebase Cloud Functions in this project at all. Everything is client-side Firestore reads and writes.

**3. lastCleaned format**
Not an ISO string — it's a human-readable string. Examples:
- `'Unknown'` — default for OSM and user-submitted bathrooms before first review
- `'12 min ago'` — set during seeding for some early records
- `'10:32 AM today'` — set at review submission time via `new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' today'`
It is displayed directly as-is on the card. No date parsing happens on the frontend.

**4. addedBy / addedByEmail for OSM bathrooms**
Both are null for OSM-seeded bathrooms. Only user_submitted bathrooms have these fields populated.

---

### UX Flows

**5. After redirect to login then sign in — where do they land?**
They land at the home screen `/(tabs)`, not back at what they were trying to do. The redirect uses `router.push('/login')` which adds login to the stack, but after successful auth `router.replace('/(tabs)')` is called which clears the stack entirely. There is no "return to intended destination" flow currently implemented. This is a known UX gap accepted for v1.

**6. Map bottom card actions**
The card that slides up on pin tap has three buttons:
- **✍️ Leave a Review** — navigates to `/review` with bathroomId and bathroomName params (auth-gated, redirects to login if not signed in)
- **🗺 Directions** — opens native navigation app via `Linking.openURL` with Google Maps directions URL
- **✕ Close** — dismisses the card, sets selected to null
It is NOT info-only — full review and directions actions are available from the map card.

---

### Current Blockers

**7. Status bar color — what's already been tried**
Extensive attempts were made without success:
- `statusBarColor` field in `app.json` under the android section — no effect
- `statusBar` object in `app.json` with `backgroundColor` and `barStyle` — no effect
- `<StatusBar style="light" backgroundColor="#0f172a" />` from expo-status-bar in `_layout.tsx` — no effect
- Setting `edgeToEdgeEnabled: false` in app.json — caused layout issues, reverted
The root cause is believed to be `edgeToEdgeEnabled: true` in app.json conflicting with status bar color settings. This is an Android-specific issue. The StatusBar component from expo-status-bar is already imported and used in `_layout.tsx`. Any solution must be compatible with `edgeToEdgeEnabled: true`.

**8. App icon / splash screen design direction**
Several kawaii-style options were generated via AI image tools and evaluated:
- Kawaii toilet (Option A) — cute smiling toilet with sparkles, mint green background
- Kawaii map pin + toilet (Option B) — map pin shape with toilet face inside, blue
- Kawaii water drop (Option C) — smiling water drop with sparkles
- Kawaii toilet paper + map pin (Option D) — toilet paper roll shaped as map pin
- Kawaii bathroom sign (Option E) — cute gender-neutral bathroom figure

None were selected as final. The login screen currently uses a large 🚽 emoji with sparkles as a placeholder hero. The developer is undecided and open to suggestions. Any icon must be 1024x1024px PNG for Play Store submission.

---

### Misc

**9. Full file replacements vs surgical edits**
The "full file replacements preferred" convention was specific to the web chat workflow where copy-paste was the only option. In Claude Code, please use precise surgical edits — only change what needs to change. This is cleaner, safer, and takes better advantage of Claude Code's direct file access. The convention in CLAUDE.md should be understood as a web chat artifact, not a preference for how code should be edited going forward.
```