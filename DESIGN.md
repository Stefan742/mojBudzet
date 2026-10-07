# DESIGN.md — Мој Буџет visual design, Phase A

Inspection only. No code was changed for this document. Numbers below come from a script that counted every style value in `app/`, `screens/` and `components/` (2026-10-07, branch `polish-pass` @ `d1b876e`).

Goal for Phase B: a calm, spacious, native-feeling iOS 26 app. Depth comes from blur and subtle shadows, not from decoration. The current look is kept and tightened, not replaced.

---

## 1. Current style, as it is

### 1.1 Colour tokens (`hooks/useTheme.ts`)

There is one token set per theme, read through `useTheme()`. The app theme can override the system theme. `ThemeProvider` also pushes that choice to the native appearance (`components/ThemeProvider.tsx`).

| Token | Light | Dark | Notes |
|---|---|---|---|
| `background` | `#f2f2f7` | `#000000` | Same as iOS `systemGroupedBackground` |
| `card` | `#ffffff` | `#1c1c1e` | Same as `secondarySystemGroupedBackground` |
| `cardBorder` | transparent | `#2c2c2e` | Only Settings uses it |
| `text` | `#000000` | `#ffffff` | |
| `textSecondary` | `#666666` | `#ebebf5cc` (80%) | Light is a custom grey; dark is close to iOS |
| `textTertiary` | `#6e6e73` | `#ebebf599` (60%) | Raised for contrast in the audit pass |
| `separator` | `#e0e0e0` | `#38383a` | Light is not the iOS separator (`#c6c6c8` opaque) |
| `inputBg` | `#f2f2f7` | `#2c2c2e` | |
| `accent` / `tint` | `#007AFF` | `#0a84ff` | iOS `systemBlue`; two identical tokens |
| `destructive` | `#FF3B30` | `#ff453a` | `systemRed` |
| `success` | `#34C759` | `#30d158` | `systemGreen` |
| `warning` | `#FF9500` | `#ffd60a` | Dark uses *yellow*, light uses *orange* |
| `vault` / `vaultBg` | `#c2410c` / `#FFF7ED` | `#fb923c` / `#3b2410` | Tailwind-style oranges, not system colours |
| `successBg` / `successText` | `#dcfce7` / `#15803d` | `#0f2e1a` / `#4ade80` | Tailwind-style greens |
| `onAccent`, `shadow` | `#fff`, `#000` | same | |

Data colours (not themed):
- Category and goal palette: `constants/palette.ts`. These are 9 **Material Design** colours (`#4CAF50 #FF9800 #2196F3 #F44336 #9C27B0 #00BCD4 #FFC107 #795548 #E91E63`), also used by the built-in categories in `models/Category.ts`.
- Budget bucket colours: `screens/Budgetscreen.tsx:32-38`, the same Material set.

Tints are made by appending hex alpha to a colour, ad hoc: `colors.accent + "18"`, `${cat.colorHex}22`, `33`, `15`, `20`. That gives five different alpha steps across screens.

### 1.2 Typography

- **Font:** the system font (SF Pro on iOS, Roboto on Android). Nothing is bundled.
- **Sizes in use:** 16 distinct values: `11×2 12×23 13×20 14×17 15×24 16×32 17×10 18×4 19×1 20×6 22×2 24×1 28×1 30×1 34×7 38×1`.
- **Weights in use:** `400×2 500×16 600×40 700×19 800×2`.
- **Large titles:** every tab screen has `fontSize 34, fontWeight 700, letterSpacing 0.3`, as a plain `Text` (for example `screens/Overviewscreen.tsx:535`, `Historyscreen.tsx:379`). They never collapse into an inline title.
  - On Overview, History, Add and Savings the title is fixed above the scroll view.
  - On Budget and Settings it scrolls away with the content (`Budgetscreen.tsx` ListHeader, `Settingsscreen.tsx` inside the ScrollView).
- **Section headers:** uppercase strings in the translation files, `12/600`, `letterSpacing 0.5` (`Addtransactionscreen.tsx:348`, `Historyscreen.tsx:406`, `Savingsscreen.tsx:856`, `Settingsscreen.tsx:574`). Overview and Budget have none.
- **Money:**
  - balance `38/700`, letterSpacing −0.5 (`Overviewscreen.tsx:540`)
  - leftover pill `24/800`
  - vault `19/800`
  - AI income input `28/700`
  - onboarding `30/700`
  - vault-transfer input `22/700`

  Digits are proportional, so amounts shift width as they change. No `fontVariant: ["tabular-nums"]` anywhere.
