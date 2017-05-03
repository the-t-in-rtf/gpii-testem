/*

    Client side component to send coverage data after each page's test run.  Served up by the "coverage" engine
    wired into gpii.testem, by default this is available at:

    <script src="/coverage/client/coverageSender.js"></script>

    NOTE: This script requires Testem, and must be loaded after Testem loads, but before your tests start.

    Adapted from https://github.com/testem/testem/blob/master/examples/coverage_istanbul/tests.html#L11

    The harness included with this package will concatenate this with a bit of javascript that instantiates the
    sender with the right port information.  If you are using this script in another context, you will need to take
    care of that yourself.

 */
(function (fluid, $, Testem, QUnit) {
    "use strict";
    // Disabled as complex projects like "universal" managed to run their tests before QUnit was started, which resulted in errors.
    // QUnit.config.autostart = false;

    var gpii = fluid.registerNamespace("gpii");

    fluid.registerNamespace("gpii.testem.coverage.sender");

    gpii.testem.coverage.sender.wireTestem = function (that) {
        Testem.afterTests(that.sendCoverageData);
        // Disabled, see above.
        // QUnit.start();
    };

    gpii.testem.coverage.sender.sendCoverageData = function (that, config, data, callback) {
        if (window.__coverage__) {
            // TODO: Convert to using fluid.dataSource.AJAX once that's been reviewed.
            var payload = {
                document:  fluid.filterKeys(document, ["title", "URL"]),
                navigator: fluid.filterKeys(navigator, ["userAgent", "vendor", "vendorSub", "product", "productSub", "appCodeName", "appName"]),
                coverage:  window.__coverage__
            };
            var requestOptions = fluid.extend(that.options.ajaxOptions, {
                data: { payload: JSON.stringify(payload, null, 2)},
                complete: function () {
                    // Temporary delay to help us investigate disconnects when sending coverage data.
                    setTimeout(callback, 250);
                }
            });
            $.ajax(requestOptions);
        }
        else {
            fluid.log("No coverage data, firing test completion callback immediately...");
            callback();
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
        coveragePort: 7000,
        coverageUrl: {
            expander: {
                funcName: "fluid.stringTemplate",
                args:     ["http://localhost:%port/coverage", { port: "{that}.options.coveragePort"}]
            }
        },
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
})(fluid, jQuery, Testem, QUnit);
