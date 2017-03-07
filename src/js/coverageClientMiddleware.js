/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var fs = require("fs");

fluid.require("%gpii-express");

fluid.registerNamespace("gpii.testem.middleware.coverageClient");

gpii.testem.middleware.coverageClient.middlewareImpl = function (that, req, res, next) {
    fs.readFile(fluid.module.resolvePath(that.options.baseClientSource), function (error, data) {
        if (error) {
            next(error);
        }
        else {
            var invokerCode = fluid.stringTemplate(that.options.clientInvokerTemplate, that.options);
            var combinedPayload = [data, invokerCode].join("\n");

            res.set("Content-Type", "text/javascript").status(200).send(combinedPayload);
        }
    });
};

fluid.defaults("gpii.testem.middleware.coverageClient", {
    gradeNames: ["gpii.express.middleware"],
    path:    "/client",
    baseClientSource: "%gpii-testem/src/js/client/coverageSender.js",
    clientInvokerTemplate: "(function (fluid){ \"use strict\"; var fluid = fluid || require(\"infusion\"); var gpii = fluid.registerNamespace(\"gpii\"); gpii.testem.coverage.sender({ coveragePort: %coveragePort});})(fluid);\n",
    coveragePort: 7000,
    invokers: {
        middleware: {
            funcName: "gpii.testem.middleware.coverageClient.middlewareImpl",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // req, res, next
        }
    }
});
