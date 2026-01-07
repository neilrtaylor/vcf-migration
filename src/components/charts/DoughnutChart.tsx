// Doughnut chart component
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  DoughnutController,
  ArcElement,
} from 'chart.js';
import { ChartWrapper } from './ChartWrapper';
import { defaultDoughnutOptions, getPieColors } from '@/utils/chartConfig';
import type { ChartOptions } from 'chart.js';

// Register doughnut controller
ChartJS.register(DoughnutController, ArcElement);

interface DataPoint {
  label: string;
  value: number;
}

interface DoughnutChartProps {
  title?: string;
  subtitle?: string;
  data: DataPoint[];
  height?: number;
  colors?: string[];
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  centerLabel?: string;
  centerValue?: string | number;
  formatValue?: (value: number) => string;
}

export function DoughnutChart({
  title,
  subtitle,
  data,
  height = 300,
  colors,
  showLegend = true,
  legendPosition = 'right',
  formatValue,
}: DoughnutChartProps) {
  const labels = data.map((d) => d.label);
  const values = data.map((d) => d.value);
  const pieColors = colors || getPieColors(data.length);

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: pieColors,
        borderWidth: 0,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    ...defaultDoughnutOptions,
    plugins: {
      ...defaultDoughnutOptions.plugins,
      legend: {
        display: showLegend,
        position: legendPosition,
        labels: {
          color: '#525252',
          padding: 12,
          usePointStyle: true,
          pointStyle: 'rect',
        },
      },
      tooltip: {
        ...defaultDoughnutOptions.plugins?.tooltip,
        callbacks: formatValue
          ? {
              label: (context) => {
                const value = context.raw as number;
                const label = context.label || '';
                return `${label}: ${formatValue(value)}`;
              },
            }
          : undefined,
      },
    },
  };

  return (
    <ChartWrapper title={title} subtitle={subtitle} height={height}>
      <Doughnut data={chartData} options={options} />
    </ChartWrapper>
  );
}
