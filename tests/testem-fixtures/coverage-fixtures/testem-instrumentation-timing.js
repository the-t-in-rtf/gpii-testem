/*

    Intentionally delay the instrumentation phase to ensure that it does not result in Testem reading incomplete
    options.  See https://issues.fluid.net/browse/fluid-2507 for details.

 */
/* eslint-env node */
"use strict";
var fluid = require("infusion");

require("../../harness");

fluid.registerNamespace("fluid.tests.testem.instrumentationTiming");

/**
 *
 * Function to synchronously block until `timeout` milliseconds have passed.
 *
 * @param {Number} timeout - The timeout, in milliseconds.
 */
fluid.tests.testem.instrumentationTiming.sleep = function (timeout) {
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
 * @param {Object} that - The component itself.
 */
fluid.tests.testem.instrumentationTiming.instrumentSlowly = function (that) {
    fluid.tests.testem.instrumentationTiming.sleep(that.options.instrumentationDelay);
    //eslint-disable-next-line no-console
    console.log("finally instrumenting code...");
    fluid.testem.coverage.instrumentSource(that);
};

fluid.defaults("fluid.tests.testem.instrumentationTiming.harness", {
    gradeNames: ["fluid.tests.testem.harness"],
    instrumentationDelay: 5000,
    testPages:   ["complete.html"],
    cwd: __dirname, // required because we are working outside of our package root.
    listeners: {
        "onTestemStart.instrument": {
            priority: "after:cleanup",
            funcName: "fluid.tests.testem.instrumentationTiming.instrumentSlowly",
            args:     ["{that}"]
        }
    }
});

var testemComponent = fluid.tests.testem.instrumentationTiming.harness();
module.exports = testemComponent.getTestemOptions();
