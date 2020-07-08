/* eslint-env node */
"use strict";
var fluid = require("infusion");

require("fluid-express");
//fluid.require("%fluid-express");

var fs     = require("fs");
var path   = require("path");
var mkdirp = require("mkdirp");

fluid.registerNamespace("fluid.testem.coverage.receiver");


// Adapted from `fluid.match`: https://github.com/fluid-project/infusion/blob/16a963d63dce313ab3f2e3a81c725c2cbef0af79/src/framework/core/js/FluidDocument.js#L31
// (We can't use it directly because the rest of that file is designed to work only in a browser).
fluid.testem.coverage.receiver.uaMatch = function (ua) {
    ua = ua.toLowerCase();

    var match = /(chrome)[ \/]([\w.]+)/.exec( ua ) ||
        /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
        /(opera)(?:.*version|)[ \/]([\w.]+)/.exec( ua ) ||
        /(msie) ([\w.]+)/.exec( ua ) ||
        ua.indexOf("compatible") < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec( ua ) || [];

    return {
        name: match[ 1 ] || "unknown",
        version: match[ 2 ] || "0"
    };
};

fluid.testem.coverage.receiver.initMiddleware = function (that) {
    if (that.options.coverageDir) {
        var resolvedCoverageDir = fluid.module.resolvePath(that.options.coverageDir);
        mkdirp(resolvedCoverageDir);
    }
};

fluid.testem.coverage.receiver.middlewareImpl = function (that, request, response) {
    var resolvedCoverageDir = fluid.module.resolvePath(that.options.coverageDir);

    var coveragePayload = request.body.payload;

    var browser      = fluid.testem.coverage.receiver.uaMatch(fluid.get(coveragePayload, "navigator.userAgent"));

    var testPath     = fluid.get(coveragePayload.document, "URL");
    var testFilename = testPath ? testPath.split("/").pop() : "unknown";

    var coverageFilename    = ["coverage", "-", browser.name, "-", browser.version, "-", testFilename, "-", that.id, "-", Math.round(Math.random() * 10000), ".json"].join("");
    var coverageOutputPath  = path.join(resolvedCoverageDir, coverageFilename);

    fs.writeFile(coverageOutputPath, JSON.stringify(coveragePayload.coverage, null, 2), { encoding: "utf8"}, function (error) {
        if (error) {
            response.status(500).send({ isError: true, message: error});
        }
        else {
            response.status(200).send({ message: "You have successfully saved your coverage report."});
        }
    });
};

fluid.defaults("fluid.testem.coverage.receiver.middleware", {
    gradeNames: ["fluid.express.middleware"],
    path:   "/",
    method: ["put", "post"],
    invokers: {
        middleware: {
            funcName: "fluid.testem.coverage.receiver.middlewareImpl",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
        }
    },
    listeners: {
        "onCreate.init": {
            funcName: "fluid.testem.coverage.receiver.initMiddleware",
            args:     ["{that}"]
        }
    }
});
