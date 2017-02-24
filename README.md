# `gpii.testem`

This library provides a [Fluid component](http://docs.fluidproject.org/infusion/development/UnderstandingInfusionComponents.html)
and static functions that assist in using [Testem](https://github.com/testem/testem).

# Key Features

1. Provides a mechanism to collect client-side code coverage data and combine that with browser coverage.
2. Provides the ability to launch and wait for server-side components to start up before each test run.
3. Provides the ability to safely shut down server-side test fixtures after each test run.
4. Provides cleanup mechanisms to remove temporary browser content after each test run.

# Requirements

In order to use the code coverage features of this grade, you'll need to have
[Istanbul](https://github.com/gotwarlost/istanbul) installed and available in your path.

# Usage instructions

To use this grade from Testem, you will need to make use of the
[dynamic configuration options available via the `testem.js` file](https://github.com/testem/testem/blob/master/examples/dynamic_config/testem.js).
The most basic example of a file might look something like:

```
var fluid = require("infusion");
fluid.require("%gpii-testem");

var my  = fluid.registerNamespace("my");
fluid.defaults("my.testem.grade", {
    gradeNames: ["gpii.testem"],
    testPages:  ["tests/my-awesome-test.html"]
});

module.exports = my.testem.grade().getTestemOptions();
```

To make use of the code coverage support provided by gpii.testem, you must be sure to load the "coverage sender" in
your HTML fixtures.

```
<script type="text/javascript" src="/coverage/coverageSender.js"></script>
```

This needs to be loaded after testem, but before your tests.  See [the coverage docs](docs/coverage.md) for details.

# More Information

For more information, check out the documentation links below:

* [The `gpii.testem` Component](docs/testem-component.md)
* [The Testem Lifecycle](docs/testem-lifecycle.md)
* [Code Coverage](docs/coverage.md)