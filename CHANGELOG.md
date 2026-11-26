# Changelog

Changes made in this fork (`@jpdewing/xlsx-populate`). Earlier fork changes are in the git history.

## 4.4.4

* A sheet added since load (`addSheet`, `cloneSheet`) is given its worksheet content type override on save. Before, it had none, and its part fell back to the `xml` default (`application/xml`). A loaded sheet keeps the content type it had.
* The blank workbook (`fromBlankAsync`) names no sheet in `docProps/app.xml`: its `HeadingPairs` and `TitlesOfParts` are gone, so renaming or adding sheets no longer leaves a stale `Sheet1` list there. Its `workbook.xml` no longer carries `x15ac:absPath`, a file path from the machine the blank was made on.
* The package no longer ships a packed `.tgz` of itself.

## 4.4.3

The rule for this release: **a save loses nothing it was not asked to change.**

* Custom document properties survive a save. `docProps/custom.xml` is no longer rebuilt from a name → value map; the loaded property nodes are kept and only the node of a property that is set is changed. Untouched properties keep their names, values, value types, `pid`s, `fmtid`s, `linkTarget`s and order. (Before, every value was read as `undefined` and written back blank as `vt:lpwstr`, with `pid`s renumbered.)
* Reading a custom property returns a typed value: string, number, boolean or `Date`, by its `vt:` type. Setting one writes the type that matches the value (`vt:lpwstr`, `vt:i4` / `vt:r8`, `vt:bool`, `vt:filetime`). Setting `null` or `undefined` deletes the property. `CustomProperties` gains `names()`. `lib/types.d.ts` says the same.
* A workbook with no custom properties is no longer given an empty `docProps/custom.xml`, content type and relationship. The part is created when a property is first set.
* A workbook with a plain picture loads. The picture's blip and its SVG copy are found by element name instead of a fixed index path, so a picture with no `<a:extLst>`, or with an extension that is not an SVG copy (`a14:useLocalDpi`), no longer makes `fromDataAsync` reject. A picture with an SVG copy behaves as before.
* Pictures whose relationship targets are absolute (`/xl/media/image1.png`, as openpyxl writes them) load.
* A saved drawing part keeps the namespaces its root element was loaded with, and an untouched picture is not given empty `descr` and `title` attributes.
* From upstream `@eyeseetea/xlsx-populate` 4.3.1: the VML content type default needed by comments is added once, only when a sheet has comments and it is missing, instead of once per sheet with comments on every save.
* The calculation chain's content type override and workbook relationship are removed along with `xl/calcChain.xml`, so nothing names a part that is gone.
* A cell holding an empty string (shared, inline or `t="str"`) keeps it. Before, it was read as `undefined` and saved as an empty cell.
* A text cell whose text looks like a number (`123`) stays text. Before, it was read as a number and saved as a number cell.
