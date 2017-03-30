// A testem configuration file in which no code coverage data is collected.
/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("../harness");

fluid.defaults("gpii.tests.testem.testDefs.harness", {
    gradeNames: ["gpii.testem.commonTestDefs", "gpii.tests.testem.harness"],
    sourceDirs: ["src"],
    serveDirs:  ["src"],
    testDefFile: "%gpii-testem/tests/testem-fixtures/testDefs.json",
    cwd: __dirname // required because we are working outside of our package root.
});

var testemComponent = gpii.tests.testem.testDefs.harness();

module.exports = testemComponent.getTestemOptions();
