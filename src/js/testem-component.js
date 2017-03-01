/*

    A Fluid component to assist in making good use of Testem. See the README for details.

 */
/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-express");

var exec    = require("child_process").exec;
var fs      = require("fs");
var mkdirp  = require("mkdirp");
var os      = require("os");
var path    = require("path");
var process = require("process");
var rimraf  = require("rimraf");

fluid.registerNamespace("gpii.testem");

/**
 *
 * Initialize all required test fixtures, instrument code, etc. before informing Testem that we are ready to proceed.
 *
 * @param that - The component itself.
 * @param config - Configuration options, provided by Testem when calling this function.
 * @param data - Data included by Testem.  See their docs for details.
 * @param callback - A callback to be called when we are ready for Testem to run the tests.
 *
 */
gpii.testem.init = function (that, config, data, callback) {
    that.events.onFixturesConstructed.addListener(function () {
        fluid.log("Fixtures constructed, triggering Testem test run...");
        callback();
    });
    that.events.constructFixtures.fire();
};

/**
 *
 * Stop all fixtures, prepare reports, and cleanup temporary content before information Testem that it is safe to shutdown.
 *
 * @param that - The component itself.
 * @param config - Configuration options, provided by Testem when calling this function.
 * @param data - Data included by Testem.  See their docs for details.
 * @param callback - A callback to be called when we are ready for Testem to shut down.
 *
 */
gpii.testem.shutdown = function (that, config, data, callback) {
    that.events.finalCleanupComplete.addListener(function () {
        fluid.log("Triggering Testem shutdown...");
        callback();
    });
    that.events.stopFixtures.fire();
};

/**
 *
 * Optionally instrument the source code under test.
 *
 * @param that - The component itself.
 * @param eventCallback - The event callback to fire when our work is complete.
 *
 */
gpii.testem.instrumentAsNeeded = function (that, eventCallback) {
    if (that.options.instrumentSource) {
        try {
            // Create our instrumentation directory if it doesn't already exist.
            mkdirp.sync(that.options.instrumentedSourceDir);
            fluid.each(fluid.makeArray(that.options.sourceDirs), function (sourcePath) {
                var resolvedSourcePath = path.resolve(that.options.testemOptions.cwd, sourcePath);
                var parsedPath = path.parse(resolvedSourcePath);

                var pathStats = fs.statSync(resolvedSourcePath);
                var lastDirSegment = pathStats.isDirectory() ? parsedPath.base : path.baseName(parsedPath.dir);

                var targetPath = path.resolve(that.options.instrumentedSourceDir, lastDirSegment);

                // Instrument each directory to its own subdirectory using a command like:
                // istanbul instrument --output /tmp/instrumentSource/src src
                var commandSegments = ["istanbul instrument --output", targetPath, resolvedSourcePath];
                var command = commandSegments.join(" ");

                exec(command, function (error) {
                    if (error) {
                        console.error("Error running instrumentation command:", error);
                    }
                });

                // Add a "route" so that the instrumented code will seamlessly replace its uninstrumented counterpart.
                that.generatedOptions.routes[path.join("/", lastDirSegment)] = path.join("instrumented", lastDirSegment);

                return targetPath;
            });
        }
        catch (error) {
            console.error("Error instrumenting code:", error);
        }
    }

    eventCallback();
};

/**
 *
 * Deliver our effective options to Testem.  We do this this way to avoid exposing options to Testem before they have
 * been completely assembled.
 *
 * @param that - The component itself.
 * @returns {Object} - The Testem options to use for this run.
 *
 */
gpii.testem.getTestemOptions = function (that) {
    return fluid.extend(that.options.testemOptions, that.generatedOptions);
};

/**
 *
 * Remove all Testem browser data from this run.
 *
 * @param path {String} - The path to the directory which contains Testem's browser data from this run.
 * @returns {Promise} - A promise that will be resolved when cleanup is complete, or rejected if there is an error.
 *
 */
