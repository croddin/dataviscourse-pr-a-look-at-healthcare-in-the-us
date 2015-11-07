var files = d3.map()

//will call selectionChanged(filename, columnname)
function selectDataset(fileSelector, colSelector, selectionChanged){
  var file_names = d3.set(data_index.map((d)=>d.PAGE_NAME)).values()
  setSelectBox(fileSelector, file_names, function(file_name){
    var col_names = data_index
      .filter((d)=>d.PAGE_NAME == file_name)
      .filter((d)=>d.DATA_TYPE != "Text")
      .map((d)=>d.COLUMN_NAME)
    setSelectBox(colSelector, col_names, function(col_name){
      downloadData(file_name,col_name,selectionChanged)
    })
  })
}

function downloadData(file_name,col_name,callback){
  if(files.has(file_name)){
    callback(file_name,col_name)
  } else {
    queue()
      .defer(d3.csv, "data/chsi_dataset/"+file_name.toUpperCase()+".csv")
      .await((error, d)=>{
        files.set(file_name,d)
        callback(file_name,col_name)})
  }
}

function setSelectBox(selector, data, cb){
  var select = d3.select(selector)
  var options = select.selectAll("option").data(data)
  options.enter().append("option")
  options.attr("value",(d)=>d).text((d)=>d)
  select.on("change",function(){cb(d3.select(this).property("value"))})
}

function getFipsCodeFromRow(d){
  return +(d.State_FIPS_Code + d.County_FIPS_Code)
}

function getVarFromRow(d, colName){
  var col = +d[colName]
  return col > 0 ? col : 0;
}

function updateMap(fileName, colName){
  data = files.get(fileName)
  varById = d3.map()
  data.forEach(d=>varById.set(getFipsCodeFromRow(d), getVarFromRow(d,colName)))

  var cInterp = d3.interpolateHsl(d3.rgb(247,251,255),d3.rgb(8,48,107))
  var dScale = d3.scale.linear() //lin or log
      .domain(d3.extent(varById.values()))
      .range([0,1]);

  var map = d3.select("#map")
  var projection = d3.geo.albersUsa()
      .scale(1280)
      .translate([map.attr("width") / 2, map.attr("height") / 2]);
  var path = d3.geo.path()
      .projection(projection);

  var counties = map.select(".counties").selectAll("path")
      .data(topojson.feature(us, us.objects.counties).features)
  counties.enter().append("path").attr("d", path)
  counties.style("fill", (d)=>cInterp(dScale(varById.get(d.id))))

  map.select(".states")
      .datum(topojson.mesh(us, us.objects.states,(a, b)=> a !== b))
      .attr("d", path);
}

function setup(error, data_index, us){
  window.data_index = data_index
  window.us = us
  selectDataset("#map-data-section", "#map-data-column", updateMap)
}

queue()
  .defer(d3.csv, "data/chsi_dataset/DATAELEMENTDESCRIPTION.csv")
  .defer(d3.json, "data/us.json")
  .await(setup);
