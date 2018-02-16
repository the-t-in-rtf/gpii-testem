/*

    Tests to confirm that the launcher we use to wrap the instrumenter is functioning as expected.

 */
/*

    Tests for the static "instrumenter" function.

 */
/* eslint-env node */
"use strict";
var fluid         = require("infusion");
var gpii          = fluid.registerNamespace("gpii");
var jqUnit        = require("node-jqunit");
var fs            = require("fs");
var path          = require("path");
var os            = require("os");
var rimraf        = require("rimraf");
var child_process = require("child_process");

require("../../");
require("./instrumenter-testDefs");
require("./lib/isInstrumented");

fluid.registerNamespace("gpii.tests.testem.instrumenterLauncher");

gpii.tests.testem.instrumenterLauncher.generateArgs = function (testDef) {
    var argSegments = [];
    fluid.each(["inputPath", "outputPath"], function (propertyKey) {
        argSegments.push("--" + propertyKey + " \"" + fluid.module.resolvePath(testDef[propertyKey]) + "\"");
    });

    // This will only work for array values like "includes", "excludes", "sources", and "nonSources", but that's all we have at.
    fluid.each(testDef.instrumentationOptions, function (value, propertyKey) {
        var arrayValues = fluid.makeArray(value);
        if (arrayValues.length) {
            fluid.each(arrayValues, function (singleArrayItem) {
                // These MUST be double quotes: https://github.com/yargs/yargs/issues/743
                argSegments.push("--" + propertyKey +  " \"" + singleArrayItem + "\"");
            });
        }
        else {
            argSegments.push("--" + propertyKey +  " \"[]\"");
        }
    });

    return argSegments.join(" ");
};

gpii.tests.testem.instrumenterLauncher.runAllTests = function (that) {
    jqUnit.module(that.options.moduleName);
    fluid.each(that.options.testDefs, function (testDef) {
        if (!testDef.disableInLauncher) {
            gpii.tests.testem.instrumenterLauncher.runSingleTest(that, testDef);
        }
    });
    rimraf.sync(that.options.baseOutputDir);
    fluid.log("Removed temporary output.");
};

gpii.tests.testem.instrumenterLauncher.runSingleTest = function (that, testDef) {
    jqUnit.test(testDef.name, function () {
        jqUnit.stop();

        var commandOptions = {
            launcherPath: fluid.module.resolvePath(that.options.launcherPath),
            args: gpii.tests.testem.instrumenterLauncher.generateArgs(testDef)
        };

        // Run the command with the specified arguments and environment variables.  Generate a coverage report for this run, which we will collate later.
        var command = fluid.stringTemplate("node %launcherPath %args", commandOptions);
        child_process.exec(command, {}, function (error) {
            if (error) {
                jqUnit.start();
                jqUnit.fail(error);
            }
            else {
                jqUnit.start();
                jqUnit.assert("The instrumentation run should have completed successfully.");

                fluid.each(testDef.shouldExist, function (relativeFilePath) {
                    var fileThatShouldExist = path.resolve(testDef.outputPath, relativeFilePath);
                    jqUnit.assertTrue("File '" + relativeFilePath + "' should exist.", fs.existsSync(fileThatShouldExist));

                    var fileStats = fs.statSync(fileThatShouldExist);
                    if (fileStats.isFile()) {
                        jqUnit.assertTrue("File '" + relativeFilePath + "' should not be empty.", fileStats.size > 0);
                    }
                });

                fluid.each(testDef.shouldNotExist, function (relativeFilePath) {
                    var fileThatShouldNotExist = path.resolve(testDef.outputPath, relativeFilePath);
                    jqUnit.assertFalse("File '" + relativeFilePath + "' should not exist.", fs.existsSync(fileThatShouldNotExist));
                });

                fluid.each(testDef.shouldBeInstrumented, function (relativeFilePath) {
                    var fileThatShouldBeInstrumented = path.resolve(testDef.outputPath, relativeFilePath);
                    jqUnit.assertTrue("File '" + relativeFilePath + "' should be instrumented.", gpii.test.testem.isInstrumented(fileThatShouldBeInstrumented));
                });

                fluid.each(testDef.shouldNotBeInstrumented, function (relativeFilePath) {
                    var fileThatShouldNotBeInstrumented = path.resolve(testDef.outputPath, relativeFilePath);
                    jqUnit.assertFalse("File '" + relativeFilePath + "' should not be instrumented.", gpii.test.testem.isInstrumented(fileThatShouldNotBeInstrumented));
                });
            }
        });
    });
};

fluid.defaults("gpii.tests.testem.instrumenterLauncher.runner", {
    gradeNames: ["fluid.component"],
    launcherPath: "%gpii-testem/src/js/instrumenter-launcher.js",
    moduleName: "Test the instrumentation functions in combination with the launcher.",
    baseOutputDir: {
        expander: {
            funcName: "gpii.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "instrumenter-tests", "{that}.id"] // basePath, prefix, suffix
        }
    },
    testDefs: gpii.tests.testem.instrumenter.testDefs,
    listeners: {
        "onCreate.runTests": {
            funcName: "gpii.tests.testem.instrumenterLauncher.runAllTests",
            args:     ["{that}"]
        }
    }
});

gpii.tests.testem.instrumenterLauncher.runner();
