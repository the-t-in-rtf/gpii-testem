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
    that.events.onCleanupComplete.addListener(function () {
        fluid.log("Triggering Testem shutdown...");
        callback();
    });
    that.events.stopFixtures.fire();
};

/**
 *
 * A static function to resolve a range of paths in a single pass.
 *
 * @param pathsToResolve - A `String` value representing a single path, or an array of `String` values representing multiple paths.  Supports full and package-relative paths.
 * @returns {Array} - An array of resolved paths.
 */
gpii.testem.resolvePaths = function (pathsToResolve) {
    return fluid.transform(fluid.makeArray(pathsToResolve), fluid.module.resolvePath);
};

/**
 *
 * Optionally instrument the source code under test.
 *
 * @param that - The component itself.
 *
 */
gpii.testem.instrumentAsNeeded = function (that) {
    if (that.options.instrumentSource) {
        var workingDir = that.options.testemOptions.cwd || process.cwd();
        var instrumentedDir = path.resolve(workingDir, "instrumented");

        // Create our instrumentation directory if it doesn't already exist.
        mkdirp.sync(instrumentedDir);
        fluid.each(fluid.makeArray(that.options.sourceDirs), function (sourcePath) {
            var resolvedSourcePath = path.resolve(workingDir, sourcePath);

            var parsedPath = path.parse(resolvedSourcePath);

            var pathStats = fs.statSync(resolvedSourcePath);
            var lastDirSegment = pathStats.isDirectory() ? parsedPath.base : path.baseName(parsedPath.dir);

            var targetPath = path.resolve(instrumentedDir, lastDirSegment);

            // Instrument each directory to its own subdirectory using a command like:
            // istanbul instrument --output /tmp/instrumentSource/src src
            var commandSegments = ["istanbul instrument --output", targetPath, resolvedSourcePath];
            var command = commandSegments.join(" ");

            exec(command, function (error) {
                if (error) {
                    console.error("Error instrumenting code:", error);
                }
            });

            // Add a "route" so that the instrumented code will seamlessly replace its uninstrumented counterpart.
            that.generatedOptions.routes[path.join("/", lastDirSegment)] = path.join("instrumented", lastDirSegment);

            return targetPath;
        });
    }
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
 * @param callback {Function} - An optional callback to call when the cleanup is complete.
 * @returns {Promise} - A promise that will be resolved when cleanup is complete, or rejected if there is an error.
 *
 */
gpii.testem.cleanupTestemContent = function (path, callback) {
    var testemRegexp = /testem-.+/;
    var togo = fluid.promise();

    if (callback) {
        togo.then(callback, callback);
    }

    var resolvedPath = fluid.module.resolvePath(path);

    var cleanupPromises = [];
    fs.readdir(resolvedPath, function (error, testemDirs) {
        if (error) {
            togo.reject(error);
        }
        else {
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
        }
    });

    var cleanupSequence = fluid.promise.sequence(cleanupPromises);
    cleanupSequence.then(togo.resolve, togo.reject);

    return togo;
};

/**
 *
 * Once we no longer need it, remove the instrumented code generated for this run.
 *
 * @param that - The component itself.
 *
 */
gpii.testem.cleanupInstrumentedCode = function (that) {
    var workingDir = that.options.testemOptions.cwd || process.cwd();
    var instrumentedDir = path.resolve(workingDir, "instrumented");

    gpii.testem.cleanupRegularDir(instrumentedDir, "instrumented", that.events.onInstrumentedCleanupComplete.fire);
};

/**
 *
 * A static function to remove plain old directories (i.e. ones where we don't need to look for a pattern like the
 * Testem cleanup).
 *
 * @param pathToRemove {String} - A full or package-relative path to a directory that should be removed.
 * @param nickName {String} - A nickname for this directory, used in logging).
 * @param callback {Function} - An optional callback to call when our work is complete.
 *
 */
gpii.testem.cleanupRegularDir = function (pathToRemove, nickName, callback) {
    rimraf(pathToRemove, function (error) {
        if (error) {
            fluid.log("Error removing ", nickName, " source code:", error);
        }
        else {
            fluid.log("Removed ", nickName, " source code...");
        }
        if (callback) {
            callback();
        }
    });
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
    var resolvedBasePath = fluid.module.resolvePath(basePath);
    return path.resolve(resolvedBasePath, prefix + "-" + suffix);
};

/**
 *
 * Generate a coverage report if needed.
 *
 * @param that - The component itself.
 */
gpii.testem.generateCoverageReportIfNeeded = function (that) {
    if (that.options.generateCoverageReport) {
        var commandSegments = ["istanbul report --root", that.options.coverageDir, "--dir", that.options.reportsDir, "text-summary html json-summary"];
        var command = commandSegments.join(" ");

        exec(command, function (error, stdout) {
            fluid.log(stdout);
            if (error) {
                fluid.log("Error generating coverage report:", error);
            }
            else {
                fluid.log("Created coverage report in '", that.options.reportsDir, "'...");
            }

            that.events.onCoverageReportComplete.fire();
        });
    }
    else {
        that.events.onCoverageReportComplete.fire();
    }
};

fluid.defaults("gpii.testem", {
    gradeNames:  ["fluid.component"],
    coveragePort: 7000,
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
    instrumentSource: true,
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
        constructFixtures: null,
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
        onCleanup: null,
        onInstrumentedCleanupComplete: null,
        onTestemCleanupComplete: null,
        onCoverageCleanupComplete: null,
        onCleanupComplete: {
            events: {
                onInstrumentedCleanupComplete: "onInstrumentedCleanupComplete",
                onTestemCleanupComplete:       "onTestemCleanupComplete",
                onCoverageCleanupComplete:     "onCoverageCleanupComplete"
            }
        }
    },
    testemOptions: {
        framework:   "qunit",
        report_file: {
            expander: {
                funcName: "path.resolve",
                args:     ["{that}.options.reportsDir", "report.tap"]
            }
        },
        user_data_dir: {
            expander: {
                funcName: "gpii.testem.generateUniqueDirName",
                args:     [os.tmpdir(), "user_data_dir", "{that}.id"] // basePath, prefix, suffix
            }
        },
        on_start: "{that}.handleTestemStart",
        on_exit:  "{that}.handleTestemExit",
        test_page: {
            expander: {
                funcName: "gpii.testem.resolvePaths",
                args:     ["{that}.options.testPages"]
            }
        },
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
        "onCreate.instrumentSourceIfNeeded": {
            funcName: "gpii.testem.instrumentAsNeeded",
            args:     ["{that}"]
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
            args:     ["{that}"]
        },
        "onReportsComplete.log": {
            priority: "first",
            funcName: "fluid.log",
            args: ["Reports complete..."]
        },
        "onReportsComplete.cleanup": {
            func: "{that}.events.onCleanup.fire"
        },
        "onCleanup.cleanupInstrumentedCode": {
            funcName: "gpii.testem.cleanupInstrumentedCode",
            args:     ["{that}"]
        },
        "onCleanup.cleanupTestemContent": {
            funcName: "gpii.testem.cleanupTestemContent",
            args:     ["{that}.options.testemOptions.user_data_dir", "{that}.events.onTestemCleanupComplete.fire"]
        },
        "onCleanup.cleanupCoverageData": {
            priority: "after:coverageReport",
            funcName: "gpii.testem.cleanupRegularDir",
            args:     ["{that}.options.coverageDir", "coverage", "{that}.events.onCoverageCleanupComplete.fire"] // pathToRemove, nickName, callback
        },
        "onCleanupComplete.log": {
            priority: "first",
            funcName: "fluid.log",
            args:     "Cleanup complete..."
        }
    },
    distributeOptions: {
        source: "{that}.options.coverageDir",
        target: "{that gpii.testem.coverage.receiver.middleware}.options.coverageDir"
    },
    components: {
        coverageExpressInstance: {
            type: "gpii.testem.coverage.express",
            createOnEvent: "constructFixtures",
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
