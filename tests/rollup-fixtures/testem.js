/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);
fluid.logObjectRenderChars = 200000;

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-testem");

var testemComponent = gpii.testem.base({
    cwd:         __dirname, // required because we are working outside of our package root.
    testPages:   ["rollup.html"],
    sourceDirs: {
        src: "%gpii-testem/src"
    },
    coverageDir: "%gpii-testem/coverage",
    contentDirs: {
        tests:        "%gpii-testem/tests",
        node_modules: "%gpii-testem/node_modules"
    },
    testemOptions: {
        skip: "Safari,PhantomJS"
    },
    coveragePort: 7017
});

module.exports = testemComponent.getTestemOptions();
