// A testem configuration file in which no code coverage data is collected.
/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-testem");

// Required to pick up the common logging function, otherwise we don't use it.
require("../../harness");

var testemComponent = gpii.testem.base({
    sourceDirs:  {
        src: "%gpii-testem/tests/testem-fixtures/coverage-fixtures/src"
    },
    contentDirs: {
        nm:  "%gpii-testem/node_modules"
    },
    testPages:   ["no-coverage.html"],
    cwd:         __dirname, // required because we are working outside of our package root.
    listeners: {
        "onTestemStart.logTestemOptions": {
            priority: "before:cleanup",
            funcName: "gpii.tests.testem.harness.outputOptions",
            args:     ["{that}"]
        }
    }
});

module.exports = testemComponent.getTestemOptions();
