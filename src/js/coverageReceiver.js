// A "coverage receiver" to collect individual coverage reports produced in browser tests.
// Based on https://github.com/testem/testem/blob/master/examples/coverage_istanbul/testem.js
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

fluid.defaults("gpii.testem.coverage.receiver.router", {
    gradeNames: ["gpii.express.router"],
    path: "/coverage",
    components: {
        // Serve up the required coverage browser client that transmits results to `coverageCatcher` below.
        client: {
            type: "gpii.express.router.static",
            options: {
                path:    "/client",
                content: ["%gpii-testem/src/js/client"]
            }
        },
        json: {
            type: "gpii.express.middleware.bodyparser.json",
            options: {
                priority: "after:client",
                options: {
                    bodyParserOptions: {
                        limit: 12500000 // Allow coverage payloads of up to 100Mb instead of the default 100Kb
                    }
                }
            }
        },
        urlencoded: {
            type: "gpii.express.middleware.bodyparser.urlencoded",
            options: {
                priority: "after:json"
            }
        },
        coverageCatcher: {
            type: "gpii.testem.coverage.receiver.middleware",
            options: {
                priority: "after:urlencoded"
            }
        }
    }
});

fluid.defaults("gpii.testem.coverage.express", {
    gradeNames: ["gpii.express"],
    components: {
        coverageRouter: {
            type: "gpii.testem.coverage.receiver.router"
        }
    }
});
