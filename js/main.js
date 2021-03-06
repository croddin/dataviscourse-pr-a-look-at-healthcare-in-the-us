var files = d3.map();
var cInterp = d3.interpolateHsl(d3.rgb(247,251,255),d3.rgb(8,48,107));
var selectedCounties = []

function descriptionFromColName(file_name, col_name){
  return data_index
    .filter((d)=>d.PAGE_NAME == file_name)
    .filter((d)=>d.COLUMN_NAME == col_name)[0].LONG_DESCRIPTION
}

function isColPercentage(file_name, col_name){
    if (data_index.filter((d)=>d.PAGE_NAME == file_name).filter((d)=>d.COLUMN_NAME == col_name)[0].IS_PERCENT_DATA === "Y")
        return true;
    else
        return false;
}

function humanNameFromColName(file_name, col_name){
    return data_index
            .filter((d)=>d.PAGE_NAME == file_name)
            .filter((d)=>d.COLUMN_NAME == col_name)[0].HUMAN_COLNAME
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

function onColumnSelected(file_name, col_name){
    downloadData(file_name,col_name,updateMap);
    downloadData(file_name,col_name,updateScatterplot);
}

function setupCombinedSelectBox(selector, initialValue){
    var file_names = d3.set(data_index.map((d)=>d.PAGE_NAME)).values()
    var select = d3.select(selector)
    var optgroups = select.selectAll("optgroup").data(file_names)
    optgroups.enter().append("optgroup").attr("label",(d)=>d).each(function(file_name){
      var col_names = data_index
              .filter((d)=>d.PAGE_NAME == file_name)
              .filter((d)=>d.DATA_TYPE != "Text")
              .map((d)=>d.COLUMN_NAME)
      d3.select(this).selectAll("option")
        .data(col_names).enter()
        .append("option")
        .text((d)=>d)
        .attr("value",(d)=>file_name+"/"+d)
    })
    select.property('value',initialValue)
    select.on("change",function(){
      var values = d3.select(this).property("value").split("/")
      onColumnSelected(values[0],values[1])
    })
}

function getFipsCodeFromRow(d){
  return +(d.State_FIPS_Code + d.County_FIPS_Code)
}

function getVarFromRow(d, colName){
    var col = +d[colName];
    return col > 0 ? col : 0;
}

function getCountyStateNames(data){
  if(window.countyStateNames == undefined){
    window.countyStateNames = d3.map();
    data.forEach(d=>countyStateNames.set(getFipsCodeFromRow(d), d["CHSI_County_Name"] + ", " + d["CHSI_State_Abbr"]));
  }
  return countyStateNames
}

function setHover(d) {
    var isPercent = isColPercentage(currentFile, currentCol);
    var colName = humanNameFromColName(currentFile,currentCol);
    var div = d3.select("#tooltip");
    if (d != null) {
        div.transition()
            .duration(200)
            .style("opacity", .9);

        var countyStateName, xValue, yValue;
        if(d.type == "Feature"){ //Map hover
            countyStateName = countyStateNames.get(d.id);
            var xText = d.cValue == 0 ? "Not reported" : d.cValue;
            if (isPercent && xText != "Not reported") {
                div.html(countyStateName + "<br />" + colName + ": "+ xText + "%");
            }
            else {
                var parts = xText.toString().split(".");
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                xText = parts.join(".");

                div.html(countyStateName + "<br />" + colName + ": " + xText);
            }
        } else { //scatterplot Hover
          countyStateName = d.countyStateName;
          xValue = d.xValue;
            yValue = d.yValue;
            if (isPercent && xText != "Not reported") {
                div.html(countyStateName + "<br />" + "'Fair' or 'Poor' health: " + xValue + "%"
                    + "<br />" + colName + ": " + d.yValue + "%");
            }
            else {
                var parts = yValue.toString().split(".");
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                yValue = parts.join(".");

                div.html(countyStateName + "<br />" + "'Fair' or 'Poor' health: " + xValue + "%"
                    + "<br />" + colName + ": " + yValue);
            }
        }

        div.style("left", (d3.event.pageX) + "px")
            .style("top", (d3.event.pageY - 30) + "px");
    }
    else {
        div.html("")
            .transition()
            .duration(500)
            .style("opacity", 0);
    }
}

function clearHover() {
    setHover(null, null);
}

function updateBarChart(fileName, parameter) {
    var desc = descriptionFromColName(fileName, parameter);
    //Getting the appropriate data.
    var valuesArray = [];
    var highestValues = [];
    var lowestValues = [];

    data = files.get(fileName);
    var nameMap = getCountyStateNames(data)

    data.forEach(function (d) {
        valuesArray.push([getFipsCodeFromRow(d), getVarFromRow(d,parameter)]);
    });

    valuesArray.sort(function (a, b) {
        if (a[1] == b[1]) {
            return 0;
        }
        else {
            return (a[1] > b[1]) ? -1 : 1;
        }
    });

    for (var i = 0; i < 20; i++) {
        highestValues.push(valuesArray[i]);
    }

    valuesArray.reverse();

    valuesArray.forEach(function(d) {
        if (d[1] != 0) {
            lowestValues.push(d);
        }
    });

    lowestValues = lowestValues.slice(0, 20);

    var max = highestValues[0][1];

    highestValues.reverse();

    //Color scale
    colorScale = d3.scale.linear()
        .domain([0, max])
        .range(["blue", "red"]);

    //Setting up the axes
    var svgBounds = document.getElementById("ubarChart").getBoundingClientRect(),
        xAxisSize = 50,
        yAxisSize = 120,
        padding = 30;

    var xScale = d3.scale.linear().range([0, svgBounds.width - yAxisSize - 5]).domain([0, max]);
    var yScale = d3.scale.ordinal().rangeBands([svgBounds.height - xAxisSize, 0], 0.1).domain(d3.range(0, 20));

    var xUAxis = d3.svg.axis().scale(xScale).orient("bottom");
    var yUAxis = d3.svg.axis().scale(yScale).orient("left");

    var xHAxis = d3.svg.axis().scale(xScale).orient("bottom");
    var yHAxis = d3.svg.axis().scale(yScale).orient("left");

    d3.select("#xuAxisBar")
        .attr("transform", "translate(" + yAxisSize + ", " + (svgBounds.height - xAxisSize) + ")")
        .call(xUAxis);

    d3.select("#xhAxisBar")
        .attr("transform", "translate(" + yAxisSize + ", " + (svgBounds.height - xAxisSize) + ")")
        .call(xHAxis);

    var yUBar = d3.select("#yuAxisBar")
        .attr("transform", "translate(" + yAxisSize + ", 0)")
        .call(yUAxis);

    yUBar.selectAll("text")
        .style("text-anchor", "end")
        .text(function (d, i) {
            return nameMap.get(highestValues[i][0]);
        });

    var yHBar = d3.select("#yhAxisBar")
        .attr("transform", "translate(" + yAxisSize + ", 0)")
        .call(yHAxis);

    yHBar.selectAll("text")
        .style("text-anchor", "end")
        .text(function (d, i) {
            return nameMap.get(lowestValues[i][0]);
        });

    //Drawing the bars
    var barsUGroup = d3.select("#ubars");
    var barsHGroup = d3.select("#hbars");

    var ubars = barsUGroup.selectAll("rect")
        .data(highestValues);
    var hbars = barsHGroup.selectAll("rect")
        .data(lowestValues);

    ubars.exit().remove();
    hbars.exit().remove();

    ubars.enter()
        .append("rect");
    hbars.enter()
        .append("rect");

    ubars.attr("height", yScale.rangeBand())
        .attr("y", function(d, i) {return yScale(i)})
        .attr("width", function(d) {return xScale(d[1])})
        .attr("x", yAxisSize)
        .style("fill", function (d) {return colorScale(d[1])})
        .attr("opacity", ".9");

    hbars.attr("height", yScale.rangeBand())
        .attr("y", function(d, i) {return yScale(i)})
        .attr("width", function(d) {return xScale(d[1])})
        .attr("x", yAxisSize)
        .style("fill", function (d) {return colorScale(d[1])})
        .attr("opacity", ".9");
}


function updateScatterplot(fileName, yParameter) {
    var desc = descriptionFromColName(fileName, yParameter)
    //x Axis doesn't change - self-reported health status
    xData = files.get("SummaryMeasuresOfHealth");
    xVarById = d3.map();
    xData.forEach(d=>xVarById.set(getFipsCodeFromRow(d), getVarFromRow(d,"Health_Status")));

    //y Axis changes with the selection of the parameters
    yData = files.get(fileName);
    yVarById = d3.map();
    yData.forEach(d=>yVarById.set(getFipsCodeFromRow(d), getVarFromRow(d,yParameter)));

    //County and state names
    var countyStateNames = getCountyStateNames(xData)

    var xyData = [];
    xVarById.keys().forEach((i)=>
      xyData.push({
          xValue: xVarById.get(i),
          yValue: yVarById.get(i),
          countyStateName: countyStateNames.get(i),
          id:i
      })
    )

    d3.select("#scatterDesc").text(humanNameFromColName(fileName, yParameter));

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
        .attr("y", 33)
        .attr("x",0 - (svgBounds.height / 2))
        .html(desc)
        .style("font-size", ".8em");

    //Setting up the circles
    var circlesGroup = d3.select("#circles");
    window.circles = circlesGroup.selectAll("circle")
        .data(xyData.filter(function (d) {return (d.xValue != 0 && d.yValue != 0)}), (d)=>d.id);
    var radius = 2;

    circles.enter().append("circle")
      .attr("cy", function(d) {return yScale(0)})
      .attr("cx", function(d) {return xScale(0)})

    circles.on("mouseover", function (d) {setHover(d)})
        .on("mouseout", function (d) {clearHover()})
        .on("click", selectCounty)

    circles
        .attr("r", radius)
        .style("fill", function (d) {return colorScale(d.xValue)})
        .transition().duration(1000)
        .attr("cy", function(d) {return yScale(d.yValue)})
        .attr("cx", function(d) {return xScale(d.xValue)})

    circles.exit()
        .transition()
        .duration(1000)
        .attr("cy", function(d) {return yScale(0)})
        .remove();
    updateSelection()

    var selectBox = d3.select("#scatterplot .selectBox").selectAll("rect")

    d3.select("#scatterplot").call(selectBehavior,circles)
}

function selectBehavior(a, elts){
  a.on("mousedown",function(){
    window.dragStart = d3.mouse(this)
    a.select(".selectBox").selectAll("rect").data([1])
      .enter().append("rect")
      .classed("selection",true)
      .attr("x",dragStart[0])
      .attr("y",dragStart[1])
  })
  .on("mousemove",function(){
    var m = d3.mouse(this)
    a.select(".selectBox").selectAll("rect")
      .attr("width",Math.max(m[0] - dragStart[0],0))
      .attr("height",Math.max(m[1] - dragStart[1],0))
  })
  .on("mouseup",function(){
    elts.each(function(d){
      var rectEl = a.select(".selectBox rect").node()
      if(rectEl == undefined) return
      var svg = a.node()
      var rect = svg.createSVGRect();
      rect.x = rectEl.x.animVal.value;
      rect.y = rectEl.y.animVal.value;
      rect.height = rectEl.height.animVal.value;
      rect.width = rectEl.width.animVal.value;

      var intersect = a.node().checkIntersection(this,rect)
      if(intersect){
        addToSelection(parseInt(d.id))
      }

    })
    updateSelection()
    a.selectAll(".selectBox rect").remove()
  })
}

function updateMap(fileName, colName){
    var data = files.get(fileName);

    window.currentFile = fileName
    window.currentCol = colName
    var varById = d3.map();
    data.forEach(d=>varById.set(getFipsCodeFromRow(d), getVarFromRow(d,colName)));

    //County names
    var countyStateNames = getCountyStateNames(data)

    //Set map h2
    var desc = descriptionFromColName(fileName, colName)
    d3.select("#mapDesc").text(desc);

    var dScale = d3.scale.linear() //lin or log
        .domain(d3.extent(varById.values()))
        .range([0,1]);

    var map = d3.select("#map");
    var projection = d3.geo.albersUsa()
        .scale(1280)
        .translate([map.attr("width") / 2, map.attr("height") / 2]);
    var path = d3.geo.path()
        .projection(projection);
    window.mapdata = topojson.feature(us, us.objects.counties).features
    mapdata.forEach((d)=>{
      d.cValue = varById.get(d.id)
    })

    window.counties = map.select(".counties").selectAll("path")
        .data(mapdata, (d)=>d.id)
    counties.enter().append("path").attr("d", path)
    counties.style("fill", (d)=>cInterp(dScale(varById.get(d.id))));

    counties.on("mouseover", function (d) {setHover(d)})
        .on("mouseout", function (d) {clearHover()});

    counties.on("click", selectCounty)


    map.select(".states")
        .datum(topojson.mesh(us, us.objects.states,(a, b)=> a !== b))
        .attr("d", path);

    map.call(selectBehavior,counties)
}

function addToSelection(id){
  if(!selectedCounties.includes(id)){
    selectedCounties.push(id)
  }
}

function selectCounty(d){
  var id = parseInt(d.id)
  if(!selectedCounties.includes(id)){
    selectedCounties.push(id)
  }
  if(selectedCounties.length > 2){
    selectedCounties = selectedCounties.slice(-2)
  }
  updateSelection()
}

function updateSelection(){
  var compareMode = selectedCounties.length != 0
  window.counties
    .attr("opacity",(d)=> !compareMode || selectedCounties.includes(d.id) ? 1 : .1)
  window.circles
    .attr("r",(d)=> compareMode && selectedCounties.includes(parseInt(d.id))? 5 : 2)
    .attr("opacity",(d)=> !compareMode || selectedCounties.includes(parseInt(d.id)) ? 1 : .1)
  updateComparision()
}

function clearSelection(){
  selectedCounties = []
  updateSelection()
}

function updateComparision(){
  var left = selectedCounties[0]
  var right = selectedCounties[1]
  var data = files.get("RiskFactorsAndAccessToCare");
  var countyStateNames = getCountyStateNames(data)
  var svgBounds = document.getElementById("comparison").getBoundingClientRect()
  var leftName = left != undefined ? countyStateNames.get(left) : "Select a County"
  var rightName = right != undefined ? countyStateNames.get(right) : "Select a County"

  var lScale = d3.scale.linear()
      .domain([0,100])
      .range([svgBounds.width/5 * 2 , 10]);
  var lWScale = d3.scale.linear()
    .domain([0,100])
    .range([0,lScale.range()[0]-lScale.range()[1]])
  rScale = d3.scale.linear()
      .domain([0,100])
      .range([svgBounds.width/5 * 3, svgBounds.width-10]);
  var rWScale = d3.scale.linear()
    .domain([0,100])
    .range([0,rScale.range()[1]-rScale.range()[0]])
  var lAxis = d3.svg.axis().scale(lScale).orient("top");
  var rAxis = d3.svg.axis().scale(rScale).orient("top");

  var lBar = d3.select("#leftAxis")
      .attr("transform", "translate(0 ,"+60+")")
      .call(lAxis);
  var rBar = d3.select("#rightAxis")
      .attr("transform", "translate(0 ,"+60+")")
      .call(rAxis);

  d3.select("#leftCounty")
    .text(leftName)
    .attr("y",30)
    .attr("x",svgBounds.width/5 * 1)
  d3.select("#rightCounty")
    .text(rightName)
    .attr("y",30)
    .attr("x",svgBounds.width/5 * 3.5)

  var columns = ["No_Exercise","Few_Fruit_Veg","Obesity","Smoker","Diabetes"]
  var shortDesc = ["No Exercise (%)","Few Fruit and Veggies (%)","Obesity (%)","Smokers (%)","Diabetes (%)"]
  var colScale = d3.scale.ordinal()
    .domain(columns)
    .rangeBands([70,300])

  var rowById = d3.map();
  data.forEach(d=>rowById.set(getFipsCodeFromRow(d), d));
  var lRow = rowById.get(left)
  var rRow = rowById.get(right)

  var leftBars = d3.select("#leftBars").selectAll("rect").data(left != undefined ? columns : [])
  var rightBars = d3.select("#rightBars").selectAll("rect").data(right != undefined ? columns : [])

  leftBars.enter().append("rect")
  leftBars.exit().remove()
  rightBars.enter().append("rect")
  rightBars.exit().remove()
  leftBars.attr("height", 15)
    .attr("y", function(d) {return colScale(d)})
    .attr("x", (d)=>lScale(0)-lWScale(getVarFromRow(lRow,d)))
    .attr("width", function(d) {return lWScale(getVarFromRow(lRow,d))})
    .style("fill", function (d) {return cInterp(getVarFromRow(lRow,d)/100)})
  rightBars.attr("height", 15)
    .attr("y", function(d) {return colScale(d)})
    .attr("x", rScale(0))
    .attr("width", function(d) {return rWScale(getVarFromRow(rRow,d))})
    .style("fill", function (d) {return cInterp(getVarFromRow(rRow,d)/100)})

  d3.select("#chartLabels").selectAll("text").data(columns)
    .enter().append("text")
    .text((d,i)=>shortDesc[i])//descriptionFromColName()
    .attr("y",(d)=>colScale(d)+15)
    .attr("x",svgBounds.width/2)
    .attr("text-anchor","middle")

}

function setup(error, data_index, us, summary){
    window.data_index = data_index;
    window.us = us;
    d3.selectAll(".clearSelection").on("click",clearSelection)
    files.set("SummaryMeasuresOfHealth",summary)
    downloadData("RiskFactorsAndAccessToCare", "Obesity",  updateMap);
    downloadData("RiskFactorsAndAccessToCare", "Obesity", updateScatterplot);
    downloadData("SummaryMeasuresOfHealth", "Health_Status", updateBarChart);
    setupCombinedSelectBox("#data-selector","RiskFactorsAndAccessToCare/Obesity")
}

queue()
  .defer(d3.csv, "data/chsi_dataset/DATAELEMENTDESCRIPTION.csv")
  .defer(d3.json, "data/us.json")
  .defer(d3.csv, "data/chsi_dataset/"+"SummaryMeasuresOfHealth".toUpperCase()+".csv")
  .await(setup);
