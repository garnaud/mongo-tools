(function() {

  load("jstests/configs/replset_28.config.js");

  var name = 'import_write_concern';
  var toolTest = new ToolTest(name, null);
  var dbName = "foo";
  var colName = "bar";
  var fileTarget = "wc.csv";
  var st = new ShardingTest({shards : {
    rs0: {
      nodes: 3,
      useHostName: true
    },
  }});
  var rs = st.rs0;
  var cfg = rs.getConfigFromPrimary();
  cfg.settings.chainingAllowed = false;
  cfg.version += 1;
  assert.commandWorked(rs.getPrimary().adminCommand({replSetReconfig: cfg}));
  rs.awaitReplication();
  toolTest.port = st.s.port;

  var commonToolArgs = getCommonToolArguments();
  var db = st.s.getDB(dbName);
  var col = db.getCollection(colName);

  function writeConcernTestFunc(exitCode,writeConcern,name) {
    jsTest.log(name);
    ret = toolTest.runTool.apply(
        toolTest,
        ['import','--file', fileTarget, '-d', dbName, '-c', colName].
        concat(writeConcern).
        concat(commonToolArgs)
        );
    assert.eq(exitCode, ret, name);
    db.dropDatabase();
  }

  function startProgramNoConnect() {
    return startMongoProgramNoConnect.apply(null,
        ['mongoimport','--writeConcern={w:3}','--host', st.s.host,'--file',fileTarget].
        concat(commonToolArgs)
        );
  }

  // create a test collection
  for(var i=0;i<=100;i++){
    col.insert({_id:i, x:i*i});
  }
  rs.awaitReplication();

  // setup: export the data that we'll use
  var ret = toolTest.runTool.apply(
      toolTest,
      ['export','--out',fileTarget, '-d', dbName, '-c', colName].
      concat(commonToolArgs)
      );
  assert.eq(0, ret);

  // drop the database so it's empty
  db.dropDatabase();

  // load and run the write concern suite
  load('jstests/libs/wc_framework.js');
  runWCTest("mongoimport", rs, toolTest, writeConcernTestFunc, startProgramNoConnect);

  db.dropDatabase();
  rs.stopSet();
  toolTest.stop();

}());
