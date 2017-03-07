/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-express");

var fs     = require("fs");
var path   = require("path");
var mkdirp = require("mkdirp");

fluid.registerNamespace("gpii.testem.coverage.receiver");

gpii.testem.coverage.receiver.initMiddleware = function (that) {
    mkdirp(that.options.coverageDir);
};

gpii.testem.coverage.receiver.middlewareImpl = function (that, request, response) {
    var resolvedCoverageDir = fluid.module.resolvePath(that.options.coverageDir);
    var coverageOutputPath  = path.join(resolvedCoverageDir, "coverage-" + that.id + "-" + Math.round(Math.random() * 100000) + ".json");

    fs.writeFile(coverageOutputPath, request.body.coverage, { encoding: "utf8"}, function (error) {
        if (error) {
            response.status(500).send({ isError: true, message: error});
        }
        else {
            response.status(200).send({ message: "You have successfully saved your coverage report."});
        }
    });
};

fluid.defaults("gpii.testem.coverage.receiver.middleware", {
    gradeNames: ["gpii.express.middleware"],
    path:   "/",
    method: ["put", "post"],
    invokers: {
        middleware: {
            funcName: "gpii.testem.coverage.receiver.middlewareImpl",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
        }
    },
    listeners: {
        "onCreate.init": {
            funcName: "gpii.testem.coverage.receiver.initMiddleware",
            args:     ["{that}"]
        }
    }
});