gpii.testem.cleanupTestemContent = function (path) {
    var testemRegexp = /testem-.+/;
    var togo = fluid.promise();

    try {
        var resolvedPath = fluid.module.resolvePath(path);

        fs.readdir(resolvedPath, function (error, testemDirs) {
            if (error) {
                togo.reject(error);
            }
            else {
                var cleanupPromises = [];
                fluid.each(testemDirs, function (dirName) {
                    var testemDirCleanupPromise = fluid.promise();
                    cleanupPromises.push(testemDirCleanupPromise);
                    if (dirName.match(testemRegexp)) {
                        rimraf(dirName, function (error) {
                            if (error) { testemDirCleanupPromise.reject(error); }
                            else { testemDirCleanupPromise.resolve(dirName); }
                        });
                    }
                });
                var cleanupSequence = fluid.promise.sequence(cleanupPromises);
                cleanupSequence.then(togo.resolve, togo.reject);
            }
        });
    }
    catch (error) {
        togo.reject(error);
    }

    return togo;
};

/**
 *
 * A static function to remove directories.  Expects to be passed an object like:
 * {
 *  path: "/path/to/junk",
 *  name: "random junk",
 *  isTestemContent: true
 * }
 *
 * @param cleanupDef {Object} - A cleanup definition, see example above.
 * @param promise {Function} - The promise to resolve or reject when our async tasks are complete.
 *
 */
gpii.testem.cleanupDir = function (cleanupDef) {
    if (cleanupDef.isTestemContent) {
        return gpii.testem.cleanupTestemContent(cleanupDef.path);
    }
    else {
        var promise = fluid.promise();
        try {
            if (fs.existsSync(cleanupDef.path)) {
                fluid.log("No content exists for " + cleanupDef.name + ", skipping cleanup...");
                promise.resolve();
            }
            else {
                rimraf(cleanupDef.path, function (error) {
                    if (error) {
                        fluid.log("Error removing ", cleanupDef.name, " content:", error);
                        promise.reject(error);
                    }
                    else {
                        promise.resolve();
                        fluid.log("Removed ", cleanupDef.name, " content...");
                    }
                });
            }
        }
        catch (error) {
            promise.reject(error);
        }
        return promise;
    }
};

/**
 *
 * Clean up a bunch of directories based on test definitions that look like:
 *
 * {
 *  path: "/path/to/junk",
 *  name: "random junk",
 *  isTestemContent: true
 * }
 *
 * @param cleanupDefs  An array of cleanup definitions (see example above).
 * @param eventCallback The event to fire when cleanup is complete.
 *
 */
gpii.testem.cleanup = function (cleanupDefs, eventCallback) {
    var cleanupPromises = [];
    fluid.each(cleanupDefs, function (singleDirEntry) {
        var cleanupPromise = gpii.testem.cleanupDir(singleDirEntry);
        cleanupPromises.push(cleanupPromise);
    });

    var sequence = fluid.promise.sequence(cleanupPromises);

    // Because of the high cost of failing to call Testem callbacks, we choose to continue even if there are errors.
    sequence.then(eventCallback, eventCallback);
};

/**
 *
 * Generate a unique subdirectory path based on a supplied prefix and suffix.
 *
 * @param basePath {String} - A full or package-relative path to the subdirectory in which the new directory will live.
 * @param prefix {String} - A "prefix" that will be prepended to the filename.
 * @param suffix {String} - A "suffix" that will be appended to the end of the filename.
 * @returns {String} - The full path to the unique subdirectory.
 */
gpii.testem.generateUniqueDirName = function (basePath, prefix, suffix) {
    try {
        var resolvedBasePath = fluid.module.resolvePath(basePath);
        return path.resolve(resolvedBasePath, prefix + "-" + suffix);
    }
    catch (error) {
        console.log("Error generating unique dir name:", error);
    }
};

/**
 *
 * Generate a coverage report if needed.
 *
 * @param that - The component itself.
 */
