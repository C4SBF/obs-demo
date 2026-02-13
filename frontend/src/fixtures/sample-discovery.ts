import type { DeviceCensus, OntologyInfo } from "../types";

export const SAMPLE_CENSUS: DeviceCensus[] = [
  { device_address: "192.168.176.11", device_id: 3056313, device_name: "BAC0", vendor: "Servisys inc.", object_count: 0 },
  { device_address: "192.168.176.2", device_id: 400001, device_name: "Building-AHU-1", vendor: "BACpypes", object_count: 9 },
  { device_address: "192.168.176.9", device_id: 400020, device_name: "Building-Chiller-1", vendor: "BACpypes", object_count: 4 },
  { device_address: "192.168.176.10", device_id: 400030, device_name: "Building-Main-Meter", vendor: "BACpypes", object_count: 3 },
  { device_address: "192.168.176.3", device_id: 400010, device_name: "Floor1-VAV-North", vendor: "BACpypes", object_count: 6 },
  { device_address: "192.168.176.4", device_id: 400011, device_name: "Floor1-VAV-South", vendor: "BACpypes", object_count: 6 },
  { device_address: "192.168.176.5", device_id: 400012, device_name: "Floor2-VAV-North", vendor: "BACpypes", object_count: 6 },
  { device_address: "192.168.176.6", device_id: 400013, device_name: "Floor2-VAV-South", vendor: "BACpypes", object_count: 6 },
  { device_address: "192.168.176.7", device_id: 400014, device_name: "Floor3-VAV-North", vendor: "BACpypes", object_count: 6 },
  { device_address: "192.168.176.8", device_id: 400015, device_name: "Floor3-VAV-South", vendor: "BACpypes", object_count: 6 },
];

type GraphNode = {
  id: string;
  type: string;
  tags?: string[];
  attrs?: Record<string, unknown>;
};

type GraphEdge = {
  source: string;
  target: string;
  type: string;
  attrs?: Record<string, unknown>;
};

type DiscoveryGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: Record<string, unknown>;
};

