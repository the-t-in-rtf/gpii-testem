/*

    A lightweight wrapper around the reporting library used by nyc.js, so that we can directly make use of it in a
    unified Testem run without spawning child processes.

 */
/* eslint-env node */
"use strict";
var fluid   = require("infusion");
var gpii    = fluid.registerNamespace("gpii");
var NYC     = require("nyc");
var process = require("process");

require("./lib/resolveSafely");

fluid.registerNamespace("gpii.testem.reporter");

gpii.testem.reporter.report = function (that) {
    fluid.log("Generating coverage report.");
    var promise = fluid.promise();
    var nyc = new NYC(that.options.nycOptions);
    try {
        nyc.report();
        promise.resolve();
    }
    catch (error) {
        fluid.log(fluid.logLevel.WARN, "NYC ERROR:", JSON.stringify(error, null, 2));
        promise.reject(error.stack || error.message || error);
    }
    return promise;
};

fluid.defaults("gpii.testem.reporter", {
    gradeNames:  ["fluid.component"],
    reportsDir:  "reports",
    coverageDir: "coverage",
    reports:     ["html", "text-summary"],
    cwd:         process.cwd(),
    nycOptions: {
        cwd:           "@expand:gpii.testem.resolveFluidModulePathSafely({that}.options.cwd)",
        reporter:      "@expand:fluid.makeArray({that}.options.reports)",
        reportDir:     "@expand:gpii.testem.resolveFluidModulePathSafely({that}.options.reportsDir)",
        tempDirectory: "@expand:gpii.testem.resolveFluidModulePathSafely({that}.options.coverageDir)"
    },
    invokers: {
        report: {
            funcName: "gpii.testem.reporter.report",
            args:     ["{that}"]
        }
    }
});
