/*
事务
数据类型的问题
权限管理
* */
var fs = require('fs');
var xml2js = require('../xml2js/xml2js');
var NodisError = require('./nodisError');
var parser = new xml2js.Parser();
//sql的集合变量
var sql = {};


Date.prototype.format = function (fmt) { //author: meizz
    var o = {
        "M+": this.getMonth() + 1,                 //月份
        "d+": this.getDate(),                    //日
        "h+": this.getHours(),                   //小时
        "m+": this.getMinutes(),                 //分
        "s+": this.getSeconds(),                 //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds()             //毫秒
    };
    if (/(y+)/.test(fmt))
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt))
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
};
//var time1 = new Date().format("yyyy-MM-dd hh:mm:ss");

var path = require('path');

//找到模块所在位置上级目录
var updirect = path.resolve(__dirname, '..');
//配置文件
var conffile = updirect + "/nodisconf.json";
//读取全局配置文件
var config = require(conffile);
//读取配置文件目录，也就是sql语句的xml文件所在目录
var configpath = updirect + "/" + config.configpath;
//是否开启namespace
var namespaceflag = config.namespace;
//是否打印sql语句
var printsqlflag = config.printsql;
//读取配置xml文件目录
fs.readdir(configpath, function (err, files) {
    if (err) {
        console.log(error);
    } else {
        var index = 0;
        var len = files.length;
        //解析期间的错误数组
        var parseErr = [];
        //文件是异步读取，读取一次加一
        var executeread = 0;
        while (index < len) {
            (function getFile(index) {
                //xml配置文件的名字
                var filename = files[index];
                var fileLen = filename.length;
                //不以.xml结尾的文件直接return
                if (fileLen < 4) {
                    return;
                }
                var xmlsuffix = filename.substring(filename.length - 4);

                if (xmlsuffix != '.xml') {
                    return;
                }
                //同步读取配置xml文件
                var data = fs.readFileSync(configpath + "/" + filename);
                parser.parseString(data, function (err, result) {
                    var namespace = null;
                    //全局配置文件配置了namespace为true
                    if (namespaceflag) {
                        if (result['mapper']["$"]) {
                            namespace = result['mapper']["$"]["namespace"];
                        }
                        //xml配置文件没有配置namespace
                        if (!namespace) {
                            parseErr.push(new NodisError('namespace can\'t be null  in file ' + filename));
                        }
                    }
                    //query标签数组
                    var query = result['mapper']["$children"];
                    var qlen = query.length;
                    if (qlen == 0) {
                        parseErr.push(new NodisError('query tag can\'t be null  in file ' + filename));
                    }
                    //query标签的id
                    var id = null;
                    var mixedSqlNode = null;

                    for (var i = 0; i < qlen; i++) {
                        id = null;
                        //id不能为空
                        if (query[i]["$"]) {
                            id = query[i]["$"]["id"];
                        }
                        if (!id) {
                            parseErr.push(new NodisError('sql id can\'t be null  in file ' + filename));
                            continue;
                        }
                        //namespace直接为前缀
                        if (namespace) {
                            id = namespace + "." + id;
                        }
                        //sql id重复
                        if (sql[id]) {
                            parseErr.push(new NodisError('sql id: ' + id + ' can\'t be repeated in file ' + filename));
                        }
                        try {
                            //解析节点
                            var subElements = [];
                            var children = query[i]["$children"];
                            var clen = children.length;
                            var child = null;
                            var sqlNode = null;
                            for (var j = 0; j < clen; j++) {
                                child = children[j];
                                //递归处理子节点
                                sqlNode = parseQueryNode(child, filename, id);
                                subElements.push(sqlNode);
                            }
                            mixedSqlNode = new MixedSqlNode(subElements);
                        } catch (e) {
                            parseErr.push(e);
                        }
                        sql[id] = mixedSqlNode;
                    }
                    executeread++;
                    if (executeread == len) {
                        //解析到最后一个文件，将所有错误一次爆出
                        var errl = parseErr.length;
                        if (errl > 0) {
                            var errmessage = "";
                            for (var erri = 0; erri < errl; erri++) {
                                errmessage += parseErr[erri].message + "\r\n";
                            }
                            throw new NodisError(errmessage);
                        }
                    }

                });
            })(index);
            index++;
        }
    }
});
//各个标签的解析方法
var nodeHandlerMap = {
    'if': handlerIfSqlNode,
    'when': handlerIfSqlNode,
    'choose': handlerChooseSqlNode,
    'otherwise': handlerOtherwiseSqlNode,
    'foreach': handlerForeachSqlNode,
    'where': handlerWhereSqlNode,
    'set': handlerSetSqlNode
};
//处理set标签
//queryElement为set节点
function handlerSetSqlNode(queryElement, filename, sqlid) {
    var property = queryElement["$"];
    var children = queryElement["$children"];
    var clen = children.length;
    var child = null;
    var sqlNode = null;
    var subElements = [];
    for (var i = 0; i < clen; i++) {
        child = children[i];
        //递归处理子节点
        sqlNode = parseQueryNode(child, filename, sqlid);
        subElements.push(sqlNode);
    }
    var mixedSqlNode = new MixedSqlNode(subElements);
    //生成set节点对象
    return new SetSqlNode(property, mixedSqlNode, filename, sqlid);
}

