// A testem configuration file in which incomplete coverage is the expected result.
/* eslint-env node */
"use strict";
var fluid = require("infusion");

require("../../harness");

var testemComponent = fluid.tests.testem.harness({
    testPages:   ["incomplete.html"],
    coveragePort: 7014,
    cwd: __dirname // required because we are working outside of our package root.
});

module.exports = testemComponent.getTestemOptions();