- **Body text** is mostly 16 (rows, inputs). iOS body is 17, and 16 is iOS "callout".

### 1.3 Spacing

- 27 distinct padding and margin values: `-6 -4 -2 0 1 2 3 4 5 6 8 10 12 13 14 15 16 18 20 21 24 28 32 40 52 60 80`.
- 11 distinct gap values: `3 4 5 6 7 8 10 12 16 20 32`.
- The most common are 16 (×57), 12 (×35), 8 (×30) and 4 (×25). About a third of the values are off a 4-pt grid (3, 5, 13, 14, 15, 18, 21).
- **Screen side margin** varies by screen:
  - 20: Overview, Add, Budget, title rows
  - 16: Savings list, Settings sections, modal sections
  - 12: History list and search bar

  So the large title and the content below it don't share a left edge on History (20 vs 12) or Savings (20 vs 16).
- **Bottom space** comes from `useTabBarSpace()` (`constants/layout.ts`), consistent since the audit pass.

### 1.4 Corner radii

There are 22 distinct values: `2 3 4 5 6 7 8 10 12 14 15 16 18 20 22 24 28 30 50` plus computed ones. Cards alone use four:

| Surface | Radius | Where |
|---|---|---|
| Overview cards, vault card | 20 | `Overviewscreen.tsx:538`, `Savingsscreen.tsx:810` |
| Add cards, History list, Budget rows, goal cards, Settings sections | 16 | `Addtransactionscreen.tsx:352`, `Budgetscreen.tsx:405`, `Savingsscreen.tsx:824`, `Settingsscreen.tsx:576` |
| Editor sheets (History, Savings, Settings) | 12 | `Historyscreen.tsx:407`, `Savingsscreen.tsx:857`, `Settingsscreen.tsx:610` |
| Budget preview rows, buttons, onboarding inputs | 14 | `Budgetscreen.tsx:478,499` |
| Modal card, bottom sheet | 24 | `Overviewscreen.tsx:503`, `Savingsscreen.tsx:773` |

No surface uses `borderCurve: "continuous"`, so corners are circular arcs, not the iOS squircle. React Native 0.86 supports it (`StyleSheetTypes.d.ts:480`).

### 1.5 Surfaces and shadows

- **Grouped cards** mostly use `shadowColor #000, shadowOpacity 0.06, shadowRadius 10, offset (0,2), elevation 3` on Overview, Add, Budget, Savings and Settings. The History list has no shadow. Settings adds a hairline border, and the editor sheets have neither.
- **Floating elements:**
  - tab bar: 0.10 / 24 / (0,10), elevation 18
  - modal card: 0.18 / 24 / (0,8), elevation 12
  - Savings toast: 0.12 / 16
  - coloured accent glows: Budget AI button 0.28, Add Save button 0.3 in the accent colour
- **Dark mode:** shadows are still set, but black on black does nothing.
- **Scrims:** three different strengths: `rgba(0,0,0,0.45)` for the Overview modal, `0.4` for the vault sheet, `0.32` for the Android More sheet.

### 1.6 Tab bar and More menu (`app/(tabs)/_layout.tsx`)

**iOS:** a custom floating pill, 70 pt tall, inset 20 pt from the sides.
- Glass:
  - iOS 26: `GlassView` with `regular` glass and the app's colour scheme
  - older iOS: `BlurView` with intensity 90 and `systemUltraThinMaterial`, plus a 20% white (light) or 45% dark overlay
  - Reduce Transparency: opaque card colour with a hairline border
- The active tab gets a small "clear" glass pill (44×30) with a 14% white top glow. "Add" always has a pill.
- Icons are Ionicons outline and filled pairs at 20 pt; labels 11 pt / 500.
- Colours are 29 hand-tuned `rgba` literals, not tokens. Light inactive is 60% black, dark inactive 62% white.
- Haptics: light impact on tabs, medium on Add, selection on More.

**More menu (iOS):** two floating glass pills (Budget, Settings) anchored above the bar, with a 65% tint. They spring in (`tension 70, friction 11`), and there's no backdrop dimming.

