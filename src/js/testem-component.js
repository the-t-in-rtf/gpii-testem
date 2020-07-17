/*

    A Fluid component to assist in making good use of Testem. See the README for details.

 */
/* eslint-env node */
"use strict";
var fluid = require("infusion");

fluid.require("%fluid-express");
fluid.require("%fluid-testem");

var fs      = require("fs");
var os      = require("os");
var path    = require("path");
var process = require("process");
var rimraf  = require("rimraf");

require("./coverageServer");
require("./instrumenter");
require("./reporter");
require("./lib/resolveSafely");

fluid.registerNamespace("fluid.testem");

/**
 *
 * Fire a pseudo-event, ensuring that a Testem callback is always called regardless of the result.
 *
 * @param {String} componentEvent - The component event to be fired using `fluid.promise.fireTransformEvent`.
 * @param {Function} testemCallback - A function that will be called, for example, when we are ready for Testem to run the tests.
 *
 */
fluid.testem.handleTestemLifecycleEvent = function (componentEvent, testemCallback) {
    var eventTransformChain = fluid.promise.fireTransformEvent(componentEvent);
    eventTransformChain.then(
        function () {
            fluid.log("Successfully reached the end of promise chain. Firing testem callback.");
            testemCallback();
        },
        function () {
            fluid.log("Promise chain terminated by promise rejection. Firing testem callback.");
            testemCallback();
        }
    );
};

/**
 *
 * A function to wrap a secondary component event so that we can represent the entire startup and shutdown as two chains.
 *
 * @param {Object} that - The component itself.
 * @param {String} event - The event to listen to.
 * @return {Promise} - A promise that will be resolved the next time `event` is fired.
 */
fluid.testem.wrapSecondaryEvent = function (that, event) {
    var eventPromise = fluid.testem.generateSingleUseEventListener(that, event);
    fluid.testem.addPromiseTimeout(eventPromise, "Timed out while waiting for event '" + event.name + "' to fire...", that.options.wrappedEventTimeout);
    return eventPromise;
};

/**
 *
 * Listen for an event once, resolve a promise, and then stop listening.  Also stops listening if the returned promise
 * is resolved/reject externally (for example, by the timeout wrapper.
 *
 * Only works with Fluid Promises, see: http://docs.fluidproject.org/infusion/development/PromisesAPI.html
 *
 * @param {Object} that - The component itself.
 * @param {String} event - The event to wrap with a promise.
 * @return {Promise} - The event promise.
 */
