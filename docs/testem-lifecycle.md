# Testem Lifecycle

[Testem's configuration](https://github.com/testem/testem/blob/master/docs/config_file.md) supports four key lifecycle
events, which are accessible via the advanced `options.testemOptions` block ([see the component docs for more details](testem-component.md)).

| Testem Event   | Description (taken from [the manual](https://github.com/testem/testem/blob/master/docs/config_file.md)) |
| -------------- | ------------------------------- |
| `on_start`     | Runs on suite startup.          |
| `before_tests` | Runs before every run of tests. |
| `after_tests`  | Runs after every run of tests.  |
| `on_exit`      | Runs before suite exits.        |

Testem fires each of these events with the same three arguments, namely:

* `config`: The configuration options for testem itself.
* `data`: The data returned from the previous lifecycle steps, typically test results or errors.
* `callback`: A function your code is expected to call when it is safe for Testem to continue with the rest of the lifecycle.

Failure to call the callback may leave Testem in a state where your only option is to kill its process.  So, you must
ensure that, even in the event of an error, you always call the callback.

See below for an example.

```javascript
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
        test_page: "tests/my-awesome-test.html",
        on_start:  "{that}.startSomething"
    },
    invokers: {
        "startSomething": {
            "funcName": "my.testem.grade.gotToBeStartingSomething",
            "args":     ["{that}", "{arguments}.0"]
        }
    }
});

module.exports = my.testem.grade().getTestemOptions();

```

Note that `gpii.testem` already makes use of the `on_start` and `on_exit` hooks.  If you simply want to start additional
fixtures, you can make use of the following pattern:

1. Create your fixtures on the 'constructFixtures' event.
2. If your fixture is not immediately ready, add your fixture's event to the definition of the `onFixturesConstructed` event.

The process for stopping your fixtures cleanly is similar.  Let's assumes that you have a `my.fixture.grade` component
you want to start, which fires `onMyReadyEvent` once its startup is complete.  Let's also assume that `my.fixture.grade`
needs to be given the chance to cleanup asynchronously on shutdown, by calling its `myStopInvoker` invoker and waiting
for its `onMyDoneEvent` event.  To wire such a fixture into your own derived grade, you might use code like the
following:

```javascript
fluid.defaults("my.testem.grade", {
    gradeNames: ["gpii.testem"],
    events: {
        onMyFixtureConstructed: null,
        onFixturesConstructed: {
            events: {
                onExpressStarted: "onExpressStarted",
                onMyFixtureConstructed: "onMyFixtureConstructed"
            }
        },
        onMyFixtureStopped: null,
        onFixturesStopped: {
            events: {
                onExpressStopped: "onExpressStopped",
                onMyFixtureStopped: "onMyFixtureStopped"
            }
        }
    },
    listeners: {
        "stopFixtures.stopMyFixture": {
            func: "{my.testem.grade}.myFixture.myStopInvoker"
        }
    },
    components: {
        myFixture: {
            type: "my.fixture.grade",
            createOnEvent: "constructFixtures",
            options: {
                listeners: {
                    "onMyReadyEvent.notifyParent": {
                        func: "{my.testem.grade}.events.onMyFixtureConstructed.fire"
                    },
                    "onMyDoneEvent.notifyParent": {
                        func: "{my.testem.grade}.events.onMyFixtureStopped.fire"
                    }
                }
            }
        }
    }
});
```

Note: In redefining `onFixturesConstructed` and `onFixturesStopped`, you should preserve the existing events, which can
be found in [the `gpii.testem` component's source](../src/js/testem-component.js).