**Android:** a solid Material-style bottom bar with a pill indicator and ripples. More opens a bottom sheet with a 32% scrim (spring `damping 20, stiffness 200`).

### 1.7 Charts and progress (`screens/Overviewscreen.tsx`)

- **Donut:** custom SVG.
  - Size `min(width − 80, 260)`, stroke 13% of the size, 2° gaps between segments, segment opacity 0.93.
  - The track uses the theme separator colour.
  - The hole is a card-coloured circle 52% of the size, holding "Spent" (12) and the amount (17/700).
  - Reveal: fades and scales from 0.92 to 1 over 450 ms, skipped with Reduce Motion.
- **Legend:** rows with an 11 pt dot, name 15, amount 14/500 and percent 13. Hairline dividers inset 21 pt.
- **Progress bars:** two heights. 8 pt (radius 4) on Budget and goal cards; 4 pt (radius 2) in the modals.

### 1.8 Buttons

| Kind | Look | Where |
|---|---|---|
| Primary filled | accent fill, white 16–17/600, radius 14, padding 14–18, sometimes an accent glow | Add Save, Budget modal, Leftover, vault transfer, onboarding, error screen |
| Tinted | accent at 18% fill + 1.5 pt accent border | Leftover "Carry over" (`Overviewscreen.tsx:214`) |
| Header text | Cancel (red 17) / Save (accent 17/600) | `components/ModalHeader.tsx` |
| Small pill | `background`-coloured fill, 14/600, radius 10 | Savings "Add money", "Transfer" |
| Icon square | 44×44, radius 10 | Savings confirm and cancel |
| Destructive row | card fill, red text + trash icon | editors |

Press feedback is `TouchableOpacity` with six different `activeOpacity` values (0.7, 0.75, 0.78, 0.8, 0.82, 0.85). Nothing scales and no row highlights.

### 1.9 Inputs

- **In-list inputs:** borderless, 16 pt, padding 16/14, separated by hairlines (Add, editors). Close to iOS grouped style.
- **Filled inputs:** `inputBg`, radius 10, 15 pt (Budget limit, Savings add money).
- **Hero amount inputs:** 22, 28 or 30 pt bold, in a filled rounded box (vault transfer, AI income, onboarding).
- **Errors:** red 13 pt text under the field. Hints: secondary 12–13 pt.

### 1.10 Chips and segmented controls

- **Chips** (`components/ChipRow.tsx`): radius 20, min height 40, 14 pt. Selected chips fill with the category colour and white text; unselected use `inputBg`.
- **Segmented control** (Expense/Income): custom. Track `inputBg`, radius 8, 3 pt inset; segments radius 6, selected segment filled with the accent and white text. iOS's native segmented control uses a white "thumb" on a grey track, not an accent fill.

### 1.11 Sheets and modals

- **Editors** (History, Savings, Settings): RN `Modal`, `presentationStyle="pageSheet"`, plus `ModalHeader`.
- **Budget AI:** a pageSheet with its own header (an X icon instead of Cancel/Save).
- **Leftover:** a centred card with radius 24 over a scrim.
- **Vault transfer:** a custom bottom sheet (radius 24, grab handle, `animationType="slide"`).

None of these use native sheet detents.

### 1.12 Toasts

There are two different designs:
- **Add:** an inverted pill (text-colour background) fading in at the top, 250 ms.
- **Savings:** a card-coloured pill with an emoji (🎉 💪 ✅) springing down from above.

Neither respects Reduce Motion. `savings.goalAchieved` also contains "🎉".

### 1.13 Haptics

These exist only in the tab bar and More menu (`app/(tabs)/_layout.tsx:200,255,290,327`). There are none on save, delete, goal reached, chip or segment selection, or the rollover choice.

### 1.14 Motion

There are 12 animations:
- `Animated.timing`: Add toast, donut, loading screen, Android More fade, Savings toast exit.
- `Animated.spring`, each with different parameters:
  - More menu: `tension 70 / friction 11`
  - Android sheet: `damping 20 / stiffness 200`
  - Savings toast: `damping 18 / stiffness 200`
  - goal swipe: default spring

Reduce Motion is respected by the donut, loading screen and both More menus. It isn't respected by the toasts or the goal swipe.

### 1.15 Light and dark

