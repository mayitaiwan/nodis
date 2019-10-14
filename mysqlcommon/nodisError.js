//自定义异常
var util = require('util');

function NodisError(msg) {
    Error.call(this);
    this.message = msg;
}

util.inherits(NodisError, Error);
module.exports  = NodisError;