// Sample device graphs in the standard nodes/edges format
export const SAMPLE_GRAPHS: Record<number, DiscoveryGraph> = {
  3056313: {
    nodes: [
      { id: "bacnet://192.168.176.11/3056313", type: "device", attrs: { name: "BAC0", protocol: "bacnet", address: "192.168.176.11", protocol_id: "3056313", manufacturer: "Servisys inc." } },
    ],
    edges: [],
    meta: { source: "demo-fixture" },
  },
  400001: {
    nodes: [
      { id: "bacnet://192.168.176.2/400001", type: "device", attrs: { name: "Building-AHU-1", protocol: "bacnet", address: "192.168.176.2", protocol_id: "400001", manufacturer: "BACpypes" } },
      { id: "bacnet://192.168.176.2/400001/AHU-1-Supply-Air-Temp-SP", type: "point", attrs: { name: "AHU-1-Supply-Air-Temp-SP", description: "AHU Supply Air Temperature Setpoint", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read-write", present_value: 55.0 } },
      { id: "bacnet://192.168.176.2/400001/AHU-1-Supply-Air-Temp", type: "point", attrs: { name: "AHU-1-Supply-Air-Temp", description: "AHU Supply Air Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 55.19 } },
      { id: "bacnet://192.168.176.2/400001/AHU-1-Return-Air-Temp", type: "point", attrs: { name: "AHU-1-Return-Air-Temp", description: "AHU Return Air Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 71.97 } },
      { id: "bacnet://192.168.176.2/400001/AHU-1-Mixed-Air-Temp", type: "point", attrs: { name: "AHU-1-Mixed-Air-Temp", description: "AHU Mixed Air Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 73.56 } },
      { id: "bacnet://192.168.176.2/400001/AHU-1-Supply-Air-Flow", type: "point", attrs: { name: "AHU-1-Supply-Air-Flow", description: "AHU Supply Air Flow", units: "CFM", data_type: "float", access: "read", present_value: 11735.51 } },
      { id: "bacnet://192.168.176.2/400001/AHU-1-Fan-Status", type: "point", attrs: { name: "AHU-1-Fan-Status", description: "AHU Fan Running Status", data_type: "bool", access: "read", present_value: true } },
      { id: "bacnet://192.168.176.2/400001/AHU-1-Fan-Speed-Cmd", type: "point", attrs: { name: "AHU-1-Fan-Speed-Cmd", description: "AHU Fan Speed Command", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 73.35 } },
      { id: "bacnet://192.168.176.2/400001/AHU-1-Cooling-Valve", type: "point", attrs: { name: "AHU-1-Cooling-Valve", description: "AHU Cooling Valve Position", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 61.24 } },
      { id: "bacnet://192.168.176.2/400001/AHU-1-Enable", type: "point", attrs: { name: "AHU-1-Enable", description: "AHU Enable Command", data_type: "bool", access: "read-write", present_value: true } },
    ],
    edges: [
      { source: "bacnet://192.168.176.2/400001", target: "bacnet://192.168.176.2/400001/AHU-1-Supply-Air-Temp-SP", type: "hasPoint" },
      { source: "bacnet://192.168.176.2/400001", target: "bacnet://192.168.176.2/400001/AHU-1-Supply-Air-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.2/400001", target: "bacnet://192.168.176.2/400001/AHU-1-Return-Air-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.2/400001", target: "bacnet://192.168.176.2/400001/AHU-1-Mixed-Air-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.2/400001", target: "bacnet://192.168.176.2/400001/AHU-1-Supply-Air-Flow", type: "hasPoint" },
      { source: "bacnet://192.168.176.2/400001", target: "bacnet://192.168.176.2/400001/AHU-1-Fan-Status", type: "hasPoint" },
      { source: "bacnet://192.168.176.2/400001", target: "bacnet://192.168.176.2/400001/AHU-1-Fan-Speed-Cmd", type: "hasPoint" },
      { source: "bacnet://192.168.176.2/400001", target: "bacnet://192.168.176.2/400001/AHU-1-Cooling-Valve", type: "hasPoint" },
      { source: "bacnet://192.168.176.2/400001", target: "bacnet://192.168.176.2/400001/AHU-1-Enable", type: "hasPoint" },
    ],
    meta: { source: "demo-fixture" },
  },
  400020: {
    nodes: [
      { id: "bacnet://192.168.176.9/400020", type: "device", attrs: { name: "Building-Chiller-1", protocol: "bacnet", address: "192.168.176.9", protocol_id: "400020", manufacturer: "BACpypes" } },
      { id: "bacnet://192.168.176.9/400020/Chiller-1-CHW-Supply-Temp", type: "point", attrs: { name: "Chiller-1-CHW-Supply-Temp", description: "Chiller Chilled Water Supply Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 42.89 } },
      { id: "bacnet://192.168.176.9/400020/Chiller-1-CHW-Return-Temp", type: "point", attrs: { name: "Chiller-1-CHW-Return-Temp", description: "Chiller Chilled Water Return Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 51.27 } },
      { id: "bacnet://192.168.176.9/400020/Chiller-1-Status", type: "point", attrs: { name: "Chiller-1-Status", description: "Chiller Running Status", data_type: "bool", access: "read", present_value: true } },
      { id: "bacnet://192.168.176.9/400020/Chiller-1-Enable", type: "point", attrs: { name: "Chiller-1-Enable", description: "Chiller Enable Command", data_type: "bool", access: "read-write", present_value: true } },
    ],
    edges: [
      { source: "bacnet://192.168.176.9/400020", target: "bacnet://192.168.176.9/400020/Chiller-1-CHW-Supply-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.9/400020", target: "bacnet://192.168.176.9/400020/Chiller-1-CHW-Return-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.9/400020", target: "bacnet://192.168.176.9/400020/Chiller-1-Status", type: "hasPoint" },
      { source: "bacnet://192.168.176.9/400020", target: "bacnet://192.168.176.9/400020/Chiller-1-Enable", type: "hasPoint" },
    ],
    meta: { source: "demo-fixture" },
  },
  400030: {
    nodes: [
      { id: "bacnet://192.168.176.10/400030", type: "device", attrs: { name: "Building-Main-Meter", protocol: "bacnet", address: "192.168.176.10", protocol_id: "400030", manufacturer: "BACpypes" } },
      { id: "bacnet://192.168.176.10/400030/Main-Meter-Total-Power", type: "point", attrs: { name: "Main-Meter-Total-Power", description: "Building Total Power Demand", units: "kW", unit_id: "qudt:Kilowatt", data_type: "float", access: "read", present_value: 103.76 } },
      { id: "bacnet://192.168.176.10/400030/Main-Meter-Total-Energy", type: "point", attrs: { name: "Main-Meter-Total-Energy", description: "Building Total Energy Consumption", units: "kWh", unit_id: "qudt:KilowattHour", data_type: "float", access: "read", present_value: 42.87 } },
      { id: "bacnet://192.168.176.10/400030/Main-Meter-Voltage", type: "point", attrs: { name: "Main-Meter-Voltage", description: "Main Electrical Voltage", units: "V", unit_id: "qudt:Volt", data_type: "float", access: "read", present_value: 475.82 } },
    ],
    edges: [
      { source: "bacnet://192.168.176.10/400030", target: "bacnet://192.168.176.10/400030/Main-Meter-Total-Power", type: "hasPoint" },
      { source: "bacnet://192.168.176.10/400030", target: "bacnet://192.168.176.10/400030/Main-Meter-Total-Energy", type: "hasPoint" },
      { source: "bacnet://192.168.176.10/400030", target: "bacnet://192.168.176.10/400030/Main-Meter-Voltage", type: "hasPoint" },
    ],
    meta: { source: "demo-fixture" },
  },
  400010: {
    nodes: [
      { id: "bacnet://192.168.176.3/400010", type: "device", attrs: { name: "Floor1-VAV-North", protocol: "bacnet", address: "192.168.176.3", protocol_id: "400010", manufacturer: "BACpypes" } },
      { id: "bacnet://192.168.176.3/400010/Floor1-North-Zone-Temp-SP", type: "point", attrs: { name: "Floor1-North-Zone-Temp-SP", description: "Floor 1 North Zone Temperature Setpoint", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read-write", present_value: 72.0 } },
      { id: "bacnet://192.168.176.3/400010/Floor1-North-Zone-Temp", type: "point", attrs: { name: "Floor1-North-Zone-Temp", description: "Floor 1 North Zone Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 71.60 } },
      { id: "bacnet://192.168.176.3/400010/Floor1-North-Airflow", type: "point", attrs: { name: "Floor1-North-Airflow", description: "Floor 1 North Airflow", units: "CFM", data_type: "float", access: "read", present_value: 2045.27 } },
      { id: "bacnet://192.168.176.3/400010/Floor1-North-Occupancy", type: "point", attrs: { name: "Floor1-North-Occupancy", description: "Floor 1 North Occupancy Sensor", data_type: "bool", access: "read", present_value: true } },
      { id: "bacnet://192.168.176.3/400010/Floor1-North-Damper-Pos", type: "point", attrs: { name: "Floor1-North-Damper-Pos", description: "Floor 1 North Damper Position", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 68.18 } },
      { id: "bacnet://192.168.176.3/400010/Floor1-North-Reheat-Valve", type: "point", attrs: { name: "Floor1-North-Reheat-Valve", description: "Floor 1 North Reheat Valve", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 0.0 } },
    ],
    edges: [
      { source: "bacnet://192.168.176.3/400010", target: "bacnet://192.168.176.3/400010/Floor1-North-Zone-Temp-SP", type: "hasPoint" },
      { source: "bacnet://192.168.176.3/400010", target: "bacnet://192.168.176.3/400010/Floor1-North-Zone-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.3/400010", target: "bacnet://192.168.176.3/400010/Floor1-North-Airflow", type: "hasPoint" },
      { source: "bacnet://192.168.176.3/400010", target: "bacnet://192.168.176.3/400010/Floor1-North-Occupancy", type: "hasPoint" },
      { source: "bacnet://192.168.176.3/400010", target: "bacnet://192.168.176.3/400010/Floor1-North-Damper-Pos", type: "hasPoint" },
      { source: "bacnet://192.168.176.3/400010", target: "bacnet://192.168.176.3/400010/Floor1-North-Reheat-Valve", type: "hasPoint" },
    ],
    meta: { source: "demo-fixture" },
  },
  400011: {
    nodes: [
      { id: "bacnet://192.168.176.4/400011", type: "device", attrs: { name: "Floor1-VAV-South", protocol: "bacnet", address: "192.168.176.4", protocol_id: "400011", manufacturer: "BACpypes" } },
      { id: "bacnet://192.168.176.4/400011/Floor1-South-Zone-Temp-SP", type: "point", attrs: { name: "Floor1-South-Zone-Temp-SP", description: "Floor 1 South Zone Temperature Setpoint", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read-write", present_value: 72.0 } },
      { id: "bacnet://192.168.176.4/400011/Floor1-South-Zone-Temp", type: "point", attrs: { name: "Floor1-South-Zone-Temp", description: "Floor 1 South Zone Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 71.78 } },
      { id: "bacnet://192.168.176.4/400011/Floor1-South-Airflow", type: "point", attrs: { name: "Floor1-South-Airflow", description: "Floor 1 South Airflow", units: "CFM", data_type: "float", access: "read", present_value: 1106.75 } },
      { id: "bacnet://192.168.176.4/400011/Floor1-South-Occupancy", type: "point", attrs: { name: "Floor1-South-Occupancy", description: "Floor 1 South Occupancy Sensor", data_type: "bool", access: "read", present_value: true } },
      { id: "bacnet://192.168.176.4/400011/Floor1-South-Damper-Pos", type: "point", attrs: { name: "Floor1-South-Damper-Pos", description: "Floor 1 South Damper Position", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 36.89 } },
      { id: "bacnet://192.168.176.4/400011/Floor1-South-Reheat-Valve", type: "point", attrs: { name: "Floor1-South-Reheat-Valve", description: "Floor 1 South Reheat Valve", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 0.0 } },
    ],
    edges: [
      { source: "bacnet://192.168.176.4/400011", target: "bacnet://192.168.176.4/400011/Floor1-South-Zone-Temp-SP", type: "hasPoint" },
      { source: "bacnet://192.168.176.4/400011", target: "bacnet://192.168.176.4/400011/Floor1-South-Zone-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.4/400011", target: "bacnet://192.168.176.4/400011/Floor1-South-Airflow", type: "hasPoint" },
      { source: "bacnet://192.168.176.4/400011", target: "bacnet://192.168.176.4/400011/Floor1-South-Occupancy", type: "hasPoint" },
      { source: "bacnet://192.168.176.4/400011", target: "bacnet://192.168.176.4/400011/Floor1-South-Damper-Pos", type: "hasPoint" },
      { source: "bacnet://192.168.176.4/400011", target: "bacnet://192.168.176.4/400011/Floor1-South-Reheat-Valve", type: "hasPoint" },
    ],
    meta: { source: "demo-fixture" },
  },
  400012: {
    nodes: [
      { id: "bacnet://192.168.176.5/400012", type: "device", attrs: { name: "Floor2-VAV-North", protocol: "bacnet", address: "192.168.176.5", protocol_id: "400012", manufacturer: "BACpypes" } },
      { id: "bacnet://192.168.176.5/400012/Floor2-North-Zone-Temp-SP", type: "point", attrs: { name: "Floor2-North-Zone-Temp-SP", description: "Floor 2 North Zone Temperature Setpoint", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read-write", present_value: 72.0 } },
      { id: "bacnet://192.168.176.5/400012/Floor2-North-Zone-Temp", type: "point", attrs: { name: "Floor2-North-Zone-Temp", description: "Floor 2 North Zone Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 72.18 } },
      { id: "bacnet://192.168.176.5/400012/Floor2-North-Airflow", type: "point", attrs: { name: "Floor2-North-Airflow", description: "Floor 2 North Airflow", units: "CFM", data_type: "float", access: "read", present_value: 1911.97 } },
      { id: "bacnet://192.168.176.5/400012/Floor2-North-Occupancy", type: "point", attrs: { name: "Floor2-North-Occupancy", description: "Floor 2 North Occupancy Sensor", data_type: "bool", access: "read", present_value: true } },
      { id: "bacnet://192.168.176.5/400012/Floor2-North-Damper-Pos", type: "point", attrs: { name: "Floor2-North-Damper-Pos", description: "Floor 2 North Damper Position", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 63.73 } },
      { id: "bacnet://192.168.176.5/400012/Floor2-North-Reheat-Valve", type: "point", attrs: { name: "Floor2-North-Reheat-Valve", description: "Floor 2 North Reheat Valve", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 0.0 } },
    ],
    edges: [
      { source: "bacnet://192.168.176.5/400012", target: "bacnet://192.168.176.5/400012/Floor2-North-Zone-Temp-SP", type: "hasPoint" },
      { source: "bacnet://192.168.176.5/400012", target: "bacnet://192.168.176.5/400012/Floor2-North-Zone-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.5/400012", target: "bacnet://192.168.176.5/400012/Floor2-North-Airflow", type: "hasPoint" },
      { source: "bacnet://192.168.176.5/400012", target: "bacnet://192.168.176.5/400012/Floor2-North-Occupancy", type: "hasPoint" },
      { source: "bacnet://192.168.176.5/400012", target: "bacnet://192.168.176.5/400012/Floor2-North-Damper-Pos", type: "hasPoint" },
      { source: "bacnet://192.168.176.5/400012", target: "bacnet://192.168.176.5/400012/Floor2-North-Reheat-Valve", type: "hasPoint" },
    ],
    meta: { source: "demo-fixture" },
  },
  400013: {
    nodes: [
      { id: "bacnet://192.168.176.6/400013", type: "device", attrs: { name: "Floor2-VAV-South", protocol: "bacnet", address: "192.168.176.6", protocol_id: "400013", manufacturer: "BACpypes" } },
      { id: "bacnet://192.168.176.6/400013/Floor2-South-Zone-Temp-SP", type: "point", attrs: { name: "Floor2-South-Zone-Temp-SP", description: "Floor 2 South Zone Temperature Setpoint", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read-write", present_value: 72.0 } },
      { id: "bacnet://192.168.176.6/400013/Floor2-South-Zone-Temp", type: "point", attrs: { name: "Floor2-South-Zone-Temp", description: "Floor 2 South Zone Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 72.55 } },
      { id: "bacnet://192.168.176.6/400013/Floor2-South-Airflow", type: "point", attrs: { name: "Floor2-South-Airflow", description: "Floor 2 South Airflow", units: "CFM", data_type: "float", access: "read", present_value: 1199.72 } },
      { id: "bacnet://192.168.176.6/400013/Floor2-South-Occupancy", type: "point", attrs: { name: "Floor2-South-Occupancy", description: "Floor 2 South Occupancy Sensor", data_type: "bool", access: "read", present_value: true } },
      { id: "bacnet://192.168.176.6/400013/Floor2-South-Damper-Pos", type: "point", attrs: { name: "Floor2-South-Damper-Pos", description: "Floor 2 South Damper Position", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 39.99 } },
      { id: "bacnet://192.168.176.6/400013/Floor2-South-Reheat-Valve", type: "point", attrs: { name: "Floor2-South-Reheat-Valve", description: "Floor 2 South Reheat Valve", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 0.0 } },
    ],
    edges: [
      { source: "bacnet://192.168.176.6/400013", target: "bacnet://192.168.176.6/400013/Floor2-South-Zone-Temp-SP", type: "hasPoint" },
      { source: "bacnet://192.168.176.6/400013", target: "bacnet://192.168.176.6/400013/Floor2-South-Zone-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.6/400013", target: "bacnet://192.168.176.6/400013/Floor2-South-Airflow", type: "hasPoint" },
      { source: "bacnet://192.168.176.6/400013", target: "bacnet://192.168.176.6/400013/Floor2-South-Occupancy", type: "hasPoint" },
      { source: "bacnet://192.168.176.6/400013", target: "bacnet://192.168.176.6/400013/Floor2-South-Damper-Pos", type: "hasPoint" },
      { source: "bacnet://192.168.176.6/400013", target: "bacnet://192.168.176.6/400013/Floor2-South-Reheat-Valve", type: "hasPoint" },
    ],
    meta: { source: "demo-fixture" },
  },
  400014: {
    nodes: [
      { id: "bacnet://192.168.176.7/400014", type: "device", attrs: { name: "Floor3-VAV-North", protocol: "bacnet", address: "192.168.176.7", protocol_id: "400014", manufacturer: "BACpypes" } },
      { id: "bacnet://192.168.176.7/400014/Floor3-North-Zone-Temp-SP", type: "point", attrs: { name: "Floor3-North-Zone-Temp-SP", description: "Floor 3 North Zone Temperature Setpoint", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read-write", present_value: 72.0 } },
      { id: "bacnet://192.168.176.7/400014/Floor3-North-Zone-Temp", type: "point", attrs: { name: "Floor3-North-Zone-Temp", description: "Floor 3 North Zone Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 71.72 } },
      { id: "bacnet://192.168.176.7/400014/Floor3-North-Airflow", type: "point", attrs: { name: "Floor3-North-Airflow", description: "Floor 3 North Airflow", units: "CFM", data_type: "float", access: "read", present_value: 1622.76 } },
      { id: "bacnet://192.168.176.7/400014/Floor3-North-Occupancy", type: "point", attrs: { name: "Floor3-North-Occupancy", description: "Floor 3 North Occupancy Sensor", data_type: "bool", access: "read", present_value: true } },
      { id: "bacnet://192.168.176.7/400014/Floor3-North-Damper-Pos", type: "point", attrs: { name: "Floor3-North-Damper-Pos", description: "Floor 3 North Damper Position", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 54.09 } },
      { id: "bacnet://192.168.176.7/400014/Floor3-North-Reheat-Valve", type: "point", attrs: { name: "Floor3-North-Reheat-Valve", description: "Floor 3 North Reheat Valve", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 0.0 } },
    ],
    edges: [
      { source: "bacnet://192.168.176.7/400014", target: "bacnet://192.168.176.7/400014/Floor3-North-Zone-Temp-SP", type: "hasPoint" },
      { source: "bacnet://192.168.176.7/400014", target: "bacnet://192.168.176.7/400014/Floor3-North-Zone-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.7/400014", target: "bacnet://192.168.176.7/400014/Floor3-North-Airflow", type: "hasPoint" },
      { source: "bacnet://192.168.176.7/400014", target: "bacnet://192.168.176.7/400014/Floor3-North-Occupancy", type: "hasPoint" },
      { source: "bacnet://192.168.176.7/400014", target: "bacnet://192.168.176.7/400014/Floor3-North-Damper-Pos", type: "hasPoint" },
      { source: "bacnet://192.168.176.7/400014", target: "bacnet://192.168.176.7/400014/Floor3-North-Reheat-Valve", type: "hasPoint" },
    ],
    meta: { source: "demo-fixture" },
  },
  400015: {
    nodes: [
      { id: "bacnet://192.168.176.8/400015", type: "device", attrs: { name: "Floor3-VAV-South", protocol: "bacnet", address: "192.168.176.8", protocol_id: "400015", manufacturer: "BACpypes" } },
      { id: "bacnet://192.168.176.8/400015/Floor3-South-Zone-Temp-SP", type: "point", attrs: { name: "Floor3-South-Zone-Temp-SP", description: "Floor 3 South Zone Temperature Setpoint", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read-write", present_value: 72.0 } },
      { id: "bacnet://192.168.176.8/400015/Floor3-South-Zone-Temp", type: "point", attrs: { name: "Floor3-South-Zone-Temp", description: "Floor 3 South Zone Temperature", units: "°F", unit_id: "qudt:DegreeFahrenheit", data_type: "float", access: "read", present_value: 71.86 } },
      { id: "bacnet://192.168.176.8/400015/Floor3-South-Airflow", type: "point", attrs: { name: "Floor3-South-Airflow", description: "Floor 3 South Airflow", units: "CFM", data_type: "float", access: "read", present_value: 839.17 } },
      { id: "bacnet://192.168.176.8/400015/Floor3-South-Occupancy", type: "point", attrs: { name: "Floor3-South-Occupancy", description: "Floor 3 South Occupancy Sensor", data_type: "bool", access: "read", present_value: true } },
      { id: "bacnet://192.168.176.8/400015/Floor3-South-Damper-Pos", type: "point", attrs: { name: "Floor3-South-Damper-Pos", description: "Floor 3 South Damper Position", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 27.97 } },
      { id: "bacnet://192.168.176.8/400015/Floor3-South-Reheat-Valve", type: "point", attrs: { name: "Floor3-South-Reheat-Valve", description: "Floor 3 South Reheat Valve", units: "%", unit_id: "qudt:Percent", data_type: "float", access: "read-write", present_value: 0.0 } },
    ],
    edges: [
      { source: "bacnet://192.168.176.8/400015", target: "bacnet://192.168.176.8/400015/Floor3-South-Zone-Temp-SP", type: "hasPoint" },
      { source: "bacnet://192.168.176.8/400015", target: "bacnet://192.168.176.8/400015/Floor3-South-Zone-Temp", type: "hasPoint" },
      { source: "bacnet://192.168.176.8/400015", target: "bacnet://192.168.176.8/400015/Floor3-South-Airflow", type: "hasPoint" },
      { source: "bacnet://192.168.176.8/400015", target: "bacnet://192.168.176.8/400015/Floor3-South-Occupancy", type: "hasPoint" },
      { source: "bacnet://192.168.176.8/400015", target: "bacnet://192.168.176.8/400015/Floor3-South-Damper-Pos", type: "hasPoint" },
      { source: "bacnet://192.168.176.8/400015", target: "bacnet://192.168.176.8/400015/Floor3-South-Reheat-Valve", type: "hasPoint" },
    ],
    meta: { source: "demo-fixture" },
  },
};

export const ONTOLOGIES: (OntologyInfo & { url: string })[] = [
  { id: "brick_v1.4.4", name: "Brick", version: "1.4.4", url: "https://brickschema.org/schema/1.4.4/Brick.jsonld" },
];