- The token coverage is good. Screens read `colors.*` and nothing in screen styles hard-codes black or white text any more.
- **Remaining hard-coded colours:**
  - tab bar rgba literals (29)
  - Loading screen logo greys
  - onboarding icon `#4CAF50`
  - bucket colours
  - white checkmarks on swatches
  - scrims
- **Weak spots:** shadows that do nothing in dark mode, and Settings being the only screen with a dark border.

---

## 2. Inconsistencies (what Phase B would fix)

| # | Inconsistency | Where |
|---|---|---|
| 1 | Four card radii (12, 14, 16, 20) for the same "grouped section" role; 22 radii overall | §1.4 |
| 2 | Three side margins (12, 16, 20); title and content edges don't line up on History and Savings | §1.3 |
| 3 | 16 font sizes and 5 weights; one-offs 19, 22, 24, 28, 30, 38; weight 800 twice | §1.2 |
| 4 | Large titles fixed on 4 screens and scrolling on 2; none collapse; `letterSpacing 0.3` fights SF's built-in tracking | §1.2 |
| 5 | Section headers on 4 screens; Overview and Budget group content without them | §1.2 |
| 6 | Shadows on most cards but not History; Settings alone has a dark border; shadows set in dark mode where they do nothing | §1.5 |
| 7 | Three scrim strengths (0.32 / 0.4 / 0.45) | §1.5 |
| 8 | Six `activeOpacity` values; no pressed-row highlight; no press scale | §1.8 |
| 9 | Primary buttons vary in height (padding 14–18), size (16 vs 17) and glow (Budget 0.28, Add 0.3, others none) | §1.8 |
| 10 | Progress bars 8 pt and 4 pt for the same meaning | §1.7 |
| 11 | Two toast designs; emoji in toasts and strings | §1.12 |
| 12 | Four modal and sheet styles (pageSheet with ModalHeader, pageSheet with X, centred card, custom bottom sheet) | §1.11 |
| 13 | Segmented control filled with accent instead of iOS's neutral thumb | §1.10 |
| 14 | Category palette is Material (`#4CAF50`, `#2196F3`, …) next to iOS system blue, red and green; `warning` is orange in light and yellow in dark; vault and success tints are Tailwind shades | §1.1 |
| 15 | Ad hoc hex-alpha tints (`+"18"`, `22`, `33`, `15`, `20`) | §1.1 |
| 16 | Tab bar colours are 29 rgba literals instead of tokens | §1.6 |
| 17 | Haptics only in the tab bar | §1.13 |
| 18 | Spring parameters differ per animation; toasts and the goal swipe ignore Reduce Motion | §1.14 |
| 19 | Amounts use proportional digits, so totals jitter as they change | §1.2 |
| 20 | Off-grid spacing (3, 5, 13, 14, 15, 18, 21) | §1.3 |
| 21 | Light `separator` `#e0e0e0` and `textSecondary` `#666` differ from iOS's separator and label greys (see §3.1 for why some should stay) | §1.1 |
| 22 | Icons are Ionicons (Ionic, Material-leaning shapes), not SF Symbols | everywhere |

---

## 3. Proposed design tokens

The idea is one file (`constants/design.ts`) next to `useTheme`, with everything referenced by name. Values keep the current look; the changes are mostly consolidation.

### 3.1 Colours (light / dark)

These are iOS semantic colours, with one deliberate exception: secondary text stays at an accessible contrast. iOS `secondaryLabel` (60% grey on white) is about 3.4:1, below the 4.5:1 that small text needs.

| Token | Light | Dark | Replaces |
|---|---|---|---|
| `bg` | `#F2F2F7` | `#000000` | `background` |
| `surface` (grouped cell/card) | `#FFFFFF` | `#1C1C1E` | `card` |
| `surfaceRaised` (sheets, menus over content) | `#FFFFFF` | `#2C2C2E` | ad hoc |
| `fill` (inputs, chip/segment track) | `rgba(118,118,128,0.12)` | `rgba(118,118,128,0.24)` | `inputBg` |
| `label` | `#000000` | `#FFFFFF` | `text` |
| `labelSecondary` | `#6C6C70` (≈5:1) | `rgba(235,235,245,0.70)` | `textSecondary` |
| `labelTertiary` (placeholders, disabled only) | `rgba(60,60,67,0.30)` | `rgba(235,235,245,0.30)` | `textTertiary` for placeholders |
| `separator` | `rgba(60,60,67,0.29)` | `rgba(84,84,88,0.60)` | `separator` |
| `accent` | `#007AFF` | `#0A84FF` | `accent`, `tint` |
| `red` / `green` / `orange` / `yellow` | `#FF3B30` `#34C759` `#FF9500` `#FFCC00` | `#FF453A` `#30D158` `#FF9F0A` `#FFD60A` | `destructive`, `success`, `warning` (now orange in both themes) |
| `vault` | `#C93400` text on `orange@15%` | `#FF9F0A` on `orange@20%` | `vault`, `vaultBg` |
| `scrim` | `rgba(0,0,0,0.35)` | `rgba(0,0,0,0.55)` | three scrims |

