/* eslint-env node */
"use strict";
var fluid = require("infusion");
var jqUnit = require("node-jqunit");

require("../../");
//require("../../src/js/coverageServer");

require("kettle");
require("fluid-webdriver");
fluid.webdriver.loadTestingSupport();

fluid.registerNamespace("fluid.tests.testem.rollup.webdriver");

// Simple function to retrieve data our "test result collector" set aside on the client side.
fluid.tests.testem.rollup.webdriver.retrieveTestResults = function () {
    return window.__testDetails;
};

fluid.tests.testem.rollup.webdriver.checkTestResults = function (results) {
    jqUnit.assertEquals("There should have been four tests run.", 4, results.total);
    jqUnit.assertEquals("All tests should have passed.", 4, results.passed);
    jqUnit.assertEquals("No tests should have failed.", 0, results.failed);
};

fluid.defaults("fluid.tests.testem.rollup.webdriver.caseHolder", {
    gradeNames: ["fluid.test.webdriver.caseHolder"],
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
                        args:     [fluid.tests.testem.rollup.webdriver.retrieveTestResults]
                    },
                    {
                        event:    "{testEnvironment}.webdriver.events.onExecuteScriptComplete",
                        listener: "fluid.tests.testem.rollup.webdriver.checkTestResults",
                        args:     ["{arguments}.0"]
                    }
                ]
            }
        ]
    }]
});

fluid.tests.testem.rollup.webdriver.instrumentSource = function (that) {
    fluid.testem.instrumenter.instrument("%fluid-testem/src", "%fluid-testem/instrumented").then(function () {
        that.events.onSourceInstrumented.fire();
    }, fluid.fail);
};

fluid.defaults("fluid.tests.testem.rollup.webdriver.environment", {
    gradeNames: ["fluid.test.webdriver.testEnvironment.withExpress"],
    rollupUrl: {
        expander: {
            funcName: "fluid.stringTemplate",
            args:     ["http://localhost:%port/tests/rollup-fixtures/rollup.html", { port: "{that}.options.port"}]
        }
    },
    listeners: {
        "onCreate.instrumentSource": {
            funcName: "fluid.tests.testem.rollup.webdriver.instrumentSource",
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
            type: "fluid.tests.testem.rollup.webdriver.caseHolder"
        },
        express: {
            options: {
                components: {
                    coverage: {
                        type: "fluid.testem.coverage.router",
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
                                        coverageDir: "%fluid-testem/coverage"
                                    }
                                }
                            }
                        }
                    },
                    nm: {
                        type: "fluid.express.router.static",
                        options: {
                            path:    "/node_modules",
                            content: ["%fluid-testem/node_modules"]
                        }
                    },
                    tests: {
                        type: "fluid.express.router.static",
                        options: {
                            path:    "/tests",
                            content: ["%fluid-testem/tests"]
                        }
                    },
                    src: {
                        type: "fluid.express.router.static",
                        options: {
                            path:    "/src",
                            content: ["%fluid-testem/instrumented"]
                        }
                    }
                }
            }
        }
    }
});

fluid.test.webdriver.allBrowsers({ baseTestEnvironment: "fluid.tests.testem.rollup.webdriver.environment" });
