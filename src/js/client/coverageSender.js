/*

    Client side component to send coverage data after each page's test run.  Served up by the "coverage" engine
    wired into gpii.testem, by default this is available at:

    <script src="/coverage/client/coverageSender.js"></script>

    NOTE: This script requires Testem, and must be loaded after Testem loads, but before your tests start.

    Adapted from https://github.com/testem/testem/blob/master/examples/coverage_istanbul/tests.html#L11

 */
/* globals Testem */
(function (fluid, $, Testem) {
    "use strict";
    var gpii = fluid.registerNamespace("gpii");

    fluid.registerNamespace("gpii.testem.coverage.sender");

    gpii.testem.coverage.sender.wireTestem = function (that) {
        Testem.afterTests(that.sendCoverageData);
    };

    gpii.testem.coverage.sender.sendCoverageData = function (that, config, data, callback) {
        if (window.__coverage__) {
            // TODO: Convert to using fluid.dataSource.AJAX once that's been reviewed.
            var requestOptions = fluid.extend(that.options.ajaxOptions, { data: { coverage: JSON.stringify(window.__coverage__, null, 2)}, complete: callback});
            $.ajax(requestOptions);
        }
    };

    gpii.testem.coverage.sender.handleSuccess = function (that, data, textStatus, jqXHR) {
        if (jqXHR.status === 200) {
            fluid.log("Successfully saved coverage results...");
        }
        else {
            fluid.log("Coverage results save returned status code:", jqXHR.status);
        }
    };

    gpii.testem.coverage.sender.handleError = function (that, jqXHR, textStatus, errorThrown) {
        fluid.log("Error saving test coverage:", errorThrown);
    };

    fluid.defaults("gpii.testem.coverage.sender", {
        gradeNames: ["fluid.component"],
        ajaxOptions: {
            method:      "POST",
            url:         "{that}.options.coverageUrl"
        },
        coverageUrl: "/coverage",
        listeners: {
            "onCreate.wireTestem": {
                funcName: "gpii.testem.coverage.sender.wireTestem",
                args:     ["{that}"]
            }
        },
        invokers: {
            "sendCoverageData": {
                funcName: "gpii.testem.coverage.sender.sendCoverageData",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // config, data, callback
            },
            "handleSuccess": {
                funcName: "gpii.testem.coverage.sender.handleSuccess",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // data, textStatus, jqXHR
            },
            "handleError": {
                funcName: "gpii.testem.coverage.sender.handleError",
                args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // jqXHR, textStatus, errorThrown
            }
        }
    });

    gpii.testem.coverage.sender();
})(fluid, jQuery, Testem);