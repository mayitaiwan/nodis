var mysql =  require('mysql');
var connection =  mysql.createConnection({
    "host":"localhost",
    "user" : "root",
    "password": "zyg_001",
    "database":"nodejs"
});
connection.connect();

//connection.query("use nodejs");
var strQuery="select * from t_user";

connection.query( strQuery, function(err, rows){
    if(err)	{
        throw err;
    }else{
        console.log( rows );
    }
});

connection.end(function(err){
// Do something after the connection is gracefully terminated.
    console.log("end");
});
 

//connection.destroy( );