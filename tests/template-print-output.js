"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

assert(html.includes("function cloneResultTableForOutput(source)"), "MPR print output sanitizer is missing");
assert(html.includes('table.querySelectorAll(".mpr-sort-button").forEach'), "MPR sort controls are not converted to print labels");
assert(html.includes('table.querySelectorAll("button").forEach(button => button.remove())'), "Interactive header boxes must be removed from printed MPR tables");
assert(html.includes(".mpr-output-table thead tr:last-child th{height:34px"), "Printed table headings must use an even horizontal layout");
assert(html.includes("writing-mode:horizontal-tb"), "Printed table labels must remain horizontal");
assert(html.includes("function excelResultsMarkup()"), "Excel export needs a dedicated high-contrast table sanitizer");
assert(html.includes("background:#ffffff;color:#111111") && html.includes(".design-status.pass"), "Excel cells and status cells need explicit readable foreground/background colors");

assert(html.includes('id="deleteTemplatesBtn"'), "Templates gallery delete icon is missing");
assert(html.includes("const selectedTemplateIds = new Set()"), "Multiple template selection state is missing");
assert(html.includes("function deleteSelectedTemplates()"), "Selected-template deletion is missing");
assert(html.includes("deletedTemplateStorageKey"), "Deleted built-in templates must remain deleted after reload");
assert(html.includes("isometricView.zoom = 1.18") && html.includes("isometricView.pan = {x: 0, y: 0}"), "Template thumbnails must use the centred close-up 3D ISO view");
assert(html.includes("thumbnail.width = 960") && html.includes("thumbnail.height = 600"), "Template thumbnails must use the close-up landscape format");
assert(html.includes('showUnifiedDrawingView("ISO")'), "Save as Template must select the 3D ISO view");
assert(html.includes("isometricView.zoom = previousView.zoom") && html.includes("isometricView.pan = previousView.pan"), "Thumbnail capture must restore the user's 3D view");
assert(html.includes("#saveTemplateDialog #saveTemplateName"), "Save-template title input contrast styling is missing");
assert(html.includes("background:#fff!important") && html.includes("color:#070b0c!important"), "Save-template title input must have high-contrast text and background");

console.log("template gallery and MPR print-output regression tests: passed");
