# Anchorpoint Design Tokens

## Colors

### Slate
| Name          | Hex       | Usage                        |
|---------------|-----------|------------------------------|
| Slate Dark    | `#22222D` | Primary background           |
| Slate Medium  | `#262624` | Surface / card backgrounds   |
| Slate Light   | `#40403D` | Borders, dividers, subtle UI |

### Ivory
| Name          | Hex       | Usage                        |
|---------------|-----------|------------------------------|
| Ivory Dark    | `#E7E7E7` | Body text                    |
| Ivory Medium  | `#F5F5F5` | Headlines, primary text      |
| Ivory Light   | `#FAFAF7` | High-emphasis text, labels   |

### Ocean / Blue
| Name      | Hex       | Usage                          |
|-----------|-----------|--------------------------------|
| Ocean     | `#0078FF` | Primary accent, CTAs, links    |
| Deep Mist | `#0000FF` | Hover / active accent state    |
| Sky       | `#00A8FF` | Secondary accent, highlights   |

### Neutrals
| Name  | Hex       | Usage                     |
|-------|-----------|---------------------------|
| White | `#FFFFFF` | Pure white                |
| Black | `#000000` | Pure black                |

### Status
| Name   | Hex       | Usage              |
|--------|-----------|--------------------|
| Accept | `#77DD77` | Success, confirmed |
| Error  | `#E4594C` | Error, destructive |

---

## Typography

| Role       | Font      | Weight   | Google Fonts |
|------------|-----------|----------|--------------|
| Logo       | Fraunces  | Semibold | [Fraunces](https://fonts.google.com/specimen/Fraunces) |
| Headlines  | Inter     | Normal   | [Inter](https://fonts.google.com/specimen/Inter) |
| User Text  | Inter     | Normal   | [Inter](https://fonts.google.com/specimen/Inter) |
| LLM Text   | Fraunces  | Normal   | [Fraunces](https://fonts.google.com/specimen/Fraunces) |

### Font stacks (for CSS)

```css
--font-fraunces: "Fraunces", Georgia, serif;
--font-inter: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Import (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=Inter&display=swap" rel="stylesheet">
```

---

## CSS Custom Properties Reference

When implementing, map tokens to `index.css` `:root` as follows:

```css
/* Backgrounds */
--color-bg:          #22222D;  /* Slate Dark */
--color-surface:     #262624;  /* Slate Medium */
--color-border:      #40403D;  /* Slate Light */

/* Text */
--color-text:        #F5F5F5;  /* Ivory Medium */
--color-text-strong: #FAFAF7;  /* Ivory Light */
--color-text-muted:  #E7E7E7;  /* Ivory Dark */

/* Accent */
--color-accent:      #0078FF;  /* Ocean */
--color-accent-hover:#0000FF;  /* Deep Mist */
--color-accent-dim:  #00A8FF;  /* Sky */

/* Status */
--color-success:     #77DD77;  /* Accept */
--color-danger:      #E4594C;  /* Error */

/* Neutrals */
--color-white:       #FFFFFF;
--color-black:       #000000;

/* Typography */
--font-sans:         "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-display:      "Fraunces", Georgia, serif;
```
