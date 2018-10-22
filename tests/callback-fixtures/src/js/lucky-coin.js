(function (fluid) {
    "use strict";
    var my = fluid.registerNamespace("my");
    fluid.registerNamespace("my.lucky.coin");
    my.lucky.coin.announceResults = function (isHeads) {
        fluid.log(isHeads ? "HEADS!" : "TAILS.");
    };

    my.lucky.coin.isHeads = function () {
        return true;
    };

    my.lucky.coin.flip = function () {
        var isHeads = my.lucky.coin.isHeads();
        my.lucky.coin.announceResults(isHeads);
    };

    fluid.defaults("my.lucky.coin", {
        gradeNames: ["fluid.component"],
        invokers: {
            "flip": {
                funcName: "my.lucky.coin.flip",
                args: []
            }
        }
    });
})(fluid);
