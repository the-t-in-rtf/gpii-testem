/* eslint-env node */
"use strict";
var fluid  = require("infusion");
var jqUnit = require("node-jqunit");
var exec   = require("child_process").exec;

require("../../");

jqUnit.asyncTest("Testing 'safe rollup' with Testem.", function () {
    var command = "node node_modules/testem/testem.js ci --file tests/rollup-fixtures/testem.js";

    exec(command, {cwd: fluid.module.resolvePath("%fluid-testem") }, function (error, stdout, stderr) {
        jqUnit.start();

        jqUnit.assertEquals("There should be no errors.", null, error);

        jqUnit.assertTrue("Standard error should be empty.", stderr.length === 0);

        var expectedPatterns = [
            /ok [0-9]+ .+ - Composition #1: \/tests\/rollup-fixtures\/test1.html/,
            /ok [0-9]+ .+ - Composition #1: \/tests\/rollup-fixtures\/test2.html/,
            /ok [0-9]+ .+ - Composition #2: \/tests\/rollup-fixtures\/test3.html/,
            /ok [0-9]+ .+ - Composition #2: \/tests\/rollup-fixtures\/test4.html/
        ];
        fluid.each(expectedPatterns, function (pattern) {
            jqUnit.assertTrue("We should see successful results for all child test fixtures.", stdout.match(pattern));
        });
    });
});
