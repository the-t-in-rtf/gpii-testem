/* globals Testem, QUnit */
(function (fluid, QUnit, Testem) {
    "use strict";
    var gpii = fluid.registerNamespace("gpii");
    fluid.registerNamespace("gpii.testem");

    /**
     *
     * A static function to safely "roll up" multiple test fixtures using QUnit.composite so that they can be used
     * whether or not Testem itself is available.  The tested use case is loading locally hosted test fixtures
     * manually in a browser rather than via Testem.
     *
     * @param {Array<String>} rawTestSuitePaths - An array of "raw" paths (lacking either prefix).
     * @param {String} nonTestemPrefix - The prefix to prepend to all paths when Testem is not available.
     * @param {String} [testemPrefix] - The (optional) prefix to prepend to all paths when Testem is available.
     *
     */
    gpii.testem.safeRollup = function (rawTestSuitePaths, nonTestemPrefix, testemPrefix) {
        testemPrefix = testemPrefix || "";
        var prefix = Testem ? testemPrefix : nonTestemPrefix;
        var testSuitePaths = rawTestSuitePaths.map(function (entry) {
            return prefix + entry;
        });
        QUnit.testSuites(testSuitePaths);
    };
})(fluid, QUnit, typeof Testem !== "undefined" ? Testem : false);
