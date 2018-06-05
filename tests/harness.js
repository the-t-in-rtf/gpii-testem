/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-testem");

fluid.registerNamespace("gpii.tests.testem.harness");

// Some of our temporary directories are based on the component ID.  This bit of logging gives us a way to find out where things are stored from the outside.
gpii.tests.testem.harness.outputOptions = function (that) {
    console.log(
        "= START TESTEM COMPONENT OPTIONS =\n",
        JSON.stringify(
            //that.options, null, 2
            fluid.filterKeys(that.options, [
                "contentDirs",
                "coverageDir",
                "instrumentedSourceDir",
                "instrumentedSourceDirs",
                "reportsDir",
                "sourceDirs",
                "testemOptions"
            ]), null, 2
        ),
        "= END TESTEM COMPONENT OPTIONS =\n");
};

/*

    Unlike "normal" tests, we also need some indication of where our output resides that can be read from "the outside".
    We output select options to console as text to facilitate this.

 */
fluid.defaults("gpii.tests.testem.harness", {
    gradeNames: ["gpii.testem"],
    sourceDirs: {
        src: "%gpii-testem/tests/testem-fixtures/coverage-fixtures/src"
    },
    contentDirs: {
        nm: "%gpii-testem/node_modules"
    },
    testemOptions: {
        skip: "Safari,PhantomJS"
    },
    listeners: {
        "onTestemStart.logTestemOptions": {
            priority: "before:cleanup",
            funcName: "gpii.tests.testem.harness.outputOptions",
            args:     ["{that}"]
        },
        "constructFixtures.log": {
            funcName: "fluid.log",
            args:     ["Constructing fixtures..."]
        },
        "onTestemStart.log": {
            funcName: "fluid.log",
            args:     ["Starting Testem..."]
        },
        "onTestemExit.log": {
            funcName: "fluid.log",
            args:     ["Exiting Testem..."]
        },
        "onExpressStarted.log": {
            funcName: "fluid.log",
            args:     ["Starting Express..."]
        },
        "onFixturesConstructed.log": {
            funcName: "fluid.log",
            args:     ["Fixtures constructed..."]
        },
        "stopFixtures.log": {
            funcName: "fluid.log",
            args:     ["Stopping fixtures..."]
        },
        "onExpressStopped.log": {
            funcName: "fluid.log",
            args:     ["Express stopped..."]
        },
        "onFixturesStopped.log": {
            funcName: "fluid.log",
            args:     ["Fixtures stopped..."]
        }
    }
});
