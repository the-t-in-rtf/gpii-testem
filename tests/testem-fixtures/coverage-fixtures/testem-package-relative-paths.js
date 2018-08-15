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
    },
    // NOTE: The next option is only required because of a Testem bug WRT the cwd option on Windows, and can be removed
    // once this issue is resolved:
    //
    // https://github.com/testem/testem/issues/1286
    testemOptions: {
        unsafe_file_serving: true
    }
});

module.exports = testemComponent.getTestemOptions();
