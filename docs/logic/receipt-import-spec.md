# Receipt Import Spec

This document defines all non-UI receipt ingestion rules implemented in:

- `src/receipt-import/importReceipt.ts`
- `src/receipt-import/parseReceiptText.ts`
- `src/receipt-import/parsePastedItems.ts`
- `src/receipt-import/llmHandoff.ts`

## 1. Shared Types

```ts
type ReceiptImportItem = {
  name: string;
  price: string;
};

type ReceiptImportWarning = {
  code: string;
  message: string;
};

type ReceiptImportResult = {
  source: "image" | "pdf";
  fileName: string;
  rawText: string;
  items: ReceiptImportItem[];
  warnings: ReceiptImportWarning[];
};
```

Prices in receipt-import outputs are decimal strings, not cents.

## 2. File Import Pipeline

### 2.1 Source detection

A file is treated as a PDF if either condition is true:

- `file.type === "application/pdf"`
- filename ends with `.pdf` case-insensitively

Otherwise the file is treated as an image.

### 2.2 OCR engine

The current implementation uses Tesseract with language `"eng"`.

### 2.3 PDF import flow

For PDFs:

1. load the PDF through `pdfjs-dist`
2. try embedded text extraction first
3. parse that text with `parseReceiptText`
4. if no items are detected, render each page to canvas and run OCR
5. parse the OCR text with `parseReceiptText`
6. prepend the warning:
   `"Used OCR fallback because the PDF text layer did not yield any probable items."`

The OCR fallback happens only when the text layer yields zero parsed items.

### 2.4 Image import flow

For images:

1. OCR the file directly
2. parse the OCR text with `parseReceiptText`

### 2.5 Failure behavior

If parsing still yields zero items:

1. combine warning messages into one string
2. normalize the raw text preview by collapsing whitespace
3. take the first `160` preview characters
4. throw an error using:
   - warning summary if available, otherwise
   - `"No receipt items could be detected."`
5. append `Raw text preview: ...` if preview text exists

## 3. Building Lines From PDF Text Items

`buildLinesFromPdfTextItems(items)` reconstructs text lines from PDF text-layer
tokens.

Rules:

- each token is whitespace-normalized and trimmed
- the current line is flushed when:
  - the vertical position changes by more than `1.5`, or
  - `item.hasEOL` is true
- flushed lines join tokens with single spaces
- empty flushed lines are discarded

This logic is important because the parser operates on line-oriented text.

## 4. Receipt Text Parsing

`parseReceiptText(rawText)` converts OCR or PDF text into receipt items.

### 4.1 High-level behavior

1. split on line breaks
2. normalize internal whitespace on every line
3. drop empty lines
4. classify each line
5. build items from item/modifier/continuation lines
6. accumulate warnings for ignored summary lines or no detected items

### 4.2 Tax code prefix stripping

The parser recognizes and removes prefixes such as:

- `(A) `
- `(B) `
- `(C) `

This stripped form is used for classification and item-name cleanup.

### 4.3 Price extraction

Trailing prices are recognized with:

```txt
(-?\d[\d\s.,]*[.,]\d{2})\s*$
```

Normalization rules:

- all spaces are removed
- the last comma or dot is treated as the decimal separator
- all earlier commas/dots are treated as thousands separators
- parsed values are rounded to cents

Examples:

- `1.234,56` -> `1234.56`
- `12,30` -> `12.30`
- `53.09` -> `53.09`

### 4.4 Quantity continuation lines

The parser recognizes wrapped quantity lines like:

- `2 X 1,49 2,98`
- `2 X 1,04`

Pattern:

```txt
^(?<quantity>\d+(?:[.,]\d+)?)\s*[xX]\s+(?<unit>\d[\d.,]*[.,]\d{2})(?:\s+(?<total>-?\d[\d.,]*[.,]\d{2}))?\s*$
```

Rules:

- if an explicit total exists, use it
- otherwise compute `quantity * unit`
- a continuation line only becomes an item if there is a pending description
  line waiting to be paired with it

### 4.5 Description merging

Some receipts split a product into:

1. a description line with no price
2. a later quantity continuation or priced line

The parser stores one pending description string.

When a priced item or continuation line arrives:

- the pending description is prepended to that item name
- whitespace is normalized

When a summary, header, or note line arrives:

- the pending description is cleared

### 4.6 Classification categories

Every line is classified as one of:

- `item`
- `modifier`
- `continuation`
- `summary`
- `header`
- `note`
- `description`
- `unknown`

### 4.7 Summary keywords

The parser treats lines as summary/payment/footer noise when they contain any of
these normalized keywords:

- `total`
- `subtotal`
- `sub total`
- `amount due`
- `balance due`
- `tax`
- `vat`
- `iva`
- `cash`
- `change`
- `payment`
- `paid`
- `mastercard`
- `visa`
- `debit`
- `credit`
- `tender`
- `mbway`
- `multibanco`
- `terminal`
- `pay`
- `troco`
- `a pagar`
- `talao`

The parser also treats a line as likely summary if:

- it already matches a summary keyword, or
- it has at least 3 numeric groups and fewer than 8 letters

### 4.8 Modifier keywords

