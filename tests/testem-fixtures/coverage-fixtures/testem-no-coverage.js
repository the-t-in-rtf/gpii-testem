// A testem configuration file in which no code coverage data is collected.
/* eslint-env node */
"use strict";
var fluid = require("infusion");

fluid.require("%fluid-testem");

// Required to pick up the common logging function, otherwise we don't use it.
require("../../harness");

var testemComponent = fluid.testem.base({
    sourceDirs:  {
        src: "%fluid-testem/tests/testem-fixtures/coverage-fixtures/src"
    },
    contentDirs: {
        nm:  "%fluid-testem/node_modules"
    },
    testPages:   ["no-coverage.html"],
    cwd:         __dirname, // required because we are working outside of our package root.
    listeners: {
        "onTestemStart.logTestemOptions": {
            priority: "before:cleanup",
            funcName: "fluid.tests.testem.harness.outputOptions",
            args:     ["{that}"]
        }
    },
    testemOptions: {
        skip: "Safari,PhantomJS"
    }
});

module.exports = testemComponent.getTestemOptions();
