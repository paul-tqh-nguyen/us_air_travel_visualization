
const mapMain = () => {
    
    const getJSONLocation = './data/processed_data.geojson';

    const plotContainer = document.getElementById('map');
    const svg = d3.select('#map-svg');
    const projection = d3.geoMercator();
    const projectionFunction = d3.geoPath().projection(projection);
    const landMassesGroupTranslateLayer = svg.append('g')
          .attr('id','land-masses-group-translate-layer');
    const landMassesGroupScaleLayer = landMassesGroupTranslateLayer.append('g')
          .attr('id','land-masses-group-scale-layer');
    const displayTextGroup = svg.append('g')
          .attr('id', 'text-display-group');
    const displayTextGroupTextInfo = {permanentTextLines: [], currentTextLines: []};

    const paddingAmount = 30;
    const displayTextGroupVerticalOffset = 60;

    const concat = (a, b) => a.concat(b);
    const isNumber = obj => obj !== undefined && typeof(obj) === 'number' && !isNaN(obj);
    
    d3.json(getJSONLocation, data => {
        const landmassLongLatPairs = data.features
              .filter(datum => datum.properties['information-type'] === 'landmass')
              .map(datum => datum.geometry.coordinates.map(coordLists => coordLists[0]).reduce(concat, []))
              .map(coordList => (coordList.length == 2 && isNumber(coordList[0]) && isNumber(coordList[1])) ? [coordList] : coordList)
              .reduce(concat, []);
        const landmassLongs = landmassLongLatPairs.map(pair => pair[0]);
        const landmassLats = landmassLongLatPairs.map(pair => pair[1]);
        const landmassMinLong = Math.min(...landmassLongs);
        const landmassMinLat = Math.min(...landmassLats);
        const landmassMaxLong = Math.max(...landmassLongs);
        const landmassMaxLat = Math.max(...landmassLats);

        const landmassData = data.features.filter(datum => datum.properties['information-type'] === 'landmass');

        const allFlightPathData = data.features
              .filter(datum => datum.properties['information-type'] === 'flight_path')
              .filter(datum =>
                      datum.geometry.coordinates[0][0] >= landmassMinLong && 
                      datum.geometry.coordinates[0][1] >= landmassMinLat && 
                      datum.geometry.coordinates[1][0] >= landmassMinLong && 
                      datum.geometry.coordinates[1][1] >= landmassMinLat && 
                      datum.geometry.coordinates[0][0] <= landmassMaxLong && 
                      datum.geometry.coordinates[0][1] <= landmassMaxLat && 
                      datum.geometry.coordinates[1][0] <= landmassMaxLong && 
                      datum.geometry.coordinates[1][1] <= landmassMaxLat
                     );

        const cityMarketDataByID = allFlightPathData.reduce((accumulator, datum) => {
            const origin_city_market_id = datum.properties.ORIGIN_CITY_MARKET_ID;
            const dest_city_market_id = datum.properties.DEST_CITY_MARKET_ID;
            if (!(origin_city_market_id in accumulator)) {
                const origin_city_airports = datum.properties.ORIGIN_CITY_AIRPORTS;
                const origin_city_names = datum.properties.ORIGIN_CITY_NAMES;
                const origin_long = datum.geometry.coordinates[0][0];
                const origin_lat = datum.geometry.coordinates[0][1];
                accumulator[origin_city_market_id] = {'city_airports': origin_city_airports, 'city_names': origin_city_names, 'lat': origin_lat, 'long': origin_long, 'flight_path_data': []};
            }
            accumulator[origin_city_market_id].flight_path_data.push(datum);
            if (!(dest_city_market_id in accumulator)) {
                const dest_city_airports = datum.properties.DEST_CITY_AIRPORTS;
                const dest_city_names = datum.properties.DEST_CITY_NAMES;
                const dest_long = datum.geometry.coordinates[1][0];
                const dest_lat = datum.geometry.coordinates[1][1];
                accumulator[dest_city_market_id] = {'city_airports': dest_city_airports, 'city_names': dest_city_names, 'lat': dest_lat, 'long': dest_long, 'flight_path_data': []};
            }
            accumulator[dest_city_market_id].flight_path_data.push(datum);
            return accumulator;
        }, {});
        
        const redraw = () => {
            svg
                .attr('width', `${plotContainer.clientWidth}px`)
                .attr('height', `${plotContainer.clientHeight}px`);
            const svg_width = parseFloat(svg.attr('width'));
            const svg_height = parseFloat(svg.attr('height'));            
            
            const updateCurrentDisplayTextLines = (newTextLines) => {
                displayTextGroupTextInfo.currentTextLines = newTextLines;
            };
            const updatePermanentDisplayTextLines = (newTextLines) => {
                displayTextGroupTextInfo.permanentTextLines = newTextLines;
            };
            const displayTextLines = (textLines) => {
                displayTextGroup.selectAll('*').remove();
                textLines.forEach((textLine, textLineIndex) => {
                    displayTextGroup
                        .append('text')
                        .attr('x', svg_width / 2)
                        .attr('y', displayTextGroupVerticalOffset)
                        .style('font-size', Math.min(20, svg_height * 0.4 / textLines.length))
                        .attr('dy', `${textLineIndex * 1.2}em`)
                        .html(textLine);
                });
            };
            displayTextLines(displayTextGroupTextInfo.permanentTextLines);
            
            landMassesGroupScaleLayer
                .selectAll('path')
                .data(landmassData)
                .enter()
    	        .append('path')
                .attr('class', 'landmass')
                .attr('d', datum => projectionFunction(datum));

            const landMassesGroupScaleLayerBoundingBox = d3.select('#land-masses-group-scale-layer').node().getBBox();
            const landMassesGroupScaleLayerWidth = landMassesGroupScaleLayerBoundingBox.width;
            const landMassesGroupScaleLayerHeight = landMassesGroupScaleLayerBoundingBox.height;
            const landMassesGroupScaleLayerStretchFactor = Math.min( (svg_width - 2 * paddingAmount) / landMassesGroupScaleLayerWidth, (svg_height - 2 * paddingAmount) / landMassesGroupScaleLayerHeight);
            
            const generateFlightPathTextLines = (datum) => {
                const textLines = [
                    `Number of Passengers: ${datum.properties.PASSENGERS}`,
                    '',
                    `Origin City Market ID: ${datum.properties.ORIGIN_CITY_MARKET_ID}`,
                    `City Market Approximate Latitude: ${datum.geometry.coordinates[0][1].toFixed(3)}`,
                    `City Market Approximate Longitude: ${datum.geometry.coordinates[0][0].toFixed(3)}`,
                    'Origin City Market Airports:',
                ];
                datum.properties.ORIGIN_CITY_AIRPORTS.forEach((airport, airportIndex) => {
                    textLines.push(` &nbsp; &nbsp; &nbsp; &nbsp; ${datum.properties.ORIGIN_CITY_NAMES[airportIndex]} (${airport})`);
                });
                textLines.push(
                    '',
                    `Destination City Market ID: ${datum.properties.DEST_CITY_MARKET_ID}`,
                    `City Market Approximate Latitude: ${datum.geometry.coordinates[1][1].toFixed(3)}`,
                    `City Market Approximate Longitude: ${datum.geometry.coordinates[1][0].toFixed(3)}`,
                    'Destination City Market Airports:',
                );
                datum.properties.DEST_CITY_AIRPORTS.forEach((airport, airportIndex) => {
                    textLines.push(` &nbsp; &nbsp; &nbsp; &nbsp; ${datum.properties.DEST_CITY_NAMES[airportIndex]} (${airport})`);
                });
                return textLines;
            };
            const renderFlightPaths = (currentlyDisplayedFlightPathData, cssClassToAdd) => {
                const flightPaths = landMassesGroupScaleLayer
                      .selectAll(`.${cssClassToAdd}`)
                      .data(currentlyDisplayedFlightPathData);
                const enterSelection = flightPaths
                    .enter()
    	            .append('path')
                    .attr('class', cssClassToAdd)
                    .attr('d', datum => projectionFunction(datum));
                const updateSelection = flightPaths
                      .attr('class', cssClassToAdd)
                      .attr('d', datum => projectionFunction(datum));
                [enterSelection, updateSelection].forEach(selection => {
                    selection
                        .on('click', function(datum) {
                            selection.attr('class', 'flight-path-of-clicked-city-market');
                            d3.select(this).attr('class', 'flight-path-clicked');
                            const textLines = generateFlightPathTextLines(datum);
                            updatePermanentDisplayTextLines(textLines);
                            updateCurrentDisplayTextLines(textLines);
                            displayTextLines(displayTextGroupTextInfo.currentTextLines);
                        })
                        .on('mouseover', datum => {
                            const textLines = generateFlightPathTextLines(datum);
                            updateCurrentDisplayTextLines(textLines);
                            displayTextLines(displayTextGroupTextInfo.currentTextLines);
                        })
                        .on('mouseout', datum => {
                            displayTextLines(displayTextGroupTextInfo.permanentTextLines);
                        });
                });
                flightPaths.exit().remove();
            };
            
            landMassesGroupScaleLayer.selectAll('circle').remove();
            const renderCirclesWithoutMouseEvents = () => {
                const circleSelection = landMassesGroupScaleLayer.selectAll('circle')
	              .data(Object.entries(cityMarketDataByID));
                circleSelection
	            .enter().append('circle')
                    .attr('class', 'city-market');
                circleSelection
                    .each(function(datum) {
                        this.parentNode.appendChild(this);
                    });
            };
            renderCirclesWithoutMouseEvents();
            
            const generateCityMarketTextLines = (cityMarketId, datum) => {
                const cityMarketTextLines = [
                    'City Market Info:',
                    `City Market ID: ${cityMarketId}`,
                    `Number of Ingoing or Outgoing Flight Paths: ${datum.flight_path_data.length}`,
                    `City Market Approximate Latitude: ${datum.lat.toFixed(3)}`,
                    `City Market Approximate Longitude: ${datum.long.toFixed(3)}`,
                    'City Market Airports:',
                ];
                datum.city_airports.forEach((airport, airportIndex) => {
                    cityMarketTextLines.push(` &nbsp; &nbsp; &nbsp; &nbsp; ${datum.city_names[airportIndex]} (${airport})`);
                });
                return cityMarketTextLines;
            };
            landMassesGroupScaleLayer.selectAll('.city-market')
                .on('click', cityMarketIdAndDatumPair => {
                    landMassesGroupScaleLayer.selectAll('.flight-path-clicked').remove();
                    const [cityMarketId, datum] = cityMarketIdAndDatumPair;
                    const currentlyDisplayedFlightPathData = cityMarketDataByID[cityMarketId].flight_path_data;
                    renderFlightPaths(currentlyDisplayedFlightPathData, 'flight-path-of-clicked-city-market');
                    renderCirclesWithoutMouseEvents();
                    const cityMarketTextLines = generateCityMarketTextLines(cityMarketId, datum);
                    updatePermanentDisplayTextLines(cityMarketTextLines);
                    updateCurrentDisplayTextLines(cityMarketTextLines);
                    displayTextLines(displayTextGroupTextInfo.currentTextLines);
                })
                .on('mouseover', cityMarketIdAndDatumPair => {
                    const [cityMarketId, datum] = cityMarketIdAndDatumPair;
                    const currentlyDisplayedFlightPathData = cityMarketDataByID[cityMarketId].flight_path_data;
                    renderFlightPaths(currentlyDisplayedFlightPathData, 'flight-path-of-hovered-city-market');
                    renderCirclesWithoutMouseEvents();
                    const cityMarketTextLines = generateCityMarketTextLines(cityMarketId, datum);
                    updateCurrentDisplayTextLines(cityMarketTextLines);
                    displayTextLines(displayTextGroupTextInfo.currentTextLines);
                })
                .on('mouseout', cityMarketIdAndDatumPair => {
                    const [cityMarketId, datum] = cityMarketIdAndDatumPair;
                    const currentlyDisplayedFlightPathData = cityMarketDataByID[cityMarketId].flight_path_data;
                    const flightPaths = landMassesGroupScaleLayer
                          .selectAll('.flight-path-of-hovered-city-market');
                    flightPaths.remove();
                    displayTextLines(displayTextGroupTextInfo.permanentTextLines);
                })
                .attr('transform', cityMarketIdAndDatumPair => {
                    const [cityMarketId, datum] = cityMarketIdAndDatumPair;
                    return `translate(${projection([datum.long, datum.lat])})`;
                });
            
            landMassesGroupScaleLayer
                .attr('transform', `scale(${landMassesGroupScaleLayerStretchFactor})`);
            
            const landMassesGroupTranslateLayerBoundingBox = d3.select('#land-masses-group-translate-layer').node().getBBox();
            const landMassesGroupTranslateLayerWidth = landMassesGroupTranslateLayerBoundingBox.width;
            const landMassesGroupTranslateLayerHeight = landMassesGroupTranslateLayerBoundingBox.height;
            const landMassesGroupTranslateLayerX = landMassesGroupTranslateLayerBoundingBox.x;
            const landMassesGroupTranslateLayerY = landMassesGroupTranslateLayerBoundingBox.y;
            landMassesGroupTranslateLayer
                .attr('transform', `translate(${-landMassesGroupTranslateLayerX + svg_width / 2 - landMassesGroupTranslateLayerWidth / 2} ${-landMassesGroupTranslateLayerY + svg_height / 2 - landMassesGroupTranslateLayerHeight / 2})`);

        };
        redraw();
        window.addEventListener('resize', redraw);
    });
    
};

mapMain();
