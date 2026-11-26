"use strict";

/**
 * A save loses nothing it was not asked to change.
 *
 * These specs load a workbook through the real library (no mocks), save it, and look at the parts that come
 * out. Every workbook is synthetic: the blank workbook with a few hand-written parts put in.
 */

const JSZip = require("jszip");
const XlsxPopulate = require("../../lib/XlsxPopulate");
const blank = require("../../lib/blank");

const XML_DECLARATION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

// A 1x1 transparent PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>`;

/**
 * Build a workbook from the blank one.
 * @param {Function} edit - Called with the zip and helpers to change its parts.
 * @returns {Promise.<Buffer>} The workbook data.
 */
const buildWorkbookAsync = edit => {
    return JSZip.loadAsync(blank()).then(zip => {
        const read = path => zip.file(path).async("string");
        const replace = (path, search, replacement) => read(path).then(text => {
            if (text.indexOf(search) < 0) throw new Error(`"${search}" not found in ${path}`);
            zip.file(path, text.replace(search, replacement));
        });

        return Promise.resolve(edit({ zip, read, replace }))
            .then(() => zip.generateAsync({ type: "nodebuffer" }));
    });
};

/**
 * Load a workbook, optionally change it, save it and unzip the result.
 * @param {Buffer} data - The workbook data.
 * @param {Function} [change] - Called with the loaded workbook.
 * @returns {Promise.<{}>} The saved zip with a read helper.
 */
const roundTripAsync = (data, change) => {
    return XlsxPopulate.fromDataAsync(data)
        .then(workbook => {
            if (change) change(workbook);
            return workbook.outputAsync();
        })
        .then(output => JSZip.loadAsync(output))
        .then(zip => ({
            zip,
            read: path => zip.file(path).async("string")
        }));
};

const count = (text, search) => text.split(search).length - 1;

