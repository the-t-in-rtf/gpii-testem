// A "coverage receiver" to collect individual coverage reports produced in browser tests.
// Based on https://github.com/testem/testem/blob/master/examples/coverage_istanbul/testem.js
/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-express");

require("./coverageClientMiddleware");
require("./coverageReceiverMiddleware");


fluid.defaults("gpii.testem.coverage.router", {
    gradeNames: ["gpii.express.router"],
    path: "/coverage",
    coveragePort: 7003,
    components: {
        corsHeaders: {
            type: "gpii.express.middleware.headerSetter",
            options: {
                priority: "first",
                headers: {
                    cors: {
                        fieldName: "Access-Control-Allow-Origin",
                        template:  "*",
                        dataRules: {}
                    }
                }
            }
        },
        // Serve up the required coverage browser client that transmits results to `coverageCatcher` below.
        client: {
            type: "gpii.testem.middleware.coverageClient",
            options: {
                coveragePort: "{gpii.testem.coverage.router}.options.coveragePort"
            }
        },
        json: {
            type: "gpii.express.middleware.bodyparser.json",
            options: {
                priority: "after:client",
                bodyParserOptions: {
                    limit: 12500000 // Allow coverage payloads of up to 100Mb instead of the default 100Kb
                }
            }
        },
        urlencoded: {
            type: "gpii.express.middleware.bodyparser.urlencoded",
            options: {
                priority: "after:json",
                bodyParserOptions: {
                    limit: 12500000 // Allow coverage payloads of up to 100Mb instead of the default 100Kb
                }
            }
        },
        coverageReceiver: {
            type: "gpii.testem.coverage.receiver.middleware",
            options: {
                priority:     "after:urlencoded",
                coveragePort: "{gpii.testem.coverage.router}.options.coveragePort"
            }
        }
    }
});

fluid.defaults("gpii.testem.coverage.express", {
    gradeNames: ["gpii.express"],
    components: {
        coverageRouter: {
            type: "gpii.testem.coverage.router",
            options: {
                coveragePort: "{gpii.testem.coverage.express}.options.port"
            }
        }
    }
});
