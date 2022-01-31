# `<details-utils>`

* [Demo](https://zachleat.github.io/details-utils/demo.html)

## Installation

```
npm install @zachleat/details-utils
```

Add `details-utils.js` to your bundle.

## Usage

Wrap `<details-utils>` around one or more `<details>` elements to add enhancements to their behavior:

* Click outside to close (also bind an optional close button)
* Animate open and close (obeys `prefers-reduced-motion`)
* Force open/closed based on:
  - JavaScript
  - Media query (e.g. viewport size, `prefers-reduced-motion`, even `prefers-reduced-data` if browsers ever support it 😅)
* Close via `esc` Key
  - With optional Media query.
* Toggle Document Class (toggles a class on `<html>` when active, useful for modals to disable document overflow)
