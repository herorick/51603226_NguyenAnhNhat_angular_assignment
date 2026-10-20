---
version: alpha
name: "NashTech Notes Monthly Planning"
description: "A clear, calm monthly budget-planning interface with a focused income form and color-coded allocation jars."
colors:
  primary: "#1976D2"
  primary-foreground: "#FFFFFF"
  secondary: "#1B4167"
  background: "#F4F8FC"
  surface: "#FFFFFF"
  surface-elevated: "#FFFFFF"
  border: "#D7E3F1"
  text: "#1D3858"
  text-muted: "#5E7FA5"
  success: "#13804A"
  warning: "#D77B00"
  danger: "#F04452"
  jars:
    living: "#EF3543"
    food: "#D77B00"
    children: "#6336E5"
    emergency: "#078C89"
    savings: "#07834C"
    investment: "#0872C4"
    travel: "#6538DF"
typography:
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
  page-title:
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "0px"
  section-title:
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "0px"
  body:
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0px"
  label:
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "20px"
    letterSpacing: "0px"
  caption:
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page: "36px"
rounded:
  control: "7px"
  panel: "8px"
  status: "14px"
  avatar: "9999px"
components:
  primary-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    minHeight: "46px"
    rounded: "{rounded.control}"
    padding: "0 16px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    borderColor: "{colors.border}"
    rounded: "{rounded.panel}"
    padding: "23px 27px"
  input-control:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    borderColor: "{colors.border}"
    minHeight: "46px"
    rounded: "{rounded.control}"
    padding: "0 13px"
  jar-tile:
    backgroundColor: "category-specific tint"
    borderColor: "{colors.border}"
    rounded: "{rounded.panel}"
    minHeight: "145px"
    categoryRule: "5px top accent using the category color"
---

# NashTech Notes Monthly Planning Brand Guideline

## Overview

This contract captures the monthly-planning screen, not a broader corporate identity system. The interface should feel organized, dependable, and easy to scan: a quiet blue frame around practical form controls and a lively but orderly set of budget categories. Preserve the visible product label "NashTech Notes" in this screen context.

Source: rendered [monthly-planning.html](../requirements/f1-monthly-planning/monthly-planning.html), captured 2026-09-26 at desktop and mobile sizes.

Confidence:
- Observed: rendered colors, typography, dimensions, component states, jar names/colors/rates, and responsive breakpoints.
- Provided: the supplied monthly-planning HTML is the design source.
- Inferred: reusable spacing scale and generic guidance where the page has no example.
- Proposed: none; do not treat this page as a source for unshown product surfaces.

## Colors

Use the navy for the full-width header and strongest framing. Reserve action blue for the primary submit action and its focus treatment. Use ink for primary content and muted blue for supporting text, borders, and quiet navigation. Keep panels white against the pale blue-gray canvas; the source uses borders rather than shadows to separate surfaces.

The seven jars use distinct category colors and pale matching fills. Keep each color mapped consistently to its category; do not use category colors as general semantic states. The source assigns amber to Food and purple to Children and Entertainment & Travel, even though they share hue families.

All values in the front matter are extracted from the source except the spacing scale and generic semantic alias for warning, which are Inferred. The exact category tints are: Living `#FFF4F5`, Food `#FFFAEF`, Children and Entertainment & Travel `#F7F5FF`, Emergency `#F0FBFA`, Savings `#F1FCF5`, and Investment `#F1F9FF`.

## Typography

Use the observed Inter-first system stack. Keep type compact and legible rather than decorative: page title 28px/700, section headings 20px/700, labels 14px/700, body 16px/400, and helper/caption text 13px/400. Jar percentages use a stronger 26px/700 treatment. Letter spacing stays at 0px. Do not scale type with viewport width; the page title reduces to 23px on narrow screens.

## Layout

Center the desktop page in a 1148px maximum-width container. Use a 60px header and a two-column content grid: a roughly 459px details panel beside a flexible allocation panel, separated by 19px. Align panels at their top edge. Keep the breadcrumb as a quiet, full-width trail below the main content.

