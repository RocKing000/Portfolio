import { NextResponse } from "next/server";
import { employees } from "@/data/employees";

// GET /api/employees — list all employees (without full attendance)
export async function GET() {
  const summary = employees.map((emp) => {
    const latest = emp.attendance[0]; // already sorted newest-first
    return {
      id: emp.id,
      name: emp.name,
      designation: emp.designation,
      bank: emp.bank,
      state: emp.state,
      branch: emp.branch,
      currentLocation: latest
        ? { lat: latest.lat, lng: latest.lng }
        : null,
      lastSeen: latest?.timestamp ?? null,
      totalRecords: emp.attendance.length,
    };
  });

  return NextResponse.json(summary, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
