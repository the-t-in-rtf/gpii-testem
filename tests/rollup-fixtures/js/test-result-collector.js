/* globals QUnit */
(function (QUnit, fluid) {
    "use strict";
    /*
        Wire ourselves into a QUnit composite run and stash any results observed to a global variable.  Note, this is
        only intended to be used with QUnit composite rollups.  You should not use it in your own tests.  Use the QUnit
        examples in the fluid-webdriver package instead.
     */
    QUnit.done(function (details) {
        fluid.set(window, "__testDetails", details);
    });
})(QUnit, fluid);
