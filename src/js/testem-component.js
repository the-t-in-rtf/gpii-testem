/*

    A Fluid component to assist in making good use of Testem. See the README for details.

 */
/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-express");

var fs      = require("fs");
var mkdirp  = require("mkdirp");
var os      = require("os");
var path    = require("path");
var process = require("process");
var rimraf  = require("rimraf");
var url     = require("url");
var cli     = require("istanbul/lib/cli.js");

require("./coverageServer");

fluid.registerNamespace("gpii.testem");

/**
 *
 * Fire a pseudo-event, ensuring that a Testem callback is always called regardless of the result.
 *
 * @param componentEvent - The component event to be fired using `fluid.promise.fireTransformEvent`.
 * @param testemCallback - A function that will be called when we are ready for Testem to run the tests.
 *
 */
gpii.testem.handleTestemLifecycleEvent = function (componentEvent, testemCallback) {
    var eventTransformChain = fluid.promise.fireTransformEvent(componentEvent);
    eventTransformChain.then(function () { testemCallback();} , testemCallback);
};

/**
 *
 * A function to wrap a secondary component event so that we can represent the entire startup and shutdown as two chains.
 *
 * @param that - The component itself.
 * @param event - The event to listen to.
 * @returns {Promise} - A promise that will be resolved the next time `event` is fired.
 */
gpii.testem.wrapSecondaryEvent = function (that, event) {
    var eventPromise = gpii.testem.generateSingleUseEventListener(that, event);
    gpii.testem.addPromiseTimeout(eventPromise, "Timed out while waiting for event '" + event.name + "' to fire...", that.options.wrappedEventTimeout);
    return eventPromise;
};

/**
 *
 * Listen for an event once, resolve a promise, and then stop listening.  Also stops listening if the returned promise
 * is resolved/reject externally (for example, by the timeout wrapper.
 *
 * Only works with Fluid Promises, see: http://docs.fluidproject.org/infusion/development/PromisesAPI.html
 *
 * @param that - The component itself.
 * @param event - The event to wrap with a promise.
 * @return {*}
 */
gpii.testem.generateSingleUseEventListener = function (that, event) {
    var eventPromise = fluid.promise();

    // Ensure that the listener is removed whether we resolve the promise, or whether someone else does.
    var listenerNamespace = "gpii.testem.singleUse." + that.id;
    var removeListener = function () { event.removeListener(listenerNamespace); };
    eventPromise.then(removeListener, removeListener);
    event.addListener(function () {
        eventPromise.resolve(fluid.makeArray(arguments));
    }, listenerNamespace);

    return eventPromise;
};

/**
 *
 * Resolve a promise after a given amount of milliseconds.  Used in this package to ensure that the overall promise
 * chain eventually completes, so that Testem's callbacks can be called.
 *
 * Only works with Fluid Promises, see: http://docs.fluidproject.org/infusion/development/PromisesAPI.html
 *
 * @param originalPromise {Promise} The original promise to wrap in a timeout.
 * @param rejectionPayload {Object} The payload to use when rejecting the message.
 * @param timeoutInMillis {Number} The number of milliseconds to wait before timing out.
 * @returns originalPromise {Object} The original promise.
 */
gpii.testem.addPromiseTimeout = function (originalPromise, rejectionPayload, timeoutInMillis) {
    // Hold onto a handle so that we can clear the timeout if needed.
    var timeoutID = setTimeout(function () {
        fluid.log(rejectionPayload);
        originalPromise.resolve();
    }, timeoutInMillis);

    // Clear the timeout if the original promise is resolved or rejected externally.
    var clearPromiseTimeout = function () { clearTimeout(timeoutID); };
    originalPromise.then(clearPromiseTimeout, clearPromiseTimeout);

    return originalPromise;
};

/**
 *
 * Optionally instrument the source code under test.
 *
 * @param that - The component itself.
 * @returns {Promise} - A promise that will be resolved or rejected when the instrumentation pass finishes.
 */
gpii.testem.instrumentAsNeeded = function (that) {
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

                var commandSegments = ["instrument", "--output", targetPath, resolvedSourcePath, "--complete-copy"];
                cli.runToCompletion(commandSegments);
            });
            fluid.log("Finished instrumentation...");
        }
        catch (error) {
            console.error("Error instrumenting code:", error);
        }
    }
};