fluid.testem.generateSingleUseEventListener = function (that, event) {
    var eventPromise = fluid.promise();

    // Ensure that the listener is removed whether we resolve the promise, or whether someone else does.
    var listenerNamespace = "fluid.testem.singleUse." + that.id;
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
 * @param {Promise} originalPromise - The original promise to wrap in a timeout.
 * @param {Object} rejectionPayload - The payload to use when rejecting the message.
 * @param {Number} timeoutInMillis - The number of milliseconds to wait before timing out.
 * @return {Object} - The original promise.
 */
fluid.testem.addPromiseTimeout = function (originalPromise, rejectionPayload, timeoutInMillis) {
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
 * Deliver our effective options to Testem.  We do this this way to avoid exposing options to Testem before they have
 * been completely assembled.
 *
 * @param {Object} that - The component itself.
 * @return {Object} - The Testem options to use for this run.
 *
 */
fluid.testem.getTestemOptions = function (that) {
    return fluid.copy(that.options.testemOptions);
};

fluid.testem.generateRimrafWrapper = function (path, rimrafOptions) {
    return function () {
        var rimrafPromise = fluid.promise();
        rimraf(path, fluid.copy(rimrafOptions), function (rimrafError) {
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
 * @param {String} pathToCleanup - The path to the directory which contains Testem's browser data from this run.
 * @param {Object} rimrafOptions - Configuration options to pass when calling rimraf.
 * @return {Promise} - A promise that will be resolved when cleanup is complete, or rejected if there is an error.
 *
 */
fluid.testem.cleanupTestemContent = function (pathToCleanup, rimrafOptions) {
    var togo = fluid.promise();

    try {
        var resolvedPath = fluid.testem.resolveFluidModulePathSafely(pathToCleanup);
        var cleanupPromises = [];
        cleanupPromises.push(fluid.testem.generateRimrafWrapper(resolvedPath, rimrafOptions));


        // Cleanup the empty directories Testem leaves in os.tmpDir();
        var testemRegexp = /^Temp-.+/;
        var tmpFiles = fs.readdirSync(os.tmpdir());
        fluid.each(tmpFiles, function (tmpFile) {
            if (tmpFile.match(testemRegexp)) {
                var fullPath = path.resolve(os.tmpdir(), tmpFile);
                cleanupPromises.push(fluid.testem.generateRimrafWrapper(fullPath, rimrafOptions));
            }
        });

        var cleanupSequence = fluid.promise.sequence(cleanupPromises);
        cleanupSequence.then(function () {
            if (!togo.disposition) { togo.resolve(); }
        }, togo.reject);
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
 * @param {Object} cleanupDef - A cleanup definition, see example above.
 * @param {Object} rimrafOptions - Configuration options to pass when calling rimraf.
 * @return {Function} - A promise-returning function which will be executed when it's our turn in the sequence.
 *
 */
fluid.testem.cleanupDir = function (cleanupDef, rimrafOptions) {
    return function () {
        var resolvedPath = fluid.module.resolvePath(cleanupDef.path);
        if (cleanupDef.isTestemContent) {
            return fluid.testem.cleanupTestemContent(resolvedPath, rimrafOptions);
        }
        else {
            var promise = fluid.promise();

            try {
                if (!fs.existsSync(resolvedPath)) {
                    fluid.log("No content exists for " + cleanupDef.name + ", skipping cleanup...");
                    promise.resolve();
                }
                else {
                    rimraf(resolvedPath, fluid.copy(rimrafOptions), function (error) {
                        if (error) {
                            fluid.log(fluid.logLevel.WARN, "Error removing ", cleanupDef.name, " content:", error);
                        }
                        else {
                            fluid.log("Removed ", cleanupDef.name, " content...");
                        }
                        promise.resolve();
                    });
                }
            }
            catch (error) {
                fluid.log(fluid.logLevel.WARN, error);
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
 * @param {String} stage -  A string describing which cleanup phase this is (typically "initial" or "final").
 * @param {Object} cleanupDefs - An array of cleanup definitions (see example above).
 * @param {Object} rimrafOptions - Configuration options to pass when calling rimraf.
 * @return {Promise} - A promise that will be resolved when cleanup is complete.
 *
 */
fluid.testem.cleanup = function (stage, cleanupDefs, rimrafOptions) {
    var togo = fluid.promise();
    togo.then(
        function () { fluid.log(stage, " cleanup completed successfully...");},
        function (error) {
            var errorMessage = fluid.get(error, "stack") || fluid.get(error, "message") || error;
            fluid.log("Cleanup failed:", JSON.stringify(errorMessage));
        });

    var cleanupPromises = [];
    fluid.each(cleanupDefs, function (singleDirEntry) {
        var cleanupPromise = fluid.testem.cleanupDir(singleDirEntry, rimrafOptions);
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
 * @param {String} basePath - A full or package-relative path to the subdirectory in which the new directory will live.
 * @param {String} prefix - A "prefix" that will be prepended to the filename.
 * @param {String} suffix - A "suffix" that will be appended to the end of the filename.
 * @return {String} - The full path to the unique subdirectory.
 */
fluid.testem.generateUniqueDirName = function (basePath, prefix, suffix) {
    try {
        var resolvedBasePath = fluid.testem.resolveFluidModulePathSafely(basePath);
        return path.resolve(resolvedBasePath, prefix + "-" + suffix);
    }
    catch (error) {
        fluid.log("Error generating unique dir name:", error);
    }
};

fluid.registerNamespace("fluid.testem.dirs");

// A convenience variable to assist in cleaning up just the testem-unique temporary content.
fluid.testem.dirs.onlyTestemContent = [
    {
        name:            "testem",
        path:            "{that}.options.testemDir",
        isTestemContent: true
    }
];

// A convenience variable to assist in cleaning up everything but the coverage data.
fluid.testem.dirs.everythingButCoverage = fluid.testem.dirs.onlyTestemContent.concat([
    {
        name: "instrumented",
        path: "{that}.options.instrumentedSourceDir"
    }
]);

// A convenience variable to assist in cleaning up everything, including coverage data.
fluid.testem.dirs.everything = fluid.testem.dirs.everythingButCoverage.concat([
    {
        name: "coverage",
        path: "{that}.options.coverageDir"
    }
]);

// Stop our express instance if it has been created and hasn't already been destroyed.
fluid.testem.stopServer = function (that) {
    if (that.express && !fluid.isDestroyed(that.express)) {
        fluid.log("Stopping express...");
        fluid.express.stopServer(that.express);
    }
};

// An expander to allow us to toggle "HEADLESS" mode with an environment variable.
fluid.testem.constructBrowserArgs = function (browserArgs, headlessBrowserArgs) {
    return (process.env.HEADLESS && headlessBrowserArgs) || browserArgs;
};

/**
 *
 * Construct a full set of Testem proxy configuration options based on component options.
 *
 * @param {Object} sourceDirs - An object whose top-level values each refer to a source directory definition.
 * @param {Object} contentDirs - An object whose top-level values each refer to a content directory definition.
 * @param {Object} additionalProxies - An array of additional proxy paths that should be directed to `coverageUrl`.
 * @param {String} coverageUrl - The URL where the fluid-express instance that collects coverage data (and hosts our content) is located.
 * @return {Object} - An object representing Testem proxy configuration options.
 *
 */
fluid.testem.constructProxies = function (sourceDirs, contentDirs, additionalProxies, coverageUrl) {
    var proxies = {};

    var dirPaths = [];
    fluid.each([sourceDirs, contentDirs], function (dirDefs) {
        var expandedDefs = fluid.transform(dirDefs, fluid.testem.expandPath);
        var orderedDirDefs = fluid.parsePriorityRecords(expandedDefs, "testem-proxy-paths");
        fluid.each(orderedDirDefs, function (pathDef) {
            dirPaths.push(fluid.testem.extractProxyPath(pathDef));
        });
    });

    fluid.each(additionalProxies, function (additionalProxyDestination) {
        dirPaths.push(additionalProxyDestination);
    });

    fluid.each(dirPaths, function (dirPath) {
        proxies[dirPath] = {
            "target": coverageUrl
        };
    });

    return proxies;
};

fluid.defaults("fluid.testem.base", {
    gradeNames:  ["fluid.component"],
    coveragePort: 7000,
    coverageUrl: {
        expander: {
            funcName: "fluid.stringTemplate",
            args:     ["http://localhost:%port", { port: "{that}.options.coveragePort" }]
        }
    },
    cwd: process.cwd(),
    mergePolicy: {
        cleanup: "nomerge"
    },
    rimrafOptions: {},
    cleanup: {
        initial:  fluid.testem.dirs.onlyTestemContent,
        final:    fluid.testem.dirs.onlyTestemContent
    },
    testemDir: {
        expander: {
            funcName: "fluid.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "user_data_dir", "{that}.id"] // basePath, prefix, suffix
        }
    },
    reportsDir: {
        expander: {
            funcName: "fluid.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "reports", "{that}.id"] // basePath, prefix, suffix
        }
    },
    additionalProxies: {},
    sourceDirs: {},
    contentDirs: {},
    testPages: [],
    wrappedEventTimeout: 30000,
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
    "browserArgs": {
        "Firefox": [
            "--no-remote"
        ],
        "Chrome": [
            "--disable-extensions",
            "--memory-pressure-threshholds=1",
            "--disk-cache-size=0",
            "--disable-new-zip-unpacker"
        ]
    },
    "headlessBrowserArgs": {
        "Firefox": [
            "--no-remote",
            "--headless"
        ],
        // See this ticket for details on the minimum options required to get "headless" Chrome working: https://github.com/testem/testem/issues/1106#issuecomment-298841383
        "Chrome": [
            "--disable-gpu",
            "--headless",
            "--remote-debugging-port=9222"
        ]
    },
    testemOptions: {
        // The timeout options and Chrome browser args are workaround to minimize "browser disconnect" errors.
        // https://github.com/testem/testem/issues/777
        browser_disconnect_timeout: 300, // Five minutes
        browser_start_timeout:      300,
        timeout: 300,
        browser_args: "@expand:fluid.testem.constructBrowserArgs({that}.options.browserArgs, {that}.options.headlessBrowserArgs)",
        framework:   "qunit",
        tap_quiet_logs: true,
        report_file: {
            expander: {
                funcName: "fluid.testem.resolvePathSafely",
                args:     ["{that}.options.reportsDir", "report.tap"]
            }
        },
        cwd: "@expand:fluid.module.resolvePath({that}.options.cwd)",
        on_start: "{that}.handleTestemStart",
        on_exit:  "{that}.handleTestemExit",
        src_files: [], // Explicitly tell testem not to watch or host any "source" content.
        serve_files: [], // Explicitly tell Testem not to host any additional content.
        test_page: "@expand:fluid.values({that}.options.testPages)", // Ensure that we can use mergeable objects for test pages.
        proxies: "@expand:fluid.testem.constructProxies({that}.options.sourceDirs, {that}.options.contentDirs, {that}.options.additionalProxies, {that}.options.coverageUrl)"
    },
    invokers: {
        "handleTestemStart": {
            funcName: "fluid.testem.handleTestemLifecycleEvent",
            args:     ["{that}.events.onTestemStart", "{arguments}.2"] // componentEvent, testemCallback
        },
        "handleTestemExit": {
            funcName: "fluid.testem.handleTestemLifecycleEvent",
            args:     ["{that}.events.onTestemExit", "{arguments}.2"] // componentEvent, testemCallback
        },
        "getTestemOptions": {
            funcName: "fluid.testem.getTestemOptions",
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
            funcName: "fluid.testem.cleanup",
            args:     ["Initial", "{that}.options.cleanup.initial", "{that}.options.rimrafOptions"] // , rimrafOptions
        },
        "onTestemStart.constructFixtures": {
            //priority: "first",
            priority: "after:cleanup",
            func:     "{that}.events.constructFixtures.fire"
        },
        "onTestemStart.waitForFixtures": {
            priority: "after:constructFixtures",
            funcName: "fluid.testem.wrapSecondaryEvent",
            args:     ["{that}", "{that}.events.onFixturesConstructed"] // that, event
        },
        // The unified "testem shutdown" promise chain.
        "onTestemExit.stopExpress": {
            priority: "first",
            funcName: "fluid.testem.stopServer",
            args:     ["{that}"]
        },
        "onTestemExit.waitForFixtures": {
            priority: "after:stopExpress",
            funcName: "fluid.testem.wrapSecondaryEvent",
            args:     ["{that}", "{that}.events.onFixturesStopped"] // that, event
        },
        "onTestemExit.cleanup": {
            priority: "last",
            funcName: "fluid.testem.cleanup",
            args:     ["Final", "{that}.options.cleanup.final", "{that}.options.rimrafOptions"] // cleanupDefs, rimrafOptions
        }
    },
    components: {
        express: {
            type: "fluid.testem.coverage.express",
            createOnEvent: "constructFixtures",
            options: {
                cwd:         "{fluid.testem.base}.options.cwd",
                sourceDirs:  "{fluid.testem.base}.options.sourceDirs",
                contentDirs: "{fluid.testem.base}.options.contentDirs",
                port:        "{fluid.testem.base}.options.coveragePort",
                listeners: {
                    "onStarted.notifyParent": {
                        func: "{fluid.testem.base}.events.onExpressStarted.fire"
                    },
                    "onStopped.notifyParent": {
                        func: "{fluid.testem.base}.events.onExpressStopped.fire"
                    }
                }

            }
        }
    }
});

/**
 *
 * Optionally instrument the source code under test.
 *
 * @param {Object} that - The component itself.
 * @return {Promise} - A promise that will be resolved or rejected when the instrumentation pass finishes.
 */
fluid.testem.coverage.instrumentSource = function (that) {
    fluid.log("Instrumenting source.");
    var promises = [];
    var expandedDefs = fluid.transform(that.options.sourceDirs, fluid.testem.expandPath);
    var resolvedInstrumentationDir = fluid.module.resolvePath(that.options.instrumentedSourceDir);
    var resolvedCwd = fluid.module.resolvePath(that.options.cwd);

    fluid.each(expandedDefs, function (sourcePathDef) {
        var resolvedSourcePath = fluid.testem.resolvePackageOrCwdRelativePath(resolvedCwd, sourcePathDef.filePath);
        promises.push(function () {
            var lastDirSegment = fluid.testem.extractLastContentSegment(sourcePathDef, "");
            var instrumentedPath = fluid.testem.resolvePackageOrCwdRelativePath(resolvedInstrumentationDir, lastDirSegment);
            return fluid.testem.instrumenter.instrument(resolvedSourcePath, instrumentedPath, that.options.instrumentationOptions);
        });
    });
    var sequence = fluid.promise.sequence(promises);
    sequence.then(
        function () {
            fluid.log("Finished instrumentation...");
        },
        function (error) {
            fluid.log(fluid.logLevel.FAIL, "Instrumentation error:\n" + error);
            fluid.fail(error);
        }
    );
    return sequence;
};

/**
 *
 * Produce a list of paths where our instrumented source will eventually be housed.
 *
 * @param {String} cwd - The full path to the current working directory.  Will be used to resolve relative paths.
 * @param {String} instrumentedSourceDir - The full path to the location where the instrumented source should be saved.
 * @param {Object} sourceDirs - A map of named source dirs that will instrumented and hosted.
 * @return {Array<String>} - An array of expanded paths.
 *
 */
fluid.testem.coverage.expandInstrumentedSourceDirs = function (cwd, instrumentedSourceDir, sourceDirs) {
    var resolvedInstrumentedSourceDir = fluid.testem.resolvePackageOrCwdRelativePath(cwd, instrumentedSourceDir);

    var expandedDefs = fluid.transform(sourceDirs, fluid.testem.expandPath);
    return fluid.transform(expandedDefs, function (sourcePathDef) {
        var lastDirSegment = fluid.testem.extractLastContentSegment(sourcePathDef, "");
        return path.resolve(resolvedInstrumentedSourceDir, lastDirSegment);
    });
};


// A grade that adds the proxy configuration required to collect coverage data, but which does not itself instrument anything.
fluid.defaults("fluid.testem.coverage", {
    gradeNames: ["fluid.testem.base"],
    // The path where coverage data will be stored as it is collected.
    coverageDir: {
        expander: {
            funcName: "fluid.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "coverage", "{that}.id"] // basePath, prefix, suffix
        }
    },
    // The path where all instrumented source will be stored.
    instrumentedSourceDir: {
        expander: {
            funcName: "fluid.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "instrumented", "{that}.id"] // basePath, prefix, suffix
        }
    },
    // The full paths to individual pieces of instrumented source.
    instrumentedSourceDirs: "@expand:fluid.testem.coverage.expandInstrumentedSourceDirs({that}.options.cwd, {that}.options.instrumentedSourceDir, {that}.options.sourceDirs)",
    // The coverage server implicitly hosts a coverage client and listener, we use this block to include that in our generated list of proxies for all content.
    additionalProxies: {
        coverage: "/coverage"
    },
    distributeOptions: {
        source: "{that}.options.coverageDir",
        target: "{that fluid.testem.coverage.receiver.middleware}.options.coverageDir"
    },
    components: {
        express: {
            options: {
                sourceDirs: "{fluid.testem.coverage}.options.instrumentedSourceDirs"
            }
        }
    },
    testemOptions: {
        proxies: "@expand:fluid.testem.constructProxies({that}.options.instrumentedSourceDirs, {that}.options.contentDirs, {that}.options.additionalProxies, {that}.options.coverageUrl)"
    }
});

// A grade that adds instrumentation of code, but which does not generate reports.
fluid.defaults("fluid.testem.instrumentation", {
    gradeNames: ["fluid.testem.coverage"],
    cleanup: {
        initial:  fluid.testem.dirs.everythingButCoverage,
        final:    fluid.testem.dirs.everythingButCoverage
    },
    instrumentationOptions: {},
    // The path where all instrumented source will be stored.
    instrumentedSourceDir: {
        expander: {
            funcName: "fluid.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "instrumented", "{that}.id"] // basePath, prefix, suffix
        }
    },
    listeners: {
        "onTestemStart.instrument": {
            priority: "after:cleanup",
            funcName: "fluid.testem.coverage.instrumentSource",
            args:     ["{that}"]
        },
        "onTestemStart.constructFixtures": {
            priority: "after:instrument",
            func:     "{that}.events.constructFixtures.fire"
        }
    }
});

// The default grade, which instruments source, collects coverage data, and generates reports.
fluid.defaults("fluid.testem", {
    gradeNames:  ["fluid.testem.instrumentation"],
    reports: ["text-summary", "html", "json-summary"],
    cleanup: {
        initial:  fluid.testem.dirs.everything,
        final:    fluid.testem.dirs.everything
    },
    listeners: {
        "onTestemExit.coverageReport": {
            priority: "after:waitForFixtures",
            funcName: "{that}.reporter.report"
        }
    },
    components: {
        reporter: {
            type: "fluid.testem.reporter",
            options: {
                coverageDir: "{fluid.testem}.options.coverageDir",
                cwd:         "{fluid.testem}.options.cwd",
                reportsDir:  "{fluid.testem}.options.reportsDir",
                reports:     "{fluid.testem}.options.reports"
            }
        }
    }
});