gpii.testem.generateCoverageReportIfNeeded = function (that, eventCallback) {
    if (that.options.generateCoverageReport) {
        var promise = fluid.promise();
        promise.then(eventCallback, eventCallback);

        try {
            var commandSegments = ["istanbul report --root", that.options.coverageDir, "--dir", that.options.reportsDir, "text-summary html json-summary"];
            var command = commandSegments.join(" ");

            exec(command, function (error, stdout) {
                fluid.log(stdout);
                if (error) {
                    fluid.log("Error generating coverage report:", error);
                    promise.reject(error);
                }
                else {
                    fluid.log("Created coverage report in '", that.options.reportsDir, "'...");
                    promise.resolve();
                }
            });
        }
        catch (error) {
            promise.reject(error);
        }
    }
    else {
        eventCallback();
    }
};

fluid.registerNamespace("gpii.testem.dirs");

// A convenience variable to assist in cleaning up everything but the coverage data.
gpii.testem.dirs.everythingButCoverage = [
    {
        name: "instrumented",
        path: "{that}.options.instrumentedSourceDir"
    },
    {
        name:            "testem",
        path:            "{that}.options.testemDir",
        isTestemContent: true
    }

];

// A convenience variable to assist in cleaning up everything, including coverage data.
gpii.testem.dirs.everything = gpii.testem.dirs.everythingButCoverage.concat([
    {
        name: "coverage",
        path: "{that}.options.coverageDir"
    }
]);

// If we call path.resolve directly from an expansion definition, we can't cleanly handle errors.  So, we use this
// convenience function.  It's important to trap errors which might prevent Testem callbacks from being triggered.
gpii.testem.resolveSafely = function (pathToResolve, filename) {
    try {
        return path.resolve(pathToResolve, filename);
    }
    catch (error) {
        console.error(error);
    }
};

