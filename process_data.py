#!/usr/bin/python3
'#!/usr/bin/python3 -OO'

'''
'''

# @todo update doc string

###########
# Imports #
###########

import json
import tqdm
import pandas as pd
from typing import List, Tuple

from misc_utilities import *

###########
# Globals #
###########

with warnings_suppressed():
    tqdm.tqdm.pandas()

# https://github.com/holtzy/D3-graph-gallery/blob/master/DATA/world.geojson
WORLD_GEOJSON_FILE_LOCATION = './data/world.geojson'

# https://www.transtats.bts.gov/DL_SelectFields.asp?Table_ID=258
US_BUREAU_OF_TRANSPORTATION_STATISTICS_CSV_FILE_LOCATION = './data/us_bts_raw_data.csv'

# https://www.partow.net/miscellaneous/airportdatabase/
GLOBAL_AIRPORT_DB_DATA_CSV_FILE_LOCATION = './data/GlobalAirportDatabase.txt'

OUTPUT_GEOJSON_FILE_LOCATION = './data/processed_data.geojson'

#####################################
# Landmass Data Gathering Utilities #
#####################################

def generate_landmass_features() -> List[dict]:
    with open(WORLD_GEOJSON_FILE_LOCATION, 'r') as file_handle:
        world_geojson_data = json.load(file_handle)
    landmass_features: List[dict] = []
    for feature in world_geojson_data['features']:
        if feature['properties']['name'] in ['USA']:
            feature['properties'] = {'information-type': 'landmass'}
            del feature['id']
            landmass_features.append(feature)
    return landmass_features

########################################
# Flight Path Data Gathering Utilities #
########################################

CITY_MARKET_DATA_RELEVANT_COLUMNS = [
    'PASSENGERS',
    'DISTANCE',
    'REGION',
    'YEAR',
    'QUARTER',
    'MONTH',
    'DISTANCE_GROUP',
    'CLASS',
    'ORIGIN_AIRPORT_ID', 'ORIGIN_AIRPORT_SEQ_ID', 'ORIGIN_CITY_MARKET_ID', 'ORIGIN', 'ORIGIN_CITY_NAME', 'ORIGIN_STATE_ABR', 'ORIGIN_STATE_NM',
    'DEST_AIRPORT_ID',   'DEST_AIRPORT_SEQ_ID',   'DEST_CITY_MARKET_ID',   'DEST',   'DEST_CITY_NAME',   'DEST_STATE_ABR',   'DEST_STATE_NM',
]

def generate_city_market_dfs_from_us_bts_data() -> Tuple[pd.DataFrame, pd.DataFrame]:
    raw_data_df = pd.read_csv(US_BUREAU_OF_TRANSPORTATION_STATISTICS_CSV_FILE_LOCATION)
    relevant_df = raw_data_df[CITY_MARKET_DATA_RELEVANT_COLUMNS]
    relevant_df = relevant_df[relevant_df.PASSENGERS != 0.0]
    passenger_flow_df = relevant_df[['ORIGIN_CITY_MARKET_ID', 'DEST_CITY_MARKET_ID', 'PASSENGERS']]
    passenger_flow_df = passenger_flow_df.groupby(['ORIGIN_CITY_MARKET_ID', 'DEST_CITY_MARKET_ID']).PASSENGERS.sum().reset_index()
    origin_city_market_id_info_df = relevant_df[['ORIGIN_CITY_MARKET_ID', 'ORIGIN', 'ORIGIN_CITY_NAME']].rename(columns={'ORIGIN_CITY_MARKET_ID': 'CITY_MARKET_ID', 'ORIGIN': 'AIRPORT', 'ORIGIN_CITY_NAME': 'CITY_NAME'})
    dest_city_market_id_info_df = relevant_df[['DEST_CITY_MARKET_ID', 'DEST', 'DEST_CITY_NAME']].rename(columns={'DEST_CITY_MARKET_ID': 'CITY_MARKET_ID', 'DEST': 'AIRPORT', 'DEST_CITY_NAME': 'CITY_NAME'})
    city_market_id_info_df = pd.concat([origin_city_market_id_info_df, dest_city_market_id_info_df])
    city_market_id_info_df = city_market_id_info_df.groupby('CITY_MARKET_ID').agg({'AIRPORT': list, 'CITY_NAME': list})
    city_market_id_info_df = pd.DataFrame(city_market_id_info_df.progress_apply(lambda row: list(zip(*set(zip(row.AIRPORT, row.CITY_NAME)))), axis=1).tolist(), columns=['AIRPORT', 'CITY_NAME']).set_index(city_market_id_info_df.index)    
    return passenger_flow_df, city_market_id_info_df

