/*

    Unit tests for the timeout and event<->promise functions used in this package.

 */
/* eslint-env node */
"use strict";
var fluid  = require("infusion");
var gpii   = fluid.registerNamespace("gpii");
var jqUnit = require("node-jqunit");

fluid.require("%gpii-testem/src/js/testem-component.js");

fluid.defaults("gpii.tests.testem.eventTestingHarness", {
    gradeNames: ["fluid.component"],
    events: {
        myEvent: null
    },
    invokers: {
        getWrappedPromise: {
            funcName: "gpii.testem.generateSingleUseEventListener",
            args:     ["{that}", "{that}.events.myEvent"]
        }
    }
});

jqUnit.module("Testing event wrapper....");
jqUnit.test("A promise should resolve when the associated event is fired...", function () {
    jqUnit.expect(2);
    jqUnit.stop();
    var testComponent = gpii.tests.testem.eventTestingHarness();
    var eventPromise = testComponent.getWrappedPromise();
    eventPromise.then(
        function () {
            jqUnit.start();
            jqUnit.assert("The promise should have been resolved.");
        },
        function () {
            jqUnit.start();
            fluid.fail("The promise should not have been rejected.");
        }
    );

    testComponent.events.myEvent.fire();

    // Fire the event again to confirm that no attempt is made to resolve the promise again.
    testComponent.events.myEvent.fire();

    jqUnit.assert("It should be safe to fire the event again...");
});

jqUnit.test("The event listener should not throw an error if the promise is resolved elsewhere...", function () {
    jqUnit.expect(1);
    var testComponent = gpii.tests.testem.eventTestingHarness();
    var eventPromise = testComponent.getWrappedPromise();
    eventPromise.resolve();

    // Fire the event and confirm that no attempt is made to resolve the promise again.
    testComponent.events.myEvent.fire();

    jqUnit.assert("It should be safe to fire the event once the promise is resolved...");
});

jqUnit.test("The event listener should not throw an error if the promise is rejected elsewhere...", function () {
    jqUnit.expect(1);
    var testComponent = gpii.tests.testem.eventTestingHarness();
    var eventPromise = testComponent.getWrappedPromise();
    eventPromise.reject();

    // Fire the event and confirm that no attempt is made to resolve the promise again.
    testComponent.events.myEvent.fire();

    jqUnit.assert("It should be safe to fire the event once the promise is rejected...");
});


jqUnit.module("Testing promise timeout wrapper...");

jqUnit.test("A promise should resolve after the a timeout if it is not rejected/resolve externally...", function () {
    jqUnit.expect(1);

    jqUnit.stop();
    var timeoutPromise = gpii.testem.addPromiseTimeout(fluid.promise(), "Timed out as expected...", 250);

    timeoutPromise.then(
        function () {
            jqUnit.start();
            jqUnit.assert("The wrapped promise should be resolved after the timeout...");
        },
        function () {
            jqUnit.start();
            fluid.fail("The wrapped promise should not have been rejected...");
        }
    );
});

jqUnit.test("The timeout should be cleared if the promise is resolved externally...", function () {
    jqUnit.expect(1);

    var originalPromise = fluid.promise();

    jqUnit.stop();
    gpii.testem.addPromiseTimeout(originalPromise, "Timed out as expected...", 250);
    originalPromise.then(
        function () {
            jqUnit.start();
            jqUnit.assert("The promise should have been resolved...");
        },
        function () {
            jqUnit.start();
            fluid.fail("The promise should not be rejected.");
        }
    );
    originalPromise.resolve();

    // Wait longer than the timeout to confirm that a post-resolution rejection is not attempted.
    jqUnit.stop();
    setTimeout(jqUnit.start, 300);
});

jqUnit.test("The timeout should be cleared if the promise is rejected externally...", function () {
    jqUnit.expect(1);

    var originalPromise = fluid.promise();

    jqUnit.stop();
    gpii.testem.addPromiseTimeout(originalPromise, "Timed out as expected...", 250);
    originalPromise.then(
        function () {
            jqUnit.start();
            fluid.fail("The promise should not be resolved.");
        },
        function (error) {
            jqUnit.start();
            jqUnit.assertEquals("The promise should have been rejected without a timeout...", "Not a timeout.", error);
        }
    );
    originalPromise.reject("Not a timeout.");

    // Wait longer than the timeout to confirm that a second rejection is not attempted.
    jqUnit.stop();
    setTimeout(jqUnit.start, 300);
});

jqUnit.test("Adding a timeout to a resolved promise should be fine...", function () {
    jqUnit.expect(1);

    var originalPromise = fluid.promise();
    originalPromise.resolve();

    gpii.testem.addPromiseTimeout(originalPromise, "We should not reject with a time out...", 250);

    // Wait longer than the timeout to confirm that a second rejection is not attempted.
    jqUnit.stop();
    setTimeout(function () {
        jqUnit.start();
        jqUnit.assert("There should be no errors...");
    }, 300);
});
