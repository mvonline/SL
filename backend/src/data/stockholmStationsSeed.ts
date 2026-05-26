export interface StockholmStationSeed {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  tariff_zone: string;
  stop_type: string;
  is_major: number;
}

/** Greater Stockholm static seed — used when SL API is slow or unavailable */
export const STOCKHOLM_STATIONS_SEED: StockholmStationSeed[] = [
  // City centre & inner city
  { id: '9001', name: 'T-Centralen', latitude: 59.331, longitude: 18.062, tariff_zone: 'A', stop_type: 'METRO', is_major: 1 },
  { id: '9192', name: 'Slussen', latitude: 59.320, longitude: 18.072, tariff_zone: 'A', stop_type: 'METRO', is_major: 1 },
  { id: '9112', name: 'Gamla stan', latitude: 59.324, longitude: 18.068, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9120', name: 'Odenplan', latitude: 59.343, longitude: 18.050, tariff_zone: 'A', stop_type: 'METRO', is_major: 1 },
  { id: '9122', name: 'Tekniska högskolan', latitude: 59.346, longitude: 18.072, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9101', name: 'Fridhemsplan', latitude: 59.333, longitude: 18.031, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9102', name: 'Hötorget', latitude: 59.336, longitude: 18.064, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9103', name: 'Östermalmstorg', latitude: 59.334, longitude: 18.077, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9104', name: 'Karlaplan', latitude: 59.340, longitude: 18.091, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9105', name: 'Medborgarplatsen', latitude: 59.314, longitude: 18.074, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9106', name: 'Skanstull', latitude: 59.308, longitude: 18.076, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9107', name: 'Mariatorget', latitude: 59.317, longitude: 18.059, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9108', name: 'Zinkensdamm', latitude: 59.317, longitude: 18.044, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9109', name: 'Hornstull', latitude: 59.316, longitude: 18.035, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9812', name: 'Nybroplan', latitude: 59.333, longitude: 18.077, tariff_zone: 'A', stop_type: 'FERRY', is_major: 1 },
  { id: '9055', name: 'Stockholms Östra', latitude: 59.346, longitude: 18.070, tariff_zone: 'A', stop_type: 'TRAIN', is_major: 0 },
  { id: '9201', name: 'Stockholm City', latitude: 59.330, longitude: 18.058, tariff_zone: 'A', stop_type: 'TRAIN', is_major: 1 },

  // South
  { id: '9290', name: 'Gullmarsplan', latitude: 59.299, longitude: 18.080, tariff_zone: 'A', stop_type: 'METRO', is_major: 1 },
  { id: '9702', name: 'Liljeholmen', latitude: 59.309, longitude: 18.023, tariff_zone: 'A', stop_type: 'METRO', is_major: 1 },
  { id: '9301', name: 'Globen (Avicii Arena)', latitude: 59.293, longitude: 18.083, tariff_zone: 'A', stop_type: 'METRO', is_major: 1 },
  { id: '9302', name: 'Skärholmen', latitude: 59.277, longitude: 17.907, tariff_zone: 'B', stop_type: 'METRO', is_major: 1 },
  { id: '9303', name: 'Farsta', latitude: 59.243, longitude: 18.094, tariff_zone: 'B', stop_type: 'METRO', is_major: 1 },
  { id: '9304', name: 'Högdalen', latitude: 59.239, longitude: 18.031, tariff_zone: 'B', stop_type: 'METRO', is_major: 0 },
  { id: '9305', name: 'Rågsved', latitude: 59.258, longitude: 18.028, tariff_zone: 'B', stop_type: 'METRO', is_major: 0 },
  { id: '9306', name: 'Aspudden', latitude: 59.306, longitude: 18.011, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9307', name: 'Telefonplan', latitude: 59.298, longitude: 18.011, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9308', name: 'Midsommarkransen', latitude: 59.301, longitude: 18.002, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9309', name: 'Sickla', latitude: 59.304, longitude: 18.115, tariff_zone: 'A', stop_type: 'TRAIN', is_major: 0 },
  { id: '9310', name: 'Flemingsberg', latitude: 59.216, longitude: 17.942, tariff_zone: 'B', stop_type: 'TRAIN', is_major: 1 },
  { id: '9311', name: 'Huddinge', latitude: 59.237, longitude: 17.981, tariff_zone: 'B', stop_type: 'TRAIN', is_major: 0 },
  { id: '9312', name: 'Stuvsta', latitude: 59.254, longitude: 17.981, tariff_zone: 'B', stop_type: 'TRAIN', is_major: 0 },

  // North & northwest
  { id: '9509', name: 'Solna centrum', latitude: 59.365, longitude: 18.010, tariff_zone: 'A', stop_type: 'METRO', is_major: 1 },
  { id: '9501', name: 'Sundbyberg centrum', latitude: 59.361, longitude: 17.971, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9502', name: 'Råsunda', latitude: 59.375, longitude: 18.010, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9503', name: 'Danderyds sjukhus', latitude: 59.388, longitude: 18.043, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9504', name: 'Mörby centrum', latitude: 59.398, longitude: 18.046, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9505', name: 'Helenelund', latitude: 59.409, longitude: 17.965, tariff_zone: 'A', stop_type: 'TRAIN', is_major: 0 },
  { id: '9506', name: 'Sollentuna', latitude: 59.428, longitude: 17.951, tariff_zone: 'A', stop_type: 'TRAIN', is_major: 1 },
  { id: '9507', name: 'Märsta', latitude: 59.618, longitude: 17.855, tariff_zone: 'C', stop_type: 'TRAIN', is_major: 1 },
  { id: '9508', name: 'Upplands Väsby', latitude: 59.518, longitude: 17.911, tariff_zone: 'C', stop_type: 'TRAIN', is_major: 0 },
  { id: '9510', name: 'Kista', latitude: 59.402, longitude: 17.944, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9511', name: 'Hallonbergen', latitude: 59.386, longitude: 17.965, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9512', name: 'Tensta', latitude: 59.394, longitude: 17.902, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9513', name: 'Rinkeby', latitude: 59.388, longitude: 17.926, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },

  // West
  { id: '9601', name: 'Brommaplan', latitude: 59.338, longitude: 17.940, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9602', name: 'Hässelby strand', latitude: 59.362, longitude: 17.832, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9704', name: 'Spånga', latitude: 59.384, longitude: 17.901, tariff_zone: 'A', stop_type: 'TRAIN', is_major: 0 },
  { id: '9604', name: 'Ängby', latitude: 59.335, longitude: 17.923, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9605', name: 'Alvik', latitude: 59.332, longitude: 17.980, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9606', name: 'Vällingby', latitude: 59.364, longitude: 17.872, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },

  // East & Nacka
  { id: '9701', name: 'Ropsten', latitude: 59.357, longitude: 18.102, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9703', name: 'Gärdet', latitude: 59.345, longitude: 18.102, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9704', name: 'Mosebacke', latitude: 59.318, longitude: 18.075, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9705', name: 'Henriksdal', latitude: 59.310, longitude: 18.104, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9706', name: 'Saltsjöqvarn', latitude: 59.325, longitude: 18.115, tariff_zone: 'A', stop_type: 'TRAIN', is_major: 0 },
  { id: '9707', name: 'Nacka', latitude: 59.310, longitude: 18.163, tariff_zone: 'A', stop_type: 'BUS', is_major: 0 },
  { id: '9708', name: 'Lidingö', latitude: 59.367, longitude: 18.133, tariff_zone: 'A', stop_type: 'BUS', is_major: 0 },

  // Northeast & archipelago ferry
  { id: '9801', name: 'Universitetet', latitude: 59.365, longitude: 18.055, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9802', name: 'Bergshamra', latitude: 59.382, longitude: 18.036, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9803', name: 'Stadion', latitude: 59.345, longitude: 18.083, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: '9804', name: 'Vaxholm', latitude: 59.403, longitude: 18.353, tariff_zone: 'C', stop_type: 'FERRY', is_major: 0 },
  { id: '9805', name: 'Djurgården', latitude: 59.327, longitude: 18.115, tariff_zone: 'A', stop_type: 'BUS', is_major: 0 },

  // Bus hubs spread across county (fixed grid, not random)
  { id: 'b001', name: 'Vällingby bussterminal', latitude: 59.363, longitude: 17.871, tariff_zone: 'A', stop_type: 'BUS', is_major: 0 },
  { id: 'b002', name: 'Södermalmstorg', latitude: 59.319, longitude: 18.070, tariff_zone: 'A', stop_type: 'BUS', is_major: 0 },
  { id: 'b003', name: 'Norrtull', latitude: 59.348, longitude: 18.037, tariff_zone: 'A', stop_type: 'BUS', is_major: 0 },
  { id: 'b004', name: 'Odenplan buss', latitude: 59.343, longitude: 18.048, tariff_zone: 'A', stop_type: 'BUS', is_major: 0 },
  { id: 'b005', name: 'Fruängen', latitude: 59.287, longitude: 17.964, tariff_zone: 'B', stop_type: 'METRO', is_major: 0 },
  { id: 'b006', name: 'Vårberg', latitude: 59.274, longitude: 17.888, tariff_zone: 'B', stop_type: 'METRO', is_major: 0 },
  { id: 'b007', name: 'Fittja', latitude: 59.248, longitude: 17.859, tariff_zone: 'B', stop_type: 'METRO', is_major: 0 },
  { id: 'b008', name: 'Hässelby gård', latitude: 59.366, longitude: 17.844, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: 'b009', name: 'Akalla', latitude: 59.415, longitude: 17.914, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: 'b010', name: 'Hjulsta', latitude: 59.424, longitude: 17.889, tariff_zone: 'A', stop_type: 'METRO', is_major: 0 },
  { id: 'b011', name: 'Bagarmossen', latitude: 59.277, longitude: 18.132, tariff_zone: 'B', stop_type: 'METRO', is_major: 0 },
  { id: 'b012', name: 'Kärrtorp', latitude: 59.268, longitude: 18.115, tariff_zone: 'B', stop_type: 'METRO', is_major: 0 },
  { id: 'b013', name: 'Bandhagen', latitude: 59.272, longitude: 18.049, tariff_zone: 'B', stop_type: 'METRO', is_major: 0 },
  { id: 'b014', name: 'Älvsjö', latitude: 59.278, longitude: 18.011, tariff_zone: 'A', stop_type: 'TRAIN', is_major: 0 },
  { id: 'b015', name: 'Tumba', latitude: 59.198, longitude: 17.834, tariff_zone: 'C', stop_type: 'TRAIN', is_major: 0 },
  { id: 'b016', name: 'Södertälje centrum', latitude: 59.196, longitude: 17.628, tariff_zone: 'C', stop_type: 'TRAIN', is_major: 1 },
  { id: 'b017', name: 'Nynäshamn', latitude: 58.903, longitude: 17.948, tariff_zone: 'C', stop_type: 'TRAIN', is_major: 1 },
  { id: 'b018', name: 'Arlanda C', latitude: 59.652, longitude: 17.918, tariff_zone: 'C', stop_type: 'TRAIN', is_major: 1 },
  { id: 'b019', name: 'Bromma flygplats', latitude: 59.355, longitude: 17.946, tariff_zone: 'A', stop_type: 'BUS', is_major: 0 },
  { id: 'b020', name: 'Ekerö centrum', latitude: 59.291, longitude: 17.812, tariff_zone: 'B', stop_type: 'BUS', is_major: 0 },
];
