/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

// fluid.require("%gpii-testem");
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
        "onCreate.logTestemOptions": {
            funcName: "gpii.tests.testem.harness.outputOptions",
            args:     ["{that}"]
        }
    }
});