GLOBAL_AIRPORT_DB_COLUMN_NAMES = ['ICAO_Code', 'IATA_Code', 'Airport_Name', 'City_Town', 'Country', 'Latitude_Degrees', 'Latitude_Minutes', 'Latitude_Seconds', 'Latitude_Direction', 'Longitude_Degrees', 'Longitude_Minutes', 'Longitude_Seconds', 'Longitude_Direction', 'Altitude', 'Latitude_Decimal_Degrees', 'Longitude_Decimal_Degrees']

def integrate_city_market_df_with_geodata(passenger_flow_df: pd.DataFrame, city_market_id_info_df: pd.DataFrame) -> pd.DataFrame:
    airports_df = pd.read_csv(GLOBAL_AIRPORT_DB_DATA_CSV_FILE_LOCATION, sep=':', header=None, names=GLOBAL_AIRPORT_DB_COLUMN_NAMES)
    city_market_id_info_df_with_geodata = city_market_id_info_df.progress_apply(lambda x: pd.Series(list(x.AIRPORT)), axis=1) \
                                                                .stack() \
                                                                .reset_index(level=1, drop=True) \
                                                                .to_frame('AIRPORT') \
                                                                .reset_index() \
                                                                .merge(airports_df[['IATA_Code', 'Latitude_Decimal_Degrees', 'Longitude_Decimal_Degrees']], left_on='AIRPORT', right_on='IATA_Code') \
                                                                .drop(['IATA_Code'], axis=1) \
                                                                .groupby('CITY_MARKET_ID') \
                                                                .mean() \
                                                                .reset_index() \
                                                                .set_index('CITY_MARKET_ID') \
                                                                .join(city_market_id_info_df[['AIRPORT', 'CITY_NAME']])
    passenger_flow_df_with_geodata = passenger_flow_df.merge(city_market_id_info_df_with_geodata[['Latitude_Decimal_Degrees','Longitude_Decimal_Degrees']]
                                                             .rename(columns={'Latitude_Decimal_Degrees':'ORIG_LAT', 'Longitude_Decimal_Degrees':'ORIG_LONG'}),
                                                             right_on='CITY_MARKET_ID', left_on='ORIGIN_CITY_MARKET_ID') \
                                                      .merge(city_market_id_info_df_with_geodata[['Latitude_Decimal_Degrees','Longitude_Decimal_Degrees']] \
                                                             .rename(columns={'Latitude_Decimal_Degrees':'DEST_LAT', 'Longitude_Decimal_Degrees':'DEST_LONG'}),
                                                             right_on='CITY_MARKET_ID', left_on='DEST_CITY_MARKET_ID')
    passenger_flow_df_with_geodata = pd.concat([
        passenger_flow_df_with_geodata,
        pd.DataFrame(passenger_flow_df_with_geodata.progress_apply(lambda row: (city_market_id_info_df.loc[row.ORIGIN_CITY_MARKET_ID].AIRPORT,city_market_id_info_df.loc[row.ORIGIN_CITY_MARKET_ID].CITY_NAME), axis=1).tolist(),
                     columns=['ORIGIN_CITY_AIRPORTS', 'ORIGIN_CITY_NAMES']),
        pd.DataFrame(passenger_flow_df_with_geodata.progress_apply(lambda row: (city_market_id_info_df.loc[row.DEST_CITY_MARKET_ID].AIRPORT,city_market_id_info_df.loc[row.DEST_CITY_MARKET_ID].CITY_NAME), axis=1).tolist(),
                     columns=['DEST_CITY_AIRPORTS', 'DEST_CITY_NAMES'])
    ], axis=1)
    passenger_flow_df_with_geodata = passenger_flow_df_with_geodata[passenger_flow_df_with_geodata.ORIGIN_CITY_MARKET_ID != passenger_flow_df_with_geodata.DEST_CITY_MARKET_ID]
    passenger_flow_df_with_geodata = passenger_flow_df_with_geodata[passenger_flow_df_with_geodata.PASSENGERS > 0]
    return passenger_flow_df_with_geodata

