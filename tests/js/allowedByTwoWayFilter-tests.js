/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var jqUnit = require("node-jqunit");

require("../..");

fluid.registerNamespace("gpii.tests.testem.allowedByTwoWayFilter");

gpii.tests.testem.allowedByTwoWayFilter.runAllTests = function (that) {
    jqUnit.module(that.options.moduleName);
    fluid.each(that.options.testDefs, gpii.tests.testem.allowedByTwoWayFilter.runSingleTest);
};

gpii.tests.testem.allowedByTwoWayFilter.runSingleTest = function (testDef) {
    jqUnit.test(testDef.name, function () {
        var output  = gpii.testem.instrumenter.allowedByTwoWayFilter(testDef.baseInputPath, testDef.filePath, testDef.positive, testDef.negative);
        jqUnit.assertEquals("The output should be as expected.", testDef.expected, output);
    });
};

fluid.defaults("gpii.tests.testem.allowedByTwoWayFilter.testRunner", {
    gradeNames: ["fluid.component"],
    testDefs: {
        directPositiveMatch: {
            name:          "A positive pattern that consists of a literal full path should match that path.",
            baseInputPath: "/",
            filePath:      "/foo.txt",
            positive:      ["foo.txt"],
            negative:      [],
            expected:      true
        },
        directPositiveNoMatch: {
            name:          "A positive pattern that consists of a literal full path should not match anything but the path.",
            baseInputPath: "/",
            filePath:      "/bar.txt",
            positive:      ["foo.txt"],
            negative:      [],
            expected:      false
        },
        globPositiveMatch: {
            name:          "A positive pattern with a glob should match nested content.",
            baseInputPath: "/",
            filePath:      "/nested/foo.txt",
            positive:      ["**/*.txt"],
            negative:      [],
            expected:      true
        },
        globPositiveNoMatch: {
            name:          "A positive pattern with a glob should not match material that doesn't match the pattern.",
            baseInputPath: "/",
            filePath:      "/nested/foo.js",
            positive:      ["**/*.txt"],
            negative:      [],
            expected:      false
        },
        negatedPositive: {
            name:          "A negated positive pattern should not match.",
            baseInputPath: "/",
            filePath:      "/bar.txt",
            positive:      ["**", "!bar.txt"],
            negative:      [],
            expected:      false
        },
        directNegativeMatch: {
            name:          "A negative pattern that consists of a literal full path should match that path.",
            baseInputPath: "/",
            filePath:      "/foo.txt",
            positive:      ["**/*"],
            negative:      ["foo.txt"],
            expected:      false
        },
        directNegativeNoMatch: {
            name:          "A negative pattern that consists of a literal full path should not match anything but the path.",
            baseInputPath: "/",
            filePath:      "/bar.txt",
            positive:      ["**/*"],
            negative:      ["foo.txt"],
            expected:      true
        },
        globNegativeMatch: {
            name:          "A negative pattern with a glob should match nested content.",
            baseInputPath: "/",
            filePath:      "/nested/foo.txt",
            positive:      ["**/*"],
            negative:      ["**/*.txt"],
            expected:      false
        },
        globNegativeNoMatch: {
            name:          "A negative pattern with a glob should not match material that doesn't match the pattern.",
            baseInputPath: "/",
            filePath:      "/nested/foo.js",
            positive:      ["**/*"],
            negative:      ["**/*.txt"],
            expected:      true
        },
        negatedNegative: {
            name:          "A negated negative pattern should work as expected.",
            baseInputPath: "/",
            filePath:      "/bar.js",
            positive:      ["**"],
            negative:      ["!*.js"],
            expected:      true
        }
    },
    listeners: {
        "onCreate.runTests": {
            funcName: "gpii.tests.testem.allowedByTwoWayFilter.runAllTests",
            args:     ["{that}"]
        }
    }
});

gpii.tests.testem.allowedByTwoWayFilter.testRunner();
