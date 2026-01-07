// Chart.js configuration and utilities
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// IBM Carbon color palette for charts
export const CARBON_COLORS = {
  blue70: '#0043ce',
  blue60: '#0f62fe',
  blue50: '#4589ff',
  cyan50: '#1192e8',
  cyan40: '#33b1ff',
  teal50: '#009d9a',
  teal40: '#08bdba',
  green50: '#24a148',
  green40: '#42be65',
  yellow30: '#f1c21b',
  orange40: '#ff832b',
  red50: '#da1e28',
  red60: '#da1e28',
  purple60: '#8a3ffc',
  purple50: '#a56eff',
  magenta50: '#ee5396',
  gray70: '#525252',
  gray60: '#6f6f6f',
  gray50: '#8d8d8d',
} as const;

// Sequential palette for bar charts (blue gradient)
export const BAR_CHART_COLORS = [
  CARBON_COLORS.blue60,
  CARBON_COLORS.cyan50,
  CARBON_COLORS.teal50,
  CARBON_COLORS.green50,
  CARBON_COLORS.purple60,
  CARBON_COLORS.magenta50,
  CARBON_COLORS.orange40,
  CARBON_COLORS.yellow30,
];

// Categorical palette for pie/donut charts
export const PIE_CHART_COLORS = [
  CARBON_COLORS.blue60,
  CARBON_COLORS.teal50,
  CARBON_COLORS.purple60,
  CARBON_COLORS.cyan50,
  CARBON_COLORS.magenta50,
  CARBON_COLORS.green50,
  CARBON_COLORS.orange40,
  CARBON_COLORS.yellow30,
  CARBON_COLORS.red50,
  CARBON_COLORS.gray60,
];

// Status colors
export const STATUS_CHART_COLORS = {
  success: CARBON_COLORS.green50,
  warning: CARBON_COLORS.yellow30,
  error: CARBON_COLORS.red50,
  info: CARBON_COLORS.blue60,
  neutral: CARBON_COLORS.gray60,
};

// Power state colors
export const POWER_STATE_CHART_COLORS = {
  poweredOn: CARBON_COLORS.green50,
  poweredOff: CARBON_COLORS.gray60,
  suspended: CARBON_COLORS.yellow30,
};

// Default chart options
export const defaultBarOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: '#161616',
      titleColor: '#f4f4f4',
      bodyColor: '#f4f4f4',
      padding: 12,
      cornerRadius: 0,
    },
  },
  scales: {
    x: {
      grid: {
        color: '#e0e0e0',
      },
      ticks: {
        color: '#525252',
      },
    },
    y: {
      grid: {
        display: false,
      },
      ticks: {
        color: '#525252',
      },
    },
  },
};

export const defaultPieOptions: ChartOptions<'pie'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        color: '#525252',
        padding: 16,
        usePointStyle: true,
        pointStyle: 'rect',
      },
    },
    tooltip: {
      backgroundColor: '#161616',
      titleColor: '#f4f4f4',
      bodyColor: '#f4f4f4',
      padding: 12,
      cornerRadius: 0,
    },
  },
};

export const defaultDoughnutOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '60%',
  plugins: {
    legend: {
      position: 'right',
      labels: {
        color: '#525252',
        padding: 16,
        usePointStyle: true,
        pointStyle: 'rect',
      },
    },
    tooltip: {
      backgroundColor: '#161616',
      titleColor: '#f4f4f4',
      bodyColor: '#f4f4f4',
      padding: 12,
      cornerRadius: 0,
    },
  },
};

// Helper to generate colors for datasets
export function getBarColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(BAR_CHART_COLORS[i % BAR_CHART_COLORS.length]);
  }
  return colors;
}

export function getPieColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(PIE_CHART_COLORS[i % PIE_CHART_COLORS.length]);
  }
  return colors;
}
