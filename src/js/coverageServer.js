/*

    An instance of gpii.express that:

    1. Receives coverage data from browser tests.
    2. Hosts content that can be referred to in the tests using the testem "proxies" option.

    The "coverage receiver" is based on this example from the Testem documentation:

    https://github.com/testem/testem/blob/master/examples/coverage_istanbul/testem.js

    The content hosting is preferable to that built into Testem, as it does not force you to store all everything in
    a single enclosing directory, or to express all paths relative to the current working directory.

 */
/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("gpii-express");

require("./coverageClientMiddleware");
require("./coverageReceiverMiddleware");
require("./lib/pathUtils");

fluid.require("%gpii-testem");

fluid.defaults("gpii.testem.coverage.router", {
    gradeNames: ["gpii.express.router"],
    path: "/coverage",
    coveragePort: 7003,
    components: {
        // Allow content hosted (by proxy or otherwise) within Testem to communicate with us on our own port.
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
                middlewareOptions: {
                    limit: 12500000 // Allow coverage payloads of up to 100Mb instead of the default 100Kb
                }
            }
        },
        urlencoded: {
            type: "gpii.express.middleware.bodyparser.urlencoded",
            options: {
                priority: "after:json",
                middlewareOptions: {
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

fluid.registerNamespace("gpii.testem.coverage.express");

/**
 *
 * Generate a definition that can be used to instantiate a piece of middleware to host each source and content
 * directory.
 *
 * @param sourceDirs {Object} - A map of source directories to host.
 * @param contentDirs {Object} - A map of content directories to host.
 * @return {Array} - A copy of `contentDirs`, ordered by namespaced priorities.
 *
 */
gpii.testem.coverage.express.generateRouterSources = function (sourceDirs, contentDirs) {
    var combinedDefs = fluid.merge({}, sourceDirs, contentDirs);
    var expandedDefs = fluid.transform(combinedDefs, gpii.testem.expandPath);
    var orderedCombinedDirs = fluid.parsePriorityRecords(expandedDefs, "gpii-testem-router-content");
    return orderedCombinedDirs;
};

fluid.defaults("gpii.testem.coverage.express", {
    gradeNames:  ["gpii.express"],
    sourceDirs:  {},
    conparsePrioritytentDirs: {},
    components: {
        coverageRouter: {
            type: "gpii.testem.coverage.router",
            options: {
                coveragePort: "{gpii.testem.coverage.express}.options.port"
            }
        }
    },
    dynamicComponents: {
        contentRouter: {
            sources: "@expand:gpii.testem.coverage.express.generateRouterSources({gpii.testem.coverage.express}.options.sourceDirs, {gpii.testem.coverage.express}.options.contentDirs)",
            type:    "gpii.express.router.static",
            options: {
                path:    "@expand:gpii.testem.extractRoutePath({source})",
                content: "@expand:gpii.testem.extractContentPath({gpii.testem.coverage.express}.options.cwd, {source})",
                listeners: {
                    "onCreate.saySomething": {
                        funcName: "fluid.log",
                        args:     ["CONTENT ROUTER:", "{that}.options.path", " - ", "{that}.options.content"]
                    }
                }
            }
        }
    }
});
