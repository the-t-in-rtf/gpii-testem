/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.tests.testem.instrumenter");

gpii.tests.testem.instrumenter.testDefs = {
    simple: {
        name:      "Test simple instrumentation and recursion.",
        inputPath: "%gpii-testem/tests/instrumentation-fixtures/simple",
        outputPath: {
            expander: {
                funcName: "path.resolve",
                args:     ["{that}.options.baseOutputDir", "simple"]
            }
        },
        shouldExist:          ["src/js/index.js", "src/js/nested/index.js"],
        shouldNotExist:       [],
        shouldBeInstrumented: ["src/js/index.js", "src/js/nested/index.js"]
    },
    withNodeModules: {
        name:      "Test content within a nested 'node_modules' directory.",
        inputPath: "%gpii-testem/tests/instrumentation-fixtures/with-node-modules",
        instrumentationOptions: {
            includes: ["./**/*"]
        },
        outputPath: {
            expander: {
                funcName: "path.resolve",
                args:     ["{that}.options.baseOutputDir", "with-node-modules"]
            }
        },
        shouldExist:             ["gpii/node_modules/sub-package/index.js"],
        shouldNotExist:          ["node_modules/dependency/index.js"],
        shouldBeInstrumented:    ["gpii/node_modules/sub-package/index.js"]
    },
    withNonJS: {
        name:      "Test inclusion of non javascript content.",
        inputPath: "%gpii-testem/tests/instrumentation-fixtures/with-non-js",
        instrumentationOptions: {
            includes: ["./src/**/*"]
        },
        outputPath: {
            expander: {
                funcName: "path.resolve",
                args:     ["{that}.options.baseOutputDir", "with-non-js"]
            }
        },
        shouldExist:             ["src/js/index.js", "src/json/sample.json", "src/text/sample.txt"],
        shouldNotExist:          [],
        shouldBeInstrumented:    ["src/js/index.js"],
        shouldNotBeInstrumented: ["src/json/sample.json", "src/text/sample.txt"]
    },
    withoutNonJS: {
        name:      "Test exclusion of non javascript content.",
        inputPath: "%gpii-testem/tests/instrumentation-fixtures/with-non-js",
        instrumentationOptions: {
            includes: ["./src/**/*.js"]
        },
        outputPath: {
            expander: {
                funcName: "path.resolve",
                args:     ["{that}.options.baseOutputDir", "without-non-js"]
            }
        },
        shouldExist:             ["src/js/index.js"],
        shouldNotExist:          ["src/json/sample.json", "src/text/sample.txt"],
        shouldBeInstrumented:    ["src/js/index.js"],
        shouldNotBeInstrumented: []
    }
};
