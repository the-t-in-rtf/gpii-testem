/* eslint-env node */
"use strict";
var fluid = require("infusion");

var fs = require("fs");

require("fluid-express");

fluid.registerNamespace("fluid.testem.middleware.coverageClient");
fluid.testem.middleware.coverageClient.middlewareImpl = function (that, req, res, next) {
    fs.readFile(fluid.module.resolvePath(that.options.baseClientSource), function (error, data) {
        if (error) {
            next(error);
        }
        else {
            try {
                var resolvedInvokerTemplatePath = fluid.module.resolvePath(that.options.clientInvokerTemplatePath);
                var invokerTemplateContent = fs.readFileSync(resolvedInvokerTemplatePath, "utf8");
                var invokerCode = fluid.stringTemplate(invokerTemplateContent, that.options);
                var combinedPayload = [data, invokerCode].join("\n");
                res.set("Content-Type", "text/javascript").status(200).send(combinedPayload);
            }
            catch (error) {
                next (error);
            }
        }
    });
};

fluid.defaults("fluid.testem.middleware.coverageClient", {
    gradeNames: ["fluid.express.middleware"],
    path:    "/client",
    baseClientSource: "%fluid-testem/src/js/client/coverageSender.js",
    clientInvokerTemplatePath: "%fluid-testem/src/templates/coverage-client-invoker.handlebars" ,
    coveragePort: 7000,
    hookTestem: true,
    hookQUnit: false,
    exposeCallback: false,
    invokers: {
        middleware: {
            funcName: "fluid.testem.middleware.coverageClient.middlewareImpl",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // req, res, next
        }
    }
});
