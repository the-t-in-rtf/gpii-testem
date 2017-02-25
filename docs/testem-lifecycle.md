# Testem Lifecycle

[Testem's configuration](https://github.com/testem/testem/blob/master/docs/config_file.md) supports four key lifecycle
events.  The `gpii.testem` component exposes these as standard [Infusion events](http://docs.fluidproject.org/infusion/development/InfusionEventSystem.html).

| Testem Event   | Component Event | Description (taken from [the manual](https://github.com/testem/testem/blob/master/docs/config_file.md)) |
| -------------- | --------------- | ---------------------- |
| `on_start`     | `onStart`       | Runs on suite startup. |
| `before_tests` | `beforeTests`   | Runs before every run of tests. |
| `after_tests`  | `afterTests`    | Runs after every run of tests. |
| `on_exit`      | `onExit`        | Runs before suite exits. |

Testem fires each of these events with the same three arguments, namely:

* `config`: The configuration options for testem itself.
* `data`: The data returned from the previous lifecycle steps, typically test results or errors.
* `callback`: A function your code is expected to call when it is safe for Testem to continue with the rest of the lifecycle.

Failure to call the callback may leave Testem in a state where your only option is to kill its process.  So, you must
ensure that, even in the event of an error, you always call the callback.

See below for an example.

```
var fluid = require("infusion");
fluid.require("gpii-testem");

var my = fluid.registerNamespace("my");

fluid.registerNamespace("my.testem.grade");
my.testem.grade.gotToBeStartingSomething = function (that, callback) {
    var promise = fluid.promise();
    promise.then(callback, callback);

    // Do something async, then continue processing either way...
    promise.resolve();
};

fluid.defaults("my.testem.grade", {
    gradeNames: ["gpii.testem"],
    testemOptions: {
        test_page: "tests/my-awesome-test.html"
    },
    listeners: {
        "onStart.log": {
            "funcName": "my.testem.grade.gotToBeStartingSomething",
            "args":     ["{that}", "{arguments}.0"]
        }
    }
});

module.exports = my.testem.grade().testemOptions;

```