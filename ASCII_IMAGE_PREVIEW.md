# ASCII Image Preview Feature

## Overview

Added ASCII art image previews to product cards in search results, detail view, and starred items list.

## Features

### 🎨 Visual Components

| Component | Preview Type |
|-----------|--------------|
| **ProductList** | Single frame placeholder above title |
| **DetailView** | Image gallery with navigation hints |
| **StarredView** | Single frame placeholder above title |

### 📦 ASCII Art Library

Located in `src/components/ascii-art.ts`:

| Style | Description | Usage |
|--------|-------------|--------|
| `IMAGE_FRAME` | Full frame with [IMG] text | `createImageFrame()` |
| `SIMPLE_PLACEHOLDER` | Small bracketed icon | Preview when no image |
| `PHOTO_ICON` | Camera emoji icon | `createSmallIcon()` |
| `IMAGE_DOTS` | Dot pattern placeholder | Fallback design |

### 🎯 Display Behavior

#### ProductList
```
┌────────────┐
│            │
│   [IMG]   │  ← Above product title
│            │
└────────────┘
```

#### DetailView
```
Images (3): Use arrows: ← → to browse
┌──────────────┐
│              │
│     [IMG]     │  ← [1/3] (Main)
│              │
└──────────────┘
┌──────────────┐
│              │
│     [IMG]     │  ← [2/3]
│              │
└──────────────┘
┌──────────────┐
│              │
│     [IMG]     │  ← [3/3]
│              │
└──────────────┘
```

#### StarredView
```
┌────────────┐
│            │
│   [IMG]   │  ← Above starred item title
│            │
└────────────┘
```

## Code Implementation

### ASCII Art Module (`ascii-art.ts`)

```tsx
// Create a frame with image placeholder
export function createImageFrame(hasImage: boolean): string {
  if (!hasImage) return "";

  return `
┌──────────────┐
│              │
│     [IMG]     │
│              │
└──────────────┘`;
}

// Create small icon for detail view
export function createSmallIcon(hasImage: boolean): string {
  if (!hasImage) return "  ";
  return "📷 ";  // Camera emoji
}
```

### Color Codes

```tsx
export const IMAGE_COLORS = {
  frame: "\x1b[36m",   // Cyan for frames
  icon: "\x1b[33m",    // Yellow for icons
  placeholder: "\x1b[90m", // Gray for placeholders
  reset: "\x1b[0m",     // Reset terminal colors
} as const;
```

## Usage Example

### In ProductList Component

```tsx
import { createImageFrame } from "./ascii-art.js";

<Box flexDirection="column">
  {/* ASCII Image Preview */}
  <Box marginBottom={0}>
    <Text color="cyan">
      {item.imageUrl ? createImageFrame(true) : "  "}
    </Text>
  </Box>

  {/* Product Info */}
  <Text>{item.title}</Text>
</Box>
```

### In DetailView Component

```tsx
{listing.images?.length > 0 && (
  <Box flexDirection="column" marginBottom={1}>
    <Box flexDirection="row" justifyContent="space-between">
      <Text bold color="cyan">Images ({listing.images.length}):</Text>
      <Text color="dim">Use arrows: ← → to browse</Text>
    </Box>
    <Box borderStyle="single" borderColor="gray">
      {listing.images.map((img, index) => (
        <Box key={index} flexDirection="column">
          <Text color={index === 0 ? "yellow" : "dim"}>
            [{index + 1} / {listing.images.length}]
            {index === 0 ? "(Main)" : ""}
          </Text>
          <Text color="cyan">{createImageFrame(true)}</Text>
        </Box>
      ))}
    </Box>
  </Box>
)}
```

## Benefits

1. **Visual Recognition**: Users can quickly identify products with images
2. **No External Dependencies**: Pure ASCII art, no image processing required
3. **Terminal-Friendly**: Works in any terminal with UTF-8 support
4. **Performance**: Minimal overhead, just string rendering
5. **Consistent Branding**: Cyan color for all image-related UI elements

## Limitations

- Does not render actual images (would require complex ASCII conversion)
- Placeholder indicates image availability only
- Emoji (📷) may not display in all terminals
- Frame width is fixed, doesn't adapt to terminal width

## Future Enhancements

- [ ] Add actual ASCII image conversion (using library like `asciify`)
- [ ] Responsive frame width based on terminal size
- [ ] Multi-line image placeholder with more detail
- [ ] Add toggle to hide image previews
- [ ] Support different frame styles (rounded, double, dashed)
- [ ] Add image alt text from listing data
