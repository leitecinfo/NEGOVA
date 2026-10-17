---
name: NEGOVA Digital Menu Design System
description: Interactive, modern digital catalog and menu experiences for gastronomy and commerce
colors:
  primary: "#FF4D00"
  comercial-primary: "#2563EB"
  elegante-primary: "#D4AF37"
  visual-primary: "#F59E0B"
  whatsapp: "#22C55E"
  neutral-bg-dark: "#0C0E14"
  neutral-bg-light: "#F8FAFC"
  neutral-surface-dark: "#141824"
  neutral-surface-light: "#FFFFFF"
  neutral-border-dark: "rgba(255, 255, 255, 0.08)"
  neutral-border-light: "rgba(226, 232, 240, 0.8)"
typography:
  display:
    fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
    fontSize: "clamp(1.75rem, 5vw, 2.75rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'DM Sans', 'Inter', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 14px"
---

# Design System: NEGOVA Digital Menu

## Overview

**Creative North Star: "The Frictionless Culinary Connoisseur"**

NEGOVA Digital Menus are built as fast, immersive, touch-optimized web applications designed for immediate diner discovery and high-conversion ordering. They are not static PDF boards, printable brochures, or skeuomorphic parchment cards. Every template is engineered for instant legibility on smartphones in ambient restaurant lighting, rapid category switching, instant variant customization, and zero-hesitation WhatsApp ordering.

### Key Characteristics:
- **Web-First Ergonomics**: Sticky, horizontally draggable category pills, bottom sheets for item details, and tactile touch targets (min 44px).
- **Authentic Identity Over Gimmicks**: Elimination of fake caution tapes, invented marketing stickers, simulated paper textures, and cheesy French labels.
- **Single Elevation Hierarchy**: Surface depth is declared once per layer (crisp border or refined soft shadow; never noisy blurry halos).
- **High Information Density with Breathable Space**: Compact product rows and cards where title, real variants, allergens, and price hierarchy stand out at first scan.

## Colors

The system uses dedicated palette universes per template while maintaining strict WCAG AA contrast (≥ 4.5:1 for body copy).

### Primary
- **Urbana Fast Food** (`#FF4D00`): Energetic high-octane flame orange for fast casual, smash burgers, and street cuisine.
- **Comercial Standard** (`#2563EB`): Confident cobalt blue for retail, bakeries, and modern delis.
- **Elegante & Clásica** (`#C5A059` / `#D4AF37`): Restrained old-gold and champagne for bistro, fine dining, and boutique cafes.
- **Visual Lookbook** (`#F59E0B`): Golden amber for artisan gastronomy and photography-driven menus.

### Neutral
- **Deep Noir Background** (`#0B0D13`): Modern dark background avoiding pitch-black OLED smear while preserving contrast.
- **Card Surface Dark** (`#131722`): Elevated dark surface with 1px border `rgba(255,255,255,0.08)`.
- **Light Page Background** (`#F8FAFC`): Crisp, clean slate canvas.
- **Light Card Surface** (`#FFFFFF`): Pure white card with 1px border `rgba(226,232,240,0.8)`.

### Named Rules
**The Single-Accent Rule**: Accent colors appear on ≤10% of the surface (active category, primary CTA, price highlight). The content and photography lead the experience.

## Typography

**Display Font**: 'Outfit' or 'Plus Jakarta Sans' (clean geometric grotesque with tight tracking -0.02em to -0.03em).
**Body Font**: 'DM Sans' or 'Inter' (crisp sans-serif optimized for small screens, ingredients, and descriptions).
**Luxury Alternative (Elegante)**: 'Cinzel' or 'Playfair Display' for clean, classical titles paired with 'Plus Jakarta Sans' for readable body text.

### Hierarchy
- **Display** (800, `clamp(1.75rem, 5vw, 2.75rem)`, 1.1): Business name and banner headline.
- **Headline** (700, 1.25rem, 1.25): Category titles and major product modal headings.
- **Title** (600, 1rem, 1.3): Product names inside cards and list rows.
- **Body** (400, 0.8125rem - 0.875rem, 1.45): Product descriptions, modifier details, and notes.
- **Label** (600, 0.75rem, 1, uppercase tracking 0.05em): Category tabs, variant chips, and status badges.

### Named Rules
**The No-Eyebrow Rule**: Headings stand on their own. Never prepend fake kicker badges or decorative numbering (01, 02) above titles.
**The No-Gradient-Text Rule**: Text emphasis is achieved through weight and color contrast, never multi-stop text gradients.

## Layout

- **Container Constraint**: Max-width `max-w-4xl` for focused catalog scanning; edge padding `px-3 sm:px-6`.
- **Sticky Category Bar**: Top-anchored navigation with zero scroll jitter, horizontal swipe overflow, and active state pill indicators.
- **Adaptive Grid**: 1-column mobile cards/rows with minimum 44px tap targets; 2-column or 3-column desktop layout.
- **Rhythm**: Generous vertical section spacing (`gap-8` to `gap-10`) between distinct categories, with tight group spacing (`gap-3` to `gap-4`) between sibling products.

## Elevation & Depth

Surfaces rely on crisp borders (`border border-white/10` or `border-slate-200`) and subtle, directional shadows (`box-shadow: 0 4px 20px -4px rgba(0,0,0,0.2)`).

### Named Rules
**The Single-Elevation Rule**: A container declares either a border OR a shadow. Never stack a 1px border under an ambient fuzzy halo.
**The No-Hazard-Tape Rule**: Never use diagonal stripes or hazard caution patterns as decorative borders.

## Shapes

- **Card Radii**: Clean 14px–16px (`rounded-2xl`).
- **Control Radii**: Pills (`rounded-full`) for category filters, small variant chips, and quantity buttons.
- **Image Treatment**: Seamless aspect ratio `aspect-[4/3]` or `aspect-video` with `object-cover`.

## Components

### Buttons
- **Primary CTA ("Pedir WhatsApp", "Agregar")**: 44px touch target, solid primary color, white bold text, subtle scale active state (`active:scale-95`).
- **Customization Trigger ("Personalizar")**: Pill or rounded-xl with subtle outline or tinted background, showing variant count (`+2 opciones`).

### Cards
- **Visual Card**: Image top, content bottom with price pill and interactive order button.
- **Compact Row Card**: Thumbnail left, title and description center, price and order action right (ideal for fast scanning on mobile).

### Product Detail Modal
- Dynamic bottom sheet on mobile, centered dialog on desktop.
- Live price updates reflecting selected variants and optional modifiers.
- Direct WhatsApp order generation with formatted order summary.

## Do's and Don'ts

### Do:
- **Do** format all prices with business currency symbol and proper number separation.
- **Do** show real variants with "Desde $X" and variant badges when `product.has_variants` is true.
- **Do** open the interactive `ProductDetailModal` so users can customize options before ordering.
- **Do** keep category navigation sticky and smooth with active scroll sync.
- **Do** support custom user-configured colors (`settings.primaryColor`, `settings.secondaryColor`) seamlessly.

### Don't:
- **Don't** use native alerts (`window.alert`, `window.confirm`, `window.prompt`).
- **Don't** invent fake products, categories, or fabricated marketing claims.
- **Don't** replicate paper brochures, corner filigranas, or physical menu skeuomorphism.
- **Don't** add fake diagonal hazard caution tape or cheesy novelty stickers.
