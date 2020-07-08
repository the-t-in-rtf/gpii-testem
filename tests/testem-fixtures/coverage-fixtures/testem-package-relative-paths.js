// A testem configuration file in which incomplete coverage is the expected result.
/* eslint-env node */
"use strict";
var fluid = require("infusion");

require("../../harness");
require("./package-relative");

var testemComponent = fluid.tests.testem.harness({
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
        nm: "%fluid-testem/node_modules"
    }
});

module.exports = testemComponent.getTestemOptions();
