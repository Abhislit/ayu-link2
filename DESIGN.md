---
name: AYU-LINK
description: A clear, accessible workspace for ambulance-to-hospital handoffs.
colors:
  board: "#f3f7f5"
  board-deep: "#123a43"
  board-line: "#dbe7e2"
  board-line-soft: "#eaf1ee"
  paper: "#ffffff"
  paper-band: "#eef6f3"
  paper-line: "#d8e5e0"
  perf: "#9ab8ad"
  ink: "#18383e"
  paper-muted: "#536d71"
  text: "#173a40"
  text-muted: "#567276"
  label: "#4e6b70"
  live: "#75c5a6"
  alarm: "#b43e35"
  alarm-tint: "#f9e9e6"
  st-blue: "#285d7a"
  st-green: "#236b55"
  st-amber: "#80500c"
  st-mute: "#586d70"
  route: "#16796d"
  route-soft: "#d9eee8"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, sans-serif"
    fontSize: "clamp(26px, 3vw, 36px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.025em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.route}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0.7rem 1rem"
    height: "42px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.65rem 0.75rem"
    height: "42px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  active-navigation:
    backgroundColor: "{colors.route-soft}"
    textColor: "{colors.board-deep}"
    rounded: "{rounded.sm}"
    height: "44px"
---

# Design System: AYU-LINK

## Overview

**Creative North Star: "Hospital Wayfinding"**

AYU-LINK is a calm, high-contrast workspace for the ambulance-to-hospital
handoff. Its deep-teal navigation rail anchors warm-white work surfaces, while
concise labels and a humanist typeface keep patient and case information easy
to scan in a moving ambulance or at a hospital desk.

The interface makes the next handoff step visible without implying a diagnosis,
geographic route, travel time, or clinical certainty. Motion is reserved for a
real change in handoff state. The same visual language carries across the
ambulance, hospital, doctor, and administrator workspaces.

**Key Characteristics:**
- High-contrast, humanist, and operationally calm.
- Patient identity and the next handoff action stay prominent.
- Status always uses readable labels as well as color.
- Quick concerns draft crew-reported messages; they do not diagnose or change
  the emergency category.

## Colors

The palette pairs a deep-teal shell with white work surfaces and jade progress;
red is reserved for explicit urgency.

### Primary
- **Wayfinding Jade** (`#16796d`): Primary actions and completed handoff links.
- **Deep Teal** (`#123a43`): Desktop navigation rail and mobile header.

### Secondary
- **Muted Blue** (`#285d7a`): Hospital-selected status.
- **Handoff Green** (`#236b55`): Acknowledged or ready status.
- **Pending Amber** (`#80500c`): Pending or preparation status.

### Tertiary
- **Clinical Alert Red** (`#b43e35`): Explicit urgency and alert states only.

### Neutral
- **Pale Green-Gray** (`#f3f7f5`): App background.
- **White Paper** (`#ffffff`): Cards, forms, and primary work surfaces.
- **Soft Mint** (`#eef6f3`): Selected and supporting surface bands.
- **Teal Ink** (`#18383e`): Primary text on light surfaces.
- **Muted Teal** (`#567276`): Supporting text.
- **Fine Divider** (`#d8e5e0`): Card and section borders.

### Named Rules
**The Concern-Is-Not-Diagnosis Rule.** Concern shortcuts create editable,
crew-reported message drafts and never set the emergency category.

**The No-Fabricated-Route Rule.** Handoff progress describes case states only;
it does not imply a map, distance, location, or ETA.

## Typography

**Display Font:** Atkinson Hyperlegible Next (with Segoe UI, sans-serif)
**Body Font:** Atkinson Hyperlegible Next (with Segoe UI, sans-serif)
**Label/Mono Font:** Atkinson Hyperlegible Next (with Segoe UI, sans-serif)

**Character:** A single self-hosted humanist family keeps names, instructions,
and compact labels legible without switching visual voices. Numerals use
tabular figures for stable case and time scanning; there is no separate
monospace typeface.

