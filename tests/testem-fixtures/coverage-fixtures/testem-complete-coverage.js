// A testem configuration file in which complete coverage is the expected result.
/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-testem");

require("../../harness");

var testemComponent = gpii.tests.testem.harness({
    cwd:         __dirname, // required because we are working outside of our package root.
    testPages:   ["complete.html"],
    coveragePort: 7015
});

module.exports = testemComponent.getTestemOptions();
