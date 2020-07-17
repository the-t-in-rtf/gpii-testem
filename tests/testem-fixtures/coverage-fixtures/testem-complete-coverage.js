// A testem configuration file in which complete coverage is the expected result.
/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogging(true);
fluid.logObjectRenderChars = 200000;

fluid.require("%fluid-testem");

fluid.require("%fluid-express/tests/js/lib/diagramAllRoutes.js");

require("../../harness");

fluid.tests.testem.harness.diagramRoutes = function (that) {
    fluid.log(JSON.stringify(fluid.test.express.diagramAllRoutes(that), null, 2));
};

var testemComponent = fluid.tests.testem.harness({
    cwd:         __dirname, // required because we are working outside of our package root.
    testPages:   ["complete.html"],
    coveragePort: 7015,
    components: {
        express: {
            options: {
                listeners: {
                    "onCreate.diagramRoutes": {
                        funcName: "fluid.tests.testem.harness.diagramRoutes",
                        args:     ["{that}"]
                    }
                }
            }
        }
    }
});

module.exports = testemComponent.getTestemOptions();
