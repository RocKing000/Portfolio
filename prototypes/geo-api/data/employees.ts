// Sample data — illustrative only. All names, organisations, and coordinates are synthetic.
// In production this would be loaded from a database or a parsed attendance PDF export.

export interface AttendanceRecord {
  date: string;
  timestamp: string;
  lat: number;
  lng: number;
  reason?: string;
}

export interface Employee {
  id: string;
  name: string;
  designation: string;
  bank: string;
  state: string;
  branch: string;
  attendance: AttendanceRecord[];
}

export const employees: Employee[] = [
  {
    id: "1001",
    name: "Sample Employee A",
    designation: "RM",
    bank: "BANK_A",
    state: "State A",
    branch: "Branch North",
    attendance: [
      { date: "2026-03-25", timestamp: "2026-03-25T07:30:00", lat: 28.6139, lng: 77.2090 },
      { date: "2026-03-24", timestamp: "2026-03-24T07:45:00", lat: 28.6139, lng: 77.2090 },
      { date: "2026-03-23", timestamp: "2026-03-23T08:00:00", lat: 28.6139, lng: 77.2090 },
      { date: "2026-03-21", timestamp: "2026-03-21T07:55:00", lat: 28.6139, lng: 77.2090 },
      { date: "2026-03-20", timestamp: "2026-03-20T09:15:00", lat: 28.6152, lng: 77.2101 },
      { date: "2026-03-19", timestamp: "2026-03-19T07:40:00", lat: 28.6139, lng: 77.2090 },
      { date: "2026-03-18", timestamp: "2026-03-18T07:35:00", lat: 28.6139, lng: 77.2090 },
      { date: "2026-03-17", timestamp: "2026-03-17T08:10:00", lat: 28.6139, lng: 77.2090 },
    ],
  },
  {
    id: "1002",
    name: "Sample Employee B",
    designation: "SRM",
    bank: "BANK_B",
    state: "State B",
    branch: "Branch East",
    attendance: [
      { date: "2026-03-25", timestamp: "2026-03-25T06:50:00", lat: 19.0760, lng: 72.8777 },
      { date: "2026-03-24", timestamp: "2026-03-24T06:55:00", lat: 19.0760, lng: 72.8777 },
      { date: "2026-03-21", timestamp: "2026-03-21T07:00:00", lat: 19.0760, lng: 72.8777 },
      { date: "2026-03-20", timestamp: "2026-03-20T07:05:00", lat: 19.0760, lng: 72.8777 },
      { date: "2026-03-19", timestamp: "2026-03-19T07:10:00", lat: 19.0760, lng: 72.8777 },
      { date: "2026-03-18", timestamp: "2026-03-18T06:45:00", lat: 19.0760, lng: 72.8777 },
    ],
  },
  {
    id: "1003",
    name: "Sample Employee C",
    designation: "TM",
    bank: "BANK_A",
    state: "State C",
    branch: "Branch South",
    // Sparse attendance — triggers LOW_ATTENDANCE flag in /api/stats
    attendance: [
      { date: "2026-03-25", timestamp: "2026-03-25T09:30:00", lat: 13.0827, lng: 80.2707 },
      { date: "2026-03-18", timestamp: "2026-03-18T09:45:00", lat: 13.0827, lng: 80.2707 },
      { date: "2026-03-11", timestamp: "2026-03-11T10:00:00", lat: 13.0827, lng: 80.2707 },
      { date: "2026-03-04", timestamp: "2026-03-04T18:30:00", lat: 13.0827, lng: 80.2707 },
    ],
  },
];
