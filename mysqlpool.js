var mysqltools = require('./mysqlcommon/mysqltools');
// mysqltools.query("mytest.selectUserById1", {"id": "id", "name": "name", "list": [1, 2]}, function (err,rows) {
//     console.log(rows);
// });
// mysqltools.insertAndreturnId("mytest.selectUserById", { "name": "22","birthday":new Date()}, function (err,data) {
//     //console.log(rows.insertId);
//     console.log(data);
// });
// mysqltools.query("mytest.selectUserById1", {"id":"id", "name": "name","list":[1,2,3,4]}, function (data) {
//     //console.log(rows.insertId);
//     console.log(data);
// });
// mysqltools.update("mytest.updateuser", {"id":"1", "name": "name1333"}, function (err,data) {
//     //console.log(rows.insertId);
//     console.log(data);
// });
// mysqltools.query("mytest.callprocedure", {"id":"2"}, function (err,data) {
//     //console.log(rows.insertId);
//     console.log(data);
// });
mysqltools.query("mytest.queryuserandclass", function (err,data) {
    //console.log(rows.insertId);
    console.log(data);
});


// mysqltools.deleteData("mytest.deleteuser", {"id":"1"}, function (err,data) {
//     //console.log(rows.insertId);
//     console.log(data);
// });


// setTimeout(function () {
//     mysqltools.query("mytest.selectUserById1", {"id": "1", "name": "\"name\"", "list": ['1', '2']}, function (rows) {
//         console.log(rows);
//     });
// }, 1000);