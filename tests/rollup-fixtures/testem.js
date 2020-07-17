/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);
fluid.logObjectRenderChars = 200000;

fluid.require("%fluid-testem");

var testemComponent = fluid.testem.instrumentation({
    cwd:         __dirname, // required because we are working outside of our package root.
    testPages:   ["rollup.html"],
    sourceDirs: {
        src: "%fluid-testem/src"
    },
    coverageDir: "%fluid-testem/coverage",
    contentDirs: {
        tests:        "%fluid-testem/tests",
        node_modules: "%fluid-testem/node_modules"
    },
    testemOptions: {
        skip: "Safari,PhantomJS"
    },
    coveragePort: 7017
});

module.exports = testemComponent.getTestemOptions();
