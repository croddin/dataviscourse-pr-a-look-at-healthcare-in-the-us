var files = d3.map();
var cInterp = d3.interpolateHsl(d3.rgb(247,251,255),d3.rgb(8,48,107));

//will call selectionChanged(filename, columnname)
function selectDataset(fileSelector, colSelector, selectionChangedMap, selectionChangedScatterplot){
    var file_names = d3.set(data_index.map((d)=>d.PAGE_NAME)).values()
    setSelectBox(fileSelector, file_names, function(file_name){
        var col_names = data_index
                .filter((d)=>d.PAGE_NAME == file_name)
                .filter((d)=>d.DATA_TYPE != "Text")
                .map((d)=>d.COLUMN_NAME)
        var descriptions = data_index
                .filter((d)=>d.PAGE_NAME == file_name)
                .filter((d)=>d.DATA_TYPE != "Text")
                .map((d)=>d.LONG_DESCRIPTION)
        setSelectBox(colSelector, col_names, function(col_name){
            downloadData(file_name,col_name,selectionChangedMap);
            downloadData(file_name,col_name,selectionChangedScatterplot);
    })
  })
}

function downloadData(file_name,col_name,desc,callback){
  if(files.has(file_name)){
    callback(file_name,col_name,desc)
  } else {
    queue()
      .defer(d3.csv, "data/chsi_dataset/"+file_name.toUpperCase()+".csv")
      .await((error, d)=>{
        files.set(file_name,d)
        callback(file_name,col_name,desc)})
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
    var col = +d[colName];
    return col > 0 ? col : 0;
}

function getCountyStateNames (d, colName) {
    return d[colName];
}

function setHover(d) {
    var div = d3.select("#tooltip");

    if (d != null) {
        div.transition()
            .duration(200)
            .style("opacity", .9);

        div.html(d.countyStateName + "<br />" + "'Fair' or 'Poor' health: " + d.xValue + "%")
            .style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 30) + "px");
    }
    else {
        div.transition()
            .duration(500)
            .style("opacity", 0);
    }
}

function clearHover() {
    setHover(null);
}

function updateBarChart(fileName, parameter, desc) {
    data = files.get(fileName);
    varById = d3.map();
    data.forEach(d=>varById.set(getFipsCodeFromRow(d), getVarFromRow(d,parameter)));

    var highestArray = [];

    for (var i = 0; i < 19; i++) {
        highestArray[i];
    }

    console.log(highestArray);
}

