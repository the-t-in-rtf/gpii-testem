/*

    A Fluid component to assist in making good use of Testem. See the README for details.

 */
/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-express");
fluid.require("%gpii-testem");

var fs      = require("fs");
var os      = require("os");
var path    = require("path");
var process = require("process");
var rimraf  = require("rimraf");

require("./coverageServer");
require("./instrumenter");
require("./reporter");
require("./lib/resolveSafely");

fluid.registerNamespace("gpii.testem");

/**
 *
 * Fire a pseudo-event, ensuring that a Testem callback is always called regardless of the result.
 *
 * @param componentEvent - The component event to be fired using `fluid.promise.fireTransformEvent`.
 * @param testemCallback - A function that will be called, for example, when we are ready for Testem to run the tests.
 *
 */
gpii.testem.handleTestemLifecycleEvent = function (componentEvent, testemCallback) {
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
 * @param that - The component itself.
 * @param event - The event to listen to.
 * @return {Promise} - A promise that will be resolved the next time `event` is fired.
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
 * @return originalPromise {Object} The original promise.
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
 * Deliver our effective options to Testem.  We do this this way to avoid exposing options to Testem before they have
 * been completely assembled.
 *
 * @param that - The component itself.
 * @return {Object} - The Testem options to use for this run.
 *
 */
gpii.testem.getTestemOptions = function (that) {
    return that.options.testemOptions;
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
 * @return {Promise} - A promise that will be resolved when cleanup is complete, or rejected if there is an error.
 *
 */
gpii.testem.cleanupTestemContent = function (path) {
    var testemRegexp = /testem-.+/;

    if (path) {

        var togo = fluid.promise();

        togo.then(function () { fluid.log("Removed Testem content..."); });
        try {
            var resolvedPath = gpii.testem.resolveFluidModulePathSafely(path);

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
 * @return {Function} - A promise-returning function which will be executed when it's our turn in the sequence.
 *
 */
gpii.testem.cleanupDir = function (cleanupDef) {
    return function () {
        var resolvedPath = fluid.module.resolvePath(cleanupDef.path);
        if (cleanupDef.isTestemContent) {
            return gpii.testem.cleanupTestemContent(resolvedPath);
        }
        else {
            var promise = fluid.promise();

            try {
                if (!fs.existsSync(resolvedPath)) {
                    fluid.log("No content exists for " + cleanupDef.name + ", skipping cleanup...");
                    promise.resolve();
                }
                else {
                    rimraf(resolvedPath, function (error) {
                        if (error) {
                            fluid.log(fluid.logLevel.ERROR, "Error removing ", cleanupDef.name, " content:", error);
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
 * @param key {String} -  A string describing which cleanup phase this is (typically "initial" or "final").
 * @param cleanupDefs {Object} - An array of cleanup definitions (see example above).
 *
 */
gpii.testem.cleanup = function (stage, cleanupDefs) {
    var togo = fluid.promise();
    togo.then(function () { fluid.log(stage, " cleanup completed successfully...");});

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
 * @return {String} - The full path to the unique subdirectory.
 */
gpii.testem.generateUniqueDirName = function (basePath, prefix, suffix) {
    try {
        var resolvedBasePath = gpii.testem.resolveFluidModulePathSafely(basePath);
        return path.resolve(resolvedBasePath, prefix + "-" + suffix);
    }
    catch (error) {
        fluid.log("Error generating unique dir name:", error);
    }
};

fluid.registerNamespace("gpii.testem.dirs");

// A convenience variable to assist in cleaning up just the testem-unique temporary content.
gpii.testem.dirs.onlyTestemContent = [
    {
        name:            "testem",
        path:            "{that}.options.testemDir",
        isTestemContent: true
    }
];

// A convenience variable to assist in cleaning up everything but the coverage data.
gpii.testem.dirs.everythingButCoverage = gpii.testem.dirs.onlyTestemContent.concat([
    {
        name: "instrumented",
        path: "{that}.options.instrumentedSourceDir"
    }
]);

// A convenience variable to assist in cleaning up everything, including coverage data.
gpii.testem.dirs.everything = gpii.testem.dirs.everythingButCoverage.concat([
    {
        name: "coverage",
        path: "{that}.options.coverageDir"
    }
]);

// Stop our express instance if it has been created and hasn't already been destroyed.
gpii.testem.stopServer = function (that) {
    if (that.express && !fluid.isDestroyed(that.express)) {
        fluid.log("Stopping express...");
        gpii.express.stopServer(that.express);
    }
};

// An expander to allow us to toggle "HEADLESS" mode with an environment variable.
gpii.testem.constructBrowserArgs = function (browserArgs, headlessBrowserArgs) {
    return (process.env.HEADLESS && headlessBrowserArgs) || browserArgs;
};

/**
 *
 * Construct a full set of Testem proxy configuration options based on component options.
 *
 * @param sourceDirs {Object} - An object whose top-level values each refer to a source directory definition.
 * @param contentDirs {Object} - An object whose top-level values each refer to a content directory definition.
 * @param additionalProxies {Object} - An array of additional proxy paths that should be directed to `coverageUrl`.
 * @param coverageUrl {String} - The URL where the gpii-express instance that collects coverage data (and hosts our content) is located.
 * @return {Object} - An object representing Testem proxy configuration options.
 *
 */
gpii.testem.constructProxies = function (sourceDirs, contentDirs, additionalProxies, coverageUrl) {
    var proxies = {};

    var dirPaths = [];
    fluid.each([sourceDirs, contentDirs], function (dirDefs) {
        var expandedDefs = fluid.transform(dirDefs, gpii.testem.expandPath);
        var orderedDirDefs = fluid.parsePriorityRecords(expandedDefs, "testem-proxy-paths");
        fluid.each(orderedDirDefs, function (pathDef) {
            dirPaths.push(gpii.testem.extractProxyPath(pathDef));
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

fluid.defaults("gpii.testem.base", {
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
    cleanup: {
        initial:  gpii.testem.dirs.onlyTestemContent,
        final:    gpii.testem.dirs.onlyTestemContent
    },
    testemDir: {
        expander: {
            funcName: "gpii.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "user_data_dir", "{that}.id"] // basePath, prefix, suffix
        }
    },
    reportsDir: {
        expander: {
            funcName: "gpii.testem.generateUniqueDirName",
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
        "Chrome": [
            "--disable-extensions",
            "--memory-pressure-threshholds=1",
            "--disk-cache-size=0",
            "--disable-new-zip-unpacker"
        ]
    },
    "headlessBrowserArgs": {
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
    testemOptions: {
        // The timeout options and Chrome browser args are workaround to minimize "browser disconnect" errors.
        // https://github.com/testem/testem/issues/777
        browser_disconnect_timeout: 300, // Five minutes
        browser_start_timeout:      300,
        timeout: 300,
        browser_args: "@expand:gpii.testem.constructBrowserArgs({that}.options.browserArgs, {that}.options.headlessBrowserArgs)",
        framework:   "qunit",
        tap_quiet_logs: true,
        report_file: {
            expander: {
                funcName: "gpii.testem.resolvePathSafely",
                args:     ["{that}.options.reportsDir", "report.tap"]
            }
        },
        cwd: "{that}.options.cwd",
        user_data_dir: "{that}.options.testemDir",
        on_start: "{that}.handleTestemStart",
        on_exit:  "{that}.handleTestemExit",
        src_files: [], // Explicitly tell testem not to watch or host any "source" content.
        serve_files: [], // Explicitly tell Testem not to host any additional content.
        test_page: "@expand:fluid.values({that}.options.testPages)", // Ensure that we can use mergeable objects for test pages.
        proxies: "@expand:gpii.testem.constructProxies({that}.options.sourceDirs, {that}.options.contentDirs, {that}.options.additionalProxies, {that}.options.coverageUrl)"
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
            args:     ["Initial", "{that}.options.cleanup.initial"]
        },
        "onTestemStart.constructFixtures": {
            priority: "after:cleanup",
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
        "onTestemExit.cleanup": {
            priority: "last",
            funcName: "gpii.testem.cleanup",
            args:     ["Final", "{that}.options.cleanup.final"] // cleanupDefs
        }
    },
    components: {
        express: {
            type: "gpii.testem.coverage.express",
            createOnEvent: "constructFixtures",
            options: {
                cwd:         "{gpii.testem.base}.options.cwd",
                sourceDirs:  "{gpii.testem.base}.options.sourceDirs",
                contentDirs: "{gpii.testem.base}.options.contentDirs",
                port:        "{gpii.testem.base}.options.coveragePort",
                listeners: {
                    "onStarted.notifyParent": {
                        func: "{gpii.testem.base}.events.onExpressStarted.fire"
                    },
                    "onStopped.notifyParent": {
                        func: "{gpii.testem.base}.events.onExpressStopped.fire"
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
 * @param that - The component itself.
 * @return {Promise} - A promise that will be resolved or rejected when the instrumentation pass finishes.
 */
gpii.testem.coverage.instrumentSource = function (that) {
    fluid.log("Instrumenting source.");
    var promises = [];
    var expandedDefs = fluid.transform(that.options.sourceDirs, gpii.testem.expandPath);

    fluid.each(expandedDefs, function (sourcePathDef) {
        var resolvedSourcePath = gpii.testem.resolvePackageOrCwdRelativePath(that.options.cwd, sourcePathDef.filePath);
        promises.push(function () {
            var lastDirSegment = gpii.testem.extractLastContentSegment(sourcePathDef, "");
            var instrumentedPath = gpii.testem.resolvePackageOrCwdRelativePath(that.options.instrumentedSourceDir, lastDirSegment);
            return gpii.testem.instrumenter.instrument(resolvedSourcePath, instrumentedPath, that.options.instrumentationOptions);
        });
    });
    var sequence = fluid.promise.sequence(promises);
    sequence.then(
        function () {
            fluid.log("Finished instrumentation...");
        },
        function (error) {
            console.error("Instrumentation error:", error);
            fluid.fail(error);
        }
    );
    return sequence;
};

/**
 *
 * Produce a list of paths where our instrumented source will eventually be housed.
 *
 * @param cwd {String} - The full path to the current working directory.  Will be used to resolve relative paths.
 * @param instrumentedSourceDir {String} - The full path to the location where the instrumented source should be saved.
 * @param sourceDirs {Object} - A map of named source dirs that will instrumented and hosted.
 *
 */
gpii.testem.coverage.expandInstrumentedSourceDirs = function (cwd, instrumentedSourceDir, sourceDirs) {
    var expandedDefs = fluid.transform(sourceDirs, gpii.testem.expandPath);

    return fluid.transform(expandedDefs, function (sourcePathDef) {
        var lastDirSegment = gpii.testem.extractLastContentSegment(sourcePathDef, "");
        var resolvedInstrumentedSourceDir = fluid.module.resolvePath(instrumentedSourceDir);
        return path.resolve(resolvedInstrumentedSourceDir, lastDirSegment);
    });
};


// A grade that adds the proxy configuration required to collect coverage data, but which does not itself instrument anything.
fluid.defaults("gpii.testem.coverage", {
    gradeNames: ["gpii.testem.base"],
    // The path where coverage data will be stored as it is collected.
    coverageDir: {
        expander: {
            funcName: "gpii.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "coverage", "{that}.id"] // basePath, prefix, suffix
        }
    },
    // The path where all instrumented source will be stored.
    instrumentedSourceDir: {
        expander: {
            funcName: "gpii.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "instrumented", "{that}.id"] // basePath, prefix, suffix
        }
    },
    // The full paths to individual pieces of instrumented source.
    instrumentedSourceDirs: "@expand:gpii.testem.coverage.expandInstrumentedSourceDirs({that}.options.cwd, {that}.options.instrumentedSourceDir, {that}.options.sourceDirs)",
    // The coverage server implicitly hosts a coverage client and listener, we use this block to include that in our generated list of proxies for all content.
    additionalProxies: {
        coverage: "/coverage"
    },
    distributeOptions: {
        source: "{that}.options.coverageDir",
        target: "{that gpii.testem.coverage.receiver.middleware}.options.coverageDir"
    },
    components: {
        express: {
            options: {
                sourceDirs: "{gpii.testem.coverage}.options.instrumentedSourceDirs"
            }
        }
    },
    testemOptions: {
        proxies: "@expand:gpii.testem.constructProxies({that}.options.instrumentedSourceDirs, {that}.options.contentDirs, {that}.options.additionalProxies, {that}.options.coverageUrl)"
    }
});

// A grade that adds instrumentation of code, but which does not generate reports.
fluid.defaults("gpii.testem.instrumentation", {
    gradeNames: ["gpii.testem.coverage"],
    cleanup: {
        initial:  gpii.testem.dirs.everythingButCoverage,
        final:    gpii.testem.dirs.everythingButCoverage
    },
    instrumentationOptions: {},
    // The path where all instrumented source will be stored.
    instrumentedSourceDir: {
        expander: {
            funcName: "gpii.testem.generateUniqueDirName",
            args:     [os.tmpdir(), "instrumented", "{that}.id"] // basePath, prefix, suffix
        }
    },
    listeners: {
        "onTestemStart.instrument": {
            priority: "after:cleanup",
            funcName: "gpii.testem.coverage.instrumentSource",
            args:     ["{that}"]
        },
        "onTestemStart.constructFixtures": {
            priority: "after:instrument",
            func:     "{that}.events.constructFixtures.fire"
        }
    }
});

// The default grade, which instruments source, collects coverage data, and generates reports.
fluid.defaults("gpii.testem", {
    gradeNames:  ["gpii.testem.instrumentation"],
    reports: ["text-summary", "html", "json-summary"],
    cleanup: {
        initial:  gpii.testem.dirs.everything,
        final:    gpii.testem.dirs.everything
    },
    listeners: {
        "onTestemExit.coverageReport": {
            priority: "after:waitForFixtures",
            funcName: "{that}.reporter.report"
        }
    },
    components: {
        reporter: {
            type: "gpii.testem.reporter",
            options: {
                coverageDir: "{gpii.testem}.options.coverageDir",
                cwd:         "{gpii.testem}.options.cwd",
                reportsDir:  "{gpii.testem}.options.reportsDir",
                reports:     "{gpii.testem}.options.reports"
            }
        }
    }
});

