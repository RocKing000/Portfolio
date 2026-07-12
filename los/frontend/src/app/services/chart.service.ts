import { Injectable } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Injectable({ providedIn: 'root' })
export class ChartService {

  trendLine(labels: string[], demand: number[], collected: number[]): ChartConfiguration {
    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Demand',    data: demand,    borderColor: '#3b82f6', backgroundColor: '#3b82f620',
            fill: true, tension: 0.4, pointRadius: 4 },
          { label: 'Collected', data: collected, borderColor: '#10b981', backgroundColor: '#10b98120',
            fill: true, tension: 0.4, pointRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: false, grid: { color: '#f3f4f6' } },
                  x: { grid: { display: false } } },
      },
    };
  }

  bucketDonut(labels: string[], data: number[], colors: string[]): ChartConfiguration<'doughnut'> {
    return {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right' } },
        cutout: '65%',
      },
    };
  }

  barChart(labels: string[], datasets: { label: string; data: number[]; color: string }[]): ChartConfiguration {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: datasets.map(d => ({
          label: d.label, data: d.data,
          backgroundColor: d.color + 'cc', borderColor: d.color, borderWidth: 1,
        })),
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                  x: { grid: { display: false } } },
      },
    };
  }

  sparkline(data: number[], color: string): ChartConfiguration {
    return {
      type: 'line',
      data: {
        labels: data.map((_, i) => String(i)),
        datasets: [{ data, borderColor: color, backgroundColor: color + '30',
                     fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        elements: { line: { borderWidth: 2 } },
      },
    };
  }

  horizontalBar(labels: string[], data: number[], colors: string[]): ChartConfiguration {
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderRadius: 4 }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                  y: { grid: { display: false } } },
      },
    };
  }
}
