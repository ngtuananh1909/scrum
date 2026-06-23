---
name: Agile Werewolf
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4ae176'
  on-secondary: '#003915'
  secondary-container: '#00b954'
  on-secondary-container: '#004119'
  tertiary: '#ffb3ad'
  on-tertiary: '#68000a'
  tertiary-container: '#ff5451'
  on-tertiary-container: '#5c0008'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.1em
  mono-ui:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-max: 1200px
  gutter: 1.5rem
  margin: 2rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
---

## Brand & Style
The brand personality is high-tension, professional, and atmospheric. It bridges the gap between a high-stakes corporate sprint and a survival-based social deduction game. The design system leverages a "Tactical Glassmorphism" style—combining the surgical precision of developer tools with the moody, layered depth of a midnight forest.

The target audience consists of tech-savvy players who appreciate structured data, real-time updates, and clean information hierarchy. The emotional response should be one of focused urgency: the UI feels like a command center where every "ticket" (player) and "sprint" (game phase) carries life-or-death weight.

Key stylistic markers:
- **Depth through Layering:** Transparent surfaces over deep, dark backgrounds.
- **Precision Accents:** Thin, high-contrast borders and sharp typography.
- **Atmospheric Utility:** Using "Scrum Green" and "Emergency Red" not just as status indicators, but as environmental lighting that changes the mood of the interface based on the game state.

## Colors
The palette is rooted in a deep, nocturnal foundation to maintain tension, while utilizing highly saturated functional colors for instant recognition.

- **Background (Neutral):** #0F172A (Deep Slate). This is the "night" canvas. Use variations for surface depth (e.g., #1E293B for elevated cards).
- **Primary (System):** #6366F1 (Vibrant Indigo). Used for interactive elements, primary actions, and neutral system feedback.
- **Success/Good (Secondary):** #22C55E (Scrum Green). Represents the Villagers, successful votes, and completed tasks.
- **Danger/Evil (Tertiary):** #EF4444 (Emergency Red). Represents Werewolves, failed sprints, and eliminations.
- **Text:** Slate-50 (#F8FAFC) for primary content; Slate-400 (#94A3B8) for metadata and labels.

## Typography
The system uses **Geist** for its technical, mono-inspired look that remains highly legible in dense layouts.

- **Headlines:** Use heavy weights with tight letter-spacing for game phases (e.g., "NIGHT PHASE").
- **Body:** Clean, balanced weights for player descriptions and log entries.
- **Labels:** Use the "label-caps" style for player roles or status tags to evoke the feel of a professional dashboard.
- **Mono-UI:** Use a monospaced variant (Geist Mono) for timestamps, vote counts, and system logs to reinforce the technical, agile theme.

## Layout & Spacing
The layout follows a **Fluid Grid** model with high-density spacing, reminiscent of modern productivity tools.

- **Desktop:** 12-column grid. The main "Board" occupies 8-9 columns, with a "Activity Feed/Log" sidebar occupying the remaining 3-4 columns.
- **Mobile:** Single column with a bottom-docked navigation bar for game actions.
- **Rhythm:** Use a strict 4px/8px baseline. Elements should feel "packed" but organized, utilizing `stack-sm` for related metadata and `stack-lg` to separate distinct UI sections like "Current Players" and "Action Bar."

## Elevation & Depth
Depth is achieved through **Glassmorphism** and **Tonal Layering** rather than traditional shadows.

- **Level 1 (Base):** #0F172A (The main background).
- **Level 2 (Cards):** Background-blur (12px) with a semi-transparent fill of #1E293B at 60% opacity.
- **Level 3 (Modals/Popovers):** Higher blur (20px) with a subtle "Indigo" inner-glow (1px stroke at #6366F1, 20% opacity).
- **Borders:** Every card and interactive element uses a 1px solid border. Use `Slate-800` for neutral states, `Scrum Green` for active/positive states, and `Emergency Red` for high-alert/danger states.

## Shapes
The shape language is "Soft-Industrial." Components use a consistent 4px (0.25rem) radius to maintain a professional, structured feel.

- **Buttons/Inputs:** 4px radius.
- **Player Cards:** 8px (rounded-lg) to make them feel like distinct physical objects on the digital board.
- **Status Pills:** Fully pill-shaped (rounded-full) to contrast against the sharp, rectangular nature of the dashboard.

## Components
- **Buttons:** High-contrast fills. Primary actions use #6366F1 with white text. Secondary actions use ghost styles (1px border, no fill). All buttons have a subtle "glow" on hover.
- **Player Cards:** Glass containers with a vertical "Status Strip" on the left edge (Green for Villager, Red for Werewolf, Indigo for System). Include a mono-font "VOTE" count in the top right.
- **Activity Log:** A scrolling list of mono-font strings. Each entry is prefixed by a timestamp and a color-coded dot indicating the nature of the event.
- **Phase Indicator:** A large, centered display at the top of the UI. Use "Headline-LG" with a backdrop blur that covers the width of the screen.
- **Vote Chips:** Small, pill-shaped indicators that appear at the bottom of player cards, showing which other players have "tasked" (voted) for them.
- **Input Fields:** Dark, recessed backgrounds with Indigo focus rings. Placeholders should be Slate-500.