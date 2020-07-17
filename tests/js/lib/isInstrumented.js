/* eslint-env node */
"use strict";

var fluid = require("infusion");
var fs    = require("fs");

fluid.registerNamespace("fluid.test.testem");

/**
 *
 * Examine a file to confirm if it's instrumented. Checks for the existence of the standard coverage variable inserted
 * by Istanbul.
 *
 * @param {String} fullPath - The full path to the file to be evaluated.
 * @return {Boolean} - Returns `true` if the file is instrumented, and `false` otherwise.
 *
 */
fluid.test.testem.isInstrumented = function (fullPath) {
    var content = fs.readFileSync(fullPath, "utf8");
    return content.indexOf("__coverage__") !== -1;
};