function updateScatterplot(fileName, yParameter, desc) {
    //x Axis doesn't change - self-reported health status
    xData = files.get("SummaryMeasuresOfHealth");
    xVarById = d3.map();
    xData.forEach(d=>xVarById.set(getFipsCodeFromRow(d), getVarFromRow(d,"Health_Status")));

    //y Axis changes with the selection of the parameters
    yData = files.get(fileName);
    yVarById = d3.map();
    yData.forEach(d=>yVarById.set(getFipsCodeFromRow(d), getVarFromRow(d,yParameter)));

    //County and state names
    countyStateNames = d3.map();
    xData.forEach(d=>countyStateNames.set(getFipsCodeFromRow(d), getCountyStateNames(d, "CHSI_County_Name") + ", " + getCountyStateNames(d, "CHSI_State_Abbr")));

    var xyData = [];

    xVarById.keys().forEach((i)=>
      xyData.push({
          xValue: xVarById.get(i),
          yValue: yVarById.get(i),
          countyStateName: countyStateNames.get(i)
      })
    )

    var svgBounds = document.getElementById("scatterplot").getBoundingClientRect(),
        xAxisSize = 50,
        yAxisSize = 100,
        padding = 30;

    var xScale = d3.scale.linear() //lin or log
        .domain(d3.extent(xVarById.values()))
        .range([yAxisSize, svgBounds.width - padding]);

    var yScale = d3.scale.linear() //lin or log
        .domain(d3.extent(yVarById.values()))
        .range([svgBounds.height - xAxisSize, padding]);

    var xGroup = d3.select("#xAxis");
    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient("bottom");
    d3.select("#xAxis")
        .attr("transform", "translate(0," + (svgBounds.height - xAxisSize) + ")")
        .call(xAxis);

    //Creating label for x axis
    var xAxisLabel = d3.select("#xAxisLabel");

    xAxisLabel.selectAll("text").remove();

    xAxisLabel.append("text")
        .attr("text-anchor", "middle")
        .attr("x", svgBounds.width / 2)
        .attr("y", svgBounds.height - 15)
        .html("Health status: The percentage of adults who report 'Fair' or 'Poor' overall health")
        .style("font-size", ".8em");

    var yGroup = d3.select("#yAxis");
    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient("left");
    d3.select("#yAxis")
        .attr("transform", "translate(" + yAxisSize + ",0)")
        .call(yAxis);

    //Creating label for y axis
    var yAxisLabel = d3.select("#yAxisLabel");

    yAxisLabel.selectAll("text").remove();

    yAxisLabel.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", 23)
        .attr("x",0 - (svgBounds.height / 2))
        .html(desc)
        .style("font-size", ".8em");

    //Setting up the circles
    var circlesGroup = d3.select("#circles");
    var circles = circlesGroup.selectAll("circle")
        .data(xyData.filter(function (d) {return (d.xValue != 0 && d.yValue != 0)}));
    var radius = 2;

    circles.exit().remove();

    circles.enter()
        .append("circle");

    circles.on("mouseover", function (d) {setHover(d)})
        .on("mouseout", function (d) {clearHover()});

    circles.attr("cy", function(d) {return yScale(d.yValue)})
        .attr("cx", function(d) {return xScale(d.xValue)})
        .attr("r", radius)
        .style("fill", function (d) {return "blue"});
}

function updateMap(fileName, colName, desc){
    data = files.get(fileName);
    varById = d3.map();
    data.forEach(d=>varById.set(getFipsCodeFromRow(d), getVarFromRow(d,colName)));

    //County names
    countyStateNames = d3.map();
    data.forEach(d=>countyStateNames.set(getFipsCodeFromRow(d), getCountyStateNames(d, "CHSI_County_Name") + ", " + getCountyStateNames(d, "CHSI_State_Abbr")));

    //Set map h2
    var mapDesc = d3.select("#mapDesc");

    mapDesc.text(desc);

    var dScale = d3.scale.linear() //lin or log
        .domain(d3.extent(varById.values()))
        .range([0,1]);

    var map = d3.select("#map");
    var projection = d3.geo.albersUsa()
        .scale(1280)
        .translate([map.attr("width") / 2, map.attr("height") / 2]);
    var path = d3.geo.path()
        .projection(projection);

    var counties = map.select(".counties").selectAll("path")
        .data(topojson.feature(us, us.objects.counties).features)
    counties.enter().append("path").attr("d", path)
    counties.style("fill", (d)=>cInterp(dScale(varById.get(d.id))));

    counties.on("mouseover", function (d) {setHover(countyStateNames.get(d.id))})
        .on("mouseout", function (d) {clearHover()});

    map.select(".states")
        .datum(topojson.mesh(us, us.objects.states,(a, b)=> a !== b))
        .attr("d", path);
}

function setup(error, data_index, us){
    window.data_index = data_index;
    window.us = us;

    downloadData("SummaryMeasuresOfHealth", "Health_Status", "Health status: The percentage of adults who report 'Fair' or 'Poor' overall health", updateMap);
    downloadData("RiskFactorsAndAccessToCare", "Obesity", "Percentage of adults at classified as obese according to BMI", updateScatterplot);
    downloadData("SummaryMeasuresOfHealth", "Health_Status", "Health status: The percentage of adults who report 'Fair' or 'Poor' overall health", updateBarChart);

    selectDataset("#map-data-section", "#map-data-column", updateMap, updateScatterplot);
}

queue()
  .defer(d3.csv, "data/chsi_dataset/DATAELEMENTDESCRIPTION.csv")
  .defer(d3.json, "data/us.json")
  .await(setup);