Lines with these normalized keywords become negative-price modifier rows:

- `discount`
- `promo`
- `coupon`
- `offer`
- `oferta`
- `desconto`

Special ignore-only modifier keywords:

- `saving`
- `savings`
- `poupanca`
- `poupa`

Ignore-only modifiers are treated as summary/footer noise, not negative items.

### 4.9 Note keywords

Lines are treated as notes and ignored when they include normalized note
keywords such as:

- `aprox`
- `validade`
- `cliente`
- `operador`
- `loja`
- `morada`
- `obrigado`
- `thank you`
- `www.`
- `tel.`
- `telefone`
- `nif`

The parser also treats punctuated lowercase prose lines with at least three
words as notes.

### 4.10 Header keywords

Lines are treated as headers when they end with `:` or include keywords such as:

- `fatura simplificada`
- `continente`
- `hipermercados`
- `descricao`
- `valor`
- `cartao cliente`
- `atcud`
- `cupoes`

### 4.11 Description-line heuristics

An unpriced line becomes a `description` when all of these hold:

- it is not empty
- it is not a header
- it is not a summary
- it is not a note
- it has at least 3 letters
- it has at most 10 words
- either:
  - it contains mixed case text, or
  - it had a tax-code prefix and is not recognized as a header

### 4.12 VAT footer rows

Names that look like `6,00%`, `13,00%`, or `23,00%` are treated as summary
rows, not items.

### 4.13 Modifier sign rule

If a line is classified as `modifier`, its exported price is always forced
negative:

```txt
-abs(parsedAmount)
```

So `Promo discount 0.75` becomes `-0.75`.

### 4.14 Warning rules

If one or more summary lines are ignored:

```txt
Ignored N total or payment lines.
```

If zero items are produced:

```txt
No probable receipt items were detected. Try a clearer photo or edit items manually.
```

## 5. Pasted Item Parsing

`parsePastedItems(input)` is separate from OCR receipt parsing. It expects a
cleaner, user-curated text paste.

### 5.1 Accepted line styles

The parser accepts:

- `Bananas - 2.49`
- `Tomatoes: 1.80`
- `Yogurt 2.10`
- `1. Milk - 3,40 EUR`
- `- Bread - 1.20`
- `Bananas,2.49`

### 5.2 Prefix stripping

Before parsing, the parser removes one optional prefix:

- bullet prefix like `- `
- bullet prefix like `* `
- numbering prefix like `1. `
- numbering prefix like `1) `

### 5.3 Currency stripping

The price parser removes these currency markers case-insensitively:

- `€`
- `$`
- `£`
- `eur`
- `usd`
- `gbp`

### 5.4 Supported parse strategies

Each non-empty line is tried in this order:

1. `name - price` or `name: price`
2. `name,price` CSV fallback
3. `name price` trailing-price fallback

### 5.5 Summary labels excluded from trailing-price fallback

The trailing-price fallback rejects names equal to or starting with:

- `total`
- `subtotal`
- `tax`
- `vat`
- `paid`
- `payment`
- `cash`
- `card`

### 5.6 Header row exclusion for CSV

The CSV fallback ignores a two-column header row when:

- name column is `item` or `name`
- price column is `price` or `amount`

### 5.7 Warnings

Ignored malformed lines produce:

```txt
Ignored N pasted lines that did not match the expected format.
```

Zero parsed items produce:

```txt
No valid items were detected. Use lines like `Bananas - 2.49`, `Bananas 2.49`, or `item,price`.
```

## 6. AI Handoff Contract

### 6.1 Supported providers

The current supported providers are:

- `chatgpt`
- `claude`
- `gemini`

Desktop URLs:

- ChatGPT -> `https://chatgpt.com/`
- Claude -> `https://claude.ai/`
- Gemini -> `https://gemini.google.com/app`

Mobile URLs:

- ChatGPT -> `https://chatgpt.com/`
- Claude -> `https://claude.ai/`
- Gemini -> `https://gemini.google.com/`

### 6.2 Launch target

- mobile user agent -> `_self`
- non-mobile user agent -> `_blank`

Mobile detection uses:

```txt
/android|iphone|ipad|ipod|mobile/i
```

### 6.3 Exact prompt

The prompt text is:

```txt
Read the uploaded grocery receipt and extract only the purchased receipt items.
Return the result in this exact format, one item per line:
Item name - 2.49

Rules:
- Keep only real purchasable items.
- Exclude totals, subtotals, taxes, VAT summaries, payment lines, loyalty-card savings, discounts from another card, headers, and notes.
- Do not add commentary, numbering, markdown, tables, or explanations.
- Use a plain decimal number for the price.
- If the receipt uses comma decimals, convert them to dot decimals.
```

The expected LLM output is intended to be directly acceptable by
`parsePastedItems`.

## 7. Import Application Rules

After receipt parsing or pasted-list parsing, the current app queues the import
before applying it.

When the user confirms:

- `append` mode keeps only existing non-empty items, then appends imported items
- `replace` mode discards all existing items and uses only imported items

Each imported row becomes a normal item by:

- creating a fresh `createEmptyItem(currentParticipants)`
- replacing only `name` and `price`

So imported items always inherit the default split state for the current
participant list.
