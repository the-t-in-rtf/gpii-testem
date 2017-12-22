/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("../");

fluid.registerNamespace("gpii.tests.testem.harness");

// Some of our temporary directories are based on the component ID.  This bit of logging gives us a way to find out where things are stored from the outside.
gpii.tests.testem.harness.outputOptions = function (that) {
    console.log("= START TESTEM COMPONENT OPTIONS =\n", JSON.stringify(fluid.filterKeys(that.options, ["testemOptions", "reportsDir", "coverageDir"]), null, 2), "= END TESTEM COMPONENT OPTIONS =\n");
};

/*

    Testem by default can only host content in a subdirectory of the working directory.  For tests for a whole
    package, this is adequate.  Since our tests are not for a single package, we need something to safely host
    "whole package" content like our node_modules.  Thus, we use the coverage harness to host some of our content.

    Unlike "normal" tests, we also need some indication of where our output resides that can be read from "the outside".
    We output select options to console as text to facilitate this.

 */
fluid.defaults("gpii.tests.testem.harness", {
    gradeNames: ["gpii.testem"],
    testemOptions: {
        skip: "Safari,PhantomJS",
        proxies: {
            "/node_modules": {
                "target": "{that}.options.coverageUrl"
            }
        }
    },
    components: {
        coverageExpressInstance: {
            options: {
                components: {
                    modules: {
                        type: "gpii.express.router.static",
                        options: {
                            path:    "/node_modules",
                            content: ["%gpii-testem/node_modules"]
                        }
                    }
                }
            }
        }
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
