/*

    Intentionally delay the instrumentation phase to ensure that it does not result in Testem reading incomplete
    options.  See https://issues.gpii.net/browse/GPII-2507 for details.

 */
/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("../../harness");

fluid.registerNamespace("gpii.tests.testem.instrumentationTiming");

/**
 *
 * Function to synchronously block until `timeout` milliseconds have passed.
 *
 * @param timeout
 */
gpii.tests.testem.instrumentationTiming.sleep = function (timeout) {
    var start = new Date().getTime();
    var now = start;
    while ((now - start) < timeout) {
        now = new Date().getTime();
    }
};

/**
 *
 *
 * A function that intentionally delays the usual instrumentation phase to ensure that a coverage report is still prepared and complete.
 *
 * @param that
 */
gpii.tests.testem.instrumentationTiming.instrumentSlowly = function (that) {
    gpii.tests.testem.instrumentationTiming.sleep(that.options.instrumentationDelay);
    console.log("finally instrumenting code...");
    gpii.testem.coverage.instrumentSource(that);
};

fluid.defaults("gpii.tests.testem.instrumentationTiming.harness", {
    gradeNames: ["gpii.tests.testem.harness"],
    instrumentationDelay: 5000,
    testPages:   ["complete.html"],
    cwd: __dirname, // required because we are working outside of our package root.
    listeners: {
        "onTestemStart.instrument": {
            priority: "after:cleanup",
            funcName: "gpii.tests.testem.instrumentationTiming.instrumentSlowly",
            args:     ["{that}"]
        }
    }
});

var testemComponent = gpii.tests.testem.instrumentationTiming.harness();
module.exports = testemComponent.getTestemOptions();