gpii.testem.generateInstrumentationRoutes = function (that) {
    var routes = {};
    if (that.options.instrumentSource) {
        fluid.each(fluid.makeArray(that.options.sourceDirs), function (sourcePath) {
            var resolvedSourcePath = path.resolve(that.options.testemOptions.cwd, sourcePath);
            var parsedPath = path.parse(resolvedSourcePath);

            var pathStats = fs.statSync(resolvedSourcePath);
            var lastDirSegment = pathStats.isDirectory() ? parsedPath.base : path.baseName(parsedPath.dir);

            var originalSourcePath = url.resolve("/", lastDirSegment);
            var instrumentedSourcePath = url.resolve("instrumented/", lastDirSegment);
            routes[originalSourcePath] = instrumentedSourcePath;
        });
    }
    return routes;
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

gpii.testem.generateRimrafWrapper = function (path) {
    return function () {
        var rimrafPromise = fluid.promise();
        rimraf(path, function (rimrafError) {
            if (rimrafError) {
                rimrafPromise.reject(rimrafError);
            }
            else {
                rimrafPromise.resolve();
            }
        });
        return rimrafPromise;
    };
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

    if (path) {

        var togo = fluid.promise();

        togo.then(function () { fluid.log("Removed Testem content..."); });
        try {
            var resolvedPath = fluid.module.resolvePath(path);

            if (fs.existsSync(resolvedPath)) {
                fs.readdir(resolvedPath, function (testemError, testemDirs) {
                    if (testemError) {
                        togo.reject(testemError);
                    }
                    else {
                        var cleanupPromises = [];
                        fluid.each(testemDirs, function (dirName) {
                            if (dirName.match(testemRegexp)) {
                                cleanupPromises.push(gpii.testem.generateRimrafWrapper(dirName));
                            }
                        });

                        // Remove the enclosing directory as well...
                        cleanupPromises.push(gpii.testem.generateRimrafWrapper(resolvedPath));

                        var cleanupSequence = fluid.promise.sequence(cleanupPromises);
                        cleanupSequence.then(togo.resolve, togo.reject);
                    }
                });
            }
            else {
                fluid.log("No testem content found, skipping cleanup...");
                togo.resolve();
            }

        }
        catch (exception) {
            togo.reject(exception);
        }

        return togo;
    }
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
 * @returns {Function} - A promise-returning function which will be executed when it's our turn in the sequence.
 *
 */
gpii.testem.cleanupDir = function (cleanupDef) {
    return function () {
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
                        }
                        else {
                            fluid.log("Removed ", cleanupDef.name, " content...");
                        }
                        promise.resolve();
                    });
                }
            }
            catch (error) {
                console.error(error);
                promise.resolve();
            }
            return promise;
        }
    };
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
 *
 */