fluid.defaults("gpii.testem", {
    gradeNames:  ["fluid.component"],
    coveragePort: 7000,
    mergePolicy: {
        cleanup: "nomerge"
    },
    cleanup: {
        initial:  gpii.testem.dirs.everything,
        final:    gpii.testem.dirs.everything
    },
    coverageUrl: {
        expander: {
            funcName: "fluid.stringTemplate",
            args:     ["http://localhost:%port", { port: "{that}.options.coveragePort" }]
        }
    },
    coverageDir: {
        expander: {
            funcName: "gpii.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "coverage", "{that}.id"] // basePath, prefix, suffix
        }
    },
    reportsDir: {
        expander: {
            funcName: "gpii.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "reports", "{that}.id"] // basePath, prefix, suffix
        }
    },
    testemDir: {
        expander: {
            funcName: "gpii.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "user_data_dir", "{that}.id"] // basePath, prefix, suffix
        }
    },
    instrumentSource: true,
    // Code to be served must live under the cwd in order to work with Testem.
    instrumentedSourceDir: {
        expander: {
            funcName: "gpii.testem.resolveSafely",
            args:     ["{that}.options.testemOptions.cwd", "instrumented"]
        }
    },
    generateCoverageReport: true,
    sourceDirs: [],
    testPages:   [],
    serveDirs:  [],
    members: {
        generatedOptions: {
            routes: {}
        }
    },
    events: {
        initialCleanupComplete: null,
        constructFixtures: null,
        sourceInstrumented: null,
        safeToConstructFixtures: {
            events: {
                initialCleanupComplete: "initialCleanupComplete",
                constructFixtures:      "constructFixtures",
                sourceInstrumented:     "sourceInstrumented"
            }
        },
        onExpressStarted: null,
        onFixturesConstructed: {
            events: {
                onExpressStarted: "onExpressStarted"
            }
        },
        stopFixtures: null,
        onExpressStopped: null,
        onFixturesStopped: {
            events: {
                onExpressStopped: "onExpressStopped"
            }
        },
        createReports: null,
        onCoverageReportComplete: null,
        onReportsComplete: {
            events: {
                onCoverageReportComplete: "onCoverageReportComplete"
            }
        },
        finalCleanup: null,
        finalCleanupComplete: null
    },
    testemOptions: {
        framework:   "qunit",
        report_file: {
            expander: {
                funcName: "gpii.testem.resolveSafely",
                args:     ["{that}.options.reportsDir", "report.tap"]
            }
        },
        cwd: process.cwd(),
        user_data_dir: "{that}.options.testemDir",
        on_start: "{that}.handleTestemStart",
        on_exit:  "{that}.handleTestemExit",
        test_page: "{that}.options.testPages",
        proxies: {
            "/coverage": {
                "target": "{that}.options.coverageUrl"
            }
        }
    },
    invokers: {
        "handleTestemStart": {
            funcName: "gpii.testem.init",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // config, data, callback
        },
        "handleTestemExit": {
            funcName: "gpii.testem.shutdown",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // config, data, callback
        },
        "getTestemOptions": {
            funcName: "gpii.testem.getTestemOptions",
            args:     ["{that}"]
        }
    },
    listeners: {
        "onCreate.cleanup": {
            funcName: "gpii.testem.cleanup",
            args:     ["{that}.options.cleanup.initial", "{that}.events.initialCleanupComplete.fire"] // cleanupDefs, eventCallback
        },
        "initialCleanupComplete.log": {
            priority: "first",
            funcName: "fluid.log",
            args:     "Initial cleanup complete..."
        },
        "initialCleanupComplete.instrumentSourceIfNeeded": {
            funcName: "gpii.testem.instrumentAsNeeded",
            args:     ["{that}", "{that}.events.sourceInstrumented.fire"] // eventCallback
        },
        // Disable default behavior to avoid double-stop.
        "onDestroy.stopServer": {
            funcName: "fluid.identity"
        },
        "stopFixtures.stopExpress": {
            funcName: "gpii.express.stopServer",
            args:     ["{that}.coverageExpressInstance"]
        },
        "onFixturesConstructed.log": {
            priority: "first",
            funcName: "fluid.log",
            args: ["Fixtures constructed..."]
        },
        "onFixturesStopped.log": {
            priority: "first",
            funcName: "fluid.log",
            args: ["Fixtures stopped..."]
        },
        "onFixturesStopped.createReports": {
            func: "{that}.events.createReports.fire"
        },
        "createReports.coverageReport": {
            funcName: "gpii.testem.generateCoverageReportIfNeeded",
            args:     ["{that}", "{that}.events.onCoverageReportComplete.fire"] // eventCallback
        },
        "onReportsComplete.log": {
            priority: "first",
            funcName: "fluid.log",
            args: ["Reports complete..."]
        },
        "onReportsComplete.finalCleanup": {
            func: "{that}.events.finalCleanup.fire"
        },
        "finalCleanup.cleanup": {
            funcName: "gpii.testem.cleanup",
            args:     ["{that}.options.cleanup.final", "{that}.events.finalCleanupComplete.fire"] // cleanupDefs, eventCallback
        },
        "finalCleanupComplete.log": {
            priority: "first",
            funcName: "fluid.log",
            args:     "Final cleanup complete..."
        }
    },
    distributeOptions: {
        source: "{that}.options.coverageDir",
        target: "{that gpii.testem.coverage.receiver.middleware}.options.coverageDir"
    },
    components: {
        coverageExpressInstance: {
            type: "gpii.testem.coverage.express",
            createOnEvent: "safeToConstructFixtures",
            options: {
                port: "{gpii.testem}.options.coveragePort",
                listeners: {
                    "onStarted.notifyParent": {
                        func: "{gpii.testem}.events.onExpressStarted.fire"
                    },
                    "onStopped.notifyParent": {
                        func: "{gpii.testem}.events.onExpressStopped.fire"
                    }
                }

            }
        }
    }
});

fluid.defaults("gpii.testem.coverageDataOnly", {
    gradeNames: ["gpii.testem"],
    generateCoverageReport: false,
    cleanup: {
        initial:  gpii.testem.dirs.everythingButCoverage,
        final:    gpii.testem.dirs.everythingButCoverage
    }
});
