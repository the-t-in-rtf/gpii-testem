/* eslint-env node */
"use strict";

// IoC tests must run first until this issue is resolved: https://issues.fluidproject.org/browse/FLUID-6397
require("./js/rollup-non-testem-tests");

// non-IoC tests
require("./js/instrumenter-tests");
require("./js/rollup-testem-tests");
require("./js/testem-component-unit-tests");
require("./js/testem-component-functional-tests");