### Hierarchy
- **Display** (700, `clamp(26px, 3vw, 36px)`, 1.12): Page titles.
- **Headline** (700, 26px, 1.12): Login brand and prominent patient identity.
- **Title** (700, 15px): Section headings.
- **Body** (400, 14px): Instructions, form copy, and case details.
- **Label** (600, 11px, 0.025em): Field labels, status context, and supporting
  metadata.

### Named Rules
**The One-Family Rule.** Keep all interface text in Atkinson Hyperlegible Next;
use weight and size, not a second typeface, to establish hierarchy.

## Layout

Desktop uses a 248px role rail beside a fluid workspace capped at 1512px. The
content area uses responsive side padding (`clamp(20px, 3.2vw, 48px)`). The
ambulance view pairs patient and response controls with communications; its
four-stage handoff path is a compact, labeled progress line.

At 920px and below, the fixed rail becomes a compact mobile header with
horizontal role navigation. At 640px and below, content padding tightens,
handoff labels become more compact, and cards stack into one readable column.
Keep controls comfortably tappable and preserve the natural document scroll.

## Elevation & Depth

Depth comes primarily from white-on-pale tonal layering and fine teal-gray
borders. Cards use a restrained ambient lift (`0 12px 30px -20px rgba(18, 58,
67, 0.32)`); the login panel uses a slightly broader version. Avoid glass
effects and heavy, high-contrast shadows.

### Shadow Vocabulary
- **Work-surface lift** (`0 12px 30px -20px rgba(18, 58, 67, 0.32)`): Cards
  that need separation from the app background.

## Shapes

Use rounded rectangles for work surfaces and controls: 14px cards, 16px login
panel, 8px buttons and inputs, and 6px status chips. Fine borders define card
edges and selected states. Keep progress markers circular and avoid decorative
perforations or control-room motifs.

## Components

### Buttons
- **Shape:** 8px radius.
- **Primary:** Wayfinding Jade background, white text, 42px minimum height.
- **Hover / Focus:** Darken the jade on hover; retain a clear, offset focus
  outline for keyboard users.
- **Secondary:** Use an outlined or quiet surface treatment without competing
  with the primary action.

### Chips
- **Style:** Compact, rounded labels with a subtle tinted background and
  readable border.
- **State:** Pair every status color with explicit state text; reserve alert
  red for urgency.

### Cards / Containers
- **Corner Style:** 14px for work panels, 12px for metric cards.
- **Background:** White on the pale app surface.
- **Shadow Strategy:** Use the restrained work-surface lift with a fine border.
- **Internal Padding:** 20px on desktop; reduce to 16px on narrow screens.

### Inputs / Fields
- **Style:** White fill, 1px muted teal border, 8px radius, and 42px minimum
  height.
- **Focus:** Jade border and a visible pale-jade outline.
- **Error / Disabled:** Keep alert states distinct; disabled controls remain
  visibly unavailable.

### Navigation
- **Style:** Deep-teal role rail on desktop; compact horizontal navigation on
  mobile. The active role uses a pale-jade fill and dark-teal text.

### Handoff Progress

Four labeled stages distinguish patient identification, hospital selection,
hospital acknowledgement, and case closure. The current marker advances only
when the same case changes status; initial loading and switching cases do not
animate. Respect reduced-motion preferences.

### Quick Concerns

Offer breathing difficulty, chest discomfort, injury or accident,
pregnancy-related concern, and other / not sure as individually selectable
message-draft chips. Crews can select multiple concerns and toggle each one off
again. Explain that these crew-reported selections do not diagnose or change
the emergency category.

## Do's and Don'ts

### Do
- **Do** put patient identity, case state, and the next action in the scan path.
- **Do** keep color-coded states legible by text and shape.
- **Do** keep the four operational roles and their existing access boundaries.
- **Do** animate only genuine state changes and honor reduced-motion settings.
- **Do** make concern drafts editable before the crew sends them.

### Don't
- **Don't** use a concern shortcut as a diagnosis or emergency-category update.
- **Don't** invent a location, map, distance, ETA, or clinical claim.
- **Don't** use red as a general accent or decorate the interface with
  control-room imagery.
- **Don't** hide important controls behind hover-only behavior.