//解析节点,queryElement节点，filename是文件名,sqlid是query标签的id
function parseQueryNode(queryElement, filename, sqlid) {
    var tagname = queryElement["$tagname"];
    if (tagname == "-") {
        var sqlText = queryElement["text"];
        //替换回车换行
        var rnRegExp = new RegExp("\\r\\n", 'g');
        var resultsql = sqlText.replace(rnRegExp, " ").trim();
        //文本节点对象
        return new StaticTextSqlNode(resultsql);
        //return new MixedSqlNode(subElements);
    } else if (nodeHandlerMap[tagname]) {
        //解析标签
        return nodeHandlerMap[tagname](queryElement, filename, sqlid);
    } else if (tagname != "$") {
        //非法标签
        throw new NodisError('illegal tag:  ' + p + " in file " + filename);
    }
}

//混合节点，每个节点都有子节点列表，如果没有自定义
//标签，则有一个文本子节点，节点的sql就是各个子节点
//生成的sql串起来
//参数contents就是子节点列表
function MixedSqlNode(contents) {
    this.contents = contents;
    //根据子节点列表，生成sql
    this.addsql = function (sqlcontext) {
        var result = false;
        for (var i = 0; this.contents[i]; i++) {
            var tempresult = this.contents[i].addsql(sqlcontext);
            if (tempresult) {
                result = true;
            }
        }
        return result;
    };
    this.getContents = function () {
        return this.contents;
    }
}

//文本节点，textsql文本，就是写的sql语句，
//filename该节点所在文件的名字
function StaticTextSqlNode(textsql, filename) {
    this.textsql = textsql;
    this.filename = filename;
}

StaticTextSqlNode.prototype = {
    //文本节点，生成sql语句的方法
    //sql语句要根据参数来动态生成
    addsql: function (sqlcontext) {
        var param = sqlcontext.getParam();
        var replacedSql = this.textsql;
        //根据参数替换
        if (param) {
            replacedSql = replaceParamSql(this.textsql, param);
        }
        //生成的sql语句放在sqlcontext中，然后在调用方取出
        sqlcontext.addsql(replacedSql);
        return true;
    }
};

//生成sql语句用的对象，param为传入的参数
function SqlContext(param) {
    this.param = param;
    this.finalsql = '';
    this.addsql = function (sql) {
        this.finalsql += " " + sql;
    };
    this.getsql = function () {
        return this.finalsql;
    };
    this.getParam = function () {
        return this.param;
    };
}

//处理choose标签
//queryElement为choose节点
function handlerChooseSqlNode(queryElement, filename, sqlid) {
    var property = queryElement["$"];
    var children = queryElement["$children"];
    var clen = children.length;
    var child = null;
    var sqlNode = null;

    var subElements = [];
    for (var i = 0; i < clen; i++) {
        child = children[i];
        //递归处理子节点
        sqlNode = parseQueryNode(child, filename, sqlid);
        subElements.push(sqlNode);
    }
    var mixedSqlNode = new MixedSqlNode(subElements);
    //生成choose节点对象
    return new ChooseSqlNode(property, mixedSqlNode, filename, sqlid);
}

//处理otherwise标签
//queryElement为otherwise节点
function handlerOtherwiseSqlNode(queryElement, filename, sqlid) {
    var property = queryElement["$"];
    var children = queryElement["$children"];
    var clen = children.length;
    var child = null;
    var sqlNode = null;
    var subElements = [];
    for (var i = 0; i < clen; i++) {
        child = children[i];
        //递归处理子节点
        sqlNode = parseQueryNode(child, filename, sqlid);
        subElements.push(sqlNode);
    }
    var mixedSqlNode = new MixedSqlNode(subElements);
    //生成otherwise节点对象
    return new OtherwiseSqlNode(property, mixedSqlNode, filename, sqlid);
}

