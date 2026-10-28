// Capital Street cities: New York is home; the rest unlock with net worth and an opening fee.
// The page loads one city at a time (?city=london); everything else is shared through the saved game.
'use strict';
window.CITIES = {
  nyc: {
    id: 'nyc', name: 'New York', flag: '🇺🇸', lat: 40.7580, lon: -73.9855, centre: [40.7680, -73.9750], view: 16000,
    blurb: 'Where it all starts: a rooftop studio, a found envelope of cash and Wall Street a block away.',
    need: 0, fee: 0,
    districts: [['INWOOD', 40.8680, -73.9230], ['WASHINGTON HEIGHTS', 40.8450, -73.9380], ['HARLEM', 40.8110, -73.9460], ['UPPER WEST SIDE', 40.7870, -73.9750],
      ['UPPER EAST SIDE', 40.7735, -73.9560], ['MIDTOWN', 40.7540, -73.9840], ['CHELSEA', 40.7465, -74.0010], ['GREENWICH VILLAGE', 40.7330, -74.0020],
      ['EAST VILLAGE', 40.7280, -73.9840], ['SOHO', 40.7233, -74.0030], ['FINANCIAL DISTRICT', 40.7075, -74.0090], ['CENTRAL PARK', 40.7812, -73.9665]],
    nearby: [['NEW JERSEY', 40.7400, -74.0600], ['BROOKLYN', 40.6850, -73.9700], ['QUEENS', 40.7550, -73.9200], ['THE BRONX', 40.8450, -73.9000]],
    water: [['HUDSON RIVER', 40.7750, -74.0080], ['EAST RIVER', 40.7350, -73.9660], ['UPPER BAY', 40.6750, -74.0380]],
    places: [['Empire State Building', 40.7484, -73.9857, 460], ['One World Trade', 40.7130, -74.0132, 560], ['Chrysler Building', 40.7516, -73.9755, 330],
      ['Statue of Liberty', 40.6892, -74.0445, 110], ['Stock Exchange', 40.7069, -74.0113, 50], ['Times Square', 40.7580, -73.9855, 40]]
  },
  london: {
    id: 'london', name: 'London', flag: '🇬🇧', lat: 51.5133, lon: -0.0890, centre: [51.5105, -0.0680], view: 8000,
    blurb: 'The City of London and Canary Wharf: old money, new towers and the Thames in between.',
    need: 150000, fee: 20000,
    districts: [['THE CITY', 51.5150, -0.0900], ['CANARY WHARF', 51.5050, -0.0195], ['SOUTHWARK', 51.5020, -0.0960], ['SHOREDITCH', 51.5245, -0.0780], ['WAPPING', 51.5045, -0.0560]],
    nearby: [], water: [['RIVER THAMES', 51.5075, -0.0700]],
    places: [['Bank of England', 51.5142, -0.0886, 40], ['London Stock Exchange', 51.5150, -0.0990, 40], ['The Shard', 51.5045, -0.0865, 320], ["St Paul's", 51.5138, -0.0984, 115], ['Tower Bridge', 51.5055, -0.0754, 70], ['One Canada Square', 51.5049, -0.0195, 240]]
  },
  tokyo: {
    id: 'tokyo', name: 'Tokyo', flag: '🇯🇵', lat: 35.6812, lon: 139.7671, centre: [35.6790, 139.7660], view: 7000,
    blurb: 'Marunouchi and Ginza: bullet trains, glass towers and the busiest crossings on earth.',
    need: 500000, fee: 60000,
    districts: [['MARUNOUCHI', 35.6815, 139.7640], ['OTEMACHI', 35.6866, 139.7640], ['NIHONBASHI', 35.6840, 139.7745], ['GINZA', 35.6717, 139.7650], ['SHIMBASHI', 35.6660, 139.7580]],
    nearby: [], water: [['TOKYO BAY', 35.6250, 139.8000]],
    places: [['Tokyo Station', 35.6812, 139.7671, 40], ['Tokyo Stock Exchange', 35.6826, 139.7783, 40], ['Imperial Palace', 35.6852, 139.7528, 30], ['Kabukiza', 35.6694, 139.7678, 40]]
  },
  hongkong: {
    id: 'hongkong', name: 'Hong Kong', flag: '🇭🇰', lat: 22.2820, lon: 114.1588, centre: [22.2860, 114.1680], view: 7000,
    blurb: 'Central and Victoria Harbour: skyscrapers stacked against the mountain, ferries below.',
    need: 1200000, fee: 150000,
    districts: [['CENTRAL', 22.2810, 114.1580], ['ADMIRALTY', 22.2790, 114.1650], ['WAN CHAI', 22.2770, 114.1750], ['TSIM SHA TSUI', 22.2980, 114.1720]],
    nearby: [], water: [['VICTORIA HARBOUR', 22.2880, 114.1700]],
    places: [['IFC', 22.2850, 114.1590, 420], ['Bank of China Tower', 22.2793, 114.1615, 370], ['Hong Kong Exchange', 22.2843, 114.1580, 60], ['Star Ferry', 22.2870, 114.1610, 20]]
  },
  dubai: {
    id: 'dubai', name: 'Dubai', flag: '🇦🇪', lat: 25.1972, lon: 55.2744, centre: [25.2000, 55.2780], view: 7000,
    blurb: 'Downtown and the DIFC: the tallest tower in the world and money from everywhere.',
    need: 3000000, fee: 350000,
    districts: [['DOWNTOWN', 25.1960, 55.2750], ['DIFC', 25.2120, 55.2810], ['BUSINESS BAY', 25.1860, 55.2650]],
    nearby: [], water: [['DUBAI CANAL', 25.1880, 55.2580]],
    places: [['Burj Khalifa', 25.1972, 55.2744, 830], ['Dubai Mall', 25.1985, 55.2796, 40], ['DIFC Gate', 25.2133, 55.2820, 60], ['Dubai Exchange', 25.2150, 55.2830, 60]]
  }
};
window.CITY = window.CITIES[new URLSearchParams(location.search).get('city')] || window.CITIES.nyc;
