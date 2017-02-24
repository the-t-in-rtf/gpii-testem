(function (fluid) {
    "use strict";

    fluid.defaults("gpii.tests.testem.coverage.caseHolder.incomplete", {
        gradeNames: ["fluid.test.testCaseHolder"],
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
        }],
        components: {
            coverage: {
                type: "gpii.tests.testem.coverage"
            }
        }
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
        gradeNames: ["fluid.test.testCaseHolder"],
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
                            event:    "{coverage}.events.roadTaken",
                            listener: "jqUnit.assertFalse",
                            args:     ["The return value should be false...", "{arguments}.0"]
                        }
                    ]
                },
                {
                    name: "Take the other...",
                    sequence: [
                        {
                            func: "{coverage}.doIt",
                            args: [true]
                        },
                        {
                            event:    "{coverage}.events.roadTaken",
                            listener: "jqUnit.assertTrue",
                            args:     ["The return value should be true...", "{arguments}.0"]
                        }
                    ]
                }
            ]
        }],
        components: {
            coverage: {
                type: "gpii.tests.testem.coverage"
            }
        }
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