//处理foreach标签
//queryElement为foreach节点的
function handlerForeachSqlNode(queryElement, filename, sqlid) {
    var property = queryElement["$"];

    var children = queryElement["$children"];
    var clen = children.length;
    var child = null;
    var sqlNode = null;


    var subElements = [];
    if (!property) {
        throw new NodisError('property of tag foreach on sql id: ' + sqlid + ' in file ' + filename + ' can\'t be null ');
    } else {
        var errormessage = "";
        if (!property.item) {
            errormessage += "item";
        }
        if (!property.collection) {
            errormessage += " collection";
        }
        if (!property.open) {
            errormessage += " open";
        }
        if (!property.separator) {
            errormessage += " separator";
        }
        if (!property.close) {
            errormessage += " close";
        }
        if (errormessage) {
            throw new NodisError('property ' + errormessage + ' of tag foreach on sql id: ' + sqlid + ' in file ' + filename + ' can\'t be null ');
        }
    }
    for (var i = 0; i < clen; i++) {
        child = children[i];
        //递归处理子节点
        sqlNode = parseQueryNode(child, filename, sqlid);
        subElements.push(sqlNode);
    }
    var mixedSqlNode = new MixedSqlNode(subElements);
    //生成foreach节点对象
    return new ForeachSqlNode(property, mixedSqlNode, filename, sqlid);
}

//处理if标签
//queryElement为if节点
function handlerIfSqlNode(queryElement, filename, sqlid) {
    var property = queryElement["$"];
    var children = queryElement["$children"];
    var clen = children.length;
    var child = null;
    var sqlNode = null;
    var subElements = [];
    if (!property) {
        throw new NodisError('property \'test\' on sql id: ' + sqlid + ' in file ' + filename + ' can\'t be null ');
    }
    for (var i = 0; i < clen; i++) {
        child = children[i];
        //递归处理子节点
        sqlNode = parseQueryNode(child, filename, sqlid);
        subElements.push(sqlNode);
    }
    var mixedSqlNode = new MixedSqlNode(subElements);
    //生成if节点对象
    return new IfSqlNode(property, mixedSqlNode, filename, sqlid);
}

//处理where标签
//queryElement为where节点
function handlerWhereSqlNode(queryElement, filename, sqlid) {
    var property = queryElement["$"];
    var children = queryElement["$children"];
    var clen = children.length;
    var child = null;
    var sqlNode = null;
    var subElements = [];
    for (var i = 0; i < clen; i++) {
        child = children[i];
        //递归处理子节点
        sqlNode = parseQueryNode(child, filename, sqlid);
        subElements.push(sqlNode);
    }
    var mixedSqlNode = new MixedSqlNode(subElements);
    //生成where节点对象
    return new WhereSqlNode(property, mixedSqlNode, filename, sqlid);
}


//此方法去掉以and  or  ， 这些符号开头的字符，
//在where，set标签中使用
function trimPrefix(sqltext, prefix) {
    var i = 0;
    while (prefix[i]) {
        var prefixIndex = sqltext.toLowerCase().indexOf(prefix[i]);
        if (prefixIndex >= 0) {
            var preStr = sqltext.substr(0, prefixIndex);
            if (preStr.trim() == '') {
                sqltext = sqltext.substr(prefixIndex + prefix[i].length);
            }
        }
        i++;
    }
    return sqltext;
}

//此方法去掉以and  or  ， 这些符号结尾的字符，
//在where，set标签中使用
function trimSuffix(sqltext, suffix) {
    var i = 0;
    while (suffix[i]) {
        sqltext = sqltext.trimRight();
        var endsql = sqltext.substring(sqltext.length - suffix[i].length);
        if (endsql == suffix[i]) {
            sqltext = sqltext.substr(0, sqltext.length - suffix[i].length);
        }
        i++;
    }
    return sqltext;
}

function trimAll(sqltext, prefix, suffix) {
    var tempResult = trimPrefix(sqltext, prefix);
    return trimSuffix(tempResult, suffix);
}

//where节点对象
function WhereSqlNode(property, mixedSqlNode, filename, sqlid) {
    this.property = property;
    this.mixedSqlNode = mixedSqlNode;
    this.filename = filename;
    this.sqlid = sqlid;
}

WhereSqlNode.prototype = {
    //根据参数生成sql
    addsql: function (sqlcontext) {
        //生成一个临时的参数对象
        var deleSqlContext = new SqlContext(sqlcontext.getParam());
        //生成临时sql数据
        var result = this.mixedSqlNode.addsql(deleSqlContext);
        if (result) {
            var deleSql = deleSqlContext.getsql();
            var fixs = ["and", "or"];
            //去掉以and，or开头或者结尾的字符串
            deleSql = trimAll(deleSql, fixs, fixs);
            sqlcontext.addsql("where " + deleSql);
            return true;
        } else {
            return false;
        }

    }
};

