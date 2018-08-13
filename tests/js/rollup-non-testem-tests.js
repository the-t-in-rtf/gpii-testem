/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var jqUnit = require("node-jqunit");

require("../../");
//require("../../src/js/coverageServer");

require("kettle");
require("gpii-webdriver");
gpii.webdriver.loadTestingSupport();

fluid.registerNamespace("gpii.tests.testem.rollup.webdriver");

// Simple function to retrieve data our "test result collector" set aside on the client side.
gpii.tests.testem.rollup.webdriver.retrieveTestResults = function () {
    return window.__testDetails;
};

gpii.tests.testem.rollup.webdriver.checkTestResults = function (results) {
    jqUnit.assertEquals("There should have been four tests run.", 4, results.total);
    jqUnit.assertEquals("All tests should have passed.", 4, results.passed);
    jqUnit.assertEquals("No tests should have failed.", 0, results.failed);
};

fluid.defaults("gpii.tests.testem.rollup.webdriver.caseHolder", {
    gradeNames: ["gpii.test.webdriver.caseHolder"],
    rawModules: [{
        name: "Testing 'safe rollup' outside of Testem...",
        tests: [
            {
                name: "Open and inspect a 'safe rollup'...",
                type: "test",
                sequence: [
                    {
                        func: "{testEnvironment}.webdriver.get",
                        args: ["{testEnvironment}.options.rollupUrl"]
                    },
                    // Give the tests half a second to run.
                    {
                        event:    "{testEnvironment}.webdriver.events.onGetComplete",
                        listener: "{testEnvironment}.webdriver.sleep",
                        args:     [1000]
                    },
                    {
                        event:    "{testEnvironment}.webdriver.events.onSleepComplete",
                        listener: "{testEnvironment}.webdriver.executeScript",
                        args:     [gpii.tests.testem.rollup.webdriver.retrieveTestResults]
                    },
                    {
                        event:    "{testEnvironment}.webdriver.events.onExecuteScriptComplete",
                        listener: "gpii.tests.testem.rollup.webdriver.checkTestResults",
                        args:     ["{arguments}.0"]
                    }
                ]
            }
        ]
    }]
});

gpii.tests.testem.rollup.webdriver.instrumentSource = function (that) {
    gpii.testem.instrumenter.instrument("%gpii-testem/src", "%gpii-testem/instrumented").then(function () {
        that.events.onSourceInstrumented.fire();
    }, fluid.fail);
};

fluid.defaults("gpii.tests.testem.rollup.webdriver.environment", {
    gradeNames: ["gpii.test.webdriver.testEnvironment.withExpress"],
    rollupUrl: {
        expander: {
            funcName: "fluid.stringTemplate",
            args:     ["http://localhost:%port/tests/rollup-fixtures/rollup.html", { port: "{that}.options.port"}]
        }
    },
    listeners: {
        "onCreate.instrumentSource": {
            funcName: "gpii.tests.testem.rollup.webdriver.instrumentSource",
            args:     ["{that}"]
        }
    },
    events: {
        onSourceInstrumented: null,
        onFixturesConstructed: {
            events: {
                onDriverReady:  "onDriverReady",
                onExpressReady: "onExpressReady",
                onSourceInstrumented: "onSourceInstrumented"
            }
        }
    },
    components: {
        caseHolder: {
            type: "gpii.tests.testem.rollup.webdriver.caseHolder"
        },
        express: {
            options: {
                components: {
                    coverage: {
                        type: "gpii.testem.coverage.router",
                        options: {
                            coveragePort: "{testEnvironment}.options.port",
                            components: {
                                client: {
                                    options: {
                                        hookTestem: false,
                                        hookQUnit: true
                                    }
                                },
                                coverageReceiver: {
                                    options: {
                                        coverageDir: "%gpii-testem/coverage"
                                    }
                                }
                            }
                        }
                    },
                    nm: {
                        type: "gpii.express.router.static",
                        options: {
                            path:    "/node_modules",
                            content: ["%gpii-testem/node_modules"]
                        }
                    },
                    tests: {
                        type: "gpii.express.router.static",
                        options: {
                            path:    "/tests",
                            content: ["%gpii-testem/tests"]
                        }
                    },
                    src: {
                        type: "gpii.express.router.static",
                        options: {
                            path:    "/src",
                            content: ["%gpii-testem/instrumented"]
                        }
                    }
                }
            }
        }
    }
});

gpii.test.webdriver.allBrowsers({ baseTestEnvironment: "gpii.tests.testem.rollup.webdriver.environment" });