gpii.testem.cleanup = function (cleanupDefs) {
    var togo = fluid.promise();
    togo.then(function () { fluid.log("Cleanup completed successfully...");});

    var cleanupPromises = [];
    fluid.each(cleanupDefs, function (singleDirEntry) {
        var cleanupPromise = gpii.testem.cleanupDir(singleDirEntry);
        cleanupPromises.push(cleanupPromise);
    });

    var sequence = fluid.promise.sequence(cleanupPromises);
    sequence.then(togo.resolve, togo.reject);

    return togo;
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
gpii.testem.generateCoverageReportIfNeeded = function (that) {
    if (that.options.generateCoverageReport) {
        try {
            var commandSegments = ["report", "--root", fluid.module.resolvePath(that.options.coverageDir), "--dir", that.options.reportsDir, "text-summary",  "html", "json-summary"];
            cli.runToCompletion(commandSegments);
            fluid.log("Created coverage report in '", that.options.reportsDir, "'...");
        }
        catch (error) {
            console.error(error);
        }
    }
    else {
        fluid.log("Skipping coverage report...");
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
        var resolvedPath = path.resolve(pathToResolve, filename);
        return resolvedPath;
    }
    catch (error) {
        console.error(error);
    }
};

// Stop our express instance if it has been created and hasn't already been destroyed.
gpii.testem.stopServer = function (that) {
    if (that.coverageExpressInstance && !fluid.isDestroyed(that.coverageExpressInstance)) {
        fluid.log("Stopping express...");
        gpii.express.stopServer(that.coverageExpressInstance);
    }
};

fluid.defaults("gpii.testem", {
    gradeNames:  ["fluid.component"],
    coveragePort: 7000,
    mergePolicy: {
        cleanup: "nomerge"
    },
    cwd: process.cwd(),
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
    wrappedEventTimeout: 30000,
    members: {
        generatedOptions: {
            routes: "@expand:gpii.testem.generateInstrumentationRoutes({that})"
        }
    },
    events: {
        constructFixtures: null,
        onTestemStart: null,
        onTestemExit: null,
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
        }
    },
    testemOptions: {
        // The timeout options and Chrome browser args are workaround to minimize "browser disconnect" errors.
        // https://github.com/testem/testem/issues/777
        browser_disconnect_timeout: 300, // Five minutes
        browser_start_timeout:      300,
        timeout: 300,
        "browser_args": {
            // TODO: enable once a new enough version of Firefox is available in CI.
            // "Firefox": [
            //     "--headless"
            // ],
            // See this ticket for details on the minimum options required to get "headless" Chrome working: https://github.com/testem/testem/issues/1106#issuecomment-298841383
            "Chrome": [
                "--disable-gpu",
                "--headless",
                "--remote-debugging-port=9222"
            ]
        },
        framework:   "qunit",
        report_file: {
            expander: {
                funcName: "gpii.testem.resolveSafely",
                args:     ["{that}.options.reportsDir", "report.tap"]
            }
        },
        cwd: "{that}.options.cwd",
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
            funcName: "gpii.testem.handleTestemLifecycleEvent",
            args:     ["{that}.events.onTestemStart", "{arguments}.2"] // componentEvent, testemCallback
        },
        "handleTestemExit": {
            funcName: "gpii.testem.handleTestemLifecycleEvent",
            args:     ["{that}.events.onTestemExit", "{arguments}.2"] // componentEvent, testemCallback
        },
        "getTestemOptions": {
            funcName: "gpii.testem.getTestemOptions",
            args:     ["{that}"]
        }
    },
    listeners: {
        // Disable default behavior to avoid double-stop.
        "onDestroy.stopServer": {
            funcName: "fluid.identity"
        },
        // The unified "testem startup" promise chain.
        "onTestemStart.cleanup": {
            priority: "first",
            funcName: "gpii.testem.cleanup",
            args:     ["{that}.options.cleanup.initial"]
        },
        "onTestemStart.instrument": {
            priority: "after:cleanup",
            funcName: "gpii.testem.instrumentAsNeeded",
            args:     ["{that}"]
        },
        "onTestemStart.constructFixtures": {
            priority: "after:instrument",
            func:     "{that}.events.constructFixtures.fire"
        },
        "onTestemStart.waitForFixtures": {
            priority: "after:constructFixtures",
            funcName: "gpii.testem.wrapSecondaryEvent",
            args:     ["{that}", "{that}.events.onFixturesConstructed"] // that, event
        },
        // The unified "testem shutdown" promise chain.
        "onTestemExit.stopExpress": {
            priority: "first",
            funcName: "gpii.testem.stopServer",
            args:     ["{that}"]
        },
        "onTestemExit.waitForFixtures": {
            priority: "after:stopExpress",
            funcName: "gpii.testem.wrapSecondaryEvent",
            args:     ["{that}", "{that}.events.onFixturesStopped"] // that, event
        },
        "onTestemExit.coverageReport": {
            priority: "after:waitForFixtures",
            funcName: "gpii.testem.generateCoverageReportIfNeeded",
            args:     ["{that}"]
        },
        "onTestemExit.cleanup": {
            priority: "last",
            funcName: "gpii.testem.cleanup",
            args:     ["{that}.options.cleanup.final"] // cleanupDefs
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

fluid.defaults("gpii.testem.coverageDataOnly", {
    gradeNames: ["gpii.testem"],
    generateCoverageReport: false,
    cleanup: {
        initial:  gpii.testem.dirs.everythingButCoverage,
        final:    gpii.testem.dirs.everythingButCoverage
    }
});