//set节点对象
function SetSqlNode(property, mixedSqlNode, filename, sqlid) {
    this.property = property;
    this.mixedSqlNode = mixedSqlNode;
    this.filename = filename;
    this.sqlid = sqlid;
}

SetSqlNode.prototype = {
    //根据参数生成sql
    addsql: function (sqlcontext) {
        //生成一个临时的参数对象
        var deleSqlContext = new SqlContext(sqlcontext.getParam());
        //生成临时sql数据
        var result = this.mixedSqlNode.addsql(deleSqlContext);
        if (result) {
            var deleSql = deleSqlContext.getsql();
            var fixs = [","];
            //去掉以,开头或者结尾的字符串
            deleSql = trimAll(deleSql, fixs, fixs);
            sqlcontext.addsql("set " + deleSql);
            return true;
        } else {
            return false;
        }
    }
};

//if节点对象
function IfSqlNode(property, mixedSqlNode, filename, sqlid) {
    this.property = property;
    this.mixedSqlNode = mixedSqlNode;
    this.filename = filename;
    this.sqlid = sqlid;
}

IfSqlNode.prototype = {
    //根据参数生成sql
    addsql: function (sqlcontext) {
        //test的内容以js的形式进行处理，所以要替换and和or
        var test = this.property["test"];
        var andRegExp = new RegExp(" and ", 'g');
        var orRegExp = new RegExp(" or ", 'g');
        test = test.replace(andRegExp, " && ");
        test = test.replace(orRegExp, " || ");
        var param = sqlcontext.getParam();
        var evaltext = "";
        if (param) {
            //替换参数对象
            test = replaceParamSql(test, param);
        }
        evaltext += "var testResult=(" + test + ");";
        // console.log(evaltext)
        try {
            //执行test，并存放结果在testResult变量中
            eval(evaltext);
            //如果结果为true则执行其子节点的添加sql的逻辑
            if (testResult) {
                this.mixedSqlNode.addsql(sqlcontext);
                return true;
            }
        } catch (err) {
            throw new NodisError('test expression error: ' + evaltext + " sqlid " + this.sqlid + " in file " + this.filename);
        }
        return false;
    }
};

//choose节点对象
function ChooseSqlNode(property, mixedSqlNode, filename, sqlid) {
    this.property = property;
    this.mixedSqlNode = mixedSqlNode;
    this.filename = filename;
    this.sqlid = sqlid;
}

ChooseSqlNode.prototype = {
    //根据参数生成sql
    addsql: function (sqlcontext) {
        var contents = this.mixedSqlNode.getContents();
        //遍历子节点列表，添加sql，如果有一个成功，则返回true
        //否则返回false
        for (var i = 0; contents[i]; i++) {
            var tempresult = contents[i].addsql(sqlcontext);
            if (tempresult) {
                return true;
            }
        }
        return false;
    }
};

//otherwise节点对象
function OtherwiseSqlNode(property, mixedSqlNode, filename, sqlid) {
    this.property = property;
    this.mixedSqlNode = mixedSqlNode;
    this.filename = filename;
    this.sqlid = sqlid;
}

OtherwiseSqlNode.prototype = {
    //根据参数生成sql
    addsql: function (sqlcontext) {
        return this.mixedSqlNode.addsql(sqlcontext);
    }
};

//foreach节点对象
function ForeachSqlNode(property, mixedSqlNode, filename, sqlid) {
    this.property = property;
    this.mixedSqlNode = mixedSqlNode;
    this.filename = filename;
    this.sqlid = sqlid;
}

/*
处理如下sql
  SELECT *
  FROM POST P
  WHERE ID in
  <foreach item="item" index="index" collection="list"
      open="(" separator="," close=")">
        #{item}
  </foreach>
 */
