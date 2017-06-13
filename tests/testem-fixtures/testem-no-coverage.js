// A testem configuration file in which no code coverage data is collected.
/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("../harness");

var testemComponent = gpii.tests.testem.harness({
    sourceDirs: ["src"],
    serveDirs:  ["src"],
    testPages:   ["no-coverage.html"],
    instrumentSource: false,
    generateCoverageReport: false,
    cwd: __dirname // required because we are working outside of our package root.
});

module.exports = testemComponent.getTestemOptions();
