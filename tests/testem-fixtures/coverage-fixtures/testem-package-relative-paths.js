// A testem configuration file in which incomplete coverage is the expected result.
/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("../../harness");
require("./package-relative");

var testemComponent = gpii.tests.testem.harness({
    coveragePort: 7018,
    testPages:   ["complete.html"],
    cwd: "%package-relative",
    coverageDir: "%package-relative/coverage",
    reportsDir: "%package-relative/reports",
    instrumentedSourceDir: "%package-relative/instrumented",
    sourceDirs: {
        src: "%package-relative/src"
    },
    contentDirs: {
        nm: "%gpii-testem/node_modules"
    }
});

module.exports = testemComponent.getTestemOptions();
