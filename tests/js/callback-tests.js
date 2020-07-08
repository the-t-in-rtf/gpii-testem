/* eslint-env node */
"use strict";
var fluid = require("infusion");

var jqUnit = require("node-jqunit");

var os   = require("os");
var fs   = require("fs");
var path = require("path");

require("../../");

require("kettle");
require("fluid-webdriver");
fluid.webdriver.loadTestingSupport();

fluid.registerNamespace("fluid.tests.testem.callback");

// Simple function to retrieve data our "test result collector" set aside on the client side.
fluid.tests.testem.callback.fireCallback = function () {
    window.fluid.testem.coverage.afterTestsCallback();
};

fluid.tests.testem.callback.checkTestResults = function (that) {
    var coverageFiles = fs.readdirSync(that.options.coverageDir);
    jqUnit.assertTrue("There should be coverage data.", coverageFiles && coverageFiles.length > 0);
    fluid.each(coverageFiles, function (filename) {
        var fullPath = path.resolve(that.options.coverageDir, filename);
        var stats = fs.statSync(fullPath);
        jqUnit.assertTrue("Coverage files should not be empty.", stats.size > 0);
        try {
            require(fullPath);
            jqUnit.assert("Coverage files should be valid JSON.");
        }
        catch (error) {
            jqUnit.fail(error);
        }
    });

};

fluid.tests.testem.callback.cleanup = function (that) {
    var promises = [];

    fluid.each(["coverageDir", "instrumentedSourceDir"], function (dirToClean) {
        var pathToClean = fluid.get(that, ["options", dirToClean]);
        promises.push(fluid.testem.cleanupDir({ path: pathToClean }, {}));
    });

    var sequence = fluid.promise.sequence(promises);
    sequence.then(
        function () { fluid.log("Finished cleanup."); },
        fluid.fail
    );
};

fluid.defaults("fluid.tests.testem.callback.caseHolder", {
    gradeNames: ["fluid.test.webdriver.caseHolder"],
    rawModules: [{
        name: "Testing direct use of coverage client callback...",
        tests: [
            {
                name: "Attempt to collect coverage data by directly calling the coverage client callback...",
                type: "test",
                sequence: [
                    {
                        func: "{testEnvironment}.webdriver.get",
                        args: ["{testEnvironment}.options.url"]
                    },
                    // Give the tests time to run.
                    {
                        event:    "{testEnvironment}.webdriver.events.onGetComplete",
                        listener: "{testEnvironment}.webdriver.sleep",
                        args:     [250]
                    },
                    {
                        event:    "{testEnvironment}.webdriver.events.onSleepComplete",
                        listener: "{testEnvironment}.webdriver.executeScript",
                        args:     [fluid.tests.testem.callback.fireCallback]
                    },
                    // Give the data time to be transmitted.
                    {
                        func: "{testEnvironment}.webdriver.sleep",
                        args: [250]
                    },
                    {
                        event:    "{testEnvironment}.webdriver.events.onSleepComplete",
                        listener: "fluid.tests.testem.callback.checkTestResults",
                        args:     ["{testEnvironment}"]
                    }
                ]
            }
        ]
    }]
});

fluid.tests.testem.callback.generateUniqueTmpDir = function (that, prefix) {
    return path.resolve(os.tmpdir(), prefix + "-" + that.id);
};

fluid.tests.testem.callback.instrumentSource = function (that) {
    fluid.testem.instrumenter.instrument("%fluid-testem/tests/callback-fixtures/src", that.options.instrumentedSourceDir).then(function () {
        that.events.onSourceInstrumented.fire();
    }, fluid.fail);
};

fluid.defaults("fluid.tests.testem.callback.environment", {
    gradeNames: ["fluid.test.webdriver.testEnvironment.withExpress"],
    coveragePrefix: "coverage",
    coverageDir: "@expand:fluid.tests.testem.callback.generateUniqueTmpDir({that}, {that}.options.coveragePrefix)",
    instrumentedPrefix: "instrumented",
    instrumentedSourceDir: "@expand:fluid.tests.testem.callback.generateUniqueTmpDir({that}, {that}.options.instrumentedPrefix)",
    url: {
        expander: {
            funcName: "fluid.stringTemplate",
            args:     ["http://localhost:%port/tests/callback-fixtures/index.html", { port: "{that}.options.port"}]
        }
    },
    listeners: {
        "onCreate.instrumentSource": {
            funcName: "fluid.tests.testem.callback.instrumentSource",
            args:     ["{that}"]
        },
        "onDestroy.cleanup": {
            funcName: "fluid.tests.testem.callback.cleanup",
            args: ["{that}"]
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
            type: "fluid.tests.testem.callback.caseHolder"
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
                                        hookTestem:     false,
                                        hookQUnit:      false,
                                        exposeCallback: true
                                    }
                                },
                                coverageReceiver: {
                                    options: {
                                        coverageDir: "{fluid.tests.testem.callback.environment}.options.coverageDir"
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
                            content: ["{fluid.tests.testem.callback.environment}.options.instrumentedSourceDir"]
                        }
                    }
                }
            }
        }
    }
});

fluid.test.webdriver.allBrowsers({ baseTestEnvironment: "fluid.tests.testem.callback.environment" });
