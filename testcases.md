# whcli Test Cases

## Test Case 1: Pixel Phone (Good Condition, Vienna/Burgenland/Niederösterreich)

**Goal:** Find a used Google Pixel phone in good condition in Vienna, Burgenland, or Lower Austria.

### Step 1: Find relevant category
```bash
whcli tree --keyword pixel
```
Output shows `Smartphones / Telefonie` (id: 2691) with most matches.

### Step 2: Drill into smartphone brands
```bash
whcli tree 2691 --keyword pixel
```
Shows `Smartphones / Handys` (id: 2722) with 987 items.

### Step 3: Find Google brand
```bash
whcli tree 2722 --keyword pixel
```
Shows `Google` (id: 5014402) with 316 items.

### Step 4: Browse Pixel models
```bash
whcli tree 5014402 --keyword pixel
```
Returns:
```json
{
  "categoryId": "5014402",
  "children": [
    { "id": "5014408", "name": "andere Modelle", "count": 84 },
    { "id": "5014406", "name": "Pixel 9", "count": 56 },
    { "id": "5015994", "name": "Google Pixel 10", "count": 56 },
    { "id": "5014405", "name": "Pixel 8", "count": 46 },
    { "id": "5014404", "name": "Pixel 7", "count": 45 },
    { "id": "5014403", "name": "Pixel 6", "count": 19 },
    { "id": "5014407", "name": "Pixel Fold", "count": 16 }
  ]
}
```

### Step 5: Search for Pixel 7 with location filter
```bash
whcli search "pixel" --category 5014404 --location 900,1,3
```
Filters to Vienna (900), Burgenland (1), and Niederösterreich (3).
Returns Pixel 7 listings only from these regions.

### Step 6: View listing details
```bash
whcli view 2029459544
```
Returns full listing with description, attributes, condition info.

### Location IDs Reference
```bash
whcli locations
```
Lists all Austrian states with their IDs.

---

## Test Case 2: Reifen für VW Tiguan

**Goal:** Find tires (Reifen) for VW Tiguan.

### Step 1: Find automotive category
```bash
whcli tree --keyword reifen
```
Shows `KFZ-Zubehör / Motorradteile` (id: 6142) with 67,890 items.

### Step 2: Find car parts subcategory
```bash
whcli tree 6142 --keyword reifen
```
Shows `PKW-Ersatzteile / Zubehör` (id: 6143) with 61,830 items.

### Step 3: Find tires/wheels category
```bash
whcli tree 6143 --keyword reifen
```
Returns:
```json
{
  "categoryId": "6143",
  "children": [
    { "id": "6272", "name": "Reifen / Felgen", "count": 60686 },
    { "id": "6200", "name": "Karosserie", "count": 402 },
    ...
  ]
}
```

### Step 4: Search for VW Tiguan tires
```bash
whcli search "vw tiguan reifen" --category 6272
```
Returns listings like:
- `Alufelgen 18 Zoll VW Tiguan SKODA Kodiaq...` - €1,580 - Wien
- `VW Tiguan Winterreifen 17 Zoll Alufelgen...` - €650 - St. Pölten
- `AUDI VW Skoda Seat: original AUDI Q3 Sommerreifen...` - €800 - Oberwart

### Step 5: View specific listing
```bash
whcli view 1052695897
```
Returns full details including tire specs, DOT date, condition.

---

## Location Reference (Austrian States)

| ID | State |
|----|-------|
| 1 | Burgenland |
| 2 | Kärnten |
| 3 | Niederösterreich |
| 4 | Oberösterreich |
| 5 | Salzburg |
| 6 | Steiermark |
| 7 | Tirol |
| 8 | Vorarlberg |
| 900 | Wien |

---

## Notes

- Location filtering works with `--location` flag (comma-separated state IDs)
- Use `whcli locations` to see available Austrian states
- Categories are context-dependent - use `--keyword` to get relevant subcategories
- `tree` command shows available children at each level
- `search` returns both items AND category suggestions for further drilling
