# US Air Travel Visualization (2018)

This is a visualization of air U.S. air travel in 2018.

A live demo can be found here [https://paul-tqh-nguyen.github.io/us_air_travel_visualization/](https://paul-tqh-nguyen.github.io/us_air_travel_visualization/)

The data used came from the [U.S. Bureau of Transportation Statistics](https://www.transtats.bts.gov/DL_SelectFields.asp?Table_ID=258) and the [Global Airport Database](https://www.partow.net/miscellaneous/airportdatabase/). 

The visualization is implemented in [D3.js](https://d3js.org/).

Data preprocessing was done via [Pandas](https://pandas.pydata.org/).

Notes about the visualization:
* Each dot represents a city market, i.e. the region that a set of possibly many airports serves. Thus, each dot can represent one or more airports. 
* The edges between two city markets represents the number of passengers shared between the two city markets, i.e. the minimum of the number of passengers going one way and the number of passengers going the other way. 
* Hover over a city market to temporarily reveal the relevant flight paths.
* Click on a city market to make the flight paths stay.
* Hover over or click the flight paths to show flight information.