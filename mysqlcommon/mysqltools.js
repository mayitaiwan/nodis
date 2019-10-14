var mysql = require('mysql');
var xmlhandler = require('./xmlhandler');
var NodisError = require('./nodisError');
var pool = mysql.createPool({
    connectionLimit: 10,
    "host": "localhost",
    "user": "root",
    "password": "zyg_001",
    "database": "nodejs"
});
var mysqltools = {
    query: function (sqlid, param, callback) {
        if (!sqlid) {
            throw new NodisError('sqid can\'t be null');
        }
        if (!callback) {
            if (param) {
                callback = param;
                param = null;
            }else{
                throw new NodisError('callback can\'t be null');
            }
        }
        pool.getConnection(function (err, connection) {
            connection.query(xmlhandler.getSqlbyId(sqlid, param), function (err, rows) {
                    callback(err,rows);
            });
            connection.release();
        });
    },
    insertAndreturnId: function (sqlid, param, callback) {
        if (!sqlid) {
            throw new NodisError('sqid can\'t be null');
        }
        if (!param) {
            throw new NodisError('param can\'t be null');
        }
        if (!callback) {
            throw new NodisError('callback can\'t be null');
        }
        pool.getConnection(function (err, connection) {
            connection.query(xmlhandler.getSqlbyId(sqlid, param), function (err, rows) {
                callback(err,rows);
            });
            connection.release();
        });
    },
    insertWithoutId: function (sqlid, param, callback) {
        if (!sqlid) {
            throw new NodisError('sqid can\'t be null');
        }
        if (!param) {
            throw new NodisError('param can\'t be null');
        }
        if (!callback) {
            throw new NodisError('callback can\'t be null');
        }
        pool.getConnection(function (err, connection) {
            connection.query(xmlhandler.getSqlbyId(sqlid, param), function (err, rows) {
                callback(err,rows.affectedRows);

            });
            connection.release();
        });
    },
    update: function (sqlid, param, callback) {
        if (!sqlid) {
            throw new NodisError('sqid can\'t be null');
        }
        if (!callback) {
            if (param) {
                callback = param;
                param = null;
            }else{
                throw new NodisError('callback can\'t be null');
            }
        }
        pool.getConnection(function (err, connection) {
            connection.query(xmlhandler.getSqlbyId(sqlid, param), function (err, rows) {
                callback(err,rows.affectedRows);
            });
            connection.release();
        });
    },
    delete: function (sqlid, param, callback) {
        if (!sqlid) {
            throw new NodisError('sqid can\'t be null');
        }
        if (!callback) {
            if (param) {
                callback = param;
                param = null;
            }else{
                throw new NodisError('callback can\'t be null');
            }
        }
        pool.getConnection(function (err, connection) {
            connection.query(xmlhandler.getSqlbyId(sqlid, param), function (err, rows) {
                callback(err,rows.affectedRows);
            });
            connection.release();
        });
    }
};

module.exports = mysqltools;

// pool.end(function (err) {
//     // all connections in the pool have ended
//     console.log( "pool end");
// });