ForeachSqlNode.prototype = {
    //根据参数生成sql
    addsql: function (sqlcontext) {
        var param = sqlcontext.getParam();
        //判断是否有参数
        if (!param) {
            throw new NodisError('param for sql id: ' + this.sqlid + ' in file ' + this.filename + ' can\'t be null ');
        }
        var item = this.property.item;
        var index = this.property.index;
        var collection = this.property.collection;
        var open = this.property.open;
        var separator = this.property.separator;
        var close = this.property.close;
        var collectionData = param[collection];
        //判断参数中是否有相关数据
        if (!collectionData) {
            throw new NodisError('param\'s property ' + collection + ' for sql id: ' + this.sqlid + ' in file ' + this.filename + ' can\'t be null ');
        } else if (!(collectionData instanceof Array)) {
            //判断参数中相关数据是否为数组
            throw new NodisError('param\'s property ' + collection + ' for sql id: ' + this.sqlid + ' in file ' + this.filename + ' must be Array ');
        }
        var i = 0;
        var sql = open;
        var tempParam;
        var deleSqlcontext;
        var myself = this;
        collectionData.forEach(function (itemp, indexp) {
            tempParam = {item: itemp, index: indexp};
            deleSqlcontext = new SqlContext(tempParam);
            myself.mixedSqlNode.addsql(deleSqlcontext);
            if (i > 0) {
                sql += separator;
            }
            sql += deleSqlcontext.getsql();
            i++;
        });
        sql += close;
        sqlcontext.addsql(sql);
        return true;
    }
};

//把参数中的值替换sql中#{} ${}的值
function replaceParamSql(sql, param) {
    var openToken1 = "#{";
    var openToken2 = "${";
    var closeToken = "}";
    var initParam1 = getInitParam(sql, openToken1, closeToken);
    var initParam2 = getInitParam(sql, openToken2, closeToken);
    var extendedParam1 = extendParam(initParam1, param);
    var extendedParam2 = extendParam(initParam2, param);
    sql = replaceParam(sql, extendedParam1, openToken1, closeToken);
    return replaceParam(sql, extendedParam2, openToken2, closeToken);
}

//提取sql中#{} ${}的值,并以他们为key，
// value为null作为初始化参数
function getInitParam(text, openToken, closeToken) {
    var start = text.indexOf(openToken);
    var initparam = {};
    if (start == -1) {
        return initparam;
    }
    while (start > -1) {
        text = text.substr(start + 2)
        var closeIndex = text.indexOf(closeToken);
        paramName = text.substr(0, closeIndex).trim();
        initparam[paramName] = null;
        start = text.indexOf(openToken);
    }
    return initparam;
}

//替换参数值
function replaceParam(text, param, openToken, closeToken) {
    var pindex = -1;
    var lastendindex = -1;
    for (var p in param) {
        pindex = text.indexOf(p);
        while (pindex >= 0) {
            if (pindex >= 2 && text.substr(pindex - 2, 2) == openToken) {
                var preText = text.substring(0, pindex - 2);
                var paramText = "";
                if ((typeof param[p] == 'string') && param[p].constructor == String) {
                    if (openToken == "#{") {
                        //处理引号中的引号
                        var rnRegExp = new RegExp("\\'", 'g');
                        var rnRegExp1 = new RegExp('\\"', 'g');
                        var resultsql = param[p].replace(rnRegExp, "\\'").trim();
                        resultsql = resultsql.replace(rnRegExp1, '\\"').trim();
                        paramText = "'" + resultsql + "'";
                    } else {
                        //这种是直接把参数中的文本作为sql的一部分，与mybatis中的${}作用一样
                        paramText = param[p];
                    }
                } else if (param[p] instanceof Date) {
                    //日期类型数据
                    paramText = "'" + param[p].format("yyyy-MM-dd hh:mm:ss") + "'";
                } else {
                    paramText = param[p];
                }
                lastendindex = text.indexOf(closeToken, pindex);
                text = preText + paramText + text.substring(lastendindex + 1);
            } else {
                pindex = text.indexOf(p, pindex + 1);
                continue;
            }
            pindex = text.indexOf(p, lastendindex);
        }
    }
    return text;
}

//对象直接量继承，initParam的数据如果param中有，
//则被param中的数据替换，否则initParam中的数据不变
function extendParam(initParam, param) {
    var result = {};
    var find = false;
    for (var ip in initParam) {
        find = false;
        for (var p in param) {
            if (ip == p) {
                result[ip] = param[ip];
                find = true;
            }
        }
        if (!find) {
            result[ip] = initParam[ip];
        }
    }
    return result;
}

var xmltools = {
    getSqlbyId: function (id, param) {
        var sqlcontext = new SqlContext(param);
        if (sql[id]) {
            sql[id].addsql(sqlcontext);
            var resultsql = sqlcontext.getsql();
            if (printsqlflag) {
                console.log(id + ":" + resultsql);
            }
            return resultsql;
        } else {
            if (!sql[id]) {
                throw new NodisError('sql id: ' + id + ' not found');
            }
        }

    }
};

module.exports = xmltools;