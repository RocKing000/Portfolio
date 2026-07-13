import { NextResponse } from "next/server";
import { employees } from "../../../data/employees";

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function getWorkingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (!isWeekend(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export async function GET() {
  // Per-employee compliance assessment
  const employeeStats = employees.map((emp) => {
    const dates = emp.attendance.map((a) => new Date(a.timestamp));
    dates.sort((a, b) => a.getTime() - b.getTime());

    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    const totalWorkingDays = getWorkingDaysBetween(earliest, latest);
    const attendanceDays = emp.attendance.length;
    const attendanceRate =
      totalWorkingDays > 0
        ? Math.round((attendanceDays / totalWorkingDays) * 100)
        : 0;

    const lateCheckins = emp.attendance.filter((a) => {
      const hour = new Date(a.timestamp).getHours();
      return hour >= 9;
    });

    const earlyCheckins = emp.attendance.filter((a) => {
      const hour = new Date(a.timestamp).getHours();
      const min = new Date(a.timestamp).getMinutes();
      return hour < 6 || (hour === 6 && min < 30);
    });

    const offHoursCheckins = emp.attendance.filter((a) => {
      const hour = new Date(a.timestamp).getHours();
      return hour >= 18;
    });

    const uniqueCoords = new Set(
      emp.attendance.map((a) => `${a.lat},${a.lng}`)
    );
    const sameLocation = uniqueCoords.size === 1 && emp.attendance.length > 3;

    const flags: { code: string; message: string; severity: string }[] = [];

    if (attendanceRate < 60) {
      flags.push({
        code: "LOW_ATTENDANCE",
        message: `Attendance rate is ${attendanceRate}% (${attendanceDays}/${totalWorkingDays} working days)`,
        severity: attendanceRate < 40 ? "CRITICAL" : "HIGH",
      });
    } else if (attendanceRate < 80) {
      flags.push({
        code: "BELOW_AVG_ATTENDANCE",
        message: `Attendance rate is ${attendanceRate}% (${attendanceDays}/${totalWorkingDays} working days)`,
        severity: "MEDIUM",
      });
    }

    if (lateCheckins.length > attendanceDays * 0.3) {
      flags.push({
        code: "FREQUENT_LATE",
        message: `${lateCheckins.length} of ${attendanceDays} check-ins were after 09:00 AM`,
        severity: lateCheckins.length > attendanceDays * 0.5 ? "HIGH" : "MEDIUM",
      });
    }

    if (offHoursCheckins.length > 0) {
      flags.push({
        code: "OFF_HOURS",
        message: `${offHoursCheckins.length} check-in(s) recorded after 18:00`,
        severity: "LOW",
      });
    }

    if (sameLocation) {
      flags.push({
        code: "STATIC_GPS",
        message: `All ${emp.attendance.length} check-ins from identical coordinates — possible GPS spoofing`,
        severity: "MEDIUM",
      });
    }

    let score = 0;
    if (attendanceRate < 80) score += Math.round((80 - attendanceRate) * 0.8);
    if (lateCheckins.length > 0)
      score += Math.min(25, Math.round((lateCheckins.length / attendanceDays) * 30));
    if (sameLocation) score += 15;
    if (offHoursCheckins.length > 0) score += 5;
    score = Math.min(100, score);

    const level =
      score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";

    const sortedAtt = [...emp.attendance].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const latestLoc = sortedAtt[0]
      ? { lat: sortedAtt[0].lat, lng: sortedAtt[0].lng }
      : null;

    return {
      id: emp.id,
      name: emp.name,
      designation: emp.designation,
      bank: emp.bank,
      state: emp.state,
      branch: emp.branch,
      totalCheckIns: attendanceDays,
      totalWorkingDays,
      attendanceRate,
      lateCheckIns: lateCheckins.length,
      earlyCheckIns: earlyCheckins.length,
      offHoursCheckIns: offHoursCheckins.length,
      sameLocation,
      lastSeen: latest.toISOString(),
      latestLocation: latestLoc,
      score,
      level,
      flags,
    };
  });

  // Branch-level centroid from all employee attendance
  const branchMap = new Map<
    string,
    { state: string; branch: string; lats: number[]; lngs: number[]; empIds: string[] }
  >();

  for (const emp of employees) {
    const key = `${emp.state}::${emp.branch}`;
    if (!branchMap.has(key)) {
      branchMap.set(key, { state: emp.state, branch: emp.branch, lats: [], lngs: [], empIds: [] });
    }
    const entry = branchMap.get(key)!;
    entry.empIds.push(emp.id);
    for (const att of emp.attendance) {
      entry.lats.push(att.lat);
      entry.lngs.push(att.lng);
    }
  }

  const branches = Array.from(branchMap.values()).map((b) => {
    const lat = b.lats.reduce((s, v) => s + v, 0) / b.lats.length;
    const lng = b.lngs.reduce((s, v) => s + v, 0) / b.lngs.length;
    const branchEmps = employeeStats.filter(
      (e) => e.state === b.state && e.branch === b.branch
    );
    const branchAvgAttendance =
      branchEmps.length > 0
        ? Math.round(branchEmps.reduce((s, e) => s + e.attendanceRate, 0) / branchEmps.length)
        : 0;

    return {
      state: b.state,
      branch: b.branch,
      lat,
      lng,
      employeeCount: b.empIds.length,
      avgAttendance: branchAvgAttendance,
    };
  });

  const totalEmployees = employees.length;
  const totalCheckIns = employeeStats.reduce((s, e) => s + e.totalCheckIns, 0);
  const avgAttendanceRate = Math.round(
    employeeStats.reduce((s, e) => s + e.attendanceRate, 0) / totalEmployees
  );
  const totalLateCheckIns = employeeStats.reduce((s, e) => s + e.lateCheckIns, 0);
  const highRiskCount = employeeStats.filter(
    (e) => e.level === "HIGH" || e.level === "CRITICAL"
  ).length;
  const avgRiskScore = Math.round(
    employeeStats.reduce((s, e) => s + e.score, 0) / totalEmployees
  );
  const totalFlags = employeeStats.reduce((s, e) => s + e.flags.length, 0);
  const statesCovered = new Set(employees.map((e) => e.state)).size;

  return NextResponse.json(
    {
      summary: {
        totalEmployees,
        totalCheckIns,
        avgAttendanceRate,
        totalLateCheckIns,
        highRiskCount,
        avgRiskScore,
        totalFlags,
        statesCovered,
      },
      employees: employeeStats,
      branches,
    },
    { headers: { "Access-Control-Allow-Origin": "*" } }
  );
}
