// A testem configuration file in which complete coverage is the expected result.
/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);
fluid.logObjectRenderChars = 200000;

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-testem");

fluid.require("%gpii-express/tests/js/lib/diagramAllRoutes.js");

require("../../harness");

gpii.tests.testem.harness.diagramRoutes = function (that) {
    fluid.log(JSON.stringify(gpii.test.express.diagramAllRoutes(that), null, 2));
};

var testemComponent = gpii.tests.testem.harness({
    cwd:         __dirname, // required because we are working outside of our package root.
    testPages:   ["complete.html"],
    coveragePort: 7015,
    components: {
        express: {
            options: {
                listeners: {
                    "onCreate.diagramRoutes": {
                        funcName: "gpii.tests.testem.harness.diagramRoutes",
                        args:     ["{that}"]
                    }
                }
            }
        }
    }
});

module.exports = testemComponent.getTestemOptions();
