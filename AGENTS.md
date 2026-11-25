# AGENTS.md

## What this fork is for

`@jpdewing/xlsx-populate` is a fork of `@eyeseetea/xlsx-populate` (itself a fork of `dtjohnson/xlsx-populate`). It is used to fill Excel workbook templates that someone else maintains: macros, formulas, named ranges, protected sheets, pictures, document properties. On top of upstream it adds SVG pictures, pictures on several sheets, custom document properties, cell metadata and exported address helpers.

## The rule

**A save loses nothing it was not asked to change.** The cells (or properties, or pictures) a caller wrote change; every other part of the workbook comes back as it was loaded.

What that means when working here:

* Keep the parsed XML nodes and change only the node you were asked to change. Do not read a part into a simpler model and rebuild the part from that model on save: whatever the model does not hold is lost.
* Find elements by name (`xmlq.findChild`, `Drawing.findDescendant`), never by a fixed `children[n]` path. Optional elements are often absent.
* Do not add a part, content type or relationship to a workbook that did not have one unless the caller's change needs it. If you remove a part, remove its content type and relationship too.
* `XmlParser` turns text and attribute values that look like numbers into numbers, and drops whitespace-only text. Where a value is text by definition (a shared string, a string property, a name), turn it back with `String()` and treat no text as `""`, not `undefined`.
* Known and accepted differences every save makes: `<dimension>` is dropped, `count` attributes are dropped, numbers may be respelled, the calculation chain is removed.

## Tests

```bash
pnpm install
pnpm test                 # unit specs (Jasmine), test/unit/*.spec.js
pnpm run e2e-parse        # parses real workbooks in test/e2e-parse
```

* To run one spec file: `npx jasmine JASMINE_CONFIG_PATH=test/unit/jasmine.json test/unit/SaveFidelity.spec.js`
* `test/unit/SaveFidelity.spec.js` holds the tests for the rule. They run the real library with no mocks: build a workbook, load it, save it, compare the parts. Add a test there for any change that touches loading or saving, and check it fails before the fix.
* 65 older specs in `Cell`, `Row`, `Sheet`, `StyleSheet`, `Workbook` and `RichText` fail on `master`. They mock internals the fork has since changed. They are not caused by your change, but do not add to them: compare the failure list before and after.
* `pnpm run e2e-generate` needs Windows with Excel installed.
* Test workbooks are **synthetic**: built in the test or by a small script. This repository is public. Never commit a production template, or anything holding a real price, a real name or a real sensitivity label.

## Releases

* Bump `version` in `package.json` and add a line per change to `CHANGELOG.md`.
* `README.md` is generated: edit `docs/template.md` and the JSDoc in `lib/`, then run `npx gulp docs`. Keep `lib/types.d.ts` in step with the JSDoc by hand.
* `browser/` holds the built bundles; `pnpm run build` regenerates them.
* Publishing (`npm publish` / `pnpm run release`) is the maintainer's step. Do not publish.
