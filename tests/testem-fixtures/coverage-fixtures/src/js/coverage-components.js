(function (fluid) {
    "use strict";
    var gpii = fluid.registerNamespace("gpii");
    fluid.registerNamespace("gpii.tests.testem.coverage");

    gpii.tests.testem.coverage.doIt = function (that, takeTheOneLessTraveledBy) {
        if (takeTheOneLessTraveledBy) {
            fluid.log("I shall say that made all the difference.");
        }
        else {
            fluid.log("Meh, they're really worn about the same.");
        }

        that.events.roadTaken.fire(takeTheOneLessTraveledBy);
    };

    fluid.defaults("gpii.tests.testem.coverage", {
        gradeNames: ["fluid.component"],
        events: {
            roadTaken: null
        },
        invokers: {
            doIt: {
                funcName: "gpii.tests.testem.coverage.doIt",
                args: ["{that}", "{arguments}.0"]
            }
        }
    });

    fluid.defaults("gpii.tests.testem.coverage.caseHolder.incomplete", {
        gradeNames: ["fluid.test.caseHolder"],
        modules: [{
            name: "Testing complete test coverage.",
            tests: [
                {
                    name: "Take one path...",
                    sequence: [
                        {
                            func: "{coverage}.doIt",
                            args: [false]
                        },
                        {
                            event: "{coverage}.events.roadTaken",
                            listener: "jqUnit.assertEquals",
                            args: ["The return value should be false..."]
                        }
                    ]
                }
            ]
        }]
    });

    fluid.defaults("gpii.tests.testem.coverage.environment.incomplete", {
        gradeNames: ["fluid.test.testEnvironment"],
        components: {
            caseHolder: {
                type: "gpii.tests.testem.coverage.caseHolder.incomplete"
            }
        }
    });

    fluid.defaults("gpii.tests.testem.coverage.caseHolder.complete", {
        gradeNames: ["fluid.test.caseHolder"],
        modules: [{
            name: "Testing complete test coverage.",
            tests: [
                {
                    name: "Take one path...",
                    sequence: [
                        {
                            func: "{coverage}.doIt",
                            args: [false]
                        },
                        {
                            event: "{coverage}.events.roadTaken",
                            listener: "jqUnit.assertEquals",
                            args: ["The return value should be false..."]
                        }
                    ]
                },
                {
                    name: "Take the other...",
                    sequence: [
                        {
                            func: "{coverage}.doIt",
                            args: [false]
                        },
                        {
                            event: "{coverage}.events.roadTaken",
                            listener: "jqUnit.assertEquals",
                            args: ["The return value should be false..."]
                        }
                    ]
                }
            ]
        }]
    });

    fluid.defaults("gpii.tests.testem.coverage.environment.complete", {
        gradeNames: ["fluid.test.testEnvironment"],
        components: {
            caseHolder: {
                type: "gpii.tests.testem.coverage.caseHolder.complete"
            }
        }
    });
})(fluid);