At widths up to 920px, stack the panels in reading order and constrain the page to 720px. At 560px and below, use 16px page gutters, 20px panel padding with 18px sides, stack the intro copy beside its icon, hide the header's section label, and arrange jars in two columns with a 12px gap. Allow breadcrumbs to wrap. Avoid horizontal scrolling.

## Elevation & Depth

No shadows are used. Establish hierarchy with the navy header, white panels, thin blue-gray borders, and tinted jar surfaces. Do not add decorative shadows or floating-card treatments.

## Shapes

Use 7px corners for controls and the primary action, 8px for panels and jar tiles, 14px for the allocation status pill, and a full circle for the avatar and jar icons. Keep outlines thin and consistent.

## Components

Buttons: The primary action is full-width in the form, 46px tall, blue with white 16px semibold text and a leading plus-in-circle icon. Hover darkens to `#1268BD`; keyboard focus uses a visible 3px light-blue outline; disabled state lowers opacity and indicates waiting. Secondary and destructive button styles are not defined by this source.

Inputs: Use a 46px white control with a 1px border, 7px radius, 13px horizontal padding, and a 16px value. Labels sit above controls; required markers are red. Place units inside the control at the trailing edge. Focus changes the border to action blue and adds a 3px translucent outline. Helper and validation text sit directly below the field.

Panels and lists: Use white, thin-bordered panels with 23px vertical and 27px horizontal desktop padding; at mobile use 20px vertical and 18px horizontal padding. Jar tiles have a 5px top color bar, 8px radius, category tint, circular icon field, short name, and prominent percentage. Preserve the seven source allocations: Living Expenses 35%, Food 20%, Children 10%, Emergency Fund 10%, Savings 10%, Investment 10%, Entertainment & Travel 5%.

Status and feedback: The allocation status is a green 14px-radius pill with icon and text, not color alone. Validation and informational feedback use a compact tinted message block with readable text. Dialogs, tables, and chart styles are not present in the source and remain unspecified.

## Responsive Behavior

Use the exact observed layout cutoffs: 920px for stacking the major panels and 560px for the two-column jar grid and compact header. Keep the form single-column at all sizes. Jar cards must keep their content inside their fixed grid track; allow names to wrap. Preserve spacing between the panels and breadcrumbs when content grows vertically.

## Accessibility

Keep visible labels associated with each field, indicate required and invalid state in text as well as color, and retain the visible keyboard focus ring. Use semantic landmarks and headings, hide decorative icons from assistive technology, and announce form feedback through a status region. Keep icons supplementary to text labels. Verify text and status contrast when changing any extracted colors; do not rely on color alone to communicate allocation or validation state.

Contrast check against white: action blue is 4.60:1 and success green is 4.98:1; both meet the 4.5:1 normal-text target. The observed muted text `#5E7FA5` is 4.15:1 and falls short for normal-sized text. Preserve it when documenting the source, but darken the muted text used for normal-size content before treating this as an accessibility-approved production palette.

## Do's and Don'ts

Do:
- Keep the page calm, structured, and task-focused.
- Use the blue action color for the main submission action, with clear hover, focus, disabled, and validation states.
- Keep all seven category colors associated with their named jars.
- Preserve the thin-border, no-shadow surface hierarchy.

Don't:
- Recast this captured screen as a broad corporate brand specification without validation.
- Add new colors, gradients, shadows, or rounded-card layers.
- Use category colors for unrelated status meanings.
- Invent table, modal, secondary-button, or navigation patterns from this page; their styling is unobserved.

## Agent Prompt Guide

Build monthly-planning UI from this contract. Match observed tokens and breakpoints, keep income entry and allocation jars clear, and retain keyboard focus and text-based status cues. Treat components not shown here as unspecified; ask before establishing new product-wide rules.

## Open Questions

| Question | Why it matters | Owner |
| --- | --- | --- |
| Is "NashTech Notes" the approved product name beyond this screen? | The supplied page is the only source for product identity. | Product owner |
| Are these jar colors approved for other budgeting views? | Reuse could otherwise create inconsistent category meaning. | Product owner |