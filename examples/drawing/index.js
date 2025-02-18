"use strict";
const fs = require('fs');
const XlsxPopulate = require('../../lib/XlsxPopulate');

// Get template workbook and sheet.
XlsxPopulate.fromFileAsync('./examples/drawing/template.xlsx')
    .then(workbook => {
        // Replace png image
        const pngSheet = workbook.sheet('png');
        pngSheet.drawings('png_1').image('./examples/drawing/png2.png');

        // Replace svg image
        const svgSheet = workbook.sheet('svg');
        svgSheet.drawings('svg_1').svgImage('./examples/drawing/svg2.svg');

        // Add new png image
        const sheet1 = workbook.sheet('Sheet1');
        const buffer = fs.readFileSync('./examples/drawing/png1.png', { encoding: 'binary' });
        const file = new Blob([buffer]);
        const drawing = sheet1.drawings('my_image', file);
        drawing.from('A1').to('N50');
        
        // Write to file.
        return workbook.toFileAsync('./examples/drawing/out.xlsx');
    })
    .catch(err => console.error(err));