describe("Save fidelity", () => {
    describe("custom document properties", () => {
        // Written the way the library writes XML (no whitespace, self-closed empty elements) so the part can
        // be compared as text. pids are out of order and not contiguous, one fmtid is not the default, one
        // property is linked and one has a value type the library does not know.
        const CUSTOM_XML = `${XML_DECLARATION
        }<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="7" name="Label_Enabled"><vt:lpwstr>true</vt:lpwstr></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="Label_Name"><vt:lpwstr>Example &amp; Co</vt:lpwstr></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="4" name="Numeric text"><vt:lpwstr>12345</vt:lpwstr></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="5" name="Empty text"><vt:lpwstr/></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="9" name="Count"><vt:i4>42</vt:i4></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="10" name="Ratio"><vt:r8>1.5</vt:r8></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="11" name="Approved"><vt:bool>true</vt:bool></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="12" name="Rejected"><vt:bool>false</vt:bool></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="13" name="Reviewed"><vt:filetime>2020-02-03T04:05:06Z</vt:filetime></property>`
            + `<property fmtid="{11111111-2222-3333-4444-555555555555}" pid="14" name="Other format"><vt:lpwstr>other</vt:lpwstr></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="15" name="Linked" linkTarget="SomeName"><vt:lpwstr>linked</vt:lpwstr></property>`
            + `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="16" name="Unknown type"><vt:clsid>{00000000-0000-0000-0000-000000000001}</vt:clsid></property>`
            + `</Properties>`;

        const withCustomPropertiesAsync = () => buildWorkbookAsync(({ zip, replace }) => {
            zip.file("docProps/custom.xml", CUSTOM_XML);
            return replace("[Content_Types].xml", "</Types>",
                `<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>`)
                .then(() => replace("_rels/.rels", "</Relationships>",
                    `<Relationship Id="rId4" Type="${REL_NS}/custom-properties" Target="docProps/custom.xml"/></Relationships>`));
        });

        itAsync("should save untouched properties exactly as loaded", () => {
            return withCustomPropertiesAsync()
                .then(data => roundTripAsync(data, workbook => {
                    // Writing a cell is not touching the properties.
                    workbook.sheet(0).cell("A1").value("filled");
                }))
                .then(saved => saved.read("docProps/custom.xml"))
                .then(text => {
                    expect(text).toBe(CUSTOM_XML);
                });
        });

        itAsync("should not add a second content type or relationship for the part", () => {
            return withCustomPropertiesAsync()
                .then(data => roundTripAsync(data))
                .then(saved => Promise.all([saved.read("[Content_Types].xml"), saved.read("_rels/.rels")]))
                .then(texts => {
                    expect(count(texts[0], "/docProps/custom.xml")).toBe(1);
                    expect(count(texts[1], "docProps/custom.xml")).toBe(1);
                });
        });

        itAsync("should read each property as a typed value", () => {
            return withCustomPropertiesAsync()
                .then(data => XlsxPopulate.fromDataAsync(data))
                .then(workbook => {
                    expect(workbook.customProperty("Label_Enabled")).toBe("true");
                    expect(workbook.customProperty("Label_Name")).toBe("Example & Co");
                    expect(workbook.customProperty("Numeric text")).toBe("12345");
                    expect(workbook.customProperty("Empty text")).toBe("");
                    expect(workbook.customProperty("Count")).toBe(42);
                    expect(workbook.customProperty("Ratio")).toBe(1.5);
                    expect(workbook.customProperty("Approved")).toBe(true);
                    expect(workbook.customProperty("Rejected")).toBe(false);
                    expect(workbook.customProperty("Reviewed")).toEqual(new Date(Date.UTC(2020, 1, 3, 4, 5, 6)));
                    expect(workbook.customProperty("Unknown type")).toBe("{00000000-0000-0000-0000-000000000001}");
                    expect(workbook.customProperty("Missing")).toBeUndefined();
                    expect(workbook.customProperty(["Count", "Approved"])).toEqual({ Count: 42, Approved: true });
                    expect(workbook.customProperties().names().length).toBe(12);
                });
        });

        itAsync("should change only the property that is set", () => {
            return withCustomPropertiesAsync()
                .then(data => roundTripAsync(data, workbook => {
                    workbook.customProperty("Count", 43);
                }))
                .then(saved => saved.read("docProps/custom.xml"))
                .then(text => {
                    expect(text).toBe(CUSTOM_XML.replace("<vt:i4>42</vt:i4>", "<vt:i4>43</vt:i4>"));
                });
        });

        itAsync("should write the value type that matches the value set", () => {
            return withCustomPropertiesAsync()
                .then(data => roundTripAsync(data, workbook => {
                    workbook.customProperty({
                        Count: "now text",
                        "New text": "text",
                        "New integer": 7,
                        "New real": 2.5,
                        "New boolean": false,
                        "New date": new Date(Date.UTC(2021, 0, 2, 3, 4, 5))
                    });
                }))
                .then(saved => saved.read("docProps/custom.xml"))
                .then(text => {
                    // An existing property keeps its place and pid; new ones follow the highest pid.
                    expect(text).toContain(`pid="9" name="Count"><vt:lpwstr>now text</vt:lpwstr>`);
                    expect(text).toContain(`pid="17" name="New text"><vt:lpwstr>text</vt:lpwstr>`);
                    expect(text).toContain(`pid="18" name="New integer"><vt:i4>7</vt:i4>`);
                    expect(text).toContain(`pid="19" name="New real"><vt:r8>2.5</vt:r8>`);
                    expect(text).toContain(`pid="20" name="New boolean"><vt:bool>false</vt:bool>`);
                    expect(text).toContain(`pid="21" name="New date"><vt:filetime>2021-01-02T03:04:05Z</vt:filetime>`);

                    // Everything else is as it was.
                    const untouched = CUSTOM_XML.split("<property ").filter(part => part.indexOf(`name="Count"`) < 0);
                    untouched.forEach(part => expect(text).toContain(part.replace("</Properties>", "")));
                });
        });

        itAsync("should delete a property and leave the others", () => {
            return withCustomPropertiesAsync()
                .then(data => roundTripAsync(data, workbook => {
                    workbook.customProperties().delete("Count");
                }))
                .then(saved => saved.read("docProps/custom.xml"))
                .then(text => {
                    expect(text).toBe(CUSTOM_XML.replace(
                        `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="9" name="Count"><vt:i4>42</vt:i4></property>`, ""));
                });
        });

        itAsync("should not give a workbook without custom properties an empty part", () => {
            return roundTripAsync(blank())
                .then(saved => {
                    expect(saved.zip.file("docProps/custom.xml")).toBeNull();
                    return Promise.all([saved.read("[Content_Types].xml"), saved.read("_rels/.rels")]);
                })
                .then(texts => {
                    expect(texts[0]).not.toContain("custom.xml");
                    expect(texts[1]).not.toContain("custom.xml");
                });
        });

        itAsync("should create the part when a property is set on a workbook that had none", () => {
            return roundTripAsync(blank(), workbook => workbook.customProperty("First", "value"))
                .then(saved => Promise.all([
                    saved.read("docProps/custom.xml"),
                    saved.read("[Content_Types].xml"),
                    saved.read("_rels/.rels")
                ]))
                .then(texts => {
                    expect(texts[0]).toContain(`pid="2" name="First"><vt:lpwstr>value</vt:lpwstr>`);
                    expect(count(texts[1], "/docProps/custom.xml")).toBe(1);
                    expect(count(texts[2], "docProps/custom.xml")).toBe(1);
                });
        });
    });

    describe("pictures", () => {
        const XDR_NS = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
        const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";

        const anchor = (id, name, blip) => `<xdr:twoCellAnchor editAs="oneCell">`
            + `<xdr:from><xdr:col>${id}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
            + `<xdr:to><xdr:col>${id + 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
            + `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${id}" name="${name}"/><xdr:cNvPicPr/></xdr:nvPicPr>`
            + `<xdr:blipFill>${blip}<a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
            + `<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor>`;

        // A picture as openpyxl and plain Excel write it: no extension list in the blip.
        const PLAIN = anchor(1, "Plain", `<a:blip xmlns:r="${REL_NS}" r:embed="rId1"/>`);

        // A picture with an extension that is not an SVG copy.
        const LOCAL_DPI = anchor(2, "LocalDpi", `<a:blip xmlns:r="${REL_NS}" r:embed="rId2"><a:extLst>`
            + `<a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}"><a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/></a:ext>`
            + `</a:extLst></a:blip>`);

        // A picture with the SVG copy Excel keeps beside the rendered PNG.
        const WITH_SVG = anchor(3, "WithSvg", `<a:blip xmlns:r="${REL_NS}" r:embed="rId3"><a:extLst>`
            + `<a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}"><a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/></a:ext>`
            + `<a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId4"/></a:ext>`
            + `</a:extLst></a:blip>`);

        const withPicturesAsync = (anchors, opts) => buildWorkbookAsync(({ zip, replace }) => {
            opts = opts || {};
            const target = name => opts.absoluteTargets ? `/xl/media/${name}` : `../media/${name}`;

            zip.file("xl/drawings/drawing1.xml",
                `${XML_DECLARATION}<xdr:wsDr xmlns:xdr="${XDR_NS}" xmlns:a="${A_NS}">${anchors.join("")}</xdr:wsDr>`);
            zip.file("xl/drawings/_rels/drawing1.xml.rels", `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
                + `<Relationship Id="rId1" Type="${REL_NS}/image" Target="${target("image1.png")}"/>`
                + `<Relationship Id="rId2" Type="${REL_NS}/image" Target="${target("image2.png")}"/>`
                + `<Relationship Id="rId3" Type="${REL_NS}/image" Target="${target("image3.png")}"/>`
                + `<Relationship Id="rId4" Type="${REL_NS}/image" Target="${target("image4.svg")}"/>`
                + `</Relationships>`);
            zip.file("xl/worksheets/_rels/sheet1.xml.rels", `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
                + `<Relationship Id="rId1" Type="${REL_NS}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
            zip.file("xl/media/image1.png", PNG);
            zip.file("xl/media/image2.png", PNG);
            zip.file("xl/media/image3.png", PNG);
            zip.file("xl/media/image4.svg", SVG);

            return replace("xl/worksheets/sheet1.xml", "</worksheet>", `<drawing r:id="rId1"/></worksheet>`)
                .then(() => replace("[Content_Types].xml", "</Types>",
                    `<Default Extension="png" ContentType="image/png"/><Default Extension="svg" ContentType="image/svg+xml"/>`
                    + `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`));
        });

        const expectSavedAsLoaded = (saved, anchors) => {
            return Promise.all([
                saved.read("xl/drawings/drawing1.xml"),
                saved.read("xl/drawings/_rels/drawing1.xml.rels"),
                saved.read("xl/worksheets/sheet1.xml"),
                saved.zip.file("xl/media/image1.png").async("nodebuffer")
            ]).then(parts => {
                anchors.forEach(text => expect(parts[0]).toContain(text));
                expect(count(parts[0], "<xdr:twoCellAnchor")).toBe(anchors.length);
                expect(count(parts[1], "<Relationship ")).toBe(4);
                expect(parts[2]).toContain(`<drawing r:id="rId1"/>`);
                expect(parts[3].equals(PNG)).toBe(true);
            });
        };

        itAsync("should load a workbook whose picture has no SVG copy and keep the picture on save", () => {
            return withPicturesAsync([PLAIN])
                .then(data => roundTripAsync(data, workbook => {
                    const drawings = workbook.sheet(0).drawings();
                    expect(drawings.length).toBe(1);
                    expect(drawings[0].name()).toBe("Plain");
                    expect(drawings[0].svgPath()).toBe("");
                    workbook.sheet(0).cell("A1").value("filled");
                }))
                .then(saved => expectSavedAsLoaded(saved, [PLAIN]));
        });

        itAsync("should load a picture whose blip has an extension that is not an SVG copy", () => {
            return withPicturesAsync([LOCAL_DPI])
                .then(data => roundTripAsync(data, workbook => {
                    expect(workbook.sheet(0).drawings("LocalDpi").svgPath()).toBe("");
                }))
                .then(saved => expectSavedAsLoaded(saved, [LOCAL_DPI]));
        });

        itAsync("should still find the SVG copy of a picture that has one", () => {
            return withPicturesAsync([PLAIN, LOCAL_DPI, WITH_SVG])
                .then(data => roundTripAsync(data, workbook => {
                    const sheet = workbook.sheet(0);
                    expect(sheet.drawings().length).toBe(3);
                    expect(sheet.drawings("WithSvg").path()).toBe("../media/image3.png");
                    expect(sheet.drawings("WithSvg").svgPath()).toBe("../media/image4.svg");
                    expect(sheet.drawings("WithSvg").svgImage()).toBeDefined();
                    expect(sheet.drawings("Plain").svgPath()).toBe("");
                }))
                .then(saved => expectSavedAsLoaded(saved, [PLAIN, LOCAL_DPI, WITH_SVG]));
        });

        itAsync("should load pictures whose relationship targets are absolute, as openpyxl writes them", () => {
            return withPicturesAsync([PLAIN], { absoluteTargets: true })
                .then(data => roundTripAsync(data, workbook => {
                    const drawing = workbook.sheet(0).drawings("Plain");
                    expect(drawing.path()).toBe("/xl/media/image1.png");
                    expect(drawing.size()).toBe(PNG.length);
                }))
                .then(saved => saved.read("xl/drawings/_rels/drawing1.xml.rels"))
                .then(text => {
                    expect(text).toContain(`Target="/xl/media/image1.png"`);
                });
        });
    });

    describe("comments", () => {
        itAsync("should add the VML content type default once however many sheets have comments or saves are made", () => {
            let workbook;
            return XlsxPopulate.fromBlankAsync()
                .then(wb => {
                    workbook = wb;
                    workbook.sheet(0).cell("A1").comment({ text: "first" });
                    workbook.addSheet("Second").cell("B2").comment({ text: "second" });
                    return workbook.outputAsync();
                })
                .then(() => workbook.outputAsync())
                .then(output => JSZip.loadAsync(output))
                .then(zip => zip.file("[Content_Types].xml").async("string"))
                .then(text => {
                    expect(count(text, `Extension="vml"`)).toBe(1);
                    expect(text).toContain(`<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>`);
                });
        });

        itAsync("should not add the VML content type default to a workbook without comments", () => {
            return roundTripAsync(blank())
                .then(saved => saved.read("[Content_Types].xml"))
                .then(text => {
                    expect(text).not.toContain(`Extension="vml"`);
                });
        });
    });

    describe("calculation chain", () => {
        itAsync("should remove the content type and relationship along with the part", () => {
            return buildWorkbookAsync(({ zip, replace }) => {
                zip.file("xl/calcChain.xml",
                    `${XML_DECLARATION}<calcChain xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><c r="A1" i="1"/></calcChain>`);
                return replace("[Content_Types].xml", "</Types>",
                    `<Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>`)
                    .then(() => replace("xl/_rels/workbook.xml.rels", "</Relationships>",
                        `<Relationship Id="rId9" Type="${REL_NS}/calcChain" Target="calcChain.xml"/></Relationships>`));
            })
                .then(data => roundTripAsync(data))
                .then(saved => {
                    expect(saved.zip.file("xl/calcChain.xml")).toBeNull();
                    return Promise.all([saved.read("[Content_Types].xml"), saved.read("xl/_rels/workbook.xml.rels")]);
                })
                .then(texts => {
                    expect(texts[0]).not.toContain("calcChain");
                    expect(texts[1]).not.toContain("calcChain");

                    // The other relationships are still there.
                    expect(count(texts[1], "<Relationship ")).toBe(4);
                });
        });
    });

    describe("added sheets", () => {
        const WORKSHEET = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";

        itAsync("should give every sheet part a worksheet content type", () => {
            return roundTripAsync(blank(), workbook => {
                workbook.addSheet("Second");
                workbook.cloneSheet(workbook.sheet(0), "Third");
            })
                .then(saved => saved.read("[Content_Types].xml"))
                .then(types => {
                    ["sheet1", "sheet2", "sheet3"].forEach(sheet => {
                        expect(count(types, `<Override PartName="/xl/worksheets/${sheet}.xml" ContentType="${WORKSHEET}"/>`)).toBe(1);
                    });
                });
        });

        itAsync("should add no worksheet content type when no sheet is added", () => {
            return JSZip.loadAsync(blank())
                .then(zip => zip.file("[Content_Types].xml").async("string"))
                .then(before => roundTripAsync(blank())
                    .then(saved => saved.read("[Content_Types].xml"))
                    .then(after => expect(count(after, WORKSHEET)).toBe(count(before, WORKSHEET))));
        });
    });

    describe("the blank workbook", () => {
        itAsync("should name no sheet in its document properties, so a renamed or added sheet leaves none stale", () => {
            return roundTripAsync(blank(), workbook => {
                workbook.sheet(0).name("First");
                workbook.addSheet("Second");
            })
                .then(saved => saved.read("docProps/app.xml"))
                .then(app => {
                    expect(app).not.toContain("TitlesOfParts");
                    expect(app).not.toContain("HeadingPairs");
                    expect(app).not.toContain("Sheet1");
                });
        });

        itAsync("should carry no file path from the machine it was made on", () => {
            return roundTripAsync(blank())
                .then(saved => saved.read("xl/workbook.xml"))
                .then(workbook => {
                    expect(workbook).not.toContain("absPath");
                    expect(workbook).not.toContain("C:\\");
                });
        });
    });

    describe("text that looks like a number", () => {
        const withNumericTextAsync = () => buildWorkbookAsync(({ zip, replace }) => {
            zip.file("xl/sharedStrings.xml",
                `${XML_DECLARATION}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>123</t></si><si><t>007</t></si></sst>`);
            return replace("xl/worksheets/sheet1.xml", "<sheetData/>", `<sheetData><row r="1">`
                + `<c r="A1" t="s"><v>0</v></c>`
                + `<c r="B1" t="s"><v>1</v></c>`
                + `<c r="C1" t="inlineStr"><is><t>456</t></is></c>`
                + `<c r="D1"><v>789</v></c>`
                + `</row></sheetData>`);
        });

        itAsync("should read a text cell as text and a number cell as a number", () => {
            return withNumericTextAsync()
                .then(data => XlsxPopulate.fromDataAsync(data))
                .then(workbook => {
                    const sheet = workbook.sheet(0);
                    expect(sheet.cell("A1").value()).toBe("123");
                    expect(sheet.cell("B1").value()).toBe("007");
                    expect(sheet.cell("C1").value()).toBe("456");
                    expect(sheet.cell("D1").value()).toBe(789);
                });
        });

        itAsync("should keep an untouched text cell as text", () => {
            return withNumericTextAsync()
                .then(data => roundTripAsync(data))
                .then(saved => Promise.all([saved.read("xl/worksheets/sheet1.xml"), saved.read("xl/sharedStrings.xml")]))
                .then(texts => {
                    expect(texts[0]).toContain(`<c r="A1" t="s"><v>0</v></c>`);
                    expect(texts[0]).toContain(`<c r="B1" t="s"><v>1</v></c>`);
                    expect(texts[0]).toContain(`<c r="C1" t="s"><v>2</v></c>`);
                    expect(texts[0]).toContain(`<c r="D1"><v>789</v></c>`);
                    expect(texts[1]).toContain(`<si><t>123</t></si><si><t>007</t></si>`);
                    expect(texts[1]).toContain(`>456</t></si></sst>`);
                });
        });
    });

    describe("empty strings", () => {
        const withEmptyStringsAsync = () => buildWorkbookAsync(({ zip, replace }) => {
            zip.file("xl/sharedStrings.xml",
                `${XML_DECLARATION}<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="3" uniqueCount="2"><si><t>text</t></si><si><t/></si></sst>`);
            return replace("[Content_Types].xml", "</Types>",
                `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`)
                .then(() => replace("xl/_rels/workbook.xml.rels", "</Relationships>",
                    `<Relationship Id="rId9" Type="${REL_NS}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`))
                .then(() => replace("xl/worksheets/sheet1.xml", "<sheetData/>", `<sheetData><row r="1">`
                    + `<c r="A1" t="s"><v>0</v></c>`
                    + `<c r="B1" t="s"><v>1</v></c>`
                    + `<c r="C1" t="inlineStr"><is><t/></is></c>`
                    + `<c r="D1" t="str"><v/></c>`
                    + `<c r="E1" s="0"/>`
                    + `</row></sheetData>`));
        });

        itAsync("should read a cell holding an empty string as an empty string", () => {
            return withEmptyStringsAsync()
                .then(data => XlsxPopulate.fromDataAsync(data))
                .then(workbook => {
                    const sheet = workbook.sheet(0);
                    expect(sheet.cell("A1").value()).toBe("text");
                    expect(sheet.cell("B1").value()).toBe("");
                    expect(sheet.cell("C1").value()).toBe("");
                    expect(sheet.cell("D1").value()).toBe("");
                    expect(sheet.cell("E1").value()).toBeUndefined();
                });
        });

        itAsync("should keep the empty string of a cell nobody wrote to", () => {
            return withEmptyStringsAsync()
                .then(data => roundTripAsync(data, workbook => {
                    workbook.sheet(0).cell("A2").value("filled");
                }))
                .then(saved => Promise.all([saved.read("xl/worksheets/sheet1.xml"), saved.read("xl/sharedStrings.xml")]))
                .then(texts => {
                    // The empty string keeps its place in the shared strings and the cells still point to it.
                    expect(texts[1]).toContain(`<si><t>text</t></si><si><t/></si>`);
                    expect(texts[0]).toContain(`<c r="A1" t="s"><v>0</v></c>`);
                    expect(texts[0]).toContain(`<c r="B1" t="s"><v>1</v></c>`);
                    expect(texts[0]).toContain(`<c r="C1" t="s"><v>1</v></c>`);
                    expect(texts[0]).toContain(`<c r="D1" t="s"><v>1</v></c>`);

                    // A cell that really is empty stays empty.
                    expect(texts[0]).toContain(`<c r="E1" s="0"/>`);
                });
        });
    });
});