def generate_passenger_flow_df() -> pd.DataFrame:
    passenger_flow_df, city_market_id_info_df = generate_city_market_dfs_from_us_bts_data()
    passenger_flow_df = integrate_city_market_df_with_geodata(passenger_flow_df, city_market_id_info_df)
    return passenger_flow_df

def generate_flight_path_feature_from_passenger_flow_row(passenger_flow_row: pd.Series) -> dict:
    properties = {'information-type': 'flight_path'}
    properties['ORIGIN_CITY_MARKET_ID'] = passenger_flow_row.ORIGIN_CITY_MARKET_ID
    properties['DEST_CITY_MARKET_ID'] = passenger_flow_row.DEST_CITY_MARKET_ID
    properties['PASSENGERS'] = passenger_flow_row.PASSENGERS
    properties['ORIGIN_CITY_AIRPORTS'] = list(passenger_flow_row.ORIGIN_CITY_AIRPORTS)
    properties['ORIGIN_CITY_NAMES'] = list(passenger_flow_row.ORIGIN_CITY_NAMES)
    assert len(properties['ORIGIN_CITY_AIRPORTS']) == len(properties['ORIGIN_CITY_NAMES'])
    assert isinstance(properties['ORIGIN_CITY_AIRPORTS'], list)
    assert isinstance(properties['ORIGIN_CITY_NAMES'], list)
    properties['DEST_CITY_AIRPORTS'] = list(passenger_flow_row.DEST_CITY_AIRPORTS)
    properties['DEST_CITY_NAMES'] = list(passenger_flow_row.DEST_CITY_NAMES)
    assert len(properties['DEST_CITY_AIRPORTS']) == len(properties['DEST_CITY_NAMES'])
    assert isinstance(properties['DEST_CITY_AIRPORTS'], list)
    assert isinstance(properties['DEST_CITY_NAMES'], list)
    coordinates = [[passenger_flow_row.ORIG_LONG, passenger_flow_row.ORIG_LAT], [passenger_flow_row.DEST_LONG, passenger_flow_row.DEST_LAT]]
    path_feature = {
        'type':'Feature',
        'properties': properties,
        'geometry': {
	    'type': 'LineString',
	    'coordinates': coordinates,
        }
    }
    return path_feature

def generate_all_flight_path_features() -> List[dict]:
    passenger_flow_df = generate_passenger_flow_df()
    flight_path_features = eager_map(generate_flight_path_feature_from_passenger_flow_row, passenger_flow_df.itertuples())
    return flight_path_features

##########
# Driver #
##########

def create_geojson_data_from_features(features: list) -> dict:
    return {'type': 'FeatureCollection', 'features': features}

@debug_on_error
def process_data() -> None:
    features = generate_all_flight_path_features() + generate_landmass_features()
    final_geojson_data = create_geojson_data_from_features(features)
    with open(OUTPUT_GEOJSON_FILE_LOCATION, 'w') as file_handle:
        json.dump(final_geojson_data, file_handle, indent=4)
    return

if __name__ == '__main__':
    process_data()
 