`tint(color, level)` with `level` ∈ `subtle 0.12 | soft 0.18 | strong 0.30` replaces the ad hoc hex-alpha tints.

**Category palette (needs your decision, see §4.5):** swap Material for the iOS system palette, light/dark pairs:

| Colour | Light | Dark |
|---|---|---|
| green | `#34C759` | `#30D158` |
| orange | `#FF9500` | `#FF9F0A` |
| blue | `#007AFF` | `#0A84FF` |
| red | `#FF3B30` | `#FF453A` |
| purple | `#AF52DE` | `#BF5AF2` |
| teal | `#30B0C7` | `#40C8E0` |
| yellow | `#FFCC00` | `#FFD60A` |
| brown | `#A2845E` | `#AC8E68` |
| pink | `#FF2D55` | `#FF375F` |

### 3.2 Type scale

This is Apple's text-style scale at the default text size. The first number is the font size, the second the line height. All styles scale with Dynamic Type; the tab bar keeps its 1.3× cap.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `largeTitle` | 34 / 41 | 700 | Screen titles; no manual letterSpacing |
| `title1` | 28 / 34 | 700 | Hero amounts in inputs |
| `title2` | 22 / 28 | 700 | Modal titles, balance in compact cards |
| `title3` | 20 / 25 | 600 | Empty-state titles |
| `headline` | 17 / 22 | 600 | Row titles that need emphasis, buttons |
| `body` | 17 / 22 | 400 | List rows, inputs |
| `callout` | 16 / 21 | 400 | Secondary rows |
| `subheadline` | 15 / 20 | 400 | Row subtitles, legend |
| `footnote` | 13 / 18 | 400 | Hints, errors, section footers |
| `sectionHeader` | 13 / 18 | 400, uppercase | Section headers (iOS grouped style) |
| `caption` | 12 / 16 | 400 | Dates, small metadata |
| `display` | 40 / 46 | 700, tabular | Overview balance only |

All money uses `fontVariant: ["tabular-nums"]`. That brings 16 sizes and 5 weights down to 11 styles with 400 / 600 / 700.

### 3.3 Spacing (4-pt grid)

`space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 }`

- **Screen gutter:** 16 on every screen. It matches iOS layout margins on standard iPhones and makes titles, cards and lists share one edge.
- **Grouped sections:** 24 between sections, 8 from a section header to its card, 8 from a card to its footer.
- **Rows:** 16 horizontal padding, minimum height 44 (single line) or 60 (two lines), hairline separators inset 16 (or past the icon).
- **Card inner padding:** 16, or 20 for hero cards (balance, donut).

### 3.4 Radii (always `borderCurve: "continuous"` on iOS)

