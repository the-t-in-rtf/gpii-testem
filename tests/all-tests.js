/* eslint-env node */
"use strict";
var fluid  = require("infusion");
var gpii   = fluid.registerNamespace("gpii");

var jqUnit = require("node-jqunit");

var exec   = require("child_process").exec;
var path   = require("path");
var fs     = require("fs");

fluid.registerNamespace("gpii.tests.testem.runner");

gpii.tests.testem.runner.runAllTests = function (that) {
    jqUnit.module("Testing coverage detection and reporting...");
    fluid.each(that.options.tests, gpii.tests.testem.runner.runSingleTest);
};

gpii.tests.testem.runner.runSingleTest = function (testDef) {
    jqUnit.test(testDef.name, function () {
        jqUnit.stop();
        exec(testDef.command, {cwd: __dirname }, function (error, stdout) {
            jqUnit.start();
            if (testDef.hasTestemErrors) {
                jqUnit.assertNotUndefined("There should be an error running testem...", error);
            }
            else {
                jqUnit.assertFalse("There should be no errors running testem...", error);
            }

            var matches = stdout.match(/= START TESTEM COMPONENT OPTIONS =\n([^]+)= END TESTEM COMPONENT OPTIONS =\n/);
            jqUnit.assertTrue("There should be component options in the output...", matches && matches[1]);
            if (matches) {
                var testemOptions = JSON.parse(matches[1]);

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
        });
    });
};

fluid.defaults("gpii.tests.testem.runner", {
    gradeNames: ["fluid.component"],
    tests: {
        complete: {
            name: "Running a suite of tests that results in complete coverage...",
            command: "node ../node_modules/testem/testem.js ci --file testem-fixtures/testem-complete-coverage.js",
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
            command: "node ../node_modules/testem/testem.js ci --file testem-fixtures/testem-incomplete-coverage.js",
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
            command:     "node ../node_modules/testem/testem.js ci --file testem-fixtures/testem-no-coverage.js",
            hasCoverage: false
        },
        failure: {
            name:            "Running a suite of tests with gross configuration errors...",
            command:         "node ../node_modules/testem/testem.js ci --file testem-fixtures/testem-failure-modes.js",
            hasCoverage:     false,
            hasTestemErrors: true
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
