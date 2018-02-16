/* eslint-env node */
"use strict";
var fluid  = require("infusion");
var gpii   = fluid.registerNamespace("gpii");

var jqUnit = require("node-jqunit");

var exec   = require("child_process").exec;
var path   = require("path");
var fs     = require("fs");
var rimraf = require("rimraf");

fluid.registerNamespace("gpii.tests.testem.runner");

gpii.tests.testem.runner.runAllTests = function (that) {
    jqUnit.module("Testing coverage detection and reporting...");
    fluid.each(that.options.tests, function (testDef) {
        gpii.tests.testem.runner.runSingleTest(that, testDef);
    });
};

gpii.tests.testem.runner.runSingleTest = function (that, testDef) {
    jqUnit.test(testDef.name, function () {
        jqUnit.stop();
        var command = fluid.stringTemplate(that.options.commandTemplate, testDef);
        exec(command, {cwd: __dirname }, function (error, stdout, stderr) {
            jqUnit.start();
            if (testDef.expectedErrors) {
                fluid.each(fluid.makeArray(testDef.expectedErrors), function (expectedError) {
                    jqUnit.assertTrue("The console should contain the error '" + expectedError + "'...", stderr.indexOf(expectedError) !== -1);
                });
            }
            else if (error) {
                fluid.log("TESTEM ERROR:", error);
                jqUnit.fail("There should be no errors running testem...");
            }

            var matches = stdout.match(/= START TESTEM COMPONENT OPTIONS =\n([^]+)= END TESTEM COMPONENT OPTIONS =\n/);
            jqUnit.assertTrue("There should be component options in the output...", matches && matches[1]);
            if (matches) {
                var testemOptions = JSON.parse(matches[1]);

                if (!testDef.expectedErrors) {
                    var tapReportPath = path.resolve(testemOptions.reportsDir, "report.tap");
                    jqUnit.assertTrue("There should be a TAP report...", fs.existsSync(tapReportPath));

                    var htmlCoveragePath = path.resolve(testemOptions.reportsDir, "index.html");
                    var coverageSummaryPath = path.resolve(testemOptions.reportsDir, "coverage-summary.json");

                    if (testDef.hasCoverage) {
                        jqUnit.assertTrue("There should be an HTML coverage report...", fs.existsSync(htmlCoveragePath));
                        jqUnit.assertTrue("There should be a JSON coverage summary...", fs.existsSync(coverageSummaryPath));

                        var coverageSummary = require(coverageSummaryPath);
                        // We have to force the deep comparison to be limited to one branch of the overall tree.
                        jqUnit.assertLeftHand("The coverage should be as expected...", testDef.expectedCoverage.total, coverageSummary.total);
                    }
                    else {
                        jqUnit.assertFalse("There should not be an HTML coverage report...", fs.existsSync(htmlCoveragePath));
                        jqUnit.assertFalse("There should not be a JSON coverage summary...", fs.existsSync(coverageSummaryPath));
                    }
                }

                // Now that we have inspected the output, clean it up.
                jqUnit.stop();

                var cleanupPromises = [];

                fluid.each([testemOptions.reportsDir, testemOptions.coverageDir], function (dirToRemove) {
                    // Needed to avoid problems with "failure" tests.
                    if (dirToRemove) {
                        cleanupPromises.push(function () {
                            var promise = fluid.promise();
                            fluid.log("Removing dir '", dirToRemove, "'...");
                            rimraf(dirToRemove, function (error) {
                                error ? promise.reject(error) : promise.resolve();
                            });
                            return promise;
                        });
                    }
                });

                var sequence = fluid.promise.sequence(cleanupPromises);
                sequence.then(
                    function () {
                        fluid.log("Removed reports and coverage from this test run...");
                        jqUnit.start();
                    },
                    function (error) {
                        fluid.log("Unable to remove reports and/or coverage from this test run:", error);
                        jqUnit.start();
                    }
                );
            }
            else {
                jqUnit.fail("There should have been testem options in the console logs...");
            }
        });
    });
};

fluid.defaults("gpii.tests.testem.runner", {
    gradeNames: ["fluid.component"],
    commandTemplate: "node ../../node_modules/testem/testem.js ci --file %configFile",
    tests: {
        complete: {
            name: "Running a suite of tests that results in complete coverage...",
            configFile: "../testem-fixtures/coverage-fixtures/testem-complete-coverage.js",
            hasCoverage: true,
            expectedCoverage: {
                total: {
                    branches: {
                        total: 2,
                        covered: 2,
                        skipped: 0,
                        pct: 100
                    }
                }
            }
        },
        incomplete: {
            name: "Running a suite of tests that results in incomplete coverage...",
            configFile: "../testem-fixtures/coverage-fixtures/testem-incomplete-coverage.js",
            hasCoverage: true,
            expectedCoverage: {
                total: {
                    branches: {
                        total: 2,
                        covered: 1,
                        skipped: 0,
                        pct: 50
                    }
                }
            }
        },
        noCoverage: {
            name:        "Running a suite of tests without test coverage...",
            configFile:  "../testem-fixtures/coverage-fixtures/testem-no-coverage.js",
            hasCoverage: false
        },
        instrumentationTiming: {
            name:       "Confirm that long-running instrumentation does not interfere with coverage collection...",
            configFile: "../testem-fixtures/coverage-fixtures/testem-instrumentation-timing.js",
            hasCoverage: true,
            expectedCoverage: {
                total: {
                    branches: {
                        total: 2,
                        covered: 2,
                        skipped: 0,
                        pct: 100
                    }
                }
            }
        },
        failure: {
            name:          "Running a suite of tests with gross configuration errors...",
            configFile:    "../testem-fixtures/failure-modes/testem-failure-modes.js",
            hasCoverage:   false,
            expectedErrors: [
                "TypeError: Path must be a string. Received null"
            ]
        }
    },
    listeners: {
        "onCreate.runAllTests": {
            funcName: "gpii.tests.testem.runner.runAllTests",
            args:     ["{that}"]
        }
    }
});
gpii.tests.testem.runner();