| Token | Value | Use |
|---|---|---|
| `xs` | 6 | Segment thumb, small badges |
| `sm` | 10 | Inputs, icon tiles, small buttons |
| `md` | 12 | Buttons inside cards, chips' container insets |
| `lg` | 16 | All grouped sections and cards (today's most common value) |
| `xl` | 24 | Sheets, modal cards, More pills |
| `pill` | 999 | Chips, tab pill, toasts |

Nested shapes follow the iOS 26 "concentric" rule: inner radius = outer radius − inset (for example a 16-radius card with 6-pt inset → 10-radius inner element).

### 3.5 Elevation

- **`flat`, the default for content:** no shadow. Grouped surfaces separate from the background by colour, as in iOS Settings, in both themes.
- **`raised`, for cards that sit apart (hero balance, donut):** light `#000` at 0.05, radius 12, y 2; dark none.
- **`floating`, for the tab bar, More menu, toasts and leftover card:** light `#000` at 0.12, radius 24, y 8, Android elevation 8; dark: hairline `rgba(255,255,255,0.08)` border instead of a shadow.
- Coloured accent glows on buttons are removed.

### 3.6 Glass surface recipe

iOS 26 puts Liquid Glass on the **navigation and control layer that floats over content**, not on content cards. The proposal follows that.

- **Use glass for:** the tab bar, the More menu, toasts, and an optional sticky action bar (for example Add's Save). Content cards stay opaque.
- **iOS 26+:** `GlassView` with `glassEffectStyle="regular"` and `colorScheme` from the app theme. Add `tintColor` (65% surface colour) only when the glass sits over dense content, as the More menu does today.
- **Older iOS:** `BlurView` with `tint="systemChromeMaterial"` at intensity 100, plus a 50% `surface` overlay and a hairline `separator` border. This is thicker than today's ultra-thin material, which reads as "too transparent".
- **Reduce Transparency:** opaque `surfaceRaised` with a hairline border (already implemented).
- **Rules:**
  - never put opacity < 1 on a glass view or any of its parents (the documented Expo limitation, cause of KB-2)
  - never use `overflow: "hidden"` on the glass view itself
  - mount floating glass only while visible

### 3.7 Motion

| Preset | Spring | Use |
|---|---|---|
| `snappy` | damping 22, stiffness 300 | Press scale (0.97), toggles, chip select |
| `standard` | damping 20, stiffness 200 | Menus, sheets, toasts in/out |
| `gentle` | damping 18, stiffness 140 | Content reveal (donut, cards appearing) |

- Fades last 200 ms; nothing over 350 ms except the loading loop.
- **Reduce Motion:** springs become a 150 ms opacity fade, and decorative motion (donut scale, logo breathing) is skipped. This is one shared `useMotion()` hook, so every animation follows the setting, toasts and swipe included.

### 3.8 Haptics (expo-haptics, already installed)

| Event | Haptic |
|---|---|
| Tab change, chip, segment, picker selection | `selectionAsync` |
| Add tab, primary button press | `impactAsync(Light)` |
| Transaction saved, goal reached, transfer done | `notificationAsync(Success)` |
| Destructive confirm (delete) | `notificationAsync(Warning)` |
| Validation error on save | `notificationAsync(Error)` |

There are no haptics on scroll or on every keystroke. iOS already turns these off when System Haptics is off.

### 3.9 Touch and interaction

- **Minimum 44×44 pt** everywhere (mostly done in the audit pass; the tokens make it the default).
- **Pressables:**
  - list rows highlight with `fill` on press, like iOS table cells
  - buttons and cards scale to 0.97 with `snappy`
  - this replaces the six `activeOpacity` values
- **Buttons:** one `Button` component.
  - `filled`: accent background, `headline` text, height 50, radius `md`
  - `tinted`: accent at `soft` opacity, accent text
  - `plain`: accent text only
  - `destructive` variants of the above
- **Segmented control:** neutral `fill` track, `surface` thumb with a `raised` shadow, `label` text. This is the iOS look, replacing the accent fill.
- **Sheets:** one pattern, a native sheet (`formSheet` with detents) for short tasks and a page sheet with `ModalHeader` for editors. The centred Leftover card and the custom vault bottom sheet go.

---

## 4. Options that need your decision

### 4.1 Native iOS 26 tab bar: no new dependency (recommended)

`expo-router` 57 already ships `NativeTabs` (`expo-router/unstable-native-tabs`).

**What it gives:**
- the real system tab bar with Liquid Glass
- minimize-on-scroll
- SF Symbol icons (`sf=` prop)
- correct accessibility and haptics, for free

**What it costs:**
- the custom glass pill and the floating More menu go
- the API is marked "unstable"

Six routes is more than iOS shows comfortably. Two options:
- **(a)** Overview, History, Add, Savings, Settings, with Budget inside Settings or as a section on Overview
- **(b)** keep five tabs and put Budget/Settings under a native "More" tab

Android would get the Material native tab bar.

### 4.2 Native large titles and search: no new dependency

Wrap each tab in a native `Stack` and use `headerLargeTitle`. Titles then collapse into the inline bar on scroll, with a blurred header. History can use `headerSearchBarOptions` for the system search field instead of the custom search bar.

This is a structural change to `app/(tabs)/`, but it removes the hand-built titles and the inconsistent fixed and scrolling behaviour.

### 4.3 `expo-symbols`: new dependency, proposed

**Why:** SF Symbols in screens (category icons, buttons, empty states) are the single strongest "native Apple" signal. They match San Francisco text weights and support hierarchical and multicolour rendering.

**Notes:**
- Android needs a fallback (keep Ionicons there).
- It was removed in P-2 only because nothing used it.
- If you choose 4.1, tab icons are covered without it, and this is only for in-screen icons.

### 4.4 `@react-native-segmented-control/segmented-control`: new dependency, optional

This gives the real `UISegmentedControl` for Expense/Income. The custom one restyled per §3.9 gets about 90% of the look without it. Recommendation: **skip it** and restyle.

### 4.5 Category colours

Switching the palette (§3.1) changes how *existing* categories look, because each category stores its `colorHex`. Options:
- **(a)** new palette for new picks only; existing categories keep their colours
- **(b)** migrate the colours of the built-in categories and any colour that exactly matches an old palette entry to its new counterpart, in one store migration (v3)

Recommendation: **(b)**.

### 4.6 Emoji

Remove the emoji from toasts and from "🎉 Goal reached", and use SF Symbols or Ionicons (a checkmark seal, a star) for a calmer tone. Recommendation: **remove**.

---

## 5. Suggested Phase B order (small commits, each checked with tsc, eslint and tests)

1. `constants/design.ts` tokens and the `useTheme` mapping, with no visual change yet.
2. Shared primitives: `Surface`, `Section` (header, card and footer), `Row`, `Button`, `SegmentedControl`, `PressableScale`, `useMotion`, `haptics`.
3. Apply them screen by screen: Overview, Add, History, Savings, Budget, Settings, Onboarding.
4. Glass recipe update for iOS < 26, toasts unified onto glass.
5. Haptics map (§3.8).
6. Decisions from §4: native tabs, native large titles, palette migration, emoji.
7. Before and after screenshots in light and dark, on iPhone (iOS 26 and 18) and Android.

---

**Waiting for your approval.** Please confirm or adjust:
- the token values in §3
- the five decisions in §4: native tabs (a or b, or keep the custom bar), native large titles, `expo-symbols`, the palette migration, emoji removal

Then I'll start Phase B.

---

## 6. Phase B — implemented (2026-10-07)

All of §3 and the recommended options of §4 are in place:

| Item | Where |
|---|---|
| Tokens: type scale, 4-pt spacing, radii with continuous corners, elevation, springs, tints | `constants/design.ts` |
| iOS semantic colours + `fill`, `placeholder`, `surfaceRaised`, `scrim` | `hooks/useTheme.ts` |
| System palette with dark variants; store v3 migrates saved Material colours (§4.5 b) | `constants/palette.ts`, `store/migrations.ts` |
| Primitives: `Section`/`Separator`, `Button`, `PressableScale`/`PressableRow`, `SegmentedControl`, `GlassSurface`, `ProgressBar`, global `ToastHost` | `components/ui/` |
| SF Symbols / Material Symbols via `expo-symbols` (§4.3) | `components/Icon.tsx`, `components/CategoryIcon.tsx` |
| Native tab bar, 5 tabs; Settings in the Overview stack (§4.1 a) | `app/(tabs)/_layout.tsx` |
| Native large titles per tab, system search in History (§4.2) | `hooks/useLargeTitleOptions.ts`, `app/(tabs)/*/_layout.tsx` |
| Native form sheets for the month leftover and vault transfer | `screens/LeftoverSheet.tsx`, `screens/VaultTransferSheet.tsx` |
| Haptics map, Reduce Motion everywhere (`useMotion`) | `utils/haptics.ts`, `hooks/useMotion.ts` |
| Emoji removed from toasts and strings (§4.6) | i18n, `screens/Savingsscreen.tsx` |
| Segmented control without the native package (§4.4 skipped) | `components/ui/SegmentedControl.tsx` |

Not verifiable without a device: the native tab bar and Liquid Glass, collapsing large titles,
form-sheet detents, SF Symbol rendering and haptics. The web build (smoke-tested) uses
fallbacks for these.
