---
name: ff-mockup
description: Token-cheap view of a Family Finance UI mockup (raw files are ~90k tokens each and Read is denied). Use whenever you need a mockup's text, structure, or CSS for F1, F2, the F2 missing-plan state, F3, F5, or design tokens.
argument-hint: <f1|f2|f2-missing|f3|f5|tokens> [text|markup|css] [--grep WORD]
allowed-tools:
  - Bash(python .claude/scripts/mock_html.py *)
---

Mockup extract for `$ARGUMENTS`:

!`python .claude/scripts/mock_html.py $ARGUMENTS`

Modes: `text` (default, ~1 KB copy outline) · `markup` (cleaned DOM, 3-9 KB) · `css --grep <class>` (matching rules only).
Mockup values are samples; bind API data. Map and styling rules: `.claude/knowledge/ui-mockups.md`.
For building a full template, delegate to the **ff-ui-builder** agent instead of pulling `markup` and `css` into this context.
