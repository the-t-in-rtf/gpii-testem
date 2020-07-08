/*

    An instance of fluid.express that:

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

require("fluid-express");

require("./coverageClientMiddleware");
require("./coverageReceiverMiddleware");
require("./lib/pathUtils");

fluid.require("%fluid-testem");

fluid.defaults("fluid.testem.coverage.router", {
    gradeNames: ["fluid.express.router"],
    path: "/coverage",
    coveragePort: 7003,
    components: {
        // Allow content hosted (by proxy or otherwise) within Testem to communicate with us on our own port.
        corsHeaders: {
            type: "fluid.express.middleware.headerSetter",
            options: {
                priority: "first",
                headers: {
                    allowOrigin: {
                        fieldName: "Access-Control-Allow-Origin",
                        template:  "*",
                        dataRules: {}
                    },
                    allowHeaders: {
                        fieldName: "Access-Control-Allow-Headers",
                        template: "Content-Type",
                        dataRules: {}
                    }
                }
            }
        },
        // Serve up the required coverage browser client that transmits results to `coverageCatcher` below.
        client: {
            type: "fluid.testem.middleware.coverageClient",
            options: {
                coveragePort: "{fluid.testem.coverage.router}.options.coveragePort"
            }
        },
        json: {
            type: "fluid.express.middleware.bodyparser.json",
            options: {
                priority: "after:client",
                middlewareOptions: {
                    limit: 12500000 // Allow coverage payloads of up to 100Mb instead of the default 100Kb
                }
            }
        },
        urlencoded: {
            type: "fluid.express.middleware.bodyparser.urlencoded",
            options: {
                priority: "after:json",
                middlewareOptions: {
                    limit: 12500000 // Allow coverage payloads of up to 100Mb instead of the default 100Kb
                }
            }
        },
        coverageReceiver: {
            type: "fluid.testem.coverage.receiver.middleware",
            options: {
                priority:     "after:urlencoded",
                coveragePort: "{fluid.testem.coverage.router}.options.coveragePort"
            }
        }
    }
});

fluid.registerNamespace("fluid.testem.coverage.express");

/**
 *
 * Generate a definition that can be used to instantiate a piece of middleware to host each source and content
 * directory.
 *
 * @param {Object} sourceDirs - A map of source directories to host.
 * @param {Object} contentDirs - A map of content directories to host.
 * @return {Array} - A copy of `contentDirs`, ordered by namespaced priorities.
 *
 */
fluid.testem.coverage.express.generateRouterSources = function (sourceDirs, contentDirs) {
    var combinedDefs = fluid.merge({}, sourceDirs, contentDirs);
    var expandedDefs = fluid.transform(combinedDefs, fluid.testem.expandPath);
    var orderedCombinedDirs = fluid.parsePriorityRecords(expandedDefs, "fluid-testem-router-content");
    return orderedCombinedDirs;
};

fluid.defaults("fluid.testem.coverage.express", {
    gradeNames:  ["fluid.express"],
    sourceDirs:  {},
    contentDirs: {},
    components: {
        coverageRouter: {
            type: "fluid.testem.coverage.router",
            options: {
                coveragePort: "{fluid.testem.coverage.express}.options.port"
            }
        }
    },
    dynamicComponents: {
        contentRouter: {
            sources: "@expand:fluid.testem.coverage.express.generateRouterSources({fluid.testem.coverage.express}.options.sourceDirs, {fluid.testem.coverage.express}.options.contentDirs)",
            type:    "fluid.express.router.static",
            options: {
                path:    "@expand:fluid.testem.extractRoutePath({source})",
                content: "@expand:fluid.testem.extractContentPath({fluid.testem.coverage.express}.options.cwd, {source})",
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
