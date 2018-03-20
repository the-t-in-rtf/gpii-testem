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
/* globals Testem */
(function (Testem) {
    "use strict";
    // Pure JS equivalent of several fluid.registerNamespace calls.
    window.gpii = { testem: { coverage: {} } };

    // A work-alike pure JS implementation of the previous gpii.testem.coverage.sender grade.
    // NOTE: Only options.coveragePort is meaningful.
    window.gpii.testem.coverage.sender = function (options) {
        var afterTestsCallback = function (config, data, testemCallback) {
            if (window.__coverage__) {
                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function () {
                    if (this.readyState === 4) {
                        if (this.status === 200) {
                            console.log("Saved coverage data.");
                        }
                        else {
                            console.error("Error saving coverage data:", this.responseText);
                        }
                        testemCallback();
                    }
                };
                xhr.open("POST", "http://localhost:" + options.coveragePort + "/coverage");
                xhr.setRequestHeader("Content-type", "application/json");
                var wrappedPayload = {
                    payload: {
                        document: {
                            title: document.title,
                            URL: document.URL
                        },
                        navigator: {
                            appCodeName: navigator.appCodeName,
                            appName: navigator.appName,
                            product: navigator.product,
                            productSub: navigator.productSub,
                            userAgent: navigator.userAgent,
                            vendor: navigator.vendor,
                            vendorSub: navigator.vendorSub
                        },
                        coverage: window.__coverage__
                    }
                };
                xhr.send(JSON.stringify(wrappedPayload, null, 2));
            }
            else {
                fluid.log("No coverage data, firing Testem callback immediately...");
                testemCallback();
            }
        };
        Testem.afterTests(afterTestsCallback);
    };
})(Testem);